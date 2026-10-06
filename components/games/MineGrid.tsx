"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GameResult } from "@/lib/types";
import { createRng } from "@/lib/deterministic/seeded";
import { gameTone, haptic } from "@/lib/gameFeedback";

type Props = {
  active: boolean;
  targetScore: number;
  seed: string;
  onFinish: (result: GameResult) => void;
};

const COLS = 8;
const ROWS = 10;
const MINES = 12;
const START_INDEX = 4 * COLS + 3;

function neighbors(index: number) {
  const row = Math.floor(index / COLS);
  const col = index % COLS;
  const cells: number[] = [];

  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (!dx && !dy) continue;
      const rr = row + dy;
      const cc = col + dx;
      if (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS) {
        cells.push(rr * COLS + cc);
      }
    }
  }

  return cells;
}

function boardFromMines(mineSet: Set<number>) {
  const values = Array(COLS * ROWS).fill(0);

  for (const mine of mineSet) values[mine] = -1;

  for (let index = 0; index < values.length; index += 1) {
    if (values[index] === -1) continue;
    values[index] = neighbors(index).filter((cell) => mineSet.has(cell)).length;
  }

  return values;
}

function revealFlood(
  values: number[],
  revealed: Set<number>,
  start: number
) {
  const queue = [start];

  while (queue.length) {
    const current = queue.shift()!;
    if (revealed.has(current) || values[current] === -1) continue;

    revealed.add(current);

    if (values[current] === 0) {
      for (const cell of neighbors(current)) {
        if (!revealed.has(cell) && values[cell] !== -1) queue.push(cell);
      }
    }
  }
}

/**
 * Solver restricted to standard local Minesweeper deductions:
 * 1) clue - flagged == unknown -> all unknown are mines
 * 2) clue == flagged -> all remaining unknown are safe
 *
 * A generated board is accepted only if these rules solve every safe cell
 * from the fixed shared opening square. No guessing is required.
 */
function isGuessFree(values: number[]) {
  const revealed = new Set<number>();
  const flagged = new Set<number>();
  revealFlood(values, revealed, START_INDEX);

  let progress = true;

  while (progress) {
    progress = false;

    for (const index of [...revealed]) {
      const clue = values[index];
      if (clue <= 0) continue;

      const around = neighbors(index);
      const unknown = around.filter(
        (cell) => !revealed.has(cell) && !flagged.has(cell)
      );
      const flaggedAround = around.filter((cell) => flagged.has(cell)).length;

      if (!unknown.length) continue;

      if (clue - flaggedAround === unknown.length) {
        for (const cell of unknown) {
          if (!flagged.has(cell)) {
            flagged.add(cell);
            progress = true;
          }
        }
      } else if (clue === flaggedAround) {
        for (const cell of unknown) {
          const before = revealed.size;
          revealFlood(values, revealed, cell);
          if (revealed.size > before) progress = true;
        }
      }
    }
  }

  return revealed.size === COLS * ROWS - MINES;
}

function createGuessFreeBoard(seed: string) {
  const reserved = new Set([START_INDEX, ...neighbors(START_INDEX)]);

  for (let attempt = 0; attempt < 1500; attempt += 1) {
    const rng = createRng(`${seed}:guess-free:${attempt}`);
    const mineSet = new Set<number>();

    while (mineSet.size < MINES) {
      const index = rng.nextInt(COLS * ROWS);
      if (!reserved.has(index)) mineSet.add(index);
    }

    const values = boardFromMines(mineSet);
    if (values[START_INDEX] === 0 && isGuessFree(values)) {
      return values;
    }
  }

  // Deterministic fallback: mines concentrated along the outer edge.
  const fallbackMines = new Set<number>();
  for (let index = 0; index < COLS * ROWS && fallbackMines.size < MINES; index += 1) {
    const row = Math.floor(index / COLS);
    const col = index % COLS;
    if ((row === 0 || row === ROWS - 1 || col === COLS - 1) && !reserved.has(index)) {
      fallbackMines.add(index);
    }
  }
  return boardFromMines(fallbackMines);
}

