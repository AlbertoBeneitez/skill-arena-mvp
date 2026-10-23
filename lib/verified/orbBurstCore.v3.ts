/** V3: five colours, asteroids (never match), bombs and a limited SWAP choice. V3 is frozen. */
import { createRng } from "../deterministic/seeded";
import { roundDiv } from "../deterministic/integerMath";
import type { CoreState, GameCore } from "./coreRuntime.v1";
import {
  createOrbState as createArchivedOrbState,
  orbCenter as archivedOrbCenter,
  orbNeighbors as archivedOrbNeighbors,
  orbDirection,
} from "./orbBurstCore.v1";
import { ORB_AIM_COUNT } from "./orbBurstProtocol.v1";
import { ORB_ACTIONS_V3 as ORB_ACTIONS } from "./orbBurstProtocol.v3";

export const ORB_V3_RULES = {
  width: 390,
  height: 620,
  cols: 9,
  radiusMilli: 18000,
  rowHeightMilli: 31000,
  shooterXMilli: 195000,
  shooterYMilli: 574000,
  tickRate: 120,
  shotSpeedMilli: 440000,
  collisionDistanceMilli: 34560,
  dangerYMilli: 502000,
  settleTicks: 18,
  maxFinalTick: 120 * 60 * 6,
  maxInputs: 4000,
  sourceRows: 12,
  sourceGoal: 108,
  supplyOccupancy: 27,
  pressureProgress: 54,
  initialColors: 3,
  maximumColors: 5,
  asteroid: 5,
  bomb: 6,
  bombEvery: 6,
  initialSwaps: 3,
  maxSwaps: 5,
  swapReward: 6,
  initialRows: 4,
  initialMisses: 4,
  minimumMisses: 3,
  idlePressureTicks: 120 * 45,
} as const;
export type OrbV3Bubble = {
  row: number;
  col: number;
  color: number;
  id: string;
  origin: "source" | "shot" | "pressure";
};
type Shot = {
  xMilli: number;
  yMilli: number;
  vxMilli: number;
  vyMilli: number;
  xRemainder: number;
  yRemainder: number;
  color: number;
};
export type OrbV3State = CoreState & {
  seed: string;
  gridParity: 0 | 1;
  sourceCursor: number;
  removedSourceIds: string[];
  height: number;
  boardRevision: number;
  bubbles: OrbV3Bubble[];
  aimIndex: number;
  shot: Shot | null;
  shotOrdinal: number;
  currentColor: number;
  nextColor: number;
  misses: number;
  swaps: number;
  pressureRows: number;
  settleRemaining: number;
  lastLaunchTick: number;
  lastPressureTick: number;
  lastInsertionTick: number;
  lastLanding: {
    row: number;
    col: number;
    tick: number;
    xMilli: number;
    yMilli: number;
    gridParity: 0 | 1;
  } | null;
  burst: {
    tick: number;
    bubbles: (OrbV3Bubble & { xMilli: number; yMilli: number })[];
  } | null;
};
const key = (row: number, col: number) => `${row},${col}`;
export function orbCenterV3(
  state: Pick<OrbV3State, "gridParity">,
  row: number,
  col: number,
) {
  const p = archivedOrbCenter(row + state.gridParity, col);
  return {
    xMilli: p.xMilli,
    yMilli: p.yMilli - state.gridParity * ORB_V3_RULES.rowHeightMilli,
  };
}
export function orbNeighborsV3(
  state: Pick<OrbV3State, "gridParity">,
  row: number,
  col: number,
) {
  return archivedOrbNeighbors(row + state.gridParity, col)
    .map((n) => ({ row: n.row - state.gridParity, col: n.col }))
    .filter((n) => n.row >= 0);
}
export function orbMissLimitV3(state: Pick<OrbV3State, "height">) {
  return state.height >= ORB_V3_RULES.pressureProgress
    ? ORB_V3_RULES.minimumMisses
    : ORB_V3_RULES.initialMisses;
}
export function orbSourceRowV3(seed: string, ordinal: number): OrbV3Bubble[] {
  if (
    !Number.isSafeInteger(ordinal) ||
    ordinal < 4 ||
    ordinal >= ORB_V3_RULES.sourceRows
  )
    throw new RangeError("INVALID_SOURCE_ROW");
  const rng = createRng(`${seed}:orb3:source:${ordinal}`),
    palette = ordinal < 6 ? 3 : ordinal < 9 ? 4 : 5;
  const colors = Array.from({ length: palette }, (_, i) => i);
  for (let i = colors.length - 1; i > 0; i--) {
    const n = rng.nextInt(i + 1);
    [colors[i], colors[n]] = [colors[n], colors[i]];
  }
  const offset = rng.nextInt(9),
    stone = ordinal >= 6 ? rng.nextInt(9) : -1;
  return Array.from({ length: 9 }, (_, col) => ({
    row: 0,
    col,
    color:
      col === stone
        ? ORB_V3_RULES.asteroid
        : colors[
            Math.min(
              palette - 1,
              Math.floor(((col + offset) % 9) / (palette === 3 ? 3 : 2)),
            )
          ],
    id: `source:${ordinal}:${col}`,
    origin: "source",
  }));
}
function availableColors(state: OrbV3State) {
  return [
    ...new Set(
      state.bubbles.map((b) => b.color).filter((c) => c < ORB_V3_RULES.asteroid),
    ),
  ].sort((a, b) => a - b);
}
function ammunition(state: OrbV3State) {
  if ((state.shotOrdinal + 1) % ORB_V3_RULES.bombEvery === ORB_V3_RULES.bombEvery - 1)
    return ORB_V3_RULES.bomb;
  const colors = availableColors(state);
  if (!colors.length) return state.nextColor;
  return colors[
    createRng(`${state.seed}:orb3:ammo:${state.shotOrdinal}`).nextInt(
      colors.length,
    )
  ];
}
function cluster(
  state: OrbV3State,
  start: OrbV3Bubble,
  bubbles: OrbV3Bubble[],
) {
  const map = new Map(bubbles.map((b) => [key(b.row, b.col), b])),
    visited = new Set<string>(),
    found: OrbV3Bubble[] = [],
    queue = [start];
  for (let i = 0; i < queue.length; i++) {
    const b = queue[i],
      id = key(b.row, b.col);
    if (visited.has(id)) continue;
    visited.add(id);
    const actual = map.get(id);
    if (!actual || actual.color !== start.color) continue;
    found.push(actual);
    for (const n of orbNeighborsV3(state, b.row, b.col))
      queue.push({ ...start, ...n });
  }
  return found;
}
function anchored(state: OrbV3State, bubbles: OrbV3Bubble[]) {
  const map = new Map(bubbles.map((b) => [key(b.row, b.col), b])),
    visited = new Set<string>(),
    queue = bubbles.filter((b) => b.row === 0);
  for (let i = 0; i < queue.length; i++) {
    const b = queue[i],
      id = key(b.row, b.col);
    if (visited.has(id) || !map.has(id)) continue;
    visited.add(id);
    for (const n of orbNeighborsV3(state, b.row, b.col)) {
      const next = map.get(key(n.row, n.col));
      if (next && !visited.has(key(n.row, n.col))) queue.push(next);
    }
  }
  return bubbles.filter((b) => visited.has(key(b.row, b.col)));
}
function distanceSquared(
  state: OrbV3State,
  row: number,
  col: number,
  x: number,
  y: number,
) {
  const p = orbCenterV3(state, row, col);
  return (p.xMilli - x) ** 2 + (p.yMilli - y) ** 2;
}
function snap(state: OrbV3State, x: number, y: number) {
  const occupied = new Set(state.bubbles.map((b) => key(b.row, b.col)));
  let nearest = { row: 0, col: 0 },
    best = Number.MAX_SAFE_INTEGER;
  for (let row = 0; row < 18; row++)
    for (let col = 0; col < ORB_V3_RULES.cols; col++) {
      const distance = distanceSquared(state, row, col, x, y);
      if (distance < best) {
        best = distance;
        nearest = { row, col };
      }
    }
  if (!occupied.has(key(nearest.row, nearest.col))) return nearest;
  return (
    orbNeighborsV3(state, nearest.row, nearest.col)
      .filter((n) => !occupied.has(key(n.row, n.col)))
      .sort(
        (a, b) =>
          distanceSquared(state, a.row, a.col, x, y) -
            distanceSquared(state, b.row, b.col, x, y) ||
          a.row - b.row ||
          a.col - b.col,
      )[0] ?? null
  );
}
function overflow(state: OrbV3State) {
  if (
    state.bubbles.some(
      (b) =>
        orbCenterV3(state, b.row, b.col).yMilli >= ORB_V3_RULES.dangerYMilli,
    )
  ) {
    state.status = "failed";
    state.failure = "BOARD_OVERFLOW";
  }
}
function insertRow(state: OrbV3State, row: OrbV3Bubble[]) {
  // The parity toggle cancels the row shift in X; every existing neighbor relation survives.
  state.bubbles = state.bubbles.map((b) => ({ ...b, row: b.row + 1 }));
  state.gridParity = state.gridParity ? 0 : 1;
  state.bubbles.push(...row);
  state.lastInsertionTick = state.tick;
  state.settleRemaining = ORB_V3_RULES.settleTicks;
  state.boardRevision++;
  overflow(state);
}
function pressure(state: OrbV3State) {
  state.pressureRows++;
  state.lastPressureTick = state.tick;
  state.misses = 0;
  const colors = availableColors(state),
    rng = createRng(`${state.seed}:orb3:pressure:${state.pressureRows}`);
  insertRow(
    state,
    Array.from({ length: 9 }, (_, col) => ({
      row: 0,
      col,
      color: colors.length
        ? colors[rng.nextInt(colors.length)]
        : state.currentColor,
      id: `pressure:${state.pressureRows}:${col}`,
      origin: "pressure",
    })),
  );
}
function settle(state: OrbV3State, shot: Shot) {
  const cell = snap(state, shot.xMilli, shot.yMilli);
  if (!cell) {
    state.status = "failed";
    state.failure = "BOARD_BLOCKED";
    return;
  }
  const placed: OrbV3Bubble = {
    ...cell,
    color: shot.color,
    id: `shot:${state.shotOrdinal}`,
    origin: "shot",
  };
  state.bubbles.push(placed);
  state.lastLanding = {
    ...cell,
    tick: state.tick,
    ...orbCenterV3(state, cell.row, cell.col),
    gridParity: state.gridParity,
  };
  const bomb = shot.color === ORB_V3_RULES.bomb,
    matches = bomb
      ? state.bubbles.filter(
          (b) =>
            (b.row === placed.row && b.col === placed.col) ||
            orbNeighborsV3(state, placed.row, placed.col).some(
              (n) => n.row === b.row && n.col === b.col,
            ),
        )
      : cluster(state, placed, state.bubbles),
    pressureBefore = state.pressureRows;
  if (matches.length >= 3 || bomb) {
    const remove = new Set(matches.map((b) => key(b.row, b.col))),
      before = state.bubbles;
    state.bubbles = anchored(
      state,
      state.bubbles.filter((b) => !remove.has(key(b.row, b.col))),
    );
    const remaining = new Set(state.bubbles.map((b) => key(b.row, b.col))),
      removed = before.filter((b) => !remaining.has(key(b.row, b.col)));
    const credited = new Set(state.removedSourceIds);
    for (const b of removed)
      if (b.origin === "source" && !credited.has(b.id)) {
        state.removedSourceIds.push(b.id);
        credited.add(b.id);
      }
    state.height = state.score = state.removedSourceIds.length;
    state.burst = {
      tick: state.tick,
      bubbles: removed.map((b) => ({
        ...b,
        ...orbCenterV3(state, b.row, b.col),
      })),
    };
    state.misses = 0;
    if (removed.length >= ORB_V3_RULES.swapReward)
      state.swaps = Math.min(ORB_V3_RULES.maxSwaps, state.swaps + 1);
  } else {
    state.misses++;
    if (state.misses >= orbMissLimitV3(state)) pressure(state);
  }
  // A natural goal resolves before supply; a pressure descent excludes an extra source descent.
  if (state.height >= ORB_V3_RULES.sourceGoal) {
    state.status = "won";
    state.failure = null;
  }
  // Source supply merges one row; pressure never consumes/credits the source cursor.
  if (
    state.status === "running" &&
    state.pressureRows === pressureBefore &&
    state.bubbles.length <= ORB_V3_RULES.supplyOccupancy &&
    state.sourceCursor < 12
  ) {
    insertRow(state, orbSourceRowV3(state.seed, state.sourceCursor));
    state.sourceCursor++;
  }
  state.boardRevision++;
  if (state.status === "running") overflow(state);
  state.shotOrdinal++;
  state.currentColor = state.nextColor;
  state.nextColor = ammunition(state);
  state.settleRemaining = ORB_V3_RULES.settleTicks;
}
export function createOrbV3State(seed: string): OrbV3State {
  const old = createArchivedOrbState(seed);
  return {
    tick: 0,
    status: "running",
    failure: null,
    score: 0,
    height: 0,
    seed,
    gridParity: 0,
    sourceCursor: 4,
    removedSourceIds: [],
    boardRevision: 0,
    bubbles: old.bubbles.map((b) => ({
      ...b,
      id: `source:${b.row}:${b.col}`,
      origin: "source",
    })),
    aimIndex: old.aimIndex,
    shot: null,
    shotOrdinal: 0,
    currentColor: old.currentColor,
    nextColor: old.nextColor,
    misses: 0,
    swaps: ORB_V3_RULES.initialSwaps,
    pressureRows: 0,
    settleRemaining: 0,
    lastLaunchTick: 0,
    lastPressureTick: 0,
    lastInsertionTick: -100,
    lastLanding: null,
    burst: null,
  };
}
export function canApplyOrbV3(state: OrbV3State, action: string) {
  if (state.status !== "running" || state.shot || state.settleRemaining > 0)
    return false;
  if (action === "SHOOT") return true;
  if (action === "SWAP")
    return state.swaps > 0 && state.currentColor !== state.nextColor;
  if (action === "AIM_LEFT") return state.aimIndex > 0;
  if (action === "AIM_RIGHT") return state.aimIndex < ORB_AIM_COUNT - 1;
  const index = ORB_ACTIONS.indexOf(action);
  return index >= 0 && index < ORB_AIM_COUNT && index !== state.aimIndex;
}
export function applyOrbV3(state: OrbV3State, action: string) {
  if (action === "SWAP") {
    [state.currentColor, state.nextColor] = [state.nextColor, state.currentColor];
    state.swaps--;
    return;
  }
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
    speed = ORB_V3_RULES.shotSpeedMilli;
  state.shot = {
    xMilli: ORB_V3_RULES.shooterXMilli,
    yMilli: ORB_V3_RULES.shooterYMilli,
    vxMilli: roundDiv(direction.x * speed, direction.length),
    vyMilli: roundDiv(direction.y * speed, direction.length),
    xRemainder: 0,
    yRemainder: 0,
    color: state.currentColor,
  };
  state.lastLaunchTick = state.tick;
}
export function stepOrbV3(state: OrbV3State) {
  state.tick++;
  if (state.settleRemaining > 0) state.settleRemaining--;
  const shot = state.shot;
  if (!shot) {
    if (
      state.settleRemaining === 0 &&
      state.tick - Math.max(state.lastLaunchTick, state.lastPressureTick) >=
        ORB_V3_RULES.idlePressureTicks
    )
      pressure(state);
    return;
  }
  shot.xRemainder += shot.vxMilli;
  shot.yRemainder += shot.vyMilli;
  const dx = Math.trunc(shot.xRemainder / ORB_V3_RULES.tickRate),
    dy = Math.trunc(shot.yRemainder / ORB_V3_RULES.tickRate);
  shot.xRemainder -= dx * ORB_V3_RULES.tickRate;
  shot.yRemainder -= dy * ORB_V3_RULES.tickRate;
  shot.xMilli += dx;
  shot.yMilli += dy;
  if (shot.xMilli <= ORB_V3_RULES.radiusMilli && shot.vxMilli < 0) {
    shot.xMilli = ORB_V3_RULES.radiusMilli;
    shot.vxMilli = -shot.vxMilli;
    shot.xRemainder = 0;
  }
  if (
    shot.xMilli >= ORB_V3_RULES.width * 1000 - ORB_V3_RULES.radiusMilli &&
    shot.vxMilli > 0
  ) {
    shot.xMilli = ORB_V3_RULES.width * 1000 - ORB_V3_RULES.radiusMilli;
    shot.vxMilli = -shot.vxMilli;
    shot.xRemainder = 0;
  }
  const hit =
    shot.yMilli - ORB_V3_RULES.radiusMilli <= 24000 ||
    state.bubbles.some(
      (b) =>
        distanceSquared(state, b.row, b.col, shot.xMilli, shot.yMilli) <=
        ORB_V3_RULES.collisionDistanceMilli ** 2,
    );
  if (hit) {
    state.shot = null;
    settle(state, shot);
  }
}
export function copyOrbV3State(state: OrbV3State): OrbV3State {
  return {
    ...state,
    removedSourceIds: [...state.removedSourceIds],
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
export function forecastOrbV3(state: OrbV3State, aimIndex = state.aimIndex) {
  if (!Number.isInteger(aimIndex) || aimIndex < 0 || aimIndex >= ORB_AIM_COUNT)
    throw new RangeError("INVALID_AIM");
  const copy = copyOrbV3State(state);
  copy.aimIndex = aimIndex;
  const points: { xMilli: number; yMilli: number }[] = [];
  if (!canApplyOrbV3(copy, "SHOOT")) return { state: copy, points };
  applyOrbV3(copy, "SHOOT");
  for (
    let i = 0;
    i < 720 && copy.status === "running" && (copy.shot || copy.settleRemaining);
    i++
  ) {
    if (copy.shot && i % 8 === 0)
      points.push({ xMilli: copy.shot.xMilli, yMilli: copy.shot.yMilli });
    stepOrbV3(copy);
  }
  return { state: copy, points };
}
export const ORB_BURST_CORE_V3: GameCore<OrbV3State> = {
  gameId: "orb-burst",
  gameVersion: "3.0.0",
  width: 390,
  height: 620,
  tickRate: 120,
  maxFinalTick: ORB_V3_RULES.maxFinalTick,
  maxInputs: 4000,
  inputVersion: 3,
  actions: ORB_ACTIONS,
  content: {
    rules: ORB_V3_RULES,
    generation:
      "v1-opening;orb3-source-rows4..11;5-colours;asteroids-from-row6;bomb-every-6th-shot;visible-ammo-queue;swap-3..5;independent-pressure",
    aimPhase: { first: 2192, step: 20, count: 89 },
    matching: "V1_HEX_MATCH3_FLOATING_CLUSTERS_WITHOUT_SWEEP",
    supply:
      "one-row-per-settlement-at-occupancy<=27;preserve-source-ids-and-grid-parity;no-reset",
    progress:
      "108-originals-once-only;shots-and-pressure-zero;score=height;goal108",
    queue:
      "preserve-next;tail-selects-visible-colors;at-most-one-current-color-absent",
  },
  create: createOrbV3State,
  step: stepOrbV3,
  canApply: canApplyOrbV3,
  apply: applyOrbV3,
};
