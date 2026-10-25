/**
 * Orb Burst V6 — classic bubble shooter rules. A hex board of six colours (seven rows to start, colours in
 * clumps). Aim, bank off the side walls, and stick the orb to the board: three or more touching orbs of its
 * colour pop, and every orb left hanging (no path to the ceiling) drops for a doubling bonus. A shot that pops
 * nothing is a miss; after enough misses a new row pushes the whole board down, and the allowed misses shrink as
 * rows keep arriving. Orbs crossing the danger line end the run. The loaded and the next orb only use colours
 * still on the board; SWAP exchanges them. Clearing the board refills it with a bonus. No power-ups, no ice.
 * Integer geometry shared with V1/V5 (same centres and neighbours); V1–V5 stay frozen.
 */
import { createRng } from "../deterministic/seeded";
import { roundDiv } from "../deterministic/integerMath";
import type { CoreState, GameCore } from "./coreRuntime.v1";
import { orbCenter as archivedOrbCenter, orbNeighbors as archivedOrbNeighbors, orbDirection } from "./orbBurstCore.v1";
import { ORB_AIM_COUNT } from "./orbBurstProtocol.v1";
import { ORB_ACTIONS_V6 } from "./orbBurstProtocol.v6";

export const ORB_V6_RULES = {
  width: 390,
  height: 620,
  cols: 9,
  colors: 6,
  radiusMilli: 18000,
  rowHeightMilli: 31000,
  shooterXMilli: 195000,
  shooterYMilli: 574000,
  tickRate: 120,
  shotSpeedMilli: 640000,
  collisionDistanceMilli: 34560,
  dangerYMilli: 502000,
  settleTicks: 12,
  maxFinalTick: 120 * 60 * 6,
  maxInputs: 4000,
  initialRows: 7,
  refillRows: 6,
  /** Misses allowed before a new row: 5, then one fewer every 3 rows added, never below 2. */
  startMisses: 5,
  minimumMisses: 2,
  rowsPerMissStep: 3,
  /** Chance (in 100ths) that a generated orb copies its left / upper neighbour's colour. */
  clumpLeft: 38,
  clumpUp: 22,
  popPoints: 10,
  dropBase: 20,
  dropCap: 10,
  clearBonus: 2000,
} as const;
const R = ORB_V6_RULES;

export type OrbV6Bubble = { row: number; col: number; color: number; id: string };
type Shot = { xMilli: number; yMilli: number; vxMilli: number; vyMilli: number; xRemainder: number; yRemainder: number; color: number };
export type OrbV6State = CoreState & {
  seed: string;
  gridParity: 0 | 1;
  bubbles: OrbV6Bubble[];
  aimIndex: number;
  shot: Shot | null;
  shotOrdinal: number;
  rowOrdinal: number;
  currentColor: number;
  nextColor: number;
  misses: number;
  rowsAdded: number;
  points: number;
  popped: number;
  dropped: number;
  combo: number;
  clears: number;
  settleRemaining: number;
  lastSwapTick: number;
  lastInsertionTick: number;
  lastLanding: { row: number; col: number; tick: number } | null;
  burst: { tick: number; popped: number; dropped: number; points: number; bubbles: (OrbV6Bubble & { xMilli: number; yMilli: number; drop: boolean })[] } | null;
};

const key = (row: number, col: number) => `${row},${col}`;
export function orbCenterV6(state: Pick<OrbV6State, "gridParity">, row: number, col: number) {
  const p = archivedOrbCenter(row + state.gridParity, col);
  return { xMilli: p.xMilli, yMilli: p.yMilli - state.gridParity * R.rowHeightMilli };
}
export function orbNeighborsV6(state: Pick<OrbV6State, "gridParity">, row: number, col: number) {
  return archivedOrbNeighbors(row + state.gridParity, col)
    .map((n) => ({ row: n.row - state.gridParity, col: n.col }))
    .filter((n) => n.row >= 0);
}
export function orbMissLimitV6(state: Pick<OrbV6State, "rowsAdded">) {
  return Math.max(R.minimumMisses, R.startMisses - Math.floor(state.rowsAdded / R.rowsPerMissStep));
}

