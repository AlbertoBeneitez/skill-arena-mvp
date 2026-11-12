// The contract every Galactic Games game follows (a copy of the app's lib/verified/coreRuntime.v1.ts types), plus the
// driver the server uses to replay a match. Do not change this file: your game is integrated against it.

export type CoreState = {
  tick: number;
  status: "running" | "failed" | "won";
  score: number;
  failure: string | null;
};

/** The rules. Pure TypeScript: no clock (Date, performance), no Math.random, no network, no DOM. */
export interface GameCore<S extends CoreState> {
  gameId: string;
  gameVersion: string;
  /** Logical canvas size the screen draws on (independent of the phone's pixels). */
  width: number;
  height: number;
  tickRate: number;
  /** Hard length of a match in ticks. */
  maxFinalTick: number;
  maxInputs: number;
  inputVersion: number;
  actions: readonly string[];
  content: unknown;
  /** A fresh match from the seed the server issues. Same seed → same match. */
  create(seed: string): S;
  /** Exactly one simulation tick: must add 1 to state.tick. */
  step(state: S): void;
  canApply(state: S, action: string): boolean;
  apply(state: S, action: string): void;
}

export type ReplayInput = { tick: number; action: string };

/** How the server replays a match: create; for every tick, the inputs recorded at that tick in order, then one step. */
export function replay<S extends CoreState>(core: GameCore<S>, seed: string, inputs: readonly ReplayInput[]): S {
  const state = core.create(seed);
  let i = 0;
  while (state.status === "running" && state.tick < core.maxFinalTick) {
    while (i < inputs.length && inputs[i].tick === state.tick) {
      const { action } = inputs[i++];
      if (core.actions.includes(action) && core.canApply(state, action)) core.apply(state, action);
    }
    while (i < inputs.length && inputs[i].tick < state.tick) i++;
    const before = state.tick;
    core.step(state);
    if (state.tick !== before + 1) throw new Error("step() must advance state.tick by exactly 1");
  }
  if (state.status === "running") { state.status = "failed"; state.failure = "TIME_LIMIT"; }
  return state;
}
