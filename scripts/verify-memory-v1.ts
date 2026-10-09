import assert from "node:assert/strict";
import {
  MEMORY_CORE as core,
  MEMORY_RULES,
  buildMemoryBoard,
  memoryCardFaceUp,
  memoryCardMatched,
  memoryMismatchTicks,
} from "../lib/verified/memoryMatchCore.v1";
import {
  MEMORY_ACTIONS,
  memoryFlipAction,
} from "../lib/verified/memoryMatchProtocol.v1";
import {
  advanceCoreToTick,
  applyCoreInput,
  replayCore,
  stepCore,
} from "../lib/verified/coreRuntime.v1";
import { generateScenario } from "../lib/server/scenarios";
import { canonicalJson } from "../lib/verified/canonical";
import { sha256 } from "../lib/server/matchIntegrity";
import { playMemoryFixture } from "./memory-play-fixture";
import { verifyCoreFixture } from "./core-test-utils";
import fixture from "./fixtures/memory-v1.json" with { type: "json" };

const target = 1e9;
const first = playMemoryFixture(fixture.seed, {
  delayTicks: 42,
  initialMistakes: 3,
  reversePairs: true,
});
assert.deepEqual(first.inputs, fixture.inputs);
assert.equal(first.state.tick, fixture.finalTick);
assert.equal(first.state.height, fixture.height);
assert.equal(first.state.lives, fixture.lives);
assert.equal(first.state.mistakes, fixture.mistakes);
verifyCoreFixture(
  core,
  fixture.seed,
  fixture.inputs,
  fixture.finalTick,
  target,
  {
    score: fixture.score,
    status: "won",
    failure: null,
    hash: fixture.hash,
  },
);

const fingerprints = new Set<string>();
for (let index = 0; index < 1000; index++) {
  const seed = generateScenario(
    { game_id: "memory-match", game_version: "1.0.0" },
    index,
  ).seed;
  const state = core.create(seed),
    originalBoard = state.board;
  assert.deepEqual(core.create(seed), state, `seed ${index} reproducible`);
  assert.equal(state.board.length, 24);
  for (let symbol = 0; symbol < 12; symbol++)
    assert.equal(
      state.board.filter((card) => card === symbol).length,
      2,
      `symbol ${symbol} occurs exactly twice`,
    );
  assert.equal(state.board[0], state.board[1]);
  assert.equal(state.board[6], state.board[7]);
  assert.notEqual(
    state.board[0],
    state.board[6],
    "two different adjacent learning pairs",
  );
  assert.ok(
    state.board.every((_, card) => memoryCardFaceUp(state, card)),
    "entire map legally public from tick zero",
  );
  advanceCoreToTick(core, state, 959, target);
  assert.equal(state.phase, "preview");
  assert.equal(core.canApply(state, "FLIP_0"), false);
  stepCore(core, state, target);
  assert.equal(state.phase, "choosing");
  assert.ok(
    state.board.every((_, card) => !memoryCardFaceUp(state, card)),
    "unmatched preview faces all close together",
  );
  assert.strictEqual(
    state.board,
    originalBoard,
    "one stable arrangement per run",
  );
  fingerprints.add(state.board.join(","));
  if (index < 32) {
    for (const delay of [24, 126]) {
      const played = playMemoryFixture(seed, {
        delayTicks: delay,
        initialMistakes: index % 5,
        reversePairs: index % 2 === 1,
      });
      assert.equal(played.state.status, "won", `full run ${index}/${delay}`);
      assert.equal(played.state.height, 12);
      assert.equal(played.state.score, 12000);
      assert.equal(played.state.lives, 8 - Math.max(0, (index % 5) - 2));
      assert.equal(played.state.matchedMask, (1 << 24) - 1);
      assert.ok(
        played.state.board.every((_, card) =>
          memoryCardMatched(played.state, card),
        ),
      );
      assert.deepEqual(
        replayCore(core, played.inputs, played.state.tick, seed, target).state,
        played.state,
      );
    }
  }
}
assert.equal(
  fingerprints.size,
  1000,
  "1000 distinct arrangements, excluding seed/ID metadata",
);

assert.equal(memoryFlipAction(0), "FLIP_0");
assert.equal(memoryFlipAction(23), "FLIP_23");
for (const invalid of [-1, 24, 1.5, Number.NaN, Number.POSITIVE_INFINITY])
  assert.equal(memoryFlipAction(invalid), null);
assert.equal(new Set(MEMORY_ACTIONS).size, 24);
assert.equal(memoryCardMatched({ matchedMask: (1 << 24) - 1 }, -1), false);
assert.equal(memoryCardMatched({ matchedMask: (1 << 24) - 1 }, 24), false);

const input = core.create("input-boundaries"),
  original = [...input.board];
