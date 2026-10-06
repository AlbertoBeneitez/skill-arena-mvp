"use client";

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

type Bubble = {
  row: number;
  col: number;
  color: number;
};

const W = 390;
const H = 620;
const COLS = 9;
const R = 18;
const ROW_H = 31;
const COLORS = ["#5fd4e8", "#f2c35c", "#ed7d91", "#7ed58f", "#a983e8"];
const SHOOTER_X = W / 2;
const SHOOTER_Y = H - 46;
const DT = 1 / 120;

function centerFor(row: number, col: number) {
  const offset = row % 2 ? R : 0;
  return {
    x: 26 + offset + col * (R * 2 + 2),
    y: 42 + row * ROW_H,
  };
}

function neighbors(row: number, col: number) {
  const even = row % 2 === 0;
  const candidates = even
    ? [
        [row, col - 1],
        [row, col + 1],
        [row - 1, col - 1],
        [row - 1, col],
        [row + 1, col - 1],
        [row + 1, col],
      ]
    : [
        [row, col - 1],
        [row, col + 1],
        [row - 1, col],
        [row - 1, col + 1],
        [row + 1, col],
        [row + 1, col + 1],
      ];

  return candidates
    .filter(([rr, cc]) => rr >= 0 && cc >= 0 && cc < COLS)
    .map(([rr, cc]) => ({ row: rr, col: cc }));
}

function key(row: number, col: number) {
  return `${row},${col}`;
}

function createInitialBoard(seed: string) {
  const rng = createRng(`${seed}:board`);
  const bubbles: Bubble[] = [];

  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      if (row >= 3 && rng.nextInt(6) === 0) continue;
      bubbles.push({
        row,
        col,
        color: rng.nextInt(COLORS.length),
      });
    }
  }

  return bubbles;
}

function createQueue(seed: string) {
  const rng = createRng(`${seed}:queue`);
  return Array.from({ length: 500 }, () => rng.nextInt(COLORS.length));
}

function occupiedMap(bubbles: Bubble[]) {
  return new Map(bubbles.map((bubble) => [key(bubble.row, bubble.col), bubble]));
}

function connectedSame(
  start: Bubble,
  bubbles: Bubble[]
) {
  const map = occupiedMap(bubbles);
  const result: Bubble[] = [];
  const visited = new Set<string>();
  const queue = [start];

  while (queue.length) {
    const current = queue.shift()!;
    const currentKey = key(current.row, current.col);
    if (visited.has(currentKey)) continue;
    visited.add(currentKey);

    const actual = map.get(currentKey);
    if (!actual || actual.color !== start.color) continue;

    result.push(actual);

    for (const next of neighbors(actual.row, actual.col)) {
      if (!visited.has(key(next.row, next.col))) {
        queue.push({
          row: next.row,
          col: next.col,
          color: start.color,
        });
      }
    }
  }

  return result;
}

function removeFloating(bubbles: Bubble[]) {
  const map = occupiedMap(bubbles);
  const connected = new Set<string>();
  const queue = bubbles
    .filter((bubble) => bubble.row === 0)
    .map((bubble) => ({ row: bubble.row, col: bubble.col }));

  while (queue.length) {
    const current = queue.shift()!;
    const currentKey = key(current.row, current.col);
    if (connected.has(currentKey)) continue;
    if (!map.has(currentKey)) continue;
    connected.add(currentKey);

    for (const next of neighbors(current.row, current.col)) {
      if (!connected.has(key(next.row, next.col))) {
        queue.push(next);
      }
    }
  }

  return bubbles.filter((bubble) =>
    connected.has(key(bubble.row, bubble.col))
  );
}

function nearestCell(x: number, y: number) {
  let best = { row: 0, col: 0, dist: Number.POSITIVE_INFINITY };

  for (let row = 0; row < 18; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const center = centerFor(row, col);
      const dist = Math.hypot(center.x - x, center.y - y);
      if (dist < best.dist) best = { row, col, dist };
    }
  }

  return { row: best.row, col: best.col };
}