/** One generated row (all columns), clumped against its left neighbour and the row below it. */
function generatedRow(state: OrbV6State, below: Map<string, OrbV6Bubble>, row: number) {
  const rng = createRng(`${state.seed}:orb6:row:${state.rowOrdinal}`);
  const out: OrbV6Bubble[] = [];
  for (let col = 0; col < R.cols; col++) {
    let color = rng.nextInt(R.colors);
    const roll = rng.nextInt(100);
    const up = orbNeighborsV6(state, row, col).map((n) => below.get(key(n.row, n.col))).find(Boolean);
    if (col > 0 && roll < R.clumpLeft) color = out[col - 1].color;
    else if (up && roll < R.clumpLeft + R.clumpUp) color = up.color;
    out.push({ row, col, color, id: `r${state.rowOrdinal}c${col}` });
  }
  state.rowOrdinal++;
  return out;
}

function boardColors(state: OrbV6State) {
  return [...new Set(state.bubbles.map((b) => b.color))].sort((a, b) => a - b);
}
function drawColor(state: OrbV6State, salt: string) {
  const colors = boardColors(state);
  const rng = createRng(`${state.seed}:orb6:ammo:${state.shotOrdinal}:${salt}`);
  return colors.length ? colors[rng.nextInt(colors.length)] : rng.nextInt(R.colors);
}
/** Keep the loaded and next orbs on colours that still exist on the board. */
function keepAmmoOnBoard(state: OrbV6State) {
  const colors = boardColors(state);
  if (!colors.length) return;
  if (!colors.includes(state.currentColor)) state.currentColor = drawColor(state, "fix-current");
  if (!colors.includes(state.nextColor)) state.nextColor = drawColor(state, "fix-next");
}

function cluster(state: OrbV6State, start: OrbV6Bubble) {
  const map = new Map(state.bubbles.map((b) => [key(b.row, b.col), b]));
  const seen = new Set<string>(), found: OrbV6Bubble[] = [], queue = [start];
  for (let i = 0; i < queue.length; i++) {
    const b = queue[i], id = key(b.row, b.col);
    if (seen.has(id)) continue;
    seen.add(id);
    const actual = map.get(id);
    if (!actual || actual.color !== start.color) continue;
    found.push(actual);
    for (const n of orbNeighborsV6(state, b.row, b.col)) queue.push({ ...start, ...n });
  }
  return found;
}
function anchoredSet(state: OrbV6State) {
  const map = new Map(state.bubbles.map((b) => [key(b.row, b.col), b]));
  const seen = new Set<string>(), queue = state.bubbles.filter((b) => b.row === 0);
  for (let i = 0; i < queue.length; i++) {
    const b = queue[i], id = key(b.row, b.col);
    if (seen.has(id)) continue;
    seen.add(id);
    for (const n of orbNeighborsV6(state, b.row, b.col)) {
      const next = map.get(key(n.row, n.col));
      if (next && !seen.has(key(n.row, n.col))) queue.push(next);
    }
  }
  return seen;
}
function snap(state: OrbV6State, x: number, y: number) {
  const occupied = new Set(state.bubbles.map((b) => key(b.row, b.col)));
  let nearest: { row: number; col: number } | null = null, best = Number.MAX_SAFE_INTEGER;
  for (let row = 0; row < 18; row++)
    for (let col = 0; col < R.cols; col++) {
      if (occupied.has(key(row, col))) continue;
      const p = orbCenterV6(state, row, col), d = (p.xMilli - x) ** 2 + (p.yMilli - y) ** 2;
      // Only cells that touch the ceiling or an existing orb can hold the shot.
      const supported = row === 0 || orbNeighborsV6(state, row, col).some((n) => occupied.has(key(n.row, n.col)));
      if (supported && d < best) { best = d; nearest = { row, col }; }
    }
  return nearest;
}
function overflow(state: OrbV6State) {
  if (state.bubbles.some((b) => orbCenterV6(state, b.row, b.col).yMilli >= R.dangerYMilli)) {
    state.status = "failed";
    state.failure = "BOARD_OVERFLOW";
  }
}
function insertRow(state: OrbV6State) {
  // The parity toggle cancels the row shift in X; every neighbour relation survives.
  state.bubbles = state.bubbles.map((b) => ({ ...b, row: b.row + 1 }));
  state.gridParity = state.gridParity ? 0 : 1;
  const below = new Map(state.bubbles.map((b) => [key(b.row, b.col), b]));
  state.bubbles.push(...generatedRow(state, below, 0));
  state.lastInsertionTick = state.tick;
  state.settleRemaining = R.settleTicks;
  overflow(state);
}
function fill(state: OrbV6State, rows: number) {
  for (let i = 0; i < rows; i++) {
    state.bubbles = state.bubbles.map((b) => ({ ...b, row: b.row + 1 }));
    state.gridParity = state.gridParity ? 0 : 1;
    const below = new Map(state.bubbles.map((b) => [key(b.row, b.col), b]));
    state.bubbles.push(...generatedRow(state, below, 0));
  }
}

