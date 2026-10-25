/**
 * Galakdoku (Corner Sudoku V2) — the corner of a sudoku: corner box A, box B to its right and box C below it.
 * Three 3×3 boxes, 27 cells. Each box holds 1–9 once; along each of the three top rows (A–B) and each of the three
 * left columns (A–C) no digit repeats. Five puzzles per match, carved from a seeded solution to 12…8 givens.
 * With so few constraints several completions exist, so a digit is correct when it breaks no rule AND the board
 * can still be completed (checked by the deterministic solver). Scoring as V1: a correct digit locks in and scores, a wrong one is rejected and costs points, five wrong digits
 * end the match; eight-minute clock, 120 Hz integer ticks. V1 stays frozen.
 *
 * Cell index = box * 9 + row * 3 + col with box 0 = A (corner), 1 = B (right), 2 = C (below).
 */
import { createRng } from "../deterministic/seeded";
import type { CoreState, GameCore } from "./coreRuntime.v1";
import { CORNER_SUDOKU_ACTIONS_V2, CORNER_SUDOKU_CELLS_V2 } from "./cornerSudokuProtocol.v2";

export const CORNER_SUDOKU_RULES_V2 = Object.freeze({
  tickRate: 120,
  maxFinalTick: 120 * 60 * 8,
  puzzles: 5,
  /** Target givens per puzzle out of 27 (uniqueness may keep a few more). */
  givens: [12, 11, 10, 9, 8] as readonly number[],
  correctPoints: 20,
  wrongPenalty: 50,
  maxMistakes: 5,
  solveBonus: 400,
  timeBonusMax: 1200,
  timeBonusTicksPerPoint: 12,
  clearTicks: 84,
});
const R = CORNER_SUDOKU_RULES_V2;

/** Box origins in the 9×9 sudoku grid (row, col): A, B, D along the top band; C, E down the left stack. */
export const CORNER_SUDOKU_BOXES_V2 = Object.freeze([[0, 0], [0, 3], [3, 0]] as const);
const TOP_BAND = [0, 1], LEFT_STACK = [0, 2];
/** Global (row, col) of each cell in the L-shaped part of the 9×9 grid. */
export const CORNER_SUDOKU_CELL_POS_V2 = Object.freeze(
  Array.from({ length: CORNER_SUDOKU_CELLS_V2 }, (_, i) => {
    const box = Math.floor(i / 9), r = Math.floor((i % 9) / 3), c = i % 3;
    const [r0, c0] = CORNER_SUDOKU_BOXES_V2[box];
    return { box, r, c, row: r0 + r, col: c0 + c };
  }),
);
/** Peers that may not share a digit with each cell: same box, same top row (A–B–D), same left column (A–C–E). */
export const CORNER_SUDOKU_PEERS_V2 = Object.freeze(
  CORNER_SUDOKU_CELL_POS_V2.map((p, i) =>
    CORNER_SUDOKU_CELL_POS_V2.flatMap((q, j) => {
      if (i === j) return [];
      const sameBox = p.box === q.box;
      const sharedRow = TOP_BAND.includes(p.box) && TOP_BAND.includes(q.box) && p.row === q.row;
      const sharedCol = LEFT_STACK.includes(p.box) && LEFT_STACK.includes(q.box) && p.col === q.col;
      return sameBox || sharedRow || sharedCol ? [j] : [];
    }),
  ),
);
const PEERS = CORNER_SUDOKU_PEERS_V2;

