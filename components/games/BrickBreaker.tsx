"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameResult } from "@/lib/types";
import { gameTone, haptic } from "@/lib/gameFeedback";

type Props = { active: boolean; onFinish: (result: GameResult) => void };
type Brick = { x: number; y: number; w: number; h: number; alive: boolean; row: number };

const W = 390;
const H = 620;
const DT = 1 / 120;
const PADDLE_Y = 554;
const PADDLE_W = 94;
const PADDLE_H = 14;
const BALL_R = 7;

const WAVES = [
  ["111111", "111111", "011110"],
  ["101101", "111111", "111111", "011110"],
  ["111111", "110011", "111111", "101101"],
] as const;

function makeBricks(wave: number): Brick[] {
  const rows = WAVES[wave];
  const bricks: Brick[] = [];
  const cols = 6;
  const gap = 6;
  const margin = 18;
  const bw = (W - margin * 2 - gap * (cols - 1)) / cols;
  rows.forEach((pattern, r) => {
    [...pattern].forEach((cell, c) => {
      if (cell !== "1") return;
      bricks.push({
        x: margin + c * (bw + gap),
        y: 80 + r * 34,
        w: bw,
        h: 21,
        alive: true,
        row: r,
      });
    });
  });
  return bricks;
}

function initialBall(wave: number) {
  const speeds = [
    { vx: 170, vy: -250 },
    { vx: -182, vy: -266 },
    { vx: 195, vy: -282 },
  ];
  return { ballX: W / 2, ballY: 476, ...speeds[wave] };
}

