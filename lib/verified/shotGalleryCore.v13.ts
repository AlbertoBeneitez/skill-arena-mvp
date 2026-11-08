/**
 * V13 — "Jungla de Xeno" (owner request, 8-nov-2026): a night jungle on an alien moon. Beings of three forms
 * (hunter, horned brute, serpent) shine with an inner aura of one of four colours (green, blue, red, purple). They
 * lean out from behind trunks or rise out of the undergrowth at ten hand-placed spots at three depths — never in
 * rows. Each order names ONE thing to take down: every being of an aura colour, or every being of a form. Decoys
 * are the other beings; from round 4 some share the target's other trait (same form for an aura order, same aura for
 * a form order) so the eye has to read the ordered trait, not the silhouette or the colour alone.
 * Scoring mirrors V12 without civilians or holograms: accumulated reaction time in ms (lower is better), with
 * penalties for a wrong being, a false start and every target left standing. V1–V12 stay frozen.
 */
import { createRng } from "../deterministic/seeded";
import type { CoreState, GameCore } from "./coreRuntime.v1";
import { SHOT_GALLERY_ACTIONS_V3 } from "./shotGalleryProtocol.v3";

/** Aura colours and forms (display names from i18n `gallery.aura.*` / `gallery.form.*`). */
export const GALLERY_V13_AURAS = ["GREEN", "BLUE", "RED", "PURPLE"] as const;
export const GALLERY_V13_FORMS = ["HUNTER", "HORNED", "SERPENT"] as const;
export type GalleryDirV13 = "UP" | "LEFT" | "RIGHT";
/**
 * A hiding place. (x, y) is the being's centre once out; `layer` 0 far, 1 mid, 2 near; `dir` the way it comes out
 * (UP out of the undergrowth, LEFT/RIGHT from behind a trunk); `edge` the cover line it is hidden behind (a y for UP,
 * an x for LEFT/RIGHT).
 */
export type GallerySpotV13 = { x: number; y: number; scaleMilli: number; layer: number; dir: GalleryDirV13; edge: number };
const spot = (x: number, y: number, scaleMilli: number, layer: number, dir: GalleryDirV13, edge: number): GallerySpotV13 => ({ x, y, scaleMilli, layer, dir, edge });
const SPOTS: readonly GallerySpotV13[] = Object.freeze([
  spot(54, 244, 600, 0, "UP", 263),
  spot(152, 226, 580, 0, "RIGHT", 118),
  spot(238, 238, 600, 0, "UP", 257),
  spot(322, 252, 620, 0, "LEFT", 356),
  spot(106, 342, 800, 1, "UP", 366),
  spot(206, 324, 780, 1, "UP", 349),
  spot(300, 354, 800, 1, "LEFT", 342),
  spot(70, 474, 1000, 2, "UP", 510),
  spot(198, 446, 960, 2, "UP", 478),
  spot(322, 478, 1020, 2, "UP", 514),
]);
export const GALLERY_V13 = Object.freeze({
  trials: 12,
  feedbackTicks: 84,
  wrongPenaltyMs: 400,
  falseStartPenaltyMs: 600,
  missedPlatePenaltyMs: 1500,
  maxWrong: 3,
  /** Reach published for duels: reachBase − accumulated ms. */
  reachBase: 1_000_000,
  /** From this round, some decoys share the target's other trait. */
  lookalikeFrom: 3,
  rngWarmup: 16,
  spots: SPOTS,
});
export type GalleryOrderV13 = { kind: "AURA" | "FORM"; value: number };
export type GalleryBeingV13 = GallerySpotV13 & {
  spot: number;
  aura: number;
  form: number;
  /** A decoy that shares the ordered target's other trait (looks like a target at a glance). */
  lookalike: boolean;
};
export type GalleryTrialV13 = { order: GalleryOrderV13; targets: GalleryBeingV13[]; answers: number[]; waitTicks: number; deadlineTicks: number };
export type GalleryResultV13 = {
  trial: number;
  type: "CORRECT" | "PARTIAL" | "WRONG" | "FALSE_START" | "TIMEOUT";
  taps: number[];
  wrongs: number;
  /** Milliseconds this round added to the total (reaction + penalties). */
  addedMs: number;
};
export type GalleryStateV13 = CoreState & {
  seed: string;
  trials: GalleryTrialV13[];
  trial: number;
  phase: "waiting" | "ready" | "feedback";
  phaseTicks: number;
  readyTick: number;
  hits: number[];
  tapTicks: number[];
  wrongs: number;
  /** Target index of the last tap (-1 for a false start). */
  lastPick: number;
  lastTapTick: number;
  /** Absolute tick of the last correct hit in this round. */
  tapTickAbs: number;
  /** Milliseconds added by the last tap (reaction for a hit, penalty otherwise). */
  lastAddedMs: number;
  results: GalleryResultV13[];
  /** Accumulated reaction time in ms (the score). */
  totalMs: number;
  roundMs: number;
  correct: number;
};

