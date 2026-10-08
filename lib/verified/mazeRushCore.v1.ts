/** Original integer-grid evolution of the existing node/pursuer mechanics. */
import { createRng, seededShuffle } from "../deterministic/seeded";
import { MAZE_ACTIONS, type MazeAction } from "./mazeRushProtocol.v1";
import type { CoreState, GameCore } from "./coreRuntime.v1";
export const MAZE_RULES = {
  sectors: 3,
  lives: 3,
  initialReadyTicks: 240,
  sectorReadyTicks: 180,
  clearPauseTicks: 240,
  introSafeTicks: 960,
  protectionTicks: 240,
  pulseTicks: 960,
  maxFinalTick: 21600,
  maxInputs: 3000,
  inputCooldown: 6,
} as const;
export type MazeEnemy = {
  cell: number;
  home: number;
  tie: number;
  dormantUntil: number;
};
export type MazeBoard = {
  width: number;
  height: number;
  walls: boolean[];
  nodes: boolean[];
  pulses: boolean[];
  start: number;
  enemies: MazeEnemy[];
  total: number;
};
export type MazeState = CoreState & {
  seed: string;
  sector: number;
  board: MazeBoard;
  player: number;
  direction: MazeAction;
  queued: MazeAction;
  lastInputTick: number;
  nextMoveTick: number;
  nextEnemyTick: number;
  stageStart: number;
  readyAt: number;
  clearUntil: number | null;
  protectedUntil: number;
  poweredUntil: number;
  lives: number;
  collected: number;
  stageCollected: number;
  lastDamageTick: number;
  lastPickupTick: number;
  lastMoveTick: number;
  previousPlayer: number;
  moves: number;
};
const deltas = [
  [0, -1],
  [-1, 0],
  [0, 1],
  [1, 0],
] as const;
export function mazeNeighbor(b: MazeBoard, cell: number, action: string) {
  const i = MAZE_ACTIONS.indexOf(action as MazeAction);
  if (i < 0 || i > 3) return cell;
  const x = (cell % b.width) + deltas[i][0],
    y = Math.floor(cell / b.width) + deltas[i][1];
  return x >= 0 &&
    x < b.width &&
    y >= 0 &&
    y < b.height &&
    !b.walls[y * b.width + x]
    ? y * b.width + x
    : cell;
}
export function mazeDistances(b: MazeBoard, start: number) {
  const d = Array<number>(b.walls.length).fill(-1),
    q = [start];
  d[start] = 0;
  for (let i = 0; i < q.length; i++)
    for (const a of MAZE_ACTIONS.slice(0, 4)) {
      const n = mazeNeighbor(b, q[i], a);
      if (d[n] < 0) {
        d[n] = d[q[i]] + 1;
        q.push(n);
      }
    }
  return d;
}
export function buildMazeSector(seed: string, sector: number): MazeBoard {
  const rng = createRng(`${seed}:maze-rush-v1:${sector}`),
    width = 7 + sector * 2,
    height = 9 + sector * 2;
  const walls = Array.from({ length: width * height }, (_, i) => {
    const x = i % width,
      y = Math.floor(i / width);
    return (
      x === 0 ||
      y === 0 ||
      x === width - 1 ||
      y === height - 1 ||
      (x % 2 === 0 && y % 2 === 0)
    );
  });
  const start = (height - 2) * width + (Math.floor(width / 2) | 1),
    homes = [
      width + 1,
      2 * width - 2,
      3 * width + (Math.floor(width / 2) | 1),
    ].slice(0, sector);
  const b: MazeBoard = {
    width,
    height,
    walls,
    start,
    nodes: [],
    pulses: [],
    enemies: homes.map((home) => ({
      home,
      cell: home,
      tie: rng.nextInt(4),
      dormantUntil: 0,
    })),
    total: 0,
  };
  // Add corridors only while every floor remains reachable. Bounded construction,
  // no retries/fallback seed, no unconnected nodes and no enclosed start.
  const candidates = seededShuffle(
    walls
      .map((wall, i) => (!wall && i !== start && !homes.includes(i) ? i : -1))
      .filter((i) => i >= 0),
    `${seed}:maze-bars-v1:${sector}`,
  );
  let added = 0;
  for (const cell of candidates) {
    if (added >= sector * 3) break;
    const adjacent = MAZE_ACTIONS.slice(0, 4).filter(
      (a) => mazeNeighbor(b, cell, a) !== cell,
    );
    if (adjacent.length !== 2) continue;
    walls[cell] = true;
    const d = mazeDistances(b, start);
    if (walls.some((wall, i) => !wall && d[i] < 0)) walls[cell] = false;
    else added++;
  }
  b.nodes = walls.map((wall, i) => !wall && i !== start && !homes.includes(i));
  const d = mazeDistances(b, start),
    choices = seededShuffle(
      b.nodes.map((v, i) => (v ? i : -1)).filter((i) => i >= 0),
      `${seed}:maze-pulses-v1:${sector}`,
    ).sort((a, c) => d[a] - d[c]);
  b.pulses = walls.map(() => false);
  for (const fraction of [0.25, 0.55, 0.85])
    b.pulses[choices[Math.floor(choices.length * fraction)]] = true;
  b.total = b.nodes.filter(Boolean).length;
  return b;
}
export function mazeMovePeriod(s: MazeState) {
  return 20 - (s.sector - 1) * 2;
}
export function mazeEnemyPeriod(s: MazeState) {
  return 64 - (s.sector - 1) * 8;
}
export function mazeEnemiesAwake(s: MazeState) {
  return (
    s.tick >= s.stageStart + (s.sector === 1 ? 960 : 480) &&
    s.stageCollected >= (s.sector === 1 ? 12 : 4)
  );
}
export function mazeChasing(s: MazeState) {
  return Math.floor((s.tick - s.stageStart) / 480) % 3 !== 2;
}
export function createMazeRush(seed: string): MazeState {
  const board = buildMazeSector(seed, 1);
  return {
    seed,
    tick: 0,
    status: "running",
    score: 0,
    failure: null,
    sector: 1,
    board,
    player: board.start,
    direction: "STOP",
    queued: "STOP",
    lastInputTick: -6,
    nextMoveTick: 240,
    nextEnemyTick: 240,
    stageStart: 0,
    readyAt: 240,
    clearUntil: null,
    protectedUntil: 0,
    poweredUntil: 0,
    lives: 3,
    collected: 0,
    stageCollected: 0,
    lastDamageTick: -999,
    lastPickupTick: -999,
    lastMoveTick: 0,
    previousPlayer: board.start,
    moves: 0,
  };
}
function contact(s: MazeState, enemy: MazeEnemy) {
  if (s.tick < enemy.dormantUntil || s.tick < s.protectedUntil) return;
  if (s.tick < s.poweredUntil) {
    enemy.cell = enemy.home;
    enemy.dormantUntil = s.tick + 480;
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
  s.player = s.board.start;
  s.previousPlayer = s.player;
  s.direction = "STOP";
  s.queued = "STOP";
  s.protectedUntil = s.tick + 240;
  s.readyAt = s.tick + 120;
  s.nextMoveTick = s.readyAt;
  for (const e of s.board.enemies) {
    e.cell = e.home;
    e.dormantUntil = s.tick + 360;
  }
}
export function stepMazeRush(s: MazeState) {
  s.tick++;
  if (s.clearUntil !== null) {
    if (s.tick < s.clearUntil) return;
    s.clearUntil = null;
    s.board = buildMazeSector(s.seed, s.sector);
    s.player = s.board.start;
    s.previousPlayer = s.player;
    s.direction = "STOP";
    s.queued = "STOP";
    s.stageStart = s.tick;
    s.readyAt = s.tick + 180;
    s.nextMoveTick = s.readyAt;
    s.nextEnemyTick = s.readyAt;
    s.stageCollected = 0;
    s.poweredUntil = 0;
    s.protectedUntil = 0;
  }
  if (s.tick < s.readyAt) return;
  const oldPlayer = s.player,
    oldEnemies = s.board.enemies.map((e) => e.cell);
  if (s.tick >= s.nextMoveTick) {
    s.nextMoveTick = s.tick + mazeMovePeriod(s);
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
        s.stageCollected++;
        s.score += 100;
        if (s.board.pulses[next]) {
          s.board.pulses[next] = false;
          s.score += 200;
          s.poweredUntil = s.tick + 960;
          s.lastPickupTick = s.tick;
        }
      }
    }
  }
  const awake = mazeEnemiesAwake(s);
  if (awake && s.tick >= s.nextEnemyTick) {
    s.nextEnemyTick = s.tick + mazeEnemyPeriod(s);
    for (const e of s.board.enemies) {
      if (s.tick < e.dormantUntil) continue;
      const goal = mazeChasing(s) ? s.player : e.home,
        d = mazeDistances(s.board, goal);
      const actions = Array.from(
        { length: 4 },
        (_, i) => MAZE_ACTIONS[(i + e.tie) % 4],
      );
      const choices = actions
        .map((a) => mazeNeighbor(s.board, e.cell, a))
        .filter((n) => n !== e.cell);
      choices.sort((a, b) => d[a] - d[b]);
      e.cell = choices[0] ?? e.cell;
    }
  }
  if (awake)
    for (let i = 0; i < s.board.enemies.length; i++) {
      const e = s.board.enemies[i];
      if (
        e.cell === s.player ||
        (e.cell === oldPlayer && oldEnemies[i] === s.player)
      )
        contact(s, e);
      if (s.status !== "running") return;
    }
  if (s.stageCollected === s.board.total) {
    s.score += 500 * s.sector + 100 * s.lives;
    if (s.sector === 3) {
      s.status = "won";
      s.failure = null;
      return;
    }
    s.sector++;
    s.lives = Math.min(3, s.lives + 1);
    s.clearUntil = s.tick + 240;
  }
}
export const MAZE_CORE: GameCore<MazeState> = {
  gameId: "maze-rush",
  gameVersion: "1.0.0",
  width: 390,
  height: 620,
  tickRate: 120,
  maxFinalTick: 21600,
  maxInputs: 3000,
  inputVersion: 1,
  actions: MAZE_ACTIONS,
  content: {
    rules: MAZE_RULES,
    generator: "connected-post-and-corridor-9x11-11x13-13x15-seeded-pulses-v1",
    movement: "integer-tiles-20-18-16ticks;buffered-turns;explicit-stop",
    pursuers:
      "BFS-chase480x2-patrol480;stable-ties;64-56-48ticks;activation-grace;edge-swap",
    score:
      "unique-node100;pulse200;clear-sector500+lives100;damage-minus400;three-sectors-or-target",
  },
  create: createMazeRush,
  step: stepMazeRush,
  canApply: (s, a) =>
    s.clearUntil === null &&
    MAZE_ACTIONS.includes(a as MazeAction) &&
    s.queued !== a &&
    s.tick - s.lastInputTick >= 6,
  apply: (s, a) => {
    s.queued = a as MazeAction;
    if (a === "STOP") s.direction = "STOP";
    s.lastInputTick = s.tick;
  },
};
