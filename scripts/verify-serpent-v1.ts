import assert from "node:assert/strict";
import { generateScenario } from "../lib/server/scenarios";
import {
  applyCoreInput,
  stepCore,
  replayCore,
} from "../lib/verified/coreRuntime.v1";
import {
  SERPENT_CORE as core,
  SERPENT_V1,
  createSerpentState,
  serpentNextPoint,
  type SerpentDirection,
} from "../lib/verified/serpentCore.v1";
import type { ReplayInput } from "../lib/verified/inputValidation";
import { chooseSerpentTurn } from "./serpent-play-fixture";
import { verifyCoreFixture } from "./core-test-utils";
function run(seed: string) {
  const state = createSerpentState(seed),
    inputs: ReplayInput[] = [];
  while (state.status === "running" && state.tick < 10000) {
    if (state.movementTicks === state.stepTicks - 1) {
      const action = chooseSerpentTurn(state);
      if (action !== state.direction) {
        inputs.push({ seq: inputs.length, tick: state.tick, action });
        assert.equal(applyCoreInput(core, state, action, 7000), true);
      }
    }
    if (state.status === "running") stepCore(core, state, 7000);
  }
  assert.equal(state.status, "won", seed);
  return { state, inputs };
}
const scenario = generateScenario(
  { game_id: "grid-serpent", game_version: "1.0.0" },
  7,
);
assert.equal(
  scenario.seed,
  "d514b4c2e2b55c3dec520a55fa1869db88e589ac611810958954069f89d8e5cc",
);
const goldenInputs = [
  ["DOWN", 16],
  ["RIGHT", 237],
  ["UP", 356],
  ["RIGHT", 492],
  ["UP", 508],
  ["LEFT", 588],
  ["UP", 652],
  ["LEFT", 748],
  ["UP", 875],
  ["RIGHT", 905],
  ["DOWN", 995],
  ["LEFT", 1055],
  ["UP", 1114],
  ["LEFT", 1268],
].map(([action, tick], seq) => ({
  seq,
  tick: Number(tick),
  action: String(action),
}));
verifyCoreFixture(core, scenario.seed, goldenInputs, 1367, 7000, {
  score: 7000,
  status: "won",
  failure: null,
  hash: "sha256:969ce262f680510c5b89966e2b02d6ea9271502f2469e45d8d623f632240a441",
});
for (let index = 0; index < 32; index++) {
  const seed = generateScenario(
    { game_id: "grid-serpent", game_version: "1.0.0" },
    index,
  ).seed;
  const { state, inputs } = run(seed);
  assert.deepEqual(
    replayCore(core, inputs, state.tick, seed, 7000).state,
    state,
  );
  assert.equal(state.snake.length, 10);
  assert.ok(
    !state.snake.some((p) => p.x === state.food?.x && p.y === state.food?.y),
  );
}
const cases: {
  direction: SerpentDirection;
  from: { x: number; y: number };
  to: { x: number; y: number };
}[] = [
  { direction: "RIGHT", from: { x: 17, y: 15 }, to: { x: 0, y: 15 } },
  { direction: "LEFT", from: { x: 0, y: 15 }, to: { x: 17, y: 15 } },
  { direction: "UP", from: { x: 9, y: 0 }, to: { x: 9, y: 27 } },
  { direction: "DOWN", from: { x: 9, y: 27 }, to: { x: 9, y: 0 } },
];
for (const c of cases) {
  assert.deepEqual(serpentNextPoint(c.from, c.direction), c.to);
  const state = createSerpentState(scenario.seed);
  state.snake[0] = c.from;
  state.direction = c.direction;
  state.food = { x: 12, y: 12 };
  for (let n = 0; n < 17; n++) stepCore(core, state, 1e9);
  assert.deepEqual(state.snake[0], c.to);
  assert.equal(state.wrapCount, 1);
  assert.equal(state.status, "running");
}
const tail = createSerpentState(scenario.seed);
tail.snake = [
  { x: 1, y: 1 },
  { x: 1, y: 2 },
  { x: 0, y: 2 },
  { x: 0, y: 1 },
];
tail.direction = "UP";
tail.queue = ["LEFT"];
tail.food = { x: 12, y: 12 };
for (let n = 0; n < 17; n++) stepCore(core, tail, 1e9);
assert.equal(tail.status, "running");
assert.deepEqual(tail.snake[0], { x: 0, y: 1 });
const collision = createSerpentState(scenario.seed);
collision.snake = [
  { x: 1, y: 1 },
  { x: 1, y: 2 },
  { x: 0, y: 2 },
  { x: 0, y: 1 },
];
collision.direction = "RIGHT";
collision.queue = ["DOWN"];
collision.food = { x: 12, y: 12 };
for (let n = 0; n < 17; n++) stepCore(core, collision, 1e9);
assert.equal(collision.failure, "SELF_COLLISION");
const queue = createSerpentState(scenario.seed);
assert.equal(applyCoreInput(core, queue, "LEFT", 1e9), false);
assert.equal(applyCoreInput(core, queue, "UP", 1e9), true);
assert.equal(applyCoreInput(core, queue, "DOWN", 1e9), false);
assert.equal(applyCoreInput(core, queue, "LEFT", 1e9), true);
assert.equal(applyCoreInput(core, queue, "DOWN", 1e9), false);
assert.equal(
  replayCore(
    core,
    [
      { seq: 0, tick: 0, action: "UP" },
      { seq: 1, tick: 1, action: "DOWN" },
    ],
    17,
    scenario.seed,
    1e9,
  ).error,
  "ACTION_NOT_AVAILABLE",
);
const timeout = replayCore(
  core,
  [],
  SERPENT_V1.maxFinalTick,
  scenario.seed,
  1e9,
);
assert.equal(timeout.valid, true);
assert.equal(timeout.failure, "TIME_LIMIT");
console.log(
  "Serpent V1 rules OK · 32 seeded replays · four portals · food outside body · vacating tail · self collision · turn queue",
);
