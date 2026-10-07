/**
 * Jet Stream competitive core v1.
 *
 * Control semantics are inspired by the MIT-licensed Phaser 3 Flappy Bird
 * example from digitsensitive/phaser3-typescript. Skill Arena replaces Phaser,
 * assets, random pipe generation and browser physics with this deterministic
 * fixed-timestep core.
 */

import { hashSeed } from "../deterministic/seeded";
import {
  validateInputSequence,
  type ReplayInput,
} from "./inputValidation";

export const JET_STREAM_V1 = {
  tickRate: 120,
  coordinateWidth: 390,
  coordinateHeight: 620,
  playerX: 92_000,
  playerRadius: 12_000,
  gateWidth: 30_000,
  gravityMilliPerSecond2: 1_000_000,
  flapVelocityMilliPerSecond: -350_000,
  maxFallVelocityMilliPerSecond: 390_000,
  minimumRiseVelocityMilliPerSecond: -380_000,
  initialGateXMilli: 520_000,
  initialCenterYMilli: 305_000,
  minCenterYMilli: 145_000,
  maxCenterYMilli: 475_000,
  maxCenterDeltaMilli: 78_000,
  initialSpacingMilli: 214_000,
  minimumSpacingMilli: 164_000,
  spacingDecreasePerGateMilli: 1_400,
  spacingJitterMilli: 18_000,
  initialSpeedMilliPerSecond: 132_000,
  speedIncreasePerGateMilliPerSecond: 5_000,
  maxSpeedMilliPerSecond: 350_000,
  initialGapMilli: 158_000,
  gapDecreasePerGateMilli: 2_100,
  minimumGapMilli: 82_000,
  inputProtocolVersion: 1,
  maxInputs: 5_000,
  maxFinalTick: 120 * 60 * 15,
  scoring: {
    base: 280,
    precisionMax: 220,
  },
} as const;

export const JET_STREAM_ACTIONS = ["FLAP"] as const;
export type JetStreamAction =
  (typeof JET_STREAM_ACTIONS)[number];

export type JetStreamInput = ReplayInput & {
  action: JetStreamAction;
};

export type JetStreamFailure =
  | "OUT_OF_BOUNDS"
  | "GATE_COLLISION"
  | null;

export type JetStreamGate = {
  index: number;
  worldXMilli: number;
  centerYMilli: number;
  passed: boolean;
};

export type JetStreamState = {
  tick: number;
  status: "running" | "failed" | "won";
  failure: JetStreamFailure;
  yMilli: number;
  vyMilliPerSecond: number;
  velocityRemainder: number;
  yRemainder: number;
  scrollMilli: number;
  scrollRemainder: number;
  score: number;
  passed: number;
  gates: JetStreamGate[];
  nextGateIndex: number;
  lastGeneratedXMilli: number;
  lastGeneratedCenterYMilli: number;
};

export type JetStreamReplayResult = {
  valid: boolean;
  error?: string;
  state: JetStreamState;
  score: number;
  timeMs: number;
  failure: JetStreamFailure;
};

function signedUnit(seed: string) {
  const raw = hashSeed(seed) >>> 0;
  return (raw / 0xffffffff) * 2 - 1;
}

function speedForPassed(passed: number) {
  const cfg = JET_STREAM_V1;
  return Math.min(
    cfg.maxSpeedMilliPerSecond,
    cfg.initialSpeedMilliPerSecond +
      passed * cfg.speedIncreasePerGateMilliPerSecond
  );
}

export function jetStreamGapMilliForPassed(
  passed: number
) {
  const cfg = JET_STREAM_V1;
  return Math.max(
    cfg.minimumGapMilli,
    cfg.initialGapMilli -
      passed * cfg.gapDecreasePerGateMilli
  );
}

function nextGate(
  seed: string,
  index: number,
  previousX: number,
  previousCenter: number
): JetStreamGate {
  const cfg = JET_STREAM_V1;
  const delta = Math.round(
    signedUnit(`${seed}:jet:center:${index}`) *
      cfg.maxCenterDeltaMilli
  );
  const center = Math.max(
    cfg.minCenterYMilli,
    Math.min(
      cfg.maxCenterYMilli,
      previousCenter + delta
    )
  );

  const difficultySpacing = Math.max(
    cfg.minimumSpacingMilli,
    cfg.initialSpacingMilli -
      index * cfg.spacingDecreasePerGateMilli
  );
  const jitter = Math.round(
    signedUnit(`${seed}:jet:spacing:${index}`) *
      cfg.spacingJitterMilli
  );
  const spacing = Math.max(
    cfg.minimumSpacingMilli,
    difficultySpacing + jitter
  );

  return {
    index,
    worldXMilli: previousX + spacing,
    centerYMilli: center,
    passed: false,
  };
}

