import assert from "node:assert/strict";
import { ROULETTE_CORE_V11 as core, ROULETTE_RULES_V11 as R, ROULETTE_WHEEL, rouletteCartesianPocket, rouletteStake, rouletteSurfaceV11 } from "../lib/verified/galacticRouletteCore.v11";
import { applyCoreInput, stepCore, replayCore } from "../lib/verified/coreRuntime.v1";
import { verifyCoreFixture } from "./core-test-utils";
import fixture from "./fixtures/roulette-v11.json" with { type: "json" };
assert.equal(core.gameVersion, "11.0.0");
assert.equal(core.create("x").balanceMinor, 10000, "always 100 chips");
verifyCoreFixture(core, fixture.seed, fixture.inputs, fixture.finalTick, 1e9, { score: fixture.score, status: fixture.status as "won", failure: fixture.failure, hash: fixture.hash });
assert.equal(fixture.inputs.at(-1)?.action, "CASH_OUT");
// Denominations: 1 by default, 5 and 25 selectable, stake added up.
const s = core.create("denoms");
assert.equal(s.denomination, 1);
applyCoreInput(core, s, "BET_RED", 1e9); stepCore(core, s, 1e9);
applyCoreInput(core, s, "CHIP_25", 1e9); stepCore(core, s, 1e9);
applyCoreInput(core, s, "BET_NUMBER_17", 1e9); stepCore(core, s, 1e9);
applyCoreInput(core, s, "CHIP_5", 1e9); stepCore(core, s, 1e9);
applyCoreInput(core, s, "BET_RED", 1e9); stepCore(core, s, 1e9);
assert.equal(rouletteStake(s), 31);
// Cannot stake more than the balance.
const poor = core.create("poor");
poor.balanceMinor = 2000;
poor.denomination = 25;
assert.equal(core.canApply(poor, "BET_RED"), false);
poor.denomination = 5;
assert.equal(core.canApply(poor, "BET_RED"), true);
// Unthrown chips stay on the cloth (no expiry); nothing is charged until the throw.
const e = core.create("expiry");
applyCoreInput(core, e, "BET_RED", 1e9);
for (let i = 0; i < 1199; i++) stepCore(core, e, 1e9);
assert.equal(e.chips.length, 1);
stepCore(core, e, 1e9);
assert.equal(e.chips.length, 1);
assert.equal(e.balanceMinor, 10000);
// The cloth is empty right after the throw and after the spin, and history records results.
const t = core.create("spin");
applyCoreInput(core, t, "BET_RED", 1e9); stepCore(core, t, 1e9);
applyCoreInput(core, t, "TOSS_D10_P08", 1e9);
assert.equal(t.chips.length, 0);
assert.equal(t.lockedChips.length, 1);
assert.equal(t.balanceMinor, 9900);
while (t.landingTick !== -1 && t.status === "running") stepCore(core, t, 1e9);
assert.equal(t.chips.length, 0);
assert.ok(t.history.length === 1 || t.lastMiss);
assert.ok(fixture.inputs.length > 10);
// Stop keeps the balance; nothing can follow.
const c = core.create("stop");
assert.equal(applyCoreInput(core, c, "CASH_OUT", 1e9), true);
assert.equal(c.status, "won");
assert.equal(core.canApply(c, "BET_RED"), false);
assert.equal(replayCore(core, [], 21600, "idle", 1e9).valid, false);
assert.equal(core.maxFinalTick, 72000);
// Containment: every throw (all directions/powers) ends in a pocket, never a miss and never outside the rim.
let contained = 0;
const spins: number[] = [], frets: number[] = [];
for (let d = 0; d < 32; d += 2) for (const p of [0, 3, 7, 11, 15]) {
  const b = core.create(`contain-${d}-${p}`);
  applyCoreInput(core, b, "BET_RED", 1e9); stepCore(core, b, 1e9);
  applyCoreInput(core, b, `TOSS_D${String(d).padStart(2, "0")}_P${String(p).padStart(2, "0")}`, 1e9);
  const deadline = b.landingTick;
  for (let i = 0; i < 2500 && b.landingTick !== -1; i++) stepCore(core, b, 1e9);
  assert.notEqual(b.lastLandingTick, deadline, `settled by physics, not by the clock, at d${d} p${p}`);
  assert.equal(b.lastMiss, false, `miss at d${d} p${p}`);
  assert.notEqual(b.lastNumber, null);
  const dist = Math.hypot(b.ballX - 195000, b.ballY - 195000);
  assert.ok(dist <= 151000, `ball outside wheel at d${d} p${p}: ${dist}`);
  // It rests on a pocket floor (never on the numbered band) and the result is the pocket it is in.
  assert.ok(dist >= R.pocketFloorIn - 2000 && dist <= R.pocketFloorOut + 2000, `ball not in a pocket at d${d} p${p}: ${dist}`);
  assert.equal(b.lastNumber, ROULETTE_WHEEL[rouletteCartesianPocket(b.wheelPhase, b.ballX - 195000, b.ballY - 195000)]);
  contained++;
  spins.push(b.lastLandingTick - b.flightStart); frets.push(b.frets);
}
const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
assert.ok(avg(spins) >= 700, `the ball keeps rolling longer (avg ${avg(spins)} ticks)`);
assert.ok(avg(frets) >= 2, `the ball clatters on the frets (avg ${avg(frets)})`);
console.log(`spins avg ${(avg(spins) / 120).toFixed(1)} s, fret hops avg ${avg(frets).toFixed(1)}`);
// V11 physics review: low frets and a calm bounce. Over many throws the ball still clatters from pocket to pocket
// but never rises far above the pocket floor (V10 reached 55 px).
{
  const hops: number[] = [], fretsAll: number[] = [];
  for (let d = 0; d < 32; d++) for (const p of [1, 5, 9, 13]) {
    const b = core.create(`calm-${d}-${p}`);
    applyCoreInput(core, b, "BET_RED", 1e9); stepCore(core, b, 1e9);
    applyCoreInput(core, b, `TOSS_D${String(d).padStart(2, "0")}_P${String(p).padStart(2, "0")}`, 1e9);
    let maxHop = 0;
    while (b.landingTick !== -1 && b.status === "running") {
      stepCore(core, b, 1e9);
      const r = Math.hypot(b.ballX - 195000, b.ballY - 195000);
      // Height of the ball above the surface right under it, inside the pocket ring, once it has met a fret.
      if (b.frets > 0 && r >= R.fretInner && r <= R.fretOuter) maxHop = Math.max(maxHop, b.ballZ - R.ballRadius - rouletteSurfaceV11(Math.round(r)).z);
    }
    hops.push(maxHop); fretsAll.push(b.frets);
  }
  hops.sort((x, y) => x - y);
  const p90 = hops[Math.floor(hops.length * 0.9)], max = hops[hops.length - 1];
  assert.ok(R.fretHeight <= R.ballRadius / 2, "frets lower than half the ball");
  assert.ok(p90 <= 4000, `p90 bounce above the pocket floor ${p90 / 1000} px`);
  assert.ok(max <= 8000, `max bounce above the pocket floor ${max / 1000} px`);
  assert.ok(avg(fretsAll) >= 1.5, `still bounces between pockets (avg fret hits ${avg(fretsAll)})`);
  console.log(`V11 calm frets: bounce p90 ${(p90 / 1000).toFixed(1)} px, max ${(max / 1000).toFixed(1)} px, fret hits avg ${avg(fretsAll).toFixed(1)}`);
}
// Rotor geometry: the pocket floor is the lowest ring; the lip and the cone wall rise on both sides.
assert.equal(rouletteSurfaceV11(93000).z, 0);
assert.ok(rouletteSurfaceV11(110000).z >= R.lipHeight && rouletteSurfaceV11(84000).z >= R.coneEdgeHeight);
assert.ok(rouletteSurfaceV11(140000).z > rouletteSurfaceV11(115000).z, "the ball track slopes down to the rotor");
// A ball sliding sideways in a pocket is stopped by the fret, not carried into the next pocket.
{
  const f = core.create("fret-wall");
  applyCoreInput(core, f, "BET_RED", 1e9); stepCore(core, f, 1e9);
  applyCoreInput(core, f, "TOSS_D10_P08", 1e9);
  f.wheelSpeed = 0;
  const phase = Math.round(f.wheelPhase / 16) + Math.round((5 * 4096) / 37);
  const a = (phase / 4096) * Math.PI * 2;
  const px = Math.sin(a), py = -Math.cos(a);
  f.ballX = 195000 + Math.round(px * 93000); f.ballY = 195000 + Math.round(py * 93000); f.ballZ = R.ballRadius; f.inBowl = true;
  f.ballVx = Math.round(-py * 400); f.ballVy = Math.round(px * 400); f.ballVz = 0;
  for (let i = 0; i < 40; i++) stepCore(core, f, 1e9);
  assert.ok(f.frets >= 1, "the fret is hit");
  assert.equal(rouletteCartesianPocket(f.wheelPhase, f.ballX - 195000, f.ballY - 195000), 5, "a slow ball stays in its pocket");
}
console.log("Roulette V11 OK: ball contained in", contained, "throws, denominations, cleared cloth, no expiry, history, golden replay");
