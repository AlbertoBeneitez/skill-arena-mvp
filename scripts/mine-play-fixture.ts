import {
  mineDeductions,
  type MineState,
} from "../lib/verified/mineGridCore.v1";
import { mineAction } from "../lib/verified/mineGridProtocol.v1";
/** Test-only clue solver; no hidden indices are sent to the browser. */
export function nextMineAction(state: MineState) {
  if (!state.started) return mineAction("OPEN", state.board.startIndex);
  const deductions = mineDeductions(state.board, state.revealed, state.flagged);
  if (deductions.safe.length) return mineAction("OPEN", deductions.safe[0]);
  if (deductions.mines.length) return mineAction("FLAG", deductions.mines[0]);
  throw new Error("No deduction available");
}