export default function MineGrid({
  active,
  targetScore: _targetScore,
  seed,
  onFinish,
}: Props) {
  const board = useMemo(() => createGuessFreeBoard(seed), [seed]);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [flagged, setFlagged] = useState<Set<number>>(new Set());
  const [started, setStarted] = useState(false);
  const [flagMode, setFlagMode] = useState(false);
  const runningRef = useRef(false);
  const startRef = useRef(0);

  useEffect(() => {
    setRevealed(new Set());
    setFlagged(new Set());
    setStarted(false);
    setFlagMode(false);
    runningRef.current = active;
    if (active) startRef.current = performance.now();

    return () => {
      runningRef.current = false;
    };
  }, [active, seed]);

  function finish(won: boolean, nextRevealed: Set<number>) {
    if (!runningRef.current) return;

    runningRef.current = false;
    const safeCount = [...nextRevealed].filter(
      (index) => board[index] !== -1
    ).length;
    const score = safeCount * 180;

    gameTone(won ? "win" : "bad");
    haptic(won ? [18, 25, 45] : 28);

    onFinish({
      won,
      score,
      timeMs: Math.round(performance.now() - startRef.current),
    });
  }

  function reveal(index: number) {
    if (
      !runningRef.current ||
      revealed.has(index) ||
      flagged.has(index)
    ) {
      return;
    }

    // Competitive fairness: both players must begin from the same opening.
    if (!started && index !== START_INDEX) {
      haptic(4);
      return;
    }

    const next = new Set(revealed);

    if (!started) setStarted(true);

    if (board[index] === -1) {
      next.add(index);
      setRevealed(next);
      finish(false, next);
      return;
    }

    revealFlood(board, next, index);
    setRevealed(next);

    const safeCount = [...next].filter(
      (cell) => board[cell] !== -1
    ).length;

    if (safeCount === COLS * ROWS - MINES) {
      finish(true, next);
    } else {
      gameTone("tap");
      haptic(3);
    }
  }

  function toggleFlag(index: number) {
    if (
      !runningRef.current ||
      !started ||
      revealed.has(index)
    ) {
      return;
    }

    const next = new Set(flagged);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setFlagged(next);
    haptic(3);
  }

  function interact(index: number) {
    if (!started && index === START_INDEX) {
      reveal(index);
      return;
    }

    if (flagMode) toggleFlag(index);
    else reveal(index);
  }

  return (
    <div className="detGameSurface mineGridGame" aria-label="Mine Grid">
      <div className="mineGridBoard">
        {board.map((value, index) => {
          const open = revealed.has(index);
          const isFlagged = flagged.has(index);
          const isStart = !started && index === START_INDEX;

          return (
            <button
              key={index}
              type="button"
              className={`mineCell ${open ? "open" : ""} ${open && value === -1 ? "mine" : ""} ${isStart ? "startCell" : ""} ${isFlagged ? "flagged" : ""}`}
              onClick={() => interact(index)}
              aria-label={
                isStart
                  ? "Casilla inicial obligatoria"
                  : open
                    ? value === -1
                      ? "Mina"
                      : `Casilla ${value}`
                    : isFlagged
                      ? "Marcada"
                      : "Casilla oculta"
              }
            >
              {isFlagged
                ? "⚑"
                : open
                  ? value === -1
                    ? "✦"
                    : value || ""
                  : isStart
                    ? "●"
                    : ""}
            </button>
          );
        })}
      </div>

      <div className="mineModeControl">
        {!started ? (
          <span>EMPIEZA EN EL PUNTO MARCADO</span>
        ) : (
          <>
            <button
              type="button"
              className={!flagMode ? "active" : ""}
              onClick={() => setFlagMode(false)}
            >
              ABRIR
            </button>
            <button
              type="button"
              className={flagMode ? "active" : ""}
              onClick={() => setFlagMode(true)}
            >
              MARCAR
            </button>
          </>
        )}
      </div>
    </div>
  );
}
