import { createPrivateHashRng } from "../deterministic/privateHashRng.server";
import type { CoreState, GameCore } from "./coreRuntime.v1";
import { MINE_ACTIONS, type MinePublicView } from "./mineGridProtocol.v1";
export const MINE_RULES = {
  levels: [
    { cols: 6, rows: 7, mines: 5 },
    { cols: 6, rows: 8, mines: 7 },
    { cols: 7, rows: 9, mines: 10 },
    { cols: 7, rows: 10, mines: 14 },
    { cols: 7, rows: 12, mines: 18 },
  ],
  safePoints: 120,
  clearBonus: 600,
  minimumClearBonus: 200,
  extraActionCost: 3,
  minePenalty: 250,
  lives: 2,
  generationAttempts: 256,
  maxInputs: 1000,
  commandLimit: 999,
} as const;
export type MineBoard = {
  cols: number;
  rows: number;
  mines: number;
  startIndex: number;
  values: number[];
};
export type MineState = CoreState & {
  seed: string;
  stage: number;
  board: MineBoard;
  revealed: boolean[];
  flagged: boolean[];
  started: boolean;
  levelActions: number;
  lives: number;
  event: MinePublicView["event"];
};
export function mineNeighbors(index: number, cols: number, rows: number) {
  const row = Math.floor(index / cols),
    col = index % cols,
    result: number[] = [];
  for (let y = -1; y <= 1; y++)
    for (let x = -1; x <= 1; x++) {
      if (!x && !y) continue;
      const r = row + y,
        c = col + x;
      if (r >= 0 && r < rows && c >= 0 && c < cols) result.push(r * cols + c);
    }
  return result;
}
function boardValues(mines: readonly number[], cols: number, rows: number) {
  const set = new Set(mines);
  return Array.from({ length: cols * rows }, (_, index) =>
    set.has(index)
      ? -1
      : mineNeighbors(index, cols, rows).filter((n) => set.has(n)).length,
  );
}
function flood(board: MineBoard, revealed: boolean[], index: number) {
  const queue = [index];
  for (let i = 0; i < queue.length; i++) {
    const n = queue[i];
    if (revealed[n] || board.values[n] === -1) continue;
    revealed[n] = true;
    if (board.values[n] === 0)
      for (const neighbor of mineNeighbors(n, board.cols, board.rows))
        if (!revealed[neighbor]) queue.push(neighbor);
  }
}
/** Generator acceptance uses only revealed clues and subset deductions, never a guess. */
export function mineDeductions(
  board: MineBoard,
  revealed: readonly boolean[],
  flags: readonly boolean[],
) {
  const safe = new Set<number>(),
    mines = new Set<number>(),
    constraints: { cells: number[]; remaining: number }[] = [];
  for (let i = 0; i < board.values.length; i++)
    if (revealed[i] && board.values[i] >= 0) {
      const ns = mineNeighbors(i, board.cols, board.rows),
        cells = ns.filter((n) => !revealed[n] && !flags[n]),
        remaining = board.values[i] - ns.filter((n) => flags[n]).length;
      if (remaining < 0 || remaining > cells.length) continue;
      if (remaining === 0) cells.forEach((n) => safe.add(n));
      else if (remaining === cells.length) cells.forEach((n) => mines.add(n));
      if (cells.length) constraints.push({ cells, remaining });
    }
  for (const a of constraints)
    for (const b of constraints) {
      if (
        a.cells.length >= b.cells.length ||
        !a.cells.every((n) => b.cells.includes(n))
      )
        continue;
      const diff = b.cells.filter((n) => !a.cells.includes(n)),
        remaining = b.remaining - a.remaining;
      if (remaining === 0) diff.forEach((n) => safe.add(n));
      else if (remaining === diff.length) diff.forEach((n) => mines.add(n));
    }
  return {
    safe: [...safe].sort((a, b) => a - b),
    mines: [...mines].sort((a, b) => a - b),
  };
}
export function isMineBoardSolvable(board: MineBoard) {
  const revealed = board.values.map(() => false),
    flags = board.values.map(() => false);
  flood(board, revealed, board.startIndex);
  for (let round = 0; round < board.values.length; round++) {
    if (revealed.filter(Boolean).length === board.values.length - board.mines)
      return true;
    const deductions = mineDeductions(board, revealed, flags);
    if (!deductions.safe.length && !deductions.mines.length) return false;
    for (const index of deductions.mines) {
      if (board.values[index] !== -1) return false;
      flags[index] = true;
    }
    for (const index of deductions.safe) {
      if (board.values[index] === -1) return false;
      flood(board, revealed, index);
    }
  }
  return false;
}
export function generateMineBoard(seed: string, stage: number): MineBoard {
  const level = MINE_RULES.levels[stage],
    startIndex = level.cols + 1,
    protectedCells = new Set([
      startIndex,
      ...mineNeighbors(startIndex, level.cols, level.rows),
    ]);
  const candidates = Array.from(
    { length: level.cols * level.rows },
    (_, i) => i,
  ).filter((i) => !protectedCells.has(i));
  for (let attempt = 0; attempt < MINE_RULES.generationAttempts; attempt++) {
    const rng = createPrivateHashRng(
        seed,
        `mine1:level:${stage}:candidate:${attempt}`,
      ),
      pool = [...candidates];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = rng.nextInt(i + 1);
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const board = {
      ...level,
      startIndex,
      values: boardValues(pool.slice(0, level.mines), level.cols, level.rows),
    };
    if (
      isMineBoardSolvable(board) &&
      openingCount(board) < board.values.length - board.mines
    )
      return board;
  }
  // Bounded constructive fallback: all remaining safe cells are in the opening flood.
  const total = level.cols * level.rows,
    board = {
      ...level,
      startIndex,
      values: boardValues(
        Array.from({ length: level.mines }, (_, i) => total - 1 - i),
        level.cols,
        level.rows,
      ),
    };
  if (!isMineBoardSolvable(board)) throw new Error("UNSOLVABLE_MINE_GENERATOR");
  return board;
}
function openingCount(board: MineBoard) {
  const open = board.values.map(() => false);
  flood(board, open, board.startIndex);
  return open.filter(Boolean).length;
}
function setLevel(state: MineState) {
  state.board = generateMineBoard(state.seed, state.stage);
  state.revealed = state.board.values.map(() => false);
  state.flagged = state.board.values.map(() => false);
  state.started = false;
  state.levelActions = 0;
}
export function createMineState(seed: string): MineState {
  const board = generateMineBoard(seed, 0);
  return {
    tick: 0,
    status: "running",
    failure: null,
    score: 0,
    seed,
    stage: 0,
    board,
    revealed: board.values.map(() => false),
    flagged: board.values.map(() => false),
    started: false,
    levelActions: 0,
    lives: MINE_RULES.lives,
    event: "NONE",
  };
}
export function projectMineState(state: MineState): MinePublicView {
  return {
    stage: state.stage,
    levels: MINE_RULES.levels.length,
    cols: state.board.cols,
    rows: state.board.rows,
    startIndex: state.board.startIndex,
    started: state.started,
    cells: state.board.values.map((v, i) => (state.revealed[i] ? v : null)),
    flagged: [...state.flagged],
    lives: state.lives,
    mines: state.board.mines,
    event: state.event,
  };
}
function parse(action: string) {
  const match = /^(OPEN|FLAG)_(\d{3})$/.exec(action);
  return match ? { kind: match[1], index: Number(match[2]) } : null;
}
export const MINE_GRID_CORE: GameCore<MineState> = {
  gameId: "mine-grid",
  gameVersion: "1.0.0",
  width: 390,
  height: 620,
  tickRate: 120,
  maxFinalTick: 1001,
  maxInputs: MINE_RULES.maxInputs,
  inputVersion: 1,
  actions: MINE_ACTIONS,
  content: {
    rules: MINE_RULES,
    generator: "mine1:level:candidate:private-hmac-stream-v1",
    scoringAuthority: "SERVER_REPLAY_ONLY",
    clock: "COMMAND_ORDINAL_NOT_REACTION_TIME",
  },
  create: createMineState,
  step(state) {
    state.tick++;
  },
  canApply(state, action) {
    const parsed = parse(action);
    return (
      !!parsed &&
      state.status === "running" &&
      parsed.index < state.board.values.length &&
      !state.revealed[parsed.index] &&
      (state.started ||
        (parsed.kind === "OPEN" && parsed.index === state.board.startIndex)) &&
      (parsed.kind === "FLAG" || !state.flagged[parsed.index])
    );
  },
  apply(state, action) {
    state.levelActions++;
    try {
      const { kind, index } = parse(action)!;
      if (kind === "FLAG") {
        state.flagged[index] = !state.flagged[index];
        state.event = "FLAG";
        return;
      }
      state.started = true;
      if (state.board.values[index] === -1) {
        state.revealed[index] = true;
        state.flagged[index] = true;
        state.lives--;
        state.score = Math.max(0, state.score - MINE_RULES.minePenalty);
        state.event = "BOMB";
        if (!state.lives) {
          state.status = "failed";
          state.failure = "MINES";
        }
        return;
      }
      const before = state.revealed.filter(
        (v, i) => v && state.board.values[i] >= 0,
      ).length;
      flood(state.board, state.revealed, index);
      const safe = state.revealed.filter(
        (v, i) => v && state.board.values[i] >= 0,
      ).length;
      state.score += (safe - before) * MINE_RULES.safePoints;
      state.event = "OPEN";
      if (safe === state.board.values.length - state.board.mines) {
        state.score += Math.max(
          MINE_RULES.minimumClearBonus,
          MINE_RULES.clearBonus -
            Math.max(0, state.levelActions - 1) * MINE_RULES.extraActionCost,
        );
        state.event = "CLEAR";
        if (state.stage === MINE_RULES.levels.length - 1) {
          state.status = "won";
          state.failure = null;
        } else {
          state.stage++;
          setLevel(state);
        }
      }
    } finally {
      if (
        state.status === "running" &&
        state.tick >= MINE_RULES.commandLimit - 1
      ) {
        state.status = "failed";
        state.failure = "COMMAND_LIMIT";
      }
    }
  },
};
