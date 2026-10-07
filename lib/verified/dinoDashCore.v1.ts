/**
 * Dino Dash competitive core v1.
 *
 * Endless-runner timing is adapted from the permissively licensed Chrome
 * T-Rex runner port by wayou (BSD-3-Clause). Skill Arena replaces the browser
 * runner, assets and non-authoritative timing with a seeded 120 Hz simulation.
 */

import { createRng } from "../deterministic/seeded";
import {
  validateInputSequence,
  type ReplayInput,
} from "./inputValidation";

export const DINO_DASH_V1 = {
  tickRate: 120,
  coordinateWidth: 390,
  coordinateHeight: 620,
  groundY: 508,
  playerX: 72,
  playerStandingHeight: 46,
  playerDuckHeight: 29,
  playerHitboxLeftInset: 5,
  playerHitboxRight: 36,
  playerHitboxTopInset: 4,
  playerHitboxBottomInset: 2,
  gravityPerSecond2: 1_150,
  jumpVelocityPerSecond: -455,
  initialSpeedPerSecond: 178,
  speedIncreasePerSecond2: 1.85,
  maxSpeedPerSecond: 390,
  distanceScorePerPixel: 0.42,
  initialSpawnX: 390,
  spawnLookahead: 700,
  scheduleLength: 600,
  inputProtocolVersion: 1,
  maxInputs: 5_000,
  maxFinalTick: 120 * 60 * 15,
  scoring: {
    cactus: 240,
    double: 300,
    flyer: 360,
  },
} as const;

export const DINO_DASH_ACTIONS = [
  "JUMP",
  "DUCK_DOWN",
  "DUCK_UP",
] as const;

export type DinoDashAction =
  (typeof DINO_DASH_ACTIONS)[number];

export type DinoDashInput = ReplayInput & {
  action: DinoDashAction;
};

export type DinoDashObstacleKind =
  | "cactus"
  | "double"
  | "flyer";

export type DinoDashObstacle = {
  worldX: number;
  kind: DinoDashObstacleKind;
  y: number;
  w: number;
  h: number;
  passed: boolean;
};

export type DinoDashFailure = "OBSTACLE_COLLISION" | null;

export type DinoDashState = {
  tick: number;
  status: "running" | "failed" | "won";
  failure: DinoDashFailure;
  y: number;
  vy: number;
  ducking: boolean;
  obstacles: DinoDashObstacle[];
  schedule: DinoDashScheduleItem[];
  scheduleIndex: number;
  nextSpawnX: number;
  scroll: number;
  scoreFloat: number;
  passedCount: number;
};

export type DinoDashReplayResult = {
  valid: boolean;
  error?: string;
  state: DinoDashState;
  score: number;
  timeMs: number;
  failure: DinoDashFailure;
};

export type DinoDashScheduleItem = Omit<DinoDashObstacle, "worldX" | "passed"> & {
  gap: number;
};

function buildSchedule(seed: string): DinoDashScheduleItem[] {
  const cfg = DINO_DASH_V1;
  const rng = createRng(`${seed}:dino-obstacles`);
  const items: DinoDashScheduleItem[] = [];

  for (let index = 0; index < cfg.scheduleLength; index += 1) {
    const roll = rng.nextInt(10);
    const kind: DinoDashObstacleKind =
      index < 5
        ? "cactus"
        : roll < 5
          ? "cactus"
          : roll < 8
            ? "double"
            : "flyer";

    items.push({
      gap: 250 + rng.nextInt(170),
      kind,
      y:
        kind === "flyer"
          ? cfg.groundY - (rng.nextInt(2) === 0 ? 74 : 116)
          : cfg.groundY,
      w: kind === "double" ? 48 : kind === "flyer" ? 40 : 27,
      h: kind === "flyer" ? 23 : kind === "double" ? 48 : 44,
    });
  }

  return items;
}