function appendGate(
  state: JetStreamState,
  seed: string
) {
  const gate = nextGate(
    seed,
    state.nextGateIndex,
    state.lastGeneratedXMilli,
    state.lastGeneratedCenterYMilli
  );
  state.gates.push(gate);
  state.nextGateIndex += 1;
  state.lastGeneratedXMilli = gate.worldXMilli;
  state.lastGeneratedCenterYMilli =
    gate.centerYMilli;
}

function trimAndFillGates(
  state: JetStreamState,
  seed: string
) {
  // Keep the 120 Hz core allocation-light. Gates are ordered by world X, so
  // only the leading items can leave the active corridor.
  while (
    state.gates.length > 0 &&
    state.gates[0].worldXMilli -
      state.scrollMilli +
      JET_STREAM_V1.gateWidth <=
      -80_000
  ) {
    state.gates.shift();
  }

  while (
    state.lastGeneratedXMilli - state.scrollMilli <
    1_900_000
  ) {
    appendGate(state, seed);
  }
}

export function createJetStreamState(
  seed: string
): JetStreamState {
  const state: JetStreamState = {
    tick: 0,
    status: "running",
    failure: null,
    yMilli: Math.floor(
      (JET_STREAM_V1.coordinateHeight * 1000) / 2
    ),
    vyMilliPerSecond: 0,
    velocityRemainder: 0,
    yRemainder: 0,
    scrollMilli: 0,
    scrollRemainder: 0,
    score: 0,
    passed: 0,
    gates: [],
    nextGateIndex: 0,
    lastGeneratedXMilli:
      JET_STREAM_V1.initialGateXMilli -
      JET_STREAM_V1.initialSpacingMilli,
    lastGeneratedCenterYMilli:
      JET_STREAM_V1.initialCenterYMilli,
  };

  trimAndFillGates(state, seed);
  return state;
}

export function flapJetStream(
  state: JetStreamState
) {
  if (state.status !== "running") return state;

  state.vyMilliPerSecond =
    JET_STREAM_V1.flapVelocityMilliPerSecond;
  state.velocityRemainder = 0;
  return state;
}

function stepVelocity(state: JetStreamState) {
  const cfg = JET_STREAM_V1;

  state.velocityRemainder +=
    cfg.gravityMilliPerSecond2;
  const deltaVelocity = Math.floor(
    state.velocityRemainder / cfg.tickRate
  );
  state.velocityRemainder %= cfg.tickRate;

  state.vyMilliPerSecond = Math.max(
    cfg.minimumRiseVelocityMilliPerSecond,
    Math.min(
      cfg.maxFallVelocityMilliPerSecond,
      state.vyMilliPerSecond + deltaVelocity
    )
  );

  state.yRemainder += state.vyMilliPerSecond;
  const yDelta =
    state.yRemainder >= 0
      ? Math.floor(state.yRemainder / cfg.tickRate)
      : Math.ceil(state.yRemainder / cfg.tickRate);
  state.yRemainder -= yDelta * cfg.tickRate;
  state.yMilli += yDelta;
}

function stepScroll(state: JetStreamState) {
  const cfg = JET_STREAM_V1;
  state.scrollRemainder += speedForPassed(
    state.passed
  );
  const delta = Math.floor(
    state.scrollRemainder / cfg.tickRate
  );
  state.scrollRemainder %= cfg.tickRate;
  state.scrollMilli += delta;
}

function fail(
  state: JetStreamState,
  failure: Exclude<JetStreamFailure, null>
) {
  state.status = "failed";
  state.failure = failure;
}

