import assert from "node:assert/strict";
import {
  MEMORY_CORE as core,
  MEMORY_RULES,
  memoryCardFaceUp,
  memoryCardMatched,
  memoryHasKnownPartner,
} from "../lib/verified/memoryMatchCore.v2";
import { MEMORY_CORE as archived } from "../lib/verified/memoryMatchCore.v1";
import {
  advanceCoreToTick,
  applyCoreInput,
  replayCore,
} from "../lib/verified/coreRuntime.v1";
import { generateScenario } from "../lib/server/scenarios";
import { playMemoryV2 } from "./memory-v2-play-fixture";
import { verifyCoreFixture } from "./core-test-utils";
import fixture from "./fixtures/memory-v2.json" with { type: "json" };

for (const golden of fixture.runs) {
  const played = playMemoryV2(fixture.seed, golden.mode as "win" | "loss");
  assert.deepEqual(played.inputs, golden.inputs);
  for (const field of ["height", "lives", "mistakes", "tick"] as const)
    assert.equal(
      played.state[field],
      field === "tick" ? golden.finalTick : golden[field],
    );
  verifyCoreFixture(
    core,
    fixture.seed,
    golden.inputs,
    golden.finalTick,
    1e9,
    golden as typeof golden & { status: "won" | "failed" },
  );
}
const boards = new Set<string>();
let wins = 0;
for (let scenario = 0; scenario < 1000; scenario++) {
  const seed = generateScenario(
    { game_id: core.gameId, game_version: core.gameVersion },
    scenario,
  ).seed;
  const state = core.create(seed);
  assert.deepEqual(state, core.create(seed));
  assert.equal(state.phase, "choosing");
  assert.equal(state.previewUntil, 0);
  assert.equal(state.seenMask, 0);
  assert.ok(
    state.board.every((_, index) => !memoryCardFaceUp(state, index)),
    "nothing to photograph at opening",
  );
  assert.ok(Object.isFrozen(state.board));
  for (let symbol = 0; symbol < 12; symbol++)
    assert.equal(state.board.filter((s) => s === symbol).length, 2);
  boards.add(state.board.join(","));
  if (scenario < 64)
    for (const delay of [42, 126]) {
      const played = playMemoryV2(seed, "win", delay);
      assert.equal(played.state.status, "won");
      assert.equal(played.state.height, 12);
      assert.equal(
        played.state.lives,
        8,
        "perfect memory never loses lives due to blind discovery",
      );
      assert.equal(played.state.mistakes, 0);
      assert.ok(played.inputs.length <= 48);
      assert.deepEqual(
        replayCore(core, played.inputs, played.state.tick, seed, 1e9).state,
        played.state,
      );
      wins++;
    }
}
assert.equal(boards.size, 1000);

const state = core.create("memory-discovery-edge"),
  board = state.board;
function flip(index: number) {
  advanceCoreToTick(
    core,
    state,
    Math.max(state.tick, state.lastInputTick + 6),
    1e9,
  );
  assert.equal(applyCoreInput(core, state, `FLIP_${index}`, 1e9), true);
}
const first = 0,
  partner = board.findIndex((s, i) => i !== first && s === board[first]);
const wrong = board.findIndex((s) => s !== board[first]);
flip(first);
assert.equal(memoryHasKnownPartner(state, first), false);
assert.equal(
  state.board.filter((_, i) => memoryCardFaceUp(state, i)).length,
  1,
);
flip(wrong);
assert.equal(state.mistakes, 0);
assert.equal(state.lives, 8);
assert.equal(
  state.board.filter((_, i) => memoryCardFaceUp(state, i)).length,
  2,
);
assert.equal(
  core.canApply(state, `FLIP_${partner}`),
  false,
  "mismatch cannot reveal a third card",
);
advanceCoreToTick(core, state, state.mismatchUntil, 1e9);
assert.ok(board.every((_, i) => !memoryCardFaceUp(state, i)));
// The new first face reveals an already seen partner: wrong second is avoidable.
flip(partner);
assert.equal(memoryHasKnownPartner(state, partner), true);
flip(wrong);
assert.equal(state.mistakes, 1);
assert.equal(state.lives, 8);
advanceCoreToTick(core, state, state.mismatchUntil, 1e9);
flip(first);
assert.equal(core.canApply(state, `FLIP_${first}`), false);
flip(partner);
assert.equal(state.height, 1);
assert.equal(state.score, 1000);
assert.equal(core.canApply(state, `FLIP_${first}`), false);
assert.equal(memoryCardMatched(state, partner), true);
assert.strictEqual(state.board, board, "one immutable setup, never re-dealt");

// Blind exploration with one life must not inherit the archived failed terminal.
state.lives = 1;
state.mistakes = 9;
const unseen = board
  .map((_, i) => i)
  .filter((i) => (state.seenMask & (1 << i)) === 0);
const a = unseen.find((i) => !memoryHasKnownPartner(state, i))!;
const b = unseen.find((i) => i !== a && board[i] !== board[a])!;
assert.ok(Number.isInteger(a) && Number.isInteger(b));
flip(a);
flip(b);
assert.equal(state.status, "running");
assert.equal(state.failure, null);
assert.equal(state.mistakes, 9);
assert.equal(state.lives, 1);

const timeout = core.create("memory-v2-real-timeout");
advanceCoreToTick(core, timeout, core.maxFinalTick, 1e9);
assert.equal(timeout.failure, "TIME_LIMIT");
assert.equal(timeout.tick, 21600);
assert.ok(timeout.board.every((_, index) => !memoryCardFaceUp(timeout, index)));
assert.equal(core.maxInputs, 192);
assert.equal(MEMORY_RULES.previewTicks, 0);
assert.ok(
  archived
    .create("archive")
    .board.every((_, i) => memoryCardFaceUp(archived.create("archive"), i)),
  "historical preview remains legal",
);
console.log(
  `Memory V2: ${boards.size} distinct boards, ${wins} discovery-only full wins, no opening faces, fair known-error penalties, no farming/third-card/timeout regressions`,
);