function settle(state: OrbV6State, shot: Shot) {
  const cell = snap(state, shot.xMilli, shot.yMilli);
  state.shot = null;
  if (!cell) { state.status = "failed"; state.failure = "BOARD_OVERFLOW"; return; }
  const placed: OrbV6Bubble = { ...cell, color: shot.color, id: `s${state.shotOrdinal}` };
  state.bubbles.push(placed);
  state.lastLanding = { row: cell.row, col: cell.col, tick: state.tick };
  const group = cluster(state, placed);
  let points = 0, poppedN = 0, droppedN = 0;
  const removed: (OrbV6Bubble & { xMilli: number; yMilli: number; drop: boolean })[] = [];
  if (group.length >= 3) {
    const gone = new Set(group.map((b) => key(b.row, b.col)));
    for (const b of group) removed.push({ ...b, ...orbCenterV6(state, b.row, b.col), drop: false });
    state.bubbles = state.bubbles.filter((b) => !gone.has(key(b.row, b.col)));
    poppedN = group.length;
    const anchored = anchoredSet(state);
    const loose = state.bubbles.filter((b) => !anchored.has(key(b.row, b.col)));
    for (const b of loose) removed.push({ ...b, ...orbCenterV6(state, b.row, b.col), drop: true });
    state.bubbles = state.bubbles.filter((b) => anchored.has(key(b.row, b.col)));
    droppedN = loose.length;
    points = poppedN * R.popPoints + (droppedN ? R.dropBase * 2 ** Math.min(R.dropCap, droppedN - 1) : 0);
    state.combo++;
    if (state.combo > 1) points += 50 * Math.min(10, state.combo - 1);
    state.popped += poppedN;
    state.dropped += droppedN;
  } else {
    state.combo = 0;
    state.misses++;
  }
  if (!state.bubbles.length) {
    points += R.clearBonus;
    state.clears++;
    fill(state, R.refillRows);
    state.misses = 0;
  }
  state.points += points;
  state.score = state.points;
  state.burst = removed.length ? { tick: state.tick, popped: poppedN, dropped: droppedN, points, bubbles: removed } : state.burst;
  overflow(state);
  if (state.status !== "running") return;
  if (state.misses >= orbMissLimitV6(state)) {
    state.misses = 0;
    state.rowsAdded++;
    insertRow(state);
    if (state.status !== "running") return;
  }
  state.shotOrdinal++;
  state.currentColor = state.nextColor;
  state.nextColor = drawColor(state, "next");
  keepAmmoOnBoard(state);
}

export function createOrbV6State(seed: string): OrbV6State {
  const state: OrbV6State = {
    tick: 0, status: "running", score: 0, failure: null, seed, gridParity: 0, bubbles: [], aimIndex: 44, shot: null,
    shotOrdinal: 0, rowOrdinal: 0, currentColor: 0, nextColor: 0, misses: 0, rowsAdded: 0, points: 0, popped: 0,
    dropped: 0, combo: 0, clears: 0, settleRemaining: 0, lastSwapTick: -1000, lastInsertionTick: -1000, lastLanding: null, burst: null,
  };
  fill(state, R.initialRows);
  state.currentColor = drawColor(state, "current");
  state.nextColor = drawColor(state, "next");
  return state;
}

