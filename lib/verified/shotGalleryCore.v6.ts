/**
 * V6 (SUM = one coloured figure with both traits; taller field): colour splashes and grey figures are separate targets, scattered
 * asymmetrically. An order asks for a colour, a figure, or the SUM of both
 * (the splash AND the figure, each tapped separately, in any order). Mixed orders, false starts (red dot),
 * per-tap reaction times. V1/V2 stay frozen.
 */
import { createRng } from "../deterministic/seeded";
import type { CoreState, GameCore } from "./coreRuntime.v1";
import { SHOT_GALLERY_ACTIONS_V3 } from "./shotGalleryProtocol.v3";

export const GALLERY_V6_COLORS = ["AZUL", "CORAL", "LIMA", "VIOLETA", "AMARILLO", "ROSA", "TURQUESA", "NARANJA"] as const;
export const GALLERY_V6_SHAPES = ["CÍRCULO", "TRIÁNGULO", "CUADRADO", "HEXÁGONO", "ESTRELLA"] as const;
export const GALLERY_V6 = Object.freeze({
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
  field: { x0: 34, x1: 356, y0: 168, y1: 540, minDistance: 64 },
});
/** A target is either a colour splash (no figure) or a grey figure (no colour). */
export type GalleryTargetV6 = { x: number; y: number; type: "SPLASH" | "FIGURE" | "COMBO"; color: number; shape: number };
export type GalleryOrderV6 = { kind: "COLOR" | "SHAPE" | "SUM"; color: number; shape: number };
export type GalleryTrialV6 = {
  order: GalleryOrderV6;
  targets: GalleryTargetV6[];
  answers: number[];
  waitTicks: number;
  deadlineTicks: number;
};
export type GalleryResultV6 = {
  trial: number;
  kind: GalleryOrderV6["kind"];
  type: "CORRECT" | "PARTIAL" | "WRONG" | "FALSE_START" | "TIMEOUT";
  /** Ticks from the green dot to each correct tap, in tap order. */
  taps: number[];
  wrongs: number;
  award: number;
};
export type GalleryStateV6 = CoreState & {
  seed: string;
  trials: GalleryTrialV6[];
  trial: number;
  phase: "waiting" | "ready" | "feedback";
  phaseTicks: number;
  readyTick: number;
  hits: number[];
  tapTicks: number[];
  wrongs: number;
  lastTapTick: number;
  lastAward: number;
  results: GalleryResultV6[];
  total: number;
  correct: number;
};

