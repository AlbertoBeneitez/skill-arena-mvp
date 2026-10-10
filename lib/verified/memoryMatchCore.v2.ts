/**
 * Original discovery-first public training variant. No whole-board preview.
 * Public seeds still disclose the layout to modified clients; this is not the
 * private command-authority mode and must not be sold as anti-bot protection.
 */
import { seededShuffle } from "../deterministic/seeded";
import type { GameCore } from "./coreRuntime.v1";
import {
  MEMORY_CORE as archivedCore,
  MEMORY_RULES as archivedRules,
  applyMemory,
  canApplyMemory,
  createMemoryState,
  memoryCardMatched,
  stepMemory,
  type MemoryState as ArchivedState,
} from "./memoryMatchCore.v1";
export { memoryCardFaceUp, memoryCardMatched } from "./memoryMatchCore.v1";

export const MEMORY_RULES = {
  ...archivedRules,
  previewTicks: 0,
  durationTicks: 180 * 120,
  maxInputs: 192,
} as const;
export type MemoryState = ArchivedState & { seenMask: number };

export function createMemoryStateV2(seed: string): MemoryState {
  const state = createMemoryState(seed);
  return {
    ...state,
    board: Object.freeze(
      seededShuffle(
        Array.from({ length: MEMORY_RULES.pairs }, (_, symbol) => [
          symbol,
          symbol,
        ]).flat(),
        `${seed}:memory2:discovery-board`,
      ),
    ),
    phase: "choosing",
    previewUntil: 0,
    seenMask: 0,
  };
}

/** Only a previously revealed, still-unmatched partner makes an error avoidable. */
export function memoryHasKnownPartner(
  state: Readonly<MemoryState>,
  first: number,
) {
  return state.board.some(
    (symbol, index) =>
      index !== first &&
      symbol === state.board[first] &&
      (state.seenMask & (1 << index)) !== 0 &&
      !memoryCardMatched(state, index),
  );
}

export function applyMemoryV2(state: MemoryState, action: string) {
  const index = archivedCore.actions.indexOf(action),
    first = state.first;
  const avoidable = first !== null && memoryHasKnownPartner(state, first);
  const before = { lives: state.lives, mistakes: state.mistakes };
  applyMemory(state, action);
  // Discovery costs time, not lives. Preserve the archived mismatch display,
  // cooldown and match/scoring implementation; undo only blind-error penalties.
  if (state.lastEvent === "mismatch" && !avoidable) {
    state.lives = before.lives;
    state.mistakes = before.mistakes;
    state.status = "running";
    state.failure = null;
  }
  state.seenMask |= 1 << index;
}

export const MEMORY_CORE: GameCore<MemoryState> = {
  ...archivedCore,
  gameVersion: "2.0.0",
  maxFinalTick: MEMORY_RULES.durationTicks,
  maxInputs: MEMORY_RULES.maxInputs,
  content: {
    rules: MEMORY_RULES,
    scenario: "memory2-single-discovery-board",
    informationPolicy:
      "no-opening-preview;public-seed-not-anti-automation;private-authority-not-activated",
    penalty:
      "unknown-partner-discovery-costs-time;known-unmatched-partner-errors-use-two-grace-and-eight-lives",
    reach: "unique-matched-pairs;historical-scoring;no-farming",
    input:
      "flip-stable-card-index;one-input-per-tick;repeat-matched-and-mismatch-rejected",
  },
  create: createMemoryStateV2,
  step: stepMemory,
  canApply: canApplyMemory,
  apply: applyMemoryV2,
};
