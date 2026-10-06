"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameResult } from "@/lib/types";
import { createRng } from "@/lib/deterministic/seeded";
import { gameTone, haptic } from "@/lib/gameFeedback";

type Props = {
  active: boolean;
  targetScore: number;
  seed: string;
  onFinish: (result: GameResult) => void;
};

type Brick = {
  baseX: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  drift: number;
  period: number;
  phase: number;
  colorIndex: number;
  kind: "normal" | "armor" | "blast";
};

const W = 390;
const H = 620;
const DT = 1 / 120;
const PADDLE_Y = 570;
const BALL_R = 8;
const COLORS = ["#5e8fe8", "#6fd7c3", "#f0bb59", "#d97a8f", "#9f7ee2"];

function triangleWave(tick: number, period: number, phase: number) {
  const p = ((tick + phase) % period + period) % period;
  const half = period / 2;
  return p < half ? -1 + (p / half) * 2 : 1 - ((p - half) / half) * 2;
}

function createWave(seed: string, wave: number) {
  const rng = createRng(`${seed}:wave:${wave}`);
  const cols = 7;
  const rows = Math.min(9, 5 + Math.floor(wave / 2));
  const gap = 5;
  const margin = 18;
  const width = (W - margin * 2 - gap * (cols - 1)) / cols;
  const bricks: Brick[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const density = Math.max(1, 10 - Math.floor(wave / 2));
      if (row > 0 && rng.nextInt(density) === 0) continue;

      const roll = rng.nextInt(12);
      const kind: Brick["kind"] =
        roll === 0 && wave >= 2
          ? "blast"
          : roll <= 3 && wave >= 2
            ? "armor"
            : "normal";

      const baseHp =
        kind === "armor"
          ? 2 + Math.floor(wave / 4)
          : 1 + Math.floor(wave / 5);
      const maxHp = Math.min(4, baseHp);
      const moving =
        wave >= 2 &&
        ((row + wave) % 2 === 0 || kind === "blast");

      bricks.push({
        baseX: margin + col * (width + gap),
        y: 58 + row * 28,
        w: width,
        h: 19,
        hp: maxHp,
        maxHp,
        drift: moving
          ? Math.min(22, 6 + wave * 1.7)
          : 0,
        period: Math.max(
          95,
          165 + rng.nextInt(120) - wave * 4
        ),
        phase: rng.nextInt(220),
        colorIndex:
          kind === "blast"
            ? 2
            : (row + col + wave) % COLORS.length,
        kind,
      });
    }
  }

  return bricks;
}

