/**
 * V8 — alien shooting range. Every order combines a colour AND a figure; every target is a coloured figure on a
 * stand that slides along one of three rails (alternating directions, wrapping at the booth edges). Decoys share
 * only the colour, only the figure, or neither. 2–4 targets match each order. Red light = plates down (a tap is a
 * false start); green light = plates up and moving. Per-tap reaction scoring as V6/V7. V1–V7 stay frozen.
 * Target positions are a pure function of (trial, target, ticks since green), so replay never stores them.
 */
import { createRng } from "../deterministic/seeded";
import type { CoreState, GameCore } from "./coreRuntime.v1";
import { SHOT_GALLERY_ACTIONS_V3 } from "./shotGalleryProtocol.v3";

export const GALLERY_V8_COLORS = ["AZUL", "CORAL", "LIMA", "VIOLETA", "AMARILLO", "ROSA", "TURQUESA", "NARANJA"] as const;
export const GALLERY_V8_SHAPES = ["CÍRCULO", "TRIÁNGULO", "CUADRADO", "HEXÁGONO", "ESTRELLA"] as const;
export const GALLERY_V8 = Object.freeze({
  trials: 12,
  feedbackTicks: 84,
  minimumAward: 80,
  maximumAward: 420,
  minimumReactionTicks: 12,
  wrongPenalty: 100,
  falseStartPenalty: 150,
  maxWrong: 3,
  minimumCorrect: 6,
  minimumCompletionScore: 5000,
  /** Booth: x range the stands slide across (wrapping), rail heights. */
  field: { x0: 18, x1: 372, wrap: 60 },
  rails: [236, 352, 468] as readonly number[],
  perRail: 4,
});
export type GalleryTargetV8 = { rail: number; baseX: number; speed: number; color: number; shape: number };
export type GalleryOrderV8 = { color: number; shape: number };
export type GalleryTrialV8 = { order: GalleryOrderV8; targets: GalleryTargetV8[]; answers: number[]; waitTicks: number; deadlineTicks: number };
export type GalleryResultV8 = {
  trial: number;
  type: "CORRECT" | "PARTIAL" | "WRONG" | "FALSE_START" | "TIMEOUT";
  taps: number[];
  wrongs: number;
  award: number;
};
export type GalleryStateV8 = CoreState & {
  seed: string;
  trials: GalleryTrialV8[];
  trial: number;
  phase: "waiting" | "ready" | "feedback";
  phaseTicks: number;
  readyTick: number;
  hits: number[];
  tapTicks: number[];
  wrongs: number;
  lastTapTick: number;
  lastAward: number;
  results: GalleryResultV8[];
  total: number;
  correct: number;
};

const F = GALLERY_V8.field;
/** Position of a stand (logical px). `ticks` = ticks since the green light. Speed is in milli-px per tick. */
export function galleryTargetPosV8(t: GalleryTargetV8, ticks: number) {
  const span = F.x1 - F.x0 + 2 * F.wrap;
  const raw = t.baseX * 1000 + t.speed * Math.max(0, ticks);
  const x = F.x0 - F.wrap + ((((raw - (F.x0 - F.wrap) * 1000) % (span * 1000)) + span * 1000) % (span * 1000)) / 1000;
  return { x, y: GALLERY_V8.rails[t.rail] };
}

export function galleryTrialsV8(seed: string): GalleryTrialV8[] {
  return Array.from({ length: GALLERY_V8.trials }, (_, index) => {
    const rng = createRng(`${seed}:gallery8:trial:${index}`);
    const color = rng.nextInt(8), shape = rng.nextInt(5);
    const matches = index < 3 ? 2 : 2 + rng.nextInt(index < 7 ? 2 : 3);
    const other = (n: number, avoid: number) => { let v = rng.nextInt(n); while (v === avoid) v = rng.nextInt(n); return v; };
    // Rail speeds grow during the run; directions alternate per rail and flip with the trial.
    const base = 260 + index * 34;
    const speeds = GALLERY_V8.rails.map((_, r) => (r % 2 === index % 2 ? 1 : -1) * (base + rng.nextInt(90) + r * 40));
    const span = F.x1 - F.x0 + 2 * F.wrap;
    const slots: { rail: number; baseX: number }[] = [];
    GALLERY_V8.rails.forEach((_, rail) => {
      const offset = rng.nextInt(Math.floor(span / GALLERY_V8.perRail));
      for (let k = 0; k < GALLERY_V8.perRail; k++) slots.push({ rail, baseX: F.x0 - F.wrap + offset + Math.floor((k * span) / GALLERY_V8.perRail) });
    });
    // Shuffle slots, then assign matching targets first and decoys after.
    for (let i = slots.length - 1; i > 0; i--) { const j = rng.nextInt(i + 1); [slots[i], slots[j]] = [slots[j], slots[i]]; }
    const targets: GalleryTargetV8[] = slots.map((slot, i) => {
      const speed = speeds[slot.rail];
      if (i < matches) return { ...slot, speed, color, shape };
      const mode = (i - matches) % 3; // 0: same colour, 1: same figure, 2: neither
      return {
        ...slot,
        speed,
        color: mode === 0 ? color : other(8, color),
        shape: mode === 1 ? shape : other(5, shape),
      };
    });
    const order = targets.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) { const j = rng.nextInt(i + 1); [order[i], order[j]] = [order[j], order[i]]; }
    const shuffled = order.map((i) => targets[i]);
    const answers = shuffled.map((t, i) => (t.color === color && t.shape === shape ? i : -1)).filter((i) => i >= 0);
    return {
      order: { color, shape },
      targets: shuffled,
      answers,
      waitTicks: (index < 3 ? 120 : 84) + rng.nextInt(96),
      deadlineTicks: 660 - index * 12 + 100 * (answers.length - 1),
    };
  });
}

