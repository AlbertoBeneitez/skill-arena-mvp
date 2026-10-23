/**
 * V3: irregular gallery. Eight paint colours and five figures are scattered
 * asymmetrically; each order (a paint splash, a figure, or both) may match
 * several targets that must all be hit. Mixed orders, false starts (red dot),
 * per-tap reaction times. V1/V2 stay frozen.
 */
import { createRng } from "../deterministic/seeded";
import type { CoreState, GameCore } from "./coreRuntime.v1";
import { SHOT_GALLERY_ACTIONS_V3 } from "./shotGalleryProtocol.v3";

export const GALLERY_V3_COLORS = ["AZUL", "CORAL", "LIMA", "VIOLETA", "AMARILLO", "ROSA", "TURQUESA", "NARANJA"] as const;
export const GALLERY_V3_SHAPES = ["CÍRCULO", "TRIÁNGULO", "CUADRADO", "HEXÁGONO", "ESTRELLA"] as const;
export const GALLERY_V3 = Object.freeze({
  trials: 12,
  feedbackTicks: 84,
  minimumAward: 80,
  maximumAward: 420,
  minimumReactionTicks: 12,
  wrongPenalty: 100,
  falseStartPenalty: 150,
  maxWrong: 3,
  minimumCorrect: 6,
  minimumCompletionScore: 3000,
  field: { x0: 34, x1: 356, y0: 214, y1: 540, minDistance: 64 },
});
export type GalleryTargetV3 = { x: number; y: number; color: number; shape: number };
export type GalleryOrderV3 = { kind: "COLOR" | "SHAPE" | "COMBINATION"; color: number; shape: number };
export type GalleryTrialV3 = {
  order: GalleryOrderV3;
  targets: GalleryTargetV3[];
  answers: number[];
  waitTicks: number;
  deadlineTicks: number;
};
export type GalleryResultV3 = {
  trial: number;
  kind: GalleryOrderV3["kind"];
  type: "CORRECT" | "PARTIAL" | "WRONG" | "FALSE_START" | "TIMEOUT";
  /** Ticks from the green dot to each correct tap, in tap order. */
  taps: number[];
  wrongs: number;
  award: number;
};
export type GalleryStateV3 = CoreState & {
  seed: string;
  trials: GalleryTrialV3[];
  trial: number;
  phase: "waiting" | "ready" | "feedback";
  phaseTicks: number;
  readyTick: number;
  hits: number[];
  tapTicks: number[];
  wrongs: number;
  lastTapTick: number;
  lastAward: number;
  results: GalleryResultV3[];
  total: number;
  correct: number;
};

export function galleryTrialsV3(seed: string): GalleryTrialV3[] {
  return Array.from({ length: GALLERY_V3.trials }, (_, index) => {
    const rng = createRng(`${seed}:gallery3:trial:${index}`),
      f = GALLERY_V3.field,
      kinds: GalleryOrderV3["kind"][] = ["COLOR", "SHAPE", "COMBINATION"],
      kind = index < 2 ? kinds[index] : kinds[(index + rng.nextInt(2)) % 3],
      matches = index < 3 ? 1 : 1 + rng.nextInt(index < 7 ? 2 : 3),
      count = Math.min(12, 7 + Math.floor(index * 0.6) + matches),
      color = rng.nextInt(8),
      shape = rng.nextInt(5);
    // Scatter points with a minimum separation so nothing overlaps; irregular on purpose.
    const points: { x: number; y: number }[] = [];
    for (let attempt = 0; points.length < count && attempt < 4000; attempt++) {
      const x = f.x0 + rng.nextInt(f.x1 - f.x0 + 1),
        y = f.y0 + rng.nextInt(f.y1 - f.y0 + 1),
        gap = attempt > 2000 ? f.minDistance - 14 : f.minDistance;
      if (points.every((p) => Math.hypot(p.x - x, p.y - y) >= gap)) points.push({ x, y });
    }
    while (points.length < count) points.push({ x: f.x0 + rng.nextInt(f.x1 - f.x0), y: f.y0 + rng.nextInt(f.y1 - f.y0) });
    const targets: GalleryTargetV3[] = points.map((p, i) => {
      const isMatch = i < matches;
      let c = rng.nextInt(8),
        s = rng.nextInt(5);
      if (kind === "COLOR") {
        if (isMatch) c = color;
        else while (c === color) c = rng.nextInt(8);
      } else if (kind === "SHAPE") {
        if (isMatch) s = shape;
        else while (s === shape) s = rng.nextInt(5);
      } else if (isMatch) {
        c = color;
        s = shape;
      } else {
        // Decoys share exactly one trait with the order half of the time.
        const mode = rng.nextInt(3);
        if (mode === 0) {
          c = color;
          while (s === shape) s = rng.nextInt(5);
        } else if (mode === 1) {
          s = shape;
          while (c === color) c = rng.nextInt(8);
        } else {
          while (c === color) c = rng.nextInt(8);
          while (s === shape) s = rng.nextInt(5);
        }
      }
      return { x: p.x, y: p.y, color: c, shape: s };
    });
    // Shuffle so matches are not always first (Fisher–Yates with the trial rng).
    const order = targets.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = rng.nextInt(i + 1);
      [order[i], order[j]] = [order[j], order[i]];
    }
    const shuffled = order.map((i) => targets[i]);
    const answers = shuffled
      .map((t, i) => ((kind === "COLOR" ? t.color === color : kind === "SHAPE" ? t.shape === shape : t.color === color && t.shape === shape) ? i : -1))
      .filter((i) => i >= 0);
    return {
      order: { kind, color, shape },
      targets: shuffled,
      answers,
      waitTicks: (index < 3 ? 120 : 84) + rng.nextInt(96),
      deadlineTicks: 600 - index * 12 + 90 * (answers.length - 1),
    };
  });
}

