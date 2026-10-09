/** One continuous rhythm run. Frozen V2 lane, judgement and scoring primitives
 * are reused; only the versioned initial schedule changes, before simulation. */
import { roundDiv } from "../deterministic/integerMath";
import {
  PIANO_V2_CORE,
  buildPianoV2Schedule,
  createPianoV2,
  type RhythmNote,
  type RhythmState,
} from "./pianoRushCore.v2";
import type { GameCore } from "./coreRuntime.v1";

export const PIANO_V3_RULES = Object.freeze({
  notes: 48,
  warmupNotes: 8,
  firstTargetTick: 240,
  openingInterval: 108,
  finalInterval: 84,
  openingWindow: 36,
  finalWindow: 24,
  rampNotes: 40,
  inputCooldown: 36,
  protectionTicks: 90,
  maxFinalTick: 7200,
  maxInputs: 240,
  lives: 3,
  minCorrect: 32,
});

export function buildPianoV3Schedule(seed: string): RhythmNote[] {
  return retime(buildPianoV2Schedule(seed));
}

function retime(lanes: RhythmNote[]): RhythmNote[] {
  let targetTick = PIANO_V3_RULES.firstTargetTick;
  return lanes.map((note, index) => {
    const ramp = Math.max(0, index - (PIANO_V3_RULES.warmupNotes - 1));
    const window = PIANO_V3_RULES.openingWindow - roundDiv(ramp * 12, 40);
    const current = { index, lane: note.lane, targetTick, window };
    targetTick += PIANO_V3_RULES.openingInterval - roundDiv(ramp * 24, 40);
    return current;
  });
}

export function createPianoV3(seed: string): RhythmState {
  const state = createPianoV2(seed);
  state.notes = retime(state.notes);
  return state;
}

export const PIANO_V3_CORE: GameCore<RhythmState> = {
  ...PIANO_V2_CORE,
  gameVersion: "3.0.0",
  content: {
    rules: PIANO_V3_RULES,
    generator: "frozen-v2-lanes;continuous-48-note-integer-ramp;no-gaps-v3",
    judgementVersion: "piano-rush-v2",
    score:
      "350+450precision+combo12-cap360;early-minus100;wrong/miss-minus180;milestone500-every16",
    completion:
      "48-resolved-and32correct-or-target;three-shields;first8no-shield-loss;timeout-loss",
    input: "LANE_0..3;36ticks-cooldown-all-legal-hit-windows-separate",
  },
  create: createPianoV3,
};
