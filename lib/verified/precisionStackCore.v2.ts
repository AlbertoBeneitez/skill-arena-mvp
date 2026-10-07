/**
 * Precision Stack competitive core v2.
 *
 * Frozen competitive implementation for gameVersion 2.0.0.
 * Historical replays depend on identical behaviour.
 *
 * Gameplay provenance:
 * - Balance Stack from sausi-7/games (MIT, commit
 *   c97ef8bec4a4ce3154b4345a79aeda3ea2a6a465).
 *
 * The upstream implementation informed horizontal movement, overlap clipping,
 * a short ease-in drop, falling overhang fragments and progressive speed.
 * V2 keeps those proven fundamentals but recalibrates cadence, introduces a
 * tightening perfect window and rejects visually ambiguous sliver landings.
 *
 * This core is a deterministic fixed-timestep implementation for Skill Arena;
 * presentation-only tweening, particles, audio and camera live outside it.
 */

import { hashSeed } from "../deterministic/seeded";
import {
  validateInputSequence,
  type ReplayInput,
} from "./inputValidation";

export const PRECISION_STACK_V2 = {
  tickRate: 120,
  widthMilli: 390_000,
  coordinateHeight: 620,
  edgePaddingMilli: 10_000,
  baseWidthMilli: 254_000,
  initialBlockWidthMilli: 254_000,

  // Faster opening cadence than v1, with a gentler long-run curve. The
  // objective is immediate mobile response without turning late play into a
  // reflex lottery.
  initialSpeedMilliPerSecond: 132_000,
  speedIncreaseMilliPerSecond: 8_000,
  speedCurveEveryLevels: 5,
  speedCurveStepMilliPerSecond: 5_000,
  maxSpeedMilliPerSecond: 305_000,

  // The early game teaches the mechanic; the magnetic perfect window tightens
  // gradually as the station grows.
  initialPerfectToleranceMilli: 5_000,
  perfectToleranceDecreaseMilli: 180,
  minimumPerfectToleranceMilli: 2_400,

  // Sliver landings are visually ambiguous and feel unfair. They are treated
  // as structurally unstable rather than allowing an almost invisible tower.
  minimumStableOverlapMilli: 12_000,

  // Presentation uses a short docking animation. Competitive settling is
  // intentionally brief but slightly longer than the visual drop, preventing
  // the next moving module from appearing before docking feedback completes.
  settleTicks: 24,
  maxIdleTicksPerBlock: 120 * 45,

  inputProtocolVersion: 1,
  maxInputs: 1_000,
  scoring: {
    base: 360,
    precisionMax: 760,
    perfectBonus: 520,
    comboStep: 55,
    comboCap: 660,
  },
} as const;

export type PrecisionStackInput = ReplayInput & {
  action: "DROP";
};

export type PrecisionStackFailure =
  | "NO_OVERLAP"
  | "UNSTABLE_OVERLAP"
  | "TIMEOUT_IDLE"
  | null;

export type PrecisionStackBlock = {
  xMilli: number;
  wMilli: number;
};

export type PrecisionStackPlacement = {
  xMilli: number;
  wMilli: number;
  sourceXMilli: number;
  sourceWMilli: number;
  overhangLeftMilli: number;
  overhangRightMilli: number;
  perfect: boolean;
  scoreDelta: number;
};

export type PrecisionStackState = {
  tick: number;
  status: "running" | "failed" | "won";
  phase: "moving" | "settling";
  failure: PrecisionStackFailure;

  score: number;
  combo: number;
  idleTicks: number;

  blocks: PrecisionStackBlock[];

  movingXMilli: number;
  movingWMilli: number;
  movingDirection: -1 | 1;
  movingSpeedMilliPerSecond: number;
  movementRemainder: number;

  settleTicksRemaining: number;
  lastPlacement: PrecisionStackPlacement | null;
};

export type PrecisionStackReplayResult = {
  valid: boolean;
  error?: string;
  state: PrecisionStackState;
  score: number;
  timeMs: number;
  height: number;
  failure: PrecisionStackFailure;
};

