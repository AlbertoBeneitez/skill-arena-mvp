/** V5: harder pressure, next orb always ready (no settle lock), swap on a cooldown with no counter. V4 is frozen. */
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
import { ORB_ACTIONS_V5 as ORB_ACTIONS } from "./orbBurstProtocol.v5";

export const ORB_V5_RULES = {
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
  swapCooldownTicks: 300,
  maxFinalTick: 120 * 60 * 6,
  maxInputs: 4000,
  sourceRows: 12,
  sourceGoal: 108,
  supplyOccupancy: 33,
  pressureProgress: 54,
  initialColors: 4,
  maximumColors: 5,
  asteroid: 5,
  bomb: 6,
  rainbow: 7,
  lightning: 8,
  bombEvery: 9,
  rainbowEvery: 11,
  lightningEvery: 14,
  maxPower: 5,
  powerCost: { bomb: 2, lightning: 3, rainbow: 1 },
  phaseHeights: [18, 42, 68],
  initialRows: 4,
  initialMisses: 3,
  minimumMisses: 2,
  idlePressureTicks: 120 * 30,
} as const;
export type OrbV5Bubble = {
  row: number;
  col: number;
  color: number;
  id: string;
  origin: "source" | "shot" | "pressure";
  /** Frozen orbs cannot match; each neighbouring burst cracks them once. */
  ice?: number;
};
type Shot = {
  xMilli: number;
  yMilli: number;
  vxMilli: number;
  vyMilli: number;
  xRemainder: number;
  yRemainder: number;
  color: number;
  ordinal: number;
};
export type OrbV5State = CoreState & {
  seed: string;
  gridParity: 0 | 1;
  sourceCursor: number;
  removedSourceIds: string[];
  height: number;
  boardRevision: number;
  bubbles: OrbV5Bubble[];
  aimIndex: number;
  shot: Shot | null;
  shotOrdinal: number;
  currentColor: number;
  nextColor: number;
  misses: number;
  lastSwapTick: number;
  power: number;
  held: number;
  combo: number;
  points: number;
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
    bubbles: (OrbV5Bubble & { xMilli: number; yMilli: number })[];
  } | null;
};
const key = (row: number, col: number) => `${row},${col}`;
export function orbCenterV5(
  state: Pick<OrbV5State, "gridParity">,
  row: number,
  col: number,
) {
  const p = archivedOrbCenter(row + state.gridParity, col);
  return {
    xMilli: p.xMilli,
    yMilli: p.yMilli - state.gridParity * ORB_V5_RULES.rowHeightMilli,
  };
}
export function orbNeighborsV5(
  state: Pick<OrbV5State, "gridParity">,
  row: number,
  col: number,
) {
  return archivedOrbNeighbors(row + state.gridParity, col)
    .map((n) => ({ row: n.row - state.gridParity, col: n.col }))
    .filter((n) => n.row >= 0);
}
export function orbPhaseV5(state: Pick<OrbV5State, "height">) {
  return ORB_V5_RULES.phaseHeights.filter((h) => state.height >= h).length;
}
export function orbMissLimitV5(state: Pick<OrbV5State, "height">) {
  return [4, 3, 3, 2][orbPhaseV5(state)];
}
export function orbIdleTicksV5(state: Pick<OrbV5State, "height">) {
  return ORB_V5_RULES.idlePressureTicks - orbPhaseV5(state) * 120 * 4;
}
export function orbSourceRowV5(seed: string, ordinal: number): OrbV5Bubble[] {
  if (
    !Number.isSafeInteger(ordinal) ||
    ordinal < 4 ||
    ordinal >= ORB_V5_RULES.sourceRows
  )
    throw new RangeError("INVALID_SOURCE_ROW");
  const rng = createRng(`${seed}:orb5:source:${ordinal}`),
    palette = ordinal < 5 ? 4 : 5;
  const colors = Array.from({ length: palette }, (_, i) => i);
  for (let i = colors.length - 1; i > 0; i--) {
    const n = rng.nextInt(i + 1);
    [colors[i], colors[n]] = [colors[n], colors[i]];
  }
  const offset = rng.nextInt(9),
    stones = new Set<number>(),
    ices = new Map<number, number>();
  if (ordinal >= 5) stones.add(rng.nextInt(9));
  if (ordinal >= 7) stones.add(rng.nextInt(9));
  if (ordinal >= 10) stones.add(rng.nextInt(9));
  if (ordinal >= 6) {
    const c = rng.nextInt(9);
    if (!stones.has(c)) ices.set(c, ordinal >= 8 ? 2 : 1);
    if (ordinal >= 8) {
      const d = rng.nextInt(9);
      if (!stones.has(d) && !ices.has(d)) ices.set(d, 1);
    }
  }
  return Array.from({ length: 9 }, (_, col) => {
    const bubble: OrbV5Bubble = {
      row: 0,
      col,
      color: stones.has(col)
        ? ORB_V5_RULES.asteroid
        : colors[
            Math.min(
              palette - 1,
              Math.floor(((col + offset) % 9) / 2),
            )
          ],
      id: `source:${ordinal}:${col}`,
      origin: "source",
    };
    if (ices.has(col)) bubble.ice = ices.get(col)!;
    return bubble;
  });
}
function availableColors(state: OrbV5State) {
  return [
    ...new Set(
      state.bubbles.map((b) => b.color).filter((c) => c < ORB_V5_RULES.asteroid),
    ),
  ].sort((a, b) => a - b);
}
function ammunition(state: OrbV5State) {
  const n = state.shotOrdinal + 1;
  if (n % ORB_V5_RULES.bombEvery === ORB_V5_RULES.bombEvery - 1)
    return ORB_V5_RULES.bomb;
  if (n % ORB_V5_RULES.lightningEvery === ORB_V5_RULES.lightningEvery - 1)
    return ORB_V5_RULES.lightning;
  if (n % ORB_V5_RULES.rainbowEvery === ORB_V5_RULES.rainbowEvery - 1)
    return ORB_V5_RULES.rainbow;
  const colors = availableColors(state);
  if (!colors.length) return state.nextColor;
  return colors[
    createRng(`${state.seed}:orb5:ammo:${state.shotOrdinal}`).nextInt(
      colors.length,
    )
  ];
}
function cluster(
  state: OrbV5State,
  start: OrbV5Bubble,
  bubbles: OrbV5Bubble[],
) {
  const map = new Map(bubbles.map((b) => [key(b.row, b.col), b])),
    visited = new Set<string>(),
    found: OrbV5Bubble[] = [],
    queue = [start];
  for (let i = 0; i < queue.length; i++) {
    const b = queue[i],
      id = key(b.row, b.col);
    if (visited.has(id)) continue;
    visited.add(id);
    const actual = map.get(id);
    if (!actual || actual.color !== start.color || actual.ice) continue;
    found.push(actual);
    for (const n of orbNeighborsV5(state, b.row, b.col))
      queue.push({ ...start, ...n });
  }
  return found;
}
function anchored(state: OrbV5State, bubbles: OrbV5Bubble[]) {
  const map = new Map(bubbles.map((b) => [key(b.row, b.col), b])),
    visited = new Set<string>(),
    queue = bubbles.filter((b) => b.row === 0);
  for (let i = 0; i < queue.length; i++) {
    const b = queue[i],
      id = key(b.row, b.col);
    if (visited.has(id) || !map.has(id)) continue;
    visited.add(id);
    for (const n of orbNeighborsV5(state, b.row, b.col)) {
      const next = map.get(key(n.row, n.col));
      if (next && !visited.has(key(n.row, n.col))) queue.push(next);
    }
  }
  return bubbles.filter((b) => visited.has(key(b.row, b.col)));
}
function distanceSquared(
  state: OrbV5State,
  row: number,
  col: number,
  x: number,
  y: number,
) {
  const p = orbCenterV5(state, row, col);
  return (p.xMilli - x) ** 2 + (p.yMilli - y) ** 2;
}
function snap(state: OrbV5State, x: number, y: number) {
  const occupied = new Set(state.bubbles.map((b) => key(b.row, b.col)));
  let nearest = { row: 0, col: 0 },
    best = Number.MAX_SAFE_INTEGER;
  for (let row = 0; row < 18; row++)
    for (let col = 0; col < ORB_V5_RULES.cols; col++) {
      const distance = distanceSquared(state, row, col, x, y);
      if (distance < best) {
        best = distance;
        nearest = { row, col };
      }
    }
  if (!occupied.has(key(nearest.row, nearest.col))) return nearest;
  return (
    orbNeighborsV5(state, nearest.row, nearest.col)
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
function overflow(state: OrbV5State) {
  if (
    state.bubbles.some(
      (b) =>
        orbCenterV5(state, b.row, b.col).yMilli >= ORB_V5_RULES.dangerYMilli,
    )
  ) {
    state.status = "failed";
    state.failure = "BOARD_OVERFLOW";
  }
}
function insertRow(state: OrbV5State, row: OrbV5Bubble[]) {
  // The parity toggle cancels the row shift in X; every existing neighbor relation survives.
  state.bubbles = state.bubbles.map((b) => ({ ...b, row: b.row + 1 }));
  state.gridParity = state.gridParity ? 0 : 1;
  state.bubbles.push(...row);
  state.lastInsertionTick = state.tick;
  state.settleRemaining = ORB_V5_RULES.settleTicks;
  state.boardRevision++;
  overflow(state);
}
function pressure(state: OrbV5State) {
  state.pressureRows++;
  state.lastPressureTick = state.tick;
  state.misses = 0;
  const colors = availableColors(state),
    rng = createRng(`${state.seed}:orb5:pressure:${state.pressureRows}`);
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
function settle(state: OrbV5State, shot: Shot) {
  const cell = snap(state, shot.xMilli, shot.yMilli);
  if (!cell) {
    state.status = "failed";
    state.failure = "BOARD_BLOCKED";
    return;
  }
  const placed: OrbV5Bubble = {
    ...cell,
    color: shot.color,
    id: `shot:${shot.ordinal}`,
    origin: "shot",
  };
  state.bubbles.push(placed);
  state.lastLanding = {
    ...cell,
    tick: state.tick,
    ...orbCenterV5(state, cell.row, cell.col),
    gridParity: state.gridParity,
  };
  const special =
      shot.color === ORB_V5_RULES.bomb || shot.color === ORB_V5_RULES.lightning,
    pressureBefore = state.pressureRows;
  let matches: OrbV5Bubble[] = [];
  if (shot.color === ORB_V5_RULES.bomb) {
    const near = orbNeighborsV5(state, placed.row, placed.col);
    matches = state.bubbles.filter(
      (b) =>
        (b.row === placed.row && b.col === placed.col) ||
        near.some((n) => n.row === b.row && n.col === b.col),
    );
  } else if (shot.color === ORB_V5_RULES.lightning) {
    matches = state.bubbles.filter((b) => b.row === Math.max(1, placed.row));
  } else if (shot.color === ORB_V5_RULES.rainbow) {
    // The wild orb joins the neighbouring colour that makes the largest group (lowest colour on ties).
    const around = new Set(
      orbNeighborsV5(state, placed.row, placed.col)
        .map((n) => state.bubbles.find((b) => b.row === n.row && b.col === n.col))
        .filter((b): b is OrbV5Bubble => !!b && b.color < ORB_V5_RULES.asteroid && !b.ice)
        .map((b) => b.color),
    );
    let best: { color: number; group: OrbV5Bubble[] } | null = null;
    for (const color of [...around].sort((x, y) => x - y)) {
      placed.color = color;
      const group = cluster(state, placed, state.bubbles);
      if (!best || group.length > best.group.length) best = { color, group };
    }
    if (best) {
      placed.color = best.color;
      matches = best.group;
    } else placed.color = availableColors(state)[0] ?? 0;
  } else matches = cluster(state, placed, state.bubbles);
  if (matches.length >= 3 || special) {
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
        ...orbCenterV5(state, b.row, b.col),
      })),
    };
    state.misses = 0;
    // Ice next to anything that burst cracks once.
    const gone = removed.map((b) => b);
    for (const b of state.bubbles)
      if (b.ice && gone.some((g) => orbNeighborsV5(state, g.row, g.col).some((n) => n.row === b.row && n.col === b.col)))
        b.ice--;
    const fell = Math.max(0, removed.length - matches.length);
    state.combo++;
    state.points += removed.length * 10 + fell * 20 + (state.combo - 1) * 25;
    if (!special && (removed.length >= 6 || fell >= 4 || state.combo >= 4))
      state.power = Math.min(ORB_V5_RULES.maxPower, state.power + 1);
  } else {
    state.misses++;
    state.combo = 0;
    if (state.misses >= orbMissLimitV5(state)) pressure(state);
  }
  // A natural goal resolves before supply; a pressure descent excludes an extra source descent.
  if (state.height >= ORB_V5_RULES.sourceGoal) {
    state.status = "won";
    state.failure = null;
  }
  // Source supply merges one row; pressure never consumes/credits the source cursor.
  if (
    state.status === "running" &&
    state.pressureRows === pressureBefore &&
    state.bubbles.length <= ORB_V5_RULES.supplyOccupancy &&
    state.sourceCursor < 12
  ) {
    insertRow(state, orbSourceRowV5(state.seed, state.sourceCursor));
    state.sourceCursor++;
  }
  state.boardRevision++;
  if (state.status === "running") overflow(state);
  // The loaded orb was already advanced at launch; keep the queue honest about the board.
  keepQueueOnBoard(state);
}
function keepQueueOnBoard(state: OrbV5State) {
  const colors = availableColors(state);
  if (!colors.length) return;
  if (state.currentColor < ORB_V5_RULES.asteroid && !colors.includes(state.currentColor))
    state.currentColor = colors[createRng(`${state.seed}:orb5:cur:${state.shotOrdinal}`).nextInt(colors.length)];
  if (state.nextColor < ORB_V5_RULES.asteroid && !colors.includes(state.nextColor))
    state.nextColor = colors[createRng(`${state.seed}:orb5:nxt:${state.shotOrdinal}`).nextInt(colors.length)];
}
export function createOrbV5State(seed: string): OrbV5State {
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
    lastSwapTick: -ORB_V5_RULES.swapCooldownTicks,
    power: 0,
    held: -1,
    combo: 0,
    points: 0,
    pressureRows: 0,
    settleRemaining: 0,
    lastLaunchTick: 0,
    lastPressureTick: 0,
    lastInsertionTick: -100,
    lastLanding: null,
    burst: null,
  };
}
function powerCost(action: string) {
  const c = ORB_V5_RULES.powerCost;
  return action === "POWER_BOMB" ? c.bomb : action === "POWER_LIGHTNING" ? c.lightning : action === "POWER_RAINBOW" ? c.rainbow : 0;
}
export function canApplyOrbV5(state: OrbV5State, action: string) {
  if (state.status !== "running") return false;
  if (action === "SWAP")
    return (
      state.currentColor !== state.nextColor &&
      state.tick - state.lastSwapTick >= ORB_V5_RULES.swapCooldownTicks
    );
  if (action === "AIM_LEFT") return state.aimIndex > 0;
  if (action === "AIM_RIGHT") return state.aimIndex < ORB_AIM_COUNT - 1;
  const index = ORB_ACTIONS.indexOf(action);
  if (index >= 0 && index < ORB_AIM_COUNT) return index !== state.aimIndex;
  if (state.shot) return false;
  if (action === "SHOOT") return true;
  if (action.startsWith("POWER_")) {
    const cost = powerCost(action);
    return cost > 0 && state.power >= cost && state.currentColor < ORB_V5_RULES.bomb;
  }
  return false;
}
export function applyOrbV5(state: OrbV5State, action: string) {
  if (action.startsWith("POWER_")) {
    state.power -= powerCost(action);
    state.held = state.currentColor;
    state.currentColor =
      action === "POWER_BOMB" ? ORB_V5_RULES.bomb : action === "POWER_LIGHTNING" ? ORB_V5_RULES.lightning : ORB_V5_RULES.rainbow;
    return;
  }
  if (action === "SWAP") {
    [state.currentColor, state.nextColor] = [state.nextColor, state.currentColor];
    state.lastSwapTick = state.tick;
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
    speed = ORB_V5_RULES.shotSpeedMilli;
  state.shot = {
    xMilli: ORB_V5_RULES.shooterXMilli,
    yMilli: ORB_V5_RULES.shooterYMilli,
    vxMilli: roundDiv(direction.x * speed, direction.length),
    vyMilli: roundDiv(direction.y * speed, direction.length),
    xRemainder: 0,
    yRemainder: 0,
    color: state.currentColor,
    ordinal: state.shotOrdinal,
  };
  state.lastLaunchTick = state.tick;
  state.shotOrdinal++;
  if (state.held >= 0) {
    state.currentColor = state.held;
    state.held = -1;
  } else {
    state.currentColor = state.nextColor;
    state.nextColor = ammunition(state);
  }
}
export function stepOrbV5(state: OrbV5State) {
  state.tick++;
  if (state.settleRemaining > 0) state.settleRemaining--;
  const shot = state.shot;
  if (!shot) {
    if (
      state.tick - Math.max(state.lastLaunchTick, state.lastPressureTick) >=
        orbIdleTicksV5(state)
    )
      pressure(state);
    return;
  }
  shot.xRemainder += shot.vxMilli;
  shot.yRemainder += shot.vyMilli;
  const dx = Math.trunc(shot.xRemainder / ORB_V5_RULES.tickRate),
    dy = Math.trunc(shot.yRemainder / ORB_V5_RULES.tickRate);
  shot.xRemainder -= dx * ORB_V5_RULES.tickRate;
  shot.yRemainder -= dy * ORB_V5_RULES.tickRate;
  shot.xMilli += dx;
  shot.yMilli += dy;
  if (shot.xMilli <= ORB_V5_RULES.radiusMilli && shot.vxMilli < 0) {
    shot.xMilli = ORB_V5_RULES.radiusMilli;
    shot.vxMilli = -shot.vxMilli;
    shot.xRemainder = 0;
  }
  if (
    shot.xMilli >= ORB_V5_RULES.width * 1000 - ORB_V5_RULES.radiusMilli &&
    shot.vxMilli > 0
  ) {
    shot.xMilli = ORB_V5_RULES.width * 1000 - ORB_V5_RULES.radiusMilli;
    shot.vxMilli = -shot.vxMilli;
    shot.xRemainder = 0;
  }
  const hit =
    shot.yMilli - ORB_V5_RULES.radiusMilli <= 24000 ||
    state.bubbles.some(
      (b) =>
        distanceSquared(state, b.row, b.col, shot.xMilli, shot.yMilli) <=
        ORB_V5_RULES.collisionDistanceMilli ** 2,
    );
  if (hit) {
    state.shot = null;
    settle(state, shot);
  }
}
export function copyOrbV5State(state: OrbV5State): OrbV5State {
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
export function forecastOrbV5(state: OrbV5State, aimIndex = state.aimIndex) {
  if (!Number.isInteger(aimIndex) || aimIndex < 0 || aimIndex >= ORB_AIM_COUNT)
    throw new RangeError("INVALID_AIM");
  const copy = copyOrbV5State(state);
  copy.aimIndex = aimIndex;
  const points: { xMilli: number; yMilli: number }[] = [];
  if (!canApplyOrbV5(copy, "SHOOT")) return { state: copy, points };
  applyOrbV5(copy, "SHOOT");
  for (
    let i = 0;
    i < 720 && copy.status === "running" && copy.shot;
    i++
  ) {
    if (copy.shot && i % 8 === 0)
      points.push({ xMilli: copy.shot.xMilli, yMilli: copy.shot.yMilli });
    stepOrbV5(copy);
  }
  return { state: copy, points };
}
export const ORB_BURST_CORE_V5: GameCore<OrbV5State> = {
  gameId: "orb-burst",
  gameVersion: "5.0.0",
  width: 390,
  height: 620,
  tickRate: 120,
  maxFinalTick: ORB_V5_RULES.maxFinalTick,
  maxInputs: 4000,
  inputVersion: 5,
  actions: ORB_ACTIONS,
  content: {
    rules: ORB_V5_RULES,
    generation:
      "v1-opening;orb5-source-rows4..11;phases-18-42-68;4-5-colours;asteroids-5+7+10;ice-6+;bomb6-lightning11-rainbow8;stored-power-choice;swap-cooldown-300;no-settle-lock;independent-pressure",
    aimPhase: { first: 2192, step: 20, count: 89 },
    matching: "V1_HEX_MATCH3_FLOATING_CLUSTERS_WITHOUT_SWEEP",
    supply:
      "one-row-per-settlement-at-occupancy<=27;preserve-source-ids-and-grid-parity;no-reset",
    progress:
      "108-originals-once-only;shots-and-pressure-zero;score=height;goal108",
    queue:
      "preserve-next;tail-selects-visible-colors;at-most-one-current-color-absent",
  },
  create: createOrbV5State,
  step: stepOrbV5,
  canApply: canApplyOrbV5,
  apply: applyOrbV5,
};