export default function BrickRelay({
  active,
  targetScore: _targetScore,
  seed,
  onFinish,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef(0);
  const pointerXRef = useRef(W / 2);
  const [elapsedMs, setElapsedMs] = useState(0);

  const stateRef = useRef({
    paddleX: W / 2 - 48,
    paddleW: 96,
    ballX: W / 2,
    ballY: PADDLE_Y - 18,
    vx: 176,
    vy: -232,
    bricks: createWave(seed, 1),
    score: 0,
    wave: 1,
    ticks: 0,
    running: false,
    last: 0,
    acc: 0,
    combo: 0,
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

  function brickX(brick: Brick, ticks: number) {
    return brick.baseX + triangleWave(ticks, brick.period, brick.phase) * brick.drift;
  }

  const nextWave = useCallback(() => {
    const s = stateRef.current;
    s.wave += 1;
    s.bricks = createWave(seed, s.wave);
    s.combo = 0;
    s.paddleW = Math.max(50, 96 - (s.wave - 1) * 4);

    const currentSpeed = Math.hypot(s.vx, s.vy);
    const nextSpeed = Math.min(525, currentSpeed + 24);
    const angle = Math.atan2(Math.abs(s.vx), Math.abs(s.vy));

    s.vx = Math.sign(s.vx || 1) * Math.sin(angle) * nextSpeed;
    s.vy = -Math.cos(angle) * nextSpeed;
    s.ballY = Math.min(s.ballY, PADDLE_Y - 42);

    gameTone("good");
    haptic([5, 12, 5]);
  }, [seed]);

  const step = useCallback(() => {
    const s = stateRef.current;
    s.ticks += 1;

    s.paddleX +=
      (pointerXRef.current - s.paddleW / 2 - s.paddleX) * 0.24;
    s.paddleX = Math.max(0, Math.min(W - s.paddleW, s.paddleX));

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
      s.ballX <= s.paddleX + s.paddleW &&
      s.vy > 0
    ) {
      const relative =
        (s.ballX - (s.paddleX + s.paddleW / 2)) / (s.paddleW / 2);
      const speed = Math.min(525, Math.hypot(s.vx, s.vy) + 8);
      const angle = relative * 0.92;

      s.vx = Math.sin(angle) * speed;
      s.vy = -Math.cos(angle) * speed;
      s.ballY = PADDLE_Y - BALL_R - 1;
      s.combo = 0;

      gameTone("tap");
      haptic(2);
    }

    for (const brick of s.bricks) {
      if (brick.hp <= 0) continue;

      const x = brickX(brick, s.ticks);

      if (
        s.ballX + BALL_R < x ||
        s.ballX - BALL_R > x + brick.w ||
        s.ballY + BALL_R < brick.y ||
        s.ballY - BALL_R > brick.y + brick.h
      ) {
        continue;
      }

      const previousBallX = s.ballX - s.vx * DT;
      const previousBallY = s.ballY - s.vy * DT;
      const hitFromSide =
        previousBallX + BALL_R <= x ||
        previousBallX - BALL_R >= x + brick.w;

      if (hitFromSide) s.vx *= -1;
      else s.vy *= -1;

      brick.hp -= 1;

      if (brick.hp <= 0) {
        s.combo += 1;
        const comboMultiplier = Math.min(2.4, 1 + s.combo * 0.08);
        s.score += Math.round(
          (280 + s.wave * 26) * comboMultiplier
        );

        if (brick.kind === "blast") {
          let exploded = 0;

          for (const nearby of s.bricks) {
            if (nearby.hp <= 0 || nearby === brick) continue;

            const nearbyX = brickX(nearby, s.ticks);
            const centerDistance = Math.hypot(
              nearbyX + nearby.w / 2 - (x + brick.w / 2),
              nearby.y + nearby.h / 2 - (brick.y + brick.h / 2)
            );

            if (centerDistance <= 76) {
              nearby.hp = 0;
              exploded += 1;
            }
          }

          s.score += exploded * (190 + s.wave * 18);

          const speed = Math.min(
            555,
            Math.hypot(s.vx, s.vy) * 1.07
          );
          const angle = Math.atan2(
            Math.abs(s.vx),
            Math.abs(s.vy)
          );
          s.vx =
            Math.sign(s.vx || 1) *
            Math.sin(angle) *
            speed;
          s.vy =
            Math.sign(s.vy || -1) *
            Math.cos(angle) *
            speed;

          haptic([4, 14, 4]);
        } else {
          haptic(4);
        }

        gameTone("good");
      } else {
        s.score += 95;
        gameTone("tap");
        haptic(2);
      }

      break;
    }

    if (s.bricks.every((brick) => brick.hp <= 0)) {
      nextWave();
    }

    if (s.ballY - BALL_R > H) {
      finish(false);
    }
  }, [finish, nextWave]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const s = stateRef.current;
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#171d43");
    bg.addColorStop(0.65, "#0c1430");
    bg.addColorStop(1, "#070b18");

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const laneOffset = (s.ticks * (1.5 + s.wave * 0.08)) % 46;
    ctx.strokeStyle = "rgba(108,221,239,.08)";
    ctx.lineWidth = 1;

    for (let y = -laneOffset; y < H; y += 46) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    for (const brick of s.bricks) {
      if (brick.hp <= 0) continue;

      const x = brickX(brick, s.ticks);
      const ratio = brick.hp / brick.maxHp;
      const color =
        brick.kind === "armor"
          ? "#7986a8"
          : COLORS[brick.colorIndex];

      ctx.save();
      ctx.globalAlpha = 0.72 + ratio * 0.28;
      ctx.fillStyle = color;
      ctx.shadowBlur = brick.maxHp > 1 ? 8 : 3;
      ctx.shadowColor = color;
      ctx.fillRect(x, brick.y, brick.w, brick.h);
      ctx.shadowBlur = 0;

      if (brick.maxHp > 1) {
        ctx.fillStyle = "rgba(255,255,255,.34)";
        ctx.fillRect(
          x + 3,
          brick.y + 3,
          Math.max(0, (brick.w - 6) * ratio),
          4
        );
      }

      if (brick.kind === "blast") {
        ctx.fillStyle = "rgba(255,255,255,.82)";
        ctx.beginPath();
        ctx.moveTo(x + brick.w / 2, brick.y + 4);
        ctx.lineTo(x + brick.w / 2 + 6, brick.y + brick.h / 2);
        ctx.lineTo(x + brick.w / 2, brick.y + brick.h - 4);
        ctx.lineTo(x + brick.w / 2 - 6, brick.y + brick.h / 2);
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();
    }

    ctx.fillStyle = "#6de0ef";
    ctx.shadowBlur = 10;
    ctx.shadowColor = "#6de0ef";
    ctx.fillRect(s.paddleX, PADDLE_Y, s.paddleW, 14);
    ctx.shadowBlur = 0;

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

      if (s.running) {
        rafRef.current = requestAnimationFrame(loop);
      }
    },
    [draw, step]
  );

  useEffect(() => {
    if (!active) return;

    stateRef.current = {
      paddleX: W / 2 - 48,
      paddleW: 96,
      ballX: W / 2,
      ballY: PADDLE_Y - 18,
      vx: 176,
      vy: -232,
      bricks: createWave(seed, 1),
      score: 0,
      wave: 1,
      ticks: 0,
      running: true,
      last: 0,
      acc: 0,
      combo: 0,
    };

    pointerXRef.current = W / 2;
    setElapsedMs(0);
    startRef.current = performance.now();

    draw();
    rafRef.current = requestAnimationFrame(loop);

    const timer = window.setInterval(() => {
      if (stateRef.current.running) {
        setElapsedMs(
          Math.round(performance.now() - startRef.current)
        );
      }
    }, 200);

    return () => {
      window.clearInterval(timer);
      stateRef.current.running = false;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [active, draw, loop, seed]);

  function updatePointer(clientX: number) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    pointerXRef.current =
      ((clientX - rect.left) / rect.width) * W;
  }

  return (
    <div className="detGameSurface canvasDetGame brickRelayGame">
      <div className="gameTimerChip">
        {String(Math.floor(elapsedMs / 60000)).padStart(2, "0")}:
        {String(Math.floor(elapsedMs / 1000) % 60).padStart(2, "0")}
      </div>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="gameCanvas deterministicCanvas"
        aria-label="Brick Relay"
        onPointerDown={(event) => {
          updatePointer(event.clientX);
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!event.buttons) return;
          updatePointer(event.clientX);
        }}
        onPointerUp={(event) => {
          if (
            event.currentTarget.hasPointerCapture(event.pointerId)
          ) {
            event.currentTarget.releasePointerCapture(
              event.pointerId
            );
          }
        }}
      />
    </div>
  );
}