export const galleryMatchesV13 = (o: GalleryOrderV13, b: Pick<GalleryBeingV13, "aura" | "form">) => (o.kind === "AURA" ? b.aura === o.value : b.form === o.value);

export function galleryTrialsV13(seed: string): GalleryTrialV13[] {
  // Orders alternate fairly between aura and form: the first two are one of each, the rest a shuffled even split.
  const kr = createRng(`${seed}:gallery13:kinds`);
  for (let k = 0; k < GALLERY_V13.rngWarmup; k++) kr.nextUint();
  const kinds: ("AURA" | "FORM")[] = kr.nextInt(2) ? ["AURA", "FORM"] : ["FORM", "AURA"];
  const rest: ("AURA" | "FORM")[] = [..."AAAAAFFFFF"].map((c) => (c === "A" ? "AURA" : "FORM"));
  for (let i = rest.length - 1; i > 0; i--) { const j = kr.nextInt(i + 1); [rest[i], rest[j]] = [rest[j], rest[i]]; }
  kinds.push(...rest);
  return Array.from({ length: GALLERY_V13.trials }, (_, index) => {
    const rng = createRng(`${seed}:gallery13:trial:${index}`);
    for (let k = 0; k < GALLERY_V13.rngWarmup; k++) rng.nextUint();
    const kind = kinds[index], values = kind === "AURA" ? GALLERY_V13_AURAS.length : GALLERY_V13_FORMS.length;
    const order: GalleryOrderV13 = { kind, value: rng.nextInt(values) };
    const count = index < 3 ? 4 : index < 6 ? 5 : index < 9 ? 6 : 7;
    const matches = index < 3 ? 2 : 2 + rng.nextInt(2);
    const slots = SPOTS.map((p, s) => ({ ...p, spot: s }));
    for (let k = slots.length - 1; k > 0; k--) { const j = rng.nextInt(k + 1); [slots[k], slots[j]] = [slots[j], slots[k]]; }
    const other = (n: number, not: number) => { let v = rng.nextInt(n); while (v === not) v = rng.nextInt(n); return v; };
    const beings: GalleryBeingV13[] = slots.slice(0, count).map((p, i) => {
      if (i < matches) {
        // Targets: the ordered trait; the other trait varies freely.
        return kind === "AURA"
          ? { ...p, aura: order.value, form: rng.nextInt(GALLERY_V13_FORMS.length), lookalike: false }
          : { ...p, form: order.value, aura: rng.nextInt(GALLERY_V13_AURAS.length), lookalike: false };
      }
      // Decoys: never the ordered trait. From round 4, every other decoy copies a target's other trait.
      const copy = index >= GALLERY_V13.lookalikeFrom && (i - matches) % 2 === 0;
      if (kind === "AURA") {
        const aura = other(GALLERY_V13_AURAS.length, order.value);
        return { ...p, aura, form: rng.nextInt(GALLERY_V13_FORMS.length), lookalike: copy };
      }
      const form = other(GALLERY_V13_FORMS.length, order.value);
      return { ...p, form, aura: rng.nextInt(GALLERY_V13_AURAS.length), lookalike: copy };
    });
    // A look-alike copies the other trait of a real target (filled in now that the targets exist).
    beings.forEach((b, i) => {
      if (!b.lookalike) return;
      const src = beings[(i - matches) % matches];
      if (kind === "AURA") b.form = src.form; else b.aura = src.aura;
    });
    const order2 = beings.map((_, i) => i);
    for (let i = order2.length - 1; i > 0; i--) { const j = rng.nextInt(i + 1); [order2[i], order2[j]] = [order2[j], order2[i]]; }
    const targets = order2.map((i) => beings[i]);
    const answers = targets.map((t, i) => (galleryMatchesV13(order, t) ? i : -1)).filter((i) => i >= 0);
    return {
      order,
      targets,
      answers,
      waitTicks: (index < 3 ? 120 : 84) + rng.nextInt(96),
      deadlineTicks: 640 - index * 14 + 90 * (answers.length - 1),
    };
  });
}

export function createGalleryV13(seed: string): GalleryStateV13 {
  return {
    tick: 0, status: "running", failure: null, score: 0, seed, trials: galleryTrialsV13(seed), trial: 0,
    phase: "waiting", phaseTicks: 0, readyTick: -1, hits: [], tapTicks: [], wrongs: 0, lastPick: -1,
    lastTapTick: -999, tapTickAbs: -1, lastAddedMs: 0, results: [], totalMs: 0, roundMs: 0, correct: 0,
  };
}

