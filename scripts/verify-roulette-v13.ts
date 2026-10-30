import assert from "node:assert/strict";
import { ROULETTE_CORE_V13 as core, ROULETTE_RULES_V13 as R, ROULETTE_DIAMONDS_V13, ROULETTE_WHEEL, rouletteCartesianPocket, rouletteStake, rouletteSurfaceV13 } from "../lib/verified/galacticRouletteCore.v13";
import { applyCoreInput, stepCore, replayCore } from "../lib/verified/coreRuntime.v1";
import { verifyCoreFixture } from "./core-test-utils";
import fixture from "./fixtures/roulette-v13.json" with { type: "json" };
assert.equal(core.gameVersion, "13.0.0");
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
// V13: livelier bounce and diamond deflectors. Over many throws the ball meets a diamond in most spins and jumps
// clearly above the track, the frets bounce more than V11 (p90 2.2 px) and the result stays fair.
{
  const hops: number[] = [], jumps: number[] = [], counts = new Array(37).fill(0);
  let withDiamond = 0, n = 0;
  for (let d = 0; d < 32; d++) for (const p of [0, 2, 4, 6, 8, 10, 12, 14]) for (const k of [0, 1, 2]) {
    const b = core.create(`lively-${d}-${p}-${k}`);
    applyCoreInput(core, b, "BET_RED", 1e9); stepCore(core, b, 1e9);
    applyCoreInput(core, b, `TOSS_D${String(d).padStart(2, "0")}_P${String(p).padStart(2, "0")}`, 1e9);
    let maxHop = 0, maxJump = 0;
    while (b.landingTick !== -1 && b.status === "running") {
      stepCore(core, b, 1e9);
      const r = Math.hypot(b.ballX - 195000, b.ballY - 195000);
      const above = b.ballZ - R.ballRadius - rouletteSurfaceV13(Math.round(r)).z;
      if (b.frets > 0 && r >= R.fretInner && r <= R.fretOuter) maxHop = Math.max(maxHop, above);
      if (b.diamonds > 0 && r >= R.numberOuter) maxJump = Math.max(maxJump, above);
    }
    assert.equal(b.lastMiss, false);
    hops.push(maxHop); jumps.push(maxJump); if (b.diamonds > 0) withDiamond++;
    if (b.lastNumber !== null) counts[b.lastNumber]++; n++;
  }
  const q = (a: number[], f: number) => [...a].sort((x, y) => x - y)[Math.floor(a.length * f)];
  const e = n / 37, chi = counts.reduce((sum, o) => sum + (o - e) ** 2 / e, 0);
  assert.ok(withDiamond / n >= 0.6, `most spins meet a diamond (${withDiamond}/${n})`);
  assert.ok(q(jumps.filter((j) => j > 0), 0.5) >= 6000, `a diamond makes the ball jump (median ${q(jumps.filter((j) => j > 0), 0.5) / 1000} px)`);
  assert.ok(Math.max(...jumps) <= 32000, `diamond jump capped (${Math.max(...jumps) / 1000} px)`);
  assert.ok(q(hops, 0.9) >= 4000, `frets bounce more than V11 (p90 ${q(hops, 0.9) / 1000} px)`);
  assert.ok(chi < 60, `fair spread over the 37 numbers (chi2 ${chi.toFixed(1)}, 36 dof)`);
  console.log(`V13 lively: diamond in ${(withDiamond / n * 100).toFixed(0)} % of spins, jump median ${(q(jumps.filter((j) => j > 0), 0.5) / 1000).toFixed(1)} px, fret p90 ${(q(hops, 0.9) / 1000).toFixed(1)} px, chi2 ${chi.toFixed(1)}`);
}
// V13: a natural end. Low balls do not climb the turret, and once a ball rolls into a pocket it stops slipping and
// rides with the wheel within a fraction of a second.
{
  const onCone: number[] = [], rolls: number[] = [];
  for (let d = 0; d < 32; d += 2) for (const p of [2, 6, 10, 14]) {
    const b = core.create(`natural-${d}-${p}`);
    applyCoreInput(core, b, "BET_RED", 1e9); stepCore(core, b, 1e9);
    applyCoreInput(core, b, `TOSS_D${String(d).padStart(2, "0")}_P${String(p).padStart(2, "0")}`, 1e9);
    let cone = 0, lastMove = 0;
    while (b.landingTick !== -1 && b.status === "running") {
      stepCore(core, b, 1e9);
      const dx = b.ballX - 195000, dy = b.ballY - 195000, r = Math.hypot(dx, dy);
      if (r < 86000 && b.ballZ < R.ballRadius + 3000) cone++;
      const sx = -dy * b.wheelSpeed * 6283 / 65536000, sy = dx * b.wheelSpeed * 6283 / 65536000;
      if (Math.hypot(b.ballVx - sx, b.ballVy - sy) > 30 || r > 101000) lastMove = b.tick;
    }
    onCone.push(cone); rolls.push(b.lastLandingTick - lastMove);
  }
  assert.ok(Math.max(...onCone) <= 60, `no rolling up the turret (max ${Math.max(...onCone)} ticks)`);
  console.log(`V13 natural end: turret ticks max ${Math.max(...onCone)}, rest before the result p50 ${(rolls.sort((a, b) => a - b)[rolls.length >> 1] / 120).toFixed(2)} s`);
}
// A slow ball in a pocket sticks to it and turns with the wheel.
{
  const f = core.create("stick");
  applyCoreInput(core, f, "BET_RED", 1e9); stepCore(core, f, 1e9);
  applyCoreInput(core, f, "TOSS_D10_P08", 1e9);
  const phase = Math.round(f.wheelPhase / 16) + Math.round((7 * 4096) / 37);
  const a = (phase / 4096) * Math.PI * 2;
  f.ballX = 195000 + Math.round(Math.sin(a) * 93000); f.ballY = 195000 - Math.round(Math.cos(a) * 93000); f.ballZ = R.ballRadius; f.inBowl = true;
  const dx = f.ballX - 195000, dy = f.ballY - 195000;
  f.ballVx = Math.round(-dy * f.wheelSpeed * 6283 / 65536000) + 60; f.ballVy = Math.round(dx * f.wheelSpeed * 6283 / 65536000); f.ballVz = 0;
  const r0 = Math.hypot(dx, dy);
  for (let i = 0; i < 120; i++) stepCore(core, f, 1e9);
  assert.ok(Math.abs(Math.hypot(f.ballX - 195000, f.ballY - 195000) - r0) < 2500, "it does not slide off the pocket");
  assert.equal(rouletteCartesianPocket(f.wheelPhase, f.ballX - 195000, f.ballY - 195000), 7, "it stays in its pocket");
}
// A ball running along the track straight into a diamond is deflected and thrown up.
{
  const g = core.create("diamond-hit");
  applyCoreInput(core, g, "BET_RED", 1e9); stepCore(core, g, 1e9);
  applyCoreInput(core, g, "TOSS_D10_P08", 1e9);
  const d0 = ROULETTE_DIAMONDS_V13[0];
  g.inBowl = true; g.ballX = d0.x; g.ballY = d0.y - 20000; g.ballZ = rouletteSurfaceV13(130000).z + R.ballRadius; g.ballVx = 0; g.ballVy = 1500; g.ballVz = 0;
  for (let i = 0; i < 20; i++) stepCore(core, g, 1e9);
  assert.ok(g.diamonds >= 1, "the diamond is hit");
  assert.ok(g.ballZ > rouletteSurfaceV13(Math.round(Math.hypot(g.ballX - 195000, g.ballY - 195000))).z + R.ballRadius + 2000, "the ball is in the air after the diamond");
}
// Rotor geometry: the pocket floor is the lowest ring; the lip and the cone wall rise on both sides.
assert.equal(rouletteSurfaceV13(93000).z, 0);
assert.ok(rouletteSurfaceV13(110000).z >= R.lipHeight && rouletteSurfaceV13(84000).z >= R.coneEdgeHeight);
assert.ok(rouletteSurfaceV13(140000).z > rouletteSurfaceV13(115000).z, "the ball track slopes down to the rotor");
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
console.log("Roulette V13 OK: ball contained in", contained, "throws, denominations, cleared cloth, no expiry, history, golden replay");
