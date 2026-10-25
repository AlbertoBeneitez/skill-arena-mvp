/**
 * Galoku (Corner Sudoku V3) — V1 board (two sides of a sudoku meeting at the corner: five 3×3 boxes, 45 cells; each
 * box, each of the three top rows and each of the three left columns holds 1–9) with THREE puzzles per match
 * instead of five. Unique solution per puzzle, fewer givens as the match goes on. A correct digit locks in and
 * scores; a wrong one is rejected and costs points; five wrong digits end the match. Six-minute clock.
 * V1 and V2 stay frozen.
 */
import { createRng } from "../deterministic/seeded";
import type { CoreState, GameCore } from "./coreRuntime.v1";
import { CORNER_SUDOKU_ACTIONS_V1, CORNER_SUDOKU_CELLS } from "./cornerSudokuProtocol.v1";

export const CORNER_SUDOKU_RULES_V3 = Object.freeze({
  tickRate: 120,
  maxFinalTick: 120 * 60 * 6,
  puzzles: 3,
  /** Target givens per puzzle out of 45 (uniqueness may keep a few more). */
  givens: [31, 28, 25] as readonly number[],
  correctPoints: 20,
  wrongPenalty: 50,
  maxMistakes: 5,
  solveBonus: 400,
  timeBonusMax: 1200,
  timeBonusTicksPerPoint: 12,
  clearTicks: 84,
});
const R = CORNER_SUDOKU_RULES_V3;

/** Box origins in the 9×9 sudoku grid (row, col): A, B, D along the top band; C, E down the left stack. */
export const CORNER_SUDOKU_BOXES_V3 = Object.freeze([[0, 0], [0, 3], [0, 6], [3, 0], [6, 0]] as const);
const TOP_BAND = [0, 1, 2], LEFT_STACK = [0, 3, 4];
/** Global (row, col) of each cell in the L-shaped part of the 9×9 grid. */
export const CORNER_SUDOKU_CELL_POS_V3 = Object.freeze(
  Array.from({ length: CORNER_SUDOKU_CELLS }, (_, i) => {
    const box = Math.floor(i / 9), r = Math.floor((i % 9) / 3), c = i % 3;
    const [r0, c0] = CORNER_SUDOKU_BOXES_V3[box];
    return { box, r, c, row: r0 + r, col: c0 + c };
  }),
);
/** Peers that may not share a digit with each cell: same box, same top row (A–B–D), same left column (A–C–E). */
export const CORNER_SUDOKU_PEERS_V3 = Object.freeze(
  CORNER_SUDOKU_CELL_POS_V3.map((p, i) =>
    CORNER_SUDOKU_CELL_POS_V3.flatMap((q, j) => {
      if (i === j) return [];
      const sameBox = p.box === q.box;
      const sharedRow = TOP_BAND.includes(p.box) && TOP_BAND.includes(q.box) && p.row === q.row;
      const sharedCol = LEFT_STACK.includes(p.box) && LEFT_STACK.includes(q.box) && p.col === q.col;
      return sameBox || sharedRow || sharedCol ? [j] : [];
    }),
  ),
);
const PEERS = CORNER_SUDOKU_PEERS_V3;

export type CornerSudokuPuzzleV3 = { givens: number[]; solution: number[] };
export type CornerSudokuEventV3 = { tick: number; cell: number; digit: number; ok: boolean; points: number };
export type CornerSudokuStateV3 = CoreState & {
  seed: string;
  puzzles: CornerSudokuPuzzleV3[];
  current: number;
  phase: "play" | "clear";
  phaseTick: number;
  board: number[];
  puzzleStartTick: number;
  mistakes: number;
  solved: number;
  solveTicks: number[];
  lastEvent: CornerSudokuEventV3 | null;
};

function candidates(board: number[], cell: number) {
  let mask = 0;
  for (const p of PEERS[cell]) if (board[p]) mask |= 1 << board[p];
  const out: number[] = [];
  for (let d = 1; d <= 9; d++) if (!(mask & (1 << d))) out.push(d);
  return out;
}

function fillSolution(board: number[], rng: ReturnType<typeof createRng>): boolean {
  let best = -1, bestCands: number[] = [];
  for (let i = 0; i < CORNER_SUDOKU_CELLS; i++) {
    if (board[i]) continue;
    const c = candidates(board, i);
    if (best < 0 || c.length < bestCands.length) { best = i; bestCands = c; }
    if (c.length === 0) return false;
  }
  if (best < 0) return true;
  const order = [...bestCands];
  for (let k = order.length - 1; k > 0; k--) {
    const j = rng.nextInt(k + 1);
    [order[k], order[j]] = [order[j], order[k]];
  }
  for (const d of order) {
    board[best] = d;
    if (fillSolution(board, rng)) return true;
  }
  board[best] = 0;
  return false;
}