export function createGalleryV8(seed: string): GalleryStateV8 {
  return {
    tick: 0, status: "running", failure: null, score: 0, seed, trials: galleryTrialsV8(seed), trial: 0,
    phase: "waiting", phaseTicks: 0, readyTick: -1, hits: [], tapTicks: [], wrongs: 0, lastTapTick: -999,
    lastAward: 0, results: [], total: 0, correct: 0,
  };
}

function resolve(s: GalleryStateV8, type: GalleryResultV8["type"]) {
  const award = type === "FALSE_START" ? -GALLERY_V8.falseStartPenalty : 0;
  if (award) s.total = Math.max(0, s.total + award);
  if (type === "CORRECT") s.correct++;
  s.results.push({ trial: s.trial, type, taps: [...s.tapTicks], wrongs: s.wrongs, award: award + 0 });
  s.phase = "feedback";
  s.phaseTicks = 0;
}

export function stepGalleryV8(s: GalleryStateV8) {
  s.tick++;
  s.phaseTicks++;
  const trial = s.trials[s.trial];
  if (s.phase === "waiting") {
    if (s.phaseTicks >= trial.waitTicks) {
      s.phase = "ready"; s.phaseTicks = 0; s.readyTick = s.tick; s.hits = []; s.tapTicks = []; s.wrongs = 0;
    }
    return;
  }
  if (s.phase === "ready") {
    if (s.phaseTicks >= trial.deadlineTicks) resolve(s, s.hits.length ? "PARTIAL" : "TIMEOUT");
    return;
  }
  if (s.phaseTicks < GALLERY_V8.feedbackTicks) return;
  s.trial++;
  if (s.trial === GALLERY_V8.trials) {
    const won = s.correct >= GALLERY_V8.minimumCorrect && s.total >= GALLERY_V8.minimumCompletionScore;
    s.status = won ? "won" : "failed";
    s.failure = won ? null : "RECOGNITION_SCORE";
    s.score = s.total;
    return;
  }
  s.phase = "waiting"; s.phaseTicks = 0; s.readyTick = -1; s.hits = []; s.tapTicks = []; s.wrongs = 0;
}

export function canApplyGalleryV8(s: GalleryStateV8, a: string) {
  if (s.status !== "running" || s.phase === "feedback" || !SHOT_GALLERY_ACTIONS_V3.includes(a)) return false;
  const i = Number(a.slice(5));
  return i < s.trials[s.trial].targets.length && !s.hits.includes(i);
}

export function applyGalleryV8(s: GalleryStateV8, a: string) {
  const i = Number(a.slice(5)), trial = s.trials[s.trial];
  if (s.phase === "waiting") return resolve(s, "FALSE_START");
  if (trial.answers.includes(i)) {
    const dt = s.tick - (s.hits.length ? s.lastTapTick : s.readyTick);
    const award = Math.max(GALLERY_V8.minimumAward, GALLERY_V8.maximumAward - Math.floor((Math.max(0, dt - GALLERY_V8.minimumReactionTicks) * 11) / 5));
    s.hits.push(i);
    s.tapTicks.push(s.tick - s.readyTick);
    s.lastTapTick = s.tick;
    s.lastAward = award;
    s.total += award;
    if (s.hits.length === trial.answers.length) resolve(s, "CORRECT");
  } else {
    s.wrongs++;
    s.lastTapTick = s.tick;
    s.lastAward = -GALLERY_V8.wrongPenalty;
    s.total = Math.max(0, s.total - GALLERY_V8.wrongPenalty);
    if (s.wrongs >= GALLERY_V8.maxWrong) resolve(s, "WRONG");
  }
}

export const SHOT_GALLERY_CORE_V8: GameCore<GalleryStateV8> = {
  gameId: "reaction-test",
  gameVersion: "8.0.0",
  width: 390,
  height: 620,
  tickRate: 120,
  maxFinalTick: 120 * 60 * 3,
  maxInputs: 200,
  inputVersion: 3,
  actions: SHOT_GALLERY_ACTIONS_V3,
  content: {
    rules: GALLERY_V8,
    colors: GALLERY_V8_COLORS,
    shapes: GALLERY_V8_SHAPES,
    scenario: "gallery8-alien-range-colour-and-figure-orders-moving-rails-v8",
    clock: "TICKS_REVEAL_THEN_REACTION",
    aggregation: "TOTAL_PUBLISHED_AT_TERMINAL",
  },
  create: createGalleryV8,
  step: stepGalleryV8,
  canApply: canApplyGalleryV8,
  apply: applyGalleryV8,
};