export function stepJetStream(
  state: JetStreamState,
  seed: string,
  targetScore = Number.MAX_SAFE_INTEGER
) {
  if (state.status !== "running") return state;

  state.tick += 1;
  stepVelocity(state);
  stepScroll(state);

  const cfg = JET_STREAM_V1;
  const radius = cfg.playerRadius;

  if (
    state.yMilli - radius <= 0 ||
    state.yMilli + radius >=
      cfg.coordinateHeight * 1000
  ) {
    fail(state, "OUT_OF_BOUNDS");
    return state;
  }

  const gap = jetStreamGapMilliForPassed(
    state.passed
  );

  for (const gate of state.gates) {
    const x = gate.worldXMilli - state.scrollMilli;
    const overlapsX =
      x < cfg.playerX + radius &&
      x + cfg.gateWidth > cfg.playerX - radius;

    if (overlapsX) {
      const top = gate.centerYMilli - Math.floor(gap / 2);
      const bottom =
        gate.centerYMilli + Math.floor(gap / 2);

      if (
        state.yMilli - radius < top ||
        state.yMilli + radius > bottom
      ) {
        fail(state, "GATE_COLLISION");
        return state;
      }
    }

    if (
      !gate.passed &&
      x + cfg.gateWidth < cfg.playerX - radius
    ) {
      gate.passed = true;

      const precisionNumerator = Math.max(
        0,
        Math.floor(gap / 2) -
          Math.abs(state.yMilli - gate.centerYMilli)
      );
      const precisionPoints = Math.round(
        (precisionNumerator *
          cfg.scoring.precisionMax) /
          Math.max(1, Math.floor(gap / 2))
      );

      state.score +=
        cfg.scoring.base + precisionPoints;
      state.passed += 1;

      if (state.score >= targetScore) {
        state.status = "won";
        state.failure = null;
        return state;
      }
    }
  }

  trimAndFillGates(state, seed);
  return state;
}

export function replayJetStream(
  inputs: JetStreamInput[],
  finalTick: number,
  seed: string,
  targetScore = Number.MAX_SAFE_INTEGER
): JetStreamReplayResult {
  const protocolError = validateInputSequence(
    inputs,
    finalTick,
    {
      version: JET_STREAM_V1.inputProtocolVersion,
      allowedActions: JET_STREAM_ACTIONS,
      maxInputs: JET_STREAM_V1.maxInputs,
      maxFinalTick: JET_STREAM_V1.maxFinalTick,
    }
  );

  const state = createJetStreamState(seed);

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
      flapJetStream(state);
      inputIndex += 1;
    }

    if (
      state.status !== "running" ||
      state.tick >= finalTick
    ) {
      break;
    }

    stepJetStream(state, seed, targetScore);
  }

  if (inputIndex !== inputs.length) {
    return {
      valid: false,
      error: "UNCONSUMED_INPUTS",
      state,
      score: state.score,
      timeMs: Math.round(
        (state.tick * 1000) / JET_STREAM_V1.tickRate
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
        (state.tick * 1000) / JET_STREAM_V1.tickRate
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
        (state.tick * 1000) / JET_STREAM_V1.tickRate
      ),
      failure: state.failure,
    };
  }

  return {
    valid: true,
    state,
    score: state.score,
    timeMs: Math.round(
      (state.tick * 1000) / JET_STREAM_V1.tickRate
    ),
    failure: state.failure,
  };
}

export const JET_STREAM_V1_CONTENT = {
  mechanics: {
    gravityMilliPerSecond2:
      JET_STREAM_V1.gravityMilliPerSecond2,
    flapVelocityMilliPerSecond:
      JET_STREAM_V1.flapVelocityMilliPerSecond,
    initialSpeedMilliPerSecond:
      JET_STREAM_V1.initialSpeedMilliPerSecond,
    speedIncreasePerGateMilliPerSecond:
      JET_STREAM_V1.speedIncreasePerGateMilliPerSecond,
    maxSpeedMilliPerSecond:
      JET_STREAM_V1.maxSpeedMilliPerSecond,
    initialGapMilli:
      JET_STREAM_V1.initialGapMilli,
    gapDecreasePerGateMilli:
      JET_STREAM_V1.gapDecreasePerGateMilli,
    minimumGapMilli:
      JET_STREAM_V1.minimumGapMilli,
    maxCenterDeltaMilli:
      JET_STREAM_V1.maxCenterDeltaMilli,
  },
  scoring: JET_STREAM_V1.scoring,
  failureConditions: [
    "OUT_OF_BOUNDS",
    "GATE_COLLISION",
  ],
  endCondition: "FIRST_FAILURE_OR_TARGET",
  upstream: {
    project: "digitsensitive/phaser3-typescript Flappy Bird example",
    license: "MIT",
    commit: "05f7c8c7796de8a28a7575d6e0425c1513bbd3a2",
  },
} as const;