function roundDiv(numerator: number, denominator: number) {
  return Math.floor((numerator + Math.floor(denominator / 2)) / denominator);
}

function heightOf(state: PrecisionStackState) {
  return Math.max(0, state.blocks.length - 1);
}

function directionFor(seed: string, level: number): -1 | 1 {
  return (hashSeed(`${seed}:precision-stack:${level}`) & 1) === 0
    ? 1
    : -1;
}

export function precisionStackSpeedForLevel(level: number) {
  const cfg = PRECISION_STACK_V2;
  const normalizedLevel = Math.max(1, Math.floor(level));
  const linear =
    Math.max(0, normalizedLevel - 1) *
    cfg.speedIncreaseMilliPerSecond;
  const curve =
    Math.floor(
      Math.max(0, normalizedLevel - 1) /
        cfg.speedCurveEveryLevels
    ) * cfg.speedCurveStepMilliPerSecond;

  return Math.min(
    cfg.maxSpeedMilliPerSecond,
    cfg.initialSpeedMilliPerSecond + linear + curve
  );
}

export function precisionStackPerfectToleranceForLevel(
  level: number
) {
  const cfg = PRECISION_STACK_V2;
  return Math.max(
    cfg.minimumPerfectToleranceMilli,
    cfg.initialPerfectToleranceMilli -
      Math.max(0, Math.floor(level) - 1) *
        cfg.perfectToleranceDecreaseMilli
  );
}

function spawnMovingBlock(state: PrecisionStackState, seed: string) {
  const cfg = PRECISION_STACK_V2;
  const top = state.blocks[state.blocks.length - 1];
  const level = state.blocks.length;
  const width = top?.wMilli ?? cfg.initialBlockWidthMilli;
  const direction = directionFor(seed, level);

  state.movingWMilli = width;
  state.movingDirection = direction;
  state.movingSpeedMilliPerSecond = precisionStackSpeedForLevel(level);
  state.movementRemainder = 0;
  state.movingXMilli =
    direction > 0
      ? cfg.edgePaddingMilli
      : cfg.widthMilli - cfg.edgePaddingMilli - width;
  state.phase = "moving";
  state.settleTicksRemaining = 0;
  state.idleTicks = 0;
}

export function createPrecisionStackState(
  seed: string
): PrecisionStackState {
  const cfg = PRECISION_STACK_V2;
  const baseX = Math.floor(
    (cfg.widthMilli - cfg.baseWidthMilli) / 2
  );

  const state: PrecisionStackState = {
    tick: 0,
    status: "running",
    phase: "moving",
    failure: null,

    score: 0,
    combo: 0,
    idleTicks: 0,

    blocks: [
      {
        xMilli: baseX,
        wMilli: cfg.baseWidthMilli,
      },
    ],

    movingXMilli: 0,
    movingWMilli: cfg.initialBlockWidthMilli,
    movingDirection: 1,
    movingSpeedMilliPerSecond: cfg.initialSpeedMilliPerSecond,
    movementRemainder: 0,

    settleTicksRemaining: 0,
    lastPlacement: null,
  };

  spawnMovingBlock(state, seed);
  return state;
}

function stepMovingBlock(state: PrecisionStackState) {
  const cfg = PRECISION_STACK_V2;

  state.movementRemainder += state.movingSpeedMilliPerSecond;
  const distance = Math.floor(
    state.movementRemainder / cfg.tickRate
  );
  state.movementRemainder %= cfg.tickRate;

  state.movingXMilli += state.movingDirection * distance;

  const minX = cfg.edgePaddingMilli;
  const maxX =
    cfg.widthMilli -
    cfg.edgePaddingMilli -
    state.movingWMilli;

  if (state.movingXMilli <= minX) {
    state.movingXMilli = minX;
    state.movingDirection = 1;
  } else if (state.movingXMilli >= maxX) {
    state.movingXMilli = maxX;
    state.movingDirection = -1;
  }
}

