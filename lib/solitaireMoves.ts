/** Visible-card assistance only. Never inspect the stock or hidden faces. */
export type Suit = "♠" | "♥" | "♦" | "♣";
export type Card = { id: string; suit: Suit; rank: number; faceUp: boolean };
export type Source = {type: "waste"} | {type: "tableau"; column: number; index: number} | null;
export type SolitaireDestination = {type: "foundation" | "tableau"; index: number};
export const isRed = (suit: Suit) => suit === "♥" || suit === "♦";
export function canPlaceOnTableau(card: Card, target?: Card) {
  return !target ? card.rank === 13 : target.faceUp && target.rank === card.rank + 1 && isRed(target.suit) !== isRed(card.suit);
}
export function canPlaceOnFoundation(card: Card, foundation: Card[]) {
  const top = foundation.at(-1);
  return !top ? card.rank === 1 : top.suit === card.suit && card.rank === top.rank + 1;
}
export function solitaireDestinations(source: Source, tableau: Card[][], waste: Card[], foundations: Card[][]): SolitaireDestination[] {
  if (!source) return [];
  const moving = source.type === "waste" ? waste.slice(-1) : tableau[source.column].slice(source.index);
  if (!moving.length || moving.some(card => !card.faceUp)) return [];
  // A selected sequence must itself be legal, not just have a compatible head.
  if (moving.some((card, i) => i > 0 && !canPlaceOnTableau(card, moving[i - 1]))) return [];
  const destinations: SolitaireDestination[] = [];
  if (moving.length === 1) foundations.forEach((pile, index) => {
    if (!pile.length && moving[0].suit !== (["♠", "♥", "♦", "♣"] as const)[index]) return;
    if (canPlaceOnFoundation(moving[0], pile)) destinations.push({type: "foundation", index});
  });
  const columns = tableau.map((cards, index) => ({cards, index})).filter(({cards, index}) =>
    (source.type !== "tableau" || source.column !== index) && canPlaceOnTableau(moving[0], cards.at(-1)) &&
    // Moving a king between empty columns has no purpose.
    !(source.type === "tableau" && source.index === 0 && !cards.length));
  columns.sort((a, b) => b.cards.length - a.cards.length || a.index - b.index);
  destinations.push(...columns.map(({index}) => ({type: "tableau" as const, index})));
  return destinations;
}
