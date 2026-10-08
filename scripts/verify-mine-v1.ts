import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import {
  MINE_GRID_CORE as core,
  generateMineBoard,
  isMineBoardSolvable,
  mineNeighbors,
  projectMineState,
} from "../lib/verified/mineGridCore.v1";
import { mineAction } from "../lib/verified/mineGridProtocol.v1";
import { generateScenario } from "../lib/server/scenarios";
import {
  replayCore,
  applyCoreInput,
  stepCore,
} from "../lib/verified/coreRuntime.v1";
import { nextMineAction } from "./mine-play-fixture";
import type { ReplayInput } from "../lib/verified/inputValidation";
import { canonicalJson } from "../lib/verified/canonical";
import { sha256 } from "../lib/server/matchIntegrity";
import { verifyCoreFixture } from "./core-test-utils";
function play(seed: string) {
  const state = core.create(seed),
    inputs: ReplayInput[] = [];
  while (state.status === "running" && inputs.length < 1000) {
    const action = nextMineAction(state);
    inputs.push({ seq: inputs.length, tick: state.tick, action });
    assert.equal(applyCoreInput(core, state, action, 1e9), true);
    if (state.status === "running") stepCore(core, state, 1e9);
  }
  assert.equal(state.status, "won");
  assert.equal(state.stage, 4);
  assert.deepEqual(
    replayCore(core, inputs, state.tick, seed, 1e9).state,
    state,
  );
  return { state, inputs };
}
for (let index = 0; index < 64; index++) {
  const seed = generateScenario(
    { game_id: "mine-grid", game_version: "1.0.0" },
    index,
  ).seed;
  for (let stage = 0; stage < 5; stage++) {
    const board = generateMineBoard(seed, stage);
    assert.equal(board.values.filter((v) => v === -1).length, board.mines);
    assert.equal(board.values[board.startIndex], 0);
    assert.ok(
      mineNeighbors(board.startIndex, board.cols, board.rows).every(
        (i) => board.values[i] >= 0,
      ),
    );
    assert.equal(isMineBoardSolvable(board), true);
    assert.deepEqual(generateMineBoard(seed, stage), board);
  }
  play(seed);
}
const seed = generateScenario(
    { game_id: "mine-grid", game_version: "1.0.0" },
    7,
  ).seed,
  golden = play(seed);
const frozen = JSON.parse(
  readFileSync("scripts/fixtures/mine-v1.json", "utf8"),
);
assert.equal(seed, frozen.seed);
assert.deepEqual(golden.inputs, frozen.inputs);
verifyCoreFixture(core, seed, frozen.inputs, frozen.tick, 1e9, {
  score: frozen.score,
  status: "won",
  failure: null,
  hash: frozen.hash,
});

const state = core.create(seed),
  publicView = projectMineState(state);
assert.ok(publicView.cells.every((v) => v === null));
assert.equal(JSON.stringify(publicView).includes(seed), false);
assert.equal("values" in publicView, false);
assert.equal(applyCoreInput(core, state, mineAction("OPEN", 0), 1e9), false);
assert.equal(applyCoreInput(core, state, mineAction("FLAG", 0), 1e9), false);
assert.equal(
  applyCoreInput(core, state, mineAction("OPEN", state.board.startIndex), 1e9),
  true,
);
const hidden = state.revealed.findIndex((v) => !v),
  score = state.score;
assert.equal(
  applyCoreInput(core, state, mineAction("FLAG", hidden), 1e9),
  true,
);
assert.equal(state.score, score);
assert.equal(
  applyCoreInput(core, state, mineAction("OPEN", hidden), 1e9),
  false,
);
assert.equal(
  applyCoreInput(core, state, mineAction("FLAG", hidden), 1e9),
  true,
);
for (const index of state.board.values
  .map((v, i) => (v === -1 ? i : -1))
  .filter((i) => i >= 0)
  .slice(0, 2)) {
  assert.equal(
    applyCoreInput(core, state, mineAction("OPEN", index), 1e9),
    true,
  );
}
assert.equal(state.failure, "MINES");
assert.equal(state.lives, 0);
console.log(
  "Mine V1: 320 solvable boards, 64 full five-level wins, hidden projection, safe opening, flags cannot inflate score, mine penalties",
);

const limited = core.create(seed);
applyCoreInput(
  core,
  limited,
  mineAction("OPEN", limited.board.startIndex),
  1e9,
);
const toggle = limited.revealed.findIndex((v) => !v);
for (let i = 1; i < 999; i++) {
  stepCore(core, limited, 1e9);
  assert.equal(
    applyCoreInput(core, limited, mineAction("FLAG", toggle), 1e9),
    true,
  );
}
assert.equal(limited.failure, "COMMAND_LIMIT");
