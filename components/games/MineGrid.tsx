"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GameResult } from "@/lib/types";
import { mineChallengeFor } from "@/lib/deterministic/challengeSets";
import { gameTone, haptic } from "@/lib/gameFeedback";

type Props = {
  active: boolean;
  targetScore: number;
  seed: string;
  onFinish: (result: GameResult) => void;
};

const MINES = 24;

function neighbors(index: number, cols: number, rows: number) {
  const row = Math.floor(index / cols);
  const col = index % cols;
  const cells: number[] = [];

  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (!dx && !dy) continue;

      const rr = row + dy;
      const cc = col + dx;

      if (rr >= 0 && rr < rows && cc >= 0 && cc < cols) {
        cells.push(rr * cols + cc);
      }
    }
  }

  return cells;
}

function boardFromMines(
  mineIndexes: readonly number[],
  cols: number,
  rows: number
) {
  const mineSet = new Set(mineIndexes);
  const values = Array(cols * rows).fill(0);

  for (const mine of mineSet) values[mine] = -1;

  for (let index = 0; index < values.length; index += 1) {
    if (values[index] === -1) continue;

    values[index] = neighbors(index, cols, rows).filter((cell) =>
      mineSet.has(cell)
    ).length;
  }

  return values;
}

function revealFlood(
  values: number[],
  revealed: Set<number>,
  start: number,
  cols: number,
  rows: number
) {
  const queue = [start];

  while (queue.length) {
    const current = queue.shift()!;

    if (
      revealed.has(current) ||
      values[current] === -1
    ) {
      continue;
    }

    revealed.add(current);

    if (values[current] === 0) {
      for (const cell of neighbors(current, cols, rows)) {
        if (
          !revealed.has(cell) &&
          values[cell] !== -1
        ) {
          queue.push(cell);
        }
      }
    }
  }
}

export default function MineGrid({
  active,
  targetScore,
  seed,
  onFinish,
}: Props) {
  const challenge = useMemo(
    () => mineChallengeFor(seed),
    [seed]
  );

  const board = useMemo(
    () =>
      boardFromMines(
        challenge.mineIndexes,
        challenge.cols,
        challenge.rows
      ),
    [challenge]
  );

  const [revealed, setRevealed] = useState<Set<number>>(
    new Set()
  );
  const [flagged, setFlagged] = useState<Set<number>>(
    new Set()
  );
  const [started, setStarted] = useState(false);
  const [flagMode, setFlagMode] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);

  const runningRef = useRef(false);
  const startRef = useRef(0);

  useEffect(() => {
    setRevealed(new Set());
    setFlagged(new Set());
    setStarted(false);
    setFlagMode(false);
    setElapsedMs(0);

    runningRef.current = active;

    if (active) {
      startRef.current = performance.now();
    }

    const timer = window.setInterval(() => {
      if (runningRef.current) {
        setElapsedMs(
          Math.round(performance.now() - startRef.current)
        );
      }
    }, 200);

    return () => {
      window.clearInterval(timer);
      runningRef.current = false;
    };
  }, [active, seed]);

  function finish(
    won: boolean,
    nextRevealed: Set<number>
  ) {
    if (!runningRef.current) return;

    runningRef.current = false;

    const safeCount = [...nextRevealed].filter(
      (index) => board[index] !== -1
    ).length;

    const score =
      safeCount * 160 +
      flagged.size * 18 +
      challenge.deductionRounds * 40;

    gameTone(won ? "win" : "bad");
    haptic(won ? [18, 25, 45] : 28);

    onFinish({
      won,
      score,
      timeMs: Math.round(
        performance.now() - startRef.current
      ),
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

    // Both competitors must start from the same validated opening.
    if (
      !started &&
      index !== challenge.startIndex
    ) {
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

    revealFlood(
      board,
      next,
      index,
      challenge.cols,
      challenge.rows
    );

    setRevealed(next);

    const safeCount = [...next].filter(
      (cell) => board[cell] !== -1
    ).length;

    const currentScore =
      safeCount * 160 +
      flagged.size * 18 +
      challenge.deductionRounds * 40;

    if (currentScore >= targetScore) {
      finish(true, next);
      return;
    }

    if (
      safeCount ===
      challenge.cols * challenge.rows - MINES
    ) {
      finish(false, next);
      return;
    }

    gameTone("tap");
    haptic(3);
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

    if (next.has(index)) {
      next.delete(index);
    } else if (next.size < MINES) {
      next.add(index);
    }

    setFlagged(next);
    haptic(3);
  }

  function interact(index: number) {
    if (
      !started &&
      index === challenge.startIndex
    ) {
      reveal(index);
      return;
    }

    if (flagMode) {
      toggleFlag(index);
    } else {
      reveal(index);
    }
  }

  return (
    <div
      className="detGameSurface mineGridGame mineGridAdvanced"
      aria-label="Mine Grid"
    >
      <div className="gameTimerChip mineTimerChip">
        {String(Math.floor(elapsedMs / 60000)).padStart(2, "0")}:
        {String(Math.floor(elapsedMs / 1000) % 60).padStart(2, "0")}
      </div>
      <div
        className="mineGridBoard"
        style={{
          gridTemplateColumns: `repeat(${challenge.cols}, 1fr)`,
        }}
      >
        {board.map((value, index) => {
          const open = revealed.has(index);
          const isFlagged = flagged.has(index);
          const isStart =
            !started &&
            index === challenge.startIndex;

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
          <span aria-hidden="true">◆</span>
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
