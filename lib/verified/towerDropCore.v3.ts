/** Original pendulum delivery; retain archived V2 contact/gravity/tipping rules. */
import { hashSeed } from "../deterministic/seeded";
import { roundDiv, integerSqrt } from "../deterministic/integerMath";
import {
  createTowerDropState,
  dropTowerBlock,
  stepTowerDrop,
  TOWER_DROP_V2,
  TOWER_DROP_V2_CONTENT,
  type TowerDropState,
} from "./towerDropCore.v2";
import type { GameCore } from "./coreRuntime.v1";

export const TOWER_DROP_V3 = {
  phaseUnits: 4096,
  ropeLengthMilli: 155_000,
  baseStep: 6,
  seedStepVariants: 2,
  stepEveryFloors: 5,
  maximumStep: 12,
  baseAmplitudeMilli: 68_000,
  seedAmplitudeVariants: 7,
  amplitudeStepMilli: 2_000,
  maximumAmplitudeMilli: 96_000,
  amplitudeGrowthMilliPerTick: 16,
  releaseMomentumPerMille: 1000,
  idleLimitTicks: 120 * 45,
  maxFinalTick: 120 * 60 * 6,
} as const;
export type TowerDropV3State = TowerDropState & {
  seed: string;
  height: number;
  hookRiseMilli: number;
  hookVYMilliPerSecond: number;
  amplitudeMilli: number;
};

/** Integer rational sine approximation; maximum speed at centre, rest at extremes. */
export function naturalPendulumWave(phase: number) {
  const p = ((phase % 4096) + 4096) % 4096,
    t = p % 2048,
    u = t * (2048 - t);
  const wave = roundDiv(16 * u * 1000, 5 * 2048 * 2048 - 4 * u);
  return p >= 2048 && wave ? -wave : wave;
}
function pose(
  state: TowerDropV3State,
  oldX = state.movingXMilli,
  oldRise = state.hookRiseMilli,
) {
  const offset = roundDiv(
    naturalPendulumWave(state.swingPhase) * state.amplitudeMilli,
    1000,
  );
  state.movingXMilli = 195_000 + offset - Math.floor(state.movingWMilli / 2);
  state.hookRiseMilli =
    TOWER_DROP_V3.ropeLengthMilli -
    integerSqrt(TOWER_DROP_V3.ropeLengthMilli ** 2 - offset ** 2);
  state.movingVXMilliPerSecond =
    (state.movingXMilli - oldX) * TOWER_DROP_V2.tickRate;
  state.hookVYMilliPerSecond =
    -(state.hookRiseMilli - oldRise) * TOWER_DROP_V2.tickRate;
}
export function createTowerDropV3(seed: string): TowerDropV3State {
  const state: TowerDropV3State = {
    ...createTowerDropState(),
    seed,
    height: 0,
    hookRiseMilli: 0,
    hookVYMilliPerSecond: 0,
    amplitudeMilli:
      TOWER_DROP_V3.baseAmplitudeMilli +
      (hashSeed(`${seed}:tower3`) % TOWER_DROP_V3.seedAmplitudeVariants) * 1000,
  };
  state.swingPhase = hashSeed(`${seed}:tower3:phase`) % 4096;
  pose(state);
  state.movingVXMilliPerSecond = 0;
  state.hookVYMilliPerSecond = 0;
  return state;
}
export function dropTowerV3(state: TowerDropV3State) {
  dropTowerBlock(state);
  state.fallYMilli = -state.hookRiseMilli;
  state.fallVXMilliPerSecond = state.movingVXMilliPerSecond;
  state.fallVYMilliPerSecond = state.hookVYMilliPerSecond;
}
export function stepTowerV3(state: TowerDropV3State) {
  const step = Math.min(
    TOWER_DROP_V3.maximumStep,
    TOWER_DROP_V3.baseStep +
      (hashSeed(`${state.seed}:tower3`) % TOWER_DROP_V3.seedStepVariants) +
      Math.floor(state.height / TOWER_DROP_V3.stepEveryFloors),
  );
  const phase = (state.swingPhase + step) % 4096,
    oldX = state.movingXMilli,
    oldRise = state.hookRiseMilli;
  if (state.phase === "swing") {
    state.tick++;
    state.idleTicks++;
    if (state.idleTicks >= TOWER_DROP_V3.idleLimitTicks) {
      state.status = "failed";
      state.failure = "TIMEOUT_IDLE";
    }
  } else stepTowerDrop(state);
  state.height = state.blocks.length - 1;
  const desiredAmplitude = Math.min(
    TOWER_DROP_V3.maximumAmplitudeMilli,
    TOWER_DROP_V3.baseAmplitudeMilli +
      (hashSeed(`${state.seed}:tower3`) % TOWER_DROP_V3.seedAmplitudeVariants) *
        1000 +
      state.height * TOWER_DROP_V3.amplitudeStepMilli,
  );
  state.amplitudeMilli += Math.min(
    TOWER_DROP_V3.amplitudeGrowthMilliPerTick,
    desiredAmplitude - state.amplitudeMilli,
  );
  state.swingPhase = phase;
  pose(state, oldX, oldRise);
}
/** Read-only landing preview, sharing exact archived ballistic/contact simulation. */
export function forecastTowerLanding(state: TowerDropV3State) {
  const copy = {
    ...state,
    blocks: state.blocks.map((block) => ({ ...block })),
  };
  dropTowerV3(copy);
  let steps = 0;
  while (copy.phase === "falling" && copy.status === "running" && steps++ < 240)
    stepTowerDrop(copy);
  return {
    xMilli: copy.fallXMilli,
    stable: copy.phase === "swing",
    scoreDelta: copy.score - state.score,
    ticks: steps,
  };
}
export const TOWER_DROP_CORE_V3: GameCore<TowerDropV3State> = {
  gameId: "tower-drop",
  gameVersion: "3.0.0",
  width: 390,
  height: 620,
  tickRate: 120,
  maxFinalTick: TOWER_DROP_V3.maxFinalTick,
  maxInputs: 500,
  inputVersion: 3,
  actions: ["DROP"],
  content: {
    delivery: TOWER_DROP_V3,
    model: "INTEGER_RATIONAL_SINE_WITH_CONSTANT_LENGTH_ROPE",
    inherited: TOWER_DROP_V2_CONTENT,
    contact: "ARCHIVED_V2_GRAVITY_SUPPORT_TIPPING",
    continuousPhase: true,
  },
  create: createTowerDropV3,
  step: stepTowerV3,
  apply: dropTowerV3,
  canApply: (state) => state.status === "running" && state.phase === "swing",
};
