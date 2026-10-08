/** Original block puzzle. Existing six shapes retained; competitive rules are versioned. */
import { seededShuffle } from "../deterministic/seeded";
import type { GameCore, CoreState } from "./coreRuntime.v1";
import { STACK_SHIFT_ACTIONS } from "./stackShiftProtocol.v1";
export type Cell = readonly [number, number];
export const STACK_SHAPES: readonly (readonly Cell[])[] = [
  [
    [0, 0],
    [1, 0],
    [2, 0],
  ],
  [
    [0, 0],
    [0, 1],
    [1, 1],
  ],
  [
    [0, 0],
    [1, 0],
    [1, 1],
    [2, 1],
  ],
  [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ],
  [
    [1, 0],
    [0, 1],
    [1, 1],
    [2, 1],
    [1, 2],
  ],
  [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 2],
  ],
];
export const STACK_SHIFT_RULES = {
  columns: 8,
  rows: 16,
  inputCooldown: 6,
  settleTicks: 24,
  lockDelay: 36,
  maxLockResets: 8,
  initialFallTicks: 84,
  minimumFallTicks: 28,
  lineTarget: 18,
  maxFinalTick: 21600,
} as const;
export type StackShiftState = CoreState & {
  seed: string;
  board: number[][];
  pieceIndex: number;
  pieceKind: number;
  rotation: number;
  x: number;
  y: number;
  pieceActive: boolean;
  spawnAt: number | null;
  fallTicks: number;
  groundTicks: number;
  lockResets: number;
  lastInputTick: number;
  lines: number;
  pieces: number;
  combo: number;
  lastLockTick: number;
  lastClearTick: number;
  clearedRows: number[];
};
export function stackPiece(seed: string, index: number) {
  if (index < 4) return 3; // four accessible squares teach filling rows without rotations.
  const bag = Math.floor((index - 4) / 6);
  return seededShuffle([0, 1, 2, 3, 4, 5], `${seed}:stack-shift1:bag:${bag}`)[
    (index - 4) % 6
  ];
}
export function stackCells(kind: number, rotation = 0): Cell[] {
  let cells = STACK_SHAPES[kind].map(([x, y]) => [x, y] as Cell);
  for (let r = 0; r < rotation; r++) {
    const turn = cells.map(([x, y]) => [-y, x] as Cell),
      minX = Math.min(...turn.map((c) => c[0])),
      minY = Math.min(...turn.map((c) => c[1]));
    cells = turn.map(([x, y]) => [x - minX, y - minY]);
  }
  return cells;
}
export function stackCanPlace(
  s: StackShiftState,
  cells: readonly Cell[],
  x: number,
  y: number,
) {
  return cells.every(([cx, cy]) => {
    const xx = x + cx,
      yy = y + cy;
    return xx >= 0 && xx < 8 && yy < 16 && (yy < 0 || s.board[yy][xx] === 0);
  });
}
export function stackLandingY(
  s: StackShiftState,
  cells: readonly Cell[] = stackCells(s.pieceKind, s.rotation),
  x = s.x,
  y = s.y,
) {
  while (stackCanPlace(s, cells, x, y + 1)) y++;
  return y;
}
export function stackRotation(s: StackShiftState) {
  const rotation = (s.rotation + 1) % 4,
    cells = stackCells(s.pieceKind, rotation);
  for (const kick of [0, -1, 1, -2, 2])
    if (stackCanPlace(s, cells, s.x + kick, s.y))
      return { rotation, x: s.x + kick };
  return null;
}
function spawn(s: StackShiftState) {
  s.pieceKind = stackPiece(s.seed, s.pieceIndex);
  s.rotation = 0;
  const width = Math.max(...stackCells(s.pieceKind).map((c) => c[0])) + 1;
  s.x = Math.floor((8 - width) / 2);
  s.y = 0;
  s.pieceActive = true;
  s.spawnAt = null;
  s.fallTicks = 0;
  s.groundTicks = 0;
  s.lockResets = 0;
  if (!stackCanPlace(s, stackCells(s.pieceKind), s.x, s.y)) {
    s.status = "failed";
    s.failure = "TOP_OUT";
    s.pieceActive = false;
  }
}
export function createStackShift(seed: string): StackShiftState {
  const s: StackShiftState = {
    seed,
    tick: 0,
    status: "running",
    score: 0,
    failure: null,
    board: Array.from({ length: 16 }, () => Array(8).fill(0)),
    pieceIndex: 0,
    pieceKind: 3,
    rotation: 0,
    x: 3,
    y: 0,
    pieceActive: true,
    spawnAt: null,
    fallTicks: 0,
    groundTicks: 0,
    lockResets: 0,
    lastInputTick: -6,
    lines: 0,
    pieces: 0,
    combo: 0,
    lastLockTick: -100,
    lastClearTick: -100,
    clearedRows: [],
  };
  spawn(s);
  return s;
}
function lock(s: StackShiftState) {
  const cells = stackCells(s.pieceKind, s.rotation);
  if (!stackCanPlace(s, cells, s.x, s.y) || cells.some((c) => s.y + c[1] < 0)) {
    s.status = "failed";
    s.failure = "TOP_OUT";
    return;
  }
  for (const [x, y] of cells) s.board[s.y + y][s.x + x] = s.pieceKind + 1;
  const removed: number[] = [];
  s.board.forEach((row, y) => {
    if (row.every(Boolean)) removed.push(y);
  });
  const remaining = s.board.filter((row) => !row.every(Boolean));
  while (remaining.length < 16) remaining.unshift(Array(8).fill(0));
  s.board = remaining;
  s.pieces++;
  s.score += 120;
  s.lastLockTick = s.tick;
  if (removed.length) {
    s.lines += removed.length;
    s.combo++;
    s.score +=
      [0, 900, 2200, 3900, 6200][Math.min(4, removed.length)] +
      Math.min(400, (s.combo - 1) * 100);
    s.lastClearTick = s.tick;
    s.clearedRows = removed;
  } else s.combo = 0;
  s.pieceActive = false;
  s.pieceIndex++;
  s.spawnAt = s.tick + 24;
  if (s.lines >= 18) {
    s.status = "won";
    s.failure = null;
  }
}
export function stackFallInterval(s: StackShiftState) {
  return Math.max(28, 84 - s.lines * 2 - Math.floor(s.pieces / 5) * 2);
}
export function stepStackShift(s: StackShiftState) {
  s.tick++;
  if (!s.pieceActive) {
    if (s.spawnAt !== null && s.tick >= s.spawnAt) spawn(s);
  } else {
    const cells = stackCells(s.pieceKind, s.rotation);
    if (stackCanPlace(s, cells, s.x, s.y + 1)) {
      s.groundTicks = 0;
      s.fallTicks++;
      if (s.fallTicks >= stackFallInterval(s)) {
        s.y++;
        s.fallTicks = 0;
      }
    } else {
      s.groundTicks++;
      if (s.groundTicks >= 36) lock(s);
    }
  }
  if (s.status === "running" && s.tick >= 21600) {
    s.status = "won";
    s.failure = null;
  }
}
export function canApplyStackShift(s: StackShiftState, a: string) {
  if (s.status !== "running" || !s.pieceActive || s.tick - s.lastInputTick < 6)
    return false;
  const cells = stackCells(s.pieceKind, s.rotation);
  switch (a) {
    case "LEFT":
      return stackCanPlace(s, cells, s.x - 1, s.y);
    case "RIGHT":
      return stackCanPlace(s, cells, s.x + 1, s.y);
    case "ROTATE":
      return stackRotation(s) !== null;
    case "SOFT_DROP":
      return stackCanPlace(s, cells, s.x, s.y + 1);
    case "HARD_DROP":
      return true;
    default:
      return false;
  }
}
export function applyStackShift(s: StackShiftState, a: string) {
  const wasGrounded = !stackCanPlace(
    s,
    stackCells(s.pieceKind, s.rotation),
    s.x,
    s.y + 1,
  );
  s.lastInputTick = s.tick;
  if (a === "LEFT" || a === "RIGHT") s.x += a === "LEFT" ? -1 : 1;
  else if (a === "ROTATE") {
    const r = stackRotation(s)!;
    s.rotation = r.rotation;
    s.x = r.x;
  } else if (a === "SOFT_DROP") {
    s.y++;
    s.score++;
    s.fallTicks = 0;
  } else if (a === "HARD_DROP") {
    const y = stackLandingY(s);
    s.score += (y - s.y) * 6;
    s.y = y;
    lock(s);
    return;
  }
  if (wasGrounded && s.lockResets < 8) {
    s.groundTicks = 0;
    s.lockResets++;
  }
}
export const STACK_SHIFT_CORE: GameCore<StackShiftState> = {
  gameId: "stack-shift",
  gameVersion: "1.0.0",
  width: 390,
  height: 620,
  tickRate: 120,
  maxFinalTick: 21600,
  maxInputs: 6000,
  inputVersion: 1,
  actions: STACK_SHIFT_ACTIONS,
  content: {
    rules: STACK_SHIFT_RULES,
    shapes: STACK_SHAPES,
    generation: "four-squares-then-six-bags-v1",
    rotation: "normalized-clockwise-kicks-0-minus1-plus1-minus2-plus2",
    scoring: {
      lock: 120,
      lines: [0, 900, 2200, 3900, 6200],
      comboStep: 100,
      comboMax: 400,
      dropPerRow: 6,
      softPerRow: 1,
    },
    completion: "18-lines-or-survive-180s-or-manifest-target",
  },
  create: createStackShift,
  step: stepStackShift,
  canApply: canApplyStackShift,
  apply: applyStackShift,
};
