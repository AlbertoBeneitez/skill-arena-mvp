import assert from "node:assert/strict";
import { generateScenario } from "../lib/server/scenarios";
import { applyCoreInput, replayCore, stepCore } from "../lib/verified/coreRuntime.v1";
import { PINBALL_CORE_V2 as core, PINBALL_RULES_V2 as R, PINBALL_WALLS_V2, pinballFlipperTipV2 } from "../lib/verified/pinballCore.v2";
import { verifyCoreFixture } from "./core-test-utils";
import { playPinballV2 } from "./pinball-v2-play-fixture";
import fixture from "./fixtures/pinball-v2.json" with { type: "json" };

assert.equal(core.maxFinalTick, 120 * 60, "one minute");
for (const angle of [R.flipRest, R.flipUp]) {
  const l = pinballFlipperTipV2("left", angle), r = pinballFlipperTipV2("right", angle);
  assert.ok(r.x - l.x < 2 * R.radiusMilli, "centre gap smaller than a ball");
}
assert.ok(PINBALL_WALLS_V2.length >= 10);

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

// Bot: reproducible, scores, single ball, ends within the minute, no centre drains.
let centre = 0, drains = 0, best = 0;
const seen = new Set<string>();
for (let i = 0; i < 12; i++) {
  const seed = generateScenario({ game_id: core.gameId, game_version: core.gameVersion }, i).seed;
  const run = playPinballV2(seed, "smart", 4 + (i % 5));
  const again = playPinballV2(seed, "smart", 4 + (i % 5));
  assert.deepEqual(run.s, again.s);
  assert.deepEqual(run.inputs, again.inputs);
  assert.ok(run.s.tick <= R.maxFinalTick);
  assert.equal(run.s.status, "failed");
  assert.ok(["BALLS_LOST", "TIME_LIMIT"].includes(String(run.s.failure)));
  const replay = replayCore(core, run.inputs, run.s.tick, seed, 1e9);
  assert.equal(replay.valid, true, String(replay.error));
  assert.deepEqual(replay.state, run.s);
  if (run.s.failure === "BALLS_LOST") { drains++; if (run.s.lastDrainX > 100000 && run.s.lastDrainX < 290000) centre++; }
  best = Math.max(best, run.s.score);
  for (const e of run.s.feed) seen.add(e.kind);
}
assert.ok(best > 3000, `bot scores (best ${best})`);
assert.ok(drains === 0 || centre / drains <= 0.1, `centre drains ${centre}/${drains}`);

// Idle player: the single ball is never launched, the clock still ends the game (no hidden win).
const idle = playPinballV2("pin-idle", "idle");
assert.equal(idle.s.status, "failed");
assert.equal(idle.s.failure, "TIME_LIMIT");
assert.equal(idle.s.tick, R.maxFinalTick);
assert.equal(idle.s.score, 0);

for (const r of fixture.runs as any[])
  verifyCoreFixture(core, r.seed, r.inputs.map(([tick, action]: (string | number)[], seq: number) => ({ seq, tick: Number(tick), action: String(action) })), r.finalTick, 1e9, {
    score: r.score, status: r.status, failure: r.failure, hash: r.hash,
  });
console.log(`Pinball V2 OK · one ball · 60 s · best ${best} · ${drains} drains (${centre} centre) · last events ${[...seen].join(",")}`);
