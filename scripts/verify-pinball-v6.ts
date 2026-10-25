import assert from "node:assert/strict";
import { generateScenario } from "../lib/server/scenarios";
import { applyCoreInput, replayCore, stepCore } from "../lib/verified/coreRuntime.v1";
import { PINBALL_CORE_V6 as core, PINBALL_RULES_V6 as R, PINBALL_TUBES_V6, PINBALL_WORMHOLE_V6, copyPinballStateV6, pinballFrenzyV6, pinballTubeLengthV6, type PinballStateV6 } from "../lib/verified/pinballCore.v6";
import { verifyCoreFixture } from "./core-test-utils";
import { playPinballV6 } from "./pinball-v6-play-fixture";
import fixture from "./fixtures/pinball-v6.json" with { type: "json" };

assert.equal(core.maxFinalTick, 120 * 90, "60 s plus up to 30 s of extra time");
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
  const s = core.create("pin6-launch");
  applyCoreInput(core, s, "PLUNGER_HOLD", 1e9);
  for (let i = 0; i < 500; i++) stepCore(core, s, 1e9);
  applyCoreInput(core, s, "PLUNGER_RELEASE", 1e9);
  assert.equal(s.ball.vy, -(R.launchBaseMilli + R.launchStepMilli * R.maxChargeLevel), "holding longer never exceeds max");
  assert.equal(s.ball.vx, 0);
}
// Missions: lanes + targets + drops → MISSION and +10 s, three times at most.
{
  const s = core.create("pin6-mission");
  s.phase = "play";
  const trigger = (st: PinballStateV6, kind: "lanes" | "targets" | "drops") => {
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
  const s = core.create("pin6-hurry");
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
  const t = core.create("pin6-hurry-out");
  t.hurry = R.hurryStart; // ball resting on the spring: nobody collects it
  for (let i = 0; i < 1000 && t.hurry; i++) stepCore(core, t, 1e9);
  assert.equal(t.hurry, 0);
  assert.ok(t.feed.some((e) => e.kind === "HURRYOUT"));
}
// Ball save: a quick drain keeps the multiplier; a late one resets it.
for (const late of [false, true]) {
  const s = core.create("pin6-save");
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
  const s = core.create("pin6-frenzy");
  assert.equal(pinballFrenzyV6(s), false);
  s.tick = s.endTick - R.frenzyTicks;
  assert.equal(pinballFrenzyV6(s), true);
  const c = copyPinballStateV6(s);
  c.phase = "play"; c.lanes = [1, 1, 0]; c.ball = { x: 220000, y: 118000, vx: 0, vy: 0, xr: 0, yr: 0 };
  const before = c.score;
  stepCore(core, c, 1e9);
  assert.ok(c.score - before >= 2 * (300 + 2000), "double points in the frenzy");
}
// Passages: a ramp shot, an orbit shot and the wormhole each ride a fixed path and leave with a fixed velocity.
for (const [tube, start] of [[0, { x: 44000, y: 180000, vx: 0, vy: -300000 }], [1, { x: 320000, y: 180000, vx: 0, vy: -300000 }], [2, { x: PINBALL_WORMHOLE_V6.x, y: PINBALL_WORMHOLE_V6.y - 4000, vx: 0, vy: 30000 }]] as const) {
  const outs: string[] = [];
  for (const seed of ["tube-a", "tube-b"]) {
    const s = core.create(seed);
    s.phase = "play"; s.ball = { ...start, xr: 0, yr: 0 };
    let rode = false;
    for (let i = 0; i < 400; i++) { stepCore(core, s, 1e9); if (s.tube === tube) rode = true; if (rode && s.tube === -1) break; }
    assert.ok(rode, `passage ${tube} catches the ball`);
    const end = PINBALL_TUBES_V6[tube].path.at(-1)!;
    assert.deepEqual([s.ball.x, s.ball.y, s.ball.vx, s.ball.vy], [end.x, end.y, PINBALL_TUBES_V6[tube].exit.vx, PINBALL_TUBES_V6[tube].exit.vy], `passage ${tube} exit`);
    outs.push(JSON.stringify(s.ball) + s.score);
  }
  assert.equal(outs[0], outs[1], "a passage always does the same thing");
  assert.ok(pinballTubeLengthV6(tube) > 100000);
}
// A resting ball is nudged deterministically towards the centre from its side, always with the same push.
for (const [x, sign] of [[60000, 1], [320000, -1]] as const) {
  const pushes = new Set<string>();
  for (const seed of ["nudge-a", "nudge-b", "nudge-c"]) {
    const s = core.create(seed);
    s.phase = "play"; s.ball = { x, y: 500000, vx: 0, vy: 0, xr: 0, yr: 0 };
    s.stuck = R.stuckTicks - 1;
    s.tick = 1000;
    // Freeze it in place for the check: simulate the stuck counter reaching the limit.
    const before = s.nudges;
    for (let i = 0; i < 3 && s.nudges === before; i++) { s.ball.vx = 0; s.ball.vy = 0; s.stuck = R.stuckTicks - 1; stepCore(core, s, 1e9); }
    assert.equal(s.nudges, before + 1);
    assert.equal(Math.sign(s.ball.vx), sign, "pushed towards the centre");
    pushes.add(`${s.ball.vx},${s.ball.vy}`);
  }
  assert.equal(pushes.size, 1, "the same push on every seed");
}
// Bot runs: reproducible, replay-valid, end exactly at the (possibly extended) clock.
let best = 0;
const kinds = new Set<string>();
for (let i = 0; i < 10; i++) {
  const run = playPinballV6(seeds[i], "smart", 4 + (i % 5));
  assert.deepEqual(run.s, playPinballV6(seeds[i], "smart", 4 + (i % 5)).s);
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
const idle = playPinballV6("pin6-idle", "idle");
assert.equal(idle.s.tick, R.startTicks);
assert.equal(idle.s.score, 0);
for (const r of fixture.runs as any[])
  verifyCoreFixture(core, r.seed, r.inputs.map(([tick, action]: (string | number)[], seq: number) => ({ seq, tick: Number(tick), action: String(action) })), r.finalTick, 1e9, {
    score: r.score, status: r.status, failure: r.failure, hash: r.hash,
  });
console.log(`Pinball V6 OK · passages (2 habitrails + wormhole) · deterministic nudge · fixed table · same spring = same shot on every seed · missions/extra time/hurry-up/ball save/frenzy · best ${best}`);
