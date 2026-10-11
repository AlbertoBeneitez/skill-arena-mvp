/** Twenty skill throws on one persistent board; raw dartboard total only. */
import { createRng } from "../deterministic/seeded";
import { roundDiv, sinPhaseMilli } from "../deterministic/integerMath";
import { dartsValue, DARTS_SECTORS, type DartImpact } from "./dartsCore.v1";
import { DARTS_ACTIONS } from "./dartsProtocol.v1";
import type { CoreState, GameCore } from "./coreRuntime.v1";
export const DARTS_RULES_V3 = {
  throws: 20,
  flightTicks: 144,
  impactTicks: 120,
  aimStep: 5000,
  distanceMilli: 10000,
  flightDurationMilli: 1000,
  phaseSpeed: [10, 12, 14, 16, 18],
  drift: [3000, 5000, 7000, 9000, 12000],
  deadlineSeconds: [14, 12, 11, 10, 9],
} as const;
export type DartsStateV3 = CoreState & {
  seed: string;
  total: number;
  sway: readonly Readonly<{ phaseX: number; phaseY: number }>[];
  throwIndex: number;
  aimX: number;
  aimY: number;
  phase: "aim" | "flight";
  phaseTicks: number;
  impacts: DartImpact[];
  lastHitTick: number;
};
export function dartsStageV3(s: Readonly<DartsStateV3>) {
  return Math.min(4, Math.floor(s.throwIndex / 4));
}
export function dartsDriftV3(s: Readonly<DartsStateV3>, tick = s.tick) {
  const stage = dartsStageV3(s),
    sway = s.sway[Math.min(19, s.throwIndex)],
    phase = tick * DARTS_RULES_V3.phaseSpeed[stage],
    a = DARTS_RULES_V3.drift[stage];
  return {
    x: roundDiv(sinPhaseMilli(sway.phaseX + phase) * a, 1000),
    y: roundDiv(sinPhaseMilli(sway.phaseY + phase) * a, 1250),
  };
}
export function dartsReticleV3(s: Readonly<DartsStateV3>, tick = s.tick) {
  const d = dartsDriftV3(s, tick);
  return { x: (s.aimX - 30) * 5000 + d.x, y: (s.aimY - 30) * 5000 + d.y };
}
function impact(s: DartsStateV3, timeout: boolean) {
  const p = dartsReticleV3(s),
    points = timeout ? 0 : dartsValue(p.x, p.y).points;
  s.impacts.push({ ...p, points, award: points, goal: points > 0, timeout });
  s.phase = "flight";
  s.phaseTicks = 0;
}
export const DARTS_CORE_V3: GameCore<DartsStateV3> = {
  gameId: "darts",
  gameVersion: "3.0.0",
  width: 390,
  height: 620,
  tickRate: 120,
  maxFinalTick: 36000,
  maxInputs: 8000,
  inputVersion: 1,
  actions: DARTS_ACTIONS,
  content: {
    rules: DARTS_RULES_V3,
    sectors: DARTS_SECTORS,
    scenario: "twenty-throws-integer-sway-v3",
    scoring: "SUM_RAW_DARTBOARD_POINTS_NO_GOAL_OR_STREAK_BONUS",
    landing: "QUANTIZED_AIM_PLUS_INTEGER_TICK_SWAY",
    control: "UPWARD_SWIPE_RELEASE",
  },
  create(seed) {
    const rng = createRng(`${seed}:darts3:sway`);
    const sway = Object.freeze(
      Array.from({ length: 20 }, () =>
        Object.freeze({ phaseX: rng.nextInt(4096), phaseY: rng.nextInt(4096) }),
      ),
    );
    return {
      sway,
      tick: 0,
      status: "running",
      failure: null,
      score: 0,
      total: 0,
      seed,
      throwIndex: 0,
      aimX: 30,
      aimY: 30,
      phase: "aim",
      phaseTicks: 0,
      impacts: [],
      lastHitTick: -100,
    };
  },
  canApply(s, a) {
    if (
      s.status !== "running" ||
      s.phase !== "aim" ||
      !DARTS_ACTIONS.includes(a)
    )
      return false;
    if (a.startsWith("AIM_X_")) return s.aimX !== Number(a.slice(6));
    if (a.startsWith("AIM_Y_")) return s.aimY !== Number(a.slice(6));
    return a === "THROW";
  },
  apply(s, a) {
    if (a.startsWith("AIM_X_")) s.aimX = Number(a.slice(6));
    else if (a.startsWith("AIM_Y_")) s.aimY = Number(a.slice(6));
    else impact(s, false);
  },
  step(s) {
    s.tick++;
    s.phaseTicks++;
    if (s.phase === "aim") {
      if (s.phaseTicks >= DARTS_RULES_V3.deadlineSeconds[dartsStageV3(s)] * 120)
        impact(s, true);
      return;
    }
    if (s.phaseTicks === DARTS_RULES_V3.impactTicks) {
      s.total += s.impacts.at(-1)!.points;
      s.lastHitTick = s.tick;
    }
    if (s.phaseTicks < DARTS_RULES_V3.flightTicks) return;
    s.throwIndex++;
    if (s.throwIndex === 20) {
      s.score = s.total;
      s.status = s.score > 0 ? "won" : "failed";
      s.failure = s.score > 0 ? null : "NO_SCORE";
      return;
    }
    s.phase = "aim";
    s.phaseTicks = 0;
  },
};
