import assert from "node:assert/strict";
import { generateScenario } from "../lib/server/scenarios";
import {
  advanceCoreToTick,
  applyCoreInput,
  replayCore,
  stepCore,
} from "../lib/verified/coreRuntime.v1";
import {
  RIVER_DASH_V1,
  riverLaneRects,
  riverSupported,
} from "../lib/verified/riverDashCore.v1";
import {
  RIVER_DASH_CORE_V3 as core,
  RIVER_DASH_V3,
  type RiverV3State,
} from "../lib/verified/riverDashCore.v3";
import { verifyCoreFixture } from "./core-test-utils";
import {
  cloneRiverV3State,
  planRiverV3Run,
  RIVER_V3_PRACTICE_TARGET as target,
} from "./river-v3-play-fixture";
import type { ReplayInput } from "../lib/verified/inputValidation";

const scenario = (index: number) => generateScenario(
  { game_id: core.gameId, game_version: core.gameVersion }, index,
);
const seed = scenario(7).seed;
assert.equal(seed, "3de0ad1cf1ce6755b4da066e445ddb5b52ef30ad332b11210d4dca4a76eeea79");
assert.equal(core.gameVersion, "3.0.0");
assert.equal(RIVER_DASH_V3.rows, 65);
assert.equal(RIVER_DASH_V3.inputCooldownTicks, 24);

// The opening is forgiving both immediately and after observing the field.
for (let index = 0; index < 128; index++) {
  const initial = core.create(scenario(index).seed);
  assert.equal(initial.row, 64);
  assert.equal(initial.bestRow, 64);
  assert.equal(initial.height, 0);
  assert.equal(initial.lanes.length, 65);
  assert.equal(initial.lanes[0].kind, "safe");
  assert.equal(initial.lanes[64].kind, "safe");
  let consecutive = 0;
  for (const lane of initial.lanes) {
    consecutive = lane.kind === "safe" ? 0 : consecutive + 1;
    assert.ok(consecutive <= 2, "Rest rows must interrupt long hazard chains");
    if (lane.kind === "river") assert.ok(lane.lengthMilli > 2 * RIVER_DASH_V1.radiusMilli);
    if (lane.kind === "road") assert.ok(lane.gapMilli > 2 * RIVER_DASH_V1.radiusMilli + RIVER_DASH_V1.cellMilli);
  }
  for (const delay of [0, 240, 600]) {
    const inputs = Array.from({ length: 8 }, (_, seq) => ({ seq, tick: delay + seq * 60, action: "UP" }));
    const prefix = replayCore(core, inputs, delay + 420, initial.seed, target);
    assert.equal(prefix.error, "CLIENT_ENDED_BEFORE_RESOLUTION", `${index}/${delay}: ${prefix.error}/${prefix.failure}`);
    assert.equal(prefix.state.status, "running");
    assert.equal(prefix.state.row, 56);
    assert.equal(prefix.state.height, 8);
    assert.equal(prefix.score, 850);
    assert.equal(prefix.state.crossings, 0);
    assert.deepEqual(replayCore(core, inputs, delay + 420, initial.seed, target), prefix);
  }
}

// Complete routes keep every row/phase and one input sequence from start to end.
let golden: ReturnType<typeof planRiverV3Run> | undefined;
for (let index = 0; index < 16; index++) {
  const initial = core.create(scenario(index).seed);
  const snapshot = cloneRiverV3State(initial);
  const run = planRiverV3Run(initial);
  assert.deepEqual(initial, snapshot, "QA solver must not mutate its caller's state");
  assert.equal(run.state.row, 0);
  assert.equal(run.state.bestRow, 0);
  assert.equal(run.state.height, 64);
  assert.equal(run.state.crossings, 0);
  assert.equal(run.state.score, 7600);
  assert.equal(run.state.lanes.length, initial.lanes.length);
  assert.ok(run.state.tick < core.maxFinalTick);
  assert.ok(run.inputs.length >= 64 && run.inputs.length <= core.maxInputs);
  const replay = replayCore(core, run.inputs, run.state.tick, initial.seed, target);
  assert.equal(replay.valid, true, `${index}: ${replay.error}`);
  assert.deepEqual(replay.state, run.state);
  assert.deepEqual(replayCore(core, run.inputs, run.state.tick, initial.seed, target), replay);
  if (index === 7) golden = run;
}
assert.ok(golden);
// Freeze the record independently of the route search, as well as its final state.
const goldenLateral: Record<number, string> = {
  8: "RIGHT", 17: "LEFT", 18: "LEFT", 30: "LEFT", 34: "RIGHT",
  38: "RIGHT", 44: "LEFT", 45: "LEFT", 67: "LEFT",
};
const goldenInputs = Array.from({ length: 73 }, (_, seq) => ({
  seq, tick: seq * 24, action: goldenLateral[seq] ?? "UP",
}));
assert.deepEqual(golden.inputs, goldenInputs);
assert.equal(golden.state.tick, 1728);
verifyCoreFixture(core, seed, goldenInputs, 1728, target, {
  score: 7600,
  status: "won",
  failure: null,
  hash: "sha256:d7b2428426924963ac77932da82c142f1759f537a346e7c84c3b18ad3d5b89b5",
});

