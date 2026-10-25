/**
 * Tower Drop V5 — V4 (pendulum delivery, three lives, failed block discarded) on the V5 physics: a released block
 * never rebounds off the screen edges; if it leaves the play width it just falls away and costs a life.
 * V1–V4 stay untouched for historical replays.
 */
import { hashSeed } from "../deterministic/seeded";
import { roundDiv, integerSqrt } from "../deterministic/integerMath";
import {
  createTowerDropState,
  dropTowerBlock,
  stepTowerDrop,
  TOWER_DROP_V2,
  TOWER_DROP_V2_CONTENT,
  type TowerDropState,
} from "./towerDropPhysics.v5";
import { TOWER_DROP_V3, naturalPendulumWave } from "./towerDropCore.v3";
import type { GameCore } from "./coreRuntime.v1";

export { TOWER_DROP_V3 };
export const TOWER_DROP_V5 = Object.freeze({ lives: 3 });
export type TowerDropV5State = TowerDropState & {
  seed: string;
  height: number;
  hookRiseMilli: number;
  hookVYMilliPerSecond: number;
  amplitudeMilli: number;
  lives: number;
  lastLossTick: number;
};

function pose(state: TowerDropV5State, oldX = state.movingXMilli, oldRise = state.hookRiseMilli) {
  const offset = roundDiv(naturalPendulumWave(state.swingPhase) * state.amplitudeMilli, 1000);
  state.movingXMilli = 195_000 + offset - Math.floor(state.movingWMilli / 2);
  state.hookRiseMilli = TOWER_DROP_V3.ropeLengthMilli - integerSqrt(TOWER_DROP_V3.ropeLengthMilli ** 2 - offset ** 2);
  state.movingVXMilliPerSecond = (state.movingXMilli - oldX) * TOWER_DROP_V2.tickRate;
  state.hookVYMilliPerSecond = -(state.hookRiseMilli - oldRise) * TOWER_DROP_V2.tickRate;
}
export function createTowerDropV5(seed: string): TowerDropV5State {
  const state: TowerDropV5State = {
    ...createTowerDropState(),
    seed,
    height: 0,
    hookRiseMilli: 0,
    hookVYMilliPerSecond: 0,
    amplitudeMilli: TOWER_DROP_V3.baseAmplitudeMilli + (hashSeed(`${seed}:tower3`) % TOWER_DROP_V3.seedAmplitudeVariants) * 1000,
    lives: TOWER_DROP_V5.lives,
    lastLossTick: -1,
  };
  state.swingPhase = hashSeed(`${seed}:tower3:phase`) % 4096;
  pose(state);
  state.movingVXMilliPerSecond = 0;
  state.hookVYMilliPerSecond = 0;
  return state;
}
export function dropTowerV5(state: TowerDropV5State) {
  dropTowerBlock(state);
  state.fallYMilli = -state.hookRiseMilli;
  state.fallVXMilliPerSecond = state.movingVXMilliPerSecond;
  state.fallVYMilliPerSecond = state.hookVYMilliPerSecond;
}
function stepPendulum(state: TowerDropV5State) {
  const step = Math.min(
    TOWER_DROP_V3.maximumStep,
    TOWER_DROP_V3.baseStep + (hashSeed(`${state.seed}:tower3`) % TOWER_DROP_V3.seedStepVariants) + Math.floor(state.height / TOWER_DROP_V3.stepEveryFloors),
  );
  const phase = (state.swingPhase + step) % 4096, oldX = state.movingXMilli, oldRise = state.hookRiseMilli;
  if (state.phase === "swing") {
    state.tick++;
    state.idleTicks++;
    if (state.idleTicks >= TOWER_DROP_V3.idleLimitTicks) { state.status = "failed"; state.failure = "TIMEOUT_IDLE"; }
  } else stepTowerDrop(state);
  state.height = state.blocks.length - 1;
  const desiredAmplitude = Math.min(
    TOWER_DROP_V3.maximumAmplitudeMilli,
    TOWER_DROP_V3.baseAmplitudeMilli + (hashSeed(`${state.seed}:tower3`) % TOWER_DROP_V3.seedAmplitudeVariants) * 1000 + state.height * TOWER_DROP_V3.amplitudeStepMilli,
  );
  state.amplitudeMilli += Math.min(TOWER_DROP_V3.amplitudeGrowthMilliPerTick, desiredAmplitude - state.amplitudeMilli);
  state.swingPhase = phase;
  pose(state, oldX, oldRise);
}
export function stepTowerV5(state: TowerDropV5State) {
  stepPendulum(state);
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
  } else if (state.status === "failed") state.lives = 0;
  return state;
}
/** Read-only landing preview on the V5 physics. */
export function forecastTowerLandingV5(state: TowerDropV5State) {
  const copy = { ...state, blocks: state.blocks.map((block) => ({ ...block })) };
  dropTowerV5(copy);
  let steps = 0;
  while (copy.phase === "falling" && copy.status === "running" && steps++ < 240) stepTowerDrop(copy);
  return { xMilli: copy.fallXMilli, stable: copy.phase === "swing", scoreDelta: copy.score - state.score, ticks: steps };
}
export const TOWER_DROP_CORE_V5: GameCore<TowerDropV5State> = {
  gameId: "tower-drop",
  gameVersion: "5.0.0",
  width: 390,
  height: 620,
  tickRate: 120,
  maxFinalTick: TOWER_DROP_V3.maxFinalTick,
  maxInputs: 500,
  inputVersion: 3,
  actions: ["DROP"],
  content: {
    delivery: TOWER_DROP_V3,
    lives: TOWER_DROP_V5.lives,
    model: "INTEGER_RATIONAL_SINE_WITH_CONSTANT_LENGTH_ROPE",
    inherited: TOWER_DROP_V2_CONTENT,
    contact: "V2_GRAVITY_SUPPORT_TIPPING_WITHOUT_SIDE_WALL_REBOUND",
    failure: "THREE_LIVES_FAILED_BLOCK_DISCARDED_TOWER_KEPT",
    continuousPhase: true,
  },
  create: createTowerDropV5,
  step: stepTowerV5,
  apply: dropTowerV5,
  canApply: (state) => state.status === "running" && state.phase === "swing",
};
