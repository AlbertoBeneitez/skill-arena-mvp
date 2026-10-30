/**
 * V12 — "Hangar 7": space creatures pop out from behind four cover lines of an abandoned station hangar (an upper
 * gallery, a catwalk, cargo crates and a front barricade; 12 spots with depth). Each order names the species to take
 * down (one species, two from round 7). Decoys try to fool the eye:
 *   - other species in their own colours;
 *   - camouflaged ones: another species wearing the target species' colours (from round 4);
 *   - civilians in white suits with their hands up (heavier penalty);
 *   - holograms of the target species (from round 6).
 * Scoring mirrors V10/V11 (accumulated reaction time in ms, lower is better) with one addition: hitting a civilian
 * adds `civilianPenaltyMs`. Consecutive inputs (two fingers at once) land on consecutive ticks, so two targets can be
 * taken down almost at the same time. V1–V11 stay frozen.
 */
import { createRng } from "../deterministic/seeded";
import type { CoreState, GameCore } from "./coreRuntime.v1";
import { SHOT_GALLERY_ACTIONS_V3 } from "./shotGalleryProtocol.v3";

/** Internal species ids (display names come from i18n `gallery.species.*`). */
export const GALLERY_V12_SPECIES = ["KRAKEN", "DRONE", "MANTIS", "SLIME", "WRAITH", "GOLEM"] as const;
/** Species index used for civilians (never a valid target). */
export const GALLERY_V12_CIVILIAN = 6;
export type GallerySpotV12 = { x: number; y: number; /** depth scale ×1000 */ scaleMilli: number; /** creatures are hidden below this y */ cover: number };
const ROWS = [
  { y: 232, scaleMilli: 780, xs: [92, 195, 298] },
  { y: 322, scaleMilli: 880, xs: [74, 195, 316] },
  { y: 420, scaleMilli: 1000, xs: [62, 195, 328] },
  { y: 520, scaleMilli: 1100, xs: [58, 195, 332] },
];
const SPOTS: readonly GallerySpotV12[] = ROWS.flatMap((r) =>
  r.xs.map((x) => ({ x, y: r.y, scaleMilli: r.scaleMilli, cover: r.y + Math.round((26 * r.scaleMilli) / 1000) })),
);
export const GALLERY_V12 = Object.freeze({
  trials: 12,
  feedbackTicks: 84,
  wrongPenaltyMs: 400,
  civilianPenaltyMs: 800,
  falseStartPenaltyMs: 600,
  missedPlatePenaltyMs: 1500,
  maxWrong: 3,
  /** Reach published for duels: reachBase − accumulated ms. */
  reachBase: 1_000_000,
  /** Round index from which each decoy family appears. */
  camoFrom: 3,
  holoFrom: 5,
  twoSpeciesFrom: 6,
  rngWarmup: 16,
  spots: SPOTS,
});
export type GalleryDecoyV12 = "NONE" | "OTHER" | "CAMO" | "CIVILIAN" | "HOLO";
export type GalleryTargetV12 = GallerySpotV12 & {
  spot: number;
  /** 0..5 creature species, 6 civilian */
  species: number;
  /** colour scheme: a species index (camouflaged decoys wear the target species' colours) */
  tint: number;
  holo: boolean;
  decoy: GalleryDecoyV12;
};
export type GalleryOrderV12 = { species: number[] };
export type GalleryTrialV12 = { order: GalleryOrderV12; targets: GalleryTargetV12[]; answers: number[]; waitTicks: number; deadlineTicks: number };
export type GalleryResultV12 = {
  trial: number;
  type: "CORRECT" | "PARTIAL" | "WRONG" | "FALSE_START" | "TIMEOUT";
  taps: number[];
  wrongs: number;
  civilians: number;
  /** Milliseconds this round added to the total (reaction + penalties). */
  addedMs: number;
};
export type GalleryStateV12 = CoreState & {
  seed: string;
  trials: GalleryTrialV12[];
  trial: number;
  phase: "waiting" | "ready" | "feedback";
  phaseTicks: number;
  readyTick: number;
  hits: number[];
  tapTicks: number[];
  wrongs: number;
  civilians: number;
  /** Target index of the last tap (-1 for a false start). */
  lastPick: number;
  lastTapTick: number;
  /** Absolute tick of the last correct hit in this round. */
  tapTickAbs: number;
  /** Milliseconds added by the last tap (reaction for a hit, penalty otherwise). */
  lastAddedMs: number;
  results: GalleryResultV12[];
  /** Accumulated reaction time in ms (the score). */
  totalMs: number;
  /** Ms accumulated within the current round. */
  roundMs: number;
  correct: number;
};