function fillObstacles(state: DinoDashState) {
  const schedule = state.schedule;
  const cfg = DINO_DASH_V1;

  while (
    state.nextSpawnX - state.scroll <
    cfg.coordinateWidth + cfg.spawnLookahead
  ) {
    const item = schedule[state.scheduleIndex % schedule.length];
    state.nextSpawnX += item.gap;
    state.obstacles.push({
      worldX: state.nextSpawnX,
      kind: item.kind,
      y: item.y,
      w: item.w,
      h: item.h,
      passed: false,
    });
    state.scheduleIndex += 1;
  }
}

export function dinoDashSpeedForTick(tick: number) {
  const cfg = DINO_DASH_V1;
  return Math.min(
    cfg.maxSpeedPerSecond,
    cfg.initialSpeedPerSecond +
      (tick / cfg.tickRate) * cfg.speedIncreasePerSecond2
  );
}

export function dinoDashScore(state: DinoDashState) {
  return Math.round(state.scoreFloat);
}

export function dinoDashIsGrounded(state: DinoDashState) {
  return (
    state.y >=
    DINO_DASH_V1.groundY -
      DINO_DASH_V1.playerStandingHeight -
      0.1
  );
}

export function createDinoDashState(seed: string): DinoDashState {
  const cfg = DINO_DASH_V1;
  const state: DinoDashState = {
    tick: 0,
    status: "running",
    failure: null,
    y: cfg.groundY - cfg.playerStandingHeight,
    vy: 0,
    ducking: false,
    obstacles: [],
    schedule: buildSchedule(seed),
    scheduleIndex: 0,
    nextSpawnX: cfg.initialSpawnX,
    scroll: 0,
    scoreFloat: 0,
    passedCount: 0,
  };

  fillObstacles(state);
  return state;
}

export function applyDinoDashAction(
  state: DinoDashState,
  action: DinoDashAction
) {
  if (state.status !== "running") return state;

  if (action === "JUMP") {
    if (!dinoDashIsGrounded(state)) return state;
    state.ducking = false;
    state.vy = DINO_DASH_V1.jumpVelocityPerSecond;
    // The 1 px lift removes ambiguity at the ground threshold on the same tick.
    state.y -= 1;
    return state;
  }

  state.ducking = action === "DUCK_DOWN";
  return state;
}

function fail(state: DinoDashState) {
  state.status = "failed";
  state.failure = "OBSTACLE_COLLISION";
}

export function stepDinoDash(
  state: DinoDashState,
  targetScore = Number.MAX_SAFE_INTEGER
) {
  if (state.status !== "running") return state;

  const cfg = DINO_DASH_V1;
  const dt = 1 / cfg.tickRate;

  state.tick += 1;

  const speed = dinoDashSpeedForTick(state.tick);
  state.scroll += speed * dt;
  state.scoreFloat += speed * dt * cfg.distanceScorePerPixel;

  fillObstacles(state);

  if (!dinoDashIsGrounded(state)) {
    state.vy += cfg.gravityPerSecond2 * dt;
    state.y += state.vy * dt;

    const groundY = cfg.groundY - cfg.playerStandingHeight;
    if (state.y >= groundY) {
      state.y = groundY;
      state.vy = 0;
    }
  }

  const grounded = dinoDashIsGrounded(state);
  const playerHeight =
    state.ducking && grounded
      ? cfg.playerDuckHeight
      : cfg.playerStandingHeight;
  const playerY =
    state.ducking && grounded
      ? cfg.groundY - playerHeight
      : state.y;
  const px1 = cfg.playerX + cfg.playerHitboxLeftInset;
  const px2 = cfg.playerX + cfg.playerHitboxRight;
  const py1 = playerY + cfg.playerHitboxTopInset;
  const py2 = playerY + playerHeight - cfg.playerHitboxBottomInset;

  for (const obstacle of state.obstacles) {
    const x = obstacle.worldX - state.scroll;
    const y1 =
      obstacle.kind === "flyer"
        ? obstacle.y - obstacle.h / 2
        : obstacle.y - obstacle.h;
    const y2 =
      obstacle.kind === "flyer"
        ? obstacle.y + obstacle.h / 2
        : obstacle.y;

    if (
      x + obstacle.w > px1 &&
      x < px2 &&
      y2 > py1 &&
      y1 < py2
    ) {
      fail(state);
      return state;
    }

    if (!obstacle.passed && x + obstacle.w < cfg.playerX) {
      obstacle.passed = true;
      state.scoreFloat += cfg.scoring[obstacle.kind];
      state.passedCount += 1;
    }
  }

  if (state.scoreFloat >= targetScore) {
    state.status = "won";
    state.failure = null;
    return state;
  }

  if (state.obstacles.length > 60) {
    state.obstacles = state.obstacles.filter(
      (obstacle) => obstacle.worldX - state.scroll > -100
    );
  }

  return state;
}

