/** Continuous original Maze Rush rules. Published V1 remains immutable. */
import { MAZE_ACTIONS, type MazeAction } from "./mazeRushProtocol.v1";
import {
  buildMazeSector,
  mazeDistances,
  mazeNeighbor,
  type MazeBoard,
  type MazeEnemy,
} from "./mazeRushCore.v1";
import type { CoreState, GameCore } from "./coreRuntime.v1";

export const MAZE_V2_RULES = {
  lives: 3,
  initialReadyTicks: 180,
  firstPursuerTicks: 1920,
  firstPursuerNodes: 18,
  secondPursuerTicks: 3120,
  secondPursuerNodes: 34,
  armingTicks: 180,
  protectionTicks: 360,
  pursuerRecoveryTicks: 360,
  capturedRecoveryTicks: 480,
  pulseTicks: 960,
  maxFinalTick: 18000,
  maxInputs: 2500,
  inputCooldown: 6,
} as const;

export type MazeV2State = CoreState & {
  seed: string;
  board: MazeBoard;
  player: number;
  direction: MazeAction;
  queued: MazeAction;
  lastInputTick: number;
  nextMoveTick: number;
  nextEnemyTick: number;
  enemyReadyAt: (number | null)[];
  protectedUntil: number;
  poweredUntil: number;
  lives: number;
  collected: number;
  lastDamageTick: number;
  lastPickupTick: number;
  lastMoveTick: number;
  previousPlayer: number;
  moves: number;
};

/** The frozen connected generator is reused once, never between portions of play. */
export function buildMazeBoardV2(seed: string): MazeBoard {
  return buildMazeSector(`${seed}:maze-rush-v2`, 2);
}

export function mazeMovePeriodV2(s: Pick<MazeV2State, "collected" | "board">) {
  return 24 - Math.floor((4 * s.collected) / s.board.total);
}

export function mazeEnemyPeriodV2(s: Pick<MazeV2State, "collected" | "board">) {
  return 84 - Math.floor((24 * s.collected) / s.board.total);
}

/** Each pursuer joins the same existing board, with time and progress both required. */
export function mazeEnemyAwakeV2(
  s: Pick<MazeV2State, "tick" | "enemyReadyAt" | "board">,
  index: number,
) {
  const enemy = s.board.enemies[index],
    readyAt = s.enemyReadyAt[index];
  return (
    !!enemy &&
    readyAt != null &&
    s.tick >= readyAt &&
    s.tick >= enemy.dormantUntil
  );
}

/** This warning never pauses inputs, traversal or pickups on the existing board. */
export function mazeEnemyPreparingV2(
  s: Pick<MazeV2State, "tick" | "enemyReadyAt" | "board">,
  index: number,
) {
  const readyAt = s.enemyReadyAt[index];
  return !!s.board.enemies[index] && readyAt != null && s.tick < readyAt;
}

export function mazeEnemiesAwakeV2(
  s: Pick<MazeV2State, "tick" | "enemyReadyAt" | "board">,
) {
  return s.board.enemies.some((_, i) => mazeEnemyAwakeV2(s, i));
}

export function mazeChasingV2(s: Pick<MazeV2State, "tick">) {
  return Math.floor(s.tick / 480) % 3 !== 2;
}

export function createMazeRushV2(seed: string): MazeV2State {
  const board = buildMazeBoardV2(seed);
  return {
    seed,
    tick: 0,
    status: "running",
    score: 0,
    failure: null,
    board,
    player: board.start,
    direction: "STOP",
    queued: "STOP",
    lastInputTick: -MAZE_V2_RULES.inputCooldown,
    nextMoveTick: MAZE_V2_RULES.initialReadyTicks,
    nextEnemyTick: MAZE_V2_RULES.initialReadyTicks,
    enemyReadyAt: board.enemies.map(() => null),
    protectedUntil: 0,
    poweredUntil: 0,
    lives: MAZE_V2_RULES.lives,
    collected: 0,
    lastDamageTick: -999,
    lastPickupTick: -999,
    lastMoveTick: 0,
    previousPlayer: board.start,
    moves: 0,
  };
}

function contact(s: MazeV2State, enemy: MazeEnemy) {
  if (s.tick < enemy.dormantUntil || s.tick < s.protectedUntil) return;
  if (s.tick < s.poweredUntil) {
    enemy.cell = enemy.home;
    enemy.dormantUntil = s.tick + MAZE_V2_RULES.capturedRecoveryTicks;
    return;
  }
  s.lives--;
  s.score = Math.max(0, s.score - 400);
  s.lastDamageTick = s.tick;
  if (!s.lives) {
    s.status = "failed";
    s.failure = "PURSUER_COLLISION";
    return;
  }
  // Damage preserves the player's position, buffered route and collected board.
  s.protectedUntil = s.tick + MAZE_V2_RULES.protectionTicks;
  for (const e of s.board.enemies)
    e.dormantUntil = Math.max(
      e.dormantUntil,
      s.tick + MAZE_V2_RULES.pursuerRecoveryTicks,
    );
}

