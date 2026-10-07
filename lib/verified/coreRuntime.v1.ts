/** Shared deterministic driver for new core versions. Keep this revision frozen. */
import type { GameId } from "../games";
import { validateInputSequence, type ReplayInput } from "./inputValidation";

export const CORE_RUNTIME_V1 = Object.freeze({
  engineVersion: "skill-core-3",
  inputClock: "SIMULATION_TICKS",
  scoringAuthority: "SERVER_REPLAY_ONLY",
  endCondition: "FAILURE_TARGET_OR_TIME_LIMIT",
  resolutionPriority: "CORE_TERMINAL_THEN_TARGET_THEN_TIME_LIMIT",
  oneInputPerTick: true,
});

export type CoreState = {
  tick: number;
  status: "running" | "failed" | "won";
  score: number;
  failure: string | null;
  height?: number;
  lives?: number;
};

/** React, timers, viewport dimensions and wall clocks are forbidden here. */
export interface GameCore<S extends CoreState> {
  gameId: GameId;
  gameVersion: string;
  width: number;
  height: number;
  tickRate: number;
  maxFinalTick: number;
  maxInputs: number;
  inputVersion: number;
  actions: readonly string[];
  content: unknown;
  create(seed: string): S;
  step(state: S): void; // Exactly one simulation tick.
  canApply(state: S, action: string): boolean;
  apply(state: S, action: string): void;
}

function resolve<S extends CoreState>(core: GameCore<S>, state: S, targetScore: number) {
  if (state.status !== "running") return;
  if (state.score >= targetScore) {
    state.status = "won";
    state.failure = null;
  } else if (state.tick >= core.maxFinalTick) {
    state.status = "failed";
    state.failure = "TIME_LIMIT";
  }
}

export function applyCoreInput<S extends CoreState>(core: GameCore<S>, state: S, action: string, targetScore: number) {
  if (state.status !== "running" || !core.actions.includes(action) || !core.canApply(state, action)) return false;
  core.apply(state, action);
  resolve(core, state, targetScore);
  return true;
}

export function stepCore<S extends CoreState>(core: GameCore<S>, state: S, targetScore: number) {
  if (state.status !== "running") return;
  const previous = state.tick;
  core.step(state);
  if (state.tick !== previous + 1) throw new Error("CORE_TICK_CONTRACT_VIOLATION");
  resolve(core, state, targetScore);
}

/** Catch up without discarding late frames or changing authoritative time. */
export function advanceCoreToTick<S extends CoreState>(core: GameCore<S>, state: S, targetTick: number, targetScore: number, beforeStep?: () => void) {
  const bounded = Math.min(core.maxFinalTick, Math.max(state.tick, Math.floor(targetTick)));
  while (state.status === "running" && state.tick < bounded) {
    beforeStep?.();
    if (state.status !== "running") break;
    stepCore(core, state, targetScore);
  }
}

export function replayCore<S extends CoreState>(core: GameCore<S>, inputs: ReplayInput[], finalTick: number, seed: string, targetScore = Number.MAX_SAFE_INTEGER) {
  const state = core.create(seed);
  let error: string | null = validateInputSequence(inputs, finalTick, {
    version: core.inputVersion, allowedActions: core.actions,
    maxInputs: core.maxInputs, maxFinalTick: core.maxFinalTick,
  });
  let index = 0;
  if (!error) {
    while (state.status === "running") {
      if (index < inputs.length && inputs[index].tick === state.tick) {
        if (!applyCoreInput(core, state, inputs[index].action, targetScore)) {
          error = "ACTION_NOT_AVAILABLE";
          break;
        }
        index += 1;
      }
      if (state.status !== "running" || state.tick >= finalTick) break;
      stepCore(core, state, targetScore);
    }
    error ??= index !== inputs.length ? "UNCONSUMED_INPUTS"
      : state.tick !== finalTick ? "FINAL_TICK_AFTER_RESOLUTION"
      : state.status === "running" ? "CLIENT_ENDED_BEFORE_RESOLUTION" : null;
  }
  return {
    valid: !error, error: error ?? undefined, state,
    score: state.score, timeMs: Math.round(state.tick * 1000 / core.tickRate),
    height: state.height, failure: state.failure, won: state.status === "won",
  };
}
