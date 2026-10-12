/** Six-target recognition gallery. The published V1 kernel/replays remain frozen. */
import { createRng, seededShuffle } from "../deterministic/seeded";
import { SHOT_GALLERY_ACTIONS_V2 } from "./shotGalleryProtocol.v2";
import {
  SHOT_GALLERY_CORE as V1,
  GALLERY_COLORS,
  GALLERY_SHAPES,
  type GalleryState,
  type GalleryTrial,
  type GalleryCard,
} from "./shotGalleryCore.v1";
import type { GameCore } from "./coreRuntime.v1";
export type GalleryStateV2 = GalleryState & { total: number };
export function galleryTrialsV2(seed: string): GalleryTrial[] {
  const kinds: GalleryTrial["kind"][] = [
    "COLOR",
    "SHAPE",
    "COLOR",
    "NUMBER",
    "COMBINATION",
    "SHAPE",
    "NUMBER",
    "COMBINATION",
    "COLOR",
    "NUMBER",
    "COMBINATION",
    "COMBINATION",
  ];
  return kinds.map((kind, index) => {
    const rng = createRng(`${seed}:gallery2:trial:${index}`),
      color = rng.nextInt(4),
      shape = rng.nextInt(4);
    let cards: GalleryCard[] = [],
      rule = "";
    if (kind === "COLOR") {
      cards = Array.from({ length: 6 }, (_, i) => ({
        color: i === 0 ? color : (color + 1 + (i % 3)) % 4,
        shape: i === 0 ? 0 : rng.nextInt(4),
        number: 0,
      }));
      rule = `COLOR ${GALLERY_COLORS[color]}`;
    } else if (kind === "SHAPE") {
      cards = Array.from({ length: 6 }, (_, i) => ({
        color: rng.nextInt(4),
        shape: i === 0 ? shape : (shape + 1 + (i % 3)) % 4,
        number: 0,
      }));
      rule = GALLERY_SHAPES[shape];
    } else if (kind === "NUMBER") {
      const numbers = seededShuffle(
        Array.from({ length: 49 }, (_, i) => i + 1),
        `${seed}:gallery2:numbers:${index}`,
      ).slice(0, 6);
      rule =
        Math.floor(index / 3) % 3 === 0
          ? "NÚMERO MAYOR"
          : Math.floor(index / 3) % 3 === 1
            ? "NÚMERO MENOR"
            : "ÚNICO NÚMERO PAR";
      if (rule.includes("PAR"))
        for (let i = 0; i < 6; i++)
          numbers[i] = i === 0 ? 2 + 2 * rng.nextInt(20) : 3 + 4 * i;
      cards = numbers.map((number) => ({ color: 0, shape: 2, number }));
    } else {
      const distractors = seededShuffle(
        Array.from({ length: 16 }, (_, i) => ({
          color: Math.floor(i / 4),
          shape: i % 4,
          number: 0,
        })).filter((c) => c.color !== color || c.shape !== shape),
        `${seed}:gallery2:alternatives:${index}`,
      );
      cards = [{ color, shape, number: 0 }, ...distractors.slice(0, 5)];
      rule = `${GALLERY_SHAPES[shape]} ${GALLERY_COLORS[color]}`;
    }
    cards = seededShuffle(cards, `${seed}:gallery2:shuffle:${index}`);
    const answer = cards.findIndex((c) =>
      kind === "COLOR"
        ? c.color === color
        : kind === "SHAPE"
          ? c.shape === shape
          : kind === "COMBINATION"
            ? c.color === color && c.shape === shape
            : rule.includes("MAYOR")
              ? c.number === Math.max(...cards.map((c) => c.number))
              : rule.includes("MENOR")
                ? c.number === Math.min(...cards.map((c) => c.number))
                : c.number % 2 === 0,
    );
    return {
      kind,
      rule,
      cards,
      answer,
      waitTicks: (index < 3 ? 120 : 84) + rng.nextInt(84),
      deadlineTicks: 600 - index * 18,
    };
  });
}
/** V1 scoring/phase kernel operates on total; live score cannot end the aggregate early. */
function useTotal(s: GalleryStateV2, run: () => void) {
  s.score = s.total;
  run();
  s.total = s.score;
  s.score = s.status === "running" ? 0 : s.total;
}
export const SHOT_GALLERY_CORE_V2: GameCore<GalleryStateV2> = {
  ...V1,
  gameVersion: "2.0.0",
  height: 520,
  inputVersion: 2,
  actions: SHOT_GALLERY_ACTIONS_V2,
  content: {
    ...(V1.content as object),
    scenario: "gallery2-six-target-template-v2",
    clock: "TICKS_REVEAL_THEN_REACTION",
    aggregation: "TWELVE_TOTAL_PUBLISHED_AT_TERMINAL",
    generation: "UNIQUE_ANSWER_SIX_TARGETS_INTERLEAVED_RULES",
  },
  create(seed) {
    return { ...V1.create(seed), trials: galleryTrialsV2(seed), total: 0 };
  },
  step(s) {
    useTotal(s, () => V1.step(s));
  },
  canApply(s, a) {
    return (
      s.status === "running" &&
      s.phase !== "feedback" &&
      SHOT_GALLERY_ACTIONS_V2.some((allowed) => allowed === a)
    );
  },
  apply(s, a) {
    useTotal(s, () => V1.apply(s, a));
  },
};
export { GALLERY_COLORS, GALLERY_SHAPES };
