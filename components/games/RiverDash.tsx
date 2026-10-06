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

type Direction = "up" | "down" | "left" | "right";
type LaneKind = "safe" | "road" | "river";

type Lane = {
  kind: LaneKind;
  direction: -1 | 1;
  speed: number;
  length: number;
  gap: number;
  phase: number;
};

const COLS = 9;
const ROWS = 13;
const W = 360;
const H = 572;
const CELL_W = W / COLS;
const CELL_H = H / ROWS;
const DT = 1 / 120;

function laneConfig(seed: string) {
  const rng = createRng(seed);
  const lanes: Lane[] = [];

  for (let row = 0; row < ROWS; row += 1) {
    if (row === 0 || row === 6 || row === ROWS - 1) {
      lanes.push({
        kind: "safe",
        direction: 1,
        speed: 0,
        length: 0,
        gap: 0,
        phase: 0,
      });
      continue;
    }

    const kind: LaneKind = row < 6 ? "river" : "road";
    lanes.push({
      kind,
      direction: rng.nextInt(2) === 0 ? -1 : 1,
      speed:
        kind === "river"
          ? 26 + rng.nextInt(22)
          : 42 + rng.nextInt(44),
      length:
        kind === "river"
          ? 72 + rng.nextInt(62)
          : 42 + rng.nextInt(38),
      gap:
        kind === "river"
          ? 34 + rng.nextInt(45)
          : 62 + rng.nextInt(75),
      phase: rng.nextInt(260),
    });
  }

  return lanes;
}

function wraps(value: number, period: number) {
  return ((value % period) + period) % period;
}

