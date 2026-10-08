/** New finite rhythm rules. Piano V1 and its verifier remain frozen. */
import { createRng } from "../deterministic/seeded";
import { roundDiv } from "../deterministic/integerMath";
import { PIANO_V2_ACTIONS } from "./pianoRushProtocol.v2";
import type { CoreState, GameCore } from "./coreRuntime.v1";
export const PIANO_V2_RULES = {
  notes: 48,
  warmupNotes: 8,
  firstTargetTick: 240,
  intervals: [108, 96, 84],
  windows: [36, 30, 24],
  sectorGap: 240,
  inputCooldown: 36,
  protectionTicks: 90,
  maxFinalTick: 7200,
  maxInputs: 240,
  lives: 3,
  minCorrect: 32,
} as const;
export type RhythmNote = {
  index: number;
  lane: number;
  targetTick: number;
  window: number;
};
export type RhythmState = CoreState & {
  seed: string;
  notes: RhythmNote[];
  nextNoteIndex: number;
  correct: number;
  missed: number;
  combo: number;
  lives: number;
  lastInputTick: number;
  protectedUntil: number;
  lastJudgementTick: number;
  lastJudgement: "PERFECT" | "GOOD" | "EARLY" | "WRONG" | "MISS" | null;
  lastLane: number;
  lastScoreDelta: number;
};
export function buildPianoV2Schedule(seed: string): RhythmNote[] {
  const rng = createRng(`${seed}:piano-rush:v2`);
  let targetTick = 240,
    previous = -1,
    repeated = 0;
  return Array.from({ length: 48 }, (_, index) => {
    let lane = rng.nextInt(4);
    if (lane === previous) {
      repeated++;
      if (repeated >= 2) {
        lane = (lane + 1 + rng.nextInt(3)) % 4;
        repeated = 0;
      }
    } else repeated = 0;
    previous = lane;
    const sector = Math.floor(index / 16),
      note = {
        index,
        lane,
        targetTick,
        window: PIANO_V2_RULES.windows[sector],
      };
    targetTick +=
      PIANO_V2_RULES.intervals[sector] +
      (index === 15 || index === 31 ? 240 : 0);
    return note;
  });
}
export function createPianoV2(seed: string): RhythmState {
  return {
    seed,
    tick: 0,
    status: "running",
    score: 0,
    failure: null,
    notes: buildPianoV2Schedule(seed),
    nextNoteIndex: 0,
    correct: 0,
    missed: 0,
    combo: 0,
    lives: 3,
    lastInputTick: -36,
    protectedUntil: 0,
    lastJudgementTick: -999,
    lastJudgement: null,
    lastLane: -1,
    lastScoreDelta: 0,
  };
}
function mistake(s: RhythmState, kind: "EARLY" | "WRONG" | "MISS") {
  s.combo = 0;
  s.score = Math.max(0, s.score - (kind === "EARLY" ? 100 : 180));
  s.lastJudgement = kind;
  s.lastJudgementTick = s.tick;
  s.lastScoreDelta = 0;
  if (s.nextNoteIndex >= 8 && s.tick >= s.protectedUntil) {
    s.lives--;
    s.protectedUntil = s.tick + 90;
    if (!s.lives) {
      s.status = "failed";
      s.failure = "MISSED_NOTES";
    }
  }
}
function next(s: RhythmState) {
  s.nextNoteIndex++;
  if (s.status !== "running") return;
  if (s.nextNoteIndex % 16 === 0) {
    s.score += 500;
    s.lives = Math.min(3, s.lives + 1);
  }
  if (s.nextNoteIndex === 48) {
    s.status = s.correct >= 32 ? "won" : "failed";
    s.failure = s.status === "won" ? null : "NOTES_INCOMPLETE";
  }
}
export function stepPianoV2(s: RhythmState) {
  s.tick++;
  const note = s.notes[s.nextNoteIndex];
  if (note && s.tick > note.targetTick + note.window) {
    s.missed++;
    s.lastLane = note.lane;
    mistake(s, "MISS");
    next(s);
  }
}
export function tapPianoV2(s: RhythmState, a: string) {
  s.lastInputTick = s.tick;
  const note = s.notes[s.nextNoteIndex],
    lane = Number(a.slice(5));
  s.lastLane = lane;
  if (s.tick < note.targetTick - note.window) {
    mistake(s, "EARLY");
    return;
  }
  if (lane !== note.lane) {
    s.missed++;
    mistake(s, "WRONG");
    next(s);
    return;
  }
  const error = Math.abs(s.tick - note.targetTick);
  s.combo++;
  s.correct++;
  const delta =
    350 +
    roundDiv((note.window - error) * 450, note.window) +
    Math.min(360, s.combo * 12);
  s.score += delta;
  s.lastScoreDelta = delta;
  s.lastJudgement = error <= 6 ? "PERFECT" : "GOOD";
  s.lastJudgementTick = s.tick;
  next(s);
}
export const PIANO_V2_CORE: GameCore<RhythmState> = {
  gameId: "piano-rush",
  gameVersion: "2.0.0",
  width: 390,
  height: 620,
  tickRate: 120,
  maxFinalTick: 7200,
  maxInputs: 240,
  inputVersion: 1,
  actions: PIANO_V2_ACTIONS,
  content: {
    rules: PIANO_V2_RULES,
    generator: "48-seeded-notes-no-three-repeated-lanes-three-sectors-v2",
    score:
      "350+450precision+combo12-cap360;early-minus100;wrong/miss-minus180;sector500",
    completion:
      "48-resolved-and32correct-or-target;three-shields;first8no-shield-loss;timeout-loss",
    input: "LANE_0..3;36ticks-cooldown-all-legal-hit-windows-separate",
  },
  create: createPianoV2,
  step: stepPianoV2,
  canApply: (s, a) =>
    PIANO_V2_ACTIONS.includes(a as (typeof PIANO_V2_ACTIONS)[number]) &&
    s.tick - s.lastInputTick >= 36,
  apply: tapPianoV2,
};
