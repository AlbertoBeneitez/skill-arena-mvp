"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameResult } from "@/lib/types";
import { gameTone, haptic } from "@/lib/gameFeedback";

type Props = { active: boolean; onFinish: (result: GameResult) => void };
type Rect = { x: number; y: number; w: number; h: number };
type Crystal = { x: number; y: number };

const W = 390;
const H = 620;
const WORLD_W = 2240;
const FLOOR_Y = 514;
const DT = 1 / 120;
const PLAYER_W = 27;
const PLAYER_H = 38;
const RUN_SPEED = 210;
const GRAVITY = 1520;
const JUMP_SPEED = -555;
const GOAL_X = 2160;

const PLATFORMS: Rect[] = [
  { x: 0, y: FLOOR_Y, w: WORLD_W, h: 106 },
  { x: 355, y: 438, w: 148, h: 18 },
  { x: 610, y: 394, w: 138, h: 18 },
  { x: 858, y: 452, w: 155, h: 18 },
  { x: 1110, y: 406, w: 138, h: 18 },
  { x: 1340, y: 360, w: 142, h: 18 },
  { x: 1585, y: 430, w: 150, h: 18 },
  { x: 1840, y: 386, w: 155, h: 18 },
];

const HAZARDS: Rect[] = [
  { x: 278, y: 488, w: 52, h: 26 },
  { x: 530, y: 488, w: 58, h: 26 },
  { x: 770, y: 488, w: 64, h: 26 },
  { x: 1024, y: 488, w: 60, h: 26 },
  { x: 1280, y: 488, w: 64, h: 26 },
  { x: 1508, y: 488, w: 58, h: 26 },
  { x: 1765, y: 488, w: 62, h: 26 },
  { x: 2030, y: 488, w: 64, h: 26 },
];

const CRYSTALS: Crystal[] = [
  { x: 432, y: 402 },
  { x: 680, y: 358 },
  { x: 1180, y: 370 },
  { x: 1410, y: 324 },
  { x: 1915, y: 350 },
];

const CHECKPOINTS = [60, 820, 1515];

