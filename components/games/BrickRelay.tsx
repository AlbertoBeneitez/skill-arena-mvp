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

type Brick = { x: number; y: number; w: number; h: number; alive: boolean };

const W = 390;
const H = 620;
const DT = 1 / 120;
const PADDLE_Y = 570;
const PADDLE_W = 88;
const BALL_R = 8;

function createBricks(seed: string) {
  const rng = createRng(seed);
  const rows = 7;
  const cols = 7;
  const gap = 5;
  const margin = 18;
  const width = (W - margin * 2 - gap * (cols - 1)) / cols;
  const bricks: Brick[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      // Same deterministic pattern for both players.
      const skip = rng.nextInt(10) === 0 && row > 1;
      if (skip) continue;
      bricks.push({
        x: margin + col * (width + gap),
        y: 70 + row * 30,
        w: width,
        h: 20,
        alive: true,
      });
    }
  }
  return bricks;
}

export default function BrickRelay({
  active,
  targetScore,
  seed,
  onFinish,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef(0);
  const pointerXRef = useRef(W / 2);
  const bricksTemplate = useMemo(() => createBricks(seed), [seed]);

  const stateRef = useRef({
    paddleX: W / 2 - PADDLE_W / 2,
    ballX: W / 2,
    ballY: PADDLE_Y - 18,
    vx: 178,
    vy: -230,
    bricks: bricksTemplate.map((brick) => ({ ...brick })),
    score: 0,
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
      haptic(won ? [18, 28, 45] : 28);
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
    s.paddleX += (pointerXRef.current - PADDLE_W / 2 - s.paddleX) * 0.22;
    s.paddleX = Math.max(0, Math.min(W - PADDLE_W, s.paddleX));

    s.ballX += s.vx * DT;
    s.ballY += s.vy * DT;

    if (s.ballX - BALL_R <= 0 && s.vx < 0) {
      s.ballX = BALL_R;
      s.vx = Math.abs(s.vx);
    }
    if (s.ballX + BALL_R >= W && s.vx > 0) {
      s.ballX = W - BALL_R;
      s.vx = -Math.abs(s.vx);
    }
    if (s.ballY - BALL_R <= 0 && s.vy < 0) {
      s.ballY = BALL_R;
      s.vy = Math.abs(s.vy);
    }

    if (
      s.ballY + BALL_R >= PADDLE_Y &&
      s.ballY - BALL_R <= PADDLE_Y + 14 &&
      s.ballX >= s.paddleX &&
      s.ballX <= s.paddleX + PADDLE_W &&
      s.vy > 0
    ) {
      const relative =
        (s.ballX - (s.paddleX + PADDLE_W / 2)) / (PADDLE_W / 2);
      const speed = Math.min(380, Math.hypot(s.vx, s.vy) + 7);
      const angle = relative * 0.85;
      s.vx = Math.sin(angle) * speed;
      s.vy = -Math.cos(angle) * speed;
      s.ballY = PADDLE_Y - BALL_R - 1;
      gameTone("tap");
      haptic(2);
    }

    for (const brick of s.bricks) {
      if (!brick.alive) continue;
      if (
        s.ballX + BALL_R < brick.x ||
        s.ballX - BALL_R > brick.x + brick.w ||
        s.ballY + BALL_R < brick.y ||
        s.ballY - BALL_R > brick.y + brick.h
      ) {
        continue;
      }

      brick.alive = false;
      s.score += 220;
      s.vy *= -1;
      gameTone("good");
      haptic(4);

      if (s.score >= targetScore || s.bricks.every((item) => !item.alive)) {
        finish(true);
        return;
      }
      break;
    }

    if (s.ballY - BALL_R > H) {
      finish(false);
    }
  }, [finish, targetScore]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const s = stateRef.current;

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#151b3b");
    bg.addColorStop(1, "#080c1b");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    for (const brick of s.bricks) {
      if (!brick.alive) continue;
      ctx.fillStyle = "#5e8fe8";
      ctx.fillRect(brick.x, brick.y, brick.w, brick.h);
      ctx.fillStyle = "rgba(255,255,255,.28)";
      ctx.fillRect(brick.x + 3, brick.y + 3, brick.w - 6, 4);
    }

    ctx.fillStyle = "#6de0ef";
    ctx.fillRect(s.paddleX, PADDLE_Y, PADDLE_W, 14);

    ctx.fillStyle = "#ffd864";
    ctx.shadowBlur = 12;
    ctx.shadowColor = "#ffd864";
    ctx.beginPath();
    ctx.arc(s.ballX, s.ballY, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }, []);

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
      paddleX: W / 2 - PADDLE_W / 2,
      ballX: W / 2,
      ballY: PADDLE_Y - 18,
      vx: 178,
      vy: -230,
      bricks: bricksTemplate.map((brick) => ({ ...brick })),
      score: 0,
      running: true,
      last: 0,
      acc: 0,
    };
    pointerXRef.current = W / 2;
    startRef.current = performance.now();
    draw();
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      stateRef.current.running = false;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [active, bricksTemplate, draw, loop]);

  return (
    <div className="detGameSurface canvasDetGame">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="gameCanvas deterministicCanvas"
        aria-label="Brick Relay"
        onPointerDown={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          pointerXRef.current =
            ((event.clientX - rect.left) / rect.width) * W;
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!event.buttons) return;
          const rect = event.currentTarget.getBoundingClientRect();
          pointerXRef.current =
            ((event.clientX - rect.left) / rect.width) * W;
        }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
      />
    </div>
  );
}