/** Integer milliseconds for a tick count (120 ticks per second). */
export const galleryTicksToMsV13 = (ticks: number) => Math.floor((ticks * 25 + 1) / 3);
function add(s: GalleryStateV13, ms: number) {
  s.totalMs += ms;
  s.roundMs += ms;
}
function resolve(s: GalleryStateV13, type: GalleryResultV13["type"]) {
  const trial = s.trials[s.trial];
  if (type === "FALSE_START") add(s, GALLERY_V13.falseStartPenaltyMs);
  else add(s, (trial.answers.length - s.hits.length) * GALLERY_V13.missedPlatePenaltyMs);
  if (type === "CORRECT") s.correct++;
  s.results.push({ trial: s.trial, type, taps: [...s.tapTicks], wrongs: s.wrongs, addedMs: s.roundMs });
  s.phase = "feedback";
  s.phaseTicks = 0;
}
function resetRound(s: GalleryStateV13) {
  s.hits = []; s.tapTicks = []; s.wrongs = 0; s.roundMs = 0;
}

export function stepGalleryV13(s: GalleryStateV13) {
  s.tick++;
  s.phaseTicks++;
  const trial = s.trials[s.trial];
  if (s.phase === "waiting") {
    if (s.phaseTicks >= trial.waitTicks) { s.phase = "ready"; s.phaseTicks = 0; s.readyTick = s.tick; resetRound(s); }
    return;
  }
  if (s.phase === "ready") {
    if (s.phaseTicks >= trial.deadlineTicks) resolve(s, s.hits.length ? "PARTIAL" : "TIMEOUT");
    return;
  }
  if (s.phaseTicks < GALLERY_V13.feedbackTicks) return;
  s.trial++;
  if (s.trial === GALLERY_V13.trials) {
    s.status = "won";
    s.failure = null;
    s.score = s.totalMs;
    s.height = Math.max(0, GALLERY_V13.reachBase - s.totalMs);
    return;
  }
  s.phase = "waiting"; s.phaseTicks = 0; s.readyTick = -1; resetRound(s);
}

export function canApplyGalleryV13(s: GalleryStateV13, a: string) {
  if (s.status !== "running" || s.phase === "feedback" || !SHOT_GALLERY_ACTIONS_V3.includes(a)) return false;
  const i = Number(a.slice(5));
  return i < s.trials[s.trial].targets.length && !s.hits.includes(i);
}

export function applyGalleryV13(s: GalleryStateV13, a: string) {
  const i = Number(a.slice(5)), trial = s.trials[s.trial];
  if (s.phase === "waiting") {
    s.roundMs = 0;
    s.lastTapTick = s.tick;
    s.lastPick = -1;
    s.lastAddedMs = GALLERY_V13.falseStartPenaltyMs;
    return resolve(s, "FALSE_START");
  }
  s.lastTapTick = s.tick;
  s.lastPick = i;
  if (trial.answers.includes(i)) {
    const ms = galleryTicksToMsV13(s.tick - (s.hits.length ? s.tapTickAbs : s.readyTick));
    s.hits.push(i);
    s.tapTicks.push(s.tick - s.readyTick);
    s.tapTickAbs = s.tick;
    s.lastAddedMs = ms;
    add(s, ms);
    if (s.hits.length === trial.answers.length) resolve(s, "CORRECT");
  } else {
    s.wrongs++;
    s.lastAddedMs = GALLERY_V13.wrongPenaltyMs;
    add(s, GALLERY_V13.wrongPenaltyMs);
    if (s.wrongs >= GALLERY_V13.maxWrong) resolve(s, "WRONG");
  }
}

export const SHOT_GALLERY_CORE_V13: GameCore<GalleryStateV13> = {
  gameId: "reaction-test",
  gameVersion: "13.0.0",
  width: 390,
  height: 620,
  tickRate: 120,
  maxFinalTick: 120 * 60 * 3,
  maxInputs: 200,
  inputVersion: 3,
  actions: SHOT_GALLERY_ACTIONS_V3,
  content: {
    rules: GALLERY_V13,
    auras: GALLERY_V13_AURAS,
    forms: GALLERY_V13_FORMS,
    scenario: "gallery13-xeno-jungle-aura-or-form-orders-lookalikes",
    clock: "TICKS_POPUP_THEN_REACTION",
    aggregation: "ACCUMULATED_REACTION_MS_PUBLISHED_AT_TERMINAL_LOWER_IS_BETTER",
  },
  create: createGalleryV13,
  step: stepGalleryV13,
  canApply: canApplyGalleryV13,
  apply: applyGalleryV13,
};