export default function ShadowSprint({ active, onFinish }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const finishRef = useRef(onFinish);
  const keys = useRef({ left: false, right: false, jump: false });
  const state = useRef({
    x: 60,
    y: FLOOR_Y - PLAYER_H,
    vx: 0,
    vy: 0,
    grounded: true,
    coyote: 0,
    jumpBuffer: 0,
    running: false,
    ticks: 0,
    last: 0,
    acc: 0,
    deaths: 0,
    checkpoint: 0,
    collected: CRYSTALS.map(() => false),
  });
  const [hud, setHud] = useState({ crystals: 0, deaths: 0, progress: 0, time: 0 });

  useEffect(() => { finishRef.current = onFinish; }, [onFinish]);

  const intersects = (a: Rect, b: Rect) =>
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  const respawn = useCallback(() => {
    const s = state.current;
    s.deaths += 1;
    s.x = CHECKPOINTS[s.checkpoint];
    s.y = FLOOR_Y - PLAYER_H;
    s.vx = 0;
    s.vy = 0;
    s.grounded = true;
    s.coyote = 8;
    gameTone("bad");
    haptic([35, 35, 20]);
  }, []);

  const end = useCallback(() => {
    const s = state.current;
    if (!s.running) return;
    s.running = false;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    const timeMs = Math.round((s.ticks * 1000) / 120);
    const crystals = s.collected.filter(Boolean).length;
    const score = Math.max(
      1000,
      14800 - Math.round(timeMs / 7) - s.deaths * 650 + crystals * 520
    );
    gameTone("win");
    haptic([20, 30, 55]);
    finishRef.current({ won: true, score, timeMs });
  }, []);

  const step = useCallback(() => {
    const s = state.current;
    s.ticks += 1;

    if (s.x >= 820) s.checkpoint = Math.max(s.checkpoint, 1);
    if (s.x >= 1515) s.checkpoint = Math.max(s.checkpoint, 2);

    const axis = (keys.current.right ? 1 : 0) - (keys.current.left ? 1 : 0);
    const targetVx = axis * RUN_SPEED;
    s.vx += (targetVx - s.vx) * (s.grounded ? 0.26 : 0.12);

    if (keys.current.jump) s.jumpBuffer = 10;
    else s.jumpBuffer = Math.max(0, s.jumpBuffer - 1);

    if (s.grounded) s.coyote = 9;
    else s.coyote = Math.max(0, s.coyote - 1);

    if (s.jumpBuffer > 0 && s.coyote > 0) {
      s.vy = JUMP_SPEED;
      s.grounded = false;
      s.coyote = 0;
      s.jumpBuffer = 0;
      gameTone("tap");
      haptic(7);
    }

    if (!keys.current.jump && s.vy < -190) s.vy += GRAVITY * DT * 1.8;

    s.x = Math.max(0, Math.min(WORLD_W - PLAYER_W, s.x + s.vx * DT));
    const previousBottom = s.y + PLAYER_H;
    s.vy += GRAVITY * DT;
    s.y += s.vy * DT;
    s.grounded = false;

    if (s.vy >= 0) {
      for (const p of PLATFORMS) {
        const nextBottom = s.y + PLAYER_H;
        const horizontal = s.x + PLAYER_W > p.x && s.x < p.x + p.w;
        if (horizontal && previousBottom <= p.y + 4 && nextBottom >= p.y) {
          s.y = p.y - PLAYER_H;
          s.vy = 0;
          s.grounded = true;
          break;
        }
      }
    }

    const player = { x: s.x, y: s.y, w: PLAYER_W, h: PLAYER_H };
    if (HAZARDS.some((hazard) => intersects(player, hazard)) || s.y > H + 30) {
      respawn();
      return;
    }

    CRYSTALS.forEach((crystal, index) => {
      if (s.collected[index]) return;
      const dx = s.x + PLAYER_W / 2 - crystal.x;
      const dy = s.y + PLAYER_H / 2 - crystal.y;
      if (dx * dx + dy * dy < 28 * 28) {
        s.collected[index] = true;
        gameTone("good");
        haptic(10);
      }
    });

    if (s.x >= GOAL_X) end();

    if (s.ticks % 6 === 0) {
      setHud({
        crystals: s.collected.filter(Boolean).length,
        deaths: s.deaths,
        progress: Math.min(100, Math.round((s.x / GOAL_X) * 100)),
        time: s.ticks / 120,
      });
    }
  }, [end, respawn]);

  const draw = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const s = state.current;
    const camera = Math.max(0, Math.min(WORLD_W - W, s.x - 96));

    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#66bfff");
    sky.addColorStop(0.48, "#bfeaff");
    sky.addColorStop(0.66, "#b9dda1");
    sky.addColorStop(1, "#315b45");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(255,255,255,.65)";
    for (let i = 0; i < 5; i++) {
      const x = ((i * 128 - camera * 0.12) % (W + 160)) - 80;
      const y = 78 + (i % 2) * 38;
      ctx.beginPath();
      ctx.arc(x, y, 24, 0, Math.PI * 2);
      ctx.arc(x + 28, y + 4, 34, 0, Math.PI * 2);
      ctx.arc(x + 60, y, 22, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "rgba(48,89,111,.23)";
    for (let x = -((camera * .15) % 160); x < W + 160; x += 160) {
      ctx.beginPath();
      ctx.moveTo(x, 356);
      ctx.lineTo(x + 82, 190);
      ctx.lineTo(x + 164, 356);
      ctx.fill();
    }

    for (const p of PLATFORMS) {
      const x = p.x - camera;
      if (x + p.w < -10 || x > W + 10) continue;
      ctx.fillStyle = "#5a4435";
      ctx.fillRect(x, p.y, p.w, p.h);
      ctx.fillStyle = "#75c05f";
      ctx.fillRect(x, p.y, p.w, 7);
      ctx.fillStyle = "rgba(255,255,255,.18)";
      ctx.fillRect(x + 4, p.y + 9, Math.max(0, p.w - 8), 3);
    }

    for (const hazard of HAZARDS) {
      const x = hazard.x - camera;
      ctx.fillStyle = "#d84955";
      const spikes = Math.max(2, Math.floor(hazard.w / 13));
      ctx.beginPath();
      for (let i = 0; i < spikes; i++) {
        const sx = x + (i * hazard.w) / spikes;
        ctx.moveTo(sx, hazard.y + hazard.h);
        ctx.lineTo(sx + hazard.w / spikes / 2, hazard.y);
        ctx.lineTo(sx + hazard.w / spikes, hazard.y + hazard.h);
      }
      ctx.fill();
    }

    CRYSTALS.forEach((crystal, index) => {
      if (s.collected[index]) return;
      const x = crystal.x - camera;
      const pulse = 1 + Math.sin((s.ticks + index * 17) / 8) * 0.1;
      ctx.save();
      ctx.translate(x, crystal.y);
      ctx.scale(pulse, pulse);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = "#ffd95a";
      ctx.fillRect(-9, -9, 18, 18);
      ctx.restore();
    });

    CHECKPOINTS.slice(1).forEach((checkpoint, index) => {
      const x = checkpoint - camera;
      ctx.fillStyle = s.checkpoint > index ? "#5ee69a" : "rgba(255,255,255,.45)";
      ctx.fillRect(x, 404, 4, FLOOR_Y - 404);
    });

    const gx = GOAL_X - camera;
    ctx.fillStyle = "#ffd44c";
    ctx.fillRect(gx, 318, 7, FLOOR_Y - 318);
    ctx.fillStyle = "#fff4b5";
    ctx.fillRect(gx + 7, 326, 58, 34);
    ctx.fillStyle = "#58431b";
    ctx.font = "900 14px system-ui";
    ctx.fillText("META", gx + 16, 348);

    const px = s.x - camera;
    const bob = s.grounded ? Math.sin(s.ticks / 5) * Math.min(2, Math.abs(s.vx) / 120) : 0;
    ctx.fillStyle = "#243454";
    ctx.fillRect(px, s.y + bob, PLAYER_W, PLAYER_H);
    ctx.fillStyle = "#ffd34f";
    ctx.fillRect(px + 17, s.y + 9 + bob, 5, 5);
    ctx.fillStyle = "#88d8ff";
    ctx.fillRect(px - 4, s.y + 24 + bob, 5, 9);

    ctx.fillStyle = "rgba(24,35,63,.78)";
    ctx.fillRect(14, 14, W - 28, 52);
    ctx.fillStyle = "#fff";
    ctx.font = "800 12px system-ui";
    ctx.fillText(`${(s.ticks / 120).toFixed(2)} s`, 26, 36);
    ctx.fillText(`◆ ${s.collected.filter(Boolean).length}/${CRYSTALS.length}`, 151, 36);
    ctx.fillText(`✕ ${s.deaths}`, 254, 36);
    ctx.fillStyle = "#2b4165";
    ctx.fillRect(26, 48, W - 52, 7);
    ctx.fillStyle = "#6ce69a";
    ctx.fillRect(26, 48, (W - 52) * Math.min(1, s.x / GOAL_X), 7);
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
      x: 60,
      y: FLOOR_Y - PLAYER_H,
      vx: 0,
      vy: 0,
      grounded: true,
      coyote: 8,
      jumpBuffer: 0,
      running: true,
      ticks: 0,
      last: 0,
      acc: 0,
      deaths: 0,
      checkpoint: 0,
      collected: CRYSTALS.map(() => false),
    };
    keys.current = { left: false, right: false, jump: false };
    setHud({ crystals: 0, deaths: 0, progress: 0, time: 0 });
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
    const down = (event: KeyboardEvent) => {
      if (event.code === "ArrowLeft" || event.code === "KeyA") keys.current.left = true;
      if (event.code === "ArrowRight" || event.code === "KeyD") keys.current.right = true;
      if (event.code === "Space" || event.code === "ArrowUp") keys.current.jump = true;
    };
    const up = (event: KeyboardEvent) => {
      if (event.code === "ArrowLeft" || event.code === "KeyA") keys.current.left = false;
      if (event.code === "ArrowRight" || event.code === "KeyD") keys.current.right = false;
      if (event.code === "Space" || event.code === "ArrowUp") keys.current.jump = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const hold = (key: "left" | "right" | "jump", value: boolean) => {
    keys.current[key] = value;
  };

  return (
    <div className="gameStage skillGameStage shadowSprint">
      <canvas ref={canvasRef} width={W} height={H} className="gameCanvas" aria-label="Shadow Sprint" />
      <div className="mobileControls threeControls">
        <button
          onPointerDown={() => hold("left", true)}
          onPointerUp={() => hold("left", false)}
          onPointerCancel={() => hold("left", false)}
        >◀</button>
        <button
          className="jumpPrimary"
          onPointerDown={() => hold("jump", true)}
          onPointerUp={() => hold("jump", false)}
          onPointerCancel={() => hold("jump", false)}
        >SALTAR</button>
        <button
          onPointerDown={() => hold("right", true)}
          onPointerUp={() => hold("right", false)}
          onPointerCancel={() => hold("right", false)}
        >▶</button>
      </div>
      <div className="gameRule">
        <span>◆ {hud.crystals}/5</span>
        <b>{hud.progress}%</b>
        <span>{hud.deaths ? `+ penalización ×${hud.deaths}` : "carrera limpia"}</span>
      </div>
    </div>
  );
}