export function stepPrecisionStack(
  state: PrecisionStackState,
  seed: string,
  targetScore = Number.MAX_SAFE_INTEGER
) {
  if (state.status !== "running") return state;

  state.tick += 1;

  if (state.phase === "settling") {
    state.settleTicksRemaining -= 1;
    if (state.settleTicksRemaining <= 0) {
      spawnMovingBlock(state, seed);
    }
    return state;
  }

  state.idleTicks += 1;
  stepMovingBlock(state);

  if (state.idleTicks >= PRECISION_STACK_V2.maxIdleTicksPerBlock) {
    state.status = "failed";
    state.failure = "TIMEOUT_IDLE";
  }

  if (state.score >= targetScore) {
    state.status = "won";
    state.failure = null;
  }

  return state;
}

export function dropPrecisionStack(
  state: PrecisionStackState,
  seed: string,
  targetScore = Number.MAX_SAFE_INTEGER
) {
  if (
    state.status !== "running" ||
    state.phase !== "moving"
  ) {
    return state;
  }

  const cfg = PRECISION_STACK_V2;
  const top = state.blocks[state.blocks.length - 1];

  const sourceX = state.movingXMilli;
  const sourceW = state.movingWMilli;
  const sourceRight = sourceX + sourceW;
  const topRight = top.xMilli + top.wMilli;

  const overlapLeft = Math.max(sourceX, top.xMilli);
  const overlapRight = Math.min(sourceRight, topRight);
  const overlapWidth = overlapRight - overlapLeft;

  if (overlapWidth <= 0) {
    state.status = "failed";
    state.failure = "NO_OVERLAP";
    state.lastPlacement = {
      xMilli: sourceX,
      wMilli: sourceW,
      sourceXMilli: sourceX,
      sourceWMilli: sourceW,
      overhangLeftMilli: sourceX < top.xMilli ? sourceW : 0,
      overhangRightMilli: sourceRight > topRight ? sourceW : 0,
      perfect: false,
      scoreDelta: 0,
    };
    return state;
  }

  if (overlapWidth < cfg.minimumStableOverlapMilli) {
    state.status = "failed";
    state.failure = "UNSTABLE_OVERLAP";
    state.lastPlacement = {
      xMilli: overlapLeft,
      wMilli: overlapWidth,
      sourceXMilli: sourceX,
      sourceWMilli: sourceW,
      overhangLeftMilli: Math.max(0, top.xMilli - sourceX),
      overhangRightMilli: Math.max(0, sourceRight - topRight),
      perfect: false,
      scoreDelta: 0,
    };
    return state;
  }

  const sourceCenter = sourceX + Math.floor(sourceW / 2);
  const topCenter = top.xMilli + Math.floor(top.wMilli / 2);
  const level = state.blocks.length;
  const perfectTolerance =
    precisionStackPerfectToleranceForLevel(level);
  const perfect =
    Math.abs(sourceCenter - topCenter) <=
    perfectTolerance;

  const landedX = perfect ? top.xMilli : overlapLeft;
  const landedW = perfect ? top.wMilli : overlapWidth;

  const precisionPoints = roundDiv(
    overlapWidth * cfg.scoring.precisionMax,
    sourceW
  );
  const comboBonus = Math.min(
    cfg.scoring.comboCap,
    state.combo * cfg.scoring.comboStep
  );
  const scoreDelta =
    cfg.scoring.base +
    precisionPoints +
    (perfect ? cfg.scoring.perfectBonus : 0) +
    comboBonus;

  const overhangLeftMilli = Math.max(
    0,
    top.xMilli - sourceX
  );
  const overhangRightMilli = Math.max(
    0,
    sourceRight - topRight
  );

  state.score += scoreDelta;
  state.combo = perfect ? state.combo + 1 : 0;
  state.blocks.push({
    xMilli: landedX,
    wMilli: landedW,
  });
  state.lastPlacement = {
    xMilli: landedX,
    wMilli: landedW,
    sourceXMilli: sourceX,
    sourceWMilli: sourceW,
    overhangLeftMilli,
    overhangRightMilli,
    perfect,
    scoreDelta,
  };
  state.failure = null;
  state.idleTicks = 0;

  if (state.score >= targetScore) {
    state.status = "won";
    return state;
  }

  state.phase = "settling";
  state.settleTicksRemaining = cfg.settleTicks;

  // seed is part of the function signature intentionally. The next block is
  // spawned after deterministic settling ticks by stepPrecisionStack.
  void seed;

  return state;
}

