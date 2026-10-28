/**
 * Galoku (Corner Sudoku V4) input protocol: place digit D (1–9) in cell C (0–44), or clear cell C.
 * Selection never enters it.
 */
import { CORNER_SUDOKU_ACTIONS_V1, CORNER_SUDOKU_CELLS } from "./cornerSudokuProtocol.v1";

export const CORNER_SUDOKU_ACTIONS_V3 = Object.freeze([
  ...CORNER_SUDOKU_ACTIONS_V1,
  ...Array.from({ length: CORNER_SUDOKU_CELLS }, (_, c) => `CLR_${c}`),
]) as readonly string[];
