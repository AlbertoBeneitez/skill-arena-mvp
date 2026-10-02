"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameResult } from "@/lib/types";
import { gameTone, haptic } from "@/lib/gameFeedback";

type Props = { active: boolean; onFinish: (result: GameResult) => void };

const W = 390;
const H = 620;
const DT = 1 / 120;
const BLOCK_H = 28;
const START_W = 228;

type Block = { x: number; y: number; w: number };

export default function StackForge({ active, onFinish }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const finishRef = useRef(onFinish);
  const state = useRef({
    blocks: [] as Block[],
    movingX: 28,
    movingW: START_W,
    dir: 1,
    speed: 135,
    running: false,
    ticks: 0,
    last: 0,
    acc: 0,
    score: 0,
    combo: 0,
    cameraY: 0,
  });
  const [hud, setHud] = useState({ height: 0, combo: 0, score: 0, width: START_W });

  useEffect(() => { finishRef.current = onFinish; }, [onFinish]);

  const finish = useCallback(() => {
    const s = state.current;
    if (!s.running) return;
    s.running = false;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    const timeMs = Math.round((s.ticks * 1000) / 120);
    gameTone("bad");
    haptic([28, 26, 52]);
    finishRef.current({ won: false, score: s.score, timeMs });
  }, []);

  const place = useCallback(() => {
    const s = state.current;
    if (!s.running) return;
    const top = s.blocks[s.blocks.length - 1];
    const y = H - 92 - s.blocks.length * BLOCK_H;
    const left = Math.max(s.movingX, top.x);
    const right = Math.min(s.movingX + s.movingW, top.x + top.w);
    const overlap = right - left;

    if (overlap <= 1) {
      finish();
      return;
    }

    const precision = overlap / top.w;
    const perfect = precision > .965;
    const gain = 430 + Math.round(precision * 420) + (perfect ? 260 : 0) + s.combo * 18;
    s.score += gain;
    s.combo = perfect ? s.combo + 1 : 0;
    s.blocks.push({ x: left, y, w: overlap });
    s.movingW = overlap;
    s.movingX = s.dir > 0 ? 8 : W - overlap - 8;
    s.dir *= -1;
    s.speed = Math.min(330, 135 + s.blocks.length * 8);
    s.cameraY = Math.max(0, (s.blocks.length - 11) * BLOCK_H);

    setHud({ height: s.blocks.length - 1, combo: s.combo, score: s.score, width: overlap });
    gameTone(perfect ? "good" : "tap");
    haptic(perfect ? 12 : 6);
  }, [finish]);

  const step = useCallback(() => {
    const s = state.current;
    s.ticks += 1;
    s.movingX += s.dir * s.speed * DT;
    if (s.movingX <= 8) {
      s.movingX = 8;
      s.dir = 1;
    }
    if (s.movingX + s.movingW >= W - 8) {
      s.movingX = W - 8 - s.movingW;
      s.dir = -1;
    }
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const s = state.current;

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#85d5f1");
    bg.addColorStop(.52, "#d8eff7");
    bg.addColorStop(1, "#f5dfad");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(60,89,126,.12)";
    for (let y = 82; y < H; y += 48) ctx.fillRect(0, y, W, 1);

    ctx.save();
    ctx.translate(0, s.cameraY);

    s.blocks.forEach((block, index) => {
      const hue = 205 + (index * 17) % 95;
      ctx.fillStyle = `hsl(${hue} 68% 58%)`;
      ctx.fillRect(block.x, block.y, block.w, BLOCK_H - 3);
      ctx.fillStyle = "rgba(255,255,255,.32)";
      ctx.fillRect(block.x + 4, block.y + 4, Math.max(0, block.w - 8), 4);
    });

    const movingY = H - 92 - s.blocks.length * BLOCK_H;
    ctx.shadowBlur = 12;
    ctx.shadowColor = "#315fba";
    ctx.fillStyle = "#315fba";
    ctx.fillRect(s.movingX, movingY, s.movingW, BLOCK_H - 3);
    ctx.shadowBlur = 0;

    ctx.restore();

    ctx.fillStyle = "rgba(36,55,88,.84)";
    ctx.fillRect(14, 14, W - 28, 52);
    ctx.fillStyle = "#fff";
    ctx.font = "800 12px system-ui";
    ctx.fillText(`ALTURA ${Math.max(0, s.blocks.length - 1)}`, 26, 36);
    ctx.fillStyle = s.combo > 1 ? "#ffdf69" : "#dce8ff";
    ctx.fillText(`PERFECT ×${s.combo}`, 144, 36);
    ctx.fillStyle = "#80e3aa";
    ctx.fillText(`${s.score.toLocaleString("es-ES")}`, 298, 36);
  }, []);

  const loop = useCallback((now: number) => {
    const s = state.current;
    if (!s.running) return;
    if (!s.last) s.last = now;
    s.acc += Math.min(.05, (now - s.last) / 1000);
    s.last = now;
    while (s.acc >= DT && s.running) {
      step();
      s.acc -= DT;
    }
    draw();
    if (s.running) rafRef.current = requestAnimationFrame(loop);
  }, [draw, step]);

  const start = useCallback(() => {
    const base = { x: (W - START_W) / 2, y: H - 92, w: START_W };
    state.current = {
      blocks: [base],
      movingX: 8,
      movingW: START_W,
      dir: 1,
      speed: 135,
      running: true,
      ticks: 0,
      last: 0,
      acc: 0,
      score: 0,
      combo: 0,
      cameraY: 0,
    };
    setHud({ height: 0, combo: 0, score: 0, width: START_W });
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

  return (
    <div className="gameStage skillGameStage stackForgeArena">
      <canvas ref={canvasRef} width={W} height={H} className="gameCanvas" onPointerDown={place} aria-label="Stack Forge" />
      <div className="stackForgeHud">
        <div><small>ALTURA</small><strong>{hud.height}</strong></div>
        <button onPointerDown={place}>SOLTAR BLOQUE</button>
        <div><small>ANCHO</small><strong>{Math.round(hud.width)}</strong></div>
      </div>
      <div className="gameRule">Cuanto más centrado, más puntos · sin solape, se acabó</div>
    </div>
  );
}
