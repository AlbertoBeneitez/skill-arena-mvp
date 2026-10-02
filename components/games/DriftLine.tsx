"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameResult } from "@/lib/types";
import { gameTone, haptic } from "@/lib/gameFeedback";

type Props = { active: boolean; onFinish: (result: GameResult) => void };

const W = 390;
const H = 620;
const DT = 1 / 120;
const PLAYER_Y = 486;
const PLAYER_HALF = 12;

function centerAt(distance: number) {
  return W / 2 + Math.sin(distance / 170) * 61 + Math.sin(distance / 73) * 24 + Math.sin(distance / 420) * 31;
}

function halfWidthAt(distance: number) {
  return Math.max(58, 104 - distance / 145);
}

export default function DriftLine({ active, onFinish }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const finishRef = useRef(onFinish);
  const keys = useRef({ left: false, right: false });
  const state = useRef({
    x: W / 2,
    vx: 0,
    distance: 0,
    running: false,
    ticks: 0,
    last: 0,
    acc: 0,
    cleanTicks: 0,
  });
  const [hud, setHud] = useState({ distance: 0, clean: 100, speed: 1 });

  useEffect(() => { finishRef.current = onFinish; }, [onFinish]);

  const speedFor = (distance: number) => Math.min(330, 150 + distance * .018);

  const finish = useCallback(() => {
    const s = state.current;
    if (!s.running) return;
    s.running = false;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    const timeMs = Math.round((s.ticks * 1000) / 120);
    const score = Math.max(0, Math.round(s.distance * 2.2 + s.cleanTicks * .48));
    gameTone("bad");
    haptic([30, 25, 55]);
    finishRef.current({ won: false, score, timeMs });
  }, []);

  const step = useCallback(() => {
    const s = state.current;
    s.ticks += 1;
    const speed = speedFor(s.distance);
    s.distance += speed * DT;

    const axis = (keys.current.right ? 1 : 0) - (keys.current.left ? 1 : 0);
    const targetVx = axis * 190;
    s.vx += (targetVx - s.vx) * .12;
    s.vx *= .994;
    s.x += s.vx * DT;

    const worldAtPlayer = s.distance + (H - PLAYER_Y) * 1.1;
    const center = centerAt(worldAtPlayer);
    const halfWidth = halfWidthAt(s.distance);
    const offset = Math.abs(s.x - center);
    if (offset + PLAYER_HALF >= halfWidth) {
      finish();
      return;
    }
    if (offset < halfWidth * .28) s.cleanTicks += 1;

    if (s.ticks % 5 === 0) {
      setHud({
        distance: Math.round(s.distance),
        clean: Math.max(0, Math.round(100 - (offset / halfWidth) * 100)),
        speed: Number((speed / 150).toFixed(2)),
      });
    }
  }, [finish]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const s = state.current;

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#9edcf3");
    bg.addColorStop(.42, "#dceef3");
    bg.addColorStop(.43, "#5f965f");
    bg.addColorStop(1, "#315b46");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const left: Array<[number, number]> = [];
    const right: Array<[number, number]> = [];
    for (let y = 0; y <= H; y += 10) {
      const world = s.distance + (H - y) * 1.1;
      const center = centerAt(world);
      const perspective = .72 + (y / H) * .28;
      const half = halfWidthAt(s.distance) * perspective;
      left.push([center - half, y]);
      right.push([center + half, y]);
    }

    ctx.beginPath();
    left.forEach(([x,y], i) => i === 0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y));
    [...right].reverse().forEach(([x,y]) => ctx.lineTo(x,y));
    ctx.closePath();
    ctx.fillStyle = "#313740";
    ctx.fill();

    ctx.strokeStyle = "#f0e7c8";
    ctx.lineWidth = 4;
    ctx.beginPath();
    left.forEach(([x,y], i) => i === 0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y));
    ctx.stroke();
    ctx.beginPath();
    right.forEach(([x,y], i) => i === 0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y));
    ctx.stroke();

    ctx.strokeStyle = "rgba(255,255,255,.25)";
    ctx.lineWidth = 2;
    ctx.setLineDash([14,18]);
    ctx.beginPath();
    for (let y = 0; y <= H; y += 10) {
      const world = s.distance + (H - y) * 1.1;
      const x = centerAt(world);
      if (y === 0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.save();
    ctx.translate(s.x, PLAYER_Y);
    const angle = Math.max(-.34, Math.min(.34, s.vx / 420));
    ctx.rotate(angle);
    ctx.fillStyle = "#f3c74f";
    ctx.beginPath();
    ctx.moveTo(0,-25); ctx.lineTo(15,20); ctx.lineTo(0,14); ctx.lineTo(-15,20); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#315fae";
    ctx.fillRect(-6,-10,12,17);
    ctx.restore();

    ctx.fillStyle = "rgba(29,44,64,.84)";
    ctx.fillRect(14,14,W-28,52);
    ctx.fillStyle = "#fff";
    ctx.font = "800 12px system-ui";
    ctx.fillText(`${Math.round(s.distance)} m`,26,36);
    const worldAtPlayer = s.distance + (H - PLAYER_Y) * 1.1;
    const currentCenter = centerAt(worldAtPlayer);
    const currentHalfWidth = halfWidthAt(s.distance);
    const clean = Math.max(0, Math.round(100 - (Math.abs(s.x - currentCenter) / currentHalfWidth) * 100));
    ctx.fillStyle = "#79e3a4";
    ctx.fillText(`LÍNEA ${clean}%`,145,36);
    ctx.fillStyle = "#ffdc67";
    ctx.fillText(`×${(speedFor(s.distance)/150).toFixed(2)}`,310,36);
  }, []);

  const loop = useCallback((now: number) => {
    const s = state.current;
    if (!s.running) return;
    if (!s.last) s.last = now;
    s.acc += Math.min(.05,(now-s.last)/1000);
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
      x: centerAt((H - PLAYER_Y) * 1.1),
      vx: 0,
      distance: 0,
      running: true,
      ticks: 0,
      last: 0,
      acc: 0,
      cleanTicks: 0,
    };
    keys.current = { left: false, right: false };
    setHud({ distance: 0, clean: 100, speed: 1 });
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

  function hold(side: "left" | "right", value: boolean) {
    keys.current[side] = value;
  }

  return (
    <div className="gameStage skillGameStage driftLineArena">
      <canvas ref={canvasRef} width={W} height={H} className="gameCanvas" aria-label="Drift Line" />
      <div className="driftControls">
        <button onPointerDown={() => hold("left",true)} onPointerUp={() => hold("left",false)} onPointerCancel={() => hold("left",false)}>◀</button>
        <div><small>DISTANCIA</small><strong>{hud.distance} m</strong></div>
        <button onPointerDown={() => hold("right",true)} onPointerUp={() => hold("right",false)} onPointerCancel={() => hold("right",false)}>▶</button>
      </div>
      <div className="gameRule">Mantente dentro del corredor · tocar un borde termina la partida</div>
    </div>
  );
}
