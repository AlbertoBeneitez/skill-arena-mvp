/**
 * V9 — killer range, static plates. Orders still combine a colour AND a figure (2–4 matches, decoys share only the
 * colour, only the figure, or neither), but every plate stands still at a seeded, well-spaced spot: the challenge is
 * reading the order and shooting fast, not tracking movement. Plates per screen grow from 8 to 12. V1–V8 stay frozen.
 */
import { createRng } from "../deterministic/seeded";
import type { CoreState, GameCore } from "./coreRuntime.v1";
import { SHOT_GALLERY_ACTIONS_V3 } from "./shotGalleryProtocol.v3";

export const GALLERY_V9_COLORS = ["AZUL", "CORAL", "LIMA", "VIOLETA", "AMARILLO", "ROSA", "TURQUESA", "NARANJA"] as const;
export const GALLERY_V9_SHAPES = ["CÍRCULO", "TRIÁNGULO", "CUADRADO", "HEXÁGONO", "ESTRELLA"] as const;
export const GALLERY_V9 = Object.freeze({
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
  field: { x0: 40, x1: 350, y0: 196, y1: 528, minDistance: 70 },
});
export type GalleryTargetV9 = { x: number; y: number; color: number; shape: number };
export type GalleryOrderV9 = { color: number; shape: number };
export type GalleryTrialV9 = { order: GalleryOrderV9; targets: GalleryTargetV9[]; answers: number[]; waitTicks: number; deadlineTicks: number };
export type GalleryResultV9 = {
  trial: number;
  type: "CORRECT" | "PARTIAL" | "WRONG" | "FALSE_START" | "TIMEOUT";
  taps: number[];
  wrongs: number;
  award: number;
};
export type GalleryStateV9 = CoreState & {
  seed: string;
  trials: GalleryTrialV9[];
  trial: number;
  phase: "waiting" | "ready" | "feedback";
  phaseTicks: number;
  readyTick: number;
  hits: number[];
  tapTicks: number[];
  wrongs: number;
  lastTapTick: number;
  lastAward: number;
  results: GalleryResultV9[];
  total: number;
  correct: number;
};

const F = GALLERY_V9.field;
/** Plates never move in V9; kept as a function so renderers share one lookup. */
export function galleryTargetPosV9(t: GalleryTargetV9) {
  return { x: t.x, y: t.y };
}