export function canApplyOrbV6(state: OrbV6State, action: string) {
  if (state.status !== "running" || !ORB_ACTIONS_V6.includes(action)) return false;
  if (action === "SHOOT") return !state.shot && state.settleRemaining === 0;
  if (action === "SWAP") return !state.shot && state.currentColor !== state.nextColor;
  if (action === "AIM_LEFT") return state.aimIndex > 0;
  if (action === "AIM_RIGHT") return state.aimIndex < ORB_AIM_COUNT - 1;
  return action.startsWith("AIM_");
}
export function applyOrbV6(state: OrbV6State, action: string) {
  if (action === "AIM_LEFT") state.aimIndex--;
  else if (action === "AIM_RIGHT") state.aimIndex++;
  else if (action === "SWAP") {
    [state.currentColor, state.nextColor] = [state.nextColor, state.currentColor];
    state.lastSwapTick = state.tick;
  } else if (action === "SHOOT") {
    const d = orbDirection(state.aimIndex);
    state.shot = {
      xMilli: R.shooterXMilli, yMilli: R.shooterYMilli,
      vxMilli: roundDiv(d.x * R.shotSpeedMilli, d.length), vyMilli: roundDiv(d.y * R.shotSpeedMilli, d.length),
      xRemainder: 0, yRemainder: 0, color: state.currentColor,
    };
  } else state.aimIndex = Number(action.slice(4));
}

export function stepOrbV6(state: OrbV6State) {
  state.tick++;
  if (state.settleRemaining > 0) state.settleRemaining--;
  const shot = state.shot;
  if (!shot) return;
  // Four sub-steps per tick keep the collision test tighter than the orb radius.
  for (let sub = 0; sub < 4 && state.shot; sub++) {
    shot.xRemainder += shot.vxMilli;
    shot.yRemainder += shot.vyMilli;
    const div = R.tickRate * 4;
    const dx = Math.trunc(shot.xRemainder / div), dy = Math.trunc(shot.yRemainder / div);
    shot.xRemainder -= dx * div; shot.yRemainder -= dy * div;
    shot.xMilli += dx; shot.yMilli += dy;
    const minX = 6000 + R.radiusMilli, maxX = 384000 - R.radiusMilli;
    if (shot.xMilli < minX) { shot.xMilli = 2 * minX - shot.xMilli; shot.vxMilli = Math.abs(shot.vxMilli); }
    if (shot.xMilli > maxX) { shot.xMilli = 2 * maxX - shot.xMilli; shot.vxMilli = -Math.abs(shot.vxMilli); }
    const ceiling = orbCenterV6(state, 0, 0).yMilli;
    const hit = shot.yMilli <= ceiling || state.bubbles.some((b) => {
      const p = orbCenterV6(state, b.row, b.col);
      return (p.xMilli - shot.xMilli) ** 2 + (p.yMilli - shot.yMilli) ** 2 < R.collisionDistanceMilli ** 2;
    });
    if (hit) settle(state, shot);
  }
}

export function copyOrbV6State(state: OrbV6State): OrbV6State {
  return JSON.parse(JSON.stringify(state)) as OrbV6State;
}

export const ORB_BURST_CORE_V6: GameCore<OrbV6State> = {
  gameId: "orb-burst",
  gameVersion: "6.0.0",
  width: R.width,
  height: R.height,
  tickRate: R.tickRate,
  maxFinalTick: R.maxFinalTick,
  maxInputs: R.maxInputs,
  inputVersion: 6,
  actions: ORB_ACTIONS_V6,
  content: {
    rules: R,
    mode: "classic-bubble-shooter;6-colours;7-rows;match-3-pop;hanging-drop-doubling;miss-rows;danger-line",
    scoring: "pop10;drop20*2^(n-1)cap2^10;chain+50*(n-1);clear2000",
  },
  create: createOrbV6State,
  step: stepOrbV6,
  canApply: canApplyOrbV6,
  apply: applyOrbV6,
};
