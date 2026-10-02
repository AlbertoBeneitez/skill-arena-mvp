"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameResult } from "@/lib/types";

type Props = { active: boolean; onFinish: (result: GameResult) => void };
type Brick = { x: number; y: number; w: number; h: number; alive: boolean };

const W = 390;
const H = 620;
const DT = 1 / 120;
const PADDLE_Y = 560;
const PADDLE_W = 92;
const PADDLE_H = 14;
const BALL_R = 7;

function makeBricks(): Brick[] {
  const bricks: Brick[] = [];
  const cols = 6;
  const rows = 4;
  const gap = 6;
  const margin = 18;
  const bw = (W - margin * 2 - gap * (cols - 1)) / cols;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      bricks.push({ x: margin + c * (bw + gap), y: 74 + r * 32, w: bw, h: 20, alive: true });
    }
  }
  return bricks;
}

export default function BrickBreaker({ active, onFinish }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const finishRef = useRef(onFinish);
  const state = useRef({
    ballX: W / 2, ballY: 480, vx: 165, vy: -245,
    paddleX: W / 2 - PADDLE_W / 2,
    bricks: makeBricks(), running: false, ticks: 0, last: 0, acc: 0, score: 0,
  });
  const [running, setRunning] = useState(false);

  useEffect(() => { finishRef.current = onFinish; }, [onFinish]);

  const end = useCallback((won: boolean) => {
    const s = state.current;
    if (!s.running) return;
    s.running = false;
    setRunning(false);
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    const timeMs = Math.round((s.ticks * 1000) / 120);
    const score = won ? s.score + Math.max(0, 5000 - Math.round(timeMs / 10)) : s.score;
    finishRef.current({ won, score, timeMs });
  }, []);

  const step = useCallback(() => {
    const s = state.current;
    s.ticks += 1;
    s.ballX += s.vx * DT;
    s.ballY += s.vy * DT;

    if (s.ballX - BALL_R <= 0 && s.vx < 0) { s.ballX = BALL_R; s.vx *= -1; }
    if (s.ballX + BALL_R >= W && s.vx > 0) { s.ballX = W - BALL_R; s.vx *= -1; }
    if (s.ballY - BALL_R <= 0 && s.vy < 0) { s.ballY = BALL_R; s.vy *= -1; }

    if (
      s.vy > 0 &&
      s.ballY + BALL_R >= PADDLE_Y &&
      s.ballY - BALL_R <= PADDLE_Y + PADDLE_H &&
      s.ballX >= s.paddleX &&
      s.ballX <= s.paddleX + PADDLE_W
    ) {
      s.ballY = PADDLE_Y - BALL_R;
      const offset = (s.ballX - (s.paddleX + PADDLE_W / 2)) / (PADDLE_W / 2);
      const speed = Math.hypot(s.vx, s.vy);
      s.vx = speed * Math.max(-0.82, Math.min(0.82, offset));
      s.vy = -Math.sqrt(Math.max(1, speed * speed - s.vx * s.vx));
    }

    for (const b of s.bricks) {
      if (!b.alive) continue;
      if (
        s.ballX + BALL_R > b.x && s.ballX - BALL_R < b.x + b.w &&
        s.ballY + BALL_R > b.y && s.ballY - BALL_R < b.y + b.h
      ) {
        b.alive = false;
        s.score += 100;
        const left = Math.abs((s.ballX + BALL_R) - b.x);
        const right = Math.abs((b.x + b.w) - (s.ballX - BALL_R));
        const top = Math.abs((s.ballY + BALL_R) - b.y);
        const bottom = Math.abs((b.y + b.h) - (s.ballY - BALL_R));
        if (Math.min(left, right) < Math.min(top, bottom)) s.vx *= -1;
        else s.vy *= -1;
        break;
      }
    }

    if (s.bricks.every((b) => !b.alive)) end(true);
    else if (s.ballY - BALL_R > H) end(false);
  }, [end]);

  const draw = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const s = state.current;

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#09132a"); bg.addColorStop(1, "#1d0f35");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    s.bricks.forEach((b, i) => {
      if (!b.alive) return;
      ctx.fillStyle = ["#56c7ff", "#8d7cff", "#f06fd4", "#ffc857"][Math.floor(i / 6)];
      ctx.fillRect(b.x, b.y, b.w, b.h);
    });

    ctx.fillStyle = "#fff";
    ctx.fillRect(s.paddleX, PADDLE_Y, PADDLE_W, PADDLE_H);
    ctx.beginPath(); ctx.arc(s.ballX, s.ballY, BALL_R, 0, Math.PI * 2);
    ctx.fillStyle = "#7dffbd"; ctx.fill();

    ctx.fillStyle = "rgba(0,0,0,.42)"; ctx.fillRect(12, 12, 156, 34);
    ctx.fillStyle = "#fff"; ctx.font = "700 13px system-ui";
    ctx.fillText(`${s.score} pts · ${(s.ticks / 120).toFixed(1)}s`, 22, 34);
  }, []);

  const loop = useCallback((now: number) => {
    const s = state.current;
    if (!s.running) return;
    if (!s.last) s.last = now;
    s.acc += Math.min(0.05, (now - s.last) / 1000);
    s.last = now;
    while (s.acc >= DT && s.running) { step(); s.acc -= DT; }
    draw();
    if (s.running) rafRef.current = requestAnimationFrame(loop);
  }, [draw, step]);

  const start = useCallback(() => {
    state.current = { ballX: W / 2, ballY: 480, vx: 165, vy: -245, paddleX: W / 2 - PADDLE_W / 2, bricks: makeBricks(), running: true, ticks: 0, last: 0, acc: 0, score: 0 };
    setRunning(true);
    draw();
    rafRef.current = requestAnimationFrame(loop);
  }, [draw, loop]);

  useEffect(() => {
    if (active) start();
    return () => {
      state.current.running = false;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [active, start]);

  function movePaddle(clientX: number) {
    const c = canvasRef.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * W;
    state.current.paddleX = Math.max(0, Math.min(W - PADDLE_W, x - PADDLE_W / 2));
  }

  return (
    <div className="gameStage skillGameStage">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="gameCanvas"
        onPointerDown={(e) => movePaddle(e.clientX)}
        onPointerMove={(e) => { if (e.buttons || e.pointerType === "touch") movePaddle(e.clientX); }}
        aria-label="Brick Breaker"
      />
      <div className="gameRule">{running ? "Arrastra el dedo para mover la pala · patrón fijo" : "Resultado registrado"}</div>
    </div>
  );
}
