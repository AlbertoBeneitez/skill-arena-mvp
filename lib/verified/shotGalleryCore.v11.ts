/**
 * V11 — a carnival tarp with 12 windows (3 columns × 4 rows). Each round some windows hide a target (8 growing to
 * 12) and the tarp flaps open on the start: the reveal itself is the start signal (no light). Targets are much
 * bigger and never overlap because each one owns a window. Orders, scoring (accumulated reaction time in ms, lower
 * is better), penalties and reach mirror are exactly V10's. V1–V10 stay frozen.
 */
import { createRng } from "../deterministic/seeded";
import type { CoreState, GameCore } from "./coreRuntime.v1";
import { SHOT_GALLERY_ACTIONS_V3 } from "./shotGalleryProtocol.v3";

export const GALLERY_V11_COLORS = ["AZUL", "CORAL", "LIMA", "VIOLETA", "AMARILLO", "ROSA", "TURQUESA", "NARANJA"] as const;
export const GALLERY_V11_SHAPES = ["CÍRCULO", "TRIÁNGULO", "CUADRADO", "HEXÁGONO", "ESTRELLA"] as const;
export const GALLERY_V11 = Object.freeze({
  trials: 12,
  feedbackTicks: 84,
  wrongPenaltyMs: 400,
  falseStartPenaltyMs: 600,
  missedPlatePenaltyMs: 1500,
  maxWrong: 3,
  /** Reach published for duels: reachBase − accumulated ms. */
  reachBase: 1_000_000,
  /** Tarp windows: centres of the 3 × 4 grid (logical px). */
  windows: { xs: [75, 195, 315] as readonly number[], ys: [222, 314, 406, 498] as readonly number[] },
});
export type GalleryTargetV11 = { x: number; y: number; color: number; shape: number };
export type GalleryOrderV11 = { color: number; shape: number };
export type GalleryTrialV11 = { order: GalleryOrderV11; targets: GalleryTargetV11[]; answers: number[]; waitTicks: number; deadlineTicks: number };
export type GalleryResultV11 = {
  trial: number;
  type: "CORRECT" | "PARTIAL" | "WRONG" | "FALSE_START" | "TIMEOUT";
  taps: number[];
  wrongs: number;
  /** Milliseconds this round added to the total (reaction + penalties). */
  addedMs: number;
};
export type GalleryStateV11 = CoreState & {
  seed: string;
  trials: GalleryTrialV11[];
  trial: number;
  phase: "waiting" | "ready" | "feedback";
  phaseTicks: number;
  readyTick: number;
  hits: number[];
  tapTicks: number[];
  wrongs: number;
  lastTapTick: number;
  /** Absolute tick of the last correct hit in this round. */
  tapTickAbs: number;
  /** Milliseconds added by the last tap (reaction for a hit, penalty for a wrong plate). */
  lastAddedMs: number;
  results: GalleryResultV11[];
  /** Accumulated reaction time in ms (the score). */
  totalMs: number;
  /** Ms accumulated within the current round. */
  roundMs: number;
  correct: number;
};

/** Plates never move in V11; kept as a function so renderers share one lookup. */
export function galleryTargetPosV11(t: GalleryTargetV11) {
  return { x: t.x, y: t.y };
}

