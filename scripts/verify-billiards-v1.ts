import assert from "node:assert/strict";
import {
  BILLIARDS_CORE as core,
  BILLIARDS_RULES,
  forecastBilliards,
} from "../lib/verified/billiardsCore.v1";
import { billiardsAimAction } from "../lib/verified/billiardsProtocol.v1";
import {
  applyCoreInput,
  stepCore,
  replayCore,
} from "../lib/verified/coreRuntime.v1";
import { generateScenario } from "../lib/server/scenarios";
import { chooseBilliardsShot } from "./billiards-play-fixture";
import type { ReplayInput } from "../lib/verified/inputValidation";
import fixture from "./fixtures/billiards-v1.json" with { type: "json" };
import { verifyCoreFixture } from "./core-test-utils";
import { canonicalJson } from "../lib/verified/canonical";
const target = 1000000;
function run(seed: string) {
  const state = core.create(seed),
    inputs: ReplayInput[] = [];
  function send(action: string) {
    if (core.canApply(state, action)) {
      inputs.push({ seq: inputs.length, tick: state.tick, action });
      assert.equal(applyCoreInput(core, state, action, target), true);
      stepCore(core, state, target);
    }
  }
  while (state.status === "running" && state.tick < core.maxFinalTick) {
    if (state.phase === "aim") {
      const snapshot = canonicalJson(state),
        shot = chooseBilliardsShot(state);
      assert.equal(canonicalJson(state), snapshot, "forecast is immutable");
      send(billiardsAimAction(shot.aim));
      send(["POWER_LOW", "POWER_MEDIUM", "POWER_HIGH"][shot.power]);
      send("SHOOT");
      assert.equal(core.canApply(state, "SHOOT"), false, "double shot denied");
    } else stepCore(core, state, target);
  }
  assert.equal(
    state.status,
    "won",
    `five mesas: ${seed} stage=${state.stage} shots=${state.totalShots} score=${state.score}`,
  );
  assert.deepEqual(
    replayCore(core, inputs, state.tick, seed, target).state,
    state,
  );
  return { state, inputs };
}
const seed = generateScenario(
  { game_id: "billiards", game_version: "1.0.0" },
  7,
).seed;
for (let i = 0; i < 64; i++) {
  const opening = core.create(
    generateScenario({ game_id: "billiards", game_version: "1.0.0" }, i).seed,
  );
  const next = forecastBilliards(opening).state;
  assert.equal(next.shotPots, 1, "guided first shot is achievable");
  assert.equal(next.scratch, false);
}
const first = run(seed);
assert.equal(seed, fixture.seed);
assert.deepEqual(first.inputs, fixture.inputs);
verifyCoreFixture(
  core,
  fixture.seed,
  fixture.inputs,
  fixture.finalTick,
  target,
  { score: fixture.score, status: "won", failure: null, hash: fixture.hash },
);
for (let i = 0; i < 8; i++)
  run(
    generateScenario({ game_id: "billiards", game_version: "1.0.0" }, i).seed,
  );
const idle = core.create("idle");
for (let i = 0; i < BILLIARDS_RULES.aimIdleTicks; i++)
  stepCore(core, idle, target);
assert.equal(idle.failure, "AIM_TIMEOUT");
const collision = core.create("collision");
collision.balls = [
  { id: 0, x: 195000, y: 350000, vx: 0, vy: -2400, potted: false },
  { id: 1, x: 195000, y: 310000, vx: 0, vy: 0, potted: false },
];
collision.phase = "moving";
collision.shotsLeft = 6;
for (let i = 0; i < 25; i++) core.step(collision);
assert.ok(collision.balls[1].vy < 0);
assert.ok(Math.abs(collision.balls[0].vy) < 100);
const band = core.create("band");
band.balls[0].x = 337000;
band.balls[0].y = 200000;
band.balls[0].vx = 2400;
band.phase = "moving";
core.step(band);
assert.ok(band.balls[0].vx < 0);
const scratch = core.create("scratch");
scratch.score = 1000;
scratch.balls[0].x = 44000;
scratch.balls[0].y = 97000;
scratch.phase = "moving";
scratch.shotsLeft = 6;
core.step(scratch);
assert.equal(scratch.score, 750);
assert.equal(scratch.balls[0].potted, false);
assert.ok(scratch.balls[0].y >= 280000);
assert.equal(core.canApply(core.create("actions"), "AIM_180"), false);
console.log(
  "Billar: five progressive tables, collisions, bands, friction, scratch/respot, immutable forecast, double shot and idle limit passed",
);
