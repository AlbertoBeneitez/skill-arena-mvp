/** Original mobile skill darts: seed selects objectives, never random landing. */
import { createRng, hashSeed } from "../deterministic/seeded";
import {
  integerSqrt,
  roundDiv,
  sinPhaseMilli,
} from "../deterministic/integerMath";
import { DARTS_ACTIONS } from "./dartsProtocol.v1";
import type { CoreState, GameCore } from "./coreRuntime.v1";
export const DARTS_RULES = {
  radius: 140000,
  bullInner: 10000,
  bullOuter: 24000,
  tripleInner: 78000,
  tripleOuter: 88000,
  doubleInner: 129000,
  doubleOuter: 140000,
  throws: 15,
  throwsPerStage: 3,
  flightTicks: 48,
  impactTicks: 24,
  minimumCompletionScore: 2500,
  aimStep: 5000,
  phaseSpeed: [12, 14, 16, 18, 20],
  drift: [4000, 6000, 9000, 12000, 16000],
  deadlineSeconds: [14, 12, 10, 9, 8],
} as const;
export const DARTS_SECTORS = [
  20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5,
] as const;
export type DartTarget = {
  kind: "BULL" | "SECTOR" | "DOUBLE" | "TRIPLE";
  sector: number;
  x: number;
  y: number;
  radius: number;
  label: string;
};
export type DartImpact = {
  x: number;
  y: number;
  points: number;
  award: number;
  goal: boolean;
  timeout: boolean;
};
export type DartsState = CoreState & {
  seed: string;
  throwIndex: number;
  aimX: number;
  aimY: number;
  phase: "aim" | "flight";
  phaseTicks: number;
  target: DartTarget;
  impacts: DartImpact[];
  streak: number;
  lastHitTick: number;
};
export function dartsDirection(index: number) {
  const phase = Math.floor((index * 4096) / 20) - 1024,
    x = sinPhaseMilli(phase + 1024),
    y = sinPhaseMilli(phase),
    length = integerSqrt(x * x + y * y);
  return { x, y, length };
}
function target(seed: string, index: number): DartTarget {
  const stage = Math.floor(index / 3),
    rng = createRng(`${seed}:darts1:objective:${index}`),
    sector = rng.nextInt(20);
  if (stage === 0 || (stage === 4 && index % 3 === 2))
    return {
      kind: "BULL",
      sector: -1,
      x: 0,
      y: 0,
      radius: stage === 0 ? 50000 : 14000,
      label: stage === 0 ? "ZONA CENTRAL" : "BULL · PRECISIÓN",
    };
  const kind =
      stage === 1
        ? "SECTOR"
        : stage === 2
          ? "DOUBLE"
          : stage === 3
            ? "TRIPLE"
            : index % 3 === 0
              ? "DOUBLE"
              : "TRIPLE",
    radius = kind === "SECTOR" ? 105000 : kind === "DOUBLE" ? 134500 : 83000,
    d = dartsDirection(sector);
  return {
    kind,
    sector,
    x: roundDiv(d.x * radius, d.length),
    y: roundDiv(d.y * radius, d.length),
    radius: kind === "SECTOR" ? 27000 : 16000,
    label: `${kind === "SECTOR" ? "SECTOR" : kind === "DOUBLE" ? "DOBLE" : "TRIPLE"} ${DARTS_SECTORS[sector]}`,
  };
}
export function createDartsState(seed: string): DartsState {
  return {
    tick: 0,
    status: "running",
    failure: null,
    score: 0,
    seed,
    throwIndex: 0,
    aimX: 30,
    aimY: 30,
    phase: "aim",
    phaseTicks: 0,
    target: target(seed, 0),
    impacts: [],
    streak: 0,
    lastHitTick: -100,
  };
}
export function dartsDrift(state: DartsState, tick = state.tick) {
  const stage = Math.min(4, Math.floor(state.throwIndex / 3)),
    phase =
      (hashSeed(`${state.seed}:darts1:sway:${state.throwIndex}`) % 4096) +
      tick * DARTS_RULES.phaseSpeed[stage],
    amplitude = DARTS_RULES.drift[stage];
  return {
    x: roundDiv(sinPhaseMilli(phase) * amplitude, 1000),
    y: roundDiv(sinPhaseMilli(phase + 1365) * amplitude, 1250),
  };
}
export function dartsReticle(state: DartsState, tick = state.tick) {
  const drift = dartsDrift(state, tick);
  return {
    x: (state.aimX - 30) * 5000 + drift.x,
    y: (state.aimY - 30) * 5000 + drift.y,
  };
}
export function dartsValue(x: number, y: number) {
  const r2 = x * x + y * y;
  if (r2 > DARTS_RULES.radius ** 2)
    return { points: 0, sector: -1, multiplier: 0 };
  if (r2 <= DARTS_RULES.bullInner ** 2)
    return { points: 50, sector: -1, multiplier: 2 };
  if (r2 <= DARTS_RULES.bullOuter ** 2)
    return { points: 25, sector: -1, multiplier: 1 };
  let sector = 0,
    best = -Infinity;
  for (let i = 0; i < 20; i++) {
    const d = dartsDirection(i),
      dot = roundDiv(x * d.x + y * d.y, d.length);
    if (dot > best) {
      best = dot;
      sector = i;
    }
  }
  const multiplier =
    r2 >= DARTS_RULES.doubleInner ** 2
      ? 2
      : r2 >= DARTS_RULES.tripleInner ** 2 && r2 <= DARTS_RULES.tripleOuter ** 2
        ? 3
        : 1;
  return { points: DARTS_SECTORS[sector] * multiplier, sector, multiplier };
}
function impact(state: DartsState, timeout: boolean) {
  const reticle = dartsReticle(state),
    value = timeout
      ? { points: 0, sector: -2, multiplier: 0 }
      : dartsValue(reticle.x, reticle.y),
    t = state.target,
    distance = integerSqrt((reticle.x - t.x) ** 2 + (reticle.y - t.y) ** 2);
  const goal =
    !timeout &&
    distance <= t.radius &&
    (t.kind === "BULL"
      ? true
      : value.sector === t.sector &&
        (t.kind === "SECTOR" ||
          value.multiplier === (t.kind === "DOUBLE" ? 2 : 3)));
  state.streak = goal ? state.streak + 1 : 0;
  const award =
    value.points * 10 +
    (goal
      ? 250 +
        Math.max(0, 150 - Math.floor((distance * 150) / t.radius)) +
        Math.min(3, state.streak) * 30
      : 0);
  state.impacts.push({
    ...reticle,
    points: value.points,
    award,
    goal,
    timeout,
  });
  state.phase = "flight";
  state.phaseTicks = 0;
}
export function stepDarts(state: DartsState) {
  state.tick++;
  state.phaseTicks++;
  if (state.phase === "aim") {
    const stage = Math.floor(state.throwIndex / 3);
    if (state.phaseTicks >= DARTS_RULES.deadlineSeconds[stage] * 120)
      impact(state, true);
    return;
  }
  if (state.phaseTicks === DARTS_RULES.impactTicks) {
    state.score += state.impacts.at(-1)!.award;
    state.lastHitTick = state.tick;
  }
  if (state.phaseTicks < DARTS_RULES.flightTicks) return;
  state.throwIndex++;
  if (state.throwIndex === DARTS_RULES.throws) {
    state.status =
      state.score >= DARTS_RULES.minimumCompletionScore ? "won" : "failed";
    state.failure = state.status === "failed" ? "LOW_SCORE" : null;
    return;
  }
  state.phase = "aim";
  state.phaseTicks = 0;
  state.target = target(state.seed, state.throwIndex);
}
export function canApplyDarts(state: DartsState, action: string) {
  if (
    state.status !== "running" ||
    state.phase !== "aim" ||
    !DARTS_ACTIONS.includes(action)
  )
    return false;
  if (action.startsWith("AIM_X_"))
    return state.aimX !== Number(action.slice(6));
  if (action.startsWith("AIM_Y_"))
    return state.aimY !== Number(action.slice(6));
  return action === "THROW";
}
export function applyDarts(state: DartsState, action: string) {
  if (action.startsWith("AIM_X_")) state.aimX = Number(action.slice(6));
  else if (action.startsWith("AIM_Y_")) state.aimY = Number(action.slice(6));
  else impact(state, false);
}
export const DARTS_CORE: GameCore<DartsState> = {
  gameId: "darts",
  gameVersion: "1.0.0",
  width: 390,
  height: 620,
  tickRate: 120,
  maxFinalTick: 120 * 60 * 4,
  maxInputs: 6000,
  inputVersion: 1,
  actions: DARTS_ACTIONS,
  content: {
    rules: DARTS_RULES,
    sectors: DARTS_SECTORS,
    scenario: "darts1-objective-sway-v1",
    landing: "quantized-base-plus-integer-tick-sway-v1",
  },
  create: createDartsState,
  step: stepDarts,
  canApply: canApplyDarts,
  apply: applyDarts,
};
