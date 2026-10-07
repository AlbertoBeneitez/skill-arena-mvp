import assert from "node:assert/strict";
import { generateScenario } from "../lib/server/scenarios";
import {
  applyCoreInput,
  stepCore,
  replayCore,
} from "../lib/verified/coreRuntime.v1";
import {
  RIVER_DASH_CORE as core,
  RIVER_DASH_V1,
  createRiverState,
  riverLaneRects,
} from "../lib/verified/riverDashCore.v1";
import { planRiverCrossing } from "./river-play-fixture";
import { canonicalJson } from "../lib/verified/canonical";
import { verifyCoreFixture } from "./core-test-utils";
const scenario = generateScenario(
  { game_id: "river-dash", game_version: "1.0.0" },
  7,
);
assert.equal(
  scenario.seed,
  "5e649dfb2917be3857d8fbbf93723ebaff0d79d316cb2ace3db12c671ac242dd",
);
const goldenInputs = [
  "UP",
  "LEFT",
  "UP",
  "LEFT",
  "LEFT",
  "UP",
  "UP",
  "UP",
  "RIGHT",
  "RIGHT",
  "UP",
  "UP",
  "UP",
  "UP",
  "UP",
].map((action, seq) => ({ seq, tick: seq * 16, action }));
verifyCoreFixture(core, scenario.seed, goldenInputs, 224, 1400, {
  score: 1400,
  status: "won",
  failure: null,
  hash: "sha256:53753528792e982a64bc4477c907b1ca7d19ede47317c308f38a5ec6a3509513",
});
for (let index = 0; index < 16; index++) {
  const seed = generateScenario(
    { game_id: "river-dash", game_version: "1.0.0" },
    index,
  ).seed;
  const { state, inputs } = planRiverCrossing(createRiverState(seed));
  assert.deepEqual(
    replayCore(core, inputs, state.tick, seed, 1400).state,
    state,
  );
}
const carry = createRiverState(scenario.seed);
carry.row = 4;
const platform = riverLaneRects(carry, 4).find(
  (r) => r.xMilli >= 0 && r.xMilli + r.wMilli < 360000,
)!;
assert.ok(platform);
carry.xMilli = platform.xMilli + platform.wMilli / 2;
const origin = carry.xMilli;
assert.equal(applyCoreInput(core, carry, "LEFT", 1e9), true);
assert.equal(carry.xMilli, origin - 40000, "Input must not add extra carry");
assert.equal(
  applyCoreInput(core, carry, "RIGHT", 1e9),
  false,
  "Input cooldown",
);
const drifting = createRiverState(scenario.seed);
drifting.row = 4;
drifting.xMilli = platform.xMilli + platform.wMilli / 2;
const lane = drifting.lanes[4],
  oldX = drifting.xMilli;
stepCore(core, drifting, 1e9);
assert.equal(
  drifting.xMilli - oldX,
  Math.floor(lane.speedMilli / 120) * lane.direction,
);
assert.equal(drifting.status, "running");
for (const direction of [-1, 1] as const) {
  const wrapped = createRiverState(scenario.seed);
  wrapped.row = 4;
  const l = wrapped.lanes[4];
  l.direction = direction;
  l.offsetMilli = direction < 0 ? 1 : l.lengthMilli + l.gapMilli - 1;
  const p = riverLaneRects(wrapped, 4).find(
    (r) => r.xMilli >= 0 && r.xMilli + r.wMilli < 360000,
  )!;
  wrapped.xMilli = p.xMilli + p.wMilli / 2;
  const previousX = wrapped.xMilli;
  stepCore(core, wrapped, 1e9);
  assert.equal(
    wrapped.xMilli - previousX,
    Math.floor(l.speedMilli / 120) * direction,
    "Phase wrap must not teleport its passenger",
  );
  assert.equal(wrapped.status, "running");
}
const x = drifting.xMilli;
drifting.lastMoveTick = -100;
applyCoreInput(core, drifting, "DOWN", 1e9);
assert.equal(drifting.xMilli, x, "Vertical input preserves current carried x");
assert.equal(drifting.row, 5);
const progression = createRiverState(scenario.seed);
progression.row = 1;
const before = canonicalJson(
  progression.lanes.map((_, row) => riverLaneRects(progression, row)),
);
applyCoreInput(core, progression, "UP", 1e9);
assert.equal(progression.crossings, 1);
assert.equal(progression.score, 1400);
assert.equal(
  canonicalJson(
    progression.lanes.map((_, row) => riverLaneRects(progression, row)),
  ),
  before,
  "Crossing must not teleport traffic",
);
const traffic = createRiverState(scenario.seed);
traffic.row = 9;
const car = riverLaneRects(traffic, 9).find((r) => r.xMilli >= 0)!;
traffic.xMilli = car.xMilli + car.wMilli / 2;
stepCore(core, traffic, 1e9);
assert.equal(traffic.failure, "TRAFFIC_COLLISION");
const partial = createRiverState(scenario.seed);
partial.row = 4;
partial.xMilli = platform.xMilli + 5000;
stepCore(core, partial, 1e9);
assert.equal(
  partial.failure,
  "RIVER_GAP",
  "Partial contact is not full support",
);
const timeout = replayCore(
  core,
  [],
  RIVER_DASH_V1.maxFinalTick,
  scenario.seed,
  1e9,
);
assert.equal(timeout.valid, true);
assert.equal(timeout.failure, "TIME_LIMIT");
console.log(
  "River V1 mechanics OK · tick-only carry · relative moves · full support · phase continuity · 16 seeded crossing replays",
);
