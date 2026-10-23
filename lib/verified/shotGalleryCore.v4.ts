/**
 * V4: colour splashes and grey figures are separate targets, scattered
 * asymmetrically. An order asks for a colour, a figure, or the SUM of both
 * (the splash AND the figure, each tapped separately, in any order). Mixed orders, false starts (red dot),
 * per-tap reaction times. V1/V2 stay frozen.
 */
import { createRng } from "../deterministic/seeded";
import type { CoreState, GameCore } from "./coreRuntime.v1";
import { SHOT_GALLERY_ACTIONS_V3 } from "./shotGalleryProtocol.v3";

export const GALLERY_V4_COLORS = ["AZUL", "CORAL", "LIMA", "VIOLETA", "AMARILLO", "ROSA", "TURQUESA", "NARANJA"] as const;
export const GALLERY_V4_SHAPES = ["CÍRCULO", "TRIÁNGULO", "CUADRADO", "HEXÁGONO", "ESTRELLA"] as const;
export const GALLERY_V4 = Object.freeze({
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
/** A target is either a colour splash (no figure) or a grey figure (no colour). */
export type GalleryTargetV4 = { x: number; y: number; type: "SPLASH" | "FIGURE"; color: number; shape: number };
export type GalleryOrderV4 = { kind: "COLOR" | "SHAPE" | "SUM"; color: number; shape: number };
export type GalleryTrialV4 = {
  order: GalleryOrderV4;
  targets: GalleryTargetV4[];
  answers: number[];
  waitTicks: number;
  deadlineTicks: number;
};
export type GalleryResultV4 = {
  trial: number;
  kind: GalleryOrderV4["kind"];
  type: "CORRECT" | "PARTIAL" | "WRONG" | "FALSE_START" | "TIMEOUT";
  /** Ticks from the green dot to each correct tap, in tap order. */
  taps: number[];
  wrongs: number;
  award: number;
};
export type GalleryStateV4 = CoreState & {
  seed: string;
  trials: GalleryTrialV4[];
  trial: number;
  phase: "waiting" | "ready" | "feedback";
  phaseTicks: number;
  readyTick: number;
  hits: number[];
  tapTicks: number[];
  wrongs: number;
  lastTapTick: number;
  lastAward: number;
  results: GalleryResultV4[];
  total: number;
  correct: number;
};

export function galleryTrialsV4(seed: string): GalleryTrialV4[] {
  return Array.from({ length: GALLERY_V4.trials }, (_, index) => {
    const rng = createRng(`${seed}:gallery4:trial:${index}`),
      f = GALLERY_V4.field,
      kinds: GalleryOrderV4["kind"][] = ["COLOR", "SHAPE", "SUM"],
      kind = index < 3 ? kinds[index] : kinds[(index + rng.nextInt(2)) % 3],
      extra = index < 3 ? 0 : rng.nextInt(index < 7 ? 2 : 3),
      colorMatches = kind === "SHAPE" ? 0 : 1 + (kind === "COLOR" ? extra : extra > 1 ? 1 : 0),
      shapeMatches = kind === "COLOR" ? 0 : 1 + (kind === "SHAPE" ? extra : extra > 0 ? 1 : 0),
      matches = colorMatches + shapeMatches,
      count = Math.min(12, 7 + Math.floor(index * 0.6) + matches),
      color = rng.nextInt(8),
      shape = rng.nextInt(5);
    const points: { x: number; y: number }[] = [];
    for (let attempt = 0; points.length < count && attempt < 4000; attempt++) {
      const x = f.x0 + rng.nextInt(f.x1 - f.x0 + 1),
        y = f.y0 + rng.nextInt(f.y1 - f.y0 + 1),
        gap = attempt > 2000 ? f.minDistance - 14 : f.minDistance;
      if (points.every((p) => Math.hypot(p.x - x, p.y - y) >= gap)) points.push({ x, y });
    }
    while (points.length < count) points.push({ x: f.x0 + rng.nextInt(f.x1 - f.x0), y: f.y0 + rng.nextInt(f.y1 - f.y0) });
    const other = (n: number, avoid: number, avoidKind: boolean) => {
      let v = rng.nextInt(n);
      while (avoidKind && v === avoid) v = rng.nextInt(n);
      return v;
    };
    const targets: GalleryTargetV4[] = points.map((p, i) => {
      if (i < colorMatches) return { x: p.x, y: p.y, type: "SPLASH", color, shape: -1 };
      if (i < matches) return { x: p.x, y: p.y, type: "FIGURE", color: -1, shape };
      // Decoys: splashes of another colour or grey figures of another shape.
      return rng.nextInt(2) === 0
        ? { x: p.x, y: p.y, type: "SPLASH", color: other(8, color, kind !== "SHAPE"), shape: -1 }
        : { x: p.x, y: p.y, type: "FIGURE", color: -1, shape: other(5, shape, kind !== "COLOR") };
    });
    const order = targets.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = rng.nextInt(i + 1);
      [order[i], order[j]] = [order[j], order[i]];
    }
    const shuffled = order.map((i) => targets[i]);
    const answers = shuffled
      .map((t, i) => ((t.type === "SPLASH" && kind !== "SHAPE" && t.color === color) || (t.type === "FIGURE" && kind !== "COLOR" && t.shape === shape) ? i : -1))
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

export function createGalleryV4(seed: string): GalleryStateV4 {
  return {
    tick: 0,
    status: "running",
    failure: null,
    score: 0,
    seed,
    trials: galleryTrialsV4(seed),
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

function resolve(s: GalleryStateV4, type: GalleryResultV4["type"]) {
  const award = type === "FALSE_START" ? -GALLERY_V4.falseStartPenalty : 0;
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

export function stepGalleryV4(s: GalleryStateV4) {
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
  if (s.phaseTicks < GALLERY_V4.feedbackTicks) return;
  s.trial++;
  if (s.trial === GALLERY_V4.trials) {
    const won = s.correct >= GALLERY_V4.minimumCorrect && s.total >= GALLERY_V4.minimumCompletionScore;
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

export function canApplyGalleryV4(s: GalleryStateV4, a: string) {
  if (s.status !== "running" || s.phase === "feedback" || !SHOT_GALLERY_ACTIONS_V3.includes(a)) return false;
  const i = Number(a.slice(5));
  return i < s.trials[s.trial].targets.length && !s.hits.includes(i);
}

export function applyGalleryV4(s: GalleryStateV4, a: string) {
  const i = Number(a.slice(5)),
    trial = s.trials[s.trial];
  if (s.phase === "waiting") return resolve(s, "FALSE_START");
  if (trial.answers.includes(i)) {
    const dt = s.tick - (s.hits.length ? s.lastTapTick : s.readyTick);
    const award = Math.max(
      GALLERY_V4.minimumAward,
      GALLERY_V4.maximumAward - Math.floor(((Math.max(0, dt - GALLERY_V4.minimumReactionTicks)) * 11) / 5),
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
    s.lastAward = -GALLERY_V4.wrongPenalty;
    s.total = Math.max(0, s.total - GALLERY_V4.wrongPenalty);
    if (s.wrongs >= GALLERY_V4.maxWrong) resolve(s, "WRONG");
  }
}

export const SHOT_GALLERY_CORE_V4: GameCore<GalleryStateV4> = {
  gameId: "reaction-test",
  gameVersion: "4.0.0",
  width: 390,
  height: 620,
  tickRate: 120,
  maxFinalTick: 120 * 60 * 3,
  maxInputs: 200,
  inputVersion: 3,
  actions: SHOT_GALLERY_ACTIONS_V3,
  content: {
    rules: GALLERY_V4,
    colors: GALLERY_V4_COLORS,
    shapes: GALLERY_V4_SHAPES,
    scenario: "gallery4-splash-and-grey-figures-separate-sum-order-v4",
    clock: "TICKS_REVEAL_THEN_REACTION",
    aggregation: "TOTAL_PUBLISHED_AT_TERMINAL",
  },
  create: createGalleryV4,
  step: stepGalleryV4,
  canApply: canApplyGalleryV4,
  apply: applyGalleryV4,
};
