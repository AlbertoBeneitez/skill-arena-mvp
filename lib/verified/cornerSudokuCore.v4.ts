/**
 * Galoku (Corner Sudoku V4) — same board as V3 (two sides of a sudoku meeting at the corner: five 3×3 boxes, 45 cells;
 * each box, each of the three top rows and each of the three left columns holds 1–9), now with TWO puzzles per match
 * and free entry: any digit can be written in an empty (non-given) cell, changed, or erased (CLR). Nothing is checked
 * while playing; a puzzle is solved the moment the whole board matches its (unique) solution. Solving scores a bonus
 * plus a speed bonus. If the clock runs out, each correctly filled cell of the current puzzle scores. Five-minute
 * clock. V1–V3 stay frozen.
 */
import { createRng } from "../deterministic/seeded";
import type { CoreState, GameCore } from "./coreRuntime.v1";
import { CORNER_SUDOKU_CELLS } from "./cornerSudokuProtocol.v1";
import { CORNER_SUDOKU_ACTIONS_V3 } from "./cornerSudokuProtocol.v3";
import { CORNER_SUDOKU_BOXES_V3, CORNER_SUDOKU_CELL_POS_V3, CORNER_SUDOKU_PEERS_V3, countCornerSudokuSolutionsV3 } from "./cornerSudokuCore.v3";

export const CORNER_SUDOKU_RULES_V4 = Object.freeze({
  tickRate: 120,
  maxFinalTick: 120 * 60 * 5,
  puzzles: 2,
  /** Target givens per puzzle out of 45 (uniqueness may keep a few more). */
  givens: [30, 26] as readonly number[],
  solveBonus: 600,
  timeBonusMax: 1500,
  timeBonusTicksPerPoint: 12,
  /** At the time limit: points per correctly filled (non-given) cell of the unfinished puzzle. */
  partialPoints: 15,
  clearTicks: 84,
});
const R = CORNER_SUDOKU_RULES_V4;
export const CORNER_SUDOKU_BOXES_V4 = CORNER_SUDOKU_BOXES_V3;
export const CORNER_SUDOKU_CELL_POS_V4 = CORNER_SUDOKU_CELL_POS_V3;
export const CORNER_SUDOKU_PEERS_V4 = CORNER_SUDOKU_PEERS_V3;
const PEERS = CORNER_SUDOKU_PEERS_V4;

