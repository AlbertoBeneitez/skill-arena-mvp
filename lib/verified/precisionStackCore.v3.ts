/** Original X/Z solid geometry; V1/V2 remain frozen and replayable. */
import { hashSeed } from "../deterministic/seeded";
import { clamp, roundDiv } from "../deterministic/integerMath";
import { PRECISION_STACK_V2, precisionStackPerfectToleranceForLevel } from "./precisionStackCore.v2";
import type { CoreState, GameCore } from "./coreRuntime.v1";

export const STACK_3D_RULES = {
  tickRate: 120, width: 390, height: 620,
  baseSizeMilli: 254_000, minimumOverlapMilli: 12_000,
  maxSweepMilli: 150_000, minimumSweepMilli: 45_000,
  initialPeriodTicks: 448, minimumPeriodTicks: 192,
  periodReductionPerLevel: 8, periodJitterSteps: 9,
  settleTicks: 24, idleLimitTicks: 120 * 45,
  maxFinalTick: 120 * 60 * 6,
  scoring: PRECISION_STACK_V2.scoring,
  perfectWindow: {
    initialMilli: PRECISION_STACK_V2.initialPerfectToleranceMilli,
    decreaseMilli: PRECISION_STACK_V2.perfectToleranceDecreaseMilli,
    minimumMilli: PRECISION_STACK_V2.minimumPerfectToleranceMilli,
  },
} as const;

export type StackSolid = { xMilli: number; zMilli: number; wMilli: number; dMilli: number };
export type Stack3DState = CoreState & {
  seed: string; height: number; combo: number; axis: "x" | "z";
  phase: "moving" | "settling";
  blocks: StackSolid[]; moving: StackSolid;
  movingAgeTicks: number; periodTicks: number; sweepMilli: number; direction: -1 | 1;
  settleRemaining: number;
  lastPlacement: { source: StackSolid; landed: StackSolid | null; perfect: boolean; tick: number; scoreDelta: number } | null;
};

function position(state: Stack3DState) {
  const half = state.periodTicks / 2;
  const phase = state.movingAgeTicks % state.periodTicks;
  const t = phase <= half ? phase : state.periodTicks - phase;
  const offset = state.direction * (-state.sweepMilli + roundDiv(2 * state.sweepMilli * t * t * (3 * half - 2 * t), half * half * half));
  const top = state.blocks[state.blocks.length - 1];
  state.moving.xMilli = top.xMilli + (state.axis === "x" ? offset : 0);
  state.moving.zMilli = top.zMilli + (state.axis === "z" ? offset : 0);
}

function spawn(state: Stack3DState) {
  const level = state.blocks.length;
  const hash = hashSeed(`${state.seed}:stack3:${level}`);
  const top = state.blocks[level - 1];
  state.axis = level % 2 ? "x" : "z";
  state.moving = { ...top };
  state.phase = "moving";
  state.movingAgeTicks = 0;
  state.direction = hash & 1 ? -1 : 1;
  state.periodTicks = Math.max(STACK_3D_RULES.minimumPeriodTicks, STACK_3D_RULES.initialPeriodTicks - (level - 1) * STACK_3D_RULES.periodReductionPerLevel + ((hash >>> 2) % STACK_3D_RULES.periodJitterSteps) * 4);
  const span = state.axis === "x" ? top.wMilli : top.dMilli;
  state.sweepMilli = clamp(Math.floor(span / 2) + STACK_3D_RULES.minimumSweepMilli, STACK_3D_RULES.minimumSweepMilli, STACK_3D_RULES.maxSweepMilli);
  state.settleRemaining = 0;
  position(state);
}

export function createStack3DState(seed: string): Stack3DState {
  const base = { xMilli: -127_000, zMilli: -127_000, wMilli: STACK_3D_RULES.baseSizeMilli, dMilli: STACK_3D_RULES.baseSizeMilli };
  const state: Stack3DState = {
    tick: 0, status: "running", failure: null, score: 0, seed, height: 0, combo: 0,
    axis: "x", phase: "moving", blocks: [base], moving: { ...base },
    movingAgeTicks: 0, periodTicks: 448, sweepMilli: 150_000, direction: 1,
    settleRemaining: 0, lastPlacement: null,
  };
  spawn(state);
  return state;
}

export function stepStack3D(state: Stack3DState) {
  state.tick += 1;
  if (state.phase === "settling") {
    state.settleRemaining -= 1;
    if (state.settleRemaining <= 0) spawn(state);
  } else {
    state.movingAgeTicks += 1;
    position(state);
    if (state.movingAgeTicks >= STACK_3D_RULES.idleLimitTicks) {
      state.status = "failed"; state.failure = "TIMEOUT_IDLE";
    }
  }
}

export function dropStack3D(state: Stack3DState) {
  const top = state.blocks[state.blocks.length - 1];
  const source = { ...state.moving };
  const x = Math.max(source.xMilli, top.xMilli), z = Math.max(source.zMilli, top.zMilli);
  const w = Math.min(source.xMilli + source.wMilli, top.xMilli + top.wMilli) - x;
  const d = Math.min(source.zMilli + source.dMilli, top.zMilli + top.dMilli) - z;
  const tolerance = precisionStackPerfectToleranceForLevel(state.blocks.length);
  const perfect = Math.abs(source.xMilli - top.xMilli) <= tolerance && Math.abs(source.zMilli - top.zMilli) <= tolerance;
  const landed: StackSolid = perfect ? { ...top } : { xMilli: x, zMilli: z, wMilli: w, dMilli: d };
  state.lastPlacement = { source, landed: null, perfect: false, tick: state.tick, scoreDelta: 0 };
  if (w <= 0 || d <= 0 || Math.min(w, d) < STACK_3D_RULES.minimumOverlapMilli) {
    state.status = "failed"; state.failure = w <= 0 || d <= 0 ? "NO_OVERLAP" : "UNSTABLE_OVERLAP";
    return;
  }
  const scoring = STACK_3D_RULES.scoring;
  const precision = roundDiv(w * d * scoring.precisionMax, source.wMilli * source.dMilli);
  const delta = scoring.base + precision + (perfect ? scoring.perfectBonus : 0) + Math.min(scoring.comboCap, state.combo * scoring.comboStep);
  state.score += delta;
  state.combo = perfect ? state.combo + 1 : 0;
  state.blocks.push(landed);
  state.height += 1;
  state.lastPlacement = { source, landed: { ...landed }, perfect, tick: state.tick, scoreDelta: delta };
  state.phase = "settling";
  state.settleRemaining = STACK_3D_RULES.settleTicks;
}

export const STACK_3D_CORE: GameCore<Stack3DState> = {
  gameId: "precision-stack", gameVersion: "3.0.0",
  width: STACK_3D_RULES.width, height: STACK_3D_RULES.height, tickRate: STACK_3D_RULES.tickRate,
  maxFinalTick: STACK_3D_RULES.maxFinalTick, maxInputs: 1000, inputVersion: 3, actions: ["DROP"],
  content: { rules: STACK_3D_RULES, geometry: "ALTERNATING_PERPENDICULAR_XZ_INTERSECTION", movement: "INTEGER_SMOOTHSTEP_SWEEP", domain: "stack3", scoring: "OVERLAP_AREA_PRECISION_AND_PERFECT_COMBO" },
  create: createStack3DState, step: stepStack3D,
  canApply: state => state.status === "running" && state.phase === "moving",
  apply: dropStack3D,
};