export function createGalleryV3(seed: string): GalleryStateV3 {
  return {
    tick: 0,
    status: "running",
    failure: null,
    score: 0,
    seed,
    trials: galleryTrialsV3(seed),
    trial: 0,
    phase: "waiting",
    phaseTicks: 0,
    readyTick: -1,
    hits: [],
    tapTicks: [],
    wrongs: 0,
    lastTapTick: -999,
    lastAward: 0,
    results: [],
    total: 0,
    correct: 0,
  };
}

function resolve(s: GalleryStateV3, type: GalleryResultV3["type"]) {
  const award = type === "FALSE_START" ? -GALLERY_V3.falseStartPenalty : 0;
  if (award) s.total = Math.max(0, s.total + award);
  if (type === "CORRECT") s.correct++;
  s.results.push({
    trial: s.trial,
    kind: s.trials[s.trial].order.kind,
    type,
    taps: [...s.tapTicks],
    wrongs: s.wrongs,
    award: award + 0,
  });
  s.phase = "feedback";
  s.phaseTicks = 0;
}

export function stepGalleryV3(s: GalleryStateV3) {
  s.tick++;
  s.phaseTicks++;
  const trial = s.trials[s.trial];
  if (s.phase === "waiting") {
    if (s.phaseTicks >= trial.waitTicks) {
      s.phase = "ready";
      s.phaseTicks = 0;
      s.readyTick = s.tick;
      s.hits = [];
      s.tapTicks = [];
      s.wrongs = 0;
    }
    return;
  }
  if (s.phase === "ready") {
    if (s.phaseTicks >= trial.deadlineTicks) resolve(s, s.hits.length ? "PARTIAL" : "TIMEOUT");
    return;
  }
  if (s.phaseTicks < GALLERY_V3.feedbackTicks) return;
  s.trial++;
  if (s.trial === GALLERY_V3.trials) {
    const won = s.correct >= GALLERY_V3.minimumCorrect && s.total >= GALLERY_V3.minimumCompletionScore;
    s.status = won ? "won" : "failed";
    s.failure = won ? null : "RECOGNITION_SCORE";
    s.score = s.total;
    return;
  }
  s.phase = "waiting";
  s.phaseTicks = 0;
  s.readyTick = -1;
  s.hits = [];
  s.tapTicks = [];
  s.wrongs = 0;
}

export function canApplyGalleryV3(s: GalleryStateV3, a: string) {
  if (s.status !== "running" || s.phase === "feedback" || !SHOT_GALLERY_ACTIONS_V3.includes(a)) return false;
  const i = Number(a.slice(5));
  return i < s.trials[s.trial].targets.length && !s.hits.includes(i);
}

export function applyGalleryV3(s: GalleryStateV3, a: string) {
  const i = Number(a.slice(5)),
    trial = s.trials[s.trial];
  if (s.phase === "waiting") return resolve(s, "FALSE_START");
  if (trial.answers.includes(i)) {
    const dt = s.tick - (s.hits.length ? s.lastTapTick : s.readyTick);
    const award = Math.max(
      GALLERY_V3.minimumAward,
      GALLERY_V3.maximumAward - Math.floor(((Math.max(0, dt - GALLERY_V3.minimumReactionTicks)) * 11) / 5),
    );
    s.hits.push(i);
    s.tapTicks.push(s.tick - s.readyTick);
    s.lastTapTick = s.tick;
    s.lastAward = award;
    s.total += award;
    if (s.hits.length === trial.answers.length) resolve(s, "CORRECT");
  } else {
    s.wrongs++;
    s.lastTapTick = s.tick;
    s.lastAward = -GALLERY_V3.wrongPenalty;
    s.total = Math.max(0, s.total - GALLERY_V3.wrongPenalty);
    if (s.wrongs >= GALLERY_V3.maxWrong) resolve(s, "WRONG");
  }
}

export const SHOT_GALLERY_CORE_V3: GameCore<GalleryStateV3> = {
  gameId: "reaction-test",
  gameVersion: "3.0.0",
  width: 390,
  height: 620,
  tickRate: 120,
  maxFinalTick: 120 * 60 * 3,
  maxInputs: 200,
  inputVersion: 3,
  actions: SHOT_GALLERY_ACTIONS_V3,
  content: {
    rules: GALLERY_V3,
    colors: GALLERY_V3_COLORS,
    shapes: GALLERY_V3_SHAPES,
    scenario: "gallery3-scattered-multi-target-mixed-orders-v3",
    clock: "TICKS_REVEAL_THEN_REACTION",
    aggregation: "TOTAL_PUBLISHED_AT_TERMINAL",
  },
  create: createGalleryV3,
  step: stepGalleryV3,
  canApply: canApplyGalleryV3,
  apply: applyGalleryV3,
};
