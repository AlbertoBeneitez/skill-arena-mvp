"use client";

/**
 * Deterministic 2048 implementation for Skill Arena.
 *
 * Core move/merge semantics are adapted from Gabriele Cirulli's 2048
 * (MIT, Copyright 2014 Gabriele Cirulli). The original project uses
 * Math.random() for new tiles; Skill Arena replaces that with a seeded,
 * precomputed event stream so the same seed + input sequence always replays
 * identically.
 *
 * Original source: https://github.com/gabrielecirulli/2048
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameResult } from "@/lib/types";
import { createRng } from "@/lib/deterministic/seeded";
import { gameTone, haptic } from "@/lib/gameFeedback";

type Props = {
  active: boolean;
  targetScore: number;
  seed: string;
  onFinish: (result: GameResult) => void;
};

type Dir = "up" | "right" | "down" | "left";
type Grid = number[][];
type SpawnEvent = { value: 2 | 4; selector: number };

const SIZE = 4;

function emptyGrid(): Grid {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

function cloneGrid(grid: Grid): Grid {
  return grid.map((row) => [...row]);
}

function available(grid: Grid) {
  const cells: Array<{ row: number; col: number }> = [];
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if (!grid[row][col]) cells.push({ row, col });
    }
  }
  return cells;
}

function buildEvents(seed: string) {
  const rng = createRng(`${seed}:2048-events`);
  return Array.from({ length: 1600 }, () => ({
    value: rng.nextInt(10) < 9 ? 2 : 4,
    selector: rng.nextInt(1_000_000),
  })) as SpawnEvent[];
}

function addSpawn(grid: Grid, event: SpawnEvent) {
  const cells = available(grid);
  if (!cells.length) return false;
  const index = Math.floor((event.selector / 1_000_000) * cells.length);
  const cell = cells[Math.min(cells.length - 1, index)];
  grid[cell.row][cell.col] = event.value;
  return true;
}

function collapseLine(values: number[]) {
  const compact = values.filter(Boolean);
  const result: number[] = [];
  let gained = 0;

  for (let index = 0; index < compact.length; index += 1) {
    const value = compact[index];
    if (compact[index + 1] === value) {
      const merged = value * 2;
      result.push(merged);
      gained += merged;
      index += 1;
    } else {
      result.push(value);
    }
  }

  while (result.length < SIZE) result.push(0);
  return { result, gained };
}

function gridsEqual(a: Grid, b: Grid) {
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if (a[row][col] !== b[row][col]) return false;
    }
  }
  return true;
}

function moveGrid(grid: Grid, direction: Dir) {
  const next = emptyGrid();
  let gained = 0;

  for (let index = 0; index < SIZE; index += 1) {
    let line: number[];

    if (direction === "left" || direction === "right") {
      line = [...grid[index]];
      if (direction === "right") line.reverse();
    } else {
      line = Array.from({ length: SIZE }, (_, row) => grid[row][index]);
      if (direction === "down") line.reverse();
    }

    const collapsed = collapseLine(line);
    gained += collapsed.gained;
    let placed = collapsed.result;
    if (direction === "right" || direction === "down") {
      placed = [...placed].reverse();
    }

    if (direction === "left" || direction === "right") {
      next[index] = placed;
    } else {
      for (let row = 0; row < SIZE; row += 1) {
        next[row][index] = placed[row];
      }
    }
  }

  return {
    grid: next,
    gained,
    moved: !gridsEqual(grid, next),
  };
}

function hasMoves(grid: Grid) {
  if (available(grid).length) return true;

  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const value = grid[row][col];
      if (row + 1 < SIZE && grid[row + 1][col] === value) return true;
      if (col + 1 < SIZE && grid[row][col + 1] === value) return true;
    }
  }

  return false;
}

function tileStyle(value: number) {
  if (!value) return { bg: "rgba(255,255,255,.08)", fg: "transparent" };
  const palette: Record<number, [string, string]> = {
    2: ["#e8e0cf", "#514a41"],
    4: ["#e5d2a8", "#514a41"],
    8: ["#f0a65a", "#fff"],
    16: ["#ec8051", "#fff"],
    32: ["#e96557", "#fff"],
    64: ["#dd4b42", "#fff"],
    128: ["#e0bc55", "#fff"],
    256: ["#d9a93c", "#fff"],
    512: ["#c7932f", "#fff"],
    1024: ["#aa7adf", "#fff"],
    2048: ["#7b63d6", "#fff"],
  };
  const [bg, fg] = palette[value] ?? ["#425fbd", "#fff"];
  return { bg, fg };
}

export default function Merge2048({
  active,
  targetScore,
  seed,
  onFinish,
}: Props) {
  const events = useMemo(() => buildEvents(seed), [seed]);
  const [grid, setGrid] = useState<Grid>(() => emptyGrid());
  const [score, setScore] = useState(0);
  const startRef = useRef(0);
  const runningRef = useRef(false);
  const eventIndexRef = useRef(0);
  const scoreRef = useRef(0);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);

  const finish = useCallback(
    (won: boolean) => {
      if (!runningRef.current) return;
      runningRef.current = false;
      gameTone(won ? "win" : "bad");
      haptic(won ? [18, 30, 46] : 24);
      onFinish({
        won,
        score: scoreRef.current,
        timeMs: Math.round(performance.now() - startRef.current),
      });
    },
    [onFinish]
  );

  useEffect(() => {
    if (!active) return;

    const next = emptyGrid();
    eventIndexRef.current = 0;
    addSpawn(next, events[eventIndexRef.current++]);
    addSpawn(next, events[eventIndexRef.current++]);

    scoreRef.current = 0;
    setScore(0);
    setGrid(next);
    runningRef.current = true;
    startRef.current = performance.now();

    return () => {
      runningRef.current = false;
    };
  }, [active, events]);

  function move(direction: Dir) {
    if (!runningRef.current) return;

    setGrid((current) => {
      const result = moveGrid(current, direction);
      if (!result.moved) {
        haptic(2);
        return current;
      }

      const next = cloneGrid(result.grid);
      addSpawn(next, events[eventIndexRef.current % events.length]);
      eventIndexRef.current += 1;

      const nextScore = scoreRef.current + result.gained;
      scoreRef.current = nextScore;
      setScore(nextScore);

      if (result.gained > 0) {
        gameTone("good");
        haptic(4);
      } else {
        gameTone("tap");
        haptic(2);
      }

      if (nextScore >= targetScore) {
        window.queueMicrotask(() => finish(true));
      } else if (!hasMoves(next)) {
        window.queueMicrotask(() => finish(false));
      }

      return next;
    });
  }

  function endPointer(x: number, y: number) {
    const start = pointerRef.current;
    pointerRef.current = null;
    if (!start) return;

    const dx = x - start.x;
    const dy = y - start.y;

    if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;

    if (Math.abs(dx) > Math.abs(dy)) {
      move(dx > 0 ? "right" : "left");
    } else {
      move(dy > 0 ? "down" : "up");
    }
  }

  return (
    <div className="detGameSurface merge2048Game">
      <div
        className="merge2048Board"
        onPointerDown={(event) => {
          pointerRef.current = { x: event.clientX, y: event.clientY };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerUp={(event) => {
          endPointer(event.clientX, event.clientY);
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
        onPointerCancel={() => {
          pointerRef.current = null;
        }}
      >
        {grid.flatMap((row, rowIndex) =>
          row.map((value, colIndex) => {
            const style = tileStyle(value);
            return (
              <div
                key={`${rowIndex}-${colIndex}`}
                className={`merge2048Tile ${value ? "filled" : ""}`}
                style={{
                  background: style.bg,
                  color: style.fg,
                }}
              >
                {value || ""}
              </div>
            );
          })
        )}
      </div>

      <div className="merge2048Controls">
        <button type="button" onClick={() => move("left")}>←</button>
        <button type="button" onClick={() => move("up")}>↑</button>
        <button type="button" onClick={() => move("down")}>↓</button>
        <button type="button" onClick={() => move("right")}>→</button>
      </div>

      <span className="merge2048Score" aria-label="Puntuación">
        {score}
      </span>
    </div>
  );
}