export default function RiverDash({
  active,
  targetScore,
  seed,
  onFinish,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef(0);
  const swipeRef = useRef<{ x: number; y: number } | null>(null);
  const lanes = useMemo(() => laneConfig(seed), [seed]);

  const stateRef = useRef({
    col: 4,
    row: ROWS - 1,
    x: 4 * CELL_W + CELL_W / 2,
    score: 0,
    crossings: 0,
    ticks: 0,
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

  function laneObjectRects(row: number, ticks: number) {
    const lane = lanes[row];
    if (lane.kind === "safe") return [];

    const speedScale = 1 + stateRef.current.crossings * 0.09;
    const period = lane.length + lane.gap;
    const travel =
      lane.direction *
      ((ticks / 120) * lane.speed * speedScale);

    const rects: Array<{ x: number; w: number }> = [];

    for (let index = -2; index < 8; index += 1) {
      const x =
        wraps(
          lane.phase +
            index * period +
            travel,
          W + period
        ) - period;

      rects.push({ x, w: lane.length });
    }

    return rects;
  }

  const evaluateLane = useCallback(() => {
    const s = stateRef.current;
    const lane = lanes[s.row];

    if (lane.kind === "safe") return;

    const rects = laneObjectRects(s.row, s.ticks);
    const playerLeft = s.x - 11;
    const playerRight = s.x + 11;

    const overlap = rects.find(
      (rect) =>
        playerRight >= rect.x &&
        playerLeft <= rect.x + rect.w
    );

    if (lane.kind === "road") {
      if (overlap) finish(false);
      return;
    }

    if (!overlap) {
      finish(false);
      return;
    }

    const speedScale = 1 + s.crossings * 0.09;
    s.x +=
      lane.direction *
      lane.speed *
      speedScale *
      DT;

    if (s.x < 6 || s.x > W - 6) {
      finish(false);
    }
  }, [finish, lanes]);

  const step = useCallback(() => {
    const s = stateRef.current;
    if (!s.running) return;

    s.ticks += 1;
    evaluateLane();
  }, [evaluateLane]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const s = stateRef.current;

    for (let row = 0; row < ROWS; row += 1) {
      const lane = lanes[row];
      const y = row * CELL_H;

      ctx.fillStyle =
        lane.kind === "safe"
          ? "#204f36"
          : lane.kind === "river"
            ? "#123e66"
            : "#303846";
      ctx.fillRect(0, y, W, CELL_H);

      if (lane.kind === "safe") {
        ctx.fillStyle = "rgba(115,217,137,.17)";
        for (let x = 8; x < W; x += 28) {
          ctx.fillRect(x, y + 8, 12, 3);
        }
      } else {
        const rects = laneObjectRects(row, s.ticks);

        for (const rect of rects) {
          if (lane.kind === "road") {
            ctx.fillStyle = row % 2 ? "#e76d78" : "#e5b951";
            ctx.fillRect(
              rect.x,
              y + 10,
              rect.w,
              CELL_H - 20
            );
            ctx.fillStyle = "rgba(255,255,255,.35)";
            ctx.fillRect(
              rect.x + 8,
              y + 14,
              Math.max(10, rect.w * 0.28),
              5
            );
          } else {
            ctx.fillStyle = row % 2 ? "#8b633c" : "#6e563a";
            ctx.fillRect(
              rect.x,
              y + 12,
              rect.w,
              CELL_H - 24
            );
            ctx.fillStyle = "rgba(220,190,120,.22)";
            ctx.fillRect(
              rect.x + 6,
              y + 17,
              Math.max(8, rect.w - 12),
              4
            );
          }
        }
      }
    }

    ctx.fillStyle = "#81f0c5";
    ctx.shadowBlur = 10;
    ctx.shadowColor = "#81f0c5";
    ctx.beginPath();
    ctx.moveTo(s.x, s.row * CELL_H + 8);
    ctx.lineTo(s.x + 13, s.row * CELL_H + CELL_H / 2);
    ctx.lineTo(s.x, s.row * CELL_H + CELL_H - 8);
    ctx.lineTo(s.x - 13, s.row * CELL_H + CELL_H / 2);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
  }, [lanes]);

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
      col: 4,
      row: ROWS - 1,
      x: 4 * CELL_W + CELL_W / 2,
      score: 0,
      crossings: 0,
      ticks: 0,
      running: true,
      last: 0,
      acc: 0,
    };

    startRef.current = performance.now();
    draw();
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      stateRef.current.running = false;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [active, draw, loop]);

  function move(direction: Direction) {
    const s = stateRef.current;
    if (!s.running) return;

    if (direction === "left") {
      s.col = Math.max(0, s.col - 1);
      s.x = s.col * CELL_W + CELL_W / 2;
    } else if (direction === "right") {
      s.col = Math.min(COLS - 1, s.col + 1);
      s.x = s.col * CELL_W + CELL_W / 2;
    } else if (direction === "up") {
      s.row = Math.max(0, s.row - 1);
      s.x = s.col * CELL_W + CELL_W / 2;
    } else {
      s.row = Math.min(ROWS - 1, s.row + 1);
      s.x = s.col * CELL_W + CELL_W / 2;
    }

    haptic(3);

    if (s.row === 0) {
      s.crossings += 1;
      s.score += 1400 + s.crossings * 180;
      gameTone("good");
      haptic([4, 14, 4]);

      if (s.score >= targetScore) {
        finish(true);
        return;
      }

      s.row = ROWS - 1;
      s.col = 4;
      s.x = s.col * CELL_W + CELL_W / 2;
    }

    evaluateLane();
  }

  function processSwipe(x: number, y: number) {
    const origin = swipeRef.current;
    if (!origin) return;

    const dx = x - origin.x;
    const dy = y - origin.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;

    if (Math.abs(dx) > Math.abs(dy)) {
      move(dx > 0 ? "right" : "left");
    } else {
      move(dy > 0 ? "down" : "up");
    }

    swipeRef.current = { x, y };
  }

  return (
    <div className="detGameSurface riverDashGame">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="gameCanvas deterministicCanvas"
        aria-label="River Dash"
        onPointerDown={(event) => {
          swipeRef.current = {
            x: event.clientX,
            y: event.clientY,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) =>
          processSwipe(event.clientX, event.clientY)
        }
        onPointerUp={(event) => {
          processSwipe(event.clientX, event.clientY);
          swipeRef.current = null;
          if (
            event.currentTarget.hasPointerCapture(event.pointerId)
          ) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
      />

      <div className="riverDpad">
        <button type="button" className="up" onPointerDown={() => move("up")}>↑</button>
        <button type="button" className="left" onPointerDown={() => move("left")}>←</button>
        <button type="button" className="right" onPointerDown={() => move("right")}>→</button>
        <button type="button" className="down" onPointerDown={() => move("down")}>↓</button>
      </div>
    </div>
  );
}
