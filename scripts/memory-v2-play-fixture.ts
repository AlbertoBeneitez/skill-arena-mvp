/** Test-only planner learns only faces actually flipped, never the seed/layout. */
import {
  MEMORY_CORE as core,
  memoryCardFaceUp,
  memoryCardMatched,
  type MemoryState,
} from "../lib/verified/memoryMatchCore.v2";
import {
  advanceCoreToTick,
  applyCoreInput,
} from "../lib/verified/coreRuntime.v1";
import type { ReplayInput } from "../lib/verified/inputValidation";

export function playMemoryV2(
  seed: string,
  mode: "win" | "loss" = "win",
  delay = 42,
) {
  const state = core.create(seed),
    inputs: ReplayInput[] = [],
    remembered = new Map<number, number>();
  function observe() {
    for (let index = 0; index < 24; index++)
      if (memoryCardFaceUp(state, index))
        remembered.set(index, state.board[index]);
  }
  function flip(index: number) {
    advanceCoreToTick(
      core,
      state,
      Math.max(state.tick, state.lastInputTick + delay),
      1e9,
    );
    const action = `FLIP_${index}`;
    if (!applyCoreInput(core, state, action, 1e9))
      throw new Error("MEMORY_DISCOVERY_INPUT_UNAVAILABLE");
    inputs.push({ seq: inputs.length, tick: state.tick, action });
    observe();
  }
  function knownPair(): [number, number] | null {
    for (const [a, symbol] of remembered)
      if (!memoryCardMatched(state, a))
        for (const [b, other] of remembered)
          if (a !== b && symbol === other && !memoryCardMatched(state, b))
            return [a, b];
    return null;
  }
  while (state.status === "running") {
    if (state.phase === "mismatch")
      advanceCoreToTick(core, state, state.mismatchUntil, 1e9);
    const known = knownPair();
    if (mode === "loss" && known) {
      const wrong = [...remembered].find(
        ([index, symbol]) =>
          !memoryCardMatched(state, index) &&
          symbol !== remembered.get(known[0]),
      );
      if (wrong) {
        flip(known[0]);
        flip(wrong[0]);
        continue;
      }
    }
    if (mode === "win" && known) {
      flip(known[0]);
      flip(known[1]);
      continue;
    }
    const unseen = Array.from({ length: 24 }, (_, index) => index).filter(
      (index) => !remembered.has(index),
    );
    if (!unseen.length) throw new Error("MEMORY_DISCOVERY_STUCK");
    flip(unseen[0]);
    const partner = [...remembered].find(
      ([index, symbol]) =>
        index !== unseen[0] &&
        symbol === remembered.get(unseen[0]) &&
        !memoryCardMatched(state, index),
    );
    const second = mode === "win" && partner ? partner[0] : unseen[1];
    if (second === undefined)
      throw new Error("MEMORY_DISCOVERY_SECOND_MISSING");
    flip(second);
    if (inputs.length > 160) throw new Error("MEMORY_DISCOVERY_INPUT_BUDGET");
  }
  return { state, inputs, remembered };
}
