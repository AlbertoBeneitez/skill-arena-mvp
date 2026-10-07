/** Original toroidal grid rules, using shared replay/input/scenario infrastructure. */
import { hashSeed } from "../deterministic/seeded";
import type { GameCore, CoreState } from "./coreRuntime.v1";
export const SERPENT_V1 = {
  cols: 18,
  rows: 28,
  initialStepTicks: 17,
  minimumStepTicks: 9,
  foodsPerAcceleration: 2,
  pointsPerFood: 1000,
  maxFinalTick: 120 * 60 * 6,
  maxInputs: 3000,
} as const;
export const SERPENT_ACTIONS = ["UP", "DOWN", "LEFT", "RIGHT"] as const;
export type SerpentDirection = (typeof SERPENT_ACTIONS)[number];
export type SerpentPoint = { x: number; y: number };
export type SerpentState = CoreState & {
  seed: string;
  snake: SerpentPoint[];
  direction: SerpentDirection;
  queue: SerpentDirection[];
  food: SerpentPoint | null;
  foodIndex: number;
  foods: number;
  movementTicks: number;
  stepTicks: number;
  lastEatTick: number;
  wrapCount: number;
};
const vectors: Record<SerpentDirection, SerpentPoint> = {
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 },
};
const opposites: Record<SerpentDirection, SerpentDirection> = {
  UP: "DOWN",
  DOWN: "UP",
  LEFT: "RIGHT",
  RIGHT: "LEFT",
};
export function serpentNextPoint(
  point: SerpentPoint,
  direction: SerpentDirection,
): SerpentPoint {
  const v = vectors[direction];
  return {
    x: (point.x + v.x + SERPENT_V1.cols) % SERPENT_V1.cols,
    y: (point.y + v.y + SERPENT_V1.rows) % SERPENT_V1.rows,
  };
}
const same = (a: SerpentPoint, b: SerpentPoint) => a.x === b.x && a.y === b.y;
function food(state: SerpentState) {
  const size = SERPENT_V1.cols * SERPENT_V1.rows,
    occupied = new Set(state.snake.map((p) => p.y * SERPENT_V1.cols + p.x));
  if (occupied.size === size) {
    state.food = null;
    state.status = "won";
    return;
  }
  const free: number[] = [];
  for (let id = 0; id < size; id++) if (!occupied.has(id)) free.push(id);
  const chosen =
    free[
      hashSeed(`${state.seed}:serpent1:food:${state.foodIndex++}`) % free.length
    ];
  state.food = {
    x: chosen % SERPENT_V1.cols,
    y: Math.floor(chosen / SERPENT_V1.cols),
  };
}
export function createSerpentState(seed: string): SerpentState {
  const state: SerpentState = {
    tick: 0,
    status: "running",
    failure: null,
    score: 0,
    seed,
    snake: [
      { x: 9, y: 15 },
      { x: 8, y: 15 },
      { x: 7, y: 15 },
    ],
    direction: "RIGHT",
    queue: [],
    food: null,
    foodIndex: 0,
    foods: 0,
    movementTicks: 0,
    stepTicks: SERPENT_V1.initialStepTicks,
    lastEatTick: -100,
    wrapCount: 0,
  };
  food(state);
  return state;
}
export function canTurnSerpent(state: SerpentState, action: string) {
  const previous = state.queue.at(-1) ?? state.direction;
  return (
    state.status === "running" &&
    SERPENT_ACTIONS.includes(action as SerpentDirection) &&
    state.queue.length < 2 &&
    previous !== action &&
    opposites[previous] !== action
  );
}
export function stepSerpent(state: SerpentState) {
  state.tick++;
  state.movementTicks++;
  if (state.movementTicks < state.stepTicks) return;
  state.movementTicks = 0;
  state.direction = state.queue.shift() ?? state.direction;
  const old = state.snake[0],
    next = serpentNextPoint(old, state.direction),
    eating = state.food !== null && same(next, state.food);
  const body = eating ? state.snake : state.snake.slice(0, -1);
  if (body.some((p) => same(p, next))) {
    state.status = "failed";
    state.failure = "SELF_COLLISION";
    return;
  }
  if (Math.abs(next.x - old.x) > 1 || Math.abs(next.y - old.y) > 1)
    state.wrapCount++;
  state.snake.unshift(next);
  if (eating) {
    state.score += SERPENT_V1.pointsPerFood;
    state.foods++;
    state.lastEatTick = state.tick;
    state.stepTicks = Math.max(
      SERPENT_V1.minimumStepTicks,
      SERPENT_V1.initialStepTicks -
        Math.floor(state.foods / SERPENT_V1.foodsPerAcceleration),
    );
    food(state);
  } else state.snake.pop();
}
export const SERPENT_CORE: GameCore<SerpentState> = {
  gameId: "grid-serpent",
  gameVersion: "1.0.0",
  width: 390,
  height: 620,
  tickRate: 120,
  maxFinalTick: SERPENT_V1.maxFinalTick,
  maxInputs: SERPENT_V1.maxInputs,
  inputVersion: 1,
  actions: SERPENT_ACTIONS,
  content: {
    rules: SERPENT_V1,
    topology: "TOROIDAL_X_AND_Y",
    food: "INDEXED_HASH_OVER_ALL_FREE_CELLS",
    tail: "VACATING_TAIL_IS_NOT_A_COLLISION",
    controls: "TWO_TURN_QUEUE_NO_OPPOSITES",
  },
  create: createSerpentState,
  step: stepSerpent,
  canApply: canTurnSerpent,
  apply: (state, action) => {
    state.queue.push(action as SerpentDirection);
  },
};
