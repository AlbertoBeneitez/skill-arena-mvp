import {
  mazeEnemiesAwakeV2,
  mazeEnemyAwakeV2,
  type MazeV2State,
} from "../lib/verified/mazeRushCore.v2";
import { chooseMazeRoute } from "./maze-route-fixture";
/** Test-only player; game rules and scoring never use this planner. */
export function chooseMazeActionV2(s: MazeV2State) {
  return chooseMazeRoute({
    board: s.board,
    player: s.player,
    tick: s.tick,
    poweredUntil: s.poweredUntil,
    awake: mazeEnemiesAwakeV2(s),
    activeEnemyCells: s.board.enemies
      .filter((_, i) => mazeEnemyAwakeV2(s, i))
      .map((e) => e.cell),
  });
}
