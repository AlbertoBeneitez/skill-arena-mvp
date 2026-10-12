/**
 * Pulse Runner competitive core v1.
 *
 * A fixed-timestep one-button runner: the only competitive input is JUMP.
 * Presentation may draw the cube, pulses and camera however it wants; scoring,
 * collisions, obstacle generation and terminal state live here.
 */

import { createRng } from "../deterministic/seeded";
import {
  validateInputSequence,
  type ReplayInput,
} from "./inputValidation";

export const PULSE_RUNNER_V1 = {
  tickRate: 120,
  coordinateWidth: 390,
  coordinateHeight: 620,
  floorYMilli: 522_000,
  playerXMilli: 82_000,
  playerSizeMilli: 32_000,
  playerHitboxInsetXMilli: 4_000,
  playerHitboxTopInsetMilli: 4_000,
  playerHitboxBottomInsetMilli: 3_000,
  gravityMilliPerSecond2: 1_090_000,
  jumpVelocityMilliPerSecond: -500_000,
  maxFallVelocityMilliPerSecond: 760_000,
  initialSpeedMilliPerSecond: 126_000,
  speedIncreaseMilliPerSecondPerSecond: 1_050,
  speedRampDelayTicks: 120 * 10,
  maxSpeedMilliPerSecond: 286_000,
  initialPatternXMilli: 780_000,
  spawnAheadMilli: 1_450_000,
  trimBehindMilli: -150_000,
  coyoteTicks: 14,
  jumpBufferTicks: 14,
  inputProtocolVersion: 1,
  maxInputs: 5_000,
  maxFinalTick: 120 * 60 * 15,
  scoring: {
    distanceNumerator: 2,
    distanceDenominator: 1_000,
    obstacleBase: 430,
    obstacleStep: 18,
    obstacleStepCap: 520,
  },
} as const;

export const PULSE_RUNNER_ACTIONS = ["JUMP"] as const;
export type PulseRunnerAction =
  (typeof PULSE_RUNNER_ACTIONS)[number];

export type PulseRunnerInput = ReplayInput & {
  action: PulseRunnerAction;
};

export type PulseRunnerObstacleKind =
  | "spike"
  | "block"
  | "pillar";

export type PulseRunnerPiece = {
  offsetMilli: number;
  kind: PulseRunnerObstacleKind;
  wMilli: number;
  hMilli: number;
};

export type PulseRunnerPattern = {
  spanMilli: number;
  pieces: readonly PulseRunnerPiece[];
};

export type PulseRunnerObstacle = PulseRunnerPiece & {
  index: number;
  worldXMilli: number;
  passed: boolean;
};

export type PulseRunnerFailure =
  | "OBSTACLE_COLLISION"
  | "TIMEOUT"
  | "RUN_NOT_TERMINAL"
  | null;

export type PulseRunnerState = {
  tick: number;
  status: "running" | "failed" | "won";
  failure: PulseRunnerFailure;
  yMilli: number;
  vyMilliPerSecond: number;
  angleQuarterTurns: number;
  scrollMilli: number;
  distanceScoreRemainder: number;
  obstacles: PulseRunnerObstacle[];
  nextPatternIndex: number;
  nextObstacleIndex: number;
  nextPatternXMilli: number;
  passed: number;
  score: number;
  grounded: boolean;
  coyoteTicks: number;
  jumpBufferTicks: number;
};

export type PulseRunnerReplayResult = {
  valid: boolean;
  error?: string;
  state: PulseRunnerState;
  score: number;
  timeMs: number;
  failure: PulseRunnerFailure;
};

