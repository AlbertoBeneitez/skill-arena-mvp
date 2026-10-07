/**
 * Tower Drop deterministic core v2.
 *
 * Mechanical inspiration:
 * - Tower Building Game by BMQB, Inc. (MIT, 2018)
 *   https://github.com/iamkun/tower_game
 *
 * The original project inspired the pendulum delivery, accelerated fall,
 * partial-support contact, edge pivot/tip behaviour and progressive
 * difficulty. This file is a clean TypeScript/fixed-timestep implementation
 * for Skill Arena; it does not copy the original assets, UI or source code.
 *
 * See THIRD_PARTY_NOTICES.md for the MIT notice.
 */

import { validateInputSequence } from "./inputValidation";

export const TOWER_DROP_V2 = {
  tickRate: 120,

  widthMilli: 390_000,
  edgePaddingMilli: 8_000,
  baseWidthMilli: 228_000,
  blockWidthMilli: 138_000,

  // Pendulum. 4096 phase units make the wave integer-only and replay-safe.
  swingPhaseUnits: 4096,
  baseSwingStepPerTick: 11,
  swingStepEveryFloors: 4,
  swingStepIncrement: 2,
  maxSwingStepPerTick: 25,
  // Keep the whole pendulum arc inside the playable width. The previous
  // amplitude could hit the x clamp on tall towers, making the block appear
  // to freeze for part of its swing.
  baseSwingAmplitudeMilli: 96_000,
  swingAmplitudeStepMilli: 2_000,
  maxSwingAmplitudeMilli: 116_000,

  // Falling physics.
  gravityMilliPerSecondSquared: 820_000,
  dropDistanceMilli: 320_000,
  fallOutExtraMilli: 210_000,
  // Preserve noticeable lateral momentum without making a visually centred
  // release miss by an entire block width during the ~0.9 s fall.
  releaseMomentumPerMille: 200,
  horizontalDragPerMillePerSecond: 70,
  wallRestitutionPerMille: 420,

  // Support / tipping.
  stabilityMarginMilli: 3_000,
  perfectCenterToleranceMilli: 8_000,
  tipInitialSpeedMilliDegPerSecond: 42_000,
  tipAccelerationMilliDegPerSecondSquared: 260_000,
  tipFailureAngleMilliDeg: 78_000,

  maxIdleTicksPerBlock: 120 * 60 * 5,
  inputProtocolVersion: 2,
} as const;

export type TowerDropInput = {
  seq: number;
  tick: number;
  action: "DROP";
};

export type TowerDropBlock = {
  xMilli: number;
  wMilli: number;
};

export type TowerDropPhase =
  | "swing"
  | "falling"
  | "tipping-left"
  | "tipping-right"
  | "falling-out";

export type TowerDropFailure =
  | "NO_SUPPORT"
  | "CENTER_OF_MASS"
  | "TIMEOUT_IDLE"
  | null;

export type TowerDropState = {
  tick: number;
  status: "running" | "failed" | "won";
  phase: TowerDropPhase;
  failure: TowerDropFailure;

  score: number;
  combo: number;
  idleTicks: number;

  blocks: TowerDropBlock[];

  swingPhase: number;
  movingXMilli: number;
  movingWMilli: number;
  movingVXMilliPerSecond: number;

  fallXMilli: number;
  fallYMilli: number;
  fallVXMilliPerSecond: number;
  fallXPositionRemainder: number;
  fallVYMilliPerSecond: number;
  fallVelocityRemainder: number;
  fallPositionRemainder: number;

  tipDirection: -1 | 0 | 1;
  tipPivotXMilli: number;
  tipAngleMilliDeg: number;
  tipAngularVelocityMilliDegPerSecond: number;
  tipVelocityRemainder: number;
  tipAngleRemainder: number;
};

export type TowerDropReplayResult = {
  valid: boolean;
  error?: string;
  state: TowerDropState;
  score: number;
  timeMs: number;
  height: number;
  failure: TowerDropFailure;
};

