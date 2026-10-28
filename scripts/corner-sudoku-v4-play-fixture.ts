/** Test-only bot for Galoku V4: fills cells from the solution; can write wrong digits and later fix them (overwrite or erase). */
import { applyCoreInput, stepCore } from "../lib/verified/coreRuntime.v1";
import type { ReplayInput } from "../lib/verified/inputValidation";
import { CORNER_SUDOKU_CORE_V4 as core } from "../lib/verified/cornerSudokuCore.v4";

export function playCornerSudokuV4(seed: string, opts: { delay?: number; wrongEvery?: number; erase?: boolean; idle?: boolean; stopAfter?: number } = {}, target = 1e9) {
  const s = core.create(seed), inputs: ReplayInput[] = [];
  const delay = opts.delay ?? 60;
  let last = -1000, placed = 0;
  const act = (action: string) => {
    if (!core.canApply(s, action)) return false;
    inputs.push({ seq: inputs.length, tick: s.tick, action });
    applyCoreInput(core, s, action, target);
    last = s.tick;
    return true;
  };
  while (s.status === "running") {
    if (!opts.idle && s.phase === "play" && s.tick - last >= delay && (opts.stopAfter === undefined || placed < opts.stopAfter)) {
      const sol = s.puzzles[s.current].solution;
      const wrongCell = s.board.findIndex((d, i) => d !== 0 && d !== sol[i]);
      if (wrongCell >= 0 && placed % 3 === 0) {
        // Fix a mistake: erase it, or overwrite it with the right digit.
        act(opts.erase ? `CLR_${wrongCell}` : `PUT_${wrongCell}_${sol[wrongCell]}`);
      } else {
        const cell = s.board.findIndex((d) => d === 0);
        if (cell >= 0) {
          const wrong = opts.wrongEvery && placed % opts.wrongEvery === opts.wrongEvery - 1;
          act(`PUT_${cell}_${wrong ? (sol[cell] % 9) + 1 : sol[cell]}`);
        } else if (wrongCell >= 0) act(opts.erase ? `CLR_${wrongCell}` : `PUT_${wrongCell}_${sol[wrongCell]}`);
      }
      placed++;
    }
    if (s.status === "running") stepCore(core, s, target);
  }
  return { s, inputs };
}
