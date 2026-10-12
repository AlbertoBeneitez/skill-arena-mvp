"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createRng } from "@/lib/deterministic/seeded";
import { gameTone, haptic } from "@/lib/gameFeedback";
import type { GameResult } from "@/lib/types";

type Props = {
  active: boolean;
  targetScore: number;
  seed: string;
  onFinish: (result: GameResult) => void;
};

type BlockKind = "beam" | "crate" | "core";
type Block = {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  kind: BlockKind;
};

type Projectile = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  active: boolean;
};

type BirdsState = {
  blocks: Block[];
  projectile: Projectile;
  shots: number;
  score: number;
  destroyed: number;
  remainingMs: number;
  message: string;
};

type Point = { x: number; y: number };

const W = 390;
const H = 620;
const GROUND_Y = 542;
const ROUND_MS = 180_000;
const SLING = { x: 72, y: 427 };
const PROJECTILE_RADIUS = 12;

function formatTime(ms: number) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function buildState(seed: string): BirdsState {
  const rng = createRng(`${seed}:galactic-birds`);
  const towerX = 247 + rng.nextInt(28) - 14;
  const secondX = 314 + rng.nextInt(22) - 11;
  const high = rng.nextInt(18);

  return {
    blocks: [
      { id: 1, x: towerX, y: 485, w: 22, h: 58, hp: 3, kind: "beam" },
      { id: 2, x: towerX + 45, y: 485, w: 22, h: 58, hp: 3, kind: "beam" },
      { id: 3, x: towerX - 5, y: 458, w: 74, h: 20, hp: 2, kind: "crate" },
      { id: 4, x: towerX + 17, y: 425 - high, w: 31, h: 31, hp: 2, kind: "core" },
      { id: 5, x: towerX - 2, y: 396 - high, w: 78, h: 18, hp: 2, kind: "beam" },
      { id: 6, x: secondX, y: 503, w: 21, h: 39, hp: 2, kind: "beam" },
      { id: 7, x: secondX + 31, y: 503, w: 21, h: 39, hp: 2, kind: "beam" },
      { id: 8, x: secondX - 4, y: 478, w: 62, h: 18, hp: 2, kind: "crate" },
      { id: 9, x: secondX + 13, y: 448, w: 28, h: 28, hp: 2, kind: "core" },
    ],
    projectile: { x: SLING.x, y: SLING.y, vx: 0, vy: 0, active: false },
    shots: 6,
    score: 0,
    destroyed: 0,
    remainingMs: ROUND_MS,
    message: "Arrastra desde la honda y suelta.",
  };
}

function circleRectHit(projectile: Projectile, block: Block) {
  const closestX = Math.max(block.x, Math.min(projectile.x, block.x + block.w));
  const closestY = Math.max(block.y, Math.min(projectile.y, block.y + block.h));
  const dx = projectile.x - closestX;
  const dy = projectile.y - closestY;
  return dx * dx + dy * dy <= PROJECTILE_RADIUS * PROJECTILE_RADIUS;
}

function clampDrag(point: Point) {
  const dx = point.x - SLING.x;
  const dy = point.y - SLING.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= 88) return point;
  const scale = 88 / distance;
  return { x: SLING.x + dx * scale, y: SLING.y + dy * scale };
}

