/**
 * Piano Rush competitive core v1.
 *
 * Frozen competitive implementation for gameVersion 1.0.0 once released.
 * The core is browser-independent: note order, timing windows, scoring and
 * terminal conditions are fully reconstructed from seed + tick inputs.
 */

import { createRng } from "../deterministic/seeded";
import {
  validateInputSequence,
  type ReplayInput,
} from "./inputValidation";

export const PIANO_RUSH_V1 = {
  tickRate: 120,
  coordinateWidth: 390,
  coordinateHeight: 620,
  lanes: 4,
  scheduleLength: 2_000,
  firstTargetTick: 150,
  baseIntervalTicks: 76,
  minimumIntervalTicks: 48,
  intervalDecreaseEveryNotes: 12,
  intervalDecreaseTicks: 2,
  maxTimingErrorTicks: 24,
  perfectTimingErrorTicks: 5,
  inputProtocolVersion: 1,
  maxInputs: 2_000,
  maxFinalTick: 120 * 60 * 15,
  scoring: {
    base: 350,
    precisionMax: 450,
    comboStep: 12,
    comboCap: 400,
  },
  presentationTiming: {
    initialTravelTicks: 220,
    minimumTravelTicks: 158,
    decreaseEveryNotes: 16,
    decreaseTicks: 7,
  },
} as const;

export const PIANO_RUSH_ACTIONS = [
  "LANE_0",
  "LANE_1",
  "LANE_2",
  "LANE_3",
] as const;

export type PianoRushAction =
  (typeof PIANO_RUSH_ACTIONS)[number];

export type PianoRushInput = ReplayInput & {
  action: PianoRushAction;
};

export type PianoRushFailure =
  | "WRONG_LANE"
  | "EARLY_TAP"
  | "LATE_TAP"
  | "MISSED_NOTE"
  | "SCHEDULE_EXHAUSTED"
  | null;

export type PianoRushNote = {
  index: number;
  lane: 0 | 1 | 2 | 3;
  targetTick: number;
};

export type PianoRushState = {
  tick: number;
  status: "running" | "failed" | "won";
  failure: PianoRushFailure;
  score: number;
  combo: number;
  nextNoteIndex: number;
  lastHitLane: 0 | 1 | 2 | 3 | null;
  lastHitErrorTicks: number | null;
  lastScoreDelta: number;
  schedule: PianoRushNote[];
};

export type PianoRushReplayResult = {
  valid: boolean;
  error?: string;
  state: PianoRushState;
  score: number;
  timeMs: number;
  failure: PianoRushFailure;
};

function intervalForIndex(index: number) {
  const cfg = PIANO_RUSH_V1;
  return Math.max(
    cfg.minimumIntervalTicks,
    cfg.baseIntervalTicks -
      Math.floor(index / cfg.intervalDecreaseEveryNotes) *
        cfg.intervalDecreaseTicks
  );
}

export function pianoRushTravelTicksFor(index: number) {
  const cfg = PIANO_RUSH_V1.presentationTiming;
  return Math.max(
    cfg.minimumTravelTicks,
    cfg.initialTravelTicks -
      Math.floor(index / cfg.decreaseEveryNotes) *
        cfg.decreaseTicks
  );
}

export function buildPianoRushSchedule(
  seed: string,
  count = PIANO_RUSH_V1.scheduleLength
): PianoRushNote[] {
  const rng = createRng(`${seed}:piano-rush:v1`);
  const notes: PianoRushNote[] = [];
  let previous = -1;
  let repeated = 0;
  let targetTick = PIANO_RUSH_V1.firstTargetTick;

  for (let index = 0; index < count; index += 1) {
    let lane = rng.nextInt(PIANO_RUSH_V1.lanes);

    if (lane === previous) {
      repeated += 1;
      if (repeated >= 2) {
        const offset = 1 + rng.nextInt(PIANO_RUSH_V1.lanes - 1);
        lane = (lane + offset) % PIANO_RUSH_V1.lanes;
        repeated = 0;
      }
    } else {
      repeated = 0;
    }

    notes.push({
      index,
      lane: lane as PianoRushNote["lane"],
      targetTick,
    });

    previous = lane;
    targetTick += intervalForIndex(index);
  }

  return notes;
}

export function createPianoRushState(seed: string): PianoRushState {
  return {
    tick: 0,
    status: "running",
    failure: null,
    score: 0,
    combo: 0,
    nextNoteIndex: 0,
    lastHitLane: null,
    lastHitErrorTicks: null,
    lastScoreDelta: 0,
    schedule: buildPianoRushSchedule(seed),
  };
}

export function pianoRushLaneForAction(
  action: PianoRushAction
): PianoRushNote["lane"] {
  switch (action) {
    case "LANE_0":
      return 0;
    case "LANE_1":
      return 1;
    case "LANE_2":
      return 2;
    case "LANE_3":
      return 3;
  }
}

export function pianoRushActionForLane(
  lane: number
): PianoRushAction | null {
  return lane >= 0 && lane < PIANO_RUSH_ACTIONS.length
    ? PIANO_RUSH_ACTIONS[lane as 0 | 1 | 2 | 3]
    : null;
}

function fail(
  state: PianoRushState,
  reason: Exclude<PianoRushFailure, null>
) {
  state.status = "failed";
  state.failure = reason;
}

