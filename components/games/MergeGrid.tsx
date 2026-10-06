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

type Direction = "left" | "right" | "up" | "down";
type Grid = number[][];

const SIZE = 4;

function emptyGrid(): Grid {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

function cloneGrid(grid: Grid) {
  return grid.map((row) => [...row]);
}

function collapseLine(line: number[]) {
  const values = line.filter(Boolean);
  const result: number[] = [];
  let gained = 0;

  for (let index = 0; index < values.length; index += 1) {
    if (values[index] === values[index + 1]) {
      const merged = values[index] * 2;
      result.push(merged);
      gained += merged;
      index += 1;
    } else {
      result.push(values[index]);
    }
  }

  while (result.length < SIZE) result.push(0);
  return { line: result, gained };
}

function moveGrid(grid: Grid, direction: Direction) {
  const next = cloneGrid(grid);
  let gained = 0;

  for (let index = 0; index < SIZE; index += 1) {
    let line =
      direction === "left" || direction === "right"
        ? [...grid[index]]
        : grid.map((row) => row[index]);

    if (direction === "right" || direction === "down") {
      line.reverse();
    }

    const collapsed = collapseLine(line);
    let result = collapsed.line;

    if (direction === "right" || direction === "down") {
      result = [...result].reverse();
    }

    gained += collapsed.gained;

    for (let offset = 0; offset < SIZE; offset += 1) {
      if (direction === "left" || direction === "right") {
        next[index][offset] = result[offset];
      } else {
        next[offset][index] = result[offset];
      }
    }
  }

  return {
    grid: next,
    gained,
    changed: JSON.stringify(next) !== JSON.stringify(grid),
  };
}

function canMove(grid: Grid) {
  if (grid.flat().some((value) => value === 0)) return true;
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const value = grid[row][col];
      if (row + 1 < SIZE && grid[row + 1][col] === value) return true;
      if (col + 1 < SIZE && grid[row][col + 1] === value) return true;
    }
  }
  return false;
}

function tileClass(value: number) {
  if (value >= 512) return "tileHigh";
  if (value >= 64) return "tileMid";
  return "tileLow";
}

export default function MergeGrid({
  active,
  targetScore,
  seed,
  onFinish,
}: Props) {
  const rngRef = useRef(createRng(seed));
  const sequenceRef = useRef<{ pos: number; value: number }[]>([]);
  const sequenceIndexRef = useRef(0);
  const startRef = useRef(0);
  const runningRef = useRef(false);
  const swipeRef = useRef<{ x: number; y: number } | null>(null);

  const initialSequence = useMemo(() => {
    const rng = createRng(seed);
    return Array.from({ length: 256 }, () => ({
      pos: rng.nextInt(SIZE * SIZE),
      value: rng.nextInt(10) === 0 ? 4 : 2,
    }));
  }, [seed]);

  const [grid, setGrid] = useState<Grid>(emptyGrid());
  const [score, setScore] = useState(0);

  function spawn(current: Grid) {
    const next = cloneGrid(current);
    const empty = next
      .flatMap((row, rowIndex) =>
        row.map((value, colIndex) => ({ value, index: rowIndex * SIZE + colIndex }))
      )
      .filter((item) => item.value === 0)
      .map((item) => item.index);

    if (!empty.length) return next;

    let sequenceItem = sequenceRef.current[sequenceIndexRef.current % sequenceRef.current.length];
    sequenceIndexRef.current += 1;

    // The sequence defines the preferred slot; if occupied, walk forward
    // deterministically to the next empty slot.
    let selected = sequenceItem.pos;
    for (let offset = 0; offset < SIZE * SIZE; offset += 1) {
      const candidate = (sequenceItem.pos + offset) % (SIZE * SIZE);
      if (next[Math.floor(candidate / SIZE)][candidate % SIZE] === 0) {
        selected = candidate;
        break;
      }
    }

    next[Math.floor(selected / SIZE)][selected % SIZE] = sequenceItem.value;
    return next;
  }

  useEffect(() => {
    rngRef.current = createRng(seed);
    sequenceRef.current = initialSequence;
    sequenceIndexRef.current = 0;
    runningRef.current = active;

    if (!active) return;

    let next = emptyGrid();
    next = spawn(next);
    next = spawn(next);
    setGrid(next);
    setScore(0);
    startRef.current = performance.now();

    return () => {
      runningRef.current = false;
    };
  }, [active, initialSequence, seed]);

  function finish(won: boolean, finalScore: number) {
    if (!runningRef.current) return;
    runningRef.current = false;
    gameTone(won ? "win" : "bad");
    haptic(won ? [18, 28, 45] : 30);
    onFinish({
      won,
      score: finalScore,
      timeMs: Math.round(performance.now() - startRef.current),
    });
  }

  function move(direction: Direction) {
    if (!runningRef.current) return;

    const moved = moveGrid(grid, direction);
    if (!moved.changed) {
      haptic(2);
      return;
    }

    const nextScore = score + moved.gained;
    const nextGrid = spawn(moved.grid);
    setGrid(nextGrid);
    setScore(nextScore);
    gameTone(moved.gained > 0 ? "good" : "tap");
    haptic(moved.gained > 0 ? 6 : 2);

    if (nextScore >= targetScore) {
      finish(true, nextScore);
    } else if (!canMove(nextGrid)) {
      finish(false, nextScore);
    }
  }

  return (
    <div className="detGameSurface mergeGridGame">
      <div
        className="mergeGridBoard"
        role="application"
        aria-label="Merge Grid"
        onPointerDown={(event) => {
          swipeRef.current = { x: event.clientX, y: event.clientY };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerUp={(event) => {
          if (!swipeRef.current) return;
          const dx = event.clientX - swipeRef.current.x;
          const dy = event.clientY - swipeRef.current.y;
          swipeRef.current = null;

          if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
          if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? "right" : "left");
          else move(dy > 0 ? "down" : "up");

          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
      >
        {grid.flatMap((row, rowIndex) =>
          row.map((value, colIndex) => (
            <div
              key={`${rowIndex}-${colIndex}`}
              className={`mergeTile ${value ? tileClass(value) : "empty"}`}
            >
              {value || ""}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
