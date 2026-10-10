import assert from "node:assert/strict";
import {
  SERPENT_CORE_V2 as core,
  serpentStepPeriodV2,
} from "../lib/verified/serpentCore.v2";
import { SERPENT_CORE, SERPENT_V1 } from "../lib/verified/serpentCore.v1";
import {
  replayCore,
  stepCore,
  applyCoreInput,
} from "../lib/verified/coreRuntime.v1";
import { chooseSerpentTurn } from "./serpent-play-fixture";
import { verifyCoreFixture } from "./core-test-utils";
import type { ReplayInput } from "../lib/verified/inputValidation";
import fixture from "./fixtures/serpent-v2.json" with { type: "json" };
verifyCoreFixture(core, fixture.seed, fixture.inputs, fixture.finalTick, 7000, {
  score: 7000,
  status: "won",
  failure: null,
  hash: "sha256:1df254053f0b161dcac23cd7fa8f17ea874995c7d3322600c89ee12a7d697b6d",
});
for (let foods = 0; foods < 100; foods++) {
  assert.ok(serpentStepPeriodV2(foods) >= 10);
  assert.ok(
    serpentStepPeriodV2(foods) >=
      Math.max(
        SERPENT_V1.minimumStepTicks,
        SERPENT_V1.initialStepTicks - Math.floor(foods / 2),
      ),
  );
  if (foods)
    assert.ok(serpentStepPeriodV2(foods) <= serpentStepPeriodV2(foods - 1));
}
for (let n = 0; n < 32; n++) {
  const seed = `serpent-v2-course-${n}`,
    state = core.create(seed),
    old = SERPENT_CORE.create(seed),
    inputs: ReplayInput[] = [];
  assert.deepEqual(state.food, old.food);
  while (state.status === "running") {
    // Drive one grid step at a time and compare the preserved V1 movement kernel.
    const action = chooseSerpentTurn(state);
    if (core.canApply(state, action)) {
      inputs.push({ seq: inputs.length, tick: state.tick, action });
      applyCoreInput(core, state, action, 7000);
      assert.equal(applyCoreInput(SERPENT_CORE, old, action, 7000), true);
    }
    const period = state.stepTicks;
    for (let i = 0; i < period && state.status === "running"; i++)
      stepCore(core, state, 7000);
    const oldPeriod = old.stepTicks;
    for (let i = 0; i < oldPeriod && old.status === "running"; i++)
      stepCore(SERPENT_CORE, old, 7000);
    assert.deepEqual(state.snake, old.snake);
    assert.deepEqual(state.food, old.food);
    assert.equal(state.score, old.score);
    assert.equal(state.wrapCount, old.wrapCount);
  }
  assert.equal(state.status, "won");
  assert.equal(state.height, 7);
  assert.ok(state.tick > old.tick);
  assert.deepEqual(
    replayCore(core, inputs, state.tick, seed, 7000).state,
    state,
  );
}
for (let n = 0; n < 8; n++) {
  const seed = `serpent-v2-loss-${n}`,
    state = core.create(seed),
    inputs: ReplayInput[] = [];
  const clockwise = {
    UP: "RIGHT",
    RIGHT: "DOWN",
    DOWN: "LEFT",
    LEFT: "UP",
  } as const;
  while (state.status === "running") {
    if (state.movementTicks === state.stepTicks - 1) {
      const action =
        state.foods >= 3
          ? clockwise[state.direction]
          : chooseSerpentTurn(state);
      if (core.canApply(state, action)) {
        inputs.push({ seq: inputs.length, tick: state.tick, action });
        applyCoreInput(core, state, action, 7000);
      }
    }
    stepCore(core, state, 7000);
  }
  assert.equal(state.failure, "SELF_COLLISION");
  assert.equal(state.height, state.foods);
  assert.deepEqual(
    replayCore(core, inputs, state.tick, seed, 7000).state,
    state,
  );
}
const queue = core.create(fixture.seed);
assert.equal(applyCoreInput(core, queue, "LEFT", 1e9), false);
assert.equal(applyCoreInput(core, queue, "UP", 1e9), true);
assert.equal(applyCoreInput(core, queue, "DOWN", 1e9), false);
assert.equal(applyCoreInput(core, queue, "LEFT", 1e9), true);
assert.equal(applyCoreInput(core, queue, "UP", 1e9), false);
assert.equal(
  replayCore(core, [], core.maxFinalTick, fixture.seed, 1e9).failure,
  "TIME_LIMIT",
);
console.log(
  "Serpent V2: small 18→10 cadence reduction, 32 full V1 kernel parity courses, 8 self-collision replays, food reach, goldens/render/invalid inputs and queue limits",
);
