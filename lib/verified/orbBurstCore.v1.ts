/** Bubble-grid mechanics inspired by sausi-7/games (MIT). Original versioned fixed-point core. */
import { createRng } from "../deterministic/seeded";
import {
  integerSqrt,
  roundDiv,
  sinPhaseMilli,
} from "../deterministic/integerMath";
import type { CoreState, GameCore } from "./coreRuntime.v1";
import { ORB_ACTIONS, ORB_AIM_COUNT } from "./orbBurstProtocol.v1";

export const ORB_RULES = {
  width: 390,
  height: 620,
  cols: 9,
  radiusMilli: 18000,
  rowHeightMilli: 31000,
  shooterXMilli: 195000,
  shooterYMilli: 574000,
  tickRate: 120,
  shotSpeedMilli: 440000,
  stageSpeedMilli: 15000,
  maximumSpeedMilli: 620000,
  collisionDistanceMilli: 34560,
  dangerYMilli: 502000,
  settleTicks: 18,
  maxFinalTick: 120 * 60 * 6,
  maxInputs: 4000,
  removedPoints: 280,
  extraRemovedPoints: 90,
  sectorSweepRemaining: 3,
  initialColors: 3,
  maximumColors: 5,
  initialRows: 4,
  maximumRows: 6,
  initialMisses: 6,
  minimumMisses: 4,
  idlePressureTicks: 120 * 45,
} as const;
export type OrbBubble = { row: number; col: number; color: number };
type Shot = {
  xMilli: number;
  yMilli: number;
  vxMilli: number;
  vyMilli: number;
  xRemainder: number;
  yRemainder: number;
  color: number;
};
export type OrbState = CoreState & {
  seed: string;
  stage: number;
  boardRevision: number;
  bubbles: OrbBubble[];
  aimIndex: number;
  shot: Shot | null;
  shotOrdinal: number;
  currentColor: number;
  nextColor: number;
  misses: number;
  pressureRows: number;
  settleRemaining: number;
  lastLaunchTick: number;
  lastPressureTick: number;
  lastStageTick: number;
  lastLanding: { row: number; col: number; tick: number } | null;
  burst: { tick: number; bubbles: OrbBubble[] } | null;
};
const key = (row: number, col: number) => `${row},${col}`;
export function orbCenter(row: number, col: number) {
  return {
    xMilli: 26000 + (row % 2 ? 18000 : 0) + col * 38000,
    yMilli: 42000 + row * ORB_RULES.rowHeightMilli,
  };
}
export function orbNeighbors(row: number, col: number) {
  const shift = row % 2 ? 1 : -1;
  return [
    [row, col - 1],
    [row, col + 1],
    [row - 1, col],
    [row - 1, col + shift],
    [row + 1, col],
    [row + 1, col + shift],
  ]
    .filter(([r, c]) => r >= 0 && c >= 0 && c < ORB_RULES.cols)
    .map(([row, col]) => ({ row, col }));
}
export function orbDirection(aimIndex: number) {
  const phase = 2192 + aimIndex * 20,
    x = sinPhaseMilli(phase + 1024),
    y = sinPhaseMilli(phase);
  const length = integerSqrt(x * x + y * y);
  return { x, y, length };
}
export const orbPaletteSize = (stage: number) =>
  Math.min(
    ORB_RULES.maximumColors,
    ORB_RULES.initialColors + Math.floor(stage / 2),
  );
export const orbMissLimit = (stage: number) =>
  Math.max(
    ORB_RULES.minimumMisses,
    ORB_RULES.initialMisses - Math.floor(stage / 2),
  );
