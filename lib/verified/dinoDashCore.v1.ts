/**
 * Dino Dash competitive core v1.
 *
 * Endless-runner timing is inspired by the BSD-3-Clause T-Rex runner port by
 * wayou. Skill Arena replaces sprites, random obstacle timing and browser
 * state with this deterministic fixed-timestep core.
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
  groundYMilli: 508_000,
  playerXMilli: 72_000,
  playerHitboxLeftOffsetMilli: 5_000,
  playerHitboxRightOffsetMilli: 36_000,
  playerStandingHeightMilli: 46_000,
  playerDuckingHeightMilli: 29_000,
  playerHitboxTopInsetMilli: 4_000,
  playerHitboxBottomInsetMilli: 2_000,
  gravityMilliPerSecond2: 1_150_000,
  jumpVelocityMilliPerSecond: -455_000,
  initialSpeedMilliPerSecond: 178_000,
  speedIncreaseMilliPerSecondPerSecond: 1_850,
  maxSpeedMilliPerSecond: 390_000,
  initialSpawnXMilli: 390_000,
  spawnAheadMilli: 1_090_000,
  trimBehindMilli: -100_000,
  inputProtocolVersion: 1,
  maxInputs: 5_000,
  maxFinalTick: 120 * 60 * 15,
  scoring: {
    distanceNumerator: 42,
    distanceDenominator: 100,
    cactusBonus: 240,
    doubleBonus: 300,
    flyerBonus: 360,
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
  index: number;
  worldXMilli: number;
  kind: DinoDashObstacleKind;
  yMilli: number;
  wMilli: number;
  hMilli: number;
  passed: boolean;
};

export type DinoDashFailure =
  | "OBSTACLE_COLLISION"
  | "TIMEOUT"
  | null;

export type DinoDashState = {
  tick: number;
  status: "running" | "failed" | "won";
  failure: DinoDashFailure;

  yMilli: number;
  vyMilliPerSecond: number;
  velocityRemainder: number;
  yRemainder: number;
  ducking: boolean;

  scrollMilli: number;
  scrollRemainder: number;
  score: number;
  distanceScoreRemainder: number;
  passed: number;

  obstacles: DinoDashObstacle[];
  nextObstacleIndex: number;
  nextSpawnXMilli: number;
};

export type DinoDashReplayResult = {
  valid: boolean;
  error?: string;
  state: DinoDashState;
  score: number;
  timeMs: number;
  failure: DinoDashFailure;
};

function obstacleSpec(seed: string, index: number) {
  const rng = createRng(`${seed}:dino-obstacle:${index}`);
  const roll = rng.nextInt(10);
  const kind: DinoDashObstacleKind =
    index < 5
      ? "cactus"
      : roll < 5
        ? "cactus"
        : roll < 8
          ? "double"
          : "flyer";

  return {
    gapMilli: 250_000 + rng.nextInt(170_000),
    kind,
    yMilli:
      kind === "flyer"
        ? DINO_DASH_V1.groundYMilli -
          (rng.nextInt(2) === 0 ? 40_000 : 46_000)
        : DINO_DASH_V1.groundYMilli,
    wMilli:
      kind === "double"
        ? 48_000
        : kind === "flyer"
          ? 40_000
          : 27_000,
    hMilli:
      kind === "flyer"
        ? 23_000
        : kind === "double"
          ? 48_000
          : 44_000,
  };
}

function speedForTick(tick: number) {
  const cfg = DINO_DASH_V1;
  return Math.min(
    cfg.maxSpeedMilliPerSecond,
    cfg.initialSpeedMilliPerSecond +
      Math.floor(
        (Math.max(0, tick) *
          cfg.speedIncreaseMilliPerSecondPerSecond) /
          cfg.tickRate
      )
  );
}

export function dinoDashPlayerGroundYMilli() {
  return (
    DINO_DASH_V1.groundYMilli -
    DINO_DASH_V1.playerStandingHeightMilli
  );
}

export function isDinoDashGrounded(state: DinoDashState) {
  return (
    state.yMilli >= dinoDashPlayerGroundYMilli() - 100
  );
}

function appendObstacle(
  state: DinoDashState,
  seed: string
) {
  const spec = obstacleSpec(
    seed,
    state.nextObstacleIndex
  );
  state.nextSpawnXMilli += spec.gapMilli;
  state.obstacles.push({
    index: state.nextObstacleIndex,
    worldXMilli: state.nextSpawnXMilli,
    kind: spec.kind,
    yMilli: spec.yMilli,
    wMilli: spec.wMilli,
    hMilli: spec.hMilli,
    passed: false,
  });
  state.nextObstacleIndex += 1;
}

function trimAndFillObstacles(
  state: DinoDashState,
  seed: string
) {
  while (
    state.obstacles.length > 0 &&
    state.obstacles[0].worldXMilli -
      state.scrollMilli <
      DINO_DASH_V1.trimBehindMilli
  ) {
    state.obstacles.shift();
  }

  while (
    state.nextSpawnXMilli - state.scrollMilli <
    DINO_DASH_V1.spawnAheadMilli
  ) {
    appendObstacle(state, seed);
  }
}

export function createDinoDashState(
  seed: string
): DinoDashState {
  const state: DinoDashState = {
    tick: 0,
    status: "running",
    failure: null,

    yMilli: dinoDashPlayerGroundYMilli(),
    vyMilliPerSecond: 0,
    velocityRemainder: 0,
    yRemainder: 0,
    ducking: false,

    scrollMilli: 0,
    scrollRemainder: 0,
    score: 0,
    distanceScoreRemainder: 0,
    passed: 0,

    obstacles: [],
    nextObstacleIndex: 0,
    nextSpawnXMilli: DINO_DASH_V1.initialSpawnXMilli,
  };

  trimAndFillObstacles(state, seed);
  return state;
}

export function applyDinoDashInput(
  state: DinoDashState,
  action: DinoDashAction
) {
  if (state.status !== "running") return state;

  if (action === "JUMP") {
    if (!isDinoDashGrounded(state)) return state;

    state.ducking = false;
    state.vyMilliPerSecond =
      DINO_DASH_V1.jumpVelocityMilliPerSecond;
    state.velocityRemainder = 0;
    state.yRemainder = 0;
    state.yMilli = dinoDashPlayerGroundYMilli() - 1_000;
    return state;
  }

  if (action === "DUCK_DOWN") {
    state.ducking = true;
    return state;
  }

  state.ducking = false;
  return state;
}

function stepScrollAndScore(state: DinoDashState) {
  const cfg = DINO_DASH_V1;
  const speed = speedForTick(state.tick);

  state.scrollRemainder += speed;
  const scrollDelta = Math.floor(
    state.scrollRemainder / cfg.tickRate
  );
  state.scrollRemainder %= cfg.tickRate;
  state.scrollMilli += scrollDelta;

  state.distanceScoreRemainder +=
    speed * cfg.scoring.distanceNumerator;
  const scoreDivisor =
    cfg.tickRate *
    1000 *
    cfg.scoring.distanceDenominator;
  const scoreDelta = Math.floor(
    state.distanceScoreRemainder / scoreDivisor
  );
  state.distanceScoreRemainder -=
    scoreDelta * scoreDivisor;
  state.score += scoreDelta;
}

function stepJumpPhysics(state: DinoDashState) {
  if (isDinoDashGrounded(state)) {
    state.yMilli = dinoDashPlayerGroundYMilli();
    state.vyMilliPerSecond = 0;
    state.velocityRemainder = 0;
    state.yRemainder = 0;
    return;
  }

  const cfg = DINO_DASH_V1;
  state.velocityRemainder += cfg.gravityMilliPerSecond2;
  const deltaVelocity = Math.floor(
    state.velocityRemainder / cfg.tickRate
  );
  state.velocityRemainder %= cfg.tickRate;
  state.vyMilliPerSecond += deltaVelocity;

  state.yRemainder += state.vyMilliPerSecond;
  const yDelta =
    state.yRemainder >= 0
      ? Math.floor(state.yRemainder / cfg.tickRate)
      : Math.ceil(state.yRemainder / cfg.tickRate);
  state.yRemainder -= yDelta * cfg.tickRate;
  state.yMilli += yDelta;

  if (state.yMilli >= dinoDashPlayerGroundYMilli()) {
    state.yMilli = dinoDashPlayerGroundYMilli();
    state.vyMilliPerSecond = 0;
    state.velocityRemainder = 0;
    state.yRemainder = 0;
  }
}

function playerHitbox(state: DinoDashState) {
  const cfg = DINO_DASH_V1;
  const grounded = isDinoDashGrounded(state);
  const playerHeight =
    state.ducking && grounded
      ? cfg.playerDuckingHeightMilli
      : cfg.playerStandingHeightMilli;
  const playerY =
    state.ducking && grounded
      ? cfg.groundYMilli - playerHeight
      : state.yMilli;

  return {
    x1:
      cfg.playerXMilli +
      cfg.playerHitboxLeftOffsetMilli,
    x2:
      cfg.playerXMilli +
      cfg.playerHitboxRightOffsetMilli,
    y1: playerY + cfg.playerHitboxTopInsetMilli,
    y2:
      playerY +
      playerHeight -
      cfg.playerHitboxBottomInsetMilli,
  };
}

function obstacleBounds(obstacle: DinoDashObstacle) {
  const x1 = obstacle.worldXMilli;
  const x2 = obstacle.worldXMilli + obstacle.wMilli;
  const y1 =
    obstacle.kind === "flyer"
      ? obstacle.yMilli -
        Math.floor(obstacle.hMilli / 2)
      : obstacle.yMilli - obstacle.hMilli;
  const y2 =
    obstacle.kind === "flyer"
      ? obstacle.yMilli +
        Math.floor(obstacle.hMilli / 2)
      : obstacle.yMilli;

  return { x1, x2, y1, y2 };
}

function fail(
  state: DinoDashState,
  failure: Exclude<DinoDashFailure, null>
) {
  state.status = "failed";
  state.failure = failure;
}

function obstacleBonus(kind: DinoDashObstacleKind) {
  const scoring = DINO_DASH_V1.scoring;
  if (kind === "flyer") return scoring.flyerBonus;
  if (kind === "double") return scoring.doubleBonus;
  return scoring.cactusBonus;
}

export function stepDinoDash(
  state: DinoDashState,
  seed: string,
  targetScore = Number.MAX_SAFE_INTEGER
) {
  if (state.status !== "running") return state;

  state.tick += 1;
  stepScrollAndScore(state);
  stepJumpPhysics(state);

  const player = playerHitbox(state);

  for (const obstacle of state.obstacles) {
    const bounds = obstacleBounds(obstacle);
    const x1 = bounds.x1 - state.scrollMilli;
    const x2 = bounds.x2 - state.scrollMilli;

    if (
      x2 > player.x1 &&
      x1 < player.x2 &&
      bounds.y2 > player.y1 &&
      bounds.y1 < player.y2
    ) {
      fail(state, "OBSTACLE_COLLISION");
      return state;
    }

    if (
      !obstacle.passed &&
      x2 < DINO_DASH_V1.playerXMilli
    ) {
      obstacle.passed = true;
      state.passed += 1;
      state.score += obstacleBonus(obstacle.kind);

      if (state.score >= targetScore) {
        state.status = "won";
        state.failure = null;
        return state;
      }
    }
  }

  if (state.score >= targetScore) {
    state.status = "won";
    state.failure = null;
    return state;
  }

  if (state.tick >= DINO_DASH_V1.maxFinalTick) {
    fail(state, "TIMEOUT");
    return state;
  }

  trimAndFillObstacles(state, seed);
  return state;
}

export function replayDinoDash(
  inputs: DinoDashInput[],
  finalTick: number,
  seed: string,
  targetScore = Number.MAX_SAFE_INTEGER
): DinoDashReplayResult {
  const protocolError = validateInputSequence(
    inputs,
    finalTick,
    {
      version: DINO_DASH_V1.inputProtocolVersion,
      allowedActions: DINO_DASH_ACTIONS,
      maxInputs: DINO_DASH_V1.maxInputs,
      maxFinalTick: DINO_DASH_V1.maxFinalTick,
    }
  );

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
      applyDinoDashInput(
        state,
        inputs[inputIndex].action
      );
      inputIndex += 1;
    }

    if (
      state.status !== "running" ||
      state.tick >= finalTick
    ) {
      break;
    }

    stepDinoDash(state, seed, targetScore);
  }

  if (inputIndex !== inputs.length) {
    return {
      valid: false,
      error: "UNCONSUMED_INPUTS",
      state,
      score: state.score,
      timeMs: Math.round(
        (state.tick * 1000) / DINO_DASH_V1.tickRate
      ),
      failure: state.failure,
    };
  }

  if (state.tick !== finalTick) {
    return {
      valid: false,
      error: "FINAL_TICK_AFTER_RESOLUTION",
      state,
      score: state.score,
      timeMs: Math.round(
        (state.tick * 1000) / DINO_DASH_V1.tickRate
      ),
      failure: state.failure,
    };
  }

  if (state.status === "running") {
    return {
      valid: false,
      error: "CLIENT_ENDED_BEFORE_RESOLUTION",
      state,
      score: state.score,
      timeMs: Math.round(
        (state.tick * 1000) / DINO_DASH_V1.tickRate
      ),
      failure: state.failure,
    };
  }

  return {
    valid: true,
    state,
    score: state.score,
    timeMs: Math.round(
      (state.tick * 1000) / DINO_DASH_V1.tickRate
    ),
    failure: state.failure,
  };
}

export const DINO_DASH_V1_CONTENT = {
  mechanics: {
    fixedTimestepRunner: true,
    deterministicObstacleSchedule: true,
    jumpVelocityMilliPerSecond:
      DINO_DASH_V1.jumpVelocityMilliPerSecond,
    gravityMilliPerSecond2:
      DINO_DASH_V1.gravityMilliPerSecond2,
    initialSpeedMilliPerSecond:
      DINO_DASH_V1.initialSpeedMilliPerSecond,
    speedIncreaseMilliPerSecondPerSecond:
      DINO_DASH_V1.speedIncreaseMilliPerSecondPerSecond,
    maxSpeedMilliPerSecond:
      DINO_DASH_V1.maxSpeedMilliPerSecond,
  },
  scoring: DINO_DASH_V1.scoring,
  failureConditions: [
    "OBSTACLE_COLLISION",
    "TIMEOUT",
  ],
  endCondition: "FIRST_FAILURE_OR_TARGET",
  upstream: {
    project: "wayou/t-rex-runner",
    license: "BSD-3-Clause",
    commit: "5455bfa408ec6b707c7300ff194b7390733a766d",
  },
} as const;
