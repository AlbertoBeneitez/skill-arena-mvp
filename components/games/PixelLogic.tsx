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

const SIZE = 10;

function buildPuzzle(seed: string) {
  const rng = createRng(seed);
  const grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));

  // Generate a symmetric, moderately dense deterministic pattern.
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < Math.ceil(SIZE / 2); col += 1) {
      const value = rng.nextInt(100) < 42;
      grid[row][col] = value;
      grid[row][SIZE - 1 - col] = value;
    }
  }

  // Guarantee useful structure and non-empty clue lines.
  for (let row = 0; row < SIZE; row += 1) {
    if (!grid[row].some(Boolean)) {
      const col = (row * 3 + 1) % SIZE;
      grid[row][col] = true;
    }
  }

  return grid;
}

function cluesFor(line: boolean[]) {
  const clues: number[] = [];
  let run = 0;

  for (const cell of line) {
    if (cell) run += 1;
    else if (run) {
      clues.push(run);
      run = 0;
    }
  }
  if (run) clues.push(run);
  return clues.length ? clues : [0];
}

export default function PixelLogic({
  active,
  targetScore,
  seed,
  onFinish,
}: Props) {
  const solution = useMemo(() => buildPuzzle(seed), [seed]);
  const rowClues = useMemo(() => solution.map(cluesFor), [solution]);
  const colClues = useMemo(
    () =>
      Array.from({ length: SIZE }, (_, col) =>
        cluesFor(solution.map((row) => row[col]))
      ),
    [solution]
  );

  const [filled, setFilled] = useState<Set<number>>(new Set());
  const [errors, setErrors] = useState<Set<number>>(new Set());
  const runningRef = useRef(false);
  const startRef = useRef(0);

  useEffect(() => {
    if (!active) {
      runningRef.current = false;
      return;
    }
    setFilled(new Set());
    setErrors(new Set());
    runningRef.current = true;
    startRef.current = performance.now();
  }, [active, seed]);

  const totalFilled = solution.flat().filter(Boolean).length;

  function finish(won: boolean, correct: number) {
    if (!runningRef.current) return;
    runningRef.current = false;
    const score = Math.max(0, correct * 260 - errors.size * 120);
    gameTone(won ? "win" : "bad");
    haptic(won ? [18, 25, 48] : 25);
    onFinish({
      won,
      score,
      timeMs: Math.round(performance.now() - startRef.current),
    });
  }

  function toggle(index: number) {
    if (!runningRef.current) return;

    const row = Math.floor(index / SIZE);
    const col = index % SIZE;
    const shouldFill = solution[row][col];

    if (!shouldFill) {
      const nextErrors = new Set(errors);
      nextErrors.add(index);
      setErrors(nextErrors);
      gameTone("bad");
      haptic(12);
      window.setTimeout(() => {
        setErrors((current) => {
          const next = new Set(current);
          next.delete(index);
          return next;
        });
      }, 330);
      return;
    }

    const nextFilled = new Set(filled);
    if (nextFilled.has(index)) nextFilled.delete(index);
    else nextFilled.add(index);

    setFilled(nextFilled);
    gameTone("tap");
    haptic(3);

    const correct = nextFilled.size;
    const score = correct * 260 - errors.size * 120;

    if (correct === totalFilled || score >= targetScore) {
      finish(true, correct);
    }
  }

  return (
    <div className="detGameSurface nonogramGame">
      <div className="nonogramLayout">
        <div className="nonogramCorner" />
        <div className="nonogramTopClues">
          {colClues.map((clues, col) => (
            <div key={col}>
              {clues.map((clue, index) => (
                <span key={index}>{clue}</span>
              ))}
            </div>
          ))}
        </div>

        <div className="nonogramSideClues">
          {rowClues.map((clues, row) => (
            <div key={row}>
              {clues.map((clue, index) => (
                <span key={index}>{clue}</span>
              ))}
            </div>
          ))}
        </div>

        <div className="nonogramBoard" aria-label="Pixel Logic">
          {solution.flatMap((_, row) =>
            Array.from({ length: SIZE }, (_, col) => {
              const index = row * SIZE + col;
              return (
                <button
                  key={index}
                  type="button"
                  className={`nonogramCell ${filled.has(index) ? "filled" : ""} ${errors.has(index) ? "error" : ""}`}
                  onClick={() => toggle(index)}
                  aria-label={`Fila ${row + 1}, columna ${col + 1}`}
                />
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
