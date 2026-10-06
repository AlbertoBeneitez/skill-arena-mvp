"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GameResult } from "@/lib/types";
import { solitaireChallengeFor } from "@/lib/deterministic/challengeSets";
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

function card(suit: Suit, rank: number, faceUp = false): Card {
  return {
    id: `${suit}-${rank}`,
    suit,
    rank,
    faceUp,
  };
}

function cardFromIndex(index: number, faceUp = false): Card {
  const suit = SUITS[Math.floor(index / 13)];
  const rank = (index % 13) + 1;
  return card(suit, rank, faceUp);
}

/**
 * Uses a curated pool of solver-validated standard Klondike deals.
 *
 * The deals are not generated to be easy. They were accepted only after an
 * offline solver completed them under the same rules as this client. The pool
 * includes deals requiring substantial tableau rearrangement and several
 * stock passes. A future server-issued match seed selects the same challenge
 * for both competitors.
 */
function dealVerifiedChallenge(seed: string) {
  const challenge = solitaireChallengeFor(seed);
  const deck = challenge.deck.map((index) => cardFromIndex(index));

  const tableau: Card[][] = Array.from({ length: 7 }, () => []);
  let cursor = 0;

  for (let column = 0; column < 7; column += 1) {
    for (let row = 0; row <= column; row += 1) {
      tableau[column].push({
        ...deck[cursor],
        faceUp: row === column,
      });
      cursor += 1;
    }
  }

  return {
    tableau,
    stock: deck.slice(cursor).map((item) => ({
      ...item,
      faceUp: false,
    })),
  };
}

function canPlaceOnTableau(cardToMove: Card, target?: Card) {
  if (!target) return cardToMove.rank === 13;
  return (
    target.faceUp &&
    target.rank === cardToMove.rank + 1 &&
    isRed(target.suit) !== isRed(cardToMove.suit)
  );
}

function canPlaceOnFoundation(cardToMove: Card, foundation: Card[]) {
  if (!foundation.length) return cardToMove.rank === 1;
  const top = foundation[foundation.length - 1];
  return top.suit === cardToMove.suit && cardToMove.rank === top.rank + 1;
}

