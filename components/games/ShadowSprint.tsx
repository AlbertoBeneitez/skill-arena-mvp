"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameResult } from "@/lib/types";

type Props = { active: boolean; onFinish: (result: GameResult) => void };

const W = 390;
const H = 620;
const WORLD_W = 1700;
const FLOOR_Y = 510;
const DT = 1 / 120;
const PLAYER_W = 26;
const PLAYER_H = 36;
const RUN_SPEED = 190;
const GRAVITY = 1450;
const JUMP_SPEED = -520;

type Rect = { x: number; y: number; w: number; h: number };
const PLATFORMS: Rect[] = [
  { x: 0, y: FLOOR_Y, w: WORLD_W, h: 110 },
  { x: 360, y: 438, w: 150, h: 18 },
  { x: 610, y: 398, w: 130, h: 18 },
  { x: 850, y: 452, w: 160, h: 18 },
  { x: 1110, y: 410, w: 150, h: 18 },
  { x: 1370, y: 458, w: 120, h: 18 },
];
const HAZARDS: Rect[] = [
  { x: 278, y: 486, w: 52, h: 24 },
  { x: 534, y: 486, w: 52, h: 24 },
  { x: 770, y: 486, w: 62, h: 24 },
  { x: 1028, y: 486, w: 60, h: 24 },
  { x: 1292, y: 486, w: 58, h: 24 },
  { x: 1510, y: 486, w: 66, h: 24 },
];
const GOAL_X = 1620;