export function galleryTrialsV12(seed: string): GalleryTrialV12[] {
  return Array.from({ length: GALLERY_V12.trials }, (_, index) => {
    const rng = createRng(`${seed}:gallery12:trial:${index}`);
    // xorshift's first outputs are correlated between neighbouring seed strings: warm it up before drawing.
    for (let k = 0; k < GALLERY_V12.rngWarmup; k++) rng.nextUint();
    const primary = rng.nextInt(6);
    const species = [primary];
    if (index >= GALLERY_V12.twoSpeciesFrom) {
      let other = rng.nextInt(6);
      while (other === primary) other = rng.nextInt(6);
      species.push(other);
    }
    const matches = index < 3 ? 2 : 2 + rng.nextInt(index < 7 ? 2 : 3);
    const count = Math.min(12, 8 + Math.floor(index / 3));
    const slots = SPOTS.map((p, spot) => ({ ...p, spot }));
    for (let k = slots.length - 1; k > 0; k--) { const j = rng.nextInt(k + 1); [slots[k], slots[j]] = [slots[j], slots[k]]; }
    const notOrdered = () => { let v = rng.nextInt(6); while (species.includes(v)) v = rng.nextInt(6); return v; };
    const modes: GalleryDecoyV12[] = ["OTHER", "OTHER", "CIVILIAN"];
    if (index >= GALLERY_V12.camoFrom) modes.push("CAMO");
    if (index >= GALLERY_V12.holoFrom) modes.push("HOLO");
    const offset = rng.nextInt(modes.length);
    const targets: GalleryTargetV12[] = slots.slice(0, count).map((p, i) => {
      if (i < matches) { const s = species[i % species.length]; return { ...p, species: s, tint: s, holo: false, decoy: "NONE" }; }
      const k = i - matches, mode = modes[(k + offset) % modes.length], wanted = species[k % species.length];
      if (mode === "CIVILIAN") return { ...p, species: GALLERY_V12_CIVILIAN, tint: GALLERY_V12_CIVILIAN, holo: false, decoy: mode };
      if (mode === "HOLO") return { ...p, species: wanted, tint: wanted, holo: true, decoy: mode };
      const s = notOrdered();
      return { ...p, species: s, tint: mode === "CAMO" ? wanted : s, holo: false, decoy: mode };
    });
    const order = targets.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) { const j = rng.nextInt(i + 1); [order[i], order[j]] = [order[j], order[i]]; }
    const shuffled = order.map((i) => targets[i]);
    const answers = shuffled.map((t, i) => (t.decoy === "NONE" ? i : -1)).filter((i) => i >= 0);
    return {
      order: { species },
      targets: shuffled,
      answers,
      waitTicks: (index < 3 ? 120 : 84) + rng.nextInt(96),
      deadlineTicks: 600 - index * 14 + 90 * (answers.length - 1),
    };
  });
}

export function createGalleryV12(seed: string): GalleryStateV12 {
  return {
    tick: 0, status: "running", failure: null, score: 0, seed, trials: galleryTrialsV12(seed), trial: 0,
    phase: "waiting", phaseTicks: 0, readyTick: -1, hits: [], tapTicks: [], wrongs: 0, civilians: 0, lastPick: -1,
    lastTapTick: -999, tapTickAbs: -1, lastAddedMs: 0, results: [], totalMs: 0, roundMs: 0, correct: 0,
  };
}

