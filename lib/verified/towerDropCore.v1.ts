export const TOWER_DROP_V1 = {
  gameId: "tower-drop",
  gameVersion: "1.0.0",
  engineVersion: "skill-core-1",
  tickRate: 120,
  widthMilli: 390_000,
  leftMilli: 8_000,
  startWidthMilli: 228_000,
  overlapFailureMilli: 1_000,
  maxBouncesPerBlock: 5,
  baseSpeedMilliPerSecond: 132_000,
  speedStepMilliPerSecond: 6_500,
  maxSpeedMilliPerSecond: 320_000,
  perfectPerMille: 975,
  inputProtocolVersion: 1,
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

export type TowerDropFailure = "NO_OVERLAP" | "TIMEOUT_BOUNCES" | null;

export type TowerDropState = {
  tick: number;
  movingXMilli: number;
  movingWMilli: number;
  direction: 1 | -1;
  speedMilliPerSecond: number;
  movementRemainder: number;
  bounces: number;
  score: number;
  combo: number;
  blocks: TowerDropBlock[];
  status: "running" | "failed";
  failure: TowerDropFailure;
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

export function createTowerDropState(): TowerDropState {
  const { widthMilli, startWidthMilli, leftMilli, baseSpeedMilliPerSecond } = TOWER_DROP_V1;
  return {
    tick: 0,
    movingXMilli: leftMilli,
    movingWMilli: startWidthMilli,
    direction: 1,
    speedMilliPerSecond: baseSpeedMilliPerSecond,
    movementRemainder: 0,
    bounces: 0,
    score: 0,
    combo: 0,
    blocks: [
      {
        xMilli: Math.floor((widthMilli - startWidthMilli) / 2),
        wMilli: startWidthMilli,
      },
    ],
    status: "running",
    failure: null,
  };
}

export function stepTowerDrop(state: TowerDropState) {
  if (state.status !== "running") return state;

  const cfg = TOWER_DROP_V1;
  state.tick += 1;

  const numerator = state.speedMilliPerSecond + state.movementRemainder;
  const deltaMilli = Math.floor(numerator / cfg.tickRate);
  state.movementRemainder = numerator % cfg.tickRate;
  state.movingXMilli += state.direction * deltaMilli;

  const rightLimit = cfg.widthMilli - cfg.leftMilli;

  if (state.movingXMilli <= cfg.leftMilli) {
    state.movingXMilli = cfg.leftMilli;
    state.direction = 1;
    state.bounces += 1;
  }

  if (state.movingXMilli + state.movingWMilli >= rightLimit) {
    state.movingXMilli = rightLimit - state.movingWMilli;
    state.direction = -1;
    state.bounces += 1;
  }

  if (state.bounces >= cfg.maxBouncesPerBlock) {
    state.status = "failed";
    state.failure = "TIMEOUT_BOUNCES";
  }

  return state;
}

export function dropTowerBlock(state: TowerDropState) {
  if (state.status !== "running") return state;

  const cfg = TOWER_DROP_V1;
  const top = state.blocks[state.blocks.length - 1];
  const left = Math.max(state.movingXMilli, top.xMilli);
  const right = Math.min(
    state.movingXMilli + state.movingWMilli,
    top.xMilli + top.wMilli
  );
  const overlap = right - left;

  if (overlap <= cfg.overlapFailureMilli) {
    state.status = "failed";
    state.failure = "NO_OVERLAP";
    return state;
  }

  const precisionPoints = roundDiv(overlap * 420, top.wMilli);
  const perfect = overlap * 1000 > top.wMilli * cfg.perfectPerMille;

  state.score +=
    360 +
    precisionPoints +
    (perfect ? 240 : 0) +
    state.combo * 28;

  state.combo = perfect ? state.combo + 1 : 0;
  state.blocks.push({ xMilli: left, wMilli: overlap });
  state.movingWMilli = overlap;

  state.direction = state.direction === 1 ? -1 : 1;
  state.movingXMilli =
    state.direction > 0
      ? cfg.leftMilli
      : cfg.widthMilli - cfg.leftMilli - overlap;

  const height = state.blocks.length - 1;
  state.speedMilliPerSecond = Math.min(
    cfg.maxSpeedMilliPerSecond,
    cfg.baseSpeedMilliPerSecond + height * cfg.speedStepMilliPerSecond
  );
  state.movementRemainder = 0;
  state.bounces = 0;

  return state;
}

export function validateTowerDropInputs(inputs: TowerDropInput[], finalTick: number) {
  if (!Number.isInteger(finalTick) || finalTick < 0 || finalTick > TOWER_DROP_V1.tickRate * 60 * 15) {
    return "INVALID_FINAL_TICK";
  }
  if (!Array.isArray(inputs) || inputs.length > 500) return "TOO_MANY_INPUTS";

  let previousTick = -1;
  for (let index = 0; index < inputs.length; index += 1) {
    const input = inputs[index];
    if (
      input?.action !== "DROP" ||
      input.seq !== index ||
      !Number.isInteger(input.tick) ||
      input.tick < 0 ||
      input.tick > finalTick ||
      input.tick <= previousTick
    ) {
      return "INVALID_INPUT_STREAM";
    }
    previousTick = input.tick;
  }

  return null;
}

export function replayTowerDrop(
  inputs: TowerDropInput[],
  finalTick: number
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

  while (state.tick < finalTick && state.status === "running") {
    stepTowerDrop(state);

    while (
      inputIndex < inputs.length &&
      inputs[inputIndex].tick === state.tick &&
      state.status === "running"
    ) {
      dropTowerBlock(state);
      inputIndex += 1;
    }
  }

  if (inputIndex !== inputs.length) {
    return {
      valid: false,
      error: "UNCONSUMED_INPUTS",
      state,
      score: state.score,
      timeMs: Math.round((state.tick * 1000) / TOWER_DROP_V1.tickRate),
      height: state.blocks.length - 1,
      failure: state.failure,
    };
  }

  if (state.tick !== finalTick) {
    return {
      valid: false,
      error: "FINAL_TICK_AFTER_FAILURE",
      state,
      score: state.score,
      timeMs: Math.round((state.tick * 1000) / TOWER_DROP_V1.tickRate),
      height: state.blocks.length - 1,
      failure: state.failure,
    };
  }

  if (state.status !== "failed") {
    return {
      valid: false,
      error: "CLIENT_ENDED_BEFORE_FAILURE",
      state,
      score: state.score,
      timeMs: Math.round((state.tick * 1000) / TOWER_DROP_V1.tickRate),
      height: state.blocks.length - 1,
      failure: state.failure,
    };
  }

  return {
    valid: true,
    state,
    score: state.score,
    timeMs: Math.round((state.tick * 1000) / TOWER_DROP_V1.tickRate),
    height: state.blocks.length - 1,
    failure: state.failure,
  };
}

export const TOWER_DROP_V1_CONTENT = {
  ...TOWER_DROP_V1,
  scoring: {
    base: 360,
    precisionMax: 420,
    perfectBonus: 240,
    comboStep: 28,
  },
  failureConditions: ["NO_OVERLAP", "TIMEOUT_BOUNCES"],
  endCondition: "FIRST_FAILURE",
} as const;