function ammunition(seed: string, ordinal: number, stage: number) {
  const count = orbPaletteSize(stage),
    bag = Math.floor(ordinal / count),
    rng = createRng(`${seed}:orb1:ammo:${stage}:${bag}`);
  const colors = Array.from({ length: count }, (_, i) => i);
  for (let i = count - 1; i > 0; i--) {
    const next = rng.nextInt(i + 1);
    [colors[i], colors[next]] = [colors[next], colors[i]];
  }
  return colors[ordinal % count];
}
function board(seed: string, stage: number): OrbBubble[] {
  const rng = createRng(`${seed}:orb1:board:${stage}`),
    colors = orbPaletteSize(stage);
  const rows = Math.min(
      ORB_RULES.maximumRows,
      ORB_RULES.initialRows + Math.floor(stage / 2),
    ),
    bubbles: OrbBubble[] = [];
  for (let row = 0; row < rows; row++) {
    const shift = rng.nextInt(colors);
    for (let col = 0; col < ORB_RULES.cols; col++) {
      if (stage > 1 && row >= 3 && rng.nextInt(9) === 0) continue;
      const color =
        stage < 2
          ? (shift + Math.floor(col / 3)) % colors
          : rng.nextInt(colors);
      bubbles.push({ row, col, color });
    }
  }
  return bubbles;
}
function cluster(start: OrbBubble, bubbles: OrbBubble[]) {
  const map = new Map(bubbles.map((b) => [key(b.row, b.col), b])),
    visited = new Set<string>(),
    found: OrbBubble[] = [],
    queue = [start];
  for (let i = 0; i < queue.length; i++) {
    const b = queue[i],
      id = key(b.row, b.col);
    if (visited.has(id)) continue;
    visited.add(id);
    const actual = map.get(id);
    if (!actual || actual.color !== start.color) continue;
    found.push(actual);
    for (const n of orbNeighbors(b.row, b.col))
      queue.push({ ...n, color: start.color });
  }
  return found;
}
function anchored(bubbles: OrbBubble[]) {
  const map = new Map(bubbles.map((b) => [key(b.row, b.col), b])),
    visited = new Set<string>(),
    queue = bubbles.filter((b) => b.row === 0);
  for (let i = 0; i < queue.length; i++) {
    const b = queue[i],
      id = key(b.row, b.col);
    if (visited.has(id) || !map.has(id)) continue;
    visited.add(id);
    for (const n of orbNeighbors(b.row, b.col)) {
      const next = map.get(key(n.row, n.col));
      if (next && !visited.has(key(n.row, n.col))) queue.push(next);
    }
  }
  return bubbles.filter((b) => visited.has(key(b.row, b.col)));
}
function distanceSquared(row: number, col: number, x: number, y: number) {
  const p = orbCenter(row, col);
  return (p.xMilli - x) ** 2 + (p.yMilli - y) ** 2;
}
function snap(state: OrbState, x: number, y: number) {
  const occupied = new Set(state.bubbles.map((b) => key(b.row, b.col)));
  let nearest = { row: 0, col: 0 },
    best = Number.MAX_SAFE_INTEGER;
  for (let row = 0; row < 18; row++)
    for (let col = 0; col < ORB_RULES.cols; col++) {
      const distance = distanceSquared(row, col, x, y);
      if (distance < best) {
        best = distance;
        nearest = { row, col };
      }
    }
  if (!occupied.has(key(nearest.row, nearest.col))) return nearest;
  return (
    orbNeighbors(nearest.row, nearest.col)
      .filter((n) => !occupied.has(key(n.row, n.col)))
      .sort(
        (a, b) =>
          distanceSquared(a.row, a.col, x, y) -
            distanceSquared(b.row, b.col, x, y) ||
          a.row - b.row ||
          a.col - b.col,
      )[0] ?? null
  );
}
function pressure(state: OrbState) {
  state.pressureRows++;
  state.lastPressureTick = state.tick;
  state.misses = 0;
  state.bubbles = state.bubbles.map((b) => ({ ...b, row: b.row + 1 }));
  const rng = createRng(
    `${state.seed}:orb1:pressure:${state.stage}:${state.pressureRows}`,
  );
  const colors = orbPaletteSize(state.stage);
  for (let col = 0; col < ORB_RULES.cols; col++)
    state.bubbles.push({ row: 0, col, color: rng.nextInt(colors) });
  state.boardRevision++;
  if (
    state.bubbles.some(
      (b) => orbCenter(b.row, b.col).yMilli >= ORB_RULES.dangerYMilli,
    )
  ) {
    state.status = "failed";
    state.failure = "BOARD_OVERFLOW";
  }
}
function settle(state: OrbState, shot: Shot) {
  const cell = snap(state, shot.xMilli, shot.yMilli);
  if (!cell) {
    state.status = "failed";
    state.failure = "BOARD_BLOCKED";
    return;
  }
  const placed = { ...cell, color: shot.color };
  state.bubbles.push(placed);
  state.lastLanding = { ...cell, tick: state.tick };
  const matches = cluster(placed, state.bubbles);
  if (matches.length >= 3) {
    const remove = new Set(matches.map((b) => key(b.row, b.col))),
      before = state.bubbles;
    state.bubbles = anchored(
      state.bubbles.filter((b) => !remove.has(key(b.row, b.col))),
    );
    if (state.bubbles.length <= ORB_RULES.sectorSweepRemaining)
      state.bubbles = [];
    const remaining = new Set(state.bubbles.map((b) => key(b.row, b.col))),
      removed = before.filter((b) => !remaining.has(key(b.row, b.col)));
    state.score +=
      removed.length * ORB_RULES.removedPoints +
      Math.max(0, removed.length - 3) * ORB_RULES.extraRemovedPoints;
    state.burst = { tick: state.tick, bubbles: removed };
    state.misses = 0;
    if (!state.bubbles.length) {
      state.stage++;
      state.lastStageTick = state.tick;
      state.bubbles = board(state.seed, state.stage);
      state.lastPressureTick = state.tick;
    }
  } else {
    state.misses++;
    if (state.misses >= orbMissLimit(state.stage)) pressure(state);
  }
  state.boardRevision++;
  if (
    state.bubbles.some(
      (b) => orbCenter(b.row, b.col).yMilli >= ORB_RULES.dangerYMilli,
    )
  ) {
    state.status = "failed";
    state.failure = "BOARD_OVERFLOW";
  }
  state.shotOrdinal++;
  state.currentColor = ammunition(state.seed, state.shotOrdinal, state.stage);
  state.nextColor = ammunition(state.seed, state.shotOrdinal + 1, state.stage);
  state.settleRemaining = ORB_RULES.settleTicks;
}
export function createOrbState(seed: string): OrbState {
  return {
    tick: 0,
    status: "running",
    failure: null,
    score: 0,
    seed,
    stage: 0,
    boardRevision: 0,
    bubbles: board(seed, 0),
    aimIndex: 44,
    shot: null,
    shotOrdinal: 0,
    currentColor: ammunition(seed, 0, 0),
    nextColor: ammunition(seed, 1, 0),
    misses: 0,
    pressureRows: 0,
    settleRemaining: 0,
    lastLaunchTick: 0,
    lastPressureTick: 0,
    lastStageTick: -100,
    lastLanding: null,
    burst: null,
  };
}
export function canApplyOrb(state: OrbState, action: string) {
  if (state.status !== "running" || state.shot || state.settleRemaining > 0)
    return false;
  if (action === "SHOOT") return true;
  if (action === "AIM_LEFT") return state.aimIndex > 0;
  if (action === "AIM_RIGHT") return state.aimIndex < ORB_AIM_COUNT - 1;
  const index = ORB_ACTIONS.indexOf(action);
  return index >= 0 && index < ORB_AIM_COUNT && index !== state.aimIndex;
}
export function applyOrb(state: OrbState, action: string) {
  if (action === "AIM_LEFT") {
    state.aimIndex--;
    return;
  }
  if (action === "AIM_RIGHT") {
    state.aimIndex++;
    return;
  }
  if (action !== "SHOOT") {
    state.aimIndex = ORB_ACTIONS.indexOf(action);
    return;
  }
  const direction = orbDirection(state.aimIndex),
    speed = Math.min(
      ORB_RULES.maximumSpeedMilli,
      ORB_RULES.shotSpeedMilli + state.stage * ORB_RULES.stageSpeedMilli,
    );
  state.shot = {
    xMilli: ORB_RULES.shooterXMilli,
    yMilli: ORB_RULES.shooterYMilli,
    vxMilli: roundDiv(direction.x * speed, direction.length),
    vyMilli: roundDiv(direction.y * speed, direction.length),
    xRemainder: 0,
    yRemainder: 0,
    color: state.currentColor,
  };
  state.lastLaunchTick = state.tick;
}
export function stepOrb(state: OrbState) {
  state.tick++;
  if (state.settleRemaining > 0) state.settleRemaining--;
  const shot = state.shot;
  if (!shot) {
    if (
      state.settleRemaining === 0 &&
      state.tick - Math.max(state.lastLaunchTick, state.lastPressureTick) >=
        ORB_RULES.idlePressureTicks
    )
      pressure(state);
    return;
  }
  shot.xRemainder += shot.vxMilli;
  shot.yRemainder += shot.vyMilli;
  const dx = Math.trunc(shot.xRemainder / ORB_RULES.tickRate),
    dy = Math.trunc(shot.yRemainder / ORB_RULES.tickRate);
  shot.xRemainder -= dx * ORB_RULES.tickRate;
  shot.yRemainder -= dy * ORB_RULES.tickRate;
  shot.xMilli += dx;
  shot.yMilli += dy;
  if (shot.xMilli <= ORB_RULES.radiusMilli && shot.vxMilli < 0) {
    shot.xMilli = ORB_RULES.radiusMilli;
    shot.vxMilli = -shot.vxMilli;
    shot.xRemainder = 0;
  }
  if (
    shot.xMilli >= ORB_RULES.width * 1000 - ORB_RULES.radiusMilli &&
    shot.vxMilli > 0
  ) {
    shot.xMilli = ORB_RULES.width * 1000 - ORB_RULES.radiusMilli;
    shot.vxMilli = -shot.vxMilli;
    shot.xRemainder = 0;
  }
  const hit =
    shot.yMilli - ORB_RULES.radiusMilli <= 24000 ||
    state.bubbles.some(
      (b) =>
        distanceSquared(b.row, b.col, shot.xMilli, shot.yMilli) <=
        ORB_RULES.collisionDistanceMilli ** 2,
    );
  if (hit) {
    state.shot = null;
    settle(state, shot);
  }
}
export function copyOrbState(state: OrbState): OrbState {
  return {
    ...state,
    bubbles: state.bubbles.map((b) => ({ ...b })),
    shot: state.shot ? { ...state.shot } : null,
    burst: state.burst
      ? {
          tick: state.burst.tick,
          bubbles: state.burst.bubbles.map((b) => ({ ...b })),
        }
      : null,
    lastLanding: state.lastLanding ? { ...state.lastLanding } : null,
  };
}
/** Read-only physics forecast for presentation/tests; no second physics implementation. */
export function forecastOrb(state: OrbState, aimIndex = state.aimIndex) {
  if (!Number.isInteger(aimIndex) || aimIndex < 0 || aimIndex >= ORB_AIM_COUNT)
    throw new RangeError("INVALID_AIM");
  const copy = copyOrbState(state);
  copy.aimIndex = aimIndex;
  const points: { xMilli: number; yMilli: number }[] = [];
  if (!canApplyOrb(copy, "SHOOT")) return { state: copy, points };
  applyOrb(copy, "SHOOT");
  for (let i = 0; i < 720 && copy.status === "running" && copy.shot; i++) {
    if (i % 8 === 0)
      points.push({ xMilli: copy.shot.xMilli, yMilli: copy.shot.yMilli });
    stepOrb(copy);
  }
  return { state: copy, points };
}
export const ORB_BURST_CORE: GameCore<OrbState> = {
  gameId: "orb-burst",
  gameVersion: "1.0.0",
  width: 390,
  height: 620,
  tickRate: 120,
  maxFinalTick: ORB_RULES.maxFinalTick,
  maxInputs: ORB_RULES.maxInputs,
  inputVersion: 1,
  actions: ORB_ACTIONS,
  content: {
    rules: ORB_RULES,
    generation: "orb1:board,ammo,pressure:stage:index",
    aimPhase: { first: 2192, step: 20, count: ORB_AIM_COUNT },
    matching: "HEX_GRID_MATCH3_FLOATING_CLUSTERS",
    palette: "3_TO_5",
    pressure: "6_TO_4_MISSES_AND_45_SECOND_IDLE",
  },
  create: createOrbState,
  step: stepOrb,
  canApply: canApplyOrb,
  apply: applyOrb,
};