export default function GalacticBirds({
  active,
  targetScore,
  seed,
  onFinish,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef(0);
  const startAtRef = useRef(0);
  const finishRef = useRef(onFinish);
  const runningRef = useRef(false);
  const dragRef = useRef<Point | null>(null);
  const stateRef = useRef(buildState(seed));

  const [hud, setHud] = useState(buildState(seed));

  useEffect(() => {
    finishRef.current = onFinish;
  }, [onFinish]);

  const syncHud = useCallback(() => {
    setHud({ ...stateRef.current, blocks: stateRef.current.blocks.map((block) => ({ ...block })) });
  }, []);

  const finish = useCallback((won: boolean) => {
    if (!runningRef.current) return;
    runningRef.current = false;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);

    gameTone(won ? "win" : "good");
    haptic(won ? [18, 30, 48] : [8, 14, 8]);

    finishRef.current({
      won,
      score: stateRef.current.score,
      timeMs: Math.round(performance.now() - startAtRef.current),
    });
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;

    const state = stateRef.current;
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#12284d");
    sky.addColorStop(0.58, "#243f67");
    sky.addColorStop(1, "#080d16");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(126,231,255,.10)";
    for (let x = 24; x < W; x += 64) {
      ctx.beginPath();
      ctx.arc(x, 98 + (x % 3) * 18, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "#27381f";
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    ctx.fillStyle = "#40562d";
    ctx.fillRect(0, GROUND_Y, W, 8);

    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#7b4a2a";
    ctx.beginPath();
    ctx.moveTo(SLING.x - 18, SLING.y + 70);
    ctx.lineTo(SLING.x - 5, SLING.y + 8);
    ctx.moveTo(SLING.x + 18, SLING.y + 70);
    ctx.lineTo(SLING.x + 6, SLING.y + 8);
    ctx.stroke();

    const pull = dragRef.current;
    if (pull) {
      ctx.strokeStyle = "#2a1820";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(SLING.x - 6, SLING.y + 8);
      ctx.lineTo(pull.x, pull.y);
      ctx.lineTo(SLING.x + 6, SLING.y + 8);
      ctx.stroke();

      ctx.fillStyle = "rgba(123,227,255,.18)";
      for (let index = 1; index <= 5; index += 1) {
        const t = index / 5;
        const vx = (SLING.x - pull.x) * 7.8;
        const vy = (SLING.y - pull.y) * 7.8;
        const x = SLING.x + vx * t * 0.13;
        const y = SLING.y + vy * t * 0.13 + 480 * t * t * 0.03;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (const block of state.blocks) {
      if (block.hp <= 0) continue;
      ctx.save();
      ctx.shadowBlur = block.kind === "core" ? 12 : 5;
      ctx.shadowColor = block.kind === "core" ? "#79f2ff" : "rgba(0,0,0,.35)";
      ctx.fillStyle =
        block.kind === "core" ? "#74e3ff" : block.kind === "beam" ? "#b98a58" : "#94a3b8";
      ctx.fillRect(block.x, block.y, block.w, block.h);
      ctx.fillStyle = "rgba(255,255,255,.28)";
      ctx.fillRect(block.x + 3, block.y + 3, block.w - 6, Math.max(3, block.h * 0.16));
      if (block.kind === "core") {
        ctx.fillStyle = "#17233c";
        ctx.fillRect(block.x + 9, block.y + 9, block.w - 18, block.h - 18);
      }
      ctx.restore();
    }

    const projectile = dragRef.current
      ? { x: dragRef.current.x, y: dragRef.current.y }
      : state.projectile;
    ctx.save();
    ctx.shadowBlur = 14;
    ctx.shadowColor = "#ffcf5f";
    ctx.fillStyle = "#ffcf5f";
    ctx.beginPath();
    ctx.arc(projectile.x, projectile.y, PROJECTILE_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f97366";
    ctx.beginPath();
    ctx.arc(projectile.x - 4, projectile.y - 3, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = "#f8fbff";
    ctx.font = "900 18px system-ui";
    ctx.textAlign = "left";
    ctx.fillText(`Tiros ${state.shots}`, 18, 34);
    ctx.textAlign = "right";
    ctx.fillText(formatTime(state.remainingMs), W - 18, 34);
    ctx.textAlign = "center";
    ctx.font = "800 12px system-ui";
    ctx.fillText(state.message, W / 2, 58);
  }, []);

  const settleProjectile = useCallback(() => {
    const state = stateRef.current;
    state.projectile = { x: SLING.x, y: SLING.y, vx: 0, vy: 0, active: false };
    const coresLeft = state.blocks.some((block) => block.kind === "core" && block.hp > 0);
    if (state.shots <= 0 && coresLeft) finish(false);
  }, [finish]);

  const step = useCallback((dt: number) => {
    const state = stateRef.current;
    const projectile = state.projectile;
    state.remainingMs = ROUND_MS - (performance.now() - startAtRef.current);

    if (projectile.active) {
      projectile.vy += 760 * dt;
      projectile.x += projectile.vx * dt;
      projectile.y += projectile.vy * dt;

      if (projectile.y + PROJECTILE_RADIUS > GROUND_Y) {
        projectile.y = GROUND_Y - PROJECTILE_RADIUS;
        projectile.vy *= -0.34;
        projectile.vx *= 0.62;
      }

      for (const block of state.blocks) {
        if (block.hp <= 0 || !circleRectHit(projectile, block)) continue;

        const speed = Math.hypot(projectile.vx, projectile.vy);
        const damage = Math.max(1, Math.ceil(speed / 390));
        block.hp -= damage;

        const blockCx = block.x + block.w / 2;
        const blockCy = block.y + block.h / 2;
        if (Math.abs(projectile.x - blockCx) > Math.abs(projectile.y - blockCy)) {
          projectile.vx *= -0.58;
        } else {
          projectile.vy *= -0.58;
        }
        projectile.vx *= 0.82;
        projectile.vy *= 0.82;

        if (block.hp <= 0) {
          state.destroyed += 1;
          state.score += block.kind === "core" ? 1600 : 420;
          state.message = block.kind === "core" ? "Nucleo destruido." : "Estructura rota.";
          gameTone(block.kind === "core" ? "good" : "tap");
          haptic(block.kind === "core" ? [5, 15, 5] : 4);
        } else {
          state.score += 90;
        }
      }

      const speed = Math.hypot(projectile.vx, projectile.vy);
      if (
        projectile.x > W + 80 ||
        projectile.y > H + 80 ||
        (speed < 42 && projectile.y > GROUND_Y - PROJECTILE_RADIUS - 2)
      ) {
        settleProjectile();
      }
    }

    const coresLeft = state.blocks.filter((block) => block.kind === "core" && block.hp > 0).length;
    if (coresLeft === 0) {
      state.score += state.shots * 650 + Math.max(0, Math.ceil(state.remainingMs / 1000)) * 10;
      finish(true);
      return;
    }

    if (state.score >= targetScore) finish(true);
    else if (state.remainingMs <= 0) finish(false);
  }, [finish, settleProjectile, targetScore]);

  const loop = useCallback((now: number) => {
    if (!runningRef.current) return;

    const dt = Math.min(0.034, lastFrameRef.current ? (now - lastFrameRef.current) / 1000 : 0);
    lastFrameRef.current = now;
    step(dt);
    draw();

    if (!runningRef.current) return;
    if (Math.floor(now / 250) !== Math.floor((now - dt * 1000) / 250)) syncHud();
    rafRef.current = requestAnimationFrame(loop);
  }, [draw, step, syncHud]);

  useEffect(() => {
    if (!active) return;

    stateRef.current = buildState(seed);
    dragRef.current = null;
    syncHud();
    runningRef.current = true;
    startAtRef.current = performance.now();
    lastFrameRef.current = 0;
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      runningRef.current = false;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [active, loop, seed, syncHud]);

  function localPoint(clientX: number, clientY: number) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * W,
      y: ((clientY - rect.top) / rect.height) * H,
    };
  }

  function beginDrag(point: Point) {
    const state = stateRef.current;
    if (!runningRef.current || state.projectile.active || state.shots <= 0) return;
    if (Math.hypot(point.x - SLING.x, point.y - SLING.y) > 135) return;
    dragRef.current = clampDrag(point);
    draw();
  }

  function moveDrag(point: Point) {
    if (!dragRef.current) return;
    dragRef.current = clampDrag(point);
    draw();
  }

  function release() {
    const point = dragRef.current;
    if (!point) return;
    dragRef.current = null;

    const dx = SLING.x - point.x;
    const dy = SLING.y - point.y;
    const power = Math.hypot(dx, dy);
    if (power < 12) {
      draw();
      return;
    }

    const state = stateRef.current;
    state.shots -= 1;
    state.message = "Impacta los nucleos.";
    state.projectile = {
      x: SLING.x,
      y: SLING.y,
      vx: dx * 7.8,
      vy: dy * 7.8,
      active: true,
    };
    syncHud();
    gameTone("tap");
    haptic(8);
  }

  return (
    <div className="gameStage skillGameStage galacticBirdsGame">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="gameCanvas"
        aria-label="Galactic Birds"
        onPointerDown={(event) => {
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          beginDrag(localPoint(event.clientX, event.clientY));
        }}
        onPointerMove={(event) => {
          if (!event.buttons) return;
          moveDrag(localPoint(event.clientX, event.clientY));
        }}
        onPointerUp={(event) => {
          event.preventDefault();
          release();
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
        onPointerCancel={() => {
          dragRef.current = null;
          draw();
        }}
      />
      <div className="birdsStatus">
        <strong>{hud.score}</strong>
        <span>{hud.destroyed} piezas destruidas</span>
      </div>
    </div>
  );
}