export default function BrickBreaker({ active, onFinish }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const finishRef = useRef(onFinish);
  const state = useRef({
    ...initialBall(0),
    paddleX: W / 2 - PADDLE_W / 2,
    bricks: makeBricks(0),
    wave: 0,
    running: false,
    ticks: 0,
    last: 0,
    acc: 0,
    score: 0,
    combo: 0,
    bestCombo: 0,
    misses: 0,
    freezeTicks: 0,
  });
  const [hud, setHud] = useState({ wave: 0, score: 0, combo: 0, bestCombo: 0, misses: 0, remaining: 0 });

  useEffect(() => { finishRef.current = onFinish; }, [onFinish]);

  const resetBall = useCallback((wave: number) => {
    const s = state.current;
    const ball = initialBall(wave);
    s.ballX = ball.ballX;
    s.ballY = ball.ballY;
    s.vx = ball.vx;
    s.vy = ball.vy;
    s.freezeTicks = 72;
  }, []);

  const finish = useCallback(() => {
    const s = state.current;
    if (!s.running) return;
    s.running = false;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    const timeMs = Math.round((s.ticks * 1000) / 120);
    const score = Math.max(1000, s.score + Math.max(0, 3600 - Math.round(timeMs / 18)) - s.misses * 240);
    gameTone("win");
    haptic([20, 30, 60]);
    finishRef.current({ won: true, score, timeMs });
  }, []);

  const nextWave = useCallback(() => {
    const s = state.current;
    if (s.wave >= WAVES.length - 1) {
      finish();
      return;
    }
    s.wave += 1;
    s.bricks = makeBricks(s.wave);
    s.combo = 0;
    resetBall(s.wave);
    gameTone("good");
    haptic([12, 18, 20]);
  }, [finish, resetBall]);

  const step = useCallback(() => {
    const s = state.current;
    s.ticks += 1;

    if (s.freezeTicks > 0) {
      s.freezeTicks -= 1;
      return;
    }

    s.ballX += s.vx * DT;
    s.ballY += s.vy * DT;

    if (s.ballX - BALL_R <= 0 && s.vx < 0) {
      s.ballX = BALL_R;
      s.vx *= -1;
    }
    if (s.ballX + BALL_R >= W && s.vx > 0) {
      s.ballX = W - BALL_R;
      s.vx *= -1;
    }
    if (s.ballY - BALL_R <= 0 && s.vy < 0) {
      s.ballY = BALL_R;
      s.vy *= -1;
    }

    if (
      s.vy > 0 &&
      s.ballY + BALL_R >= PADDLE_Y &&
      s.ballY - BALL_R <= PADDLE_Y + PADDLE_H &&
      s.ballX >= s.paddleX &&
      s.ballX <= s.paddleX + PADDLE_W
    ) {
      s.ballY = PADDLE_Y - BALL_R;
      const offset = (s.ballX - (s.paddleX + PADDLE_W / 2)) / (PADDLE_W / 2);
      const speed = Math.min(355, Math.hypot(s.vx, s.vy) * 1.006);
      s.vx = speed * Math.max(-0.86, Math.min(0.86, offset));
      s.vy = -Math.sqrt(Math.max(1, speed * speed - s.vx * s.vx));
      gameTone("tap");
      haptic(4);
    }

    for (const brick of s.bricks) {
      if (!brick.alive) continue;
      if (
        s.ballX + BALL_R > brick.x &&
        s.ballX - BALL_R < brick.x + brick.w &&
        s.ballY + BALL_R > brick.y &&
        s.ballY - BALL_R < brick.y + brick.h
      ) {
        brick.alive = false;
        s.combo += 1;
        s.bestCombo = Math.max(s.bestCombo, s.combo);
        s.score += 120 + Math.min(12, s.combo) * 18;

        const left = Math.abs((s.ballX + BALL_R) - brick.x);
        const right = Math.abs((brick.x + brick.w) - (s.ballX - BALL_R));
        const top = Math.abs((s.ballY + BALL_R) - brick.y);
        const bottom = Math.abs((brick.y + brick.h) - (s.ballY - BALL_R));
        if (Math.min(left, right) < Math.min(top, bottom)) s.vx *= -1;
        else s.vy *= -1;

        gameTone(s.combo >= 8 ? "good" : "tap");
        if (s.combo % 5 === 0) haptic(9);
        break;
      }
    }

    if (s.bricks.every((brick) => !brick.alive)) {
      nextWave();
      return;
    }

    if (s.ballY - BALL_R > H) {
      s.misses += 1;
      s.combo = 0;
      s.score = Math.max(0, s.score - 160);
      gameTone("bad");
      haptic(25);
      resetBall(s.wave);
    }

    if (s.ticks % 5 === 0) {
      setHud({
        wave: s.wave,
        score: s.score,
        combo: s.combo,
        bestCombo: s.bestCombo,
        misses: s.misses,
        remaining: s.bricks.filter((brick) => brick.alive).length,
      });
    }
  }, [nextWave, resetBall]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const s = state.current;

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#071633");
    bg.addColorStop(.58, "#191442");
    bg.addColorStop(1, "#34133f");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = "rgba(108,177,255,.08)";
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y < H; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    const palette = ["#55cfff", "#897cff", "#f06fd5", "#ffc957"];
    s.bricks.forEach((brick) => {
      if (!brick.alive) return;
      ctx.shadowBlur = 12;
      ctx.shadowColor = palette[brick.row % palette.length];
      ctx.fillStyle = palette[brick.row % palette.length];
      ctx.fillRect(brick.x, brick.y, brick.w, brick.h);
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255,255,255,.35)";
      ctx.fillRect(brick.x + 3, brick.y + 3, brick.w - 6, 3);
    });

    ctx.shadowBlur = 14;
    ctx.shadowColor = "#ffffff";
    ctx.fillStyle = "#fff";
    ctx.fillRect(s.paddleX, PADDLE_Y, PADDLE_W, PADDLE_H);
    ctx.shadowBlur = 18;
    ctx.shadowColor = "#70ffc0";
    ctx.beginPath();
    ctx.arc(s.ballX, s.ballY, BALL_R, 0, Math.PI * 2);
    ctx.fillStyle = "#70ffc0";
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = "rgba(4,10,29,.78)";
    ctx.fillRect(12, 12, W - 24, 48);
    ctx.fillStyle = "#fff";
    ctx.font = "800 12px system-ui";
    ctx.fillText(`WAVE ${s.wave + 1}/${WAVES.length}`, 24, 32);
    ctx.fillText(`${s.score.toLocaleString("es-ES")} PTS`, 128, 32);
    ctx.fillStyle = s.combo >= 5 ? "#ffd45b" : "#a9b8d4";
    ctx.fillText(`COMBO ×${s.combo}`, 276, 32);

    if (s.freezeTicks > 0) {
      ctx.fillStyle = "rgba(5,10,28,.5)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.font = "900 22px system-ui";
      ctx.fillText(s.wave === 0 && s.ticks < 80 ? "READY" : `WAVE ${s.wave + 1}`, W / 2, H / 2);
      ctx.textAlign = "start";
    }
  }, []);

  const loop = useCallback((now: number) => {
    const s = state.current;
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
  }, [draw, step]);

  const start = useCallback(() => {
    state.current = {
      ...initialBall(0),
      paddleX: W / 2 - PADDLE_W / 2,
      bricks: makeBricks(0),
      wave: 0,
      running: true,
      ticks: 0,
      last: 0,
      acc: 0,
      score: 0,
      combo: 0,
      bestCombo: 0,
      misses: 0,
      freezeTicks: 72,
    };
    setHud({ wave: 0, score: 0, combo: 0, bestCombo: 0, misses: 0, remaining: makeBricks(0).length });
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
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * W;
    state.current.paddleX = Math.max(0, Math.min(W - PADDLE_W, x - PADDLE_W / 2));
  }

  return (
    <div className="gameStage skillGameStage brickArena">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="gameCanvas"
        onPointerDown={(event) => movePaddle(event.clientX)}
        onPointerMove={(event) => {
          if (event.buttons || event.pointerType === "touch") movePaddle(event.clientX);
        }}
        aria-label="Prism Break"
      />
      <div className="brickHud">
        <div><small>WAVE</small><strong>{hud.wave + 1}/3</strong></div>
        <div><small>MEJOR COMBO</small><strong>×{hud.bestCombo}</strong></div>
        <div><small>FALLOS</small><strong>{hud.misses}</strong></div>
        <div><small>RESTANTES</small><strong>{hud.remaining}</strong></div>
      </div>
      <div className="gameRule">Arrastra para apuntar · el ángulo de la pala decide el rebote</div>
    </div>
  );
}
