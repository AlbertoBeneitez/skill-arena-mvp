import assert from "node:assert/strict";
import { generateScenario } from "../lib/server/scenarios";
import { integerSqrt } from "../lib/deterministic/integerMath";
import {
  applyCoreInput,
  stepCore,
  replayCore,
} from "../lib/verified/coreRuntime.v1";
import {
  TOWER_DROP_CORE_V3 as core,
  TOWER_DROP_V3,
  createTowerDropV3,
  naturalPendulumWave,
  forecastTowerLanding,
} from "../lib/verified/towerDropCore.v3";
import type { ReplayInput } from "../lib/verified/inputValidation";
import { canonicalJson } from "../lib/verified/canonical";
import { verifyCoreFixture } from "./core-test-utils";

for (const value of [
  0,
  1,
  2,
  3,
  4,
  15,
  16,
  17,
  155000 ** 2,
  Number.MAX_SAFE_INTEGER,
]) {
  const root = integerSqrt(value);
  assert.ok(BigInt(root) ** BigInt(2) <= BigInt(value));
  assert.ok(BigInt(root + 1) ** BigInt(2) > BigInt(value));
}
assert.throws(() => integerSqrt(-1));
assert.throws(() => integerSqrt(1.5));
assert.equal(naturalPendulumWave(0), 0);
assert.equal(naturalPendulumWave(1024), 1000);
assert.equal(naturalPendulumWave(2048), 0);
assert.equal(naturalPendulumWave(3072), -1000);
assert.ok(
  Math.abs(naturalPendulumWave(7) - naturalPendulumWave(0)) >
    Math.abs(naturalPendulumWave(1024) - naturalPendulumWave(1017)),
);
for (let phase = 0; phase < 4096; phase += 7)
  assert.equal(
    naturalPendulumWave(phase + 2048) + naturalPendulumWave(phase),
    0,
  );
function run(seed: string, target = 4000) {
  const state = createTowerDropV3(seed),
    inputs: ReplayInput[] = [];
  while (state.status === "running" && state.tick < 8000) {
    if (state.phase === "swing") {
      const top = state.blocks.at(-1)!,
        center = top.xMilli + top.wMilli / 2;
      const before = canonicalJson(state),
        forecast = forecastTowerLanding(state);
      assert.equal(canonicalJson(state), before);
      if (
        forecast.stable &&
        Math.abs(forecast.xMilli + state.movingWMilli / 2 - center) < 7000
      ) {
        inputs.push({ seq: inputs.length, tick: state.tick, action: "DROP" });
        applyCoreInput(core, state, "DROP", target);
      }
    }
    if (state.status === "running") stepCore(core, state, target);
  }
  assert.equal(state.status, "won", seed);
  return { state, inputs };
}
const scenario = generateScenario(
  { game_id: "tower-drop", game_version: "3.0.0" },
  7,
);
assert.equal(
  scenario.seed,
  "9cfe3ebfbb7a58e46db026a8cf3840d88b06df9f171ec6f025b124b29f0046bf",
);
const goldenInputs = [96, 437, 778, 1120].map((tick, seq) => ({
  seq,
  tick,
  action: "DROP",
}));
verifyCoreFixture(core, scenario.seed, goldenInputs, 1224, 4000, {
  score: 4192,
  status: "won",
  failure: null,
  hash: "sha256:9187ebd127fb6cb3a025ee728daac07cb22aff63b2dd5480f773f802623969b7",
});
const idle = replayCore(
  core,
  [],
  TOWER_DROP_V3.idleLimitTicks,
  scenario.seed,
  1e9,
);
assert.equal(idle.valid, true);
assert.equal(idle.failure, "TIMEOUT_IDLE");
const bad = createTowerDropV3(scenario.seed);
const badInputs: ReplayInput[] = [];
while (bad.tick < 3000 && bad.status === "running") {
  if (bad.phase === "swing") {
    const forecast = forecastTowerLanding(bad);
    if (bad.height < 2 ? forecast.stable : !forecast.stable) {
      badInputs.push({ seq: badInputs.length, tick: bad.tick, action: "DROP" });
      applyCoreInput(core, bad, "DROP", 1e9);
    }
  }
  if (bad.status === "running") stepCore(core, bad, 1e9);
}
assert.equal(bad.status, "failed");
assert.ok(["CENTER_OF_MASS", "NO_SUPPORT"].includes(bad.failure!));
assert.deepEqual(
  replayCore(core, badInputs, bad.tick, scenario.seed, 1e9).state,
  bad,
);
for (let index = 0; index < 32; index++) {
  const seed = generateScenario(
    { game_id: "tower-drop", game_version: "3.0.0" },
    index,
  ).seed;
  const { state, inputs } = run(seed);
  assert.deepEqual(
    replayCore(core, inputs, state.tick, seed, 4000).state,
    state,
  );
}
const state = createTowerDropV3(scenario.seed);
for (let tick = 0; tick < 1000; tick++) {
  stepCore(core, state, 1e9);
  const x = state.movingXMilli + state.movingWMilli / 2 - 195000,
    y = TOWER_DROP_V3.ropeLengthMilli - state.hookRiseMilli;
  assert.ok(
    Math.abs(Math.sqrt(x * x + y * y) - TOWER_DROP_V3.ropeLengthMilli) < 1.1,
  );
}
const vx = state.movingVXMilliPerSecond,
  vy = state.hookVYMilliPerSecond;
applyCoreInput(core, state, "DROP", 1e9);
assert.equal(state.fallVXMilliPerSecond, vx);
assert.equal(state.fallVYMilliPerSecond, vy);
assert.equal(applyCoreInput(core, state, "DROP", 1e9), false);
assert.notEqual(
  createTowerDropV3("first").swingPhase,
  createTowerDropV3("second").swingPhase,
);
console.log(
  "Tower V3 mechanics OK · integer arc · centre velocity · release momentum · read-only landing forecast · 32 seed replays",
);
