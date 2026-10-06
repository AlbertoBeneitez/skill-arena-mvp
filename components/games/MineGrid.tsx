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

function createBoard(seed: string) {
  const rng = createRng(seed);
  const total = COLS * ROWS;
  const mineSet = new Set<number>();

  // Keep the top-left opening safe and identical for every player.
  const reserved = new Set([0, 1, COLS, COLS + 1]);

  while (mineSet.size < MINES) {
    const index = rng.nextInt(total);
    if (!reserved.has(index)) mineSet.add(index);
  }

  const values = Array(total).fill(0);
  for (const mine of mineSet) values[mine] = -1;

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const index = row * COLS + col;
      if (values[index] === -1) continue;

      let around = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (!dx && !dy) continue;
          const rr = row + dy;
          const cc = col + dx;
          if (
            rr >= 0 &&
            rr < ROWS &&
            cc >= 0 &&
            cc < COLS &&
            mineSet.has(rr * COLS + cc)
          ) {
            around += 1;
          }
        }
      }
      values[index] = around;
    }
  }

  return values;
}

export default function MineGrid({
  active,
  targetScore,
  seed,
  onFinish,
}: Props) {
  const board = useMemo(() => createBoard(seed), [seed]);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [running, setRunning] = useState(false);
  const startRef = useRef(0);

  useEffect(() => {
    if (!active) {
      setRunning(false);
      return;
    }
    setRevealed(new Set());
    setRunning(true);
    startRef.current = performance.now();
  }, [active, seed]);

  function finish(won: boolean, nextRevealed: Set<number>) {
    if (!running) return;
    setRunning(false);
    const safeCount = [...nextRevealed].filter((index) => board[index] !== -1).length;
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
    if (!running || revealed.has(index)) return;

    const next = new Set(revealed);

    if (board[index] === -1) {
      next.add(index);
      setRevealed(next);
      finish(false, next);
      return;
    }

    const queue = [index];
    while (queue.length) {
      const current = queue.shift()!;
      if (next.has(current) || board[current] === -1) continue;
      next.add(current);

      if (board[current] === 0) {
        const row = Math.floor(current / COLS);
        const col = current % COLS;
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            const rr = row + dy;
            const cc = col + dx;
            if (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS) {
              const candidate = rr * COLS + cc;
              if (!next.has(candidate) && board[candidate] !== -1) {
                queue.push(candidate);
              }
            }
          }
        }
      }
    }

    setRevealed(next);
    const safeCount = [...next].filter((cell) => board[cell] !== -1).length;
    const score = safeCount * 180;

    if (safeCount === COLS * ROWS - MINES || score >= targetScore) {
      finish(true, next);
    } else {
      gameTone("tap");
      haptic(3);
    }
  }

  return (
    <div className="detGameSurface mineGridGame" aria-label="Mine Grid">
      <div className="mineGridBoard">
        {board.map((value, index) => {
          const open = revealed.has(index);
          return (
            <button
              key={index}
              type="button"
              className={`mineCell ${open ? "open" : ""} ${open && value === -1 ? "mine" : ""}`}
              onClick={() => reveal(index)}
              aria-label={open ? (value === -1 ? "Mina" : `Casilla ${value}`) : "Casilla oculta"}
            >
              {open ? (value === -1 ? "✦" : value || "") : ""}
            </button>
          );
        })}
      </div>
    </div>
  );
}