export function galleryTrialsV11(seed: string): GalleryTrialV11[] {
  return Array.from({ length: GALLERY_V11.trials }, (_, index) => {
    const rng = createRng(`${seed}:gallery11:trial:${index}`);
    const color = rng.nextInt(8), shape = rng.nextInt(5);
    const matches = index < 3 ? 2 : 2 + rng.nextInt(index < 7 ? 2 : 3);
    const other = (n: number, avoid: number) => { let v = rng.nextInt(n); while (v === avoid) v = rng.nextInt(n); return v; };
    const count = Math.min(12, 8 + Math.floor(index / 3));
    // Pick `count` of the 12 windows (seeded shuffle); each target sits in the middle of its window.
    const slots = GALLERY_V11.windows.ys.flatMap((y) => GALLERY_V11.windows.xs.map((x) => ({ x, y })));
    for (let k = slots.length - 1; k > 0; k--) { const j = rng.nextInt(k + 1); [slots[k], slots[j]] = [slots[j], slots[k]]; }
    const points = slots.slice(0, count);
    const targets: GalleryTargetV11[] = points.map((p, i) => {
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

export function createGalleryV11(seed: string): GalleryStateV11 {
  return {
    tick: 0, status: "running", failure: null, score: 0, seed, trials: galleryTrialsV11(seed), trial: 0,
    phase: "waiting", phaseTicks: 0, readyTick: -1, hits: [], tapTicks: [], wrongs: 0, lastTapTick: -999, tapTickAbs: -1,
    lastAddedMs: 0, results: [], totalMs: 0, roundMs: 0, correct: 0,
  };
}

/** Integer milliseconds for a tick count (120 ticks per second). */
export const galleryTicksToMsV11 = (ticks: number) => Math.floor((ticks * 25 + 1) / 3);
function add(s: GalleryStateV11, ms: number) {
  s.totalMs += ms;
  s.roundMs += ms;
}
function resolve(s: GalleryStateV11, type: GalleryResultV11["type"]) {
  const trial = s.trials[s.trial];
  if (type === "FALSE_START") add(s, GALLERY_V11.falseStartPenaltyMs);
  else add(s, (trial.answers.length - s.hits.length) * GALLERY_V11.missedPlatePenaltyMs);
  if (type === "CORRECT") s.correct++;
  s.results.push({ trial: s.trial, type, taps: [...s.tapTicks], wrongs: s.wrongs, addedMs: s.roundMs });
  s.phase = "feedback";
  s.phaseTicks = 0;
}

export function stepGalleryV11(s: GalleryStateV11) {
  s.tick++;
  s.phaseTicks++;
  const trial = s.trials[s.trial];
  if (s.phase === "waiting") {
    if (s.phaseTicks >= trial.waitTicks) {
      s.phase = "ready"; s.phaseTicks = 0; s.readyTick = s.tick; s.hits = []; s.tapTicks = []; s.wrongs = 0; s.roundMs = 0;
    }
    return;
  }
  if (s.phase === "ready") {
    if (s.phaseTicks >= trial.deadlineTicks) resolve(s, s.hits.length ? "PARTIAL" : "TIMEOUT");
    return;
  }
  if (s.phaseTicks < GALLERY_V11.feedbackTicks) return;
  s.trial++;
  if (s.trial === GALLERY_V11.trials) {
    // The run always completes: the result is the accumulated time.
    s.status = "won";
    s.failure = null;
    s.score = s.totalMs;
    s.height = Math.max(0, GALLERY_V11.reachBase - s.totalMs);
    return;
  }
  s.phase = "waiting"; s.phaseTicks = 0; s.readyTick = -1; s.hits = []; s.tapTicks = []; s.wrongs = 0; s.roundMs = 0;
}

export function canApplyGalleryV11(s: GalleryStateV11, a: string) {
  if (s.status !== "running" || s.phase === "feedback" || !SHOT_GALLERY_ACTIONS_V3.includes(a)) return false;
  const i = Number(a.slice(5));
  return i < s.trials[s.trial].targets.length && !s.hits.includes(i);
}

export function applyGalleryV11(s: GalleryStateV11, a: string) {
  const i = Number(a.slice(5)), trial = s.trials[s.trial];
  if (s.phase === "waiting") {
    s.roundMs = 0;
    s.lastTapTick = s.tick;
    s.lastAddedMs = GALLERY_V11.falseStartPenaltyMs;
    return resolve(s, "FALSE_START");
  }
  s.lastTapTick = s.tick;
  if (trial.answers.includes(i)) {
    const ms = galleryTicksToMsV11(s.tick - (s.hits.length ? s.tapTickAbs : s.readyTick));
    s.hits.push(i);
    s.tapTicks.push(s.tick - s.readyTick);
    s.tapTickAbs = s.tick;
    s.lastAddedMs = ms;
    add(s, ms);
    if (s.hits.length === trial.answers.length) resolve(s, "CORRECT");
  } else {
    s.wrongs++;
    s.lastAddedMs = GALLERY_V11.wrongPenaltyMs;
    add(s, GALLERY_V11.wrongPenaltyMs);
    if (s.wrongs >= GALLERY_V11.maxWrong) resolve(s, "WRONG");
  }
}

export const SHOT_GALLERY_CORE_V11: GameCore<GalleryStateV11> = {
  gameId: "reaction-test",
  gameVersion: "11.0.0",
  width: 390,
  height: 620,
  tickRate: 120,
  maxFinalTick: 120 * 60 * 3,
  maxInputs: 200,
  inputVersion: 3,
  actions: SHOT_GALLERY_ACTIONS_V3,
  content: {
    rules: GALLERY_V11,
    colors: GALLERY_V11_COLORS,
    shapes: GALLERY_V11_SHAPES,
    scenario: "gallery11-killer-range-colour-and-figure-orders-static-plates-v9",
    clock: "TICKS_REVEAL_THEN_REACTION",
    aggregation: "ACCUMULATED_REACTION_MS_PUBLISHED_AT_TERMINAL_LOWER_IS_BETTER",
  },
  create: createGalleryV11,
  step: stepGalleryV11,
  canApply: canApplyGalleryV11,
  apply: applyGalleryV11,
};
