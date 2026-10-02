"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameResult } from "@/lib/types";
import { gameTone, haptic } from "@/lib/gameFeedback";

type Props = { active: boolean; onFinish: (result: GameResult) => void };
type Lane = 0 | 1;
type Hazard = { progress: number; lane: Lane; passed: boolean };

const W = 390;
const H = 620;
const CX = W / 2;
const CY = 292;
const LANES = [92, 137] as const;
const DT = 1 / 120;
const FINISH = Math.PI * 18;

const HAZARD_BLUEPRINT: Array<[number, Lane]> = [
  [0.9, 0], [1.55, 1], [2.15, 1], [2.82, 0], [3.45, 1], [4.08, 0],
  [4.72, 0], [5.28, 1], [5.92, 0], [6.46, 1], [7.03, 1], [7.62, 0],
  [8.18, 1], [8.72, 0], [9.31, 0], [9.88, 1], [10.42, 0], [10.96, 1],
  [11.48, 0], [12.04, 1], [12.58, 1], [13.14, 0], [13.67, 1], [14.18, 0],
  [14.68, 0], [15.18, 1], [15.72, 0], [16.24, 1], [16.75, 1], [17.28, 0],
].map(([turn, lane]) => [turn * Math.PI, lane]);

function makeHazards(): Hazard[] {
  return HAZARD_BLUEPRINT.map(([progress, lane]) => ({ progress, lane, passed: false }));
}

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
    hits: 0,
    combo: 0,
    bestCombo: 0,
    hazards: makeHazards(),
    pulse: 0,
  });
  const [hud, setHud] = useState({ progress: 0, hits: 0, combo: 0, bestCombo: 0 });

  useEffect(() => { finishRef.current = onFinish; }, [onFinish]);

  const finish = useCallback(() => {
    const s = state.current;
    if (!s.running) return;
    s.running = false;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    const timeMs = Math.round((s.ticks * 1000) / 120);
    const clean = s.hazards.filter((item) => item.passed).length - s.hits;
    const score = Math.max(1000, 11600 + clean * 120 + s.bestCombo * 55 - s.hits * 900 - Math.round(timeMs / 22));
    gameTone("win");
    haptic([18, 26, 55]);
    finishRef.current({ won: true, score, timeMs });
  }, []);

  const step = useCallback(() => {
    const s = state.current;
    s.ticks += 1;
    const phase = Math.min(1, s.progress / FINISH);
    const speed = 1.65 + phase * 0.88;
    const previous = s.progress;
    s.progress += speed * DT;

    const targetRadius = LANES[s.lane];
    s.radius += (targetRadius - s.radius) * 0.22;
    s.pulse = Math.max(0, s.pulse - 1);

    for (const hazard of s.hazards) {
      if (hazard.passed || hazard.progress > s.progress) continue;
      if (hazard.progress >= previous - 0.04) {
        hazard.passed = true;
        const onHazardLane = Math.abs(s.radius - LANES[hazard.lane]) < 20;
        if (onHazardLane) {
          s.hits += 1;
          s.combo = 0;
          s.pulse = 22;
          gameTone("bad");
          haptic(24);
        } else {
          s.combo += 1;
          s.bestCombo = Math.max(s.bestCombo, s.combo);
          if (s.combo % 5 === 0) {
            gameTone("good");
            haptic(8);
          }
        }
      }
    }

    if (s.progress >= FINISH) {
      finish();
      return;
    }

    if (s.ticks % 5 === 0) {
      setHud({
        progress: Math.min(100, Math.round((s.progress / FINISH) * 100)),
        hits: s.hits,
        combo: s.combo,
        bestCombo: s.bestCombo,
      });
    }
  }, [finish]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const s = state.current;

    const bg = ctx.createRadialGradient(CX, CY, 20, CX, CY, 340);
    bg.addColorStop(0, "#24396d");
    bg.addColorStop(.58, "#101b3e");
    bg.addColorStop(1, "#080e24");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(CX, CY);
    ctx.rotate(-s.progress * .08);
    ctx.strokeStyle = "rgba(126,167,255,.12)";
    ctx.lineWidth = 1;
    for (let r = 35; r < 190; r += 22) {
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
    }
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * 38, Math.sin(a) * 38);
      ctx.lineTo(Math.cos(a) * 182, Math.sin(a) * 182); ctx.stroke();
    }
    ctx.restore();

    LANES.forEach((radius, index) => {
      ctx.beginPath();
      ctx.arc(CX, CY, radius, 0, Math.PI * 2);
      ctx.strokeStyle = index === s.lane ? "rgba(111,211,255,.58)" : "rgba(255,255,255,.14)";
      ctx.lineWidth = index === s.lane ? 4 : 2;
      ctx.stroke();
    });

    const lookAhead = Math.PI * 2.2;
    s.hazards.forEach((hazard) => {
      if (hazard.passed) return;
      const delta = hazard.progress - s.progress;
      if (delta < 0 || delta > lookAhead) return;
      const angle = -Math.PI / 2 + delta;
      const radius = LANES[hazard.lane];
      const alpha = Math.max(.22, 1 - delta / lookAhead);
      ctx.save();
      ctx.translate(CX, CY);
      ctx.rotate(angle);
      ctx.strokeStyle = `rgba(255,91,109,${alpha})`;
      ctx.lineWidth = 15;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(0, 0, radius, -0.13, 0.13);
      ctx.stroke();
      ctx.restore();
    });

    const playerAngle = -Math.PI / 2;
    const px = CX + Math.cos(playerAngle) * s.radius;
    const py = CY + Math.sin(playerAngle) * s.radius;
    ctx.shadowBlur = 24;
    ctx.shadowColor = s.pulse > 0 ? "#ff6574" : "#72e6ff";
    ctx.fillStyle = s.pulse > 0 ? "#ff6574" : "#72e6ff";
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
    ctx.fillText(`PROGRESO ${Math.round((s.progress / FINISH) * 100)}%`, 28, 39);
    ctx.fillStyle = s.combo >= 5 ? "#ffde66" : "#aab9d8";
    ctx.fillText(`COMBO ×${s.combo}`, 160, 39);
    ctx.fillStyle = s.hits ? "#ff7d88" : "#7ce6ab";
    ctx.fillText(`ERRORES ${s.hits}`, 282, 39);

    ctx.fillStyle = "rgba(255,255,255,.12)";
    ctx.fillRect(28, 52, W - 56, 6);
    ctx.fillStyle = "#66d99a";
    ctx.fillRect(28, 52, (W - 56) * Math.min(1, s.progress / FINISH), 6);

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
      hits: 0,
      combo: 0,
      bestCombo: 0,
      hazards: makeHazards(),
      pulse: 0,
    };
    setHud({ progress: 0, hits: 0, combo: 0, bestCombo: 0 });
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
        <div><small>MEJOR COMBO</small><strong>×{hud.bestCombo}</strong></div>
        <button type="button" onPointerDown={(event) => { event.stopPropagation(); switchLane(); }}>CAMBIAR ÓRBITA</button>
        <div><small>ERRORES</small><strong>{hud.hits}</strong></div>
      </div>
    </div>
  );
}