export function tapPianoRush(
  state: PianoRushState,
  action: PianoRushAction,
  targetScore = Number.MAX_SAFE_INTEGER
) {
  if (state.status !== "running") return state;

  const note = state.schedule[state.nextNoteIndex];
  if (!note) {
    fail(state, "SCHEDULE_EXHAUSTED");
    return state;
  }

  const lane = pianoRushLaneForAction(action);
  const errorTicks = state.tick - note.targetTick;
  const absErrorTicks = Math.abs(errorTicks);

  if (errorTicks < -PIANO_RUSH_V1.maxTimingErrorTicks) {
    fail(state, "EARLY_TAP");
    return state;
  }

  if (errorTicks > PIANO_RUSH_V1.maxTimingErrorTicks) {
    fail(state, "LATE_TAP");
    return state;
  }

  if (lane !== note.lane) {
    fail(state, "WRONG_LANE");
    return state;
  }

  const precisionPoints = Math.round(
    ((PIANO_RUSH_V1.maxTimingErrorTicks - absErrorTicks) *
      PIANO_RUSH_V1.scoring.precisionMax) /
      PIANO_RUSH_V1.maxTimingErrorTicks
  );

  state.combo += 1;
  const comboBonus = Math.min(
    PIANO_RUSH_V1.scoring.comboCap,
    state.combo * PIANO_RUSH_V1.scoring.comboStep
  );
  const scoreDelta =
    PIANO_RUSH_V1.scoring.base +
    precisionPoints +
    comboBonus;

  state.score += scoreDelta;
  state.nextNoteIndex += 1;
  state.lastHitLane = lane;
  state.lastHitErrorTicks = absErrorTicks;
  state.lastScoreDelta = scoreDelta;
  state.failure = null;

  if (state.score >= targetScore) {
    state.status = "won";
  }

  return state;
}

export function stepPianoRush(
  state: PianoRushState,
  targetScore = Number.MAX_SAFE_INTEGER
) {
  if (state.status !== "running") return state;

  state.tick += 1;

  if (state.score >= targetScore) {
    state.status = "won";
    return state;
  }

  const note = state.schedule[state.nextNoteIndex];
  if (!note) {
    fail(state, "SCHEDULE_EXHAUSTED");
    return state;
  }

  if (
    state.tick >
    note.targetTick + PIANO_RUSH_V1.maxTimingErrorTicks
  ) {
    fail(state, "MISSED_NOTE");
  }

  return state;
}

export function replayPianoRush(
  inputs: PianoRushInput[],
  finalTick: number,
  seed: string,
  targetScore = Number.MAX_SAFE_INTEGER
): PianoRushReplayResult {
  const protocolError = validateInputSequence(inputs, finalTick, {
    version: PIANO_RUSH_V1.inputProtocolVersion,
    allowedActions: PIANO_RUSH_ACTIONS,
    maxInputs: PIANO_RUSH_V1.maxInputs,
    maxFinalTick: PIANO_RUSH_V1.maxFinalTick,
  });

  const state = createPianoRushState(seed);

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
      tapPianoRush(
        state,
        inputs[inputIndex].action,
        targetScore
      );
      inputIndex += 1;
    }

    if (
      state.status !== "running" ||
      state.tick >= finalTick
    ) {
      break;
    }

    stepPianoRush(state, targetScore);
  }

  if (inputIndex !== inputs.length) {
    return {
      valid: false,
      error: "UNCONSUMED_INPUTS",
      state,
      score: state.score,
      timeMs: Math.round(
        (state.tick * 1000) / PIANO_RUSH_V1.tickRate
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
        (state.tick * 1000) / PIANO_RUSH_V1.tickRate
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
        (state.tick * 1000) / PIANO_RUSH_V1.tickRate
      ),
      failure: state.failure,
    };
  }

  return {
    valid: true,
    state,
    score: state.score,
    timeMs: Math.round(
      (state.tick * 1000) / PIANO_RUSH_V1.tickRate
    ),
    failure: state.failure,
  };
}

export const PIANO_RUSH_V1_CONTENT = {
  mechanics: {
    lanes: PIANO_RUSH_V1.lanes,
    firstTargetTick: PIANO_RUSH_V1.firstTargetTick,
    baseIntervalTicks: PIANO_RUSH_V1.baseIntervalTicks,
    minimumIntervalTicks: PIANO_RUSH_V1.minimumIntervalTicks,
    intervalDecreaseEveryNotes:
      PIANO_RUSH_V1.intervalDecreaseEveryNotes,
    intervalDecreaseTicks:
      PIANO_RUSH_V1.intervalDecreaseTicks,
    maxTimingErrorTicks:
      PIANO_RUSH_V1.maxTimingErrorTicks,
    perfectTimingErrorTicks:
      PIANO_RUSH_V1.perfectTimingErrorTicks,
    presentationTiming:
      PIANO_RUSH_V1.presentationTiming,
  },
  scoring: PIANO_RUSH_V1.scoring,
  failureConditions: [
    "WRONG_LANE",
    "EARLY_TAP",
    "LATE_TAP",
    "MISSED_NOTE",
    "SCHEDULE_EXHAUSTED",
  ],
  endCondition: "FIRST_MISTAKE_OR_TARGET",
} as const;
