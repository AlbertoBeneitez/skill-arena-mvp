/** Private candidate V2. One continuous field; V1 stays frozen. Never bundle this module. */
import {
  MINE_GRID_CORE as V1,
  MINE_RULES,
  generateMineBoard,
  projectMineState as projectV1,
  type MineState,
} from "./mineGridCore.v1";
import type { GameCore } from "./coreRuntime.v1";
import type { MinePublicViewV2 } from "./mineGridProtocol.v2";
export type MineStateV2 = MineState & { height: number };
export function createMineV2(seed: string): MineStateV2 {
  const board = generateMineBoard(seed, 4);
  // Use the frozen V1 deduction/reveal kernel at its terminal board index only.
  // It can never transition to another field. No hidden board is sent to the client.
  return {
    tick: 0,
    status: "running",
    failure: null,
    score: 0,
    seed,
    stage: 4,
    board,
    revealed: board.values.map(() => false),
    flagged: board.values.map(() => false),
    started: false,
    levelActions: 0,
    lives: MINE_RULES.lives,
    event: "NONE",
    height: 0,
  };
}
export function projectMineV2(s: MineStateV2): MinePublicViewV2 {
  const { stage: _stage, levels: _levels, ...view } = projectV1(s);
  return { ...view, reach: s.height };
}
export const MINE_GRID_CORE_V2: GameCore<MineStateV2> = {
  ...V1,
  gameVersion: "2.0.0",
  content: {
    rules: {
      cols: 7,
      rows: 12,
      mines: 18,
      lives: 2,
      safePoints: 120,
      clearBonus: 600,
      minimumClearBonus: 200,
      extraActionCost: 3,
      minePenalty: 250,
      commandLimit: 999,
      generationAttempts: 256,
    },
    generator:
      "private-hmac-mine1-terminal-board-kernel-one-continuous-field-v2",
    clock: "COMMAND_ORDINAL_NOT_REACTION_TIME",
    scoringAuthority: "SERVER_REPLAY_ONLY",
    reach: "unique-revealed-safe-cells",
    completion: "one-field-clear/no-replacement",
  },
  create: createMineV2,
  apply(s, a) {
    V1.apply(s, a);
    s.height = s.revealed.filter((v, i) => v && s.board.values[i] >= 0).length;
  },
};
