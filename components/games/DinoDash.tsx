"use client";

/**
 * Dino Dash.
 *
 * Endless-runner timing is adapted from the permissively licensed Chrome
 * T-Rex runner port by wayou (BSD-3-Clause). Skill Arena uses original
 * geometry, deterministic obstacle schedules and its own rendering.
 *
 * Source: https://github.com/wayou/t-rex-runner
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

type Obstacle = {
  x: number;
  kind: "cactus" | "double" | "flyer";
  y: number;
  w: number;
  h: number;
  passed: boolean;
};

const W = 390;
const H = 620;
const DT = 1 / 120;
const GROUND = 508;
const PLAYER_X = 72;

function makeSchedule(seed: string) {
  const rng = createRng(\`\${seed}:dino-obstacles\`);
  const items: Array<{
    gap: number;
    kind: Obstacle["kind"];
    y: number;
    w: number;
    h: number;
  }> = [];

  for (let index = 0; index < 600; index += 1) {
    const roll = rng.nextInt(10);
    const kind: Obstacle["kind"] =
      index < 5
        ? "cactus"
        : roll < 5
          ? "cactus"
          : roll < 8
            ? "double"
            : "flyer";

    items.push({
      gap: 250 + rng.nextInt(170),
      kind,
      y:
        kind === "flyer"
          ? GROUND - (rng.nextInt(2) === 0 ? 74 : 116)
          : GROUND,
      w: kind === "double" ? 48 : kind === "flyer" ? 40 : 27,
      h: kind === "flyer" ? 23 : kind === "double" ? 48 : 44,
    });
  }

  return items;
}

export default function DinoDash({
  active,
  targetScore,
  seed,
  onFinish,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef(0);
  const schedule = useMemo(() => makeSchedule(seed), [seed]);
  const jumpHeld = useRef(false);

  const stateRef = useRef({
    y: GROUND - 46,
    vy: 0,
    ducking: false,
    obstacles: [] as Obstacle[],
    scheduleIndex: 0,
    nextSpawnX: 520,
    scroll: 0,
    score: 0,
    ticks: 0,
    running: false,
    last: 0,
    acc: 0,
  });

  const speedFor = (ticks: number) =>
    Math.min(390, 178 + (ticks / 120) * 1.85);

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
        score: Math.round(s.score),
        timeMs: Math.round(performance.now() - startRef.current),
      });
    },
    [onFinish]
  );

  const spawnUntilFilled = useCallback(() => {
    const s = stateRef.current;

    while (s.nextSpawnX - s.scroll < W + 700) {
      const item = schedule[s.scheduleIndex % schedule.length];
      s.nextSpawnX += item.gap;

      s.obstacles.push({
        x: s.nextSpawnX,
        kind: item.kind,
        y: item.y,
        w: item.w,
        h: item.h,
        passed: false,
      });

      s.scheduleIndex += 1;
    }
  }, [schedule]);

  const step = useCallback(() => {
    const s = stateRef.current;
    s.ticks += 1;

    const speed = speedFor(s.ticks);
    s.scroll += speed * DT;
    s.score += speed * DT * 0.42;

    spawnUntilFilled();

    const grounded = s.y >= GROUND - 46 - 0.1;

    if (!grounded) {
      if (jumpHeld.current && s.vy < 0) {
        s.vy -= 90 * DT;
      }
      s.vy += 1150 * DT;
      s.y += s.vy * DT;

      if (s.y >= GROUND - 46) {
        s.y = GROUND - 46;
        s.vy = 0;
      }
    }

    const playerH = s.ducking && grounded ? 29 : 46;
    const playerY = s.ducking && grounded ? GROUND - playerH : s.y;
    const px1 = PLAYER_X + 5;
    const px2 = PLAYER_X + 36;
    const py1 = playerY + 4;
    const py2 = playerY + playerH - 2;

    for (const obstacle of s.obstacles) {
      const x = obstacle.x - s.scroll;
      const y1 =
        obstacle.kind === "flyer"
          ? obstacle.y - obstacle.h / 2
          : obstacle.y - obstacle.h;
      const y2 =
        obstacle.kind === "flyer"
          ? obstacle.y + obstacle.h / 2
          : obstacle.y;

      if (
        x + obstacle.w > px1 &&
        x < px2 &&
        y2 > py1 &&
        y1 < py2
      ) {
        finish(false);
        return;
      }

      if (!obstacle.passed && x + obstacle.w < PLAYER_X) {
        obstacle.passed = true;
        s.score += obstacle.kind === "flyer" ? 360 : obstacle.kind === "double" ? 300 : 240;
        gameTone("tap");
      }
    }

    if (s.score >= targetScore) {
      finish(true);
      return;
    }

    if (s.obstacles.length > 60) {
      s.obstacles = s.obstacles.filter(
        (obstacle) => obstacle.x - s.scroll > -100
      );
    }
  }, [finish, spawnUntilFilled, targetScore]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const s = stateRef.current;
    const phase = (s.ticks / 120) % 46;
    const night = phase > 31;
    const sky = ctx.createLinearGradient(0, 0, 0, H);

    if (night) {
      sky.addColorStop(0, "#18223f");
      sky.addColorStop(1, "#495b78");
    } else {
      sky.addColorStop(0, "#d9eff7");
      sky.addColorStop(1, "#f5e5bf");
    }

    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    if (night) {
      ctx.fillStyle = "rgba(255,255,255,.72)";
      for (let i = 0; i < 22; i += 1) {
        const x = (i * 71 - s.scroll * 0.03) % W;
        const y = 38 + ((i * 47) % 210);
        ctx.fillRect((x + W) % W, y, 2, 2);
      }
    }

    ctx.fillStyle = night ? "#27303f" : "#66685f";
    ctx.fillRect(0, GROUND, W, 4);

    ctx.fillStyle = night
      ? "rgba(255,255,255,.20)"
      : "rgba(50,50,50,.18)";
    for (let x = -((s.scroll * 0.7) % 34); x < W; x += 34) {
      ctx.fillRect(x, GROUND + 18, 20, 2);
    }

    for (const obstacle of s.obstacles) {
      const x = obstacle.x - s.scroll;
      if (x < -80 || x > W + 80) continue;

      if (obstacle.kind === "flyer") {
        ctx.fillStyle = "#b35d75";
        ctx.beginPath();
        ctx.moveTo(x, obstacle.y);
        ctx.lineTo(x + 18, obstacle.y - 12);
        ctx.lineTo(x + obstacle.w, obstacle.y);
        ctx.lineTo(x + 18, obstacle.y + 10);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#f4d27c";
        ctx.fillRect(x + obstacle.w - 6, obstacle.y - 2, 7, 4);
      } else {
        ctx.fillStyle = obstacle.kind === "double" ? "#3d8c62" : "#4f9d6b";
        const count = obstacle.kind === "double" ? 2 : 1;

        for (let part = 0; part < count; part += 1) {
          const cx = x + part * 21;
          ctx.fillRect(cx + 7, GROUND - obstacle.h, 12, obstacle.h);
          ctx.fillRect(cx, GROUND - obstacle.h + 16, 8, 8);
          ctx.fillRect(cx + 18, GROUND - obstacle.h + 24, 8, 8);
        }
      }
    }

    const grounded = s.y >= GROUND - 46 - 0.1;
    const playerH = s.ducking && grounded ? 29 : 46;
    const playerY = s.ducking && grounded ? GROUND - playerH : s.y;

    ctx.fillStyle = "#243a58";
    ctx.fillRect(PLAYER_X + 7, playerY + 10, 24, playerH - 10);

    ctx.fillStyle = "#f0c95c";
    ctx.fillRect(PLAYER_X + 22, playerY + 3, 17, 13);

    ctx.fillStyle = "#0d1423";
    ctx.fillRect(PLAYER_X + 33, playerY + 7, 3, 3);

    ctx.fillStyle = "#243a58";
    const legPhase = Math.floor(s.ticks / 8) % 2;
    ctx.fillRect(PLAYER_X + 11, playerY + playerH - 2, 5, legPhase ? 8 : 4);
    ctx.fillRect(PLAYER_X + 25, playerY + playerH - 2, 5, legPhase ? 4 : 8);
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
      y: GROUND - 46,
      vy: 0,
      ducking: false,
      obstacles: [],
      scheduleIndex: 0,
      nextSpawnX: 390,
      scroll: 0,
      score: 0,
      ticks: 0,
      running: true,
      last: 0,
      acc: 0,
    };

    jumpHeld.current = false;
    startRef.current = performance.now();
    spawnUntilFilled();
    draw();
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      stateRef.current.running = false;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [active, draw, loop, spawnUntilFilled]);

  function jump() {
    const s = stateRef.current;
    if (!s.running) return;

    const grounded = s.y >= GROUND - 46 - 0.1;
    if (!grounded) return;

    s.ducking = false;
    s.vy = -455;
    s.y -= 1;
    jumpHeld.current = true;
    gameTone("tap");
    haptic(3);
  }

  return (
    <div className="detGameSurface dinoDashGame">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="gameCanvas deterministicCanvas"
        aria-label="Dino Dash"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          jump();
        }}
        onPointerUp={(event) => {
          jumpHeld.current = false;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
        onPointerCancel={() => {
          jumpHeld.current = false;
        }}
      />

      <button
        type="button"
        className="dinoDuckButton"
        onPointerDown={(event) => {
          event.preventDefault();
          stateRef.current.ducking = true;
          haptic(2);
        }}
        onPointerUp={() => {
          stateRef.current.ducking = false;
        }}
        onPointerCancel={() => {
          stateRef.current.ducking = false;
        }}
      >
        ↓
      </button>
    </div>
  );
}
