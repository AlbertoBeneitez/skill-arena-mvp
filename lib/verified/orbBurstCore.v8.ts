/**
 * Orb Burst V8 — V7 board, pace and rules unchanged; the authoritative score is now the number of orbs eliminated
 * (popped in groups of three or more plus the hanging orbs that fall with them). Bonus points for drops, chains and
 * clears no longer count. V1–V7 stay frozen.
 */
import type { GameCore } from "./coreRuntime.v1";
import {
  ORB_BURST_CORE_V7,
  ORB_V7_RULES,
  copyOrbV7State,
  createOrbV7State,
  stepOrbV7,
  type OrbV7State,
} from "./orbBurstCore.v7";

export type OrbV8State = OrbV7State;
export const ORB_V8_RULES = ORB_V7_RULES;

/** Orbs eliminated so far: popped plus dropped. */
export const orbEliminatedV8 = (state: Pick<OrbV8State, "popped" | "dropped">) => state.popped + state.dropped;

export function createOrbV8State(seed: string): OrbV8State {
  const state = createOrbV7State(seed);
  state.score = 0;
  return state;
}
export function stepOrbV8(state: OrbV8State) {
  stepOrbV7(state);
  state.score = orbEliminatedV8(state);
}
export const copyOrbV8State = copyOrbV7State;

export const ORB_BURST_CORE_V8: GameCore<OrbV8State> = {
  ...ORB_BURST_CORE_V7,
  gameVersion: "8.0.0",
  content: {
    base: ORB_BURST_CORE_V7.content,
    scoring: "orbs-eliminated=popped+dropped",
  },
  create: createOrbV8State,
  step: stepOrbV8,
};