export function replayPrecisionStack(
  inputs: PrecisionStackInput[],
  finalTick: number,
  seed: string,
  targetScore = Number.MAX_SAFE_INTEGER
): PrecisionStackReplayResult {
  const protocolError = validateInputSequence(inputs, finalTick, {
    version: PRECISION_STACK_V2.inputProtocolVersion,
    allowedActions: ["DROP"],
    maxInputs: PRECISION_STACK_V2.maxInputs,
    maxFinalTick: PRECISION_STACK_V2.tickRate * 60 * 15,
  });

  const state = createPrecisionStackState(seed);

  if (protocolError) {
    return {
      valid: false,
      error: protocolError,
      state,
      score: 0,
      timeMs: 0,
      height: 0,
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
      if (state.phase !== "moving") {
        return {
          valid: false,
          error: "DROP_WHILE_SETTLING",
          state,
          score: state.score,
          timeMs: Math.round(
            (state.tick * 1000) / PRECISION_STACK_V2.tickRate
          ),
          height: heightOf(state),
          failure: state.failure,
        };
      }

      dropPrecisionStack(state, seed, targetScore);
      inputIndex += 1;
    }

    if (
      state.status !== "running" ||
      state.tick >= finalTick
    ) {
      break;
    }

    stepPrecisionStack(state, seed, targetScore);
  }

  if (inputIndex !== inputs.length) {
    return {
      valid: false,
      error: "UNCONSUMED_INPUTS",
      state,
      score: state.score,
      timeMs: Math.round(
        (state.tick * 1000) / PRECISION_STACK_V2.tickRate
      ),
      height: heightOf(state),
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
        (state.tick * 1000) / PRECISION_STACK_V2.tickRate
      ),
      height: heightOf(state),
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
        (state.tick * 1000) / PRECISION_STACK_V2.tickRate
      ),
      height: heightOf(state),
      failure: state.failure,
    };
  }

  return {
    valid: true,
    state,
    score: state.score,
    timeMs: Math.round(
      (state.tick * 1000) / PRECISION_STACK_V2.tickRate
    ),
    height: heightOf(state),
    failure: state.failure,
  };
}

export const PRECISION_STACK_V2_CONTENT = {
  tickRate: PRECISION_STACK_V2.tickRate,
  mechanics: {
    horizontalBounce: true,
    overlapClipping: true,
    perfectSnap: true,
    adaptivePerfectWindow: true,
    minimumStableOverlap: true,
    progressiveSpeed: true,
    fixedSettlingWindow: true,
  },
  scoring: PRECISION_STACK_V2.scoring,
  perfectTolerance: {
    initialMilli:
      PRECISION_STACK_V2.initialPerfectToleranceMilli,
    decreaseMilli:
      PRECISION_STACK_V2.perfectToleranceDecreaseMilli,
    minimumMilli:
      PRECISION_STACK_V2.minimumPerfectToleranceMilli,
  },
  minimumStableOverlapMilli:
    PRECISION_STACK_V2.minimumStableOverlapMilli,
  failureConditions: [
    "NO_OVERLAP",
    "UNSTABLE_OVERLAP",
    "TIMEOUT_IDLE",
  ],
  endCondition: "FIRST_FAILURE_OR_TARGET",
  upstream: {
    project: "sausi-7/games Balance Stack",
    license: "MIT",
    commit: "c97ef8bec4a4ce3154b4345a79aeda3ea2a6a465",
  },
} as const;
