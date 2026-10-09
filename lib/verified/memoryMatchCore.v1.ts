/**
 * Original single-board memory run. The ENTIRE board is legal public information
 * during the initial preview. Public seeds/replay do not prevent automation or
 * a client retaining that map; this is not a hidden-information authority.
 */
import { seededShuffle } from "../deterministic/seeded";
import type { CoreState, GameCore } from "./coreRuntime.v1";
import { MEMORY_ACTIONS } from "./memoryMatchProtocol.v1";

export const MEMORY_RULES = {
  columns: 6,
  rows: 4,
  pairs: 12,
  previewTicks: 8 * 120,
  initialLives: 8,
  graceMistakes: 2,
  inputCooldownTicks: 6,
  initialMismatchTicks: 120,
  finalMismatchTicks: 54,
  durationTicks: 120 * 120,
  scorePerPair: 1000,
  learningPairs: [
    [0, 1],
    [6, 7],
  ],
} as const;

export type MemoryState = CoreState & {
  seed: string;
  board: readonly number[];
  phase: "preview" | "choosing" | "mismatch";
  previewUntil: number;
  mismatchUntil: number;
  first: number | null;
  second: number | null;
  matchedMask: number;
  matchedPairs: number;
  height: number;
  lives: number;
  mistakes: number;
  lastInputTick: number;
  lastEvent: "flip" | "match" | "mismatch" | null;
  lastEventTick: number;
  lastMatch: readonly [number, number] | null;
};

/** One immutable arrangement: two adjacent learning pairs, then varied pairs. */
export function buildMemoryBoard(seed: string): readonly number[] {
  const symbols = seededShuffle(
    Array.from({ length: MEMORY_RULES.pairs }, (_, index) => index),
    `${seed}:memory1:symbols`,
  );
  const remainder = seededShuffle(
    symbols
      .slice(MEMORY_RULES.learningPairs.length)
      .flatMap((symbol) => [symbol, symbol]),
    `${seed}:memory1:board`,
  );
  const board = new Array<number>(MEMORY_ACTIONS.length);
  for (let pair = 0; pair < MEMORY_RULES.learningPairs.length; pair++) {
    for (const index of MEMORY_RULES.learningPairs[pair])
      board[index] = symbols[pair];
  }
  let next = 0;
  for (let index = 0; index < board.length; index++) {
    if (board[index] === undefined) board[index] = remainder[next++];
  }
  return Object.freeze(board);
}

export function createMemoryState(seed: string): MemoryState {
  return {
    tick: 0,
    status: "running",
    failure: null,
    score: 0,
    seed,
    board: buildMemoryBoard(seed),
    phase: "preview",
    previewUntil: MEMORY_RULES.previewTicks,
    mismatchUntil: -1,
    first: null,
    second: null,
    matchedMask: 0,
    matchedPairs: 0,
    height: 0,
    lives: MEMORY_RULES.initialLives,
    mistakes: 0,
    lastInputTick: -MEMORY_RULES.inputCooldownTicks,
    lastEvent: null,
    lastEventTick: -1,
    lastMatch: null,
  };
}

export function memoryCardMatched(
  state: Pick<MemoryState, "matchedMask">,
  index: number,
) {
  return (
    Number.isInteger(index) &&
    index >= 0 &&
    index < MEMORY_ACTIONS.length &&
    (state.matchedMask & (1 << index)) !== 0
  );
}

/** Legal visible face; no unrevealed future cards exist in this public variant. */
export function memoryCardFaceUp(
  state: Pick<MemoryState, "phase" | "matchedMask" | "first" | "second">,
  index: number,
) {
  return (
    Number.isInteger(index) &&
    index >= 0 &&
    index < MEMORY_ACTIONS.length &&
    (state.phase === "preview" ||
      memoryCardMatched(state, index) ||
      state.first === index ||
      state.second === index)
  );
}

export function memoryMismatchTicks(state: Pick<MemoryState, "matchedPairs">) {
  // After eleven pairs the only two remaining cards necessarily match.
  const lastAmbiguousPair = MEMORY_RULES.pairs - 2;
  const progress = Math.min(lastAmbiguousPair, Math.max(0, state.matchedPairs));
  return (
    MEMORY_RULES.initialMismatchTicks -
    Math.floor(
      ((MEMORY_RULES.initialMismatchTicks - MEMORY_RULES.finalMismatchTicks) *
        progress) /
        lastAmbiguousPair,
    )
  );
}

export function canApplyMemory(state: MemoryState, action: string) {
  if (
    state.status !== "running" ||
    state.phase !== "choosing" ||
    state.tick - state.lastInputTick < MEMORY_RULES.inputCooldownTicks
  )
    return false;
  const index = MEMORY_ACTIONS.findIndex((allowed) => allowed === action);
  return (
    index >= 0 && state.first !== index && !memoryCardMatched(state, index)
  );
}

export function applyMemory(state: MemoryState, action: string) {
  const index = MEMORY_ACTIONS.findIndex((allowed) => allowed === action);
  state.lastInputTick = state.tick;
  state.lastEventTick = state.tick;
  if (state.first === null) {
    state.first = index;
    state.lastEvent = "flip";
    return;
  }
  const first = state.first;
  if (state.board[first] === state.board[index]) {
    state.matchedMask |= (1 << first) | (1 << index);
    state.matchedPairs++;
    state.height = state.matchedPairs;
    state.score = state.height * MEMORY_RULES.scorePerPair;
    state.lastMatch = [first, index];
    state.first = null;
    state.second = null;
    state.lastEvent = "match";
    if (state.matchedPairs === MEMORY_RULES.pairs) {
      state.status = "won";
      state.failure = null;
    }
    return;
  }
  state.second = index;
  state.phase = "mismatch";
  state.mismatchUntil = state.tick + memoryMismatchTicks(state);
  state.mistakes++;
  state.lastEvent = "mismatch";
  if (state.mistakes > MEMORY_RULES.graceMistakes) {
    state.lives--;
    if (state.lives === 0) {
      state.status = "failed";
      state.failure = "MEMORY_MISMATCH";
    }
  }
}

export function stepMemory(state: MemoryState) {
  state.tick++;
  if (state.phase === "preview" && state.tick >= state.previewUntil) {
    state.phase = "choosing";
  } else if (state.phase === "mismatch" && state.tick >= state.mismatchUntil) {
    state.first = null;
    state.second = null;
    state.phase = "choosing";
    state.mismatchUntil = -1;
  }
}

export const MEMORY_CORE: GameCore<MemoryState> = {
  gameId: "memory-match",
  gameVersion: "1.0.0",
  width: 390,
  height: 620,
  tickRate: 120,
  maxFinalTick: MEMORY_RULES.durationTicks,
  maxInputs: 96,
  inputVersion: 1,
  actions: MEMORY_ACTIONS,
  content: {
    rules: MEMORY_RULES,
    scenario: "memory1-single-public-preview-board",
    informationPolicy:
      "entire-board-legally-visible-from-tick-zero;public-replay-is-not-anti-automation",
    reach:
      "matched-pairs;monotonic;not-derived-from-error-count-or-client-score",
    input:
      "flip-stable-card-index;one-input-per-tick;invalid-repeat-matched-preview-and-mismatch-rejected",
  },
  create: createMemoryState,
  step: stepMemory,
  canApply: canApplyMemory,
  apply: applyMemory,
};