export function galleryTrialsV9(seed: string): GalleryTrialV9[] {
  return Array.from({ length: GALLERY_V9.trials }, (_, index) => {
    const rng = createRng(`${seed}:gallery9:trial:${index}`);
    const color = rng.nextInt(8), shape = rng.nextInt(5);
    const matches = index < 3 ? 2 : 2 + rng.nextInt(index < 7 ? 2 : 3);
    const other = (n: number, avoid: number) => { let v = rng.nextInt(n); while (v === avoid) v = rng.nextInt(n); return v; };
    const count = Math.min(12, 8 + Math.floor(index / 3));
    const points: { x: number; y: number }[] = [];
    for (let attempt = 0; points.length < count && attempt < 4000; attempt++) {
      const x = F.x0 + rng.nextInt(F.x1 - F.x0 + 1),
        y = F.y0 + rng.nextInt(F.y1 - F.y0 + 1),
        gap = attempt > 2000 ? F.minDistance - 12 : F.minDistance;
      if (points.every((p) => Math.hypot(p.x - x, p.y - y) >= gap)) points.push({ x, y });
    }
    while (points.length < count) points.push({ x: F.x0 + rng.nextInt(F.x1 - F.x0), y: F.y0 + rng.nextInt(F.y1 - F.y0) });
    const targets: GalleryTargetV9[] = points.map((p, i) => {
      if (i < matches) return { ...p, color, shape };
      const mode = (i - matches) % 3; // 0: same colour, 1: same figure, 2: neither
      return { ...p, color: mode === 0 ? color : other(8, color), shape: mode === 1 ? shape : other(5, shape) };
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
      deadlineTicks: 600 - index * 14 + 90 * (answers.length - 1),
    };
  });
}

export function createGalleryV9(seed: string): GalleryStateV9 {
  return {
    tick: 0, status: "running", failure: null, score: 0, seed, trials: galleryTrialsV9(seed), trial: 0,
    phase: "waiting", phaseTicks: 0, readyTick: -1, hits: [], tapTicks: [], wrongs: 0, lastTapTick: -999,
    lastAward: 0, results: [], total: 0, correct: 0,
  };
}

function resolve(s: GalleryStateV9, type: GalleryResultV9["type"]) {
  const award = type === "FALSE_START" ? -GALLERY_V9.falseStartPenalty : 0;
  if (award) s.total = Math.max(0, s.total + award);
  if (type === "CORRECT") s.correct++;
  s.results.push({ trial: s.trial, type, taps: [...s.tapTicks], wrongs: s.wrongs, award: award + 0 });
  s.phase = "feedback";
  s.phaseTicks = 0;
}

export function stepGalleryV9(s: GalleryStateV9) {
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
  if (s.phaseTicks < GALLERY_V9.feedbackTicks) return;
  s.trial++;
  if (s.trial === GALLERY_V9.trials) {
    const won = s.correct >= GALLERY_V9.minimumCorrect && s.total >= GALLERY_V9.minimumCompletionScore;
    s.status = won ? "won" : "failed";
    s.failure = won ? null : "RECOGNITION_SCORE";
    s.score = s.total;
    return;
  }
  s.phase = "waiting"; s.phaseTicks = 0; s.readyTick = -1; s.hits = []; s.tapTicks = []; s.wrongs = 0;
}

export function canApplyGalleryV9(s: GalleryStateV9, a: string) {
  if (s.status !== "running" || s.phase === "feedback" || !SHOT_GALLERY_ACTIONS_V3.includes(a)) return false;
  const i = Number(a.slice(5));
  return i < s.trials[s.trial].targets.length && !s.hits.includes(i);
}

export function applyGalleryV9(s: GalleryStateV9, a: string) {
  const i = Number(a.slice(5)), trial = s.trials[s.trial];
  if (s.phase === "waiting") return resolve(s, "FALSE_START");
  if (trial.answers.includes(i)) {
    const dt = s.tick - (s.hits.length ? s.lastTapTick : s.readyTick);
    const award = Math.max(GALLERY_V9.minimumAward, GALLERY_V9.maximumAward - Math.floor((Math.max(0, dt - GALLERY_V9.minimumReactionTicks) * 11) / 5));
    s.hits.push(i);
    s.tapTicks.push(s.tick - s.readyTick);
    s.lastTapTick = s.tick;
    s.lastAward = award;
    s.total += award;
    if (s.hits.length === trial.answers.length) resolve(s, "CORRECT");
  } else {
    s.wrongs++;
    s.lastTapTick = s.tick;
    s.lastAward = -GALLERY_V9.wrongPenalty;
    s.total = Math.max(0, s.total - GALLERY_V9.wrongPenalty);
    if (s.wrongs >= GALLERY_V9.maxWrong) resolve(s, "WRONG");
  }
}

export const SHOT_GALLERY_CORE_V9: GameCore<GalleryStateV9> = {
  gameId: "reaction-test",
  gameVersion: "9.0.0",
  width: 390,
  height: 620,
  tickRate: 120,
  maxFinalTick: 120 * 60 * 3,
  maxInputs: 200,
  inputVersion: 3,
  actions: SHOT_GALLERY_ACTIONS_V3,
  content: {
    rules: GALLERY_V9,
    colors: GALLERY_V9_COLORS,
    shapes: GALLERY_V9_SHAPES,
    scenario: "gallery9-killer-range-colour-and-figure-orders-static-plates-v9",
    clock: "TICKS_REVEAL_THEN_REACTION",
    aggregation: "TOTAL_PUBLISHED_AT_TERMINAL",
  },
  create: createGalleryV9,
  step: stepGalleryV9,
  canApply: canApplyGalleryV9,
  apply: applyGalleryV9,
};
