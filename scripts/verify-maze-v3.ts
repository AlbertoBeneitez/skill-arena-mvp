import assert from "node:assert/strict";
import {
  MAZE_CORE_V3 as core,
  MAZE_V3_RULES,
  mazeMovePeriodV3,
} from "../lib/verified/mazeRushCore.v3";
import { MAZE_CORE_V2 } from "../lib/verified/mazeRushCore.v2";
import {
  applyCoreInput,
  replayCore,
  stepCore,
} from "../lib/verified/coreRuntime.v1";
import { generateScenario } from "../lib/server/scenarios";
import type { ReplayInput } from "../lib/verified/inputValidation";
import { chooseMazeActionV2 } from "./maze-v2-play-fixture";
import { verifyCoreFixture } from "./core-test-utils";
// V3 cadence has its own trace; V2 fixture stays immutable.
import fixture from "./fixtures/maze-v3.json" with { type: "json" };

const golden = verifyCoreFixture(
  core,
  fixture.seed,
  fixture.inputs,
  fixture.finalTick,
  1e6,
  {
    score: 8400,
    status: "won",
    failure: null,
    hash: "sha256:4940cd12e3cdddbbe574e8cc38b619baedff6616fa6847345a2ac3b4e54e2aea",
  },
);
assert.equal(golden.height, 70);
const initial = core.create(fixture.seed);
const { height: _reach, ...historicalInitial } = initial;
assert.deepEqual(
  historicalInitial,
  MAZE_CORE_V2.create(fixture.seed),
  "Generation and initial conditions stay identical to V2",
);
assert.equal(mazeMovePeriodV3(initial), MAZE_V3_RULES.initialMoveTicks);
assert.equal(
  mazeMovePeriodV3({ ...initial, collected: initial.board.total }),
  MAZE_V3_RULES.finalMoveTicks,
);
const firstMove = core.create(fixture.seed);
const before = firstMove.nextMoveTick;
while (firstMove.tick < before - 1) stepCore(core, firstMove, 1e6);
stepCore(core, firstMove, 1e6);
assert.equal(
  firstMove.nextMoveTick,
  firstMove.tick + mazeMovePeriodV3(firstMove),
);
assert.ok(firstMove.nextMoveTick > before);

for (const loss of [false, true]) {
  for (let i = 0; i < 4; i++) {
    const seed = generateScenario(
        { game_id: core.gameId, game_version: core.gameVersion },
        i,
      ).seed,
      state = core.create(seed),
      inputs: ReplayInput[] = [];
    let previousReach = 0;
    while (state.status === "running") {
      const action =
        loss && state.collected >= 18 ? "STOP" : chooseMazeActionV2(state);
      if (action && core.canApply(state, action)) {
        inputs.push({ seq: inputs.length, tick: state.tick, action });
        assert.equal(applyCoreInput(core, state, action, 1e6), true);
      }
      stepCore(core, state, 1e6);
      assert.ok(
        state.height >= previousReach,
        "Damage cannot erase reached nodes",
      );
      previousReach = state.height;
    }
    assert.equal(state.status, loss ? "failed" : "won");
    if (loss) {
      assert.equal(state.failure, "PURSUER_COLLISION");
      assert.ok(state.height >= 18 && state.height < state.board.total);
    } else assert.equal(state.height, 70);
    const replay = replayCore(core, inputs, state.tick, seed, 1e6);
    assert.equal(replay.valid, true, replay.error ?? "Invalid replay");
    assert.equal(replay.height, state.height);
    assert.deepEqual(replay.state, state);
    assert.equal(
      core.create(seed).height,
      0,
      "A restart cannot inherit prior reach",
    );
  }
}
console.log(
  "Maze V3: authoritative node reach, versioned 38→30 tick movement and 132→100 tick pursuit, full wins/losses, retained progress, fresh restarts, golden/replay/render/invalid inputs; V2 history unchanged; same generation, contacts, arming and input semantics",
);
