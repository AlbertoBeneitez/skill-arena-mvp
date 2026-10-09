/** Test-only: remember the entire legally public preview, then execute that plan. */
import {
  MEMORY_CORE as core,
  MEMORY_RULES,
  memoryCardFaceUp,
} from "../lib/verified/memoryMatchCore.v1";
import { memoryFlipAction } from "../lib/verified/memoryMatchProtocol.v1";
import {
  advanceCoreToTick,
  applyCoreInput,
} from "../lib/verified/coreRuntime.v1";
import type { ReplayInput } from "../lib/verified/inputValidation";

export function rememberMemoryPairs(
  board: readonly number[],
): [number, number][] {
  const bySymbol = new Map<number, number[]>();
  for (let index = 0; index < board.length; index++) {
    const positions = bySymbol.get(board[index]) ?? [];
    positions.push(index);
    bySymbol.set(board[index], positions);
  }
  return [...bySymbol.values()].map((positions) => {
    if (positions.length !== 2) throw new Error("INVALID_MEMORY_PREVIEW");
    return [positions[0], positions[1]];
  });
}

export function playMemoryFixture(
  seed: string,
  options: {
    delayTicks?: number;
    initialMistakes?: number;
    reversePairs?: boolean;
    stopAfterPairs?: number;
    target?: number;
  } = {},
) {
  const state = core.create(seed),
    inputs: ReplayInput[] = [];
  if (!state.board.every((_, index) => memoryCardFaceUp(state, index)))
    throw new Error("PREVIEW_NOT_LEGAL");
  const pairs = rememberMemoryPairs(state.board);
  if (options.reversePairs) pairs.reverse();
  const target = options.target ?? 1e9;
  const delay = Math.max(
    MEMORY_RULES.inputCooldownTicks,
    options.delayTicks ?? 24,
  );
  function wait(tick: number) {
    advanceCoreToTick(core, state, tick, target);
  }
  function flip(index: number) {
    if (state.status !== "running") return;
    const action = memoryFlipAction(index);
    if (!action || !core.canApply(state, action))
      throw new Error("PLAN_ACTION_UNAVAILABLE");
    inputs.push({ seq: inputs.length, tick: state.tick, action });
    if (!applyCoreInput(core, state, action, target))
      throw new Error("PLAN_INPUT_REJECTED");
  }
  wait(MEMORY_RULES.previewTicks);
  for (
    let mistake = 0;
    mistake < (options.initialMistakes ?? 0) && state.status === "running";
    mistake++
  ) {
    flip(pairs[0][0]);
    wait(state.tick + delay);
    flip(pairs[1][0]);
    wait(state.mismatchUntil);
  }
  for (const [first, second] of pairs) {
    if (
      state.status !== "running" ||
      state.matchedPairs >= (options.stopAfterPairs ?? MEMORY_RULES.pairs)
    )
      break;
    wait(state.tick + delay);
    flip(first);
    wait(state.tick + delay);
    flip(second);
  }
  return { state, inputs };
}