const PATTERNS: readonly PulseRunnerPattern[] = [
  {
    spanMilli: 330_000,
    pieces: [
      { offsetMilli: 0, kind: "spike", wMilli: 30_000, hMilli: 30_000 },
    ],
  },
  {
    spanMilli: 350_000,
    pieces: [
      { offsetMilli: 0, kind: "block", wMilli: 42_000, hMilli: 42_000 },
    ],
  },
  {
    spanMilli: 370_000,
    pieces: [
      { offsetMilli: 0, kind: "spike", wMilli: 28_000, hMilli: 30_000 },
      { offsetMilli: 54_000, kind: "spike", wMilli: 28_000, hMilli: 30_000 },
    ],
  },
  {
    spanMilli: 390_000,
    pieces: [
      { offsetMilli: 0, kind: "block", wMilli: 44_000, hMilli: 50_000 },
      { offsetMilli: 118_000, kind: "spike", wMilli: 30_000, hMilli: 30_000 },
    ],
  },
  {
    spanMilli: 405_000,
    pieces: [
      { offsetMilli: 0, kind: "spike", wMilli: 28_000, hMilli: 30_000 },
      { offsetMilli: 88_000, kind: "block", wMilli: 40_000, hMilli: 38_000 },
      { offsetMilli: 174_000, kind: "spike", wMilli: 28_000, hMilli: 30_000 },
    ],
  },
  {
    spanMilli: 420_000,
    pieces: [
      { offsetMilli: 0, kind: "pillar", wMilli: 40_000, hMilli: 64_000 },
      { offsetMilli: 144_000, kind: "spike", wMilli: 30_000, hMilli: 30_000 },
    ],
  },
  {
    spanMilli: 430_000,
    pieces: [
      { offsetMilli: 0, kind: "spike", wMilli: 28_000, hMilli: 30_000 },
      { offsetMilli: 48_000, kind: "spike", wMilli: 28_000, hMilli: 30_000 },
      { offsetMilli: 162_000, kind: "block", wMilli: 42_000, hMilli: 46_000 },
    ],
  },
  {
    spanMilli: 445_000,
    pieces: [
      { offsetMilli: 0, kind: "block", wMilli: 42_000, hMilli: 54_000 },
      { offsetMilli: 122_000, kind: "spike", wMilli: 28_000, hMilli: 30_000 },
      { offsetMilli: 174_000, kind: "spike", wMilli: 28_000, hMilli: 30_000 },
    ],
  },
];

function speedForTick(tick: number) {
  const activeTicks = Math.max(
    0,
    tick - PULSE_RUNNER_V1.speedRampDelayTicks
  );
  return Math.min(
    PULSE_RUNNER_V1.maxSpeedMilliPerSecond,
    PULSE_RUNNER_V1.initialSpeedMilliPerSecond +
      Math.floor(
        (activeTicks *
          PULSE_RUNNER_V1.speedIncreaseMilliPerSecondPerSecond) /
          PULSE_RUNNER_V1.tickRate
      )
  );
}

function patternFor(seed: string, index: number): PulseRunnerPattern {
  if (index < 4) return PATTERNS[index % 4];

  const rng = createRng(`${seed}:pulse-pattern:${index}`);
  const minIndex =
    index < 9 ? 0 : index < 18 ? 1 : index < 30 ? 2 : 3;
  const patternIndex =
    minIndex + rng.nextInt(PATTERNS.length - minIndex);
  return PATTERNS[patternIndex];
}

function appendPattern(state: PulseRunnerState, seed: string) {
  const pattern = patternFor(seed, state.nextPatternIndex);
  const jitter =
    state.nextPatternIndex < 5
      ? 0
      : createRng(`${seed}:pulse-gap:${state.nextPatternIndex}`).nextInt(
          48_000
        );
  const baseX = state.nextPatternXMilli + jitter;

  for (const piece of pattern.pieces) {
    state.obstacles.push({
      ...piece,
      index: state.nextObstacleIndex,
      worldXMilli: baseX + piece.offsetMilli,
      passed: false,
    });
    state.nextObstacleIndex += 1;
  }

  state.nextPatternXMilli += pattern.spanMilli + jitter;
  state.nextPatternIndex += 1;
}

function trimAndFillObstacles(
  state: PulseRunnerState,
  seed: string
) {
  while (
    state.nextPatternXMilli - state.scrollMilli <
    PULSE_RUNNER_V1.spawnAheadMilli
  ) {
    appendPattern(state, seed);
  }

  if (state.obstacles.length > 90) {
    state.obstacles = state.obstacles.filter(
      (obstacle) =>
        obstacle.worldXMilli - state.scrollMilli >
        PULSE_RUNNER_V1.trimBehindMilli
    );
  }
}

export function isPulseRunnerGrounded(state: PulseRunnerState) {
  return (
    state.grounded &&
    state.yMilli ===
      PULSE_RUNNER_V1.floorYMilli -
        PULSE_RUNNER_V1.playerSizeMilli
  );
}

export function createPulseRunnerState(seed: string): PulseRunnerState {
  const state: PulseRunnerState = {
    tick: 0,
    status: "running",
    failure: null,
    yMilli:
      PULSE_RUNNER_V1.floorYMilli -
      PULSE_RUNNER_V1.playerSizeMilli,
    vyMilliPerSecond: 0,
    angleQuarterTurns: 0,
    scrollMilli: 0,
    distanceScoreRemainder: 0,
    obstacles: [],
    nextPatternIndex: 0,
    nextObstacleIndex: 0,
    nextPatternXMilli: PULSE_RUNNER_V1.initialPatternXMilli,
    passed: 0,
    score: 0,
    grounded: true,
    coyoteTicks: PULSE_RUNNER_V1.coyoteTicks,
    jumpBufferTicks: 0,
  };

  trimAndFillObstacles(state, seed);
  return state;
}

