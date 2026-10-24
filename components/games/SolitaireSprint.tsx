"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { canPlaceOnTableau, canPlaceOnFoundation, solitaireDestinations, type Card, type Source, type Suit, type SolitaireDestination } from "@/lib/solitaireMoves";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { GameResult } from "@/lib/types";
import { solitaireChallengeFor } from "@/lib/deterministic/challengeSets";
import { gameTone, haptic } from "@/lib/gameFeedback";

import { t as tx, formatNumber, useI18n } from "@/lib/i18n";
type Props = {
  active: boolean;
  targetScore: number;
  seed: string;
  onFinish: (result: GameResult) => void;
};

const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];

const SUIT_CLASS: Record<Suit, string> = { "♠": "suitSpade", "♥": "suitHeart", "♦": "suitDiamond", "♣": "suitClub" };
function suitClass(suit: Suit) {
  return SUIT_CLASS[suit];
}

function rankLabel(rank: number) {
  if (rank === 1) return "A";
  if (rank === 11) return "J";
  if (rank === 12) return "Q";
  if (rank === 13) return "K";
  return String(rank);
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

function formatTimer(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function SolitaireSprint({
  active,
  targetScore,
  seed,
  onFinish,
}: Props) {
  const initial = useMemo(() => dealVerifiedChallenge(seed), [seed]);
  useI18n();
  const [tableau, setTableau] = useState<Card[][]>(initial.tableau);
  const [stock, setStock] = useState<Card[]>(initial.stock);
  const [waste, setWaste] = useState<Card[]>([]);
  const [foundations, setFoundations] = useState<Card[][]>(
    Array.from({ length: 4 }, () => [])
  );
  const [selected, setSelected] = useState<Source>(null);
  const [score, setScore] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);

  const surfaceRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{source: Exclude<Source, null>; id: number; x: number; y: number; moved: boolean} | null>(null);
  const suppressClickRef = useRef(false);
  const [dragOffset, setDragOffset] = useState<{x: number; y: number} | null>(null);
  const scoreRef = useRef(0);
  const runningRef = useRef(false);
  const startRef = useRef(0);
  const solvingRef = useRef(false);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    const next = dealVerifiedChallenge(seed);
    setTableau(next.tableau);
    setStock(next.stock);
    setWaste([]);
    setFoundations(Array.from({ length: 4 }, () => []));
    setSelected(null);
    dragRef.current = null;
    setDragOffset(null);
    suppressClickRef.current = false;
    setScore(0);
    scoreRef.current = 0;
    setElapsedMs(0);
    runningRef.current = active;

    solvingRef.current = false;
    timersRef.current.forEach(window.clearTimeout);
    timersRef.current = [];
    if (active) startRef.current = performance.now();
    return () => {
      timersRef.current.forEach(window.clearTimeout);
      timersRef.current = [];
      solvingRef.current = false;
    };
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

  function finish(won: boolean, finalScore = scoreRef.current, frozenTimeMs?: number) {
    if (!runningRef.current && frozenTimeMs === undefined) return;
    runningRef.current = false;
    const timeMs = frozenTimeMs ?? Math.round(performance.now() - startRef.current);
    setElapsedMs(timeMs);
    gameTone(won ? "win" : "bad");
    haptic(won ? [18, 28, 45] : 26);
    onFinish({ won, score: finalScore, timeMs });
  }

  function addScore(delta: number) {
    const next = scoreRef.current + delta;
    scoreRef.current = next;
    setScore(next);

    if (next >= targetScore && !solvingRef.current) {
      finish(true, next);
    }

    return next;
  }

  function allTableauRevealed(nextTableau: Card[][]) {
    return nextTableau.every((column) =>
      column.every((item) => item.faceUp)
    );
  }

  function flyCard(card: Card, from: Element | null, to: Element | null) {
    if (!from || !to || typeof document === "undefined") return;
    const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
    const el = document.createElement("div");
    el.className = `solitaireFlight ${suitClass(card.suit)}`;
    el.innerHTML = `<b>${rankLabel(card.rank)}</b><span>${card.suit}</span>`;
    Object.assign(el.style, { left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${Math.max(a.height, 56)}px` });
    document.body.appendChild(el);
    const animation = el.animate?.(
      [
        { transform: "translate(0,0) scale(1) rotate(0deg)", opacity: 1 },
        { transform: `translate(${(b.left - a.left) / 2}px,${(b.top - a.top) / 2 - 26}px) scale(1.18) rotate(-6deg)`, opacity: 1, offset: 0.5 },
        { transform: `translate(${b.left - a.left}px,${b.top - a.top}px) scale(1) rotate(0deg)`, opacity: 1 },
      ],
      { duration: 380, easing: "cubic-bezier(.3,.7,.3,1)", fill: "forwards" },
    );
    if (animation) animation.onfinish = () => el.remove();
    else el.remove();
    timersRef.current.push(window.setTimeout(() => el.remove(), 700));
  }

  /**
   * Solved board: nothing is hidden any more, so the remaining cards fly to their
   * foundations one by one. The score and the time are frozen at the moment the
   * board was solved; the animation never changes the result.
   */
  function playSolvedAnimation(
    startTableau: Card[][],
    startStock: Card[],
    startWaste: Card[],
    startFoundations: Card[][],
  ) {
    const frozenScore = scoreRef.current,
      frozenTime = Math.round(performance.now() - startRef.current);
    solvingRef.current = true;
    runningRef.current = false;
    setSelected(null);
    gameTone("good");
    const t = startTableau.map(c => c.map(x => ({ ...x })));
    let st = startStock.map(x => ({ ...x })),
      w = startWaste.map(x => ({ ...x }));
    const f = startFoundations.map(p => p.map(x => ({ ...x })));
    let idle = 0, steps = 0;
    const done = () => {
      timersRef.current.push(window.setTimeout(() => {
        solvingRef.current = false;
        finish(frozenScore >= targetScore, frozenScore, frozenTime);
      }, 650));
    };
    const tick = () => {
      steps++;
      if (steps > 400 || idle > 60) return done();
      let moved: { card: Card; fromSel: string; foundation: number; apply: () => void } | null = null;
      const tryCard = (card: Card | undefined, fromSel: string, apply: () => void) => {
        if (!card || moved) return;
        const fi = f.findIndex((pile, index) => SUITS[index] === card.suit && canPlaceOnFoundation(card, pile));
        if (fi >= 0) moved = { card, fromSel, foundation: fi, apply };
      };
      tryCard(w[w.length - 1], "[data-solitaire-waste]", () => { w = w.slice(0, -1); });
      t.forEach((col, ci) => tryCard(col[col.length - 1], `[data-card-id="${col[col.length - 1]?.id}"]`, () => { col.pop(); }));
      if (moved) {
        idle = 0;
        const m = moved as { card: Card; fromSel: string; foundation: number; apply: () => void };
        flyCard(m.card, surfaceRef.current?.querySelector(m.fromSel) ?? null, surfaceRef.current?.querySelector(`[data-solitaire-destination="foundation-${m.foundation}"]`) ?? null);
        m.apply();
        f[m.foundation].push({ ...m.card, faceUp: true });
        timersRef.current.push(window.setTimeout(() => {
          setTableau(t.map(c => c.map(x => ({ ...x }))));
          setWaste([...w]);
          setFoundations(f.map(p => p.map(x => ({ ...x }))));
          gameTone("tap");
        }, 330));
        if (f.reduce((n, p) => n + p.length, 0) === 52) return done();
      } else {
        idle++;
        if (st.length) {
          const drawn = { ...st[st.length - 1], faceUp: true };
          st = st.slice(0, -1);
          w = [...w, drawn];
          setStock([...st]);
          setWaste([...w]);
        } else if (w.length) {
          st = [...w].reverse().map(x => ({ ...x, faceUp: false }));
          w = [];
          setStock([...st]);
          setWaste([]);
        } else return done();
      }
      timersRef.current.push(window.setTimeout(tick, moved ? 170 : 60));
    };
    timersRef.current.push(window.setTimeout(tick, 350));
  }

  function finishWhenTableauIsOpen(nextTableau: Card[][], nextFoundations = foundations, nextWaste = waste) {
    if (
      runningRef.current &&
      allTableauRevealed(nextTableau)
    ) {
      // Natural end condition for a score-setting attempt: once there are no
      // hidden tableau cards left, the challenge has produced its result.
      playSolvedAnimation(nextTableau, stock, nextWaste, nextFoundations);
      return true;
    }
    return false;
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

  function moveSelectedToTableau(column: number, source = selected) {
    if (!source || !runningRef.current || (source.type === "tableau" && source.column === column)) return false;
    if (!solitaireDestinations(source, tableau, waste, foundations).some(d => d.type === "tableau" && d.index === column)) return false;
    const moving = sourceCards(source);
    if (!moving.length) return false;

    const targetColumn = tableau[column];
    const target = targetColumn[targetColumn.length - 1];

    if (!canPlaceOnTableau(moving[0], target)) return false;

    const nextTableau = tableau.map((cards) =>
      cards.map((item) => ({ ...item }))
    );

    removeSource(source, nextTableau);
    nextTableau[column].push(...moving.map((item) => ({ ...item })));

    setTableau(nextTableau);
    setSelected(null);
    addScore(40);
    if (!finishWhenTableauIsOpen(nextTableau, foundations, source.type === "waste" ? waste.slice(0, -1) : waste)) {
      gameTone("tap");
      haptic(3);
    }
    return true;
  }

  function moveSelectedToFoundation(foundationIndex: number, source = selected) {
    if (!source || !runningRef.current) return false;
    if (!solitaireDestinations(source, tableau, waste, foundations).some(d => d.type === "foundation" && d.index === foundationIndex)) return false;
    const moving = sourceCards(source);
    if (moving.length !== 1) return false;

    const selectedCard = moving[0];

    if (
      source.type === "tableau" &&
      source.index !== tableau[source.column].length - 1
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

    removeSource(source, nextTableau);
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
      finish(false, finalScore);
    } else {
      finishWhenTableauIsOpen(nextTableau, nextFoundations, source.type === "waste" ? waste.slice(0, -1) : waste);
    }

    return true;
  }

  function moveTo(source: Exclude<Source, null>, destination: SolitaireDestination) {
    return destination.type === "foundation" ? moveSelectedToFoundation(destination.index, source) : moveSelectedToTableau(destination.index, source);
  }
  function predictMove(source: Exclude<Source, null>) {
    // Only Aces and cards that go to the foundations move on their own; every
    // other move needs a second tap (or a drag) on the destination.
    const destination = solitaireDestinations(source, tableau, waste, foundations).find(d => d.type === "foundation");
    return destination ? moveTo(source, destination) : false;
  }
  function tapWaste() {
    if (!waste.length || !runningRef.current) return;
    if (!predictMove({type: "waste"})) setSelected({type: "waste"});
  }
  function tapTableau(column: number, index: number) {
    if (!runningRef.current || !tableau[column][index]?.faceUp) return;
    if (selected && moveSelectedToTableau(column)) return;
    const source = {type: "tableau" as const, column, index};
    if (!predictMove(source)) setSelected(source);
  }
  function tapEmptyColumn(column: number) {
    if (selected) moveSelectedToTableau(column);
  }
  function cancelDrag() {
    dragRef.current = null;
    setDragOffset(null);
  }
  useEffect(() => {
    window.addEventListener("blur", cancelDrag);
    window.addEventListener("resize", cancelDrag);
    return () => { window.removeEventListener("blur", cancelDrag); window.removeEventListener("resize", cancelDrag); };
  }, []);
  function startDrag(event: ReactPointerEvent<HTMLButtonElement>, source: Exclude<Source, null>) {
    if (!runningRef.current || event.button !== 0 || !sourceCards(source)[0]?.faceUp) return;
    suppressClickRef.current = false;
    dragRef.current = {source, id: event.pointerId, x: event.clientX, y: event.clientY, moved: false};
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function continueDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    const x = event.clientX - drag.x, y = event.clientY - drag.y;
    if (Math.hypot(x, y) > 7) drag.moved = true;
    if (drag.moved) { setSelected(drag.source); setDragOffset({x, y}); }
  }
  function endDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    const moved = drag.moved || Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 7;
    suppressClickRef.current = moved;
    cancelDrag();
    if (!moved) return;
    const destinations = solitaireDestinations(drag.source, tableau, waste, foundations);
    let best: SolitaireDestination | null = null, distance = 65;
    for (const destination of destinations) {
      const element = surfaceRef.current?.querySelector<HTMLElement>(`[data-solitaire-destination="${destination.type}-${destination.index}"]`);
      if (!element) continue;
      const rect = element.getBoundingClientRect();
      const dx = Math.max(rect.left - event.clientX, 0, event.clientX - rect.right);
      const dy = Math.max(rect.top - event.clientY, 0, event.clientY - rect.bottom);
      const gap = Math.hypot(dx, dy);
      if (gap < distance) { best = destination; distance = gap; }
    }
    if (best) moveTo(drag.source, best);
    else setSelected(drag.source);
  }
  function clickCard(action: () => void) {
    if (suppressClickRef.current) { suppressClickRef.current = false; return; }
    action();
  }
  const destinations = solitaireDestinations(selected, tableau, waste, foundations);
  const suggested = (type: SolitaireDestination["type"], index: number) => destinations.some(d => d.type === type && d.index === index);
  return (
    <div ref={surfaceRef} className="detGameSurface solitaireSprint" onPointerCancel={cancelDrag} onLostPointerCapture={cancelDrag}>
      <div className="solitaireTimer" aria-label={tx("solitaire.time")}>
        {formatTimer(elapsedMs)}
      </div>

      <div className="solitaireTopRow">
        <button
          type="button"
          className="solitairePile stock"
          onClick={drawStock}
          aria-label={tx("solitaire.stock")}
        >
          {stock.length ? "▰" : waste.length ? "↻" : ""}
        </button>

        <button
          type="button"
          className={`solitairePile waste ${selected?.type === "waste" ? "selected" : ""}`}
          data-solitaire-waste=""
          onClick={() => clickCard(tapWaste)}
          onPointerDown={event => startDrag(event, {type: "waste"})}
          onPointerMove={continueDrag}
          onPointerUp={endDrag}
          style={selected?.type === "waste" && dragOffset ? {transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)`, zIndex: 30} : undefined}
          aria-label={tx("solitaire.waste")}
        >
          {waste.length ? (
            <>
              <b className={suitClass(waste[waste.length - 1].suit)}>
                {rankLabel(waste[waste.length - 1].rank)}
              </b>
              <span className={suitClass(waste[waste.length - 1].suit)}>
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
                className={`solitairePile foundation ${suggested("foundation", index) ? "validDestination" : ""}`}
                data-solitaire-destination={`foundation-${index}`}
                onClick={() => moveSelectedToFoundation(index)}
                aria-label={tx("solitaire.foundation", { suit })}
              >
                {top ? (
                  <>
                    <b className={suitClass(top.suit)}>
                      {rankLabel(top.rank)}
                    </b>
                    <span className={suitClass(top.suit)}>
                      {top.suit}
                    </span>
                  </>
                ) : (
                  <span className={`ghostSuit ${suitClass(suit)}`}>
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
            className={`solitaireColumn ${suggested("tableau", columnIndex) ? "validDestination" : ""}`}
            data-solitaire-destination={`tableau-${columnIndex}`}
            onClick={() => {
              if (!column.length) tapEmptyColumn(columnIndex);
            }}
          >
            {column.map((item, index) => (
              <button
                type="button"
                key={item.id}
                data-card-id={item.id}
                className={`solitaireCard ${item.faceUp ? `faceUp ${suitClass(item.suit)}` : "faceDown"} ${selected?.type === "tableau" && selected.column === columnIndex && index >= selected.index ? "selected" : ""}`}
                style={{ top: index * 31, ...(dragOffset && selected?.type === "tableau" && selected.column === columnIndex && index >= selected.index ? {transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)`, zIndex: 30 + index} : {}) }}
                onPointerDown={event => startDrag(event, {type: "tableau", column: columnIndex, index})}
                onPointerMove={continueDrag}
                onPointerUp={endDrag}
                onClick={(event) => {
                  event.stopPropagation();
                  clickCard(() => tapTableau(columnIndex, index));
                }}
                aria-label={
                  item.faceUp
                    ? `${rankLabel(item.rank)} ${item.suit}`
                    : tx("solitaire.faceDown")
                }
              >
                {item.faceUp ? (
                  <>
                    <b className={suitClass(item.suit)}>
                      {rankLabel(item.rank)}
                    </b>
                    <span className={suitClass(item.suit)}>
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