export type CornerSudokuPuzzleV2 = { givens: number[]; solution: number[] };
export type CornerSudokuEventV2 = { tick: number; cell: number; digit: number; ok: boolean; points: number };
export type CornerSudokuStateV2 = CoreState & {
  seed: string;
  puzzles: CornerSudokuPuzzleV2[];
  current: number;
  phase: "play" | "clear";
  phaseTick: number;
  board: number[];
  puzzleStartTick: number;
  mistakes: number;
  solved: number;
  solveTicks: number[];
  lastEvent: CornerSudokuEventV2 | null;
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
  for (let i = 0; i < CORNER_SUDOKU_CELLS_V2; i++) {
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
export function countCornerSudokuSolutionsV2(board: number[], limit = 2): number {
  let best = -1, bestCands: number[] = [];
  for (let i = 0; i < CORNER_SUDOKU_CELLS_V2; i++) {
    if (board[i]) continue;
    const c = candidates(board, i);
    if (c.length === 0) return 0;
    if (best < 0 || c.length < bestCands.length) { best = i; bestCands = c; }
  }
  if (best < 0) return 1;
  let total = 0;
  for (const d of bestCands) {
    board[best] = d;
    total += countCornerSudokuSolutionsV2(board, limit - total);
    if (total >= limit) break;
  }
  board[best] = 0;
  return total;
}

/** A digit is correct if it repeats nothing and the board can still be completed. */
export function cornerSudokuDigitOkV2(board: readonly number[], cell: number, digit: number) {
  if (board[cell] !== 0 || digit < 1 || digit > 9) return false;
  for (const q of PEERS[cell]) if (board[q] === digit) return false;
  const next = [...board];
  next[cell] = digit;
  return countCornerSudokuSolutionsV2(next, 1) >= 1;
}

export function cornerSudokuPuzzlesV2(seed: string): CornerSudokuPuzzleV2[] {
  return Array.from({ length: R.puzzles }, (_, index) => {
    const rng = createRng(`${seed}:corner-sudoku2:${index}`);
    const solution = new Array<number>(CORNER_SUDOKU_CELLS_V2).fill(0);
    fillSolution(solution, rng);
    const givens = [...solution];
    const order = Array.from({ length: CORNER_SUDOKU_CELLS_V2 }, (_, i) => i);
    for (let k = order.length - 1; k > 0; k--) {
      const j = rng.nextInt(k + 1);
      [order[k], order[j]] = [order[j], order[k]];
    }
    // Any completion is accepted, so carving needs no uniqueness: blank cells until the target count is left.
    for (let k = 0; k < CORNER_SUDOKU_CELLS_V2 - R.givens[index]; k++) givens[order[k]] = 0;
    return { givens, solution };
  });
}

export function createCornerSudokuV2(seed: string): CornerSudokuStateV2 {
  const puzzles = cornerSudokuPuzzlesV2(seed);
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

export function canApplyCornerSudokuV2(s: CornerSudokuStateV2, a: string) {
  if (s.status !== "running" || s.phase !== "play" || !CORNER_SUDOKU_ACTIONS_V2.includes(a)) return false;
  const p = parse(a);
  return !!p && s.board[p.cell] === 0;
}

export function applyCornerSudokuV2(s: CornerSudokuStateV2, a: string) {
  const p = parse(a);
  if (!p) return;
  if (cornerSudokuDigitOkV2(s.board, p.cell, p.digit)) {
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

export function stepCornerSudokuV2(s: CornerSudokuStateV2) {
  s.tick++;
  if (s.phase === "clear" && s.tick - s.phaseTick >= R.clearTicks && s.current + 1 < R.puzzles) {
    s.current++;
    s.phase = "play";
    s.phaseTick = s.tick;
    s.board = [...s.puzzles[s.current].givens];
    s.puzzleStartTick = s.tick;
  }
}

export const CORNER_SUDOKU_CORE_V2: GameCore<CornerSudokuStateV2> = {
  gameId: "corner-sudoku",
  gameVersion: "2.0.0",
  width: 390,
  height: 620,
  tickRate: R.tickRate,
  maxFinalTick: R.maxFinalTick,
  maxInputs: CORNER_SUDOKU_CELLS_V2 * R.puzzles + R.maxMistakes + 5,
  inputVersion: 2,
  actions: CORNER_SUDOKU_ACTIONS_V2,
  content: {
    rules: R,
    layout: "galakdoku;corner-box+right+below;3-boxes-3x3;27-cells;no-repeat-rows-0-2-cols-0-2",
    generation: "seeded-backtracking-solution;seeded-carving;givens-12-11-10-9-8;any-completable-digit-is-correct",
    scoring: "correct20;wrong-50(min0);solve400+max(0,1200-ticks/12);5-mistakes-end;8min-clock",
  },
  create: createCornerSudokuV2,
  step: stepCornerSudokuV2,
  canApply: canApplyCornerSudokuV2,
  apply: applyCornerSudokuV2,
};
