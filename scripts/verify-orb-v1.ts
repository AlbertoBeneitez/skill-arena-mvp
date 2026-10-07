import assert from "node:assert/strict";
import { generateScenario } from "../lib/server/scenarios";
import {
  ORB_BURST_CORE as core,
  createOrbState,
  forecastOrb,
  orbPaletteSize,
  orbMissLimit,
  orbNeighbors,
  type OrbState,
} from "../lib/verified/orbBurstCore.v1";
import { orbAimAction } from "../lib/verified/orbBurstProtocol.v1";
import {
  applyCoreInput,
  stepCore,
  replayCore,
} from "../lib/verified/coreRuntime.v1";
import { canonicalJson } from "../lib/verified/canonical";
import { sha256 } from "../lib/server/matchIntegrity";
import { sinPhaseMilli } from "../lib/deterministic/integerMath";
import type { ReplayInput } from "../lib/verified/inputValidation";
import { verifyCoreFixture } from "./core-test-utils";
import { bestOrbAim } from "./orb-play-fixture";

function play(seed: string, target = 10000) {
  const state = createOrbState(seed),
    inputs: ReplayInput[] = [];
  function send(action: string) {
    inputs.push({ seq: inputs.length, tick: state.tick, action });
    assert.equal(applyCoreInput(core, state, action, target), true);
  }
  for (let shots = 0; state.status === "running" && shots < 100; shots++) {
    const aim = bestOrbAim(state);
    if (aim !== state.aimIndex) {
      send(orbAimAction(aim));
      stepCore(core, state, target);
    }
    send("SHOOT");
    assert.ok(state.shot, "A valid release launches immediately");
    assert.equal(
      core.canApply(state, "SHOOT"),
      false,
      "No duplicate launch in flight",
    );
    while (state.status === "running" && (state.shot || state.settleRemaining))
      stepCore(core, state, target);
  }
  assert.equal(state.status, "won", seed);
  assert.deepEqual(
    replayCore(core, inputs, state.tick, seed, target).state,
    state,
  );
  return { state, inputs };
}
assert.equal(sinPhaseMilli(0), 0);
assert.equal(sinPhaseMilli(1024), 1000);
assert.equal(sinPhaseMilli(2048), 0);
assert.equal(sinPhaseMilli(3072), -1000);
for (let i = 0; i < 4096; i += 17) {
  assert.equal(sinPhaseMilli(i + 4096), sinPhaseMilli(i));
  assert.equal(sinPhaseMilli(i + 2048), -sinPhaseMilli(i) || 0);
}
const scenario = generateScenario(
  { game_id: "orb-burst", game_version: "1.0.0" },
  7,
);
const before = createOrbState(scenario.seed),
  snapshot = canonicalJson(before);
const preview = forecastOrb(before, 0);
assert.equal(canonicalJson(before), snapshot);
assert.ok(preview.points.length > 10);
assert.equal(preview.state.shot, null, "Shallow wall-bounce shot must settle");
assert.throws(() => forecastOrb(before, -1), /INVALID_AIM/);
assert.equal(orbPaletteSize(0), 3);
assert.equal(orbPaletteSize(10), 5);
assert.equal(orbMissLimit(0), 6);
assert.equal(orbMissLimit(10), 4);
for (let index = 0; index < 16; index++) {
  const seed = generateScenario(
    { game_id: "orb-burst", game_version: "1.0.0" },
    index,
  ).seed;
  const initial = createOrbState(seed),
    aim = bestOrbAim(initial);
  assert.ok(
    forecastOrb(initial, aim).state.score >= 840,
    "First board offers an accessible match",
  );
  const { state } = play(seed, 18000);
  const progression = createOrbState(seed);
  for (
    let n = 0;
    n < 100 && progression.stage === 0 && progression.status === "running";
    n++
  ) {
    const angle = bestOrbAim(progression);
    if (angle !== progression.aimIndex)
      applyCoreInput(core, progression, orbAimAction(angle), 1e9);
    applyCoreInput(core, progression, "SHOOT", 1e9);
    while (
      progression.status === "running" &&
      (progression.shot || progression.settleRemaining)
    )
      stepCore(core, progression, 1e9);
  }
  assert.ok(
    progression.stage >= 1,
    "Play progresses to another board: " + index,
  );
  assert.equal(
    new Set(state.bubbles.map((b) => `${b.row},${b.col}`)).size,
    state.bubbles.length,
  );
}
const golden = play(scenario.seed);
assert.equal(
  scenario.seed,
  "4550a254df1355bb9b6ae76761123eff54f81eddd86122c0c285e705b4b58454",
);
const frozenInputs = [
  ["AIM_003", 0],
  ["SHOOT", 1],
  ["SHOOT", 379],
  ["AIM_002", 784],
  ["SHOOT", 785],
  ["AIM_003", 1220],
  ["SHOOT", 1221],
].map(([action, tick], seq) => ({
  seq,
  action: String(action),
  tick: Number(tick),
}));
assert.deepEqual(golden.inputs, frozenInputs);
verifyCoreFixture(core, scenario.seed, frozenInputs, 1663, 10000, {
  score: 10390,
  status: "won",
  failure: null,
  hash: "sha256:922a8bddbdf82c26baed15c64502677ac63099740473afd2c422934f0661dc5f",
});
// Obtain terminal tick with the same driver rather than supplying inputs past termination.
const loss = createOrbState(scenario.seed);
while (loss.status === "running") stepCore(core, loss, 1e9);
const lossReplay = replayCore(core, [], loss.tick, scenario.seed, 1e9);
assert.equal(lossReplay.valid, true);
assert.equal(lossReplay.failure, "TIME_LIMIT");
const overflow = createOrbState(scenario.seed);
overflow.bubbles = [{ row: 14, col: 4, color: 0 }];
overflow.tick = 120 * 45 - 1;
stepCore(core, overflow, 1e9);
assert.equal(overflow.failure, "BOARD_OVERFLOW");
assert.ok(loss.tick > 120 * 60, "No early idle death");
assert.equal(
  replayCore(
    core,
    [
      { seq: 0, tick: 0, action: "SHOOT" },
      { seq: 1, tick: 1, action: "SHOOT" },
    ],
    2,
    scenario.seed,
    1e9,
  ).error,
  "ACTION_NOT_AVAILABLE",
);
console.log(
  "Orb V1: accessible opening, stage progression, bounce, no double launch, immutable forecast, pressure failure",
);
