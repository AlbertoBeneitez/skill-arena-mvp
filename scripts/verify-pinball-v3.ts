import assert from "node:assert/strict";
import { generateScenario } from "../lib/server/scenarios";
import { applyCoreInput, replayCore, stepCore } from "../lib/verified/coreRuntime.v1";
import { PINBALL_CORE_V3 as core, PINBALL_RULES_V3 as R, PINBALL_WALLS_V3, pinballFlipperTipV3 } from "../lib/verified/pinballCore.v3";
import { verifyCoreFixture } from "./core-test-utils";
import { playPinballV3 } from "./pinball-v3-play-fixture";
import fixture from "./fixtures/pinball-v3.json" with { type: "json" };

assert.equal(core.maxFinalTick, 120 * 60, "one minute");
for (const angle of [R.flipRest, R.flipUp]) {
  const l = pinballFlipperTipV3("left", angle), r = pinballFlipperTipV3("right", angle);
  assert.ok(r.x - l.x > 2 * R.radiusMilli + 8000 && r.x - l.x < 60000, "centre gap lets a ball through, but only just");
}
assert.ok(PINBALL_WALLS_V3.length >= 10);

// Launch depends only on the spring level.
const a = core.create("pin-a"), b = core.create("pin-b");
assert.deepEqual(a.ball, b.ball);
for (const level of [0, 4, 8]) {
  const s = core.create("pin-launch");
  assert.equal(applyCoreInput(core, s, "PLUNGER_HOLD", 1e9), true);
  for (let i = 0; i < level * R.chargeStepTicks; i++) stepCore(core, s, 1e9);
  assert.equal(core.canApply(s, "PLUNGER_HOLD"), false);
  assert.equal(applyCoreInput(core, s, "PLUNGER_RELEASE", 1e9), true);
  assert.equal(s.ball.vy, -(R.launchBaseMilli + R.launchStepMilli * level));
  assert.equal(s.ball.vx, 0);
  assert.equal(s.phase, "play");
}
assert.equal(core.canApply(core.create("x"), "FLIP_LEFT_RELEASE"), false);
assert.equal(core.canApply(core.create("x"), "NOPE"), false);

const layouts = new Set<number>(), skills = new Set<number>();
for (let i = 0; i < 40; i++) {
  const seed = generateScenario({ game_id: core.gameId, game_version: core.gameVersion }, i).seed;
  const st = core.create(seed);
  layouts.add(st.layout); skills.add(st.skillLane);
  assert.deepEqual(st, core.create(seed));
}
assert.ok(layouts.size >= 3 && skills.size === 3);

// Bot: reproducible, scores, the clock always ends the game at 60 s, drains only through the centre and re-serve the ball.
let outer = 0, drains = 0, best = 0;
const seen = new Set<string>();
for (let i = 0; i < 12; i++) {
  const seed = generateScenario({ game_id: core.gameId, game_version: core.gameVersion }, i).seed;
  const run = playPinballV3(seed, "smart", 4 + (i % 5));
  const again = playPinballV3(seed, "smart", 4 + (i % 5));
  assert.deepEqual(run.s, again.s);
  assert.deepEqual(run.inputs, again.inputs);
  assert.ok(run.s.tick <= R.maxFinalTick);
  assert.equal(run.s.status, "failed");
  assert.equal(run.s.failure, "TIME_LIMIT");
  assert.equal(run.s.tick, R.maxFinalTick, "never ends early");
  const replay = replayCore(core, run.inputs, run.s.tick, seed, 1e9);
  assert.equal(replay.valid, true, String(replay.error));
  assert.deepEqual(replay.state, run.s);
  if (run.s.drains > 0) { drains += run.s.drains; if (run.s.lastDrainX < 110000 || run.s.lastDrainX > 280000) outer++; }
  best = Math.max(best, run.s.score);
  for (const e of run.s.feed) seen.add(e.kind);
}
assert.ok(best > 3000, `bot scores (best ${best})`);
// A bot that only plunges (never flips) drains through the centre repeatedly and the minute still runs out.
let plungeDrains = 0;
for (let i = 0; i < 6; i++) {
  const seed = generateScenario({ game_id: core.gameId, game_version: core.gameVersion }, i).seed;
  const r = playPinballV3(seed, "plunge-only", 5);
  assert.equal(r.s.failure, "TIME_LIMIT");
  assert.equal(r.s.tick, R.maxFinalTick);
  plungeDrains += r.s.drains;
  if (r.s.drains > 0 && (r.s.lastDrainX < 110000 || r.s.lastDrainX > 280000)) outer++;
  assert.equal(replayCore(core, r.inputs, r.s.tick, seed, 1e9).valid, true);
}
assert.ok(plungeDrains >= 6, `plunge-only drains ${plungeDrains}`);
assert.equal(outer, 0, "no side/outlane drains");

// A drain re-serves the ball, resets the multiplier and combo, and the game goes on.
const d = core.create("pin-drain");
d.phase = "play"; d.multiplier = 4; d.combo = 3; d.ball = { x: 195000, y: 600000, vx: 0, vy: 300000, xr: 0, yr: 0 };
for (let i = 0; i < 60 && d.drains === 0; i++) stepCore(core, d, 1e9);
assert.equal(d.drains, 1);
assert.equal(d.status, "running");
assert.equal(d.phase, "waiting");
assert.equal(d.multiplier, 1);
assert.equal(d.combo, 0);
for (let i = 0; i < R.waitTicks + 2; i++) stepCore(core, d, 1e9);
assert.equal(d.phase, "lane");

// Idle player: the single ball is never launched, the clock still ends the game (no hidden win).
const idle = playPinballV3("pin-idle", "idle");
assert.equal(idle.s.status, "failed");
assert.equal(idle.s.failure, "TIME_LIMIT");
assert.equal(idle.s.tick, R.maxFinalTick);
assert.equal(idle.s.score, 0);

for (const r of fixture.runs as any[])
  verifyCoreFixture(core, r.seed, r.inputs.map(([tick, action]: (string | number)[], seq: number) => ({ seq, tick: Number(tick), action: String(action) })), r.finalTick, 1e9, {
    score: r.score, status: r.status, failure: r.failure, hash: r.hash,
  });
console.log(`Pinball V3 OK · one ball · 60 s · best ${best} · ${drains} centre drains · last events ${[...seen].join(",")}`);
