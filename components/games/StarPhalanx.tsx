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

type Enemy = {
  x: number;
  y: number;
  alive: boolean;
  row: number;
  col: number;
};

type Shot = {
  x: number;
  y: number;
  vy: number;
  enemy?: boolean;
};

const W = 390;
const H = 620;
const DT = 1 / 120;

function makeWave(seed: string, wave: number) {
  const rng = createRng(`${seed}:wave:${wave}`);
  const rows = Math.min(6, 4 + Math.floor((wave - 1) / 2));
  const cols = 8;
  const enemies: Enemy[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (wave > 1 && rng.nextInt(12) === 0) continue;
      enemies.push({
        x: 50 + col * 41,
        y: 70 + row * 36,
        alive: true,
        row,
        col,
      });
    }
  }

  return enemies;
}

export default function StarPhalanx({
  active,
  targetScore,
  seed,
  onFinish,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef(0);
  const pointerXRef = useRef(W / 2);
  const rng = useMemo(() => createRng(seed), [seed]);

  const stateRef = useRef({
    shipX: W / 2,
    enemies: makeWave(seed, 1),
    shots: [] as Shot[],
    formationOffsetX: 0,
    formationY: 0,
    formationDirection: 1,
    score: 0,
    wave: 1,
    ticks: 0,
    running: false,
    last: 0,
    acc: 0,
    lastPlayerShotTick: -999,
    lastEnemyShotTick: 0,
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

  const nextWave = useCallback(() => {
    const s = stateRef.current;
    s.wave += 1;
    s.enemies = makeWave(seed, s.wave);
    s.formationOffsetX = 0;
    s.formationY = 0;
    s.formationDirection = 1;
    s.shots = s.shots.filter((shot) => !shot.enemy);
    gameTone("good");
    haptic([5, 16, 5]);
  }, [seed]);

  const firePlayer = useCallback(() => {
    const s = stateRef.current;
    if (!s.running) return;
    if (s.ticks - s.lastPlayerShotTick < 18) return;

    s.lastPlayerShotTick = s.ticks;
    s.shots.push({
      x: s.shipX,
      y: H - 58,
      vy: -390,
    });
    gameTone("tap");
    haptic(2);
  }, []);

  const step = useCallback(() => {
    const s = stateRef.current;
    s.ticks += 1;

    s.shipX += (pointerXRef.current - s.shipX) * 0.24;
    s.shipX = Math.max(20, Math.min(W - 20, s.shipX));

    const speed = Math.min(72, 24 + s.wave * 4);
    s.formationOffsetX += s.formationDirection * speed * DT;

    const living = s.enemies.filter((enemy) => enemy.alive);
    if (!living.length) {
      nextWave();
      return;
    }

    const minX = Math.min(...living.map((enemy) => enemy.x + s.formationOffsetX));
    const maxX = Math.max(...living.map((enemy) => enemy.x + s.formationOffsetX));

    if (minX <= 16 || maxX >= W - 16) {
      s.formationDirection *= -1;
      s.formationOffsetX += s.formationDirection * 4;
      s.formationY += 11 + Math.min(10, s.wave);
    }

    const enemyShotEvery = Math.max(32, 76 - s.wave * 5);
    if (s.ticks - s.lastEnemyShotTick >= enemyShotEvery) {
      s.lastEnemyShotTick = s.ticks;
      const shooters = living.filter((enemy) => {
        return !living.some(
          (other) => other.col === enemy.col && other.row > enemy.row
        );
      });

      if (shooters.length) {
        const shooter = shooters[rng.nextInt(shooters.length)];
        s.shots.push({
          x: shooter.x + s.formationOffsetX,
          y: shooter.y + s.formationY + 12,
          vy: 185 + s.wave * 10,
          enemy: true,
        });
      }
    }

    for (const shot of s.shots) {
      shot.y += shot.vy * DT;
    }

    for (const shot of s.shots) {
      if (shot.enemy) continue;

      for (const enemy of s.enemies) {
        if (!enemy.alive) continue;

        const x = enemy.x + s.formationOffsetX;
        const y = enemy.y + s.formationY;

        if (
          Math.abs(shot.x - x) <= 15 &&
          shot.y >= y - 10 &&
          shot.y <= y + 12
        ) {
          enemy.alive = false;
          shot.y = -999;
          s.score += 180 + enemy.row * 35 + s.wave * 12;
          gameTone("good");
          haptic(3);

          if (s.score >= targetScore) {
            finish(true);
            return;
          }
          break;
        }
      }
    }

    const shipY = H - 42;
    for (const shot of s.shots) {
      if (
        shot.enemy &&
        Math.abs(shot.x - s.shipX) < 17 &&
        Math.abs(shot.y - shipY) < 14
      ) {
        finish(false);
        return;
      }
    }

    s.shots = s.shots.filter(
      (shot) => shot.y > -30 && shot.y < H + 30
    );

    if (
      living.some(
        (enemy) => enemy.y + s.formationY >= H - 95
      )
    ) {
      finish(false);
    }
  }, [finish, nextWave, rng, targetScore]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const s = stateRef.current;

    ctx.fillStyle = "#060b1e";
    ctx.fillRect(0, 0, W, H);

    for (let index = 0; index < 55; index += 1) {
      const x = (index * 97) % W;
      const y = (index * 53 + s.ticks * (0.12 + (index % 3) * 0.04)) % H;
      ctx.fillStyle = index % 4 === 0 ? "#9fdcff" : "rgba(255,255,255,.5)";
      ctx.fillRect(x, y, 1.5, 1.5);
    }

    for (const enemy of s.enemies) {
      if (!enemy.alive) continue;
      const x = enemy.x + s.formationOffsetX;
      const y = enemy.y + s.formationY;
      const hue = 170 + enemy.row * 28;

      ctx.fillStyle = `hsl(${hue} 72% 60%)`;
      ctx.beginPath();
      ctx.moveTo(x, y - 10);
      ctx.lineTo(x + 14, y + 5);
      ctx.lineTo(x + 7, y + 12);
      ctx.lineTo(x - 7, y + 12);
      ctx.lineTo(x - 14, y + 5);
      ctx.closePath();
      ctx.fill();
    }

    for (const shot of s.shots) {
      ctx.fillStyle = shot.enemy ? "#ff7288" : "#ffe36b";
      ctx.fillRect(shot.x - 2, shot.y - 7, 4, 14);
    }

    const shipY = H - 42;
    ctx.fillStyle = "#70dff1";
    ctx.beginPath();
    ctx.moveTo(s.shipX, shipY - 17);
    ctx.lineTo(s.shipX + 18, shipY + 12);
    ctx.lineTo(s.shipX, shipY + 5);
    ctx.lineTo(s.shipX - 18, shipY + 12);
    ctx.closePath();
    ctx.fill();
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
      shipX: W / 2,
      enemies: makeWave(seed, 1),
      shots: [],
      formationOffsetX: 0,
      formationY: 0,
      formationDirection: 1,
      score: 0,
      wave: 1,
      ticks: 0,
      running: true,
      last: 0,
      acc: 0,
      lastPlayerShotTick: -999,
      lastEnemyShotTick: 0,
    };

    pointerXRef.current = W / 2;
    startRef.current = performance.now();
    draw();
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      stateRef.current.running = false;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [active, draw, loop, seed]);

  function updatePointer(clientX: number) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    pointerXRef.current =
      ((clientX - rect.left) / rect.width) * W;
  }

  return (
    <div className="detGameSurface starPhalanxGame">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="gameCanvas deterministicCanvas"
        aria-label="Star Phalanx"
        onPointerDown={(event) => {
          updatePointer(event.clientX);
          firePlayer();
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (event.buttons) updatePointer(event.clientX);
        }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
      />
      <button
        type="button"
        className="starFireButton"
        onPointerDown={(event) => {
          event.preventDefault();
          firePlayer();
        }}
      >
        FIRE
      </button>
    </div>
  );
}