export function stepMazeRushV2(s: MazeV2State) {
  s.tick++;
  if (s.tick < MAZE_V2_RULES.initialReadyTicks) return;
  const oldPlayer = s.player,
    oldEnemies = s.board.enemies.map((e) => e.cell);
  if (s.tick >= s.nextMoveTick) {
    s.nextMoveTick = s.tick + mazeMovePeriodV2(s);
    if (s.queued === "STOP") s.direction = "STOP";
    else if (mazeNeighbor(s.board, s.player, s.queued) !== s.player)
      s.direction = s.queued;
    const next = mazeNeighbor(s.board, s.player, s.direction);
    if (next !== s.player) {
      s.previousPlayer = s.player;
      s.player = next;
      s.lastMoveTick = s.tick;
      s.moves++;
      if (s.board.nodes[next]) {
        s.board.nodes[next] = false;
        s.collected++;
        s.score += 100;
        if (s.board.pulses[next]) {
          s.board.pulses[next] = false;
          s.score += 200;
          s.poweredUntil = s.tick + MAZE_V2_RULES.pulseTicks;
          s.lastPickupTick = s.tick;
        }
      }
    }
  }
  for (let i = 0; i < s.board.enemies.length; i++) {
    if (s.enemyReadyAt[i] !== null) continue;
    const eligible =
      i === 0
        ? s.tick >= MAZE_V2_RULES.firstPursuerTicks &&
          s.collected >= MAZE_V2_RULES.firstPursuerNodes
        : s.tick >= MAZE_V2_RULES.secondPursuerTicks &&
          s.collected >= MAZE_V2_RULES.secondPursuerNodes;
    if (eligible) s.enemyReadyAt[i] = s.tick + MAZE_V2_RULES.armingTicks;
  }
  if (mazeEnemiesAwakeV2(s) && s.tick >= s.nextEnemyTick) {
    s.nextEnemyTick = s.tick + mazeEnemyPeriodV2(s);
    for (let i = 0; i < s.board.enemies.length; i++) {
      if (!mazeEnemyAwakeV2(s, i)) continue;
      const e = s.board.enemies[i],
        goal = mazeChasingV2(s) ? s.player : e.home,
        d = mazeDistances(s.board, goal),
        actions = Array.from(
          { length: 4 },
          (_, a) => MAZE_ACTIONS[(a + e.tie) % 4],
        ),
        choices = actions
          .map((a) => mazeNeighbor(s.board, e.cell, a))
          .filter((n) => n !== e.cell);
      choices.sort((a, b) => d[a] - d[b]);
      e.cell = choices[0] ?? e.cell;
    }
  }
  for (let i = 0; i < s.board.enemies.length; i++) {
    if (!mazeEnemyAwakeV2(s, i)) continue;
    const e = s.board.enemies[i];
    if (
      e.cell === s.player ||
      (e.cell === oldPlayer && oldEnemies[i] === s.player)
    )
      contact(s, e);
    if (s.status !== "running") return;
  }
  if (s.collected === s.board.total) {
    s.score += 500 + 100 * s.lives;
    s.status = "won";
    s.failure = null;
  }
}

export const MAZE_CORE_V2: GameCore<MazeV2State> = {
  gameId: "maze-rush",
  gameVersion: "2.0.0",
  width: 390,
  height: 620,
  tickRate: 120,
  maxFinalTick: MAZE_V2_RULES.maxFinalTick,
  maxInputs: MAZE_V2_RULES.maxInputs,
  inputVersion: 1,
  actions: MAZE_ACTIONS,
  content: {
    rules: MAZE_V2_RULES,
    generator:
      "single-connected11x13-frozen-v1-generator:maze-rush-v2-namespace",
    movement:
      "integer-tiles;24-to20ticks-by-collected-ratio;buffered-turns;stop",
    pursuers:
      "two-progress-and-time-gated;each-arms180ticks-once-before-movement-or-contact;BFS-chase960-patrol480;stable-ties;84-to60ticks-by-collected-ratio;edge-swap",
    damage: "three-shields;360ticks-protection;no-player-reset-or-board-reset",
    score:
      "unique-node100;pulse200;clear-once500+lives100;damage-minus400;single-board-or-target",
  },
  create: createMazeRushV2,
  step: stepMazeRushV2,
  canApply: (s, a) =>
    MAZE_ACTIONS.includes(a as MazeAction) &&
    s.queued !== a &&
    s.tick - s.lastInputTick >= MAZE_V2_RULES.inputCooldown,
  apply: (s, a) => {
    s.queued = a as MazeAction;
    if (a === "STOP") s.direction = "STOP";
    s.lastInputTick = s.tick;
  },
};
