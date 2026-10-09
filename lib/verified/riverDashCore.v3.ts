/** Continuous original orbital crossing. V1/V2 and their resets remain archived. */
import { createRng } from "../deterministic/seeded";
import {
  RIVER_ACTIONS,
  RIVER_DASH_V1,
  riverLaneRects,
  riverSupported,
  stepRiver,
  type RiverLane,
  type RiverState,
} from "./riverDashCore.v1";
import type { GameCore } from "./coreRuntime.v1";

export const RIVER_DASH_V3 = {
  rows: 65,
  startRow: 64,
  finishRow: 0,
  inputCooldownTicks: 24,
  openingRows: 8,
  maximumConsecutiveHazards: 2,
  rowPoints: 100,
  milestoneRows: 8,
  milestonePoints: 50,
  finishPoints: 800,
  maximumScore: 7600,
  maxFinalTick: RIVER_DASH_V1.maxFinalTick,
  maxInputs: RIVER_DASH_V1.maxInputs,
} as const;

export type RiverV3State = RiverState & {
  bestRow: number;
  height: number;
  lastAdvanceTick: number;
  fromRow: number;
  fromXMilli: number;
};

/**
 * The complete field is generated once. All traffic and platform phases keep
 * advancing even off screen; resting or backtracking never rerolls a row.
 */
export function buildRiverFieldV3(seed: string): RiverLane[] {
  const lanes: RiverLane[] = new Array(RIVER_DASH_V3.rows);
  const opening: readonly RiverLane["kind"][] = [
    "safe", "road", "safe", "river", "safe", "road", "safe", "river", "safe",
  ];
  let consecutiveHazards = 0;
  for (let advance = 0; advance < RIVER_DASH_V3.rows; advance++) {
    const rng = createRng(`${seed}:river3:row:${advance}`);
    const finish = advance === RIVER_DASH_V3.startRow;
    let kind: RiverLane["kind"];
    if (advance <= RIVER_DASH_V3.openingRows) kind = opening[advance];
    else if (
      finish ||
      consecutiveHazards >= RIVER_DASH_V3.maximumConsecutiveHazards ||
      (consecutiveHazards > 0 && rng.nextInt(4) === 0)
    ) kind = "safe";
    else kind = rng.nextInt(2) ? "river" : "road";
    consecutiveHazards = kind === "safe" ? 0 : consecutiveHazards + 1;
    const direction = rng.nextInt(2) ? 1 : -1;
    const novice = advance <= RIVER_DASH_V3.openingRows;
    const progress = Math.max(0, advance - RIVER_DASH_V3.openingRows);
    let speedMilli = 0, lengthMilli = 0, gapMilli = 0, phaseMilli = 0;
    if (kind === "road") {
      speedMilli = novice ? 8000 : 12000 + progress * 500 + rng.nextInt(6001);
      lengthMilli = novice ? 32000 : 40000 + progress * 400 + rng.nextInt(8001);
      gapMilli = novice ? 280000 : 260000 - progress * 1000 + rng.nextInt(24001);
      phaseMilli = rng.nextInt(novice ? 10001 : lengthMilli + gapMilli);
    } else if (kind === "river") {
      speedMilli = novice ? 6000 + rng.nextInt(1501) : 9000 + progress * 250 + rng.nextInt(6001);
      lengthMilli = novice ? 300000 : 280000 - progress * 1200 + rng.nextInt(24001);
      gapMilli = novice ? 30000 : 32000 + progress * 600 + rng.nextInt(18001);
      phaseMilli = rng.nextInt(novice ? 10001 : lengthMilli + gapMilli);
    }
    lanes[RIVER_DASH_V3.startRow - advance] = {
      kind, direction, speedMilli, lengthMilli, gapMilli, phaseMilli,
      offsetMilli: 0, remainder: 0,
    };
  }
  return lanes;
}

export function createRiverStateV3(seed: string): RiverV3State {
  return {
    seed,
    tick: 0,
    status: "running",
    failure: null,
    score: 0,
    xMilli: 180000,
    row: RIVER_DASH_V3.startRow,
    crossings: 0,
    lanes: buildRiverFieldV3(seed),
    lastMoveTick: -RIVER_DASH_V3.inputCooldownTicks,
    lastCrossTick: -100,
    bestRow: RIVER_DASH_V3.startRow,
    height: 0,
    lastAdvanceTick: -100,
    fromRow: RIVER_DASH_V3.startRow,
    fromXMilli: 180000,
  };
}

