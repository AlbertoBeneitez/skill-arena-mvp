/** Original lane crossing rules; fixed-tick carry and continuous traffic phases. */
import { createRng } from "../deterministic/seeded";
import type { GameCore, CoreState } from "./coreRuntime.v1";
export const RIVER_DASH_V1 = {
  rows: 11,
  cols: 9,
  widthMilli: 360000,
  cellMilli: 40000,
  radiusMilli: 11000,
  inputCooldownTicks: 12,
  tickRate: 120,
  baseCrossingPoints: 1250,
  crossingBonus: 150,
  speedIncreasePerCrossingPermille: 55,
  maximumSpeedPermille: 1600,
  maxFinalTick: 120 * 60 * 6,
  maxInputs: 4000,
} as const;
export const RIVER_ACTIONS = ["UP", "DOWN", "LEFT", "RIGHT"] as const;
export type RiverLane = {
  kind: "safe" | "road" | "river";
  direction: -1 | 1;
  speedMilli: number;
  lengthMilli: number;
  gapMilli: number;
  phaseMilli: number;
  offsetMilli: number;
  remainder: number;
};
export type RiverState = CoreState & {
  seed: string;
  xMilli: number;
  row: number;
  crossings: number;
  lanes: RiverLane[];
  lastMoveTick: number;
  lastCrossTick: number;
};
const mod = (x: number, period: number) => ((x % period) + period) % period;
export function riverLaneRects(state: RiverState, row: number) {
  const lane = state.lanes[row];
  if (lane.kind === "safe") return [];
  const period = lane.lengthMilli + lane.gapMilli,
    phase = mod(lane.phaseMilli + lane.offsetMilli, period),
    rects: { xMilli: number; wMilli: number }[] = [];
  for (let x = phase - period; x < RIVER_DASH_V1.widthMilli; x += period)
    rects.push({ xMilli: x, wMilli: lane.lengthMilli });
  return rects;
}
export function riverSupported(state: RiverState) {
  return riverLaneRects(state, state.row).some(
    (r) =>
      state.xMilli - RIVER_DASH_V1.radiusMilli >= r.xMilli &&
      state.xMilli + RIVER_DASH_V1.radiusMilli <= r.xMilli + r.wMilli,
  );
}
function evaluate(state: RiverState) {
  const cfg = RIVER_DASH_V1;
  if (
    state.xMilli < cfg.radiusMilli ||
    state.xMilli > cfg.widthMilli - cfg.radiusMilli
  ) {
    state.status = "failed";
    state.failure = "SWEPT_AWAY";
    return;
  }
  const kind = state.lanes[state.row].kind;
  if (kind === "river" && !riverSupported(state)) {
    state.status = "failed";
    state.failure = "RIVER_GAP";
  }
  if (
    kind === "road" &&
    riverLaneRects(state, state.row).some(
      (r) =>
        state.xMilli + cfg.radiusMilli > r.xMilli &&
        state.xMilli - cfg.radiusMilli < r.xMilli + r.wMilli,
    )
  ) {
    state.status = "failed";
    state.failure = "TRAFFIC_COLLISION";
  }
}
export function createRiverState(seed: string): RiverState {
  const rng = createRng(`${seed}:river1`),
    lanes: RiverLane[] = [];
  for (let row = 0; row < RIVER_DASH_V1.rows; row++) {
    const kind =
      row === 0 || row === 5 || row === 10
        ? "safe"
        : row < 5
          ? "river"
          : "road";
    lanes.push({
      kind,
      direction: rng.nextInt(2) ? 1 : -1,
      speedMilli:
        kind === "safe"
          ? 0
          : (kind === "river" ? 20 + rng.nextInt(15) : 34 + rng.nextInt(25)) *
            1000,
      lengthMilli:
        kind === "safe"
          ? 0
          : (kind === "river" ? 104 + rng.nextInt(48) : 38 + rng.nextInt(28)) *
            1000,
      gapMilli:
        kind === "safe"
          ? 0
          : (kind === "river" ? 24 + rng.nextInt(28) : 92 + rng.nextInt(42)) *
            1000,
      phaseMilli: rng.nextInt(260) * 1000,
      offsetMilli: 0,
      remainder: 0,
    });
  }
  return {
    tick: 0,
    status: "running",
    failure: null,
    score: 0,
    seed,
    xMilli: 180000,
    row: 10,
    crossings: 0,
    lanes,
    lastMoveTick: -RIVER_DASH_V1.inputCooldownTicks,
    lastCrossTick: -100,
  };
}
export function stepRiver(state: RiverState) {
  state.tick++;
  const cfg = RIVER_DASH_V1,
    lane = state.lanes[state.row],
    carried = lane.kind === "river" && riverSupported(state);
  if (lane.kind === "river" && !carried) {
    evaluate(state);
    return;
  }
  const scale = Math.min(
    cfg.maximumSpeedPermille,
    1000 + state.crossings * cfg.speedIncreasePerCrossingPermille,
  );
  state.lanes.forEach((l, row) => {
    if (l.kind === "safe") return;
    l.remainder += l.speedMilli * scale;
    const delta = Math.floor(l.remainder / (cfg.tickRate * 1000)) * l.direction;
    l.remainder %= cfg.tickRate * 1000;
    l.offsetMilli = mod(l.offsetMilli + delta, l.lengthMilli + l.gapMilli);
    if (carried && row === state.row) state.xMilli += delta;
  });
  evaluate(state);
}
export function canMoveRiver(state: RiverState, action: string) {
  if (
    state.status !== "running" ||
    state.tick - state.lastMoveTick < RIVER_DASH_V1.inputCooldownTicks
  )
    return false;
  if (action === "UP") return state.row > 0;
  if (action === "DOWN") return state.row < 10;
  if (action === "LEFT")
    return state.xMilli - RIVER_DASH_V1.cellMilli >= RIVER_DASH_V1.radiusMilli;
  if (action === "RIGHT")
    return (
      state.xMilli + RIVER_DASH_V1.cellMilli <=
      RIVER_DASH_V1.widthMilli - RIVER_DASH_V1.radiusMilli
    );
  return false;
}
export function moveRiver(state: RiverState, action: string) {
  state.lastMoveTick = state.tick;
  if (action === "UP") state.row--;
  if (action === "DOWN") state.row++;
  if (action === "LEFT") state.xMilli -= RIVER_DASH_V1.cellMilli;
  if (action === "RIGHT") state.xMilli += RIVER_DASH_V1.cellMilli;
  if (state.row === 0) {
    state.crossings++;
    state.score +=
      RIVER_DASH_V1.baseCrossingPoints +
      state.crossings * RIVER_DASH_V1.crossingBonus;
    state.lastCrossTick = state.tick;
    state.row = 10;
    state.xMilli = 180000;
  }
  evaluate(state);
}
export const RIVER_DASH_CORE: GameCore<RiverState> = {
  gameId: "river-dash",
  gameVersion: "1.0.0",
  width: 390,
  height: 620,
  tickRate: 120,
  maxFinalTick: RIVER_DASH_V1.maxFinalTick,
  maxInputs: RIVER_DASH_V1.maxInputs,
  inputVersion: 1,
  actions: RIVER_ACTIONS,
  content: {
    rules: RIVER_DASH_V1,
    generation: "SEEDED_RIVER1_LANES",
    motion: "INTEGRATED_PHASE_NO_RETROACTIVE_SPEED_MULTIPLICATION",
    carry: "TICKS_ONLY_FULL_SUPPORT",
    inputs: "RELATIVE_POSITION_WITH_NO_COLUMN_SNAP",
    traffic: "REGULAR_LENGTH_PLUS_GAP_TILING",
  },
  create: createRiverState,
  step: stepRiver,
  canApply: canMoveRiver,
  apply: moveRiver,
};
