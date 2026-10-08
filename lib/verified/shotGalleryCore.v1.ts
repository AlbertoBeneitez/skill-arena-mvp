/** Original recognition trials. Score is the sum of authoritative per-trial awards. */
import { createRng, seededShuffle } from "../deterministic/seeded";
import { SHOT_GALLERY_ACTIONS } from "./shotGalleryProtocol.v1";
import type { CoreState, GameCore } from "./coreRuntime.v1";
export const GALLERY_COLORS = ["AZUL", "CORAL", "LIMA", "VIOLETA"] as const;
export const GALLERY_SHAPES = [
  "CÍRCULO",
  "TRIÁNGULO",
  "CUADRADO",
  "HEXÁGONO",
] as const;
export const SHOT_GALLERY_RULES = {
  trials: 12,
  feedbackTicks: 84,
  maximumAward: 900,
  minimumAward: 200,
  minimumReactionTicks: 12,
  pointsPerLateTick: 5,
  falseStartPenalty: 150,
  wrongPenalty: 100,
  minimumCorrect: 6,
  minimumCompletionScore: 2500,
} as const;
export type GalleryCard = { color: number; shape: number; number: number };
export type GalleryTrial = {
  kind: "COLOR" | "SHAPE" | "NUMBER" | "COMBINATION";
  rule: string;
  cards: GalleryCard[];
  answer: number;
  waitTicks: number;
  deadlineTicks: number;
};
export type GalleryResult = {
  trial: number;
  kind: GalleryTrial["kind"];
  type: "CORRECT" | "WRONG" | "FALSE_START" | "TIMEOUT";
  reactionTicks: number | null;
  award: number;
  pick: number | null;
};
export type GalleryState = CoreState & {
  seed: string;
  trials: GalleryTrial[];
  trial: number;
  phase: "waiting" | "ready" | "feedback";
  phaseTicks: number;
  readyTick: number;
  results: GalleryResult[];
  correct: number;
  reactionSumTicks: number;
};
export function galleryTrials(seed: string): GalleryTrial[] {
  return Array.from({ length: 12 }, (_, index) => {
    const rng = createRng(`${seed}:gallery1:trial:${index}`),
      stage = Math.floor(index / 3),
      count = stage === 0 ? (index === 2 ? 3 : 2) : stage === 1 ? 3 : 4,
      answer = rng.nextInt(count),
      color = rng.nextInt(4),
      shape = rng.nextInt(4);
    let cards: GalleryCard[] = Array.from({ length: count }, (_, i) => ({
        color: (color + i) % 4,
        shape: (shape + i) % 4,
        number: 3 + i,
      })),
      rule = "",
      kind: GalleryTrial["kind"] = "COLOR";
    if (stage === 0) {
      cards = cards.map((c, i) => ({
        ...c,
        color: (color + i - answer + 4) % 4,
        shape: 0,
      }));
      rule = `COLOR ${GALLERY_COLORS[color]}`;
    } else if (stage === 1) {
      kind = "SHAPE";
      cards = cards.map((c, i) => ({
        ...c,
        shape: (shape + i - answer + 4) % 4,
        color: 0,
      }));
      rule = GALLERY_SHAPES[shape];
    } else if (stage === 2) {
      kind = "NUMBER";
      const numbers: number[] = [];
      while (numbers.length < 4) {
        const n = 3 + rng.nextInt(47);
        if (!numbers.includes(n)) numbers.push(n);
      }
      if (index % 3 === 2) {
        cards = cards.map((c, i) => ({
          ...c,
          color: 0,
          shape: 2,
          number: i === answer ? 2 * (1 + rng.nextInt(24)) : 2 * i + 11,
        }));
        rule = "ÚNICO NÚMERO PAR";
      } else {
        const sorted = [...numbers].sort((a, b) => a - b),
          chosen = index % 3 === 0 ? sorted.at(-1)! : sorted[0];
        cards = cards.map((c, i) => ({
          ...c,
          color: 0,
          shape: 2,
          number: numbers[i],
        }));
        rule = index % 3 === 0 ? "NÚMERO MAYOR" : "NÚMERO MENOR";
        return {
          kind,
          rule,
          cards,
          answer: numbers.indexOf(chosen),
          waitTicks: 72 + rng.nextInt(120),
          deadlineTicks: 480,
        };
      }
    } else {
      kind = "COMBINATION";
      const choices = [
        { color, shape, number: 0 },
        { color, shape: (shape + 1) % 4, number: 0 },
        { color: (color + 1) % 4, shape, number: 0 },
        { color: (color + 2) % 4, shape: (shape + 2) % 4, number: 0 },
      ];
      cards = seededShuffle(choices, `${seed}:gallery1:shuffle:${index}`);
      rule = `${GALLERY_SHAPES[shape]} ${GALLERY_COLORS[color]}`;
      return {
        kind,
        rule,
        cards,
        answer: cards.findIndex((c) => c.color === color && c.shape === shape),
        waitTicks: 60 + rng.nextInt(132),
        deadlineTicks: 420,
      };
    }
    return {
      kind,
      rule,
      cards,
      answer,
      waitTicks: (stage === 0 ? 120 : 90) + rng.nextInt(120),
      deadlineTicks: stage === 0 ? 600 : stage === 1 ? 540 : 480,
    };
  });
}
export function createGalleryState(seed: string): GalleryState {
  return {
    tick: 0,
    status: "running",
    failure: null,
    score: 0,
    seed,
    trials: galleryTrials(seed),
    trial: 0,
    phase: "waiting",
    phaseTicks: 0,
    readyTick: -1,
    results: [],
    correct: 0,
    reactionSumTicks: 0,
  };
}
function resolveTrial(
  state: GalleryState,
  type: GalleryResult["type"],
  pick: number | null,
) {
  const reaction =
    type === "CORRECT" || type === "WRONG"
      ? state.tick - state.readyTick
      : null;
  const award =
    type === "CORRECT"
      ? Math.max(200, 900 - Math.max(0, reaction! - 12) * 5)
      : type === "WRONG"
        ? -100
        : type === "FALSE_START"
          ? -150
          : 0;
  state.score = Math.max(0, state.score + award);
  if (type === "CORRECT") {
    state.correct++;
    state.reactionSumTicks += reaction!;
  }
  state.results.push({
    trial: state.trial,
    kind: state.trials[state.trial].kind,
    type,
    reactionTicks: reaction,
    award,
    pick,
  });
  state.phase = "feedback";
  state.phaseTicks = 0;
}
export function stepGallery(state: GalleryState) {
  state.tick++;
  state.phaseTicks++;
  const trial = state.trials[state.trial];
  if (state.phase === "waiting") {
    if (state.phaseTicks >= trial.waitTicks) {
      state.phase = "ready";
      state.phaseTicks = 0;
      state.readyTick = state.tick;
    }
    return;
  }
  if (state.phase === "ready") {
    if (state.phaseTicks >= trial.deadlineTicks)
      resolveTrial(state, "TIMEOUT", null);
    return;
  }
  if (state.phaseTicks < SHOT_GALLERY_RULES.feedbackTicks) return;
  state.trial++;
  if (state.trial === SHOT_GALLERY_RULES.trials) {
    state.status = state.correct >= 6 && state.score >= 2500 ? "won" : "failed";
    state.failure = state.status === "failed" ? "RECOGNITION_SCORE" : null;
    return;
  }
  state.phase = "waiting";
  state.phaseTicks = 0;
  state.readyTick = -1;
}
export function canApplyGallery(state: GalleryState, action: string) {
  return (
    state.status === "running" &&
    state.phase !== "feedback" &&
    SHOT_GALLERY_ACTIONS.some((allowed) => allowed === action) &&
    Number(action.slice(5)) < state.trials[state.trial].cards.length
  );
}
export function applyGallery(state: GalleryState, action: string) {
  const pick = Number(action.slice(5));
  resolveTrial(
    state,
    state.phase === "waiting"
      ? "FALSE_START"
      : pick === state.trials[state.trial].answer
        ? "CORRECT"
        : "WRONG",
    pick,
  );
}
export const SHOT_GALLERY_CORE: GameCore<GalleryState> = {
  gameId: "reaction-test",
  gameVersion: "1.0.0",
  width: 390,
  height: 620,
  tickRate: 120,
  maxFinalTick: 120 * 60 * 3,
  maxInputs: 100,
  inputVersion: 1,
  actions: SHOT_GALLERY_ACTIONS,
  content: {
    rules: SHOT_GALLERY_RULES,
    colors: GALLERY_COLORS,
    shapes: GALLERY_SHAPES,
    scenario: "gallery1-recognition-v1",
  },
  create: createGalleryState,
  step: stepGallery,
  canApply: canApplyGallery,
  apply: applyGallery,
};
