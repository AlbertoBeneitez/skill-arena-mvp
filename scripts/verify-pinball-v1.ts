import assert from "node:assert/strict";
import { generateScenario } from "../lib/server/scenarios";
import { applyCoreInput, replayCore, stepCore } from "../lib/verified/coreRuntime.v1";
import { PINBALL_CORE_V1 as core, PINBALL_RULES as R, PINBALL_WALLS, pinballFlipperTip } from "../lib/verified/pinballCore.v1";
import { verifyCoreFixture } from "./core-test-utils";
import { playPinball } from "./pinball-play-fixture";
import fixture from "./fixtures/pinball-v1.json" with { type: "json" };

// The centre is closed: even with both flippers raised the tips overlap more than the ball diameter allows.
for (const angle of [R.flipRest, R.flipUp]) {
  const l = pinballFlipperTip("left", angle), r = pinballFlipperTip("right", angle);
  assert.ok(r.x - l.x < 2 * (R.radiusMilli + R.flipHalfThickMilli) - 2 * R.flipHalfThickMilli, "centre gap smaller than a ball");
}
assert.ok(PINBALL_WALLS.length >= 10);

// Launch conditions depend only on the spring level and are reproducible.
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

// Layout depends on the seed; same seed => same world.
const layouts = new Set<number>();
for (let i = 0; i < 40; i++) {
  const seed = generateScenario({ game_id: core.gameId, game_version: core.gameVersion }, i).seed;
  layouts.add(core.create(seed).layout);
  assert.deepEqual(core.create(seed), core.create(seed));
}
assert.ok(layouts.size >= 3);

// Bot: scores, runs are reproducible, and the centre never swallows the ball.
let balls = 0, centre = 0, best = 0;
for (let i = 0; i < 12; i++) {
  const seed = generateScenario({ game_id: core.gameId, game_version: core.gameVersion }, i).seed;
  const run = playPinball(seed, "smart", 4 + (i % 5));
  const again = playPinball(seed, "smart", 4 + (i % 5));
  assert.deepEqual(run.s, again.s);
  assert.deepEqual(run.inputs, again.inputs);
  const replay = replayCore(core, run.inputs, run.s.tick, seed, 1e9);
  assert.equal(replay.valid, true, String(replay.error));
  assert.deepEqual(replay.state, run.s);
  for (const x of run.drains) { balls++; if (x > 100000 && x < 290000) centre++; }
  best = Math.max(best, run.s.score);
}
assert.ok(best > 3000, `bot scores (best ${best})`);
assert.ok(balls === 0 || centre / balls <= 0.05, `centre drains ${centre}/${balls}`);

// A player who never touches the flippers or the spring finishes by time (no hidden win).
const idle = playPinball("pin-idle", "idle");
assert.ok(idle.s.status === "failed");
assert.ok(["BALLS_LOST", "TIME_LIMIT"].includes(String(idle.s.failure)));

for (const r of fixture.runs as any[])
  verifyCoreFixture(core, r.seed, r.inputs.map(([tick, action]: (string | number)[], seq: number) => ({ seq, tick: Number(tick), action: String(action) })), r.finalTick, 1e9, {
    score: r.score, status: r.status, failure: r.failure, hash: r.hash,
  });
console.log(`Pinball V1 OK · closed centre · spring launch · ${balls} balls, ${centre} through the middle · best ${best}`);