export default function OrbBurst({
  active,
  targetScore,
  seed,
  onFinish,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef(0);
  const queue = useMemo(() => createQueue(seed), [seed]);

  const [nextColor, setNextColor] = useState(queue[1]);
  const [aimAngle, setAimAngle] = useState(-Math.PI / 2);

  const stateRef = useRef({
    bubbles: createInitialBoard(seed),
    currentColor: queue[0],
    queueIndex: 1,
    shot: null as null | {
      x: number;
      y: number;
      vx: number;
      vy: number;
      color: number;
    },
    score: 0,
    misses: 0,
    running: false,
    last: 0,
    acc: 0,
  });

  const finish = useCallback(
    (won: boolean) => {
      const s = stateRef.current;
      if (!s.running) return;

      s.running = false;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);

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

  function advanceQueue() {
    const s = stateRef.current;
    s.currentColor = queue[s.queueIndex % queue.length];
    s.queueIndex += 1;
    setNextColor(queue[s.queueIndex % queue.length]);
  }

  const addPressureRow = useCallback(() => {
    const s = stateRef.current;
    const rng = createRng(
      `${seed}:pressure:${Math.floor(s.queueIndex / 4)}`
    );

    s.bubbles = s.bubbles.map((bubble) => ({
      ...bubble,
      row: bubble.row + 1,
    }));

    for (let col = 0; col < COLS; col += 1) {
      if (rng.nextInt(8) === 0) continue;
      s.bubbles.push({
        row: 0,
        col,
        color: rng.nextInt(COLORS.length),
      });
    }

    s.misses = 0;
  }, [seed]);

  const settleShot = useCallback(
    (x: number, y: number, color: number) => {
      const s = stateRef.current;
      const map = occupiedMap(s.bubbles);
      let cell = nearestCell(x, y);

      if (map.has(key(cell.row, cell.col))) {
        const alternatives = neighbors(cell.row, cell.col)
          .filter((candidate) => !map.has(key(candidate.row, candidate.col)))
          .sort((a, b) => {
            const ca = centerFor(a.row, a.col);
            const cb = centerFor(b.row, b.col);
            return (
              Math.hypot(ca.x - x, ca.y - y) -
              Math.hypot(cb.x - x, cb.y - y)
            );
          });

        if (alternatives[0]) cell = alternatives[0];
      }

      const placed: Bubble = {
        row: cell.row,
        col: cell.col,
        color,
      };

      s.bubbles.push(placed);

      const cluster = connectedSame(placed, s.bubbles);

      if (cluster.length >= 3) {
        const removeKeys = new Set(
          cluster.map((bubble) => key(bubble.row, bubble.col))
        );

        const before = s.bubbles.length;
        s.bubbles = s.bubbles.filter(
          (bubble) => !removeKeys.has(key(bubble.row, bubble.col))
        );
        s.bubbles = removeFloating(s.bubbles);
        const removed = before - s.bubbles.length;

        s.score += removed * 280 + Math.max(0, removed - 3) * 90;
        s.misses = 0;
        gameTone("good");
        haptic([4, 12, 4]);

        if (s.score >= targetScore || s.bubbles.length === 0) {
          finish(true);
          return;
        }
      } else {
        s.misses += 1;
        gameTone("tap");

        if (s.misses >= 4) {
          addPressureRow();
        }
      }

      if (
        s.bubbles.some(
          (bubble) => centerFor(bubble.row, bubble.col).y >= H - 118
        )
      ) {
        finish(false);
        return;
      }

      advanceQueue();
    },
    [addPressureRow, finish, targetScore]
  );

  const step = useCallback(() => {
    const s = stateRef.current;
    const shot = s.shot;
    if (!shot) return;

    shot.x += shot.vx * DT;
    shot.y += shot.vy * DT;

    if (shot.x - R <= 0 && shot.vx < 0) {
      shot.x = R;
      shot.vx = Math.abs(shot.vx);
    }

    if (shot.x + R >= W && shot.vx > 0) {
      shot.x = W - R;
      shot.vx = -Math.abs(shot.vx);
    }

    let collided = shot.y - R <= 24;

    if (!collided) {
      for (const bubble of s.bubbles) {
        const center = centerFor(bubble.row, bubble.col);
        if (
          Math.hypot(center.x - shot.x, center.y - shot.y) <= R * 1.92
        ) {
          collided = true;
          break;
        }
      }
    }

    if (collided) {
      const { x, y, color } = shot;
      s.shot = null;
      settleShot(x, y, color);
    }
  }, [settleShot]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const s = stateRef.current;

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#19244a");
    bg.addColorStop(1, "#0a1025");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    for (const bubble of s.bubbles) {
      const center = centerFor(bubble.row, bubble.col);
      ctx.fillStyle = COLORS[bubble.color];
      ctx.shadowBlur = 7;
      ctx.shadowColor = COLORS[bubble.color];
      ctx.beginPath();
      ctx.arc(center.x, center.y, R - 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255,255,255,.36)";
      ctx.beginPath();
      ctx.arc(center.x - 6, center.y - 7, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    if (s.shot) {
      ctx.fillStyle = COLORS[s.shot.color];
      ctx.beginPath();
      ctx.arc(s.shot.x, s.shot.y, R - 2, 0, Math.PI * 2);
      ctx.fill();
    }

    const lineLength = 88;
    ctx.strokeStyle = "rgba(255,255,255,.35)";
    ctx.setLineDash([5, 6]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(SHOOTER_X, SHOOTER_Y);
    ctx.lineTo(
      SHOOTER_X + Math.cos(aimAngle) * lineLength,
      SHOOTER_Y + Math.sin(aimAngle) * lineLength
    );
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = COLORS[s.currentColor];
    ctx.beginPath();
    ctx.arc(SHOOTER_X, SHOOTER_Y, R, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,.16)";
    ctx.beginPath();
    ctx.arc(W - 34, H - 36, 13, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = COLORS[nextColor];
    ctx.beginPath();
    ctx.arc(W - 34, H - 36, 10, 0, Math.PI * 2);
    ctx.fill();
  }, [aimAngle, nextColor]);

  const loop = useCallback(
    (now: number) => {
      const s = stateRef.current;
      if (!s.running) return;
      if (!s.last) s.last = now;

      s.acc += Math.min(0.05, (now - s.last) / 1000);
      s.last = now;

      while (s.acc >= DT && s.running) {
        step();
        s.acc -= DT;
      }

      draw();
      if (s.running) rafRef.current = requestAnimationFrame(loop);
    },
    [draw, step]
  );

  useEffect(() => {
    if (!active) return;

    stateRef.current = {
      bubbles: createInitialBoard(seed),
      currentColor: queue[0],
      queueIndex: 1,
      shot: null,
      score: 0,
      misses: 0,
      running: true,
      last: 0,
      acc: 0,
    };

    setNextColor(queue[1]);
    setAimAngle(-Math.PI / 2);
    startRef.current = performance.now();
    draw();
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      stateRef.current.running = false;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [active, draw, loop, queue, seed]);

  function aimAt(clientX: number, clientY: number) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = ((clientX - rect.left) / rect.width) * W;
    const y = ((clientY - rect.top) / rect.height) * H;

    let angle = Math.atan2(y - SHOOTER_Y, x - SHOOTER_X);
    angle = Math.max(-Math.PI + 0.22, Math.min(-0.22, angle));
    setAimAngle(angle);
  }

  function shoot() {
    const s = stateRef.current;
    if (!s.running || s.shot) return;

    const speed = 440;
    s.shot = {
      x: SHOOTER_X,
      y: SHOOTER_Y,
      vx: Math.cos(aimAngle) * speed,
      vy: Math.sin(aimAngle) * speed,
      color: s.currentColor,
    };

    gameTone("tap");
    haptic(3);
  }

  return (
    <div className="detGameSurface orbBurstGame">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="gameCanvas deterministicCanvas"
        aria-label="Orb Burst"
        onPointerDown={(event) => {
          aimAt(event.clientX, event.clientY);
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (event.buttons) aimAt(event.clientX, event.clientY);
        }}
        onPointerUp={(event) => {
          aimAt(event.clientX, event.clientY);
          shoot();

          if (
            event.currentTarget.hasPointerCapture(event.pointerId)
          ) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
      />
    </div>
  );
}
