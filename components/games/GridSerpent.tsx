"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import type { GameResult } from "@/lib/types";
import { createRng } from "@/lib/deterministic/seeded";
import { gameTone, haptic } from "@/lib/gameFeedback";

type Props = {
  active: boolean;
  targetScore: number;
  seed: string;
  onFinish: (result: GameResult) => void;
};

const COLS = 18;
const ROWS = 28;
const W = 360;
const H = 560;
const CELL_W = W / COLS;
const CELL_H = H / ROWS;

type Point = { x: number; y: number };
type Direction = "up" | "down" | "left" | "right";

function pointKey(point: Point) {
  return `${point.x},${point.y}`;
}

function opposite(a: Direction, b: Direction) {
  return (
    (a === "left" && b === "right") ||
    (a === "right" && b === "left") ||
    (a === "up" && b === "down") ||
    (a === "down" && b === "up")
  );
}

function createFoodSequence(seed: string) {
  const rng = createRng(seed);
  return Array.from({ length: 300 }, () => ({
    x: rng.nextInt(COLS),
    y: rng.nextInt(ROWS),
  }));
}

function nextFreeFood(
  sequence: Point[],
  startIndex: number,
  occupied: Set<string>
) {
  for (let offset = 0; offset < sequence.length; offset += 1) {
    const index = (startIndex + offset) % sequence.length;
    const candidate = sequence[index];
    if (!occupied.has(pointKey(candidate))) {
      return { food: candidate, index: index + 1 };
    }
  }

  return { food: { x: 1, y: 1 }, index: startIndex + 1 };
}