advanceCoreToTick(core, input, 960, target);
assert.equal(applyCoreInput(core, input, "FLIP_0", target), true);
assert.equal(input.first, 0);
assert.equal(memoryCardFaceUp(input, 0), true);
assert.equal(memoryCardFaceUp(input, 1), false);
assert.equal(
  applyCoreInput(core, input, "FLIP_1", target),
  false,
  "different card blocked during cooldown",
);
advanceCoreToTick(core, input, 966, target);
assert.equal(
  applyCoreInput(core, input, "FLIP_0", target),
  false,
  "same open card cannot count twice",
);
assert.equal(applyCoreInput(core, input, "FLIP_1", target), true);
assert.equal(input.height, 1);
assert.equal(input.score, 1000);
assert.equal(input.first, null);
assert.equal(memoryCardFaceUp(input, 0), true);
assert.equal(memoryCardFaceUp(input, 1), true);
advanceCoreToTick(core, input, 972, target);
assert.equal(
  applyCoreInput(core, input, "FLIP_0", target),
  false,
  "matched card cannot farm score",
);
assert.equal(applyCoreInput(core, input, "FLIP_1", target), false);
assert.equal(input.height, 1);
assert.equal(input.score, 1000);
assert.deepEqual(input.board, original, "matching never rebuilds the board");

const mistake = core.create("mistake-boundaries"),
  mistakeBoard = mistake.board;
advanceCoreToTick(core, mistake, 960, target);
for (let count = 1; count <= 10; count++) {
  assert.equal(applyCoreInput(core, mistake, "FLIP_0", target), true);
  advanceCoreToTick(core, mistake, mistake.tick + 6, target);
  assert.equal(applyCoreInput(core, mistake, "FLIP_6", target), true);
  assert.equal(mistake.mistakes, count);
  assert.equal(
    mistake.lives,
    8 - Math.max(0, count - 2),
    "two mistakes are protected, later mistakes cost one shield",
  );
  assert.equal(mistake.phase, "mismatch");
  assert.equal(mistake.height, 0);
  assert.equal(mistake.score, 0);
  assert.equal(memoryCardFaceUp(mistake, 0), true);
  assert.equal(memoryCardFaceUp(mistake, 6), true);
  assert.equal(
    core.canApply(mistake, "FLIP_2"),
    false,
    "cannot spam more flips during reveal",
  );
  assert.strictEqual(
    mistake.board,
    mistakeBoard,
    "damage keeps the board intact",
  );
  if (count === 10) break;
  const deadline = mistake.mismatchUntil;
  advanceCoreToTick(core, mistake, deadline - 1, target);
  assert.equal(mistake.phase, "mismatch");
  assert.equal(memoryCardFaceUp(mistake, 0), true);
  stepCore(core, mistake, target);
  assert.equal(mistake.phase, "choosing");
  assert.equal(mistake.first, null);
  assert.equal(mistake.second, null);
  assert.equal(memoryCardFaceUp(mistake, 0), false);
  assert.equal(memoryCardFaceUp(mistake, 6), false);
}
assert.equal(mistake.status, "failed");
assert.equal(mistake.failure, "MEMORY_MISMATCH");
assert.equal(core.canApply(mistake, "FLIP_2"), false);
const lethal = playMemoryFixture("lethal-replay", {
  initialMistakes: 10,
  delayTicks: 24,
});
const lossReplay = replayCore(
  core,
  lethal.inputs,
  lethal.state.tick,
  "lethal-replay",
  target,
);
assert.equal(lossReplay.valid, true, lossReplay.error ?? "Invalid loss replay");
assert.deepEqual(lossReplay.state, lethal.state);
assert.equal(lossReplay.failure, "MEMORY_MISMATCH");
assert.equal(lossReplay.won, false);
assert.equal(lethal.inputs.length, 20);
assert.equal(
  sha256(canonicalJson(lossReplay.state)),
  sha256(canonicalJson(lethal.state)),
);

assert.equal(memoryMismatchTicks({ matchedPairs: 0 }), 120);
assert.equal(memoryMismatchTicks({ matchedPairs: 10 }), 54);
assert.equal(memoryMismatchTicks({ matchedPairs: 11 }), 54);
for (let pairs = 1; pairs <= 10; pairs++) {
  assert.ok(
    memoryMismatchTicks({ matchedPairs: pairs }) <
      memoryMismatchTicks({ matchedPairs: pairs - 1 }),
  );
}
const remainingRun = playMemoryFixture("final-pair-pressure", {
  stopAfterPairs: 10,
});
const remaining = remainingRun.state;
const remainingInputs = [...remainingRun.inputs];
// Four unmatched cards are the last point where a mistaken pair remains possible.
const available = remaining.board
  .map((_, card) => card)
  .filter((card) => !memoryCardMatched(remaining, card));