function formatTimer(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function SolitaireSprint({
  active,
  targetScore: _targetScore,
  seed,
  onFinish,
}: Props) {
  const initial = useMemo(() => dealVerifiedChallenge(seed), [seed]);
  const [tableau, setTableau] = useState<Card[][]>(initial.tableau);
  const [stock, setStock] = useState<Card[]>(initial.stock);
  const [waste, setWaste] = useState<Card[]>([]);
  const [foundations, setFoundations] = useState<Card[][]>(
    Array.from({ length: 4 }, () => [])
  );
  const [selected, setSelected] = useState<Source>(null);
  const [score, setScore] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);

  const scoreRef = useRef(0);
  const runningRef = useRef(false);
  const startRef = useRef(0);

  useEffect(() => {
    const next = dealVerifiedChallenge(seed);
    setTableau(next.tableau);
    setStock(next.stock);
    setWaste([]);
    setFoundations(Array.from({ length: 4 }, () => []));
    setSelected(null);
    setScore(0);
    scoreRef.current = 0;
    setElapsedMs(0);
    runningRef.current = active;

    if (active) startRef.current = performance.now();
  }, [active, seed]);

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => {
      if (runningRef.current) {
        setElapsedMs(Math.round(performance.now() - startRef.current));
      }
    }, 200);
    return () => window.clearInterval(timer);
  }, [active]);

  function finish(won: boolean, finalScore = scoreRef.current) {
    if (!runningRef.current) return;
    runningRef.current = false;
    const timeMs = Math.round(performance.now() - startRef.current);
    setElapsedMs(timeMs);
    gameTone(won ? "win" : "bad");
    haptic(won ? [18, 28, 45] : 26);
    onFinish({ won, score: finalScore, timeMs });
  }

  function addScore(delta: number) {
    const next = scoreRef.current + delta;
    scoreRef.current = next;
    setScore(next);

    return next;
  }

  function revealTop(nextTableau: Card[][], column: number) {
    const cards = nextTableau[column];
    const top = cards[cards.length - 1];
    if (top && !top.faceUp) {
      top.faceUp = true;
      addScore(100);
    }
  }

  function drawStock() {
    if (!runningRef.current) return;
    setSelected(null);

    if (stock.length) {
      const nextStock = [...stock];
      const drawn = { ...nextStock.pop()!, faceUp: true };
      setStock(nextStock);
      setWaste((items) => [...items, drawn]);
      gameTone("tap");
      haptic(2);
      return;
    }

    if (waste.length) {
      setStock([...waste].reverse().map((item) => ({ ...item, faceUp: false })));
      setWaste([]);
      gameTone("tap");
      haptic(2);
    }
  }

  function sourceCards(source: Source) {
    if (!source) return [] as Card[];

    if (source.type === "waste") {
      const top = waste[waste.length - 1];
      return top ? [top] : [];
    }

    return tableau[source.column].slice(source.index);
  }

  function removeSource(
    source: Exclude<Source, null>,
    nextTableau: Card[][]
  ) {
    if (source.type === "waste") {
      setWaste((items) => items.slice(0, -1));
      return;
    }

    nextTableau[source.column].splice(source.index);
    revealTop(nextTableau, source.column);
  }

  function moveSelectedToTableau(column: number) {
    if (!selected || !runningRef.current) return false;

    const moving = sourceCards(selected);
    if (!moving.length) return false;

    const targetColumn = tableau[column];
    const target = targetColumn[targetColumn.length - 1];

    if (!canPlaceOnTableau(moving[0], target)) return false;

    const nextTableau = tableau.map((cards) =>
      cards.map((item) => ({ ...item }))
    );

    removeSource(selected, nextTableau);
    nextTableau[column].push(...moving.map((item) => ({ ...item })));

    setTableau(nextTableau);
    setSelected(null);
    addScore(40);
    gameTone("tap");
    haptic(3);
    return true;
  }

  function moveSelectedToFoundation(foundationIndex: number) {
    if (!selected || !runningRef.current) return false;

    const moving = sourceCards(selected);
    if (moving.length !== 1) return false;

    const selectedCard = moving[0];

    if (
      selected.type === "tableau" &&
      selected.index !== tableau[selected.column].length - 1
    ) {
      return false;
    }

    const foundation = foundations[foundationIndex];
    if (!canPlaceOnFoundation(selectedCard, foundation)) return false;

    const nextFoundations = foundations.map((pile) =>
      pile.map((item) => ({ ...item }))
    );
    const nextTableau = tableau.map((cards) =>
      cards.map((item) => ({ ...item }))
    );

    removeSource(selected, nextTableau);
    nextFoundations[foundationIndex].push({
      ...selectedCard,
      faceUp: true,
    });

    setFoundations(nextFoundations);
    setTableau(nextTableau);
    setSelected(null);
    gameTone("good");
    haptic(5);

    const finalScore = addScore(500);
    const foundationCount = nextFoundations.reduce(
      (sum, pile) => sum + pile.length,
      0
    );

    if (foundationCount === 52) {
      finish(true, finalScore);
    }

    return true;
  }

  function tapWaste() {
    if (!waste.length || !runningRef.current) return;
    setSelected((current) =>
      current?.type === "waste" ? null : { type: "waste" }
    );
    haptic(2);
  }

  function tapTableau(column: number, index: number) {
    if (!runningRef.current) return;
    const selectedCard = tableau[column][index];
    if (!selectedCard?.faceUp) return;

    if (selected) {
      if (
        selected.type === "tableau" &&
        selected.column === column &&
        selected.index === index
      ) {
        setSelected(null);
        return;
      }

      if (moveSelectedToTableau(column)) return;
    }

    setSelected({
      type: "tableau",
      column,
      index,
    });
    haptic(2);
  }

  function tapEmptyColumn(column: number) {
    if (selected) moveSelectedToTableau(column);
  }

  return (
    <div className="detGameSurface solitaireSprint">
      <div className="solitaireTimer" aria-label="Tiempo">
        {formatTimer(elapsedMs)}
      </div>

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
            const suit = SUITS[index];
            return (
              <button
                key={suit}
                type="button"
                className="solitairePile foundation"
                onClick={() => moveSelectedToFoundation(index)}
                aria-label={`Base de ${suit}`}
              >
                {top ? (
                  <>
                    <b className={isRed(top.suit) ? "red" : ""}>
                      {rankLabel(top.rank)}
                    </b>
                    <span className={isRed(top.suit) ? "red" : ""}>
                      {top.suit}
                    </span>
                  </>
                ) : (
                  <span className={isRed(suit) ? "red ghostSuit" : "ghostSuit"}>
                    {suit}
                  </span>
                )}
              </button>
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
            {column.map((item, index) => (
              <button
                type="button"
                key={item.id}
                className={`solitaireCard ${item.faceUp ? "faceUp" : "faceDown"} ${selected?.type === "tableau" && selected.column === columnIndex && selected.index === index ? "selected" : ""}`}
                style={{ top: index * 31 }}
                onClick={(event) => {
                  event.stopPropagation();
                  tapTableau(columnIndex, index);
                }}
                aria-label={
                  item.faceUp
                    ? `${rankLabel(item.rank)} ${item.suit}`
                    : "Carta boca abajo"
                }
              >
                {item.faceUp ? (
                  <>
                    <b className={isRed(item.suit) ? "red" : ""}>
                      {rankLabel(item.rank)}
                    </b>
                    <span className={isRed(item.suit) ? "red" : ""}>
                      {item.suit}
                    </span>
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
