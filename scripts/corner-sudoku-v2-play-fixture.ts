/** Test-only bot for Corner Sudoku V2: fills cells from the solution, optionally with mistakes and pauses. */
import { applyCoreInput, stepCore } from "../lib/verified/coreRuntime.v1";
import type { ReplayInput } from "../lib/verified/inputValidation";
import { CORNER_SUDOKU_CORE_V2 as core, cornerSudokuDigitOkV2 } from "../lib/verified/cornerSudokuCore.v2";

export function playCornerSudokuV2(seed: string, opts: { delay?: number; wrongEvery?: number; idle?: boolean } = {}, target = 1e9) {
  const s = core.create(seed), inputs: ReplayInput[] = [];
  const delay = opts.delay ?? 60;
  let last = -1000, placed = 0;
  while (s.status === "running") {
    if (!opts.idle && s.phase === "play" && s.tick - last >= delay) {
      const cell = s.board.findIndex((d) => d === 0);
      if (cell >= 0) {
        const seeded = s.puzzles[s.current].solution[cell];
        const right = cornerSudokuDigitOkV2(s.board, cell, seeded) ? seeded : [1, 2, 3, 4, 5, 6, 7, 8, 9].find((d) => cornerSudokuDigitOkV2(s.board, cell, d)) ?? seeded;
        const wrong = opts.wrongEvery && placed % opts.wrongEvery === opts.wrongEvery - 1;
        const digit = wrong ? ([1, 2, 3, 4, 5, 6, 7, 8, 9].find((d) => !cornerSudokuDigitOkV2(s.board, cell, d)) ?? right) : right;
        const action = `PUT_${cell}_${digit}`;
        if (core.canApply(s, action)) {
          inputs.push({ seq: inputs.length, tick: s.tick, action });
          applyCoreInput(core, s, action, target);
          last = s.tick;
          placed++;
        }
      }
    }
    if (s.status === "running") stepCore(core, s, target);
  }
  return { s, inputs };
}