/** Number of solutions, stopping at `limit`. */
export function countCornerSudokuSolutionsV3(board: number[], limit = 2): number {
  let best = -1, bestCands: number[] = [];
  for (let i = 0; i < CORNER_SUDOKU_CELLS; i++) {
    if (board[i]) continue;
    const c = candidates(board, i);
    if (c.length === 0) return 0;
    if (best < 0 || c.length < bestCands.length) { best = i; bestCands = c; }
  }
  if (best < 0) return 1;
  let total = 0;
  for (const d of bestCands) {
    board[best] = d;
    total += countCornerSudokuSolutionsV3(board, limit - total);
    if (total >= limit) break;
  }
  board[best] = 0;
  return total;
}

export function cornerSudokuPuzzlesV3(seed: string): CornerSudokuPuzzleV3[] {
  return Array.from({ length: R.puzzles }, (_, index) => {
    const rng = createRng(`${seed}:corner-sudoku3:${index}`);
    const solution = new Array<number>(CORNER_SUDOKU_CELLS).fill(0);
    fillSolution(solution, rng);
    const givens = [...solution];
    const order = Array.from({ length: CORNER_SUDOKU_CELLS }, (_, i) => i);
    for (let k = order.length - 1; k > 0; k--) {
      const j = rng.nextInt(k + 1);
      [order[k], order[j]] = [order[j], order[k]];
    }
    let count = CORNER_SUDOKU_CELLS;
    for (const cell of order) {
      if (count <= R.givens[index]) break;
      const keep = givens[cell];
      givens[cell] = 0;
      if (countCornerSudokuSolutionsV3([...givens]) === 1) count--;
      else givens[cell] = keep;
    }
    return { givens, solution };
  });
}

export function createCornerSudokuV3(seed: string): CornerSudokuStateV3 {
  const puzzles = cornerSudokuPuzzlesV3(seed);
  return {
    tick: 0, status: "running", score: 0, failure: null, seed, puzzles,
    current: 0, phase: "play", phaseTick: 0, board: [...puzzles[0].givens],
    puzzleStartTick: 0, mistakes: 0, solved: 0, solveTicks: [], lastEvent: null,
  };
}

function parse(a: string) {
  const m = /^PUT_(\d+)_(\d)$/.exec(a);
  return m ? { cell: Number(m[1]), digit: Number(m[2]) } : null;
}

export function canApplyCornerSudokuV3(s: CornerSudokuStateV3, a: string) {
  if (s.status !== "running" || s.phase !== "play" || !CORNER_SUDOKU_ACTIONS_V1.includes(a)) return false;
  const p = parse(a);
  return !!p && s.board[p.cell] === 0;
}

export function applyCornerSudokuV3(s: CornerSudokuStateV3, a: string) {
  const p = parse(a);
  if (!p) return;
  const puzzle = s.puzzles[s.current];
  if (puzzle.solution[p.cell] === p.digit) {
    s.board[p.cell] = p.digit;
    let points = R.correctPoints;
    if (s.board.every(Boolean)) {
      const elapsed = s.tick - s.puzzleStartTick;
      points += R.solveBonus + Math.max(0, R.timeBonusMax - Math.floor(elapsed / R.timeBonusTicksPerPoint));
      s.solved++;
      s.solveTicks.push(elapsed);
      s.phase = "clear";
      s.phaseTick = s.tick;
    }
    s.score += points;
    s.lastEvent = { tick: s.tick, cell: p.cell, digit: p.digit, ok: true, points };
    if (s.solved === R.puzzles) { s.status = "won"; s.failure = null; }
  } else {
    s.mistakes++;
    const before = s.score;
    s.score = Math.max(0, s.score - R.wrongPenalty);
    s.lastEvent = { tick: s.tick, cell: p.cell, digit: p.digit, ok: false, points: s.score - before };
    if (s.mistakes >= R.maxMistakes) { s.status = "failed"; s.failure = "MISTAKES"; }
  }
}

export function stepCornerSudokuV3(s: CornerSudokuStateV3) {
  s.tick++;
  if (s.phase === "clear" && s.tick - s.phaseTick >= R.clearTicks && s.current + 1 < R.puzzles) {
    s.current++;
    s.phase = "play";
    s.phaseTick = s.tick;
    s.board = [...s.puzzles[s.current].givens];
    s.puzzleStartTick = s.tick;
  }
}

export const CORNER_SUDOKU_CORE_V3: GameCore<CornerSudokuStateV3> = {
  gameId: "corner-sudoku",
  gameVersion: "3.0.0",
  width: 390,
  height: 620,
  tickRate: R.tickRate,
  maxFinalTick: R.maxFinalTick,
  maxInputs: CORNER_SUDOKU_CELLS * R.puzzles + R.maxMistakes + 5,
  inputVersion: 1,
  actions: CORNER_SUDOKU_ACTIONS_V1,
  content: {
    rules: R,
    layout: "sudoku-top-band+left-stack;5-boxes-3x3;45-cells;rows-0-2-and-cols-0-2-hold-1-9",
    generation: "seeded-backtracking-solution;seeded-carving-unique-solution;3-puzzles;givens-31-28-25",
    scoring: "correct20;wrong-50(min0);solve400+max(0,1200-ticks/12);5-mistakes-end;6min-clock",
  },
  create: createCornerSudokuV3,
  step: stepCornerSudokuV3,
  canApply: canApplyCornerSudokuV3,
  apply: applyCornerSudokuV3,
};
