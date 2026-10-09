import {
  mazeEnemiesAwake,
  type MazeState,
} from "../lib/verified/mazeRushCore.v1";
import { chooseMazeRoute } from "./maze-route-fixture";
/** Frozen V1 planner behavior; only its shared public routing body is extracted. */
export function chooseMazeAction(s: MazeState) {
  if (s.clearUntil !== null) return null;
  return chooseMazeRoute({
    board: s.board,
    player: s.player,
    tick: s.tick,
    poweredUntil: s.poweredUntil,
    awake: mazeEnemiesAwake(s),
    activeEnemyCells: (s.board.enemies ?? [])
      .filter((e) => s.tick >= e.dormantUntil)
      .map((e) => e.cell),
  });
}