const safeLane = (state: RiverV3State, row: number) => {
  state.lanes[row] = { ...state.lanes[row], kind: "safe", speedMilli: 0, lengthMilli: 0, gapMilli: 0, phaseMilli: 0, offsetMilli: 0, remainder: 0 };
};
const leftEdge = core.create(seed);
leftEdge.xMilli = RIVER_DASH_V1.radiusMilli;
assert.equal(core.canApply(leftEdge, "LEFT"), false);
assert.equal(core.canApply(leftEdge, "RIGHT"), true);
const rightEdge = core.create(seed);
rightEdge.xMilli = RIVER_DASH_V1.widthMilli - RIVER_DASH_V1.radiusMilli;
assert.equal(core.canApply(rightEdge, "RIGHT"), false);
assert.equal(core.canApply(rightEdge, "LEFT"), true);
assert.equal(replayCore(core, [{ seq: 0, tick: 0, action: "DOWN" }], 0, seed, target).error, "ACTION_NOT_AVAILABLE");
assert.equal(replayCore(core, [{ seq: 0, tick: 0, action: "UP" }, { seq: 1, tick: 1, action: "UP" }], 1, seed, target).error, "ACTION_NOT_AVAILABLE");
assert.equal(replayCore(core, [{ seq: 0, tick: 1, action: "UP" }], 0, seed, target).error, "INPUT_AFTER_FINAL");
assert.equal(replayCore(core, [...goldenInputs, { seq: 73, tick: 1752, action: "DOWN" }], 1752, seed, target).error, "UNCONSUMED_INPUTS");
const farming = core.create(seed);
safeLane(farming, 63);
assert.equal(core.canApply(farming, "DOWN"), false, "Cannot leave the starting edge");
assert.equal(applyCoreInput(core, farming, "UP", target), true);
assert.equal(farming.score, 100);
assert.equal(farming.height, 1);
assert.equal(applyCoreInput(core, farming, "DOWN", target), false, "24-tick cooldown blocks accidental double input");
advanceCoreToTick(core, farming, 24, target);
assert.equal(applyCoreInput(core, farming, "DOWN", target), true);
advanceCoreToTick(core, farming, 48, target);
assert.equal(applyCoreInput(core, farming, "UP", target), true);
assert.equal(farming.score, 100, "Repeated rows cannot farm progress points");
assert.equal(farming.bestRow, 63);
assert.equal(farming.height, 1);
assert.equal(farming.crossings, 0);