function roundDiv(numerator: number, denominator: number) {
  return Math.floor((numerator + Math.floor(denominator / 2)) / denominator);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function smoothStepPerMille(value: number) {
  const t = clamp(value, 0, 1000);
  // t²(3 - 2t), scaled to 0..1000 using integer arithmetic.
  return roundDiv(t * t * (3000 - 2 * t), 1_000_000);
}

/**
 * Deterministic, sine-like pendulum wave in the range -1000..1000.
 * No floating-point trig is used, so the same tick stream yields the same
 * integer positions on browsers and on the server.
 */
export function pendulumWavePerMille(phase: number) {
  const units = TOWER_DROP_V2.swingPhaseUnits;
  const normalized = ((phase % units) + units) % units;
  const p = Math.floor((normalized * 4000) / units);

  if (p < 1000) return smoothStepPerMille(p);
  if (p < 2000) return smoothStepPerMille(2000 - p);
  if (p < 3000) return -smoothStepPerMille(p - 2000);
  return -smoothStepPerMille(4000 - p);
}

function heightOf(state: TowerDropState) {
  return Math.max(0, state.blocks.length - 1);
}

function swingStepFor(state: TowerDropState) {
  const cfg = TOWER_DROP_V2;
  const height = heightOf(state);
  return Math.min(
    cfg.maxSwingStepPerTick,
    cfg.baseSwingStepPerTick +
      Math.floor(height / cfg.swingStepEveryFloors) *
        cfg.swingStepIncrement
  );
}

function swingAmplitudeFor(state: TowerDropState) {
  const cfg = TOWER_DROP_V2;
  return Math.min(
    cfg.maxSwingAmplitudeMilli,
    cfg.baseSwingAmplitudeMilli +
      heightOf(state) * cfg.swingAmplitudeStepMilli
  );
}

function updateMovingBlockFromSwing(state: TowerDropState) {
  const cfg = TOWER_DROP_V2;
  const previousX = state.movingXMilli;
  const wave = pendulumWavePerMille(state.swingPhase);
  const center =
    Math.floor(cfg.widthMilli / 2) +
    roundDiv(wave * swingAmplitudeFor(state), 1000);
  const left = center - Math.floor(state.movingWMilli / 2);

  state.movingXMilli = clamp(
    left,
    cfg.edgePaddingMilli,
    cfg.widthMilli - cfg.edgePaddingMilli - state.movingWMilli
  );

  state.movingVXMilliPerSecond =
    (state.movingXMilli - previousX) * cfg.tickRate;
}

export function createTowerDropState(): TowerDropState {
  const cfg = TOWER_DROP_V2;
  const baseX = Math.floor((cfg.widthMilli - cfg.baseWidthMilli) / 2);

  const state: TowerDropState = {
    tick: 0,
    status: "running",
    phase: "swing",
    failure: null,

    score: 0,
    combo: 0,
    idleTicks: 0,

    blocks: [{ xMilli: baseX, wMilli: cfg.baseWidthMilli }],

    // Start slightly off-centre so the hook is visibly alive immediately.
    swingPhase: 420,
    movingXMilli: 0,
    movingWMilli: cfg.blockWidthMilli,
    movingVXMilliPerSecond: 0,

    fallXMilli: 0,
    fallYMilli: 0,
    fallVXMilliPerSecond: 0,
    fallXPositionRemainder: 0,
    fallVYMilliPerSecond: 0,
    fallVelocityRemainder: 0,
    fallPositionRemainder: 0,

    tipDirection: 0,
    tipPivotXMilli: 0,
    tipAngleMilliDeg: 0,
    tipAngularVelocityMilliDegPerSecond: 0,
    tipVelocityRemainder: 0,
    tipAngleRemainder: 0,
  };

  updateMovingBlockFromSwing(state);
  // Initial placement is not a physical swing step, so it must not inject an
  // artificial release velocity before the first simulation tick.
  state.movingVXMilliPerSecond = 0;
  return state;
}

function beginTip(
  state: TowerDropState,
  direction: -1 | 1,
  pivotXMilli: number
) {
  const cfg = TOWER_DROP_V2;
  state.phase = direction < 0 ? "tipping-left" : "tipping-right";
  state.failure = "CENTER_OF_MASS";
  state.tipDirection = direction;
  state.tipPivotXMilli = pivotXMilli;
  state.tipAngleMilliDeg = 0;
  state.tipAngularVelocityMilliDegPerSecond =
    cfg.tipInitialSpeedMilliDegPerSecond;
  state.tipVelocityRemainder = 0;
  state.tipAngleRemainder = 0;
}

function resolveContact(
  state: TowerDropState,
  targetScore: number
) {
  const cfg = TOWER_DROP_V2;
  const top = state.blocks[state.blocks.length - 1];

  const droppedLeft = state.fallXMilli;
  const droppedRight = droppedLeft + state.movingWMilli;
  const supportLeft = Math.max(droppedLeft, top.xMilli);
  const supportRight = Math.min(droppedRight, top.xMilli + top.wMilli);
  const overlap = supportRight - supportLeft;

  if (overlap <= 0) {
    state.phase = "falling-out";
    state.failure = "NO_SUPPORT";
    return;
  }

  const center = droppedLeft + Math.floor(state.movingWMilli / 2);
  const stableLeft = supportLeft + cfg.stabilityMarginMilli;
  const stableRight = supportRight - cfg.stabilityMarginMilli;

  if (center < stableLeft) {
    beginTip(state, -1, supportLeft);
    return;
  }

  if (center > stableRight) {
    beginTip(state, 1, supportRight);
    return;
  }

  const topCenter = top.xMilli + Math.floor(top.wMilli / 2);
  const centerError = Math.abs(center - topCenter);
  const perfect = centerError <= cfg.perfectCenterToleranceMilli;
  const precisionPoints = roundDiv(
    Math.min(overlap, state.movingWMilli) * 420,
    state.movingWMilli
  );

  state.score +=
    360 +
    precisionPoints +
    (perfect ? 240 : 0) +
    state.combo * 28;
  state.combo = perfect ? state.combo + 1 : 0;

  state.blocks.push({
    xMilli: droppedLeft,
    wMilli: state.movingWMilli,
  });

  if (state.score >= targetScore) {
    state.status = "won";
    state.failure = null;
    return;
  }

  state.phase = "swing";
  state.failure = null;
  state.idleTicks = 0;

  // Keep the pendulum continuous but avoid every floor starting at the same
  // visual phase. The offset is fixed and therefore replay-safe.
  state.swingPhase =
    (state.swingPhase + 613) % cfg.swingPhaseUnits;
  updateMovingBlockFromSwing(state);

  state.fallYMilli = 0;
  state.fallVYMilliPerSecond = 0;
  state.fallVelocityRemainder = 0;
  state.fallPositionRemainder = 0;
  state.tipDirection = 0;
  state.tipAngleMilliDeg = 0;
}

function stepFalling(state: TowerDropState, targetScore: number) {
  const cfg = TOWER_DROP_V2;

  // Preserve part of the pendulum's horizontal velocity after release. This
  // removes the old "teleport into a vertical rail" feel and makes timing
  // depend on both position and direction of travel.
  state.fallXPositionRemainder += state.fallVXMilliPerSecond;
  const deltaX = Math.trunc(
    state.fallXPositionRemainder / cfg.tickRate
  );
  state.fallXPositionRemainder -= deltaX * cfg.tickRate;
  state.fallXMilli += deltaX;

  const minX = cfg.edgePaddingMilli;
  const maxX =
    cfg.widthMilli -
    cfg.edgePaddingMilli -
    state.movingWMilli;

  if (state.fallXMilli < minX) {
    state.fallXMilli = minX;
    state.fallVXMilliPerSecond = Math.abs(
      roundDiv(
        state.fallVXMilliPerSecond *
          cfg.wallRestitutionPerMille,
        1000
      )
    );
    state.fallXPositionRemainder = 0;
  } else if (state.fallXMilli > maxX) {
    state.fallXMilli = maxX;
    state.fallVXMilliPerSecond = -Math.abs(
      roundDiv(
        state.fallVXMilliPerSecond *
          cfg.wallRestitutionPerMille,
        1000
      )
    );
    state.fallXPositionRemainder = 0;
  }

  const dragPerTick = roundDiv(
    cfg.horizontalDragPerMillePerSecond,
    cfg.tickRate
  );
  if (dragPerTick > 0) {
    state.fallVXMilliPerSecond = roundDiv(
      state.fallVXMilliPerSecond *
        Math.max(0, 1000 - dragPerTick),
      1000
    );
  }

  state.fallVelocityRemainder +=
    cfg.gravityMilliPerSecondSquared;
  const deltaV = Math.floor(
    state.fallVelocityRemainder / cfg.tickRate
  );
  state.fallVelocityRemainder %= cfg.tickRate;
  state.fallVYMilliPerSecond += deltaV;

  state.fallPositionRemainder += state.fallVYMilliPerSecond;
  const deltaY = Math.floor(
    state.fallPositionRemainder / cfg.tickRate
  );
  state.fallPositionRemainder %= cfg.tickRate;
  state.fallYMilli += deltaY;

  if (
    state.phase === "falling" &&
    state.fallYMilli >= cfg.dropDistanceMilli
  ) {
    state.fallYMilli = cfg.dropDistanceMilli;
    resolveContact(state, targetScore);
    return;
  }

  if (
    state.phase === "falling-out" &&
    state.fallYMilli >=
      cfg.dropDistanceMilli + cfg.fallOutExtraMilli
  ) {
    state.status = "failed";
    state.failure = "NO_SUPPORT";
  }
}

function stepTipping(state: TowerDropState) {
  const cfg = TOWER_DROP_V2;

  state.tipVelocityRemainder +=
    cfg.tipAccelerationMilliDegPerSecondSquared;
  const deltaVelocity = Math.floor(
    state.tipVelocityRemainder / cfg.tickRate
  );
  state.tipVelocityRemainder %= cfg.tickRate;
  state.tipAngularVelocityMilliDegPerSecond += deltaVelocity;

  state.tipAngleRemainder +=
    state.tipAngularVelocityMilliDegPerSecond;
  const deltaAngle = Math.floor(
    state.tipAngleRemainder / cfg.tickRate
  );
  state.tipAngleRemainder %= cfg.tickRate;
  state.tipAngleMilliDeg += deltaAngle;

  if (
    state.tipAngleMilliDeg >= cfg.tipFailureAngleMilliDeg
  ) {
    state.status = "failed";
    state.failure = "CENTER_OF_MASS";
  }
}

export function stepTowerDrop(
  state: TowerDropState,
  targetScore = Number.MAX_SAFE_INTEGER
) {
  if (state.status !== "running") return state;

  const cfg = TOWER_DROP_V2;
  state.tick += 1;

  if (state.phase === "swing") {
    state.idleTicks += 1;
    state.swingPhase =
      (state.swingPhase + swingStepFor(state)) %
      cfg.swingPhaseUnits;
    updateMovingBlockFromSwing(state);

    if (state.idleTicks >= cfg.maxIdleTicksPerBlock) {
      state.status = "failed";
      state.failure = "TIMEOUT_IDLE";
    }

    return state;
  }

  if (
    state.phase === "falling" ||
    state.phase === "falling-out"
  ) {
    stepFalling(state, targetScore);
    return state;
  }

  if (
    state.phase === "tipping-left" ||
    state.phase === "tipping-right"
  ) {
    stepTipping(state);
  }

  return state;
}

/**
 * DROP now releases the block from a swinging hook. Contact, support and any
 * tipping/failure are resolved by subsequent fixed simulation ticks.
 */
export function dropTowerBlock(
  state: TowerDropState,
  _targetScore = Number.MAX_SAFE_INTEGER
) {
  if (
    state.status !== "running" ||
    state.phase !== "swing"
  ) {
    return state;
  }

  state.phase = "falling";
  state.idleTicks = 0;
  state.fallXMilli = state.movingXMilli;
  state.fallYMilli = 0;
  state.fallVXMilliPerSecond = roundDiv(
    state.movingVXMilliPerSecond *
      TOWER_DROP_V2.releaseMomentumPerMille,
    1000
  );
  state.fallXPositionRemainder = 0;
  state.fallVYMilliPerSecond = 0;
  state.fallVelocityRemainder = 0;
  state.fallPositionRemainder = 0;
  state.failure = null;
  state.tipDirection = 0;
  state.tipAngleMilliDeg = 0;

  return state;
}

export function validateTowerDropInputs(
  inputs: TowerDropInput[],
  finalTick: number
) {
  return validateInputSequence(inputs, finalTick, {
    version: TOWER_DROP_V2.inputProtocolVersion,
    allowedActions: ["DROP"],
    maxInputs: 500,
    maxFinalTick: TOWER_DROP_V2.tickRate * 60 * 15,
  });
}

export function replayTowerDrop(
  inputs: TowerDropInput[],
  finalTick: number,
  targetScore = Number.MAX_SAFE_INTEGER
): TowerDropReplayResult {
  const inputError = validateTowerDropInputs(inputs, finalTick);
  const state = createTowerDropState();

  if (inputError) {
    return {
      valid: false,
      error: inputError,
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
      if (state.phase !== "swing") {
        return {
          valid: false,
          error: "DROP_WHILE_BLOCK_ACTIVE",
          state,
          score: state.score,
          timeMs: Math.round(
            (state.tick * 1000) / TOWER_DROP_V2.tickRate
          ),
          height: heightOf(state),
          failure: state.failure,
        };
      }

      dropTowerBlock(state, targetScore);
      inputIndex += 1;
    }

    if (
      state.status !== "running" ||
      state.tick >= finalTick
    ) {
      break;
    }

    stepTowerDrop(state, targetScore);
  }

  if (inputIndex !== inputs.length) {
    return {
      valid: false,
      error: "UNCONSUMED_INPUTS",
      state,
      score: state.score,
      timeMs: Math.round(
        (state.tick * 1000) / TOWER_DROP_V2.tickRate
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
        (state.tick * 1000) / TOWER_DROP_V2.tickRate
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
        (state.tick * 1000) / TOWER_DROP_V2.tickRate
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
      (state.tick * 1000) / TOWER_DROP_V2.tickRate
    ),
    height: heightOf(state),
    failure: state.failure,
  };
}

export const TOWER_DROP_V2_CONTENT = {
  tickRate: TOWER_DROP_V2.tickRate,
  mechanics: {
    pendulumDelivery: true,
    acceleratedFall: true,
    partialSupport: true,
    centerOfMassStability: true,
    edgePivotAndTip: true,
    progressiveSwingDifficulty: true,
    inheritedHorizontalMomentum: true,
    deterministicWallBounce: true,
  },
  scoring: {
    base: 360,
    precisionMax: 420,
    perfectBonus: 240,
    comboStep: 28,
  },
  failureConditions: [
    "NO_SUPPORT",
    "CENTER_OF_MASS",
    "TIMEOUT_IDLE",
  ],
  endCondition: "FIRST_FAILURE_OR_TARGET",
  sourceAttribution:
    "Mechanics inspired by iamkun/tower_game (MIT, Copyright 2018 BMQB, Inc).",
} as const;