export type CornerSudokuPuzzleV4 = { givens: number[]; solution: number[] };
export type CornerSudokuEventV4 = { tick: number; cell: number; digit: number; kind: "put" | "clear" | "solve" | "time"; points: number };
export type CornerSudokuStateV4 = CoreState & {
  seed: string;
  puzzles: CornerSudokuPuzzleV4[];
  current: number;
  phase: "play" | "clear";
  phaseTick: number;
  board: number[];
  puzzleStartTick: number;
  solved: number;
  solveTicks: number[];
  edits: number;
  lastEvent: CornerSudokuEventV4 | null;
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

export function cornerSudokuPuzzlesV4(seed: string): CornerSudokuPuzzleV4[] {
  return Array.from({ length: R.puzzles }, (_, index) => {
    const rng = createRng(`${seed}:corner-sudoku4:${index}`);
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

/** Cells whose digit repeats in a peer (rule check only: it never reveals the solution). */
export function cornerSudokuConflictsV4(board: readonly number[]) {
  return board.map((d, i) => d !== 0 && PEERS[i].some((p) => board[p] === d));
}

export function createCornerSudokuV4(seed: string): CornerSudokuStateV4 {
  const puzzles = cornerSudokuPuzzlesV4(seed);
  return {
    tick: 0, status: "running", score: 0, failure: null, seed, puzzles,
    current: 0, phase: "play", phaseTick: 0, board: [...puzzles[0].givens],
    puzzleStartTick: 0, solved: 0, solveTicks: [], edits: 0, lastEvent: null,
  };
}

function parse(a: string) {
  const put = /^PUT_(\d+)_(\d)$/.exec(a);
  if (put) return { cell: Number(put[1]), digit: Number(put[2]) };
  const clr = /^CLR_(\d+)$/.exec(a);
  return clr ? { cell: Number(clr[1]), digit: 0 } : null;
}

export function canApplyCornerSudokuV4(s: CornerSudokuStateV4, a: string) {
  if (s.status !== "running" || s.phase !== "play" || !CORNER_SUDOKU_ACTIONS_V3.includes(a)) return false;
  const p = parse(a);
  if (!p || p.cell >= CORNER_SUDOKU_CELLS || s.puzzles[s.current].givens[p.cell] !== 0) return false;
  return p.digit === 0 ? s.board[p.cell] !== 0 : s.board[p.cell] !== p.digit;
}

export function applyCornerSudokuV4(s: CornerSudokuStateV4, a: string) {
  const p = parse(a);
  if (!p) return;
  s.board[p.cell] = p.digit;
  s.edits++;
  s.lastEvent = { tick: s.tick, cell: p.cell, digit: p.digit, kind: p.digit ? "put" : "clear", points: 0 };
  const puzzle = s.puzzles[s.current];
  if (p.digit && s.board.every((d, i) => d === puzzle.solution[i])) {
    const elapsed = s.tick - s.puzzleStartTick;
    const points = R.solveBonus + Math.max(0, R.timeBonusMax - Math.floor(elapsed / R.timeBonusTicksPerPoint));
    s.solved++;
    s.solveTicks.push(elapsed);
    s.score += points;
    s.phase = "clear";
    s.phaseTick = s.tick;
    s.lastEvent = { tick: s.tick, cell: p.cell, digit: p.digit, kind: "solve", points };
    if (s.solved === R.puzzles) { s.status = "won"; s.failure = null; }
  }
}

export function stepCornerSudokuV4(s: CornerSudokuStateV4) {
  s.tick++;
  if (s.phase === "clear" && s.tick - s.phaseTick >= R.clearTicks && s.current + 1 < R.puzzles) {
    s.current++;
    s.phase = "play";
    s.phaseTick = s.tick;
    s.board = [...s.puzzles[s.current].givens];
    s.puzzleStartTick = s.tick;
  }
  // Last tick of the clock: the unfinished puzzle scores its correctly filled cells (the runtime then ends the match).
  if (s.tick >= R.maxFinalTick && s.status === "running" && s.phase === "play") {
    const puzzle = s.puzzles[s.current];
    const correct = s.board.filter((d, i) => puzzle.givens[i] === 0 && d !== 0 && d === puzzle.solution[i]).length;
    const points = correct * R.partialPoints;
    s.score += points;
    s.lastEvent = { tick: s.tick, cell: -1, digit: correct, kind: "time", points };
  }
}

export const CORNER_SUDOKU_CORE_V4: GameCore<CornerSudokuStateV4> = {
  gameId: "corner-sudoku",
  gameVersion: "4.0.0",
  width: 390,
  height: 620,
  tickRate: R.tickRate,
  maxFinalTick: R.maxFinalTick,
  maxInputs: 3000,
  inputVersion: 3,
  actions: CORNER_SUDOKU_ACTIONS_V3,
  content: {
    rules: R,
    layout: "sudoku-top-band+left-stack;5-boxes-3x3;45-cells;rows-0-2-and-cols-0-2-hold-1-9",
    generation: "seeded-backtracking-solution;seeded-carving-unique-solution;2-puzzles;givens-30-26",
    input: "free-entry;PUT-overwrites-non-given;CLR-erases;no-check-until-board-equals-solution",
    scoring: "solve600+max(0,1500-ticks/12);time-limit:15-per-correct-filled-cell;5min-clock",
  },
  create: createCornerSudokuV4,
  step: stepCornerSudokuV4,
  canApply: canApplyCornerSudokuV4,
  apply: applyCornerSudokuV4,
};
