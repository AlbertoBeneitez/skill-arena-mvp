import assert from "node:assert/strict";
import { ROULETTE_CORE_V15 as core, ROULETTE_RULES_V15 as R, ROULETTE_WHEEL, roulettePocketAt, rouletteStake, type RouletteStateV15 } from "../lib/verified/galacticRouletteCore.v15";
import { applyCoreInput, stepCore, replayCore } from "../lib/verified/coreRuntime.v1";
import { verifyCoreFixture } from "./core-test-utils";
import fixture from "./fixtures/roulette-v15.json" with { type: "json" };

assert.equal(core.gameVersion, "15.0.0");
verifyCoreFixture(core, fixture.seed, fixture.inputs, fixture.finalTick, 1e9, { score: fixture.score, status: fixture.status as "won", failure: fixture.failure, hash: fixture.hash });
assert.equal(fixture.inputs.at(-1)?.action, "CASH_OUT");
assert.equal(replayCore(core, [], 21600, "idle", 1e9).valid, false);

// Bets as in V14: denominations add up, the balance caps the stake, the cloth empties at the throw.
const b = core.create("bets");
applyCoreInput(core, b, "BET_RED", 1e9); applyCoreInput(core, b, "CHIP_25", 1e9); applyCoreInput(core, b, "BET_NUMBER_17", 1e9);
assert.equal(rouletteStake(b), 26);
applyCoreInput(core, b, "TOSS_D10_P08", 1e9);
assert.deepEqual([b.chips.length, b.lockedChips.length, b.balanceMinor], [0, 2, 10000 - 2600]);

const TURN = 62831853;
type Trace = { s: RouletteStateV15; onWallUntil: number; releaseSpeed: number; rotorAt: number; speedAtRotor: number; cleanDescent: boolean; restAt: number; maxR: number; slipFalls: boolean };
function spin(seed: string, d: number, p: number): Trace {
  const s = core.create(seed);
  applyCoreInput(core, s, "BET_RED", 1e9); stepCore(core, s, 1e9);
  assert.ok(applyCoreInput(core, s, `TOSS_D${String(d).padStart(2, "0")}_P${String(p).padStart(2, "0")}`, 1e9));
  const t0 = s.tick;
  let onWallUntil = -1, releaseSpeed = 0, rotorAt = -1, speedAtRotor = 0, maxR = 0, firstSlip = -1, lastSlip = -1, hitsAtRelease = 0, cleanDescent = false;
  while (s.landingTick !== -1) {
    const wasOnWall = s.ballPhase === 1 && s.ballR === R.wallR, speed = Math.abs(s.ballVt);
    stepCore(core, s, 1e9);
    if (s.ballPhase !== 1) continue;
    assert.ok(Number.isSafeInteger(s.ballR) && Number.isSafeInteger(s.ballVt) && Number.isSafeInteger(s.ballTheta));
    maxR = Math.max(maxR, s.ballR);
    if (wasOnWall && s.ballR < R.wallR) { onWallUntil = s.tick - t0; releaseSpeed = speed; hitsAtRelease = s.diamonds; }
    if (rotorAt < 0 && s.ballR < R.rotorEdge) { rotorAt = s.tick - t0; speedAtRotor = Math.abs(s.ballVt); cleanDescent = s.diamonds === hitsAtRelease; }
    if (rotorAt >= 0 && s.ballR < R.rotorEdge) {
      const slip = Math.abs(s.ballVt - Math.round((s.wheelSpeed * TURN) / (65536 * 4) * s.ballR / 1e7));
      if (firstSlip < 0) firstSlip = slip; lastSlip = slip;
    }
  }
  return { s, onWallUntil, releaseSpeed, rotorAt, speedAtRotor, cleanDescent, restAt: s.lastLandingTick - t0, maxR, slipFalls: lastSlip < firstSlip };
}

// Every aim and power: the ball rides the wall, leaves it by itself, spirals onto the counter-turning rotor, is
// dragged towards the rotor's speed and comes to rest in a pocket on its own, well before the safety deadline.
const counts = new Array(37).fill(0);
const track: number[][] = [[], []];
let clean = 0;
for (let d = 0; d < 32; d += 1) for (const p of [0, 5, 10, 15]) {
  const t = spin(`all-${d}-${p}`, d, p), s = t.s;
  assert.ok(t.maxR <= R.wallR, "never leaves the wheel");
  assert.ok(t.onWallUntil > 0 && t.rotorAt > t.onWallUntil && t.restAt > t.rotorAt, `phases in order D${d} P${p}`);
  assert.ok(t.restAt < R.maximumFlightTicks - 240, `rests by itself D${d} P${p} (${t.restAt})`);
  // Free release: the wall lets go once the centripetal force no longer beats the banked track (5/7 rolling).
  const need = Math.round((R.gravity * R.slopeTrack * 5) / 7000);
  assert.ok(Math.round((t.releaseSpeed * t.releaseSpeed) / R.wallR) <= need * 1.15, "released at the critical speed");
  if (t.cleanDescent) { clean++; assert.ok(t.speedAtRotor > t.releaseSpeed, "speeds up as it falls (angular momentum)"); }
  assert.ok(t.slipFalls, "the rotor drags the ball towards its own speed");
  assert.ok(s.ballR >= R.floorIn - 1_000_000 && s.ballR <= R.floorOut + 1_000_000, "rests on a pocket floor");
  assert.equal(s.lastNumber, ROULETTE_WHEEL[roulettePocketAt(s.restOffset)], "the number is the pocket under the ball");
  assert.equal(s.history.at(-1), s.lastNumber);
  counts[s.lastNumber!]++;
  if (p === 0 || p === 15) track[p === 0 ? 0 : 1].push(t.onWallUntil);
  // Realistic durations: 6–14 s on the track, under 20 s until it rests.
  assert.ok(t.onWallUntil >= 6 * 120 && t.onWallUntil <= 14 * 120, `track time D${d} P${p}: ${t.onWallUntil / 120}s`);
  assert.ok(t.restAt <= 20 * 120);
}
assert.ok(clean >= 8, `enough descents without a diamond to check the speed-up (${clean})`);
// With the same aim a harder throw never rides the track less, and clearly longer when it is aimed along the track
// (an aim across the track keeps only part of the power).
assert.ok(track[0].every((w, i) => w <= track[1][i] + 24), "a harder throw never rides the track noticeably less (an inward knock costs a little)");
assert.ok(track[0].filter((w, i) => w + 120 < track[1][i]).length >= 16, "aimed along the track, power adds seconds");
assert.equal(counts.filter((c) => c > 0).length, 37, "every number can come up");
assert.ok(Math.max(...counts) <= 4 * (128 / 37), "no number dominates");
// The diamonds and the frets are part of most spins.
let diamonds = 0, frets = 0;
for (let i = 0; i < 40; i++) { const t = spin(`hits-${i}`, (i * 7) % 32, i % 16); diamonds += t.s.diamonds > 0 ? 1 : 0; frets += t.s.frets > 0 ? 1 : 0; }
assert.ok(diamonds >= 30 && frets >= 36, `diamonds ${diamonds}/40 frets ${frets}/40`);
// Same seed and inputs, same everything.
assert.deepEqual(spin("same", 12, 9).s, spin("same", 12, 9).s);
console.log("Roulette V15 OK · wall friction ∝ pressing force · free release · angular momentum · diamonds · counter-rotor drag · frets · rest in pocket · 37/37 numbers");
