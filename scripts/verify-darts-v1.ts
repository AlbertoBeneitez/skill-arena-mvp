import assert from "node:assert/strict";
import {
  DARTS_CORE as core,
  DARTS_RULES,
  dartsDrift,
  dartsValue,
} from "../lib/verified/dartsCore.v1";
import { dartsAimAction } from "../lib/verified/dartsProtocol.v1";
import {
  applyCoreInput,
  stepCore,
  replayCore,
} from "../lib/verified/coreRuntime.v1";
import { generateScenario } from "../lib/server/scenarios";
import type { ReplayInput } from "../lib/verified/inputValidation";
import fixture from "./fixtures/darts-v1.json" with { type: "json" };
import { verifyCoreFixture } from "./core-test-utils";
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
  while (state.status === "running") {
    if (state.phase === "aim") {
      for (let i = 0; i < 30 + state.throwIndex * 5; i++)
        stepCore(core, state, target);
      const t = state.target,
        drift = dartsDrift(state, state.tick + 3),
        x = Math.max(0, Math.min(60, Math.round((t.x - drift.x) / 5000) + 30)),
        y = Math.max(0, Math.min(60, Math.round((t.y - drift.y) / 5000) + 30));
      send(dartsAimAction("X", x));
      send(dartsAimAction("Y", y));
      send("THROW");
      assert.equal(core.canApply(state, "THROW"), false);
    } else stepCore(core, state, target);
  }
  assert.equal(state.status, "won");
  assert.equal(state.impacts.length, 15);
  assert.ok(state.impacts.filter((p) => p.goal).length >= 13);
  assert.deepEqual(
    replayCore(core, inputs, state.tick, seed, target).state,
    state,
  );
  return { state, inputs };
}
const seed = generateScenario(
    { game_id: "darts", game_version: "1.0.0" },
    7,
  ).seed,
  first = run(seed);
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
for (let i = 0; i < 64; i++)
  run(generateScenario({ game_id: "darts", game_version: "1.0.0" }, i).seed);
assert.equal(dartsValue(0, 0).points, 50);
assert.equal(dartsValue(18000, 0).points, 25);
assert.equal(dartsValue(0, -110000).points, 20);
assert.equal(dartsValue(0, -134000).points, 40);
assert.equal(dartsValue(0, -83000).points, 60);
assert.equal(dartsValue(110000, 0).points, 6);
assert.equal(dartsValue(0, 110000).points, 3);
assert.equal(dartsValue(-110000, 0).points, 11);
assert.equal(dartsValue(141000, 0).points, 0);
const idle = core.create("timeout");
while (idle.status === "running") stepCore(core, idle, target);
assert.equal(idle.status, "failed");
assert.equal(idle.failure, "LOW_SCORE");
assert.equal(idle.score, 0);
assert.equal(idle.impacts.length, 15);
assert.ok(idle.impacts.every((p) => p.timeout));
assert.equal(replayCore(core, [], idle.tick, "timeout", target).valid, true);
const state = core.create("invalid");
assert.equal(core.canApply(state, "AIM_X_61"), false);
assert.equal(core.canApply(state, "AIM_Y_-1"), false);
assert.equal(core.canApply(state, "AIM_X_30"), false);
console.log(
  "Darts: 64 full progressive sequences, sector/double/triple/bull scoring, deterministic landing, timeout without early death, no double throw, common replay",
);