export function galleryTrialsV6(seed: string): GalleryTrialV6[] {
  return Array.from({ length: GALLERY_V6.trials }, (_, index) => {
    const rng = createRng(`${seed}:gallery6:trial:${index}`),
      f = GALLERY_V6.field,
      kinds: GalleryOrderV6["kind"][] = ["COLOR", "SHAPE", "SUM"],
      kind = index < 3 ? kinds[index] : kinds[(index + rng.nextInt(2)) % 3],
      extra = index < 3 ? 0 : rng.nextInt(index < 7 ? 2 : 3),
      colorMatches = kind === "COLOR" ? 1 + extra : 0,
      shapeMatches = kind === "SHAPE" ? 1 + extra : 0,
      matches = kind === "SUM" ? 1 : colorMatches + shapeMatches,
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
    const targets: GalleryTargetV6[] =
      kind === "SUM"
        ? points.map((p, i) => {
            // One coloured figure has BOTH traits; decoys share only colour, only shape, or nothing.
            if (i === 0) return { x: p.x, y: p.y, type: "COMBO" as const, color, shape };
            const mode = i % 3;
            return {
              x: p.x,
              y: p.y,
              type: "COMBO" as const,
              color: mode === 1 ? color : other(8, color, true),
              shape: mode === 2 ? shape : other(5, shape, true),
            };
          })
        : points.map((p, i) => {
            if (i < colorMatches) return { x: p.x, y: p.y, type: "SPLASH" as const, color, shape: -1 };
            if (i < matches) return { x: p.x, y: p.y, type: "FIGURE" as const, color: -1, shape };
            // Decoys: splashes of another colour or grey figures of another shape.
            return rng.nextInt(2) === 0
              ? { x: p.x, y: p.y, type: "SPLASH" as const, color: other(8, color, kind !== "SHAPE"), shape: -1 }
              : { x: p.x, y: p.y, type: "FIGURE" as const, color: -1, shape: other(5, shape, kind !== "COLOR") };
          });
    const order = targets.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = rng.nextInt(i + 1);
      [order[i], order[j]] = [order[j], order[i]];
    }
    const shuffled = order.map((i) => targets[i]);
    const answers = shuffled
      .map((t, i) =>
        (t.type === "COMBO" && t.color === color && t.shape === shape) ||
        (t.type === "SPLASH" && kind === "COLOR" && t.color === color) ||
        (t.type === "FIGURE" && kind === "SHAPE" && t.shape === shape)
          ? i
          : -1,
      )
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

export function createGalleryV6(seed: string): GalleryStateV6 {
  return {
    tick: 0,
    status: "running",
    failure: null,
    score: 0,
    seed,
    trials: galleryTrialsV6(seed),
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

function resolve(s: GalleryStateV6, type: GalleryResultV6["type"]) {
  const award = type === "FALSE_START" ? -GALLERY_V6.falseStartPenalty : 0;
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

export function stepGalleryV6(s: GalleryStateV6) {
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
  if (s.phaseTicks < GALLERY_V6.feedbackTicks) return;
  s.trial++;
  if (s.trial === GALLERY_V6.trials) {
    const won = s.correct >= GALLERY_V6.minimumCorrect && s.total >= GALLERY_V6.minimumCompletionScore;
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

export function canApplyGalleryV6(s: GalleryStateV6, a: string) {
  if (s.status !== "running" || s.phase === "feedback" || !SHOT_GALLERY_ACTIONS_V3.includes(a)) return false;
  const i = Number(a.slice(5));
  return i < s.trials[s.trial].targets.length && !s.hits.includes(i);
}

export function applyGalleryV6(s: GalleryStateV6, a: string) {
  const i = Number(a.slice(5)),
    trial = s.trials[s.trial];
  if (s.phase === "waiting") return resolve(s, "FALSE_START");
  if (trial.answers.includes(i)) {
    const dt = s.tick - (s.hits.length ? s.lastTapTick : s.readyTick);
    const award = Math.max(
      GALLERY_V6.minimumAward,
      GALLERY_V6.maximumAward - Math.floor(((Math.max(0, dt - GALLERY_V6.minimumReactionTicks)) * 11) / 5),
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
    s.lastAward = -GALLERY_V6.wrongPenalty;
    s.total = Math.max(0, s.total - GALLERY_V6.wrongPenalty);
    if (s.wrongs >= GALLERY_V6.maxWrong) resolve(s, "WRONG");
  }
}

export const SHOT_GALLERY_CORE_V6: GameCore<GalleryStateV6> = {
  gameId: "reaction-test",
  gameVersion: "6.0.0",
  width: 390,
  height: 620,
  tickRate: 120,
  maxFinalTick: 120 * 60 * 3,
  maxInputs: 200,
  inputVersion: 3,
  actions: SHOT_GALLERY_ACTIONS_V3,
  content: {
    rules: GALLERY_V6,
    colors: GALLERY_V6_COLORS,
    shapes: GALLERY_V6_SHAPES,
    scenario: "gallery6-splash-and-grey-figures-separate-sum-order-v6",
    clock: "TICKS_REVEAL_THEN_REACTION",
    aggregation: "TOTAL_PUBLISHED_AT_TERMINAL",
  },
  create: createGalleryV6,
  step: stepGalleryV6,
  canApply: canApplyGalleryV6,
  apply: applyGalleryV6,
};
