import assert from "node:assert/strict";
import { generateScenario } from "../lib/server/scenarios";
import { applyCoreInput, replayCore, stepCore } from "../lib/verified/coreRuntime.v1";
import { PINBALL_CORE_V8 as core, PINBALL_RULES_V8 as R, PINBALL_TUBES_V8, PINBALL_TUBE_EXITS_V8, PINBALL_WORMHOLE_V8, copyPinballStateV8, pinballFrenzyV8, pinballTubeLengthV8, type PinballStateV8 } from "../lib/verified/pinballCore.v8";
import { verifyCoreFixture } from "./core-test-utils";
import { playPinballV8 } from "./pinball-v8-play-fixture";
import fixture from "./fixtures/pinball-v8.json" with { type: "json" };

assert.equal(core.maxFinalTick, 120 * 130, "100 s plus up to 30 s of extra time");
assert.equal(R.startTicks, 120 * 100, "the clock starts at 100 s");
const seeds = Array.from({ length: 30 }, (_, i) => generateScenario({ game_id: core.gameId, game_version: core.gameVersion }, i).seed);
// Fixed table: every match has the same layout and the same opening skill lane.
for (const seed of seeds) {
  const st = core.create(seed);
  assert.equal(st.layout, 0);
  assert.equal(st.skillLane, 0);
  assert.equal(st.endTick, R.startTicks);
}
// The same spring level is ALWAYS the same shot: identical ball path on every seed, for each level.
function launchPath(seed: string, level: number, ticks: number) {
  const s = core.create(seed);
  applyCoreInput(core, s, "PLUNGER_HOLD", 1e9);
  for (let i = 0; i < level * R.chargeStepTicks + 3; i++) stepCore(core, s, 1e9);
  applyCoreInput(core, s, "PLUNGER_RELEASE", 1e9);
  const path: number[][] = [];
  for (let i = 0; i < ticks && s.phase === "play"; i++) { stepCore(core, s, 1e9); path.push([s.ball.x, s.ball.y, s.ball.vx, s.ball.vy]); }
  return { path, score: s.score, kinds: s.feed.map((e) => e.kind).join(",") };
}
for (const level of [0, 4, R.maxChargeLevel]) {
  const ref = launchPath(seeds[0], level, 900);
  assert.ok(ref.path.length > 100);
  for (const seed of seeds.slice(1, 12)) {
    const other = launchPath(seed, level, 900);
    assert.deepEqual(other.path, ref.path, `level ${level}: same shot on ${seed}`);
    assert.equal(other.score, ref.score);
  }
}
{
  const s = core.create("pin8-launch");
  applyCoreInput(core, s, "PLUNGER_HOLD", 1e9);
  for (let i = 0; i < 500; i++) stepCore(core, s, 1e9);
  applyCoreInput(core, s, "PLUNGER_RELEASE", 1e9);
  assert.equal(s.ball.vy, -(R.launchBaseMilli + R.launchStepMilli * R.maxChargeLevel), "holding longer never exceeds max");
  assert.equal(s.ball.vx, 0);
}
// Missions: lanes + targets + drops → MISSION and +10 s, three times at most.
{
  const s = core.create("pin8-mission");
  s.phase = "play";
  const trigger = (st: PinballStateV8, kind: "lanes" | "targets" | "drops") => {
    if (kind === "lanes") { st.lanes = [1, 1, 0]; st.ball = { x: 220000, y: 118000, vx: 0, vy: 0, xr: 0, yr: 0 }; }
    if (kind === "targets") { st.targets = [1, 1, 1, 0]; st.ball = { x: 33000, y: 364000, vx: -200000, vy: 0, xr: 0, yr: 0 }; }
    if (kind === "drops") { st.drops = [1, 1, 0]; st.ball = { x: 238000, y: 395000, vx: 0, vy: -200000, xr: 0, yr: 0 }; }
    const before = st.feed.length;
    for (let i = 0; i < 4 && st.feed.length === before; i++) stepCore(core, st, 1e9);
    for (let i = 0; i < 2; i++) stepCore(core, st, 1e9);
  };
  for (let m = 1; m <= 4; m++) {
    for (const kind of ["lanes", "targets", "drops"] as const) trigger(s, kind);
    assert.equal(s.missions, m, `mission ${m}`);
    assert.equal(s.endTick, R.startTicks + Math.min(m, R.maxExtraTimes) * R.extraTimeTicks);
  }
  assert.ok(s.hurry > 0 || s.feed.some((e) => e.kind === "HURRY"), "drops light the hurry-up");
}
// Hurry-up counts down and is collected by the ramp.
{
  const s = core.create("pin8-hurry");
  s.phase = "play"; s.hurry = R.hurryStart; s.ball = { x: 195000, y: 300000, vx: 0, vy: 0, xr: 0, yr: 0 };
  for (let i = 0; i < 30; i++) stepCore(core, s, 1e9);
  assert.ok(s.hurry < R.hurryStart && s.hurry > R.hurryFloor);
  const value = s.hurry - R.hurryStepPerTick, before = s.score;
  s.phase = "play";
  s.ball = { x: 44000, y: 180000, vx: 0, vy: -300000, xr: 0, yr: 0 };
  stepCore(core, s, 1e9);
  assert.equal(s.hurry, 0);
  assert.equal(s.hurryCollected, 1);
  assert.ok(s.score - before >= value, "ramp collects the hurry-up");
  const t = core.create("pin8-hurry-out");
  t.hurry = R.hurryStart; // ball resting on the spring: nobody collects it
  for (let i = 0; i < 1000 && t.hurry; i++) stepCore(core, t, 1e9);
  assert.equal(t.hurry, 0);
  assert.ok(t.feed.some((e) => e.kind === "HURRYOUT"));
}
// Ball save: a quick drain keeps the multiplier; a late one resets it.
for (const late of [false, true]) {
  const s = core.create("pin8-save");
  applyCoreInput(core, s, "PLUNGER_HOLD", 1e9); stepCore(core, s, 1e9); applyCoreInput(core, s, "PLUNGER_RELEASE", 1e9);
  if (late) for (let i = 0; i < R.ballSaveTicks + 5; i++) s.tick++;
  s.multiplier = 4; s.ball = { x: 195000, y: 600000, vx: 0, vy: 300000, xr: 0, yr: 0 };
  for (let i = 0; i < 60 && s.drains === 0; i++) stepCore(core, s, 1e9);
  assert.equal(s.drains, 1);
  assert.equal(s.multiplier, late ? 1 : 4);
  assert.equal(s.saves, late ? 0 : 1);
}
// Frenzy doubles points in the last 10 s.
{
  const s = core.create("pin8-frenzy");
  assert.equal(pinballFrenzyV8(s), false);
  s.tick = s.endTick - R.frenzyTicks;
  assert.equal(pinballFrenzyV8(s), true);
  const c = copyPinballStateV8(s);
  c.phase = "play"; c.lanes = [1, 1, 0]; c.ball = { x: 220000, y: 118000, vx: 0, vy: 0, xr: 0, yr: 0 };
  const before = c.score;
  stepCore(core, c, 1e9);
  assert.ok(c.score - before >= 2 * (300 + 2000), "double points in the frenzy");
}
// Passages (V8): seamless. The ball never stops or jumps when a passage catches it, rides at a speed that starts at
// its own speed, and leaves continuously from the end of the path along the last segment with a fixed velocity.
for (const [tube, start] of [[0, { x: 44000, y: 180000, vx: 0, vy: -300000 }], [1, { x: 320000, y: 180000, vx: 0, vy: -300000 }], [2, { x: PINBALL_WORMHOLE_V8.x + 6000, y: PINBALL_WORMHOLE_V8.y - 9000, vx: -20000, vy: 60000 }]] as const) {
  const outs: string[] = [], durations = new Set<number>();
  for (const [seed, boost] of [["tube-a", 1], ["tube-b", 1], ["tube-c", 2]] as const) {
    const s = core.create(seed);
    s.phase = "play"; s.ball = { ...start, vx: start.vx * boost, vy: start.vy * boost, xr: 0, yr: 0 };
    let rode = false, ticks = 0, px = s.ball.x, py = s.ball.y, maxJump = 0, minJump = Infinity;
    for (let i = 0; i < 400; i++) {
      stepCore(core, s, 1e9);
      const jump = Math.hypot(s.ball.x - px, s.ball.y - py); px = s.ball.x; py = s.ball.y;
      if (s.tube === tube || rode) maxJump = Math.max(maxJump, jump);
      if (rode) minJump = Math.min(minJump, jump); // from the first ride tick on (the capture tick is plain physics)
      if (s.tube === tube) { rode = true; ticks++; }
      if (rode && s.tube === -1) break;
    }
    assert.ok(rode, `passage ${tube} catches the ball`);
    assert.ok(minJump >= 900, `passage ${tube}: the ball never stops (min ${minJump})`);
    assert.ok(maxJump <= 11500, `passage ${tube}: the ball never jumps (max ${maxJump})`);
    const end = PINBALL_TUBES_V8[tube].path.at(-1)!, exit = PINBALL_TUBE_EXITS_V8[tube];
    const prev = PINBALL_TUBES_V8[tube].path.at(-2)!;
    assert.deepEqual([s.ball.vx, s.ball.vy], [exit.vx, exit.vy], `passage ${tube} exit velocity`);
    const past = Math.hypot(s.ball.x - end.x, s.ball.y - end.y), cross = (end.x - prev.x) * (s.ball.y - end.y) - (end.y - prev.y) * (s.ball.x - end.x);
    assert.ok(past <= 7000 && Math.abs(cross) / Math.hypot(end.x - prev.x, end.y - prev.y) <= 300, `passage ${tube} leaves from the tube end (${past})`);
    assert.ok((end.x - prev.x) * exit.vx + (end.y - prev.y) * exit.vy > 0, "exit follows the tube direction");
    if (boost === 1) outs.push(JSON.stringify(s.ball) + s.score);
    durations.add(ticks);
  }
  assert.equal(outs[0], outs[1], "a passage always does the same thing");
  assert.ok(durations.size >= 1);
  assert.ok(pinballTubeLengthV8(tube) > 100000);
}
// Trapped on a side: wherever it rests or jiggles in the lower corner, after the nudge the ball always follows exactly
// the same path (same release point of that side, same push), on every seed.
const freeze = (s: PinballStateV8, x: number, y: number, jiggle: boolean) => {
  // Hold the ball in place (optionally jiggling inside the stuck box) until the nudge fires.
  const before = s.nudges;
  for (let i = 0; i < R.stuckTicks + 10 && s.nudges === before; i++) {
    const dx = jiggle ? (i % 2 ? 3000 : -3000) : 0;
    s.ball = { x: x + dx, y, vx: 0, vy: 0, xr: 0, yr: 0 };
    stepCore(core, s, 1e9);
  }
  return s.nudges === before + 1;
};
for (const [side, spots] of [[1, [[30000, 470000], [44000, 462000], [60000, 486000], [34000, 330000]]], [-1, [[336000, 470000], [320000, 462000], [300000, 490000], [332000, 340000]]]] as const) {
  const paths = new Set<string>();
  for (const [x, y] of spots) for (const jiggle of [false, true]) for (const seed of ["side-a", "side-b"]) {
    const s = core.create(seed);
    s.phase = "play"; s.tick = 1000;
    assert.ok(freeze(s, x, y, jiggle), `nudged at ${x},${y} jiggle=${jiggle}`);
    assert.equal(Math.sign(s.ball.vx), side, "pushed towards the centre");
    assert.deepEqual([s.ball.vx, s.ball.vy], [side * R.sideNudgeVx, R.sideNudgeVy], "rolled to the flipper of that side");
    const path: number[][] = [[s.ball.x, s.ball.y, s.ball.vx, s.ball.vy]];
    for (let i = 0; i < 240 && s.phase === "play"; i++) { stepCore(core, s, 1e9); path.push([s.ball.x, s.ball.y]); }
    paths.add(JSON.stringify(path));
    const last = path[path.length - 1];
    assert.ok(Math.abs(last[0] - R.sideRelease[side > 0 ? 0 : 1].x) > 20000 || Math.abs(last[1] - R.sideRelease[side > 0 ? 0 : 1].y) > 20000, "the ball leaves the trap");
  }
  assert.equal(paths.size, 1, `side ${side}: the same bounce out every time`);
}
// Rail exits drop the ball clear of the posts: with no flipper input it rolls down to the flippers / drain and is never stuck.
for (const tube of [0, 1]) {
  const s = core.create("rail-exit");
  s.phase = "play"; s.tick = 1000;
  s.ball = tube === 0 ? { x: 44000, y: 180000, vx: 0, vy: -300000, xr: 0, yr: 0 } : { x: 320000, y: 180000, vx: 0, vy: -300000, xr: 0, yr: 0 };
  let rode = false;
  for (let i = 0; i < 400; i++) { stepCore(core, s, 1e9); if (s.tube === tube) rode = true; if (rode && s.tube === -1) break; }
  assert.ok(rode);
  const nudges = s.nudges, drains = s.drains;
  for (let i = 0; i < 900 && s.drains === drains; i++) stepCore(core, s, 1e9);
  assert.equal(s.nudges, nudges, `rail ${tube}: the exit never leaves the ball stuck`);
  assert.equal(s.drains, drains + 1, `rail ${tube}: with no flippers the ball rolls down and drains`);
}
// No self-playing loop: an idle player after one launch scores little over the whole clock.
for (const level of [3, 5, 8]) {
  const run = playPinballV8(seeds[0], "plunge-only", level);
  assert.ok(run.s.nudges <= 4, `plunge-only L${level}: ${run.s.nudges} nudges`);
}
// A ball cradled on a raised flipper is never nudged; a ball stuck elsewhere still gets the fixed push.
{
  const s = core.create("cradle");
  s.phase = "play"; s.tick = 1000; s.leftHeld = true;
  for (let i = 0; i < R.stuckTicks * 2; i++) { s.ball = { x: 150000, y: 540000, vx: 0, vy: 0, xr: 0, yr: 0 }; stepCore(core, s, 1e9); }
  assert.equal(s.nudges, 0, "cradling is the player's choice");
  const t = core.create("mid");
  t.phase = "play"; t.tick = 1000;
  assert.ok(freeze(t, 240000, 360000, false));
  assert.deepEqual([t.ball.vx, t.ball.vy], [-R.nudgeVx, R.nudgeVy], "mid-table: the fixed push");
  assert.ok(Math.abs(t.ball.x - 240000) < 1000 && Math.abs(t.ball.y - 360000) < 1000, "mid-table: pushed from where it is (no jump)");
}
// Bot runs: reproducible, replay-valid, end exactly at the (possibly extended) clock.
let best = 0;
const kinds = new Set<string>();
for (let i = 0; i < 10; i++) {
  const run = playPinballV8(seeds[i], "smart", 4 + (i % 5));
  assert.deepEqual(run.s, playPinballV8(seeds[i], "smart", 4 + (i % 5)).s);
  assert.equal(run.s.failure, "TIME_LIMIT");
  assert.equal(run.s.tick, run.s.endTick);
  assert.ok(run.s.endTick >= R.startTicks && run.s.endTick <= R.maxFinalTick);
  const replay = replayCore(core, run.inputs, run.s.tick, seeds[i], 1e9);
  assert.equal(replay.valid, true, String(replay.error));
  assert.deepEqual(replay.state, run.s);
  best = Math.max(best, run.s.score);
  for (const e of run.s.feed) kinds.add(e.kind);
}
assert.ok(best > 3000, `bot scores (best ${best})`);
const idle = playPinballV8("pin8-idle", "idle");
assert.equal(idle.s.tick, R.startTicks);
assert.equal(idle.s.score, 0);
for (const r of fixture.runs as any[])
  verifyCoreFixture(core, r.seed, r.inputs.map(([tick, action]: (string | number)[], seq: number) => ({ seq, tick: Number(tick), action: String(action) })), r.finalTick, 1e9, {
    score: r.score, status: r.status, failure: r.failure, hash: r.hash,
  });
console.log(`Pinball V8 OK · 100 s clock · side traps always bounce out the same way · seamless passages · deterministic nudge · fixed table · same spring = same shot on every seed · missions/extra time/hurry-up/ball save/frenzy · best ${best}`);
