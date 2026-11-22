/**
 * Solitaire Sprint V1 · public protocol (safe for the client bundle).
 *
 * Klondike, draw one, unlimited redeals, no foundation → tableau. Card id = suit * 13 + rank - 1 with suits
 * [♠, ♥, ♦, ♣] (same encoding as the solver and the legacy client). The server owns the deal; the phone only ever
 * receives `SolitairePublicViewV1`, which holds the ids of face-up cards and nothing else.
 */
export const SOLITAIRE_V1_COLUMNS = 7;
/** Real-time limit enforced by the server (owner, 22-nov-2026): unsolved after 5 minutes is a loss. */
export const SOLITAIRE_V1_TIME_LIMIT_MS = 5 * 60 * 1000;

const COLUMNS = Array.from({ length: SOLITAIRE_V1_COLUMNS }, (_, i) => i);

/**
 * Every action is a whole move. A tableau → tableau move needs no card count: in Klondike at most one card of the
 * source's face-up run fits the target (or one king for an empty column), so the run is implied.
 * `TIME_UP` closes the attempt as unsolved: the server sends it when the limit passes; a player may send it to resign.
 */
export const SOLITAIRE_ACTIONS_V1 = Object.freeze([
  "DRAW",
  "W>F",
  ...COLUMNS.map((d) => `W>T${d}`),
  ...COLUMNS.map((c) => `T${c}>F`),
  ...COLUMNS.flatMap((c) => COLUMNS.filter((d) => d !== c).map((d) => `T${c}>T${d}`)),
  "TIME_UP",
] as const);
export type SolitaireActionV1 = (typeof SOLITAIRE_ACTIONS_V1)[number];

export type SolitairePublicViewV1 = Readonly<{
  /** Per column: `null` for each face-down card (no id), then the ids of the face-up run, bottom to top. */
  tableau: readonly (readonly (number | null)[])[];
  stockCount: number;
  wasteCount: number;
  /** Only the top of the waste is playable and visible (draw one). */
  wasteTop: number | null;
  /** Cards on each suit's foundation, in suit order [♠, ♥, ♦, ♣]. */
  foundations: readonly number[];
  moves: number;
  reach: number;
}>;

export const solitaireSuitOf = (card: number) => Math.floor(card / 13);
export const solitaireRankOf = (card: number) => (card % 13) + 1;
export const solitaireIsRed = (card: number) => {
  const suit = solitaireSuitOf(card);
  return suit === 1 || suit === 2;
};
/** True when `card` may be placed on `target` in the tableau (`undefined` = empty column, kings only). */
export const solitaireFitsTableau = (card: number, target: number | undefined) =>
  target === undefined
    ? solitaireRankOf(card) === 13
    : solitaireRankOf(target) === solitaireRankOf(card) + 1 && solitaireIsRed(target) !== solitaireIsRed(card);
