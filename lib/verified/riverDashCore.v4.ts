/** Endless generated course; V1–V3 remain immutable. No client/renderer clocks. */
import { createRng } from "../deterministic/seeded";
import { RIVER_ACTIONS, RIVER_DASH_V1, riverLaneRects, type RiverLane } from "./riverDashCore.v1";
import type { CoreState, GameCore } from "./coreRuntime.v1";
export const RIVER_DASH_V4 = {
  inputCooldownTicks: 24,
  lookAhead: 12,
  openingRows: 8,
  maximumConsecutiveHazards: 2,
  maxFinalTick: RIVER_DASH_V1.maxFinalTick,
  maxInputs: RIVER_DASH_V1.maxInputs,
} as const;
export type RiverV4State = CoreState & {
  seed: string;
  xMilli: number;
  row: number;
  height: number;
  lanes: RiverLane[];
  lastMoveTick: number;
  lastAdvanceTick: number;
  fromRow: number;
  fromXMilli: number;
};
const mod = (n: number, period: number) => ((n % period) + period) % period;
/** Each row has a stable seed namespace and its own absolute traffic phase. */
function extendField(state: RiverV4State) {
  const opening = ["safe", "road", "safe", "river", "safe", "road", "safe", "river", "safe"] as const;
  for (let row = state.lanes.length; row <= state.row + RIVER_DASH_V4.lookAhead; row++) {
    const rng = createRng(`${state.seed}:river4:row:${row}`);
    let hazards = 0;
    for (let previous = row - 1; previous >= 0 && state.lanes[previous].kind !== "safe"; previous--) hazards++;
    const kind = row <= RIVER_DASH_V4.openingRows ? opening[row]
      : hazards >= 2 || (hazards > 0 && rng.nextInt(4) === 0) ? "safe"
      : rng.nextInt(2) ? "road" : "river";
    // Smooth saturation keeps distant rows playable rather than increasing speed without bound.
    const distance = Math.max(0, row - RIVER_DASH_V4.openingRows);
    const progress = Math.floor(120 * distance / (distance + 120));
    const novice = row <= RIVER_DASH_V4.openingRows;
    const direction = rng.nextInt(2) ? 1 : -1;
    const speedMilli = kind === "safe" ? 0 : kind === "road"
      ? novice ? 8000 : 14000 + progress * 450 + rng.nextInt(10001)
      : novice ? 6000 + rng.nextInt(1501) : 10000 + progress * 220 + rng.nextInt(8001);
    const lengthMilli = kind === "safe" ? 0 : kind === "road"
      ? novice ? 32000 : 40000 + progress * 300 + rng.nextInt(14001)
      : novice ? 300000 : 300000 - progress * 650 + rng.nextInt(24001);
    const gapMilli = kind === "safe" ? 0 : kind === "road"
      ? novice ? 280000 : 280000 - progress * 700 + rng.nextInt(24001)
      : novice ? 30000 : 34000 + progress * 260 + rng.nextInt(18001);
    const phaseMilli = kind === "safe" ? 0 : rng.nextInt(novice ? 10001 : lengthMilli + gapMilli);
    state.lanes.push({ kind, direction, speedMilli, lengthMilli, gapMilli, phaseMilli, offsetMilli: 0, remainder: 0 });
  }
}
/** Read-only geometry; offscreen traffic never pauses or depends on generation time. */
export function riverRectsV4(state: RiverV4State, row: number, tick = state.tick) {
  const lane = state.lanes[row];
  if (!lane || lane.kind === "safe") return [];
  const offsetMilli = mod(Math.floor(tick * lane.speedMilli / RIVER_DASH_V1.tickRate) * lane.direction, lane.lengthMilli + lane.gapMilli);
  return riverLaneRects({ seed: state.seed, tick, score: 0, status: "running", failure: null, xMilli: state.xMilli, row: 0, crossings: 0, lastMoveTick: 0, lastCrossTick: 0, lanes: [{ ...lane, offsetMilli }] }, 0);
}
export function riverSupportedV4(state: RiverV4State, tick = state.tick) {
  return riverRectsV4(state, state.row, tick).some(r => state.xMilli - RIVER_DASH_V1.radiusMilli >= r.xMilli && state.xMilli + RIVER_DASH_V1.radiusMilli <= r.xMilli + r.wMilli);
}
function fail(state: RiverV4State, reason: string) {
  state.status = "failed";
  state.failure = reason;
  state.score = state.height;
}
function evaluate(state: RiverV4State) {
  const cfg = RIVER_DASH_V1;
  if (state.xMilli < cfg.radiusMilli || state.xMilli > cfg.widthMilli - cfg.radiusMilli) return fail(state, "SWEPT_AWAY");
  const lane = state.lanes[state.row];
  if (lane.kind === "river" && !riverSupportedV4(state)) return fail(state, "RIVER_GAP");
  if (lane.kind === "road" && riverRectsV4(state, state.row).some(r => state.xMilli + cfg.radiusMilli > r.xMilli && state.xMilli - cfg.radiusMilli < r.xMilli + r.wMilli)) fail(state, "TRAFFIC_COLLISION");
}
export function createRiverStateV4(seed: string): RiverV4State {
  const state: RiverV4State = { seed, tick: 0, status: "running", failure: null, score: 0, xMilli: 180000, row: 0, height: 0, lanes: [], lastMoveTick: -24, lastAdvanceTick: -100, fromRow: 0, fromXMilli: 180000 };
  extendField(state);
  return state;
}
export function stepRiverV4(state: RiverV4State) {
  const lane = state.lanes[state.row];
  const supported = lane.kind === "river" && riverSupportedV4(state);
  const previousTick = state.tick++;
  if (lane.kind === "river" && !supported) return fail(state, "RIVER_GAP");
  if (supported) state.xMilli += (Math.floor(state.tick * lane.speedMilli / 120) - Math.floor(previousTick * lane.speedMilli / 120)) * lane.direction;
  evaluate(state);
  if (state.status === "running" && state.tick >= RIVER_DASH_V4.maxFinalTick) fail(state, "TIME_LIMIT");
}
export function canMoveRiverV4(state: RiverV4State, action: string) {
  if (state.status !== "running" || state.tick - state.lastMoveTick < RIVER_DASH_V4.inputCooldownTicks) return false;
  if (action === "UP") return true;
  if (action === "DOWN") return state.row > 0;
  if (action === "LEFT") return state.xMilli - 40000 >= 11000;
  if (action === "RIGHT") return state.xMilli + 40000 <= 349000;
  return false;
}
export function moveRiverV4(state: RiverV4State, action: string) {
  if (!canMoveRiverV4(state, action)) return;
  state.fromRow = state.row;
  state.fromXMilli = state.xMilli;
  state.lastMoveTick = state.tick;
  if (action === "UP") state.row++;
  else if (action === "DOWN") state.row--;
  else if (action === "LEFT") state.xMilli -= 40000;
  else if (action === "RIGHT") state.xMilli += 40000;
  extendField(state);
  evaluate(state);
  // No credit for a fatal arrival; revisiting rows cannot farm reach.
  if (state.status === "running" && state.row > state.height) {
    state.height = state.row;
    state.lastAdvanceTick = state.tick;
  }
}
export const RIVER_DASH_CORE_V4: GameCore<RiverV4State> = {
  gameId: "river-dash", gameVersion: "4.0.0", width: 390, height: 620, tickRate: 120,
  maxFinalTick: RIVER_DASH_V4.maxFinalTick, maxInputs: RIVER_DASH_V4.maxInputs,
  inputVersion: 4, actions: RIVER_ACTIONS,
  content: { rules: RIVER_DASH_V4, geometry: RIVER_DASH_V1, generation: "SEEDED_RIVER4_APPEND_ROWS_NO_FINISH", motion: "ABSOLUTE_INTEGER_TICK_PHASE_AND_FULL_SUPPORT_CARRY", scoring: "MAX_SAFE_REACH_PUBLISHED_ONLY_AT_TERMINAL", completion: "COLLISION_OR_BOUNDED_SIX_MINUTE_SESSION;NO_TARGET_OR_ROW_FINISH" },
  create: createRiverStateV4, step: stepRiverV4, canApply: canMoveRiverV4, apply: moveRiverV4,
};
