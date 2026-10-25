/** Galakdoku (Corner Sudoku V2) input protocol: place digit D (1–9) in cell C (0–26). Selection never enters it. */
export const CORNER_SUDOKU_CELLS_V2 = 27;
export const CORNER_SUDOKU_ACTIONS_V2 = Object.freeze(
  Array.from({ length: CORNER_SUDOKU_CELLS_V2 * 9 }, (_, i) => `PUT_${Math.floor(i / 9)}_${(i % 9) + 1}`),
) as readonly string[];
