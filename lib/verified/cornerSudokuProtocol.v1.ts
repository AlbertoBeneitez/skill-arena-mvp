/** Corner Sudoku V1 input protocol: place digit D (1–9) in cell C (0–44). Layout and selection never enter it. */
export const CORNER_SUDOKU_CELLS = 45;
export const CORNER_SUDOKU_ACTIONS_V1 = Object.freeze(
  Array.from({ length: CORNER_SUDOKU_CELLS * 9 }, (_, i) => `PUT_${Math.floor(i / 9)}_${(i % 9) + 1}`),
) as readonly string[];