/** Integer milliseconds for a tick count (120 ticks per second). */
export const galleryTicksToMsV12 = (ticks: number) => Math.floor((ticks * 25 + 1) / 3);
function add(s: GalleryStateV12, ms: number) {
  s.totalMs += ms;
  s.roundMs += ms;
}
function resolve(s: GalleryStateV12, type: GalleryResultV12["type"]) {
  const trial = s.trials[s.trial];
  if (type === "FALSE_START") add(s, GALLERY_V12.falseStartPenaltyMs);
  else add(s, (trial.answers.length - s.hits.length) * GALLERY_V12.missedPlatePenaltyMs);
  if (type === "CORRECT") s.correct++;
  s.results.push({ trial: s.trial, type, taps: [...s.tapTicks], wrongs: s.wrongs, civilians: s.civilians, addedMs: s.roundMs });
  s.phase = "feedback";
  s.phaseTicks = 0;
}
function resetRound(s: GalleryStateV12) {
  s.hits = []; s.tapTicks = []; s.wrongs = 0; s.civilians = 0; s.roundMs = 0;
}

export function stepGalleryV12(s: GalleryStateV12) {
  s.tick++;
  s.phaseTicks++;
  const trial = s.trials[s.trial];
  if (s.phase === "waiting") {
    if (s.phaseTicks >= trial.waitTicks) {
      s.phase = "ready"; s.phaseTicks = 0; s.readyTick = s.tick; resetRound(s);
    }
    return;
  }
  if (s.phase === "ready") {
    if (s.phaseTicks >= trial.deadlineTicks) resolve(s, s.hits.length ? "PARTIAL" : "TIMEOUT");
    return;
  }
  if (s.phaseTicks < GALLERY_V12.feedbackTicks) return;
  s.trial++;
  if (s.trial === GALLERY_V12.trials) {
    // The run always completes: the result is the accumulated time.
    s.status = "won";
    s.failure = null;
    s.score = s.totalMs;
    s.height = Math.max(0, GALLERY_V12.reachBase - s.totalMs);
    return;
  }
  s.phase = "waiting"; s.phaseTicks = 0; s.readyTick = -1; resetRound(s);
}

export function canApplyGalleryV12(s: GalleryStateV12, a: string) {
  if (s.status !== "running" || s.phase === "feedback" || !SHOT_GALLERY_ACTIONS_V3.includes(a)) return false;
  const i = Number(a.slice(5));
  return i < s.trials[s.trial].targets.length && !s.hits.includes(i);
}

export function applyGalleryV12(s: GalleryStateV12, a: string) {
  const i = Number(a.slice(5)), trial = s.trials[s.trial];
  if (s.phase === "waiting") {
    s.roundMs = 0;
    s.lastTapTick = s.tick;
    s.lastPick = -1;
    s.lastAddedMs = GALLERY_V12.falseStartPenaltyMs;
    return resolve(s, "FALSE_START");
  }
  s.lastTapTick = s.tick;
  s.lastPick = i;
  if (trial.answers.includes(i)) {
    const ms = galleryTicksToMsV12(s.tick - (s.hits.length ? s.tapTickAbs : s.readyTick));
    s.hits.push(i);
    s.tapTicks.push(s.tick - s.readyTick);
    s.tapTickAbs = s.tick;
    s.lastAddedMs = ms;
    add(s, ms);
    if (s.hits.length === trial.answers.length) resolve(s, "CORRECT");
  } else {
    const civilian = trial.targets[i].species === GALLERY_V12_CIVILIAN;
    const ms = civilian ? GALLERY_V12.civilianPenaltyMs : GALLERY_V12.wrongPenaltyMs;
    s.wrongs++;
    if (civilian) s.civilians++;
    s.lastAddedMs = ms;
    add(s, ms);
    if (s.wrongs >= GALLERY_V12.maxWrong) resolve(s, "WRONG");
  }
}

export const SHOT_GALLERY_CORE_V12: GameCore<GalleryStateV12> = {
  gameId: "reaction-test",
  gameVersion: "12.0.0",
  width: 390,
  height: 620,
  tickRate: 120,
  maxFinalTick: 120 * 60 * 3,
  maxInputs: 200,
  inputVersion: 3,
  actions: SHOT_GALLERY_ACTIONS_V3,
  content: {
    rules: GALLERY_V12,
    species: GALLERY_V12_SPECIES,
    scenario: "gallery12-hangar7-species-orders-camouflage-civilians-holograms",
    clock: "TICKS_POPUP_THEN_REACTION",
    aggregation: "ACCUMULATED_REACTION_MS_PUBLISHED_AT_TERMINAL_LOWER_IS_BETTER",
  },
  create: createGalleryV12,
  step: stepGalleryV12,
  canApply: canApplyGalleryV12,
  apply: applyGalleryV12,
};
