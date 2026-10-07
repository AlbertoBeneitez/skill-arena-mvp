"use client";

/**
 * Precision Stack.
 *
 * Horizontal stacking/cropping semantics are adapted from the MIT-licensed
 * Balance Stack implementation in sausi-7/games. Skill Arena replaces its
 * assets, UI, Phaser dependency and random start states with deterministic
 * fixed-timestep logic.
 *
 * Source: https://github.com/sausi-7/games
 * License: MIT, Copyright (c) 2026 Saurabh Singh.
 */

import { useCallback, useEffect, useRef } from "react";
import type { GameResult } from "@/lib/types";
import { gameTone, haptic } from "@/lib/gameFeedback";

type Props = {
  active: boolean;
  targetScore: number;
  seed: string;
  onFinish: (result: GameResult) => void;
};

type Block = { x: number; y: number; w: number; hue: number };

const W = 390;
const H = 620;
const BLOCK_H = 38;
const BASE_Y = H - 74;
const DT = 1 / 120;

function hash(seed: string) {
  let value = 2166136261 >>> 0;
  for (let index = 0; index < seed.length; index += 1) {
    value ^= seed.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

export default function PrecisionStack({
  active,
  targetScore,
  seed,
  onFinish,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef(0);

  const stateRef = useRef({
    blocks: [] as Block[],
    moving: { x: 68, y: BASE_Y - BLOCK_H, w: 254, hue: 205 },
    direction: 1,
    speed: 115,
    score: 0,
    running: false,
    dropping: false,
    dropY: 0,
    ticks: 0,
    last: 0,
    acc: 0,
    cameraY: 0,
  });

  const finish = useCallback(
    (won: boolean) => {
      const s = stateRef.current;
      if (!s.running) return;
      s.running = false;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      gameTone(won ? "win" : "bad");
      haptic(won ? [18, 28, 48] : 30);
      onFinish({
        won,
        score: s.score,
        timeMs: Math.round(performance.now() - startRef.current),
      });
    },
    [onFinish]
  );

  const spawn = useCallback(() => {
    const s = stateRef.current;
    const top = s.blocks[s.blocks.length - 1];
    const level = s.blocks.length;
    const y = BASE_Y - (level + 1) * BLOCK_H;
    const width = top?.w ?? 254;
    const seedHash = hash(`${seed}:${level}`);
    const fromLeft = (seedHash & 1) === 0;

    s.moving = {
      x: fromLeft ? 10 : W - width - 10,
      y,
      w: width,
      hue: (205 + level * 19) % 360,
    };
    s.direction = fromLeft ? 1 : -1;
    s.speed = Math.min(330, 112 + level * 10.5);
    s.dropping = false;
    s.dropY = y;
  }, [seed]);

  const resolveLanding = useCallback(() => {
    const s = stateRef.current;
    const previous = s.blocks[s.blocks.length - 1];

    if (!previous) {
      s.blocks.push({ ...s.moving, y: BASE_Y - BLOCK_H });
      s.score += 500;
      spawn();
      return;
    }

    const left = Math.max(s.moving.x, previous.x);
    const right = Math.min(
      s.moving.x + s.moving.w,
      previous.x + previous.w
    );
    const overlap = right - left;

    if (overlap <= 0) {
      finish(false);
      return;
    }

    const accuracy = overlap / s.moving.w;
    const perfect = Math.abs(
      s.moving.x + s.moving.w / 2 - (previous.x + previous.w / 2)
    ) <= 3.5;

    const landed: Block = {
      x: perfect ? previous.x : left,
      y: previous.y - BLOCK_H,
      w: perfect ? previous.w : overlap,
      hue: s.moving.hue,
    };

    s.blocks.push(landed);
    s.score += Math.round(420 + accuracy * 780 + (perfect ? 500 : 0));

    gameTone(perfect ? "good" : "tap");
    haptic(perfect ? [4, 10, 4] : 4);

    if (s.score >= targetScore) {
      finish(true);
      return;
    }

    spawn();
  }, [finish, spawn, targetScore]);

  const step = useCallback(() => {
    const s = stateRef.current;
    if (!s.running) return;
    s.ticks += 1;

    if (!s.dropping) {
      s.moving.x += s.direction * s.speed * DT;
      const minX = 8;
      const maxX = W - s.moving.w - 8;

      if (s.moving.x <= minX) {
        s.moving.x = minX;
        s.direction = 1;
      } else if (s.moving.x >= maxX) {
        s.moving.x = maxX;
        s.direction = -1;
      }
    } else {
      s.dropY += 620 * DT;
      const targetY =
        s.blocks.length === 0
          ? BASE_Y - BLOCK_H
          : s.blocks[s.blocks.length - 1].y - BLOCK_H;

      if (s.dropY >= targetY) {
        s.dropY = targetY;
        s.moving.y = targetY;
        resolveLanding();
      }
    }
  }, [resolveLanding]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const s = stateRef.current;
    const highest =
      s.blocks.length > 0
        ? s.blocks[s.blocks.length - 1].y
        : BASE_Y;
    const targetCamera = Math.max(0, 160 - highest);
    s.cameraY += (targetCamera - s.cameraY) * 0.12;

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#171d43");
    bg.addColorStop(1, "#0a0f21");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(0, s.cameraY);

    ctx.fillStyle = "#263754";
    ctx.fillRect(36, BASE_Y, W - 72, 22);

    for (const block of s.blocks) {
      ctx.fillStyle = `hsl(${block.hue} 68% 59%)`;
      ctx.shadowBlur = 9;
      ctx.shadowColor = "rgba(50,120,220,.24)";
      ctx.fillRect(block.x, block.y, block.w, BLOCK_H - 4);
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255,255,255,.20)";
      ctx.fillRect(block.x + 4, block.y + 4, Math.max(0, block.w - 8), 4);
    }

    const movingY = s.dropping ? s.dropY : s.moving.y;
    ctx.fillStyle = `hsl(${s.moving.hue} 78% 63%)`;
    ctx.shadowBlur = 12;
    ctx.shadowColor = "rgba(94,170,255,.40)";
    ctx.fillRect(s.moving.x, movingY, s.moving.w, BLOCK_H - 4);
    ctx.shadowBlur = 0;
    ctx.restore();
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
      blocks: [],
      moving: { x: 68, y: BASE_Y - BLOCK_H, w: 254, hue: 205 },
      direction: 1,
      speed: 115,
      score: 0,
      running: true,
      dropping: false,
      dropY: BASE_Y - BLOCK_H,
      ticks: 0,
      last: 0,
      acc: 0,
      cameraY: 0,
    };

    startRef.current = performance.now();
    spawn();
    draw();
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      stateRef.current.running = false;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [active, draw, loop, spawn]);

  function drop() {
    const s = stateRef.current;
    if (!s.running || s.dropping) return;
    s.dropping = true;
    s.dropY = s.moving.y;
    gameTone("tap");
    haptic(3);
  }

  return (
    <div className="detGameSurface precisionStackGame">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="gameCanvas deterministicCanvas"
        aria-label="Stack"
        onPointerDown={drop}
      />
    </div>
  );
}
