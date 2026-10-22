/** Slower suspended descent and explicit release-hook state; V2/V3 stay frozen. */
import {
  TOWER_DROP_CORE_V3 as base,
  TOWER_DROP_V3,
  createTowerDropV3,
  dropTowerV3,
  type TowerDropV3State,
} from "./towerDropCore.v3";
import type { GameCore } from "./coreRuntime.v1";

export const TOWER_DROP_V4 = Object.freeze({
  descentDivisor: 2,
  hookOpenStepMilli: 70,
  maxFinalTick: TOWER_DROP_V3.maxFinalTick,
});

export type TowerDropV4State = TowerDropV3State & {
  descentClock: number;
  hookOpenMilli: number;
  releaseHookXMilli: number;
  releaseHookRiseMilli: number;
};
export function createTowerDropV4(seed: string): TowerDropV4State {
  return {
    ...createTowerDropV3(seed),
    descentClock: 0,
    hookOpenMilli: 0,
    releaseHookXMilli: 195_000,
    releaseHookRiseMilli: 0,
  };
}

export function dropTowerV4(state: TowerDropV4State) {
  state.releaseHookXMilli =
    state.movingXMilli + Math.floor(state.movingWMilli / 2);
  state.releaseHookRiseMilli = state.hookRiseMilli;
  state.descentClock = 0;
  state.hookOpenMilli = 0;
  dropTowerV3(state);
}

function descending(state: TowerDropV4State) {
  return (
    state.phase === "falling" ||
    state.phase === "falling-out" ||
    state.phase === "tipping-left" ||
    state.phase === "tipping-right"
  );
}

export function stepTowerV4(state: TowerDropV4State) {
  if (!descending(state)) {
    base.step(state);
    state.descentClock = 0;
    state.hookOpenMilli = 0;
    return;
  }

  state.hookOpenMilli = Math.min(
    1000,
    state.hookOpenMilli + TOWER_DROP_V4.hookOpenStepMilli,
  );
  state.descentClock++;

  // Preserve V3's archived collision path while spacing its physical steps
  // over two authoritative ticks. The block visibly descends instead of
  // snapping down, and every client/server still executes the same schedule.
  if (state.descentClock % TOWER_DROP_V4.descentDivisor !== 0) {
    state.tick++;
    return;
  }

  base.step(state);
  if (!descending(state)) {
    state.descentClock = 0;
    state.hookOpenMilli = 0;
  }
}

export const TOWER_DROP_CORE_V4: GameCore<TowerDropV4State> = {
  ...base,
  gameVersion: "4.0.0",
  content: {
    base: base.content,
    descent: "ARCHIVED_V3_PHYSICS_AT_HALF_RATE",
    hook: "DETERMINISTIC_ARTICULATED_RELEASE_STATE",
  },
  create: createTowerDropV4,
  step: stepTowerV4,
  apply: dropTowerV4,
};