assert.equal(remaining.height, 10);
assert.equal(available.length, 4);
const firstAvailable = available[0];
const different = available.find(
  (card) => remaining.board[card] !== remaining.board[firstAvailable],
)!;
function remainingFlip(card: number) {
  const action = `FLIP_${card}`;
  assert.equal(core.canApply(remaining, action), true);
  remainingInputs.push({
    seq: remainingInputs.length,
    tick: remaining.tick,
    action,
  });
  assert.equal(applyCoreInput(core, remaining, action, target), true);
}
advanceCoreToTick(core, remaining, remaining.tick + 6, target);
remainingFlip(firstAvailable);
advanceCoreToTick(core, remaining, remaining.tick + 6, target);
remainingFlip(different);
assert.equal(remaining.mismatchUntil, remaining.tick + 54);
advanceCoreToTick(core, remaining, remaining.mismatchUntil - 1, target);
assert.equal(remaining.phase, "mismatch");
stepCore(core, remaining, target);
assert.equal(remaining.phase, "choosing");
for (let count = 2; count <= 10; count++) {
  advanceCoreToTick(core, remaining, remaining.tick + 6, target);
  remainingFlip(firstAvailable);
  advanceCoreToTick(core, remaining, remaining.tick + 6, target);
  remainingFlip(different);
  assert.equal(remaining.height, 10, "late damage preserves earned reach");
  assert.equal(remaining.score, 10000);
  if (remaining.status === "running")
    advanceCoreToTick(core, remaining, remaining.mismatchUntil, target);
}
assert.equal(remaining.status, "failed");
assert.equal(remaining.failure, "MEMORY_MISMATCH");
assert.equal(remaining.height, 10);
assert.equal(remaining.lives, 0);
assert.deepEqual(
  replayCore(
    core,
    remainingInputs,
    remaining.tick,
    "final-pair-pressure",
    target,
  ).state,
  remaining,
);

const idle = core.create("idle-timeout");
advanceCoreToTick(core, idle, core.maxFinalTick - 1, target);
assert.equal(idle.status, "running");
stepCore(core, idle, target);
assert.equal(idle.status, "failed");
assert.equal(idle.failure, "TIME_LIMIT");
assert.equal(idle.tick, 14400);
assert.equal(idle.lives, 8);
assert.equal(
  replayCore(core, [], idle.tick, "idle-timeout", target).valid,
  true,
);
const idleSnapshot = structuredClone(idle);
stepCore(core, idle, target);
assert.deepEqual(
  idle,
  idleSnapshot,
  "terminal cannot advance or submit another outcome",
);

for (const inputs of [
  [{ seq: 0, tick: 959, action: "FLIP_0" }],
  [
    { seq: 0, tick: 960, action: "FLIP_0" },
    { seq: 1, tick: 961, action: "FLIP_1" },
  ],
  [
    { seq: 0, tick: 960, action: "FLIP_0" },
    { seq: 1, tick: 966, action: "FLIP_0" },
  ],
  [
    { seq: 0, tick: 960, action: "FLIP_0" },
    { seq: 1, tick: 966, action: "FLIP_1" },
    { seq: 2, tick: 972, action: "FLIP_0" },
  ],
  [
    { seq: 0, tick: 960, action: "FLIP_0" },
    { seq: 1, tick: 966, action: "FLIP_6" },
    { seq: 2, tick: 972, action: "FLIP_2" },
  ],
])
  assert.equal(
    replayCore(core, inputs, 972, "invalid-semantics", target).error,
    "ACTION_NOT_AVAILABLE",
  );
for (const action of [
  "FLIP_24",
  "FLIP_-1",
  "FLIP_00",
  "FLIP_1.5",
  "FLIP_1_MORE",
])
  assert.equal(
    replayCore(core, [{ seq: 0, tick: 960, action }], 960, "protocol", target)
      .error,
    "INVALID_INPUT",
  );
const prefix = replayCore(
  core,
  [{ seq: 0, tick: 960, action: "FLIP_0" }],
  970,
  "unfinished-prefix",
  target,
);
assert.equal(prefix.error, "CLIENT_ENDED_BEFORE_RESOLUTION");
assert.equal(prefix.state.tick, 970);
assert.equal(prefix.state.first, 0);
assert.equal(prefix.state.height, 0);

const early = playMemoryFixture("signed-target", { target: 500 });
assert.equal(
  early.state.status,
  "won",
  "preserve shared signed-target resolution",
);
assert.equal(early.state.height, 1);
assert.equal(early.state.score, 1000);
assert.equal(
  replayCore(core, early.inputs, early.state.tick, "signed-target", 500).valid,
  true,
);
assert.deepEqual(buildMemoryBoard("preview"), buildMemoryBoard("preview"));

console.log(
  "Memoria: 1000 distinct public-preview boards, 64 complete runs with delay/error variations, two protected mistakes, exact preview/reveal/cooldown, immutable map, monotonic reach, terminal/timeout/prefix, invalid semantics and common replay/render golden",
);
