"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GameResult } from "@/lib/types";
import { seededShuffle } from "@/lib/deterministic/seeded";
import { gameTone, haptic } from "@/lib/gameFeedback";

type Props = {
  active: boolean;
  targetScore: number;
  seed: string;
  onFinish: (result: GameResult) => void;
};

type Suit = "♠" | "♥" | "♦" | "♣";
type Card = {
  id: string;
  suit: Suit;
  rank: number;
  faceUp: boolean;
};
type Source =
  | { type: "waste" }
  | { type: "tableau"; column: number; index: number }
  | null;

const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];

function rankLabel(rank: number) {
  if (rank === 1) return "A";
  if (rank === 11) return "J";
  if (rank === 12) return "Q";
  if (rank === 13) return "K";
  return String(rank);
}

function isRed(suit: Suit) {
  return suit === "♥" || suit === "♦";
}

function createDeck(seed: string) {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank += 1) {
      deck.push({
        id: `${suit}-${rank}`,
        suit,
        rank,
        faceUp: false,
      });
    }
  }
  return seededShuffle(deck, seed).map((card) => ({ ...card }));
}

function deal(seed: string) {
  const deck = createDeck(seed);
  const tableau: Card[][] = Array.from({ length: 7 }, () => []);
  let cursor = 0;

  for (let col = 0; col < 7; col += 1) {
    for (let row = 0; row <= col; row += 1) {
      const card = { ...deck[cursor++] };
      card.faceUp = row === col;
      tableau[col].push(card);
    }
  }

  return {
    tableau,
    stock: deck.slice(cursor).map((card) => ({ ...card, faceUp: false })),
  };
}

function canPlaceOnTableau(card: Card, target?: Card) {
  if (!target) return card.rank === 13;
  return (
    target.faceUp &&
    target.rank === card.rank + 1 &&
    isRed(target.suit) !== isRed(card.suit)
  );
}

function canPlaceOnFoundation(card: Card, foundation: Card[]) {
  if (!foundation.length) return card.rank === 1;
  const top = foundation[foundation.length - 1];
  return top.suit === card.suit && card.rank === top.rank + 1;
}