export function replayDinoDash(
  inputs: DinoDashInput[],
  finalTick: number,
  seed: string,
  targetScore = Number.MAX_SAFE_INTEGER
): DinoDashReplayResult {
  const protocolError = validateInputSequence(inputs, finalTick, {
    version: DINO_DASH_V1.inputProtocolVersion,
    allowedActions: DINO_DASH_ACTIONS,
    maxInputs: DINO_DASH_V1.maxInputs,
    maxFinalTick: DINO_DASH_V1.maxFinalTick,
  });

  const state = createDinoDashState(seed);

  if (protocolError) {
    return {
      valid: false,
      error: protocolError,
      state,
      score: 0,
      timeMs: 0,
      failure: null,
    };
  }

  let inputIndex = 0;

  while (state.status === "running") {
    while (
      inputIndex < inputs.length &&
      inputs[inputIndex].tick === state.tick &&
      state.status === "running"
    ) {
      applyDinoDashAction(state, inputs[inputIndex].action);
      inputIndex += 1;
    }

    if (state.status !== "running" || state.tick >= finalTick) {
      break;
    }

    stepDinoDash(state, targetScore);
  }

  const result = {
    state,
    score: dinoDashScore(state),
    timeMs: Math.round((state.tick * 1000) / DINO_DASH_V1.tickRate),
    failure: state.failure,
  };

  if (inputIndex !== inputs.length) {
    return { valid: false, error: "UNCONSUMED_INPUTS", ...result };
  }

  if (state.tick !== finalTick) {
    return {
      valid: false,
      error: "FINAL_TICK_AFTER_RESOLUTION",
      ...result,
    };
  }

  if (state.status === "running") {
    return {
      valid: false,
      error: "CLIENT_ENDED_BEFORE_RESOLUTION",
      ...result,
    };
  }

  return { valid: true, ...result };
}

export const DINO_DASH_V1_CONTENT = {
  mechanics: {
    tickRate: DINO_DASH_V1.tickRate,
    gravityPerSecond2: DINO_DASH_V1.gravityPerSecond2,
    jumpVelocityPerSecond: DINO_DASH_V1.jumpVelocityPerSecond,
    initialSpeedPerSecond: DINO_DASH_V1.initialSpeedPerSecond,
    speedIncreasePerSecond2: DINO_DASH_V1.speedIncreasePerSecond2,
    maxSpeedPerSecond: DINO_DASH_V1.maxSpeedPerSecond,
    scheduleLength: DINO_DASH_V1.scheduleLength,
  },
  scoring: DINO_DASH_V1.scoring,
  actions: DINO_DASH_ACTIONS,
  failureConditions: ["OBSTACLE_COLLISION"],
  endCondition: "FIRST_COLLISION_OR_TARGET",
  upstream: {
    project: "wayou/t-rex-runner",
    license: "BSD-3-Clause",
    commit: "5455bfa408ec6b707c7300ff194b7390733a766d",
  },
} as const;
