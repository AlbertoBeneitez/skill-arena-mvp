/** Varied continuous corridors composed over the frozen V3 flight and replay rules. */
import { hashSeed } from "../deterministic/seeded";
import {
  JET_STREAM_CORE_V3,
  createJetStreamV3,
  stepJetStreamV3,
  type JetStreamV3State,
} from "./jetStreamCore.v3";
import type { GameCore } from "./coreRuntime.v1";

export const JET_STREAM_V4 = {
  teachingGates: 2,
  initialCenter: 305000,
  minimumCenter: 145000,
  maximumCenter: 475000,
  initialMinimumShift: 25000,
  maximumMinimumShift: 45000,
  minimumShiftIncrease: 400,
  initialMaximumShift: 75000,
  maximumMaximumShift: 85000,
  maximumShiftIncrease: 200,
  alternativeDistance: 190000,
} as const;

export type JetStreamV4State = JetStreamV3State & {
  variegatedThrough: number;
  variegatedCenter: number;
  height: number;
};

export function jetV4ShiftLimits(index: number) {
  const progress = Math.max(0, index - JET_STREAM_V4.teachingGates);
  return {
    minimum: Math.min(
      JET_STREAM_V4.maximumMinimumShift,
      JET_STREAM_V4.initialMinimumShift +
        progress * JET_STREAM_V4.minimumShiftIncrease,
    ),
    maximum: Math.min(
      JET_STREAM_V4.maximumMaximumShift,
      JET_STREAM_V4.initialMaximumShift +
        progress * JET_STREAM_V4.maximumShiftIncrease,
    ),
  };
}

/** Reflect the direction at an edge, preserving the full intended vertical shift. */
function nextCenter(seed: string, index: number, previous: number) {
  const limits = jetV4ShiftLimits(index),
    magnitude =
      limits.minimum +
      (hashSeed(`${seed}:jet4:shift:${index}`) %
        (limits.maximum - limits.minimum + 1)),
    direction = hashSeed(`${seed}:jet4:direction:${index}`) & 1 ? 1 : -1,
    proposed = previous + direction * magnitude;
  return proposed < JET_STREAM_V4.minimumCenter ||
    proposed > JET_STREAM_V4.maximumCenter
    ? previous - direction * magnitude
    : proposed;
}

function prepareFarNewGates(s: JetStreamV4State) {
  for (const gate of s.gates) {
    if (gate.index <= s.variegatedThrough) continue;
    const center =
        gate.index < JET_STREAM_V4.teachingGates
          ? JET_STREAM_V4.initialCenter
          : nextCenter(s.seed, gate.index, s.variegatedCenter),
      main = gate.windows.find((w) => w.centerYMilli === gate.centerYMilli)!;
    // V3 already creates these widths, pickups, dual schedules and world spacing.
    // This changes only the center of a newly-created, distant corridor.
    const windows = gate.windows.map((window) => ({
      centerYMilli:
        window === main
          ? center
          : center +
            (center < 310000 ? 1 : -1) * JET_STREAM_V4.alternativeDistance,
      gapMilli: window.gapMilli,
    }));
    windows.sort((a, b) => a.centerYMilli - b.centerYMilli);
    gate.centerYMilli = center;
    gate.windows = windows;
    s.variegatedCenter = center;
    s.variegatedThrough = gate.index;
  }
}

export function createJetStreamV4(seed: string): JetStreamV4State {
  const state: JetStreamV4State = {
    ...createJetStreamV3(seed),
    variegatedThrough: -1,
    variegatedCenter: JET_STREAM_V4.initialCenter,
    height: 0,
  };
  prepareFarNewGates(state);
  return state;
}

export function stepJetStreamV4(state: JetStreamV4State) {
  stepJetStreamV3(state);
  // V3/V2 append only beyond their 1900px horizon, after collision processing.
  // Existing windows and collectible coordinates are never shifted in flight.
  prepareFarNewGates(state);
  state.height = state.passed;
}

export const JET_STREAM_CORE_V4: GameCore<JetStreamV4State> = {
  ...JET_STREAM_CORE_V3,
  gameVersion: "4.0.0",
  content: {
    base: JET_STREAM_CORE_V3.content,
    corridor: JET_STREAM_V4,
    scenario: "jet4:shift,direction:index;two-centered-teaching-gates",
    reflection: "reverse-full-step-direction-at-145000-and-475000;no-clamp",
    windows: "prepare-new-far-gates-once;preserve-width-spacing-dual-pickup",
    reach: "authoritative-passed-gates;score-and-terminal-rules-unchanged",
  },
  create: createJetStreamV4,
  step: stepJetStreamV4,
};
