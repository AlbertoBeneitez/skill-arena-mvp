/**
 * V4: Tower Drop with three lives. Same pendulum, contact and tipping rules as
 * V3; a miss, a tip-over or an idle timeout now costs one life, the failed
 * block is discarded and the tower keeps going. The run ends on the third
 * failure. V1–V3 stay untouched for historical replays.
 */
import {
  createTowerDropV3,
  stepTowerV3,
  dropTowerV3,
  forecastTowerLanding as forecastTowerLandingV3,
  TOWER_DROP_V3,
  type TowerDropV3State,
} from "./towerDropCore.v3";
import { TOWER_DROP_V2_CONTENT } from "./towerDropCore.v2";
import type { GameCore } from "./coreRuntime.v1";

export { TOWER_DROP_V3 };
export const TOWER_DROP_V4 = Object.freeze({ lives: 3 });
export type TowerDropV4State = TowerDropV3State & {
  lives: number;
  /** Tick of the latest lost life (-1 when none); presentation reads it for feedback. */
  lastLossTick: number;
};

export function createTowerDropV4(seed: string): TowerDropV4State {
  return { ...createTowerDropV3(seed), lives: TOWER_DROP_V4.lives, lastLossTick: -1 };
}
export function dropTowerV4(state: TowerDropV4State) {
  dropTowerV3(state);
  return state;
}
export function stepTowerV4(state: TowerDropV4State) {
  stepTowerV3(state);
  if (state.status === "failed" && state.lives > 1) {
    // One life is lost: the block is gone, the tower stays and the hook swings on.
    state.lives--;
    state.lastLossTick = state.tick;
    state.status = "running";
    state.failure = null;
    state.phase = "swing";
    state.combo = 0;
    state.idleTicks = 0;
    state.tipDirection = 0;
    state.tipAngleMilliDeg = 0;
    state.tipAngularVelocityMilliDegPerSecond = 0;
    state.tipVelocityRemainder = 0;
    state.tipAngleRemainder = 0;
    state.fallYMilli = 0;
    state.fallVYMilliPerSecond = 0;
    state.fallVelocityRemainder = 0;
    state.fallPositionRemainder = 0;
    // The pendulum is continuous: the next tick poses the hook from swingPhase.
  } else if (state.status === "failed") {
    state.lives = 0;
  }
  return state;
}
/** Read-only landing preview (shares the archived ballistic/contact simulation). */
export function forecastTowerLanding(state: TowerDropV4State) {
  return forecastTowerLandingV3(state);
}
export const TOWER_DROP_CORE_V4: GameCore<TowerDropV4State> = {
  gameId: "tower-drop",
  gameVersion: "4.0.0",
  width: 390,
  height: 620,
  tickRate: 120,
  maxFinalTick: TOWER_DROP_V3.maxFinalTick,
  maxInputs: 500,
  inputVersion: 3,
  actions: ["DROP"],
  content: {
    delivery: TOWER_DROP_V3,
    lives: TOWER_DROP_V4.lives,
    model: "INTEGER_RATIONAL_SINE_WITH_CONSTANT_LENGTH_ROPE",
    inherited: TOWER_DROP_V2_CONTENT,
    contact: "ARCHIVED_V2_GRAVITY_SUPPORT_TIPPING",
    failure: "THREE_LIVES_FAILED_BLOCK_DISCARDED_TOWER_KEPT",
    continuousPhase: true,
  },
  create: createTowerDropV4,
  step: stepTowerV4,
  apply: dropTowerV4,
  canApply: (state) => state.status === "running" && state.phase === "swing",
};