export default function GridSerpent({
  active,
  targetScore,
  seed,
  onFinish,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const foodSequence = useMemo(() => createFoodSequence(seed), [seed]);
  const startRef = useRef(0);
  const swipeRef = useRef<Point | null>(null);

  const stateRef = useRef({
    snake: [
      { x: 9, y: 15 },
      { x: 8, y: 15 },
      { x: 7, y: 15 },
    ] as Point[],
    direction: "right" as Direction,
    queue: [] as Direction[],
    food: { x: 13, y: 15 } as Point,
    foodIndex: 0,
    score: 0,
    running: false,
    lastStepAt: 0,
    stepMs: 145,
  });

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const s = stateRef.current;
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#102844");
    bg.addColorStop(1, "#081522");

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = "rgba(255,255,255,.045)";
    ctx.lineWidth = 1;

    for (let x = 0; x <= COLS; x += 1) {
      ctx.beginPath();
      ctx.moveTo(x * CELL_W, 0);
      ctx.lineTo(x * CELL_W, H);
      ctx.stroke();
    }

    for (let y = 0; y <= ROWS; y += 1) {
      ctx.beginPath();
      ctx.moveTo(0, y * CELL_H);
      ctx.lineTo(W, y * CELL_H);
      ctx.stroke();
    }

    ctx.fillStyle = "#ffd45d";
    ctx.shadowBlur = 14;
    ctx.shadowColor = "#ffd45d";
    ctx.beginPath();
    ctx.arc(
      (s.food.x + 0.5) * CELL_W,
      (s.food.y + 0.5) * CELL_H,
      Math.min(CELL_W, CELL_H) * 0.28,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.shadowBlur = 0;

    s.snake.forEach((part, index) => {
      ctx.fillStyle = index === 0 ? "#7ef2c2" : "#46c991";
      ctx.fillRect(
        part.x * CELL_W + 1.5,
        part.y * CELL_H + 1.5,
        CELL_W - 3,
        CELL_H - 3
      );
    });
  }, []);

  const finish = useCallback(
    (won: boolean) => {
      const s = stateRef.current;
      if (!s.running) return;

      s.running = false;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }

      gameTone(won ? "win" : "bad");
      haptic(won ? [18, 28, 45] : 30);

      onFinish({
        won,
        score: s.score,
        timeMs: Math.round(performance.now() - startRef.current),
      });
    },
    [onFinish]
  );

  const step = useCallback(() => {
    const s = stateRef.current;

    if (s.queue.length) {
      const next = s.queue.shift()!;
      if (!opposite(s.direction, next)) {
        s.direction = next;
      }
    }

    const head = { ...s.snake[0] };

    if (s.direction === "up") head.y -= 1;
    if (s.direction === "down") head.y += 1;
    if (s.direction === "left") head.x -= 1;
    if (s.direction === "right") head.x += 1;

    if (
      head.x < 0 ||
      head.x >= COLS ||
      head.y < 0 ||
      head.y >= ROWS ||
      s.snake.some(
        (part) => part.x === head.x && part.y === head.y
      )
    ) {
      finish(false);
      return;
    }

    s.snake.unshift(head);

    if (head.x === s.food.x && head.y === s.food.y) {
      s.score += 1000;
      s.stepMs = Math.max(76, s.stepMs - 5);

      const occupied = new Set(s.snake.map(pointKey));
      const next = nextFreeFood(
        foodSequence,
        s.foodIndex,
        occupied
      );

      s.food = next.food;
      s.foodIndex = next.index;

      gameTone("good");
      haptic(6);

      if (s.score >= targetScore) {
        finish(true);
        return;
      }
    } else {
      s.snake.pop();
    }
  }, [finish, foodSequence, targetScore]);

  const loop = useCallback(
    (now: number) => {
      const s = stateRef.current;
      if (!s.running) return;

      if (!s.lastStepAt) s.lastStepAt = now;

      while (
        now - s.lastStepAt >= s.stepMs &&
        s.running
      ) {
        step();
        s.lastStepAt += s.stepMs;
      }

      draw();

      if (s.running) {
        rafRef.current = requestAnimationFrame(loop);
      }
    },
    [draw, step]
  );

  useEffect(() => {
    if (!active) return;

    const initialSnake = [
      { x: 9, y: 15 },
      { x: 8, y: 15 },
      { x: 7, y: 15 },
    ];

    const occupied = new Set(initialSnake.map(pointKey));
    const first = nextFreeFood(foodSequence, 0, occupied);

    stateRef.current = {
      snake: initialSnake,
      direction: "right",
      queue: [],
      food: first.food,
      foodIndex: first.index,
      score: 0,
      running: true,
      lastStepAt: 0,
      stepMs: 145,
    };

    startRef.current = performance.now();
    draw();
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      stateRef.current.running = false;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [active, draw, foodSequence, loop]);

  function queueDirection(next: Direction) {
    const s = stateRef.current;
    if (!s.running) return;

    const reference =
      s.queue[s.queue.length - 1] ?? s.direction;

    if (
      next === reference ||
      opposite(reference, next) ||
      s.queue.length >= 2
    ) {
      return;
    }

    s.queue.push(next);
    haptic(2);
  }

  function pointFromEvent(clientX: number, clientY: number) {
    const rect = canvasRef.current?.getBoundingClientRect();

    if (!rect) return { x: clientX, y: clientY };

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }

  function processSwipe(point: Point) {
    const origin = swipeRef.current;
    if (!origin) return false;

    const dx = point.x - origin.x;
    const dy = point.y - origin.y;

    if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) {
      return false;
    }

    if (Math.abs(dx) > Math.abs(dy)) {
      queueDirection(dx > 0 ? "right" : "left");
    } else {
      queueDirection(dy > 0 ? "down" : "up");
    }

    // Reset the gesture origin so a single continuous swipe can buffer
    // another corner without waiting for pointer-up.
    swipeRef.current = point;
    return true;
  }

  return (
    <div className="detGameSurface serpentGame">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="gameCanvas deterministicCanvas"
        aria-label="Grid Serpent"
        onPointerDown={(event) => {
          swipeRef.current = pointFromEvent(
            event.clientX,
            event.clientY
          );
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!swipeRef.current) return;
          processSwipe(
            pointFromEvent(event.clientX, event.clientY)
          );
        }}
        onPointerUp={(event) => {
          if (swipeRef.current) {
            processSwipe(
              pointFromEvent(event.clientX, event.clientY)
            );
          }
          swipeRef.current = null;

          if (
            event.currentTarget.hasPointerCapture(event.pointerId)
          ) {
            event.currentTarget.releasePointerCapture(
              event.pointerId
            );
          }
        }}
        onPointerCancel={() => {
          swipeRef.current = null;
        }}
      />

      <div className="serpentDpad" aria-label="Controles">
        <button
          type="button"
          className="up"
          onPointerDown={(event) => {
            event.preventDefault();
            queueDirection("up");
          }}
          aria-label="Arriba"
        >
          ↑
        </button>
        <button
          type="button"
          className="left"
          onPointerDown={(event) => {
            event.preventDefault();
            queueDirection("left");
          }}
          aria-label="Izquierda"
        >
          ←
        </button>
        <button
          type="button"
          className="right"
          onPointerDown={(event) => {
            event.preventDefault();
            queueDirection("right");
          }}
          aria-label="Derecha"
        >
          →
        </button>
        <button
          type="button"
          className="down"
          onPointerDown={(event) => {
            event.preventDefault();
            queueDirection("down");
          }}
          aria-label="Abajo"
        >
          ↓
        </button>
      </div>
    </div>
  );
}
