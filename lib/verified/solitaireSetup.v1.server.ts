/** Private setup candidate, not enabled in the catalogue. Never expose its seed/deck.
 * Full-key server RNG avoids recoverable public-template decks. No solvability claim.
 */
import { createPrivateHashRng } from "../deterministic/privateHashRng.server";
export const SOLITAIRE_SETUP_V1 = Object.freeze({
  generatorVersion: "1.0.0",
  domain: "solitaire-sprint:private-deal-v1",
  columns: 7,
  cards: 52,
  stock: 24,
});
export type PrivateSolitaireCard = Readonly<{
  cardId: number;
  faceUp: boolean;
}>;
export type PrivateSolitaireSetup = Readonly<{
  tableau: readonly (readonly PrivateSolitaireCard[])[];
  stock: readonly number[];
}>;
export type PublicSolitaireSetup = Readonly<{
  tableau: readonly (readonly (number | null)[])[];
  stockCount: number;
}>;
export function generatePrivateSolitaireSetup(
  seed: string,
): PrivateSolitaireSetup {
  const rng = createPrivateHashRng(seed, SOLITAIRE_SETUP_V1.domain),
    deck = Array.from({ length: 52 }, (_, i) => i);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  let cursor = 0;
  const tableau = Array.from({ length: 7 }, (_, column) =>
    Array.from({ length: column + 1 }, (_, row) => ({
      cardId: deck[cursor++],
      faceUp: row === column,
    })),
  );
  return { tableau, stock: deck.slice(cursor) };
}
/** Public projection contains only legally visible faces; no IDs for facedown cards. */
export function projectSolitaireSetup(
  setup: PrivateSolitaireSetup,
): PublicSolitaireSetup {
  return {
    tableau: setup.tableau.map((column) =>
      column.map((card) => (card.faceUp ? card.cardId : null)),
    ),
    stockCount: setup.stock.length,
  };
}
