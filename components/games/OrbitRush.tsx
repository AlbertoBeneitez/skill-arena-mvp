"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameResult } from "@/lib/types";
import { gameTone, haptic } from "@/lib/gameFeedback";

type Props = { active: boolean; onFinish: (result: GameResult) => void };
type Lane = 0 | 1;

const W = 390;
const H = 620;
const CX = W / 2;
const CY = 292;
const LANES = [92, 137] as const;
const DT = 1 / 120;
const LANE_PATTERN: Lane[] = [0,1,1,0,1,0,0,1,0,1,1,0,1,0,0,1,0,1,0,1,1,0,1,0];
const GAP_PATTERN = [1.68,1.52,1.44,1.62,1.38,1.55,1.34,1.46,1.32,1.42,1.28,1.38];

export default function OrbitRush({ active, onFinish }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const finishRef = useRef(onFinish);
  const state = useRef({
    progress: 0,
    lane: 0 as Lane,
    radius: LANES[0] as number,
    running: false,
    ticks: 0,
    last: 0,
    acc: 0,
    passed: 0,
    combo: 0,
    nextHazard: 1.65,
    nextIndex: 0,
    hitFlash: 0,
  });
  const [hud, setHud] = useState({ passed: 0, combo: 0, speed: 1 });

  useEffect(() => { finishRef.current = onFinish; }, [onFinish]);

  const finish = useCallback(() => {
    const s = state.current;
    if (!s.running) return;
    s.running = false;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    const timeMs = Math.round((s.ticks * 1000) / 120);
    const score = Math.max(0, s.passed * 260 + s.combo * 34 + Math.round(timeMs / 28));
    gameTone("bad");
    haptic([35, 28, 55]);
    finishRef.current({ won: false, score, timeMs });
  }, []);

  const currentSpeed = (passed: number) => Math.min(3.1, 1.58 + passed * 0.032);

  const step = useCallback(() => {
    const s = state.current;
    s.ticks += 1;
    const speed = currentSpeed(s.passed);
    const previous = s.progress;
    s.progress += speed * DT;

    const targetRadius = LANES[s.lane];
    s.radius += (targetRadius - s.radius) * 0.24;
    s.hitFlash = Math.max(0, s.hitFlash - 1);

    if (previous < s.nextHazard && s.progress >= s.nextHazard) {
      const hazardLane = LANE_PATTERN[s.nextIndex % LANE_PATTERN.length];
      const onHazardLane = Math.abs(s.radius - LANES[hazardLane]) < 19;
      if (onHazardLane) {
        s.hitFlash = 24;
        finish();
        return;
      }
      s.passed += 1;
      s.combo += 1;
      s.nextIndex += 1;
      const baseGap = GAP_PATTERN[s.nextIndex % GAP_PATTERN.length];
      const compression = Math.max(0.74, 1 - Math.floor(s.passed / 14) * 0.035);
      s.nextHazard += baseGap * compression;
      if (s.combo % 5 === 0) {
        gameTone("good");
        haptic(8);
      }
    }

    if (s.ticks % 4 === 0) {
      setHud({
        passed: s.passed,
        combo: s.combo,
        speed: Number((currentSpeed(s.passed) / 1.58).toFixed(2)),
      });
    }
  }, [finish]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const s = state.current;

    const bg = ctx.createRadialGradient(CX, CY, 20, CX, CY, 350);
    bg.addColorStop(0, "#294a88");
    bg.addColorStop(.55, "#111f49");
    bg.addColorStop(1, "#070d22");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(CX, CY);
    ctx.rotate(-s.progress * .12);
    ctx.strokeStyle = "rgba(126,167,255,.1)";
    ctx.lineWidth = 1;
    for (let radius = 35; radius < 190; radius += 22) {
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 10) {
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * 38, Math.sin(angle) * 38);
      ctx.lineTo(Math.cos(angle) * 182, Math.sin(angle) * 182);
      ctx.stroke();
    }
    ctx.restore();

    LANES.forEach((radius, index) => {
      ctx.beginPath();
      ctx.arc(CX, CY, radius, 0, Math.PI * 2);
      ctx.strokeStyle = index === s.lane ? "rgba(111,226,255,.66)" : "rgba(255,255,255,.13)";
      ctx.lineWidth = index === s.lane ? 5 : 2;
      ctx.stroke();
    });

    const previewCount = 9;
    let cursor = s.nextHazard;
    let index = s.nextIndex;
    for (let i = 0; i < previewCount; i++) {
      const delta = cursor - s.progress;
      if (delta >= 0 && delta <= Math.PI * 2.25) {
        const lane = LANE_PATTERN[index % LANE_PATTERN.length];
        const angle = -Math.PI / 2 + delta;
        const radius = LANES[lane];
        const alpha = Math.max(.2, 1 - delta / (Math.PI * 2.25));
        ctx.save();
        ctx.translate(CX, CY);
        ctx.rotate(angle);
        ctx.strokeStyle = `rgba(255,92,111,${alpha})`;
        ctx.lineWidth = 16;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.arc(0, 0, radius, -0.13, 0.13);
        ctx.stroke();
        ctx.restore();
      }
      index += 1;
      const gap = GAP_PATTERN[index % GAP_PATTERN.length];
      const compression = Math.max(0.74, 1 - Math.floor((s.passed + i) / 14) * 0.035);
      cursor += gap * compression;
    }

    const playerAngle = -Math.PI / 2;
    const px = CX + Math.cos(playerAngle) * s.radius;
    const py = CY + Math.sin(playerAngle) * s.radius;
    ctx.shadowBlur = 24;
    ctx.shadowColor = s.hitFlash > 0 ? "#ff6574" : "#72e6ff";
    ctx.fillStyle = s.hitFlash > 0 ? "#ff6574" : "#72e6ff";
    ctx.beginPath();
    ctx.arc(px, py, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(px - 3, py - 3, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(7,13,32,.82)";
    ctx.fillRect(16, 16, W - 32, 54);
    ctx.fillStyle = "#fff";
    ctx.font = "800 12px system-ui";
    ctx.fillText(`PASADOS ${s.passed}`, 28, 39);
    ctx.fillStyle = s.combo >= 5 ? "#ffde66" : "#aab9d8";
    ctx.fillText(`COMBO ×${s.combo}`, 152, 39);
    ctx.fillStyle = "#6fdca0";
    ctx.fillText(`×${(currentSpeed(s.passed) / 1.58).toFixed(2)}`, 304, 39);

    ctx.fillStyle = "rgba(255,255,255,.76)";
    ctx.font = "700 11px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("TOCA PARA CAMBIAR DE ÓRBITA", CX, 536);
    ctx.textAlign = "start";
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
    state.current = {
      progress: 0,
      lane: 0,
      radius: LANES[0],
      running: true,
      ticks: 0,
      last: 0,
      acc: 0,
      passed: 0,
      combo: 0,
      nextHazard: 1.65,
      nextIndex: 0,
      hitFlash: 0,
    };
    setHud({ passed: 0, combo: 0, speed: 1 });
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

  function switchLane() {
    const s = state.current;
    if (!s.running) return;
    s.lane = s.lane === 0 ? 1 : 0;
    gameTone("tap");
    haptic(5);
  }

  return (
    <div className="gameStage skillGameStage orbitArena" onPointerDown={switchLane}>
      <canvas ref={canvasRef} width={W} height={H} className="gameCanvas" aria-label="Orbit Rush" />
      <div className="orbitFooter">
        <div><small>SUPERADOS</small><strong>{hud.passed}</strong></div>
        <button type="button" onPointerDown={(event) => { event.stopPropagation(); switchLane(); }}>CAMBIAR ÓRBITA</button>
        <div><small>VELOCIDAD</small><strong>×{hud.speed}</strong></div>
      </div>
    </div>
  );
}
