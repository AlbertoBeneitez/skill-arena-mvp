"use client";

/**
 * Sky Hop.
 *
 * Vertical auto-bounce/platform generation is adapted from the MIT-licensed
 * Doodle Jump implementation in sausi-7/games. Skill Arena replaces its
 * Phaser dependency, sprites/assets, random generator and UI with a compact
 * deterministic fixed-timestep implementation.
 *
 * Source: https://github.com/sausi-7/games
 * License: MIT, Copyright (c) 2026 Saurabh Singh.
 */

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

type Platform = {
  x: number;
  y: number;
  w: number;
  moving: boolean;
  phase: number;
  drift: number;
  period: number;
};

const W = 390;
const H = 620;
const DT = 1 / 120;
const PLAYER_W = 30;
const PLAYER_H = 38;

function makePlatforms(seed: string) {
  const rng = createRng(\`\${seed}:skyhop-platforms\`);
  const items: Platform[] = [];
  let y = H - 54;
  let lastX = W / 2 - 48;

  items.push({
    x: lastX,
    y,
    w: 96,
    moving: false,
    phase: 0,
    drift: 0,
    period: 1,
  });

  for (let index = 1; index < 500; index += 1) {
    const gap = 76 + rng.nextInt(38);
    y -= gap;

    const maxShift = index < 8 ? 112 : 150;
    const shift = rng.nextInt(maxShift * 2 + 1) - maxShift;
    const width = Math.max(62, 96 - Math.floor(index / 18) * 3);
    const moving = index > 7 && rng.nextInt(7) === 0;

    lastX = Math.max(
      18,
      Math.min(W - width - 18, lastX + shift)
    );

    items.push({
      x: lastX,
      y,
      w: width,
      moving,
      phase: rng.nextInt(200),
      drift: moving ? 22 + rng.nextInt(24) : 0,
      period: 140 + rng.nextInt(100),
    });
  }

  return items;
}

function triangle(tick: number, period: number, phase: number) {
  const p = ((tick + phase) % period + period) % period;
  const half = period / 2;
  return p < half ? -1 + (p / half) * 2 : 1 - ((p - half) / half) * 2;
}

export default function SkyHop({
  active,
  targetScore,
  seed,
  onFinish,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef(0);
  const platforms = useMemo(() => makePlatforms(seed), [seed]);
  const leftRef = useRef(false);
  const rightRef = useRef(false);

  const stateRef = useRef({
    x: W / 2,
    y: H - 100,
    vx: 0,
    vy: -510,
    cameraY: 0,
    score: 0,
    highestIndex: 0,
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
      haptic(won ? [18, 30, 48] : 30);

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
    s.ticks += 1;

    const input = (rightRef.current ? 1 : 0) - (leftRef.current ? 1 : 0);
    const acceleration = 720;
    const maxSpeed = 235;

    if (input !== 0) {
      s.vx += input * acceleration * DT;
    } else {
      s.vx *= 0.90;
    }

    s.vx = Math.max(-maxSpeed, Math.min(maxSpeed, s.vx));
    s.x += s.vx * DT;

    if (s.x < -PLAYER_W / 2) s.x = W + PLAYER_W / 2;
    if (s.x > W + PLAYER_W / 2) s.x = -PLAYER_W / 2;

    const previousBottom = s.y + PLAYER_H / 2;

    s.vy += 1050 * DT;
    s.y += s.vy * DT;

    if (s.vy > 0) {
      const nextBottom = s.y + PLAYER_H / 2;

      for (let index = Math.max(0, s.highestIndex - 4); index < platforms.length; index += 1) {
        const platform = platforms[index];
        const movingOffset = platform.moving
          ? triangle(s.ticks, platform.period, platform.phase) * platform.drift
          : 0;
        const px = platform.x + movingOffset;

        if (
          previousBottom <= platform.y + 3 &&
          nextBottom >= platform.y &&
          s.x + PLAYER_W / 2 > px &&
          s.x - PLAYER_W / 2 < px + platform.w
        ) {
          s.y = platform.y - PLAYER_H / 2;
          s.vy = -510;
          s.score += 260 + Math.min(640, index * 9);

          if (index > s.highestIndex) {
            s.highestIndex = index;
          }

          gameTone(index % 5 === 0 ? "good" : "tap");
          haptic(index % 5 === 0 ? 5 : 2);

          if (s.score >= targetScore) {
            finish(true);
            return;
          }
          break;
        }
      }
    }

    const targetCamera = Math.min(0, s.y - H * 0.42);
    s.cameraY += (targetCamera - s.cameraY) * 0.12;

    if (s.y - s.cameraY > H + 90) {
      finish(false);
    }
  }, [finish, platforms, targetScore]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const s = stateRef.current;

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#12254a");
    bg.addColorStop(0.62, "#356da0");
    bg.addColorStop(1, "#8dc6d9");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(255,255,255,.42)";
    for (let index = 0; index < 12; index += 1) {
      const x = (index * 73 + 20) % W;
      const y = ((index * 109 - s.cameraY * 0.18) % (H + 100)) - 50;
      ctx.fillRect(x, y, 2, 2);
    }

    for (let index = 0; index < platforms.length; index += 1) {
      const platform = platforms[index];
      const screenY = platform.y - s.cameraY;
      if (screenY < -40 || screenY > H + 40) continue;

      const offset = platform.moving
        ? triangle(s.ticks, platform.period, platform.phase) * platform.drift
        : 0;
      const x = platform.x + offset;

      ctx.fillStyle = platform.moving ? "#e7b756" : "#69d3ac";
      ctx.shadowBlur = platform.moving ? 10 : 5;
      ctx.shadowColor = platform.moving
        ? "rgba(231,183,86,.35)"
        : "rgba(105,211,172,.28)";
      ctx.fillRect(x, screenY, platform.w, 12);
      ctx.shadowBlur = 0;

      ctx.fillStyle = "rgba(255,255,255,.25)";
      ctx.fillRect(x + 5, screenY + 3, Math.max(0, platform.w - 10), 3);
    }

    const playerY = s.y - s.cameraY;
    ctx.save();
    ctx.translate(s.x, playerY);
    ctx.rotate(Math.max(-0.28, Math.min(0.28, s.vx / 500)));

    ctx.fillStyle = "#f4ce60";
    ctx.shadowBlur = 13;
    ctx.shadowColor = "rgba(244,206,96,.45)";
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.lineTo(17, 12);
    ctx.lineTo(7, 17);
    ctx.lineTo(-7, 17);
    ctx.lineTo(-17, 12);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = "#1b365f";
    ctx.fillRect(-6, -4, 12, 10);
    ctx.restore();
  }, [platforms]);

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
      x: W / 2,
      y: H - 100,
      vx: 0,
      vy: -510,
      cameraY: 0,
      score: 0,
      highestIndex: 0,
      ticks: 0,
      running: true,
      last: 0,
      acc: 0,
    };

    leftRef.current = false;
    rightRef.current = false;
    startRef.current = performance.now();

    draw();
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      stateRef.current.running = false;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [active, draw, loop]);

  return (
    <div className="detGameSurface skyHopGame">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="gameCanvas deterministicCanvas"
        aria-label="Sky Hop"
      />

      <div className="skyHopControls">
        <button
          type="button"
          onPointerDown={(event) => {
            event.preventDefault();
            leftRef.current = true;
          }}
          onPointerUp={() => {
            leftRef.current = false;
          }}
          onPointerCancel={() => {
            leftRef.current = false;
          }}
        >
          ←
        </button>

        <button
          type="button"
          onPointerDown={(event) => {
            event.preventDefault();
            rightRef.current = true;
          }}
          onPointerUp={() => {
            rightRef.current = false;
          }}
          onPointerCancel={() => {
            rightRef.current = false;
          }}
        >
          →
        </button>
      </div>
    </div>
  );
}
