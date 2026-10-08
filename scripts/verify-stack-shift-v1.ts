import assert from "node:assert/strict";
import {
  STACK_SHIFT_CORE as core,
  stackPiece,
  stackCells,
  stackLandingY,
  stackCanPlace,
  stackFallInterval,
} from "../lib/verified/stackShiftCore.v1";
import {
  applyCoreInput,
  stepCore,
  replayCore,
} from "../lib/verified/coreRuntime.v1";
import { chooseStackPlacement } from "./stack-shift-play-fixture";
import { generateScenario } from "../lib/server/scenarios";
import { verifyCoreFixture } from "./core-test-utils";
import type { ReplayInput } from "../lib/verified/inputValidation";
import fixture from "./fixtures/stack-shift-v1.json" with { type: "json" };
verifyCoreFixture(core, fixture.seed, fixture.inputs, fixture.finalTick, 1e6, {
  score: fixture.score,
  status: "won",
  failure: null,
  hash: fixture.hash,
});
const floor = core.create("floor");
assert.equal(stackLandingY(floor), 14);
assert.equal(applyCoreInput(core, floor, "HARD_DROP", 1e6), true);
assert.equal(floor.board[15][3], 4);
assert.equal(floor.board[14][3], 4);
assert.equal(floor.pieces, 1);
assert.equal(
  applyCoreInput(core, floor, "HARD_DROP", 1e6),
  false,
  "double drop blocked during settlement",
);
for (let t = 0; t < 24; t++) stepCore(core, floor, 1e6);
assert.equal(stackLandingY(floor), 12);
applyCoreInput(core, floor, "HARD_DROP", 1e6);
assert.equal(floor.board[13][3], 4);
assert.equal(floor.board[12][3], 4);
assert.equal(floor.board[15][3], 4);
const clear = core.create("clear");
for (const targetX of [0, 2, 4, 6]) {
  while (!clear.pieceActive) stepCore(core, clear, 1e6);
  while (clear.x !== targetX) {
    const a = clear.x > targetX ? "LEFT" : "RIGHT";
    if (core.canApply(clear, a)) applyCoreInput(core, clear, a, 1e6);
    stepCore(core, clear, 1e6);
  }
  while (!core.canApply(clear, "HARD_DROP")) stepCore(core, clear, 1e6);
  applyCoreInput(core, clear, "HARD_DROP", 1e6);
}
assert.equal(clear.lines, 2);
assert.equal(clear.score, 3016);
assert.ok(clear.board.every((row) => row.every((v) => v === 0)));
assert.equal(clear.combo, 1);
const wall = core.create("wall");
wall.pieceKind = 0;
wall.rotation = 1;
wall.x = 7;
assert.equal(applyCoreInput(core, wall, "ROTATE", 1e6), true);
assert.equal(wall.x, 5, "wall kick fits the width");
assert.ok(
  stackCanPlace(
    wall,
    stackCells(wall.pieceKind, wall.rotation),
    wall.x,
    wall.y,
  ),
);
const delay = core.create("delay");
delay.y = 14;
for (let t = 0; t < 35; t++) stepCore(core, delay, 1e6);
assert.equal(delay.pieces, 0);
stepCore(core, delay, 1e6);
assert.equal(delay.pieces, 1, "36 tick natural lock");
assert.ok(stackFallInterval(clear) < stackFallInterval(core.create("start")));
let wins = 0,
  failures = 0;
for (let i = 0; i < 32; i++) {
  const seed = generateScenario(
      { game_id: "stack-shift", game_version: "1.0.0" },
      i,
    ).seed,
    s = core.create(seed),
    inputs: ReplayInput[] = [];
  let plan: ReturnType<typeof chooseStackPlacement> | null = null;
  while (s.status === "running") {
    if (s.pieceActive) {
      plan ??= chooseStackPlacement(s);
      const a =
        s.rotation !== plan.rotation
          ? "ROTATE"
          : s.x !== plan.x
            ? s.x > plan.x
              ? "LEFT"
              : "RIGHT"
            : "HARD_DROP";
      if (core.canApply(s, a)) {
        inputs.push({ seq: inputs.length, tick: s.tick, action: a });
        applyCoreInput(core, s, a, 1e6);
        if (a === "HARD_DROP") plan = null;
      }
    }
    stepCore(core, s, 1e6);
  }
  assert.deepEqual(replayCore(core, inputs, s.tick, seed, 1e6).state, s);
  assert.ok(
    s.board.every(
      (row) => row.length === 8 && row.every((v) => v >= 0 && v <= 6),
    ),
  );
  if (s.status === "won") {
    wins++;
    assert.ok(s.lines >= 18 || s.tick === 21600);
  } else {
    failures++;
    assert.equal(s.failure, "TOP_OUT");
  }
}
assert.ok(wins >= 24);
assert.ok(failures > 0, "loss replay also reconstructed");
for (let i = 0; i < 128; i++) {
  const seed = generateScenario(
      { game_id: "stack-shift", game_version: "1.0.0" },
      i,
    ).seed,
    s = core.create(seed);
  for (let t = 0; t < 360; t++) stepCore(core, s, 1e6);
  assert.equal(s.status, "running");
  assert.equal(s.pieces, 0);
  assert.equal(s.y, 4, "easy first three seconds");
  for (let bag = 0; bag < 6; bag++)
    assert.deepEqual(
      Array.from({ length: 6 }, (_, j) =>
        stackPiece(seed, 4 + bag * 6 + j),
      ).sort(),
      [0, 1, 2, 3, 4, 5],
    );
}
const idle = core.create("idle");
while (idle.status === "running") stepCore(core, idle, 1e6);
assert.equal(idle.failure, "TOP_OUT");
assert.ok(idle.tick > 120 * 30);
assert.equal(replayCore(core, [], idle.tick, "idle", 1e6).valid, true);
console.log(
  `Stack Shift V1: exact floor/support, double-drop protection, wall kicks, two teaching rows, lock delay, 128 safe openings/bags, ${wins} wins/${failures} losses by common replay`,
);