export default function SolitaireSprint({
  active,
  targetScore,
  seed,
  onFinish,
}: Props) {
  const initial = useMemo(() => deal(seed), [seed]);
  const [tableau, setTableau] = useState<Card[][]>(initial.tableau);
  const [stock, setStock] = useState<Card[]>(initial.stock);
  const [waste, setWaste] = useState<Card[]>([]);
  const [foundations, setFoundations] = useState<Card[][]>(
    Array.from({ length: 4 }, () => [])
  );
  const [selected, setSelected] = useState<Source>(null);
  const [score, setScore] = useState(0);
  const runningRef = useRef(false);
  const startRef = useRef(0);

  useEffect(() => {
    const next = deal(seed);
    setTableau(next.tableau);
    setStock(next.stock);
    setWaste([]);
    setFoundations(Array.from({ length: 4 }, () => []));
    setSelected(null);
    setScore(0);
    runningRef.current = active;
    if (active) startRef.current = performance.now();
  }, [active, seed]);

  function finish(won: boolean, finalScore: number) {
    if (!runningRef.current) return;
    runningRef.current = false;
    gameTone(won ? "win" : "bad");
    haptic(won ? [18,28,45] : 26);
    onFinish({
      won,
      score: finalScore,
      timeMs: Math.round(performance.now() - startRef.current),
    });
  }

  function applyScore(delta: number) {
    const next = score + delta;
    setScore(next);
    if (next >= targetScore) finish(true, next);
    return next;
  }

  function revealTop(nextTableau: Card[][], column: number) {
    const cards = nextTableau[column];
    const top = cards[cards.length - 1];
    if (top && !top.faceUp) {
      top.faceUp = true;
      applyScore(100);
    }
  }

  function drawStock() {
    if (!runningRef.current) return;
    setSelected(null);

    if (stock.length) {
      const nextStock = [...stock];
      const card = { ...nextStock.pop()!, faceUp: true };
      setStock(nextStock);
      setWaste((items) => [...items, card]);
      gameTone("tap");
      haptic(2);
      return;
    }

    if (waste.length) {
      setStock([...waste].reverse().map((card) => ({ ...card, faceUp: false })));
      setWaste([]);
      gameTone("tap");
      haptic(2);
    }
  }

  function autoFoundation(card: Card, source: Source) {
    const suitIndex = SUITS.indexOf(card.suit);
    const foundation = foundations[suitIndex];
    if (!canPlaceOnFoundation(card, foundation)) return false;

    const nextFoundations = foundations.map((pile) => [...pile]);
    nextFoundations[suitIndex].push({ ...card, faceUp: true });

    if (source?.type === "waste") {
      setWaste((items) => items.slice(0, -1));
    } else if (source?.type === "tableau") {
      const nextTableau = tableau.map((column) => column.map((item) => ({ ...item })));
      nextTableau[source.column].splice(source.index);
      revealTop(nextTableau, source.column);
      setTableau(nextTableau);
    }

    setFoundations(nextFoundations);
    setSelected(null);
    gameTone("good");
    haptic(5);

    const finalScore = applyScore(500);
    const totalFoundation = nextFoundations.reduce((sum, pile) => sum + pile.length, 0);
    if (totalFoundation === 52) finish(true, Math.max(finalScore, targetScore));
    return true;
  }

  function sourceCards(source: Source) {
    if (!source) return [] as Card[];
    if (source.type === "waste") {
      const card = waste[waste.length - 1];
      return card ? [card] : [];
    }
    return tableau[source.column].slice(source.index);
  }

  function moveSelectedTo(column: number) {
    if (!selected) return false;
    const moving = sourceCards(selected);
    if (!moving.length) return false;

    const targetColumn = tableau[column];
    const target = targetColumn[targetColumn.length - 1];

    if (!canPlaceOnTableau(moving[0], target)) return false;

    const nextTableau = tableau.map((cards) => cards.map((card) => ({ ...card })));

    if (selected.type === "waste") {
      setWaste((items) => items.slice(0, -1));
    } else {
      nextTableau[selected.column].splice(selected.index);
      revealTop(nextTableau, selected.column);
    }

    nextTableau[column].push(...moving.map((card) => ({ ...card })));
    setTableau(nextTableau);
    setSelected(null);
    applyScore(40);
    gameTone("tap");
    haptic(3);
    return true;
  }

  function tapWaste() {
    if (!waste.length || !runningRef.current) return;
    const card = waste[waste.length - 1];
    if (autoFoundation(card, { type: "waste" })) return;

    setSelected((current) =>
      current?.type === "waste" ? null : { type: "waste" }
    );
  }

  function tapTableau(column: number, index: number) {
    if (!runningRef.current) return;
    const card = tableau[column][index];
    if (!card?.faceUp) return;

    if (selected && moveSelectedTo(column)) return;

    const isTop = index === tableau[column].length - 1;
    if (isTop && autoFoundation(card, { type: "tableau", column, index })) {
      return;
    }

    setSelected((current) => {
      if (
        current?.type === "tableau" &&
        current.column === column &&
        current.index === index
      ) {
        return null;
      }
      return { type: "tableau", column, index };
    });
  }

  function tapEmptyColumn(column: number) {
    if (selected) moveSelectedTo(column);
  }

  return (
    <div className="detGameSurface solitaireSprint">
      <div className="solitaireTopRow">
        <button
          type="button"
          className="solitairePile stock"
          onClick={drawStock}
          aria-label="Mazo"
        >
          {stock.length ? "▰" : waste.length ? "↻" : ""}
        </button>

        <button
          type="button"
          className={`solitairePile waste ${selected?.type === "waste" ? "selected" : ""}`}
          onClick={tapWaste}
          aria-label="Descarte"
        >
          {waste.length ? (
            <>
              <b className={isRed(waste[waste.length - 1].suit) ? "red" : ""}>
                {rankLabel(waste[waste.length - 1].rank)}
              </b>
              <span className={isRed(waste[waste.length - 1].suit) ? "red" : ""}>
                {waste[waste.length - 1].suit}
              </span>
            </>
          ) : ""}
        </button>

        <div className="solitaireFoundations">
          {foundations.map((pile, index) => {
            const top = pile[pile.length - 1];
            return (
              <div key={SUITS[index]} className="solitairePile foundation">
                {top ? (
                  <>
                    <b className={isRed(top.suit) ? "red" : ""}>{rankLabel(top.rank)}</b>
                    <span className={isRed(top.suit) ? "red" : ""}>{top.suit}</span>
                  </>
                ) : (
                  <span className={isRed(SUITS[index]) ? "red ghostSuit" : "ghostSuit"}>
                    {SUITS[index]}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="solitaireTableau">
        {tableau.map((column, columnIndex) => (
          <div
            key={columnIndex}
            className="solitaireColumn"
            onClick={() => {
              if (!column.length) tapEmptyColumn(columnIndex);
            }}
          >
            {column.map((card, index) => (
              <button
                type="button"
                key={card.id}
                className={`solitaireCard ${card.faceUp ? "faceUp" : "faceDown"} ${selected?.type === "tableau" && selected.column === columnIndex && selected.index === index ? "selected" : ""}`}
                style={{ top: index * 31 }}
                onClick={(event) => {
                  event.stopPropagation();
                  tapTableau(columnIndex, index);
                }}
                aria-label={card.faceUp ? `${rankLabel(card.rank)} ${card.suit}` : "Carta boca abajo"}
              >
                {card.faceUp ? (
                  <>
                    <b className={isRed(card.suit) ? "red" : ""}>{rankLabel(card.rank)}</b>
                    <span className={isRed(card.suit) ? "red" : ""}>{card.suit}</span>
                  </>
                ) : (
                  <span>◆</span>
                )}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