function onPlatform(direction: -1 | 1 = 1) {
  const state = core.create(seed);
  const row = state.lanes.findIndex((lane) => lane.kind === "river");
  assert.ok(row > 0);
  state.row = row;
  state.bestRow = row;
  state.height = 64 - row;
  state.xMilli = 180000;
  state.lanes[row] = { ...state.lanes[row], direction, speedMilli: 18000, lengthMilli: 250000, gapMilli: 40000, phaseMilli: 0, offsetMilli: 0, remainder: 0 };
  return state;
}
const relative = onPlatform();
assert.equal(applyCoreInput(core, relative, "LEFT", target), true);
assert.equal(relative.xMilli, 140000, "Input adds no extra platform carry or column snap");
assert.equal(riverSupported(relative), true);
const drifting = onPlatform();
stepCore(core, drifting, target);
assert.equal(drifting.xMilli, 180150, "Carry happens exactly once in a simulation tick");
assert.equal(drifting.status, "running");
for (const direction of [-1, 1] as const) {
  const wrapped = onPlatform(direction);
  const lane = wrapped.lanes[wrapped.row];
  lane.offsetMilli = direction < 0 ? 1 : lane.lengthMilli + lane.gapMilli - 1;
  stepCore(core, wrapped, target);
  assert.equal(wrapped.xMilli, 180000 + 150 * direction, "A wrapped platform phase never teleports its passenger");
  assert.equal(wrapped.status, "running");
}
const leaving = onPlatform();
safeLane(leaving, leaving.row + 1);
leaving.xMilli = 183417;
assert.equal(applyCoreInput(core, leaving, "DOWN", target), true);
assert.equal(leaving.xMilli, 183417, "Vertical input preserves a fractional carried position");
const partial = onPlatform();
partial.xMilli = 5000;
// Keep the player within screen bounds while leaving less than a radius on the platform.
partial.lanes[partial.row].phaseMilli = 20000;
partial.xMilli = 25000;
stepCore(core, partial, target);
assert.equal(partial.failure, "RIVER_GAP");
const swept = onPlatform();
swept.xMilli = RIVER_DASH_V1.radiusMilli;
swept.lanes[swept.row].direction = -1;
stepCore(core, swept, target);
assert.equal(swept.failure, "SWEPT_AWAY");

const fatal = core.create(seed);
fatal.lanes[63] = { ...fatal.lanes[63], kind: "road", speedMilli: 0, lengthMilli: 40000, gapMilli: 260000, phaseMilli: 170000, offsetMilli: 0, remainder: 0 };
assert.ok(riverLaneRects(fatal, 63).some((rect) => rect.xMilli < fatal.xMilli && rect.xMilli + rect.wMilli > fatal.xMilli));
assert.equal(applyCoreInput(core, fatal, "UP", target), true);
assert.equal(fatal.failure, "TRAFFIC_COLLISION");
assert.equal(fatal.score, 0, "An immediately fatal entry cannot claim the next row");
assert.equal(fatal.height, 0);
assert.equal(fatal.bestRow, 64);

// A real generated loss, with no modified state, is replayed from its ordered record.
let generatedLoss: { state: RiverV3State; inputs: ReplayInput[] } | undefined;
for (let index = 0; index < 16 && !generatedLoss; index++) {
  const state = core.create(scenario(index).seed);
  const inputs: ReplayInput[] = [];
  while (state.status === "running" && state.tick < 12000) {
    if (core.canApply(state, "UP")) {
      inputs.push({ seq: inputs.length, tick: state.tick, action: "UP" });
      assert.equal(applyCoreInput(core, state, "UP", target), true);
    }
    if (state.status === "running") advanceCoreToTick(core, state, state.tick + 60, target);
  }
  if (state.status === "failed") generatedLoss = { state, inputs };
}
assert.ok(generatedLoss, "Blind straight-line inputs should encounter a learnable hazard after the opening");
const lossReplay = replayCore(core, generatedLoss.inputs, generatedLoss.state.tick, generatedLoss.state.seed, target);
assert.equal(lossReplay.valid, true, lossReplay.error ?? "Generated defeat must replay");
assert.deepEqual(lossReplay.state, generatedLoss.state);
assert.equal(lossReplay.won, false);
assert.ok(lossReplay.failure);
assert.equal(core.canApply(generatedLoss.state, "UP"), false);
assert.equal(core.canApply(golden.state, "UP"), false);
assert.equal(applyCoreInput(core, golden.state, "DOWN", target), false, "Natural terminal is final");
const restarted = core.create(seed);
assert.equal(restarted.row, 64);
assert.equal(restarted.height, 0);
assert.equal(restarted.score, 0);
assert.equal(restarted.tick, 0);
assert.equal(restarted.status, "running");
assert.deepEqual(restarted, core.create(seed));

const timeout = replayCore(core, [], core.maxFinalTick, seed, target);
assert.equal(timeout.valid, true);
assert.equal(timeout.failure, "TIME_LIMIT");
assert.equal(timeout.height, 0);
assert.equal(timeout.score, 0);
console.log("River V3 OK · 384 forgiving openings · 16 complete continuous replays · no resets/farming · carry/phase/collision/bounds · natural win/loss/restart/time limit");
