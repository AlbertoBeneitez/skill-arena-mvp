import assert from "node:assert/strict";
import {
  ROULETTE_CORE_V4 as core,
  ROULETTE_RULES_V4,
} from "../lib/verified/galacticRouletteCore.v4";
import { rouletteTossAction } from "../lib/verified/galacticRouletteProtocol.v2";
import {
  applyCoreInput,
  replayCore,
  stepCore,
} from "../lib/verified/coreRuntime.v1";
import type { ReplayInput } from "../lib/verified/inputValidation";

for (let index = 0; index < 32; index++) {
  const state = core.create(`roulette4-bounce-${index}`),
    action = rouletteTossAction((index * 7) % 32, 8 + (index % 8));
  assert.ok(applyCoreInput(core, state, "RELEASE_X_20", 1e9));
  assert.ok(applyCoreInput(core, state, "RELEASE_Y_20", 1e9));
  assert.ok(applyCoreInput(core, state, action, 1e9));
  const start = state.tick;
  let surfaceBounces = 0;
  while (state.status === "running" && state.landingTick !== -1) {
    const incomingVz = state.ballVz;
    stepCore(core, state, 1e9);
    if (incomingVz < 0 && state.ballVz > 0) surfaceBounces++;
  }
  assert.ok(state.tick - start >= ROULETTE_RULES_V4.minimumFlightTicks);
  assert.ok(state.tick - start <= ROULETTE_RULES_V4.maximumFlightTicks);
  assert.ok(
    state.rimRebounds >= ROULETTE_RULES_V4.minimumRimRebounds,
    `insufficient outer-rim rebounds for trial ${index}`,
  );
  assert.ok(surfaceBounces >= 5, `insufficient surface bounces for trial ${index}`);
  assert.ok(
    [state.ballX, state.ballY, state.ballZ, state.balanceMinor].every(
      Number.isSafeInteger,
    ),
  );
}

const seed = "roulette4-replay",
  state = core.create(seed),
  inputs: ReplayInput[] = [];
inputs.push({ seq: 0, tick: 0, action: "BET_NUMBER_17" });
assert.ok(applyCoreInput(core, state, inputs[0].action, 1e9));
stepCore(core, state, 1e9);
inputs.push({ seq: 1, tick: state.tick, action: rouletteTossAction(20, 12) });
assert.ok(applyCoreInput(core, state, inputs[1].action, 1e9));
while (state.status === "running") stepCore(core, state, 1e9);
const replay = replayCore(core, inputs, state.tick, seed, 1e9);
assert.equal(replay.valid, true);
assert.deepEqual(replay.state, state);
console.log(
  "Roulette V4 repeated outer-rim rebounds, longer natural settlement and deterministic replay OK",
);
