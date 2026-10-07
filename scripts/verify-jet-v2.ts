import assert from "node:assert/strict";
import { generateScenario } from "../lib/server/scenarios";
import {
  applyCoreInput,
  stepCore,
  replayCore,
} from "../lib/verified/coreRuntime.v1";
import {
  JET_STREAM_CORE_V2 as core,
  JET_STREAM_V2,
  createJetStreamV2,
} from "../lib/verified/jetStreamCore.v2";
import { JET_STREAM_V1 } from "../lib/verified/jetStreamCore.v1";
import type { ReplayInput } from "../lib/verified/inputValidation";
import { canonicalJson } from "../lib/verified/canonical";
import { verifyCoreFixture } from "./core-test-utils";
function run(seed: string, target = 4000) {
  const state = createJetStreamV2(seed),
    inputs: ReplayInput[] = [];
  while (state.status === "running" && state.tick < 12000) {
    const gate = state.gates.find(
      (g) =>
        g.worldXMilli - state.scrollMilli + JET_STREAM_V1.gateWidth >=
        JET_STREAM_V1.playerX - JET_STREAM_V1.playerRadius,
    )!;
    const desired = gate.centerYMilli;
    if (
      state.yMilli > desired + 28000 &&
      state.vyMilliPerSecond > 0 &&
      core.canApply(state, "FLAP")
    ) {
      inputs.push({ seq: inputs.length, tick: state.tick, action: "FLAP" });
      applyCoreInput(core, state, "FLAP", target);
    }
    if (state.status === "running") stepCore(core, state, target);
  }
  assert.equal(
    state.status,
    "won",
    `${seed} passed=${state.passed} lives=${state.lives} failure=${state.failure}`,
  );
  return { state, inputs };
}
const scenario = generateScenario(
  { game_id: "jet-stream", game_version: "2.0.0" },
  7,
);
assert.equal(
  scenario.seed,
  "7c9104afb9d5b115125ffa4f6bdc14d46251201efe1aad2579b6735c39460976",
);
const goldenInputs = [
  1, 70, 153, 236, 319, 402, 445, 526, 609, 676, 759, 842, 925, 1008, 1091,
  1174, 1257, 1340, 1423, 1506, 1589, 1672, 1756, 1839,
].map((tick, seq) => ({ seq, tick, action: "FLAP" }));
verifyCoreFixture(core, scenario.seed, goldenInputs, 1911, 4000, {
  score: 4211,
  status: "won",
  failure: null,
  hash: "sha256:b5d9e9a91a21d40227955a6563646f12c320f9ec216eb15b0d56b7dcbe1d15c2",
});
for (let index = 0; index < 16; index++) {
  const seed = generateScenario(
    { game_id: "jet-stream", game_version: "2.0.0" },
    index,
  ).seed;
  const { state, inputs } = run(seed);
  assert.deepEqual(
    replayCore(core, inputs, state.tick, seed, 4000).state,
    state,
  );
}
const state = createJetStreamV2(scenario.seed);
assert.ok(new Set(state.gates.map((g) => g.windows[0].gapMilli)).size > 1);
const double = state.gates.find((g) => g.windows.length === 2)!;
assert.ok(double);
for (const w of double.windows) {
  const test = createJetStreamV2(scenario.seed);
  test.scrollMilli = double.worldXMilli - JET_STREAM_V1.playerX;
  test.yMilli = w.centerYMilli;
  stepCore(core, test, 1e9);
  assert.equal(test.lives, JET_STREAM_V2.initialLives);
}
const damaged = createJetStreamV2(scenario.seed),
  gate = damaged.gates[0];
damaged.scrollMilli = gate.worldXMilli - JET_STREAM_V1.playerX;
damaged.yMilli = 60000;
stepCore(core, damaged, 1e9);
assert.equal(damaged.lives, 1);
assert.equal(gate.damaged, true);
for (let n = 0; n < 10; n++) stepCore(core, damaged, 1e9);
assert.equal(damaged.lives, 1);
const pickup = createJetStreamV2(scenario.seed),
  item = pickup.gates.find((g) => g.pickup)!;
pickup.scrollMilli =
  item.worldXMilli + JET_STREAM_V1.gateWidth / 2 - JET_STREAM_V1.playerX;
pickup.yMilli = item.centerYMilli;
pickup.gates
  .filter((g) => g.index < item.index)
  .forEach((g) => {
    g.passed = true;
  });
pickup.passed = item.index;
stepCore(core, pickup, 1e9);
assert.equal(pickup.lives, 3);
assert.equal(pickup.collected, 1);
assert.equal(pickup.score, 100);
for (let n = 0; n < 5; n++) stepCore(core, pickup, 1e9);
assert.equal(pickup.collected, 1);
assert.equal(pickup.score, 100);
const width = canonicalJson(state.gates.map((g) => g.windows));
state.passed = 40;
assert.equal(canonicalJson(state.gates.map((g) => g.windows)), width);
applyCoreInput(core, state, "FLAP", 1e9);
stepCore(core, state, 1e9);
assert.equal(applyCoreInput(core, state, "FLAP", 1e9), false);
const idle = createJetStreamV2(scenario.seed);
while (idle.status === "running") stepCore(core, idle, 1e9);
assert.equal(idle.failure, "OUT_OF_BOUNDS");
assert.equal(idle.lives, 0);
assert.equal(replayCore(core, [], idle.tick, scenario.seed, 1e9).valid, true);
console.log(
  "Jet V2 rules OK · varied widths · dual passages · one-shot life pickups · cooldown · 16 seeded successful replays",
);