/** Frozen V1 support/overlap semantics, using its exported shared geometry. */
function evaluateArrival(state: RiverV3State) {
  const cfg = RIVER_DASH_V1;
  if (state.xMilli < cfg.radiusMilli || state.xMilli > cfg.widthMilli - cfg.radiusMilli) {
    state.status = "failed";
    state.failure = "SWEPT_AWAY";
  } else if (state.lanes[state.row].kind === "river" && !riverSupported(state)) {
    state.status = "failed";
    state.failure = "RIVER_GAP";
  } else if (
    state.lanes[state.row].kind === "road" &&
    riverLaneRects(state, state.row).some(rect =>
      state.xMilli + cfg.radiusMilli > rect.xMilli &&
      state.xMilli - cfg.radiusMilli < rect.xMilli + rect.wMilli,
    )
  ) {
    state.status = "failed";
    state.failure = "TRAFFIC_COLLISION";
  }
}

export function canMoveRiverV3(state: RiverV3State, action: string) {
  const cfg = RIVER_DASH_V1;
  if (state.status !== "running" || state.tick - state.lastMoveTick < RIVER_DASH_V3.inputCooldownTicks) return false;
  if (action === "UP") return state.row > RIVER_DASH_V3.finishRow;
  if (action === "DOWN") return state.row < RIVER_DASH_V3.startRow;
  if (action === "LEFT") return state.xMilli - cfg.cellMilli >= cfg.radiusMilli;
  if (action === "RIGHT") return state.xMilli + cfg.cellMilli <= cfg.widthMilli - cfg.radiusMilli;
  return false;
}

export function moveRiverV3(state: RiverV3State, action: string) {
  if (!canMoveRiverV3(state, action)) return;
  state.fromRow = state.row;
  state.fromXMilli = state.xMilli;
  state.lastMoveTick = state.tick;
  if (action === "UP") state.row--;
  else if (action === "DOWN") state.row++;
  else if (action === "LEFT") state.xMilli -= RIVER_DASH_V1.cellMilli;
  else if (action === "RIGHT") state.xMilli += RIVER_DASH_V1.cellMilli;
  evaluateArrival(state);
  // Failed entry is never awarded, and revisiting an already reached row cannot farm score.
  if (state.status !== "running") return;
  if (state.row < state.bestRow) {
    const previousHeight = state.height;
    state.bestRow = state.row;
    state.height = RIVER_DASH_V3.startRow - state.bestRow;
    state.score += (state.height - previousHeight) * RIVER_DASH_V3.rowPoints;
    state.score += (
      Math.floor(state.height / RIVER_DASH_V3.milestoneRows) -
      Math.floor(previousHeight / RIVER_DASH_V3.milestoneRows)
    ) * RIVER_DASH_V3.milestonePoints;
    state.lastAdvanceTick = state.tick;
  }
  if (state.row === RIVER_DASH_V3.finishRow) {
    state.score += RIVER_DASH_V3.finishPoints;
    state.status = "won";
    state.failure = null;
  }
}

export const RIVER_DASH_CORE_V3: GameCore<RiverV3State> = {
  gameId: "river-dash",
  gameVersion: "3.0.0",
  width: 390,
  height: 620,
  tickRate: RIVER_DASH_V1.tickRate,
  maxFinalTick: RIVER_DASH_V3.maxFinalTick,
  maxInputs: RIVER_DASH_V3.maxInputs,
  inputVersion: 3,
  actions: RIVER_ACTIONS,
  content: {
    rules: RIVER_DASH_V3,
    geometry: {
      cols: RIVER_DASH_V1.cols,
      widthMilli: RIVER_DASH_V1.widthMilli,
      cellMilli: RIVER_DASH_V1.cellMilli,
      radiusMilli: RIVER_DASH_V1.radiusMilli,
    },
    generation: "SEEDED_RIVER3_SINGLE_65_ROW_FIELD",
    motion: "FROZEN_V1_PHASE_AND_FULL_SUPPORT_CARRY;CROSSINGS_ALWAYS_ZERO",
    scoring: "VALID_ARRIVAL_HIGH_WATER_ONLY_WITH_EIGHT_ROW_BONUS_AND_FINISH",
    completion: "SAFE_FINISH_ROW_OR_COMMON_SIGNED_TARGET_OR_TIME_LIMIT",
  },
  create: createRiverStateV3,
  step: stepRiver,
  canApply: canMoveRiverV3,
  apply: moveRiverV3,
};
