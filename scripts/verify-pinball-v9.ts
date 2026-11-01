import assert from "node:assert/strict";
import { applyCoreInput, replayCore, stepCore } from "../lib/verified/coreRuntime.v1";
import { PINBALL_CORE_V9 as core, PINBALL_RULES_V9 as R, PINBALL_SAUCER_V9, PINBALL_WORMHOLE_V9, copyPinballStateV9, type PinballStateV9 } from "../lib/verified/pinballCore.v9";
import { PINBALL_CORE_V8 } from "../lib/verified/pinballCore.v8";
import { playPinballV9 } from "./pinball-v9-play-fixture";
import { playPinballV8 } from "./pinball-v8-play-fixture";
import fixture from "./fixtures/pinball-v9.json" with { type: "json" };

assert.equal(core.gameVersion, "9.0.0");
// Golden runs replay to the same score and state.
type Run = { seed: string; finalTick: number; score: number; inputs: [number, string][] };
for (const run of fixture.runs as unknown as Run[]) {
  const inputs = run.inputs.map(([tick, action], seq) => ({ seq, tick, action }));
  const r = replayCore(core, inputs, run.finalTick, run.seed, 1e9);
  assert.ok(r.valid, "replay valid");
  assert.equal(r.state?.score, run.score);
}
// Without the new features V9 plays exactly like V8 (same table, same physics).
{
  const a = playPinballV8("same-table", "smart", 7).s, b = playPinballV9("same-table", "smart", 7).s;
  assert.equal(b.score, a.score); assert.equal(b.tick, a.tick);
  assert.equal(PINBALL_CORE_V8.gameVersion, "8.0.0");
}
const ball = (x: number, y: number, vx = 0, vy = 0) => ({ x, y, vx, vy, xr: 0, yr: 0 });
const kinds = (s: PinballStateV9) => s.feed.map((e) => e.kind);
const toSaucer = (s: PinballStateV9) => {
  s.phase = "play"; s.saucerHold = 0; s.saucerUntil = 0; s.ball = ball(PINBALL_SAUCER_V9.x, PINBALL_SAUCER_V9.y);
  stepCore(core, s, 1e9);
  for (let i = 0; i < R.saucerHoldTicks + 2; i++) stepCore(core, s, 1e9);
};
// The right targets light the lock; two locks, then the third lit saucer starts a three-ball multiball.
const s = core.create("pin9-multiball");
s.phase = "play"; s.rTargets = [1, 1, 0]; s.ball = ball(330000, 320000, 200000, 0);
for (let i = 0; i < 6 && !s.lockLit; i++) stepCore(core, s, 1e9);
assert.equal(s.lockLit, 1, "three right targets light the lock");
toSaucer(s); assert.equal(s.locks, 1); assert.ok(kinds(s).includes("LOCK"));
s.lockLit = 1; toSaucer(s); assert.equal(s.locks, 2);
s.lockLit = 1; toSaucer(s);
assert.equal(s.multiball, 1, "third lock: multiball");
assert.equal(s.extra.length, 2, "two more balls in play");
assert.equal(s.locks, 0);
// Extra balls play the table: they move, and a drained one comes back during the multiball save.
const start = s.extra.map((e) => [e.x, e.y]);
for (let i = 0; i < 30; i++) stepCore(core, s, 1e9);
assert.ok(s.extra.every((e, i) => e.x !== start[i][0] || e.y !== start[i][1]), "extra balls move");
s.extra[0].y = R.drainY + 1000; s.extra[0].vy = 100000; stepCore(core, s, 1e9);
assert.equal(s.extra.length, 2, "saved during the multiball save");
// Jackpots grow on the ramp; every third lights the super jackpot at the wormhole.
const before = s.jackpots;
for (let j = 0; j < 3; j++) {
  s.tube = -1; s.lastRampTick = -1000; s.lastOrbitTick = -1000; s.tubeUntil = s.tick + 1000;
  s.ball = ball(44000, 180000, 0, -300000); stepCore(core, s, 1e9);
}
assert.equal(s.jackpots - before, 3);
assert.equal(s.jackpotValue, R.jackpotBase + 3 * R.jackpotStep);
assert.equal(s.superLit, 1);
const sc = s.score;
s.tubeUntil = 0; s.ball = ball(PINBALL_WORMHOLE_V9.x, PINBALL_WORMHOLE_V9.y); stepCore(core, s, 1e9);
assert.equal(s.supers, 1);
assert.ok(s.score - sc >= (R.jackpotBase + 3 * R.jackpotStep) * R.superFactor, "super jackpot");
// After the save, a drained extra ball is gone; the main ball draining hands over to an extra one; then it ends.
s.tube = -1; s.mbSaveUntil = -1;
s.extra[0].y = R.drainY + 1000; s.extra[0].vy = 100000; stepCore(core, s, 1e9);
assert.equal(s.extra.length, 1);
s.tube = -1; s.saucerHold = 0; s.ball = ball(195000, R.drainY + 2000, 0, 100000); stepCore(core, s, 1e9);
assert.equal(s.phase, "play", "another ball takes over");
assert.equal(s.extra.length, 0);
assert.equal(s.multiball, 0, "back to one ball: multiball over");
assert.ok(kinds(s).includes("MBEND"));
// Modes: each mission starts the next 20-second mode; bumpers pay ×10 in BUMPER STORM.
{
  const m = core.create("pin9-modes");
  m.phase = "play"; m.mission = [1, 1, 0]; m.drops = [1, 1, 0]; m.ball = ball(238000, 395000, 0, -200000);
  for (let i = 0; i < 6 && m.mode < 0; i++) stepCore(core, m, 1e9);
  assert.equal(m.mode, 0, "first mission: bumper storm");
  const sc0 = m.score, mult = m.multiplier;
  m.ball = ball(150000, 150000 + 20000 + R.radiusMilli - 500, 0, -100000); stepCore(core, m, 1e9);
  assert.ok(m.score - sc0 >= R.modeBumper * mult, "bumper worth 1000");
  for (let i = 0; i < R.modeTicks; i++) stepCore(core, m, 1e9);
  assert.equal(m.mode, -1, "the mode ends after 20 s");
  assert.ok(m.feed.length >= 0 && m.nextMode === 1);
}
// Determinism: the same run twice is the same state.
assert.deepEqual(copyPinballStateV9(playPinballV9("twice", "smart", 6).s), copyPinballStateV9(playPinballV9("twice", "smart", 6).s));
void applyCoreInput;
console.log("Pinball V9 OK · lock ×2 → multiball (3 balls, save) · growing jackpots · super at the wormhole · hand-over on drain · modes 20 s · V8 table unchanged");