export function applyPulseRunnerInput(
  state: PulseRunnerState,
  action: PulseRunnerAction
) {
  if (state.status !== "running") return false;
  if (action !== "JUMP") return false;

  state.jumpBufferTicks = PULSE_RUNNER_V1.jumpBufferTicks;
  return true;
}

function fail(state: PulseRunnerState, reason: PulseRunnerFailure) {
  state.status = "failed";
  state.failure = reason;
}

function playerIntersectsObstacle(
  state: PulseRunnerState,
  obstacle: PulseRunnerObstacle
) {
  const playerLeft =
    PULSE_RUNNER_V1.playerXMilli +
    PULSE_RUNNER_V1.playerHitboxInsetXMilli;
  const playerRight =
    PULSE_RUNNER_V1.playerXMilli +
    PULSE_RUNNER_V1.playerSizeMilli -
    PULSE_RUNNER_V1.playerHitboxInsetXMilli;
  const playerTop =
    state.yMilli + PULSE_RUNNER_V1.playerHitboxTopInsetMilli;
  const playerBottom =
    state.yMilli +
    PULSE_RUNNER_V1.playerSizeMilli -
    PULSE_RUNNER_V1.playerHitboxBottomInsetMilli;

  const x = obstacle.worldXMilli - state.scrollMilli;

  if (obstacle.kind === "spike") {
    const obstacleLeft = x + Math.floor(obstacle.wMilli * 0.18);
    const obstacleRight = x + Math.floor(obstacle.wMilli * 0.82);
    const obstacleTop =
      PULSE_RUNNER_V1.floorYMilli -
      Math.floor(obstacle.hMilli * 0.68);

    return (
      playerRight > obstacleLeft &&
      playerLeft < obstacleRight &&
      playerBottom > obstacleTop &&
      playerTop < PULSE_RUNNER_V1.floorYMilli
    );
  }

  const obstacleTop =
    PULSE_RUNNER_V1.floorYMilli - obstacle.hMilli;
  return (
    playerRight > x &&
    playerLeft < x + obstacle.wMilli &&
    playerBottom > obstacleTop &&
    playerTop < PULSE_RUNNER_V1.floorYMilli
  );
}

export function stepPulseRunner(
  state: PulseRunnerState,
  seed: string,
  targetScore: number
) {
  if (state.status !== "running") return;

  if (state.tick >= PULSE_RUNNER_V1.maxFinalTick) {
    fail(state, "TIMEOUT");
    return;
  }

  state.tick += 1;
  const speed = speedForTick(state.tick);
  state.scrollMilli += speed / PULSE_RUNNER_V1.tickRate;

  const scoring = PULSE_RUNNER_V1.scoring;
  const distanceRaw =
    state.distanceScoreRemainder +
    speed * scoring.distanceNumerator;
  const distanceDenominator =
    scoring.distanceDenominator * PULSE_RUNNER_V1.tickRate;
  state.score += Math.floor(distanceRaw / distanceDenominator);
  state.distanceScoreRemainder = distanceRaw % distanceDenominator;

  trimAndFillObstacles(state, seed);

  state.jumpBufferTicks = Math.max(0, state.jumpBufferTicks - 1);
  if (isPulseRunnerGrounded(state)) {
    state.coyoteTicks = PULSE_RUNNER_V1.coyoteTicks;
  } else {
    state.coyoteTicks = Math.max(0, state.coyoteTicks - 1);
  }

  if (state.jumpBufferTicks > 0 && state.coyoteTicks > 0) {
    state.vyMilliPerSecond =
      PULSE_RUNNER_V1.jumpVelocityMilliPerSecond;
    state.grounded = false;
    state.coyoteTicks = 0;
    state.jumpBufferTicks = 0;
  }

  if (!isPulseRunnerGrounded(state)) {
    state.vyMilliPerSecond = Math.min(
      PULSE_RUNNER_V1.maxFallVelocityMilliPerSecond,
      state.vyMilliPerSecond +
        PULSE_RUNNER_V1.gravityMilliPerSecond2 /
          PULSE_RUNNER_V1.tickRate
    );
    state.yMilli +=
      state.vyMilliPerSecond / PULSE_RUNNER_V1.tickRate;
    state.angleQuarterTurns +=
      speed / PULSE_RUNNER_V1.tickRate / 86_000;
  }

  const groundedY =
    PULSE_RUNNER_V1.floorYMilli -
    PULSE_RUNNER_V1.playerSizeMilli;
  if (state.yMilli >= groundedY) {
    state.yMilli = groundedY;
    state.vyMilliPerSecond = 0;
    state.grounded = true;
    state.angleQuarterTurns = Math.round(
      state.angleQuarterTurns
    );
  }

  for (const obstacle of state.obstacles) {
    const x = obstacle.worldXMilli - state.scrollMilli;
    if (x > PULSE_RUNNER_V1.coordinateWidth * 1000 + 90_000) {
      continue;
    }
    if (x + obstacle.wMilli < -70_000) continue;

    if (playerIntersectsObstacle(state, obstacle)) {
      fail(state, "OBSTACLE_COLLISION");
      return;
    }

    if (
      !obstacle.passed &&
      x + obstacle.wMilli <
        PULSE_RUNNER_V1.playerXMilli + 2_000
    ) {
      obstacle.passed = true;
      state.passed += 1;
      state.score +=
        scoring.obstacleBase +
        Math.min(scoring.obstacleStepCap, state.passed * scoring.obstacleStep);

      if (state.score >= targetScore) {
        state.status = "won";
        state.failure = null;
        return;
      }
    }
  }
}

