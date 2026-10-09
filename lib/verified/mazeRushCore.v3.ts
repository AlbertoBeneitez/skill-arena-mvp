/** Continuous V3: a more readable turn cadence over the frozen V2 movement kernel. */
import {
  MAZE_CORE_V2,
  createMazeRushV2,
  stepMazeRushV2,
  type MazeV2State,
} from "./mazeRushCore.v2";
import type { GameCore } from "./coreRuntime.v1";

export type MazeV3State = MazeV2State & { height: number };
export const MAZE_V3_RULES = {
  initialMoveTicks: 38,
  finalMoveTicks: 30,
  initialEnemyTicks: 132,
  finalEnemyTicks: 100,
} as const;
export function mazeMovePeriodV3(
  state: Pick<MazeV2State, "collected" | "board">,
) {
  return (
    MAZE_V3_RULES.initialMoveTicks -
    Math.floor(
      ((MAZE_V3_RULES.initialMoveTicks - MAZE_V3_RULES.finalMoveTicks) *
        state.collected) /
        state.board.total,
    )
  );
}
function enemyPeriod(state: MazeV2State) {
  return (
    MAZE_V3_RULES.initialEnemyTicks -
    Math.floor(
      ((MAZE_V3_RULES.initialEnemyTicks - MAZE_V3_RULES.finalEnemyTicks) *
        state.collected) /
        state.board.total,
    )
  );
}
export const MAZE_CORE_V3: GameCore<MazeV3State> = {
  ...MAZE_CORE_V2,
  gameVersion: "3.0.0",
  content: {
    base: MAZE_CORE_V2.content,
    cadence: MAZE_V3_RULES,
    scheduling:
      "replace-next-deadline-after-frozen-v2-kernel-update;same-movement-contact-and-arming-order",
    reach:
      "unique-collected-nodes;retained-after-damage;never-derived-from-score",
  },
  create: (seed) => ({ ...createMazeRushV2(seed), height: 0 }),
  step: (state) => {
    const moveDeadline = state.nextMoveTick,
      enemyDeadline = state.nextEnemyTick;
    stepMazeRushV2(state);
    if (state.nextMoveTick !== moveDeadline)
      state.nextMoveTick = state.tick + mazeMovePeriodV3(state);
    if (state.nextEnemyTick !== enemyDeadline)
      state.nextEnemyTick = state.tick + enemyPeriod(state);
    state.height = state.collected;
  },
};