export default function ShadowSprint({ active, onFinish }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const finishRef = useRef(onFinish);
  const keys = useRef({ left: false, right: false });
  const state = useRef({
    x: 60, y: FLOOR_Y - PLAYER_H, vx: 0, vy: 0, grounded: true,
    jumpQueued: false, running: false, ticks: 0, last: 0, acc: 0,
  });
  const [running, setRunning] = useState(false);

  useEffect(() => { finishRef.current = onFinish; }, [onFinish]);

  const end = useCallback((won: boolean) => {
    const s = state.current;
    if (!s.running) return;
    s.running = false;
    setRunning(false);
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    const timeMs = Math.round((s.ticks * 1000) / 120);
    const score = won ? Math.max(1000, 15000 - Math.round(timeMs / 8)) : Math.round(s.x);
    finishRef.current({ won, score, timeMs });
  }, []);

  const intersects = (a: Rect, b: Rect) =>
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  const step = useCallback(() => {
    const s = state.current;
    s.ticks += 1;
    s.vx = keys.current.left === keys.current.right ? 0 : keys.current.left ? -RUN_SPEED : RUN_SPEED;
    if (s.jumpQueued && s.grounded) {
      s.vy = JUMP_SPEED;
      s.grounded = false;
    }
    s.jumpQueued = false;

    s.x = Math.max(0, Math.min(WORLD_W - PLAYER_W, s.x + s.vx * DT));
    const previousBottom = s.y + PLAYER_H;
    s.vy += GRAVITY * DT;
    s.y += s.vy * DT;
    s.grounded = false;

    if (s.vy >= 0) {
      for (const p of PLATFORMS) {
        const nextBottom = s.y + PLAYER_H;
        const horizontal = s.x + PLAYER_W > p.x && s.x < p.x + p.w;
        if (horizontal && previousBottom <= p.y + 3 && nextBottom >= p.y) {
          s.y = p.y - PLAYER_H;
          s.vy = 0;
          s.grounded = true;
          break;
        }
      }
    }

    const player = { x: s.x, y: s.y, w: PLAYER_W, h: PLAYER_H };
    if (HAZARDS.some((h) => intersects(player, h)) || s.y > H + 40) {
      end(false);
      return;
    }
    if (s.x >= GOAL_X) end(true);
  }, [end]);

  const draw = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const s = state.current;
    const camera = Math.max(0, Math.min(WORLD_W - W, s.x - 90));

    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#93d8ff");
    sky.addColorStop(0.62, "#d9f3ff");
    sky.addColorStop(0.63, "#83bd75");
    sky.addColorStop(1, "#3f7c4d");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(43,76,104,.28)";
    for (let x = -((camera * .18) % 120); x < W + 120; x += 120) {
      ctx.beginPath();
      ctx.moveTo(x, 350); ctx.lineTo(x + 70, 210); ctx.lineTo(x + 140, 350); ctx.fill();
    }

    for (const p of PLATFORMS) {
      const x = p.x - camera;
      if (x + p.w < 0 || x > W) continue;
      ctx.fillStyle = "#5b4a37";
      ctx.fillRect(x, p.y, p.w, p.h);
      ctx.fillStyle = "#78b85f";
      ctx.fillRect(x, p.y, p.w, 6);
    }

    for (const h of HAZARDS) {
      const x = h.x - camera;
      ctx.fillStyle = "#c64a51";
      ctx.beginPath();
      const spikes = Math.max(2, Math.floor(h.w / 13));
      for (let i = 0; i < spikes; i++) {
        const sx = x + (i * h.w) / spikes;
        ctx.moveTo(sx, h.y + h.h);
        ctx.lineTo(sx + h.w / spikes / 2, h.y);
        ctx.lineTo(sx + h.w / spikes, h.y + h.h);
      }
      ctx.fill();
    }

    const gx = GOAL_X - camera;
    ctx.fillStyle = "#f6c94b";
    ctx.fillRect(gx, 330, 6, FLOOR_Y - 330);
    ctx.font = "800 14px system-ui";
    ctx.fillText("META", gx - 18, 316);

    const px = s.x - camera;
    ctx.fillStyle = "#23314d";
    ctx.fillRect(px, s.y, PLAYER_W, PLAYER_H);
    ctx.fillStyle = "#f6c94b";
    ctx.fillRect(px + 17, s.y + 8, 5, 5);

    ctx.fillStyle = "rgba(0,0,0,.62)";
    ctx.fillRect(12, 12, 154, 34);
    ctx.fillStyle = "#fff";
    ctx.font = "700 13px system-ui";
    ctx.fillText(`TIEMPO ${((s.ticks / 120)).toFixed(2)}s`, 22, 34);
  }, []);

  const loop = useCallback((now: number) => {
    const s = state.current;
    if (!s.running) return;
    if (!s.last) s.last = now;
    const frame = Math.min(0.05, (now - s.last) / 1000);
    s.last = now;
    s.acc += frame;
    while (s.acc >= DT && s.running) {
      step();
      s.acc -= DT;
    }
    draw();
    if (s.running) rafRef.current = requestAnimationFrame(loop);
  }, [draw, step]);

  const start = useCallback(() => {
    const s = state.current;
    Object.assign(s, { x: 60, y: FLOOR_Y - PLAYER_H, vx: 0, vy: 0, grounded: true, jumpQueued: false, running: true, ticks: 0, last: 0, acc: 0 });
    keys.current = { left: false, right: false };
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

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") keys.current.left = true;
      if (e.code === "ArrowRight" || e.code === "KeyD") keys.current.right = true;
      if (e.code === "Space" || e.code === "ArrowUp") state.current.jumpQueued = true;
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") keys.current.left = false;
      if (e.code === "ArrowRight" || e.code === "KeyD") keys.current.right = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  const hold = (side: "left" | "right", value: boolean) => { keys.current[side] = value; };

  return (
    <div className="gameStage skillGameStage">
      <canvas ref={canvasRef} width={W} height={H} className="gameCanvas" aria-label="Shadow Sprint" />
      <div className="mobileControls threeControls">
        <button onPointerDown={() => hold("left", true)} onPointerUp={() => hold("left", false)} onPointerCancel={() => hold("left", false)}>◀</button>
        <button onPointerDown={() => { state.current.jumpQueued = true; }}>SALTAR</button>
        <button onPointerDown={() => hold("right", true)} onPointerUp={() => hold("right", false)} onPointerCancel={() => hold("right", false)}>▶</button>
      </div>
      <div className="gameRule">{running ? "Llega a la meta. Mismo recorrido para todos." : "Resultado registrado"}</div>
    </div>
  );
}