export function replayPulseRunner(
  inputs: PulseRunnerInput[],
  finalTick: number,
  seed: string,
  targetScore: number
): PulseRunnerReplayResult {
  const inputError = validateInputSequence(inputs, finalTick, {
    version: PULSE_RUNNER_V1.inputProtocolVersion,
    allowedActions: PULSE_RUNNER_ACTIONS,
    maxInputs: PULSE_RUNNER_V1.maxInputs,
    maxFinalTick: PULSE_RUNNER_V1.maxFinalTick,
  });

  const state = createPulseRunnerState(seed);
  if (inputError) {
    return {
      valid: false,
      error: inputError,
      state,
      score: 0,
      timeMs: 0,
      failure: null,
    };
  }

  let inputIndex = 0;
  while (state.tick < finalTick && state.status === "running") {
    while (
      inputIndex < inputs.length &&
      inputs[inputIndex].tick === state.tick
    ) {
      applyPulseRunnerInput(state, inputs[inputIndex].action);
      inputIndex += 1;
    }

    stepPulseRunner(state, seed, targetScore);
  }

  if (inputIndex < inputs.length) {
    return {
      valid: false,
      error: "INPUT_AFTER_TERMINAL",
      state,
      score: state.score,
      timeMs: Math.round(
        (state.tick * 1000) / PULSE_RUNNER_V1.tickRate
      ),
      failure: state.failure,
    };
  }

  if (state.status === "running") {
    fail(state, "RUN_NOT_TERMINAL");
    return {
      valid: false,
      error: "RUN_NOT_TERMINAL",
      state,
      score: state.score,
      timeMs: Math.round(
        (state.tick * 1000) / PULSE_RUNNER_V1.tickRate
      ),
      failure: state.failure,
    };
  }

  return {
    valid: true,
    state,
    score: state.score,
    timeMs: Math.round(
      (state.tick * 1000) / PULSE_RUNNER_V1.tickRate
    ),
    failure: state.failure,
  };
}

export const PULSE_RUNNER_V1_CONTENT = {
  mechanics: {
    fixedTimestepRunner: true,
    oneButtonJump: true,
    deterministicPatternSchedule: true,
    coyoteTicks: PULSE_RUNNER_V1.coyoteTicks,
    jumpBufferTicks: PULSE_RUNNER_V1.jumpBufferTicks,
    initialSpeedMilliPerSecond:
      PULSE_RUNNER_V1.initialSpeedMilliPerSecond,
    speedIncreaseMilliPerSecondPerSecond:
      PULSE_RUNNER_V1.speedIncreaseMilliPerSecondPerSecond,
    maxSpeedMilliPerSecond:
      PULSE_RUNNER_V1.maxSpeedMilliPerSecond,
  },
  scoring: PULSE_RUNNER_V1.scoring,
  failureConditions: [
    "OBSTACLE_COLLISION",
    "TIMEOUT",
  ],
  endCondition: "FIRST_FAILURE_OR_TARGET",
  assetStatus: "Original Skill Arena geometric artwork only.",
} as const;
