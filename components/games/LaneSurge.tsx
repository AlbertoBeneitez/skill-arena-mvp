"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameResult } from "@/lib/types";
import { gameTone, haptic } from "@/lib/gameFeedback";

type Props = { active: boolean; onFinish: (result: GameResult) => void };
type Lane = 0 | 1 | 2;
type Gate = { distance: number; safe: Lane; passed: boolean };

const W = 390;
const H = 620;
const DT = 1 / 120;
const PLAYER_Y = 500;
const LANES = [98, 195, 292] as const;
const SAFE_PATTERN: Lane[] = [1,0,2,2,1,0,1,2,0,0,2,1,0,2,1,1,0,2];
const GAP_PATTERN = [250,230,245,218,236,210,226,205,220,198,214,192];

function buildGates(): Gate[] {
  const gates: Gate[] = [];
  let distance = 620;
  for (let i = 0; i < 18; i++) {
    gates.push({ distance, safe: SAFE_PATTERN[i % SAFE_PATTERN.length], passed: false });
    distance += GAP_PATTERN[i % GAP_PATTERN.length];
  }
  return gates;
}

export default function LaneSurge({ active, onFinish }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const finishRef = useRef(onFinish);
  const state = useRef({
    lane: 1 as Lane,
    x: LANES[1] as number,
    distance: 0,
    gates: buildGates(),
    nextPatternIndex: 18,
    nextGateDistance: 620 + Array.from({ length: 18 }).reduce((sum, _, i) => sum + GAP_PATTERN[i % GAP_PATTERN.length], 0),
    running: false,
    ticks: 0,
    last: 0,
    acc: 0,
    passed: 0,
    score: 0,
  });
  const [hud, setHud] = useState({ passed: 0, score: 0, speed: 1 });

  useEffect(() => { finishRef.current = onFinish; }, [onFinish]);

  const speedFor = (passed: number) => Math.min(360, 190 + passed * 4.6);

  const finish = useCallback(() => {
    const s = state.current;
    if (!s.running) return;
    s.running = false;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    const timeMs = Math.round((s.ticks * 1000) / 120);
    const score = Math.max(0, s.score + Math.round(s.distance * .45));
    gameTone("bad");
    haptic([30, 28, 50]);
    finishRef.current({ won: false, score, timeMs });
  }, []);

  const extendGate = useCallback(() => {
    const s = state.current;
    const i = s.nextPatternIndex;
    const compression = Math.max(.68, 1 - Math.floor(s.passed / 15) * .04);
    s.nextGateDistance += GAP_PATTERN[i % GAP_PATTERN.length] * compression;
    s.gates.push({
      distance: s.nextGateDistance,
      safe: SAFE_PATTERN[i % SAFE_PATTERN.length],
      passed: false,
    });
    s.nextPatternIndex += 1;
    if (s.gates.length > 24) s.gates.shift();
  }, []);

  const step = useCallback(() => {
    const s = state.current;
    s.ticks += 1;
    const speed = speedFor(s.passed);
    const previousDistance = s.distance;
    s.distance += speed * DT;

    const targetX = LANES[s.lane];
    s.x += (targetX - s.x) * .22;

    for (const gate of s.gates) {
      if (gate.passed) continue;
      const prevScreenY = gate.distance - previousDistance;
      const screenY = gate.distance - s.distance;
      if (prevScreenY > PLAYER_Y && screenY <= PLAYER_Y) {
        const safeX = LANES[gate.safe];
        if (Math.abs(s.x - safeX) > 38) {
          finish();
          return;
        }
        gate.passed = true;
        s.passed += 1;
        s.score += 220 + Math.min(420, s.passed * 12);
        gameTone(s.passed % 5 === 0 ? "good" : "tap");
        if (s.passed % 5 === 0) haptic(8);
        extendGate();
      }
    }

    if (s.ticks % 5 === 0) {
      setHud({
        passed: s.passed,
        score: s.score,
        speed: Number((speed / 190).toFixed(2)),
      });
    }
  }, [extendGate, finish]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const s = state.current;

    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#88c9ef");
    sky.addColorStop(.44, "#d3eafa");
    sky.addColorStop(.45, "#6b875b");
    sky.addColorStop(1, "#263b33");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    ctx.beginPath();
    ctx.moveTo(118, 118);
    ctx.lineTo(272, 118);
    ctx.lineTo(365, H);
    ctx.lineTo(25, H);
    ctx.closePath();
    ctx.fillStyle = "#2d3440";
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,.62)";
    ctx.lineWidth = 3;
    ctx.setLineDash([18, 18]);
    for (const x of [158, 232]) {
      ctx.beginPath();
      ctx.moveTo(x + (x < 195 ? 18 : -18), 118);
      ctx.lineTo(x + (x < 195 ? -35 : 35), H);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    for (const gate of s.gates) {
      if (gate.passed) continue;
      const y = gate.distance - s.distance;
      if (y < 85 || y > H + 50) continue;
      const depth = Math.max(.28, Math.min(1, (y - 90) / 460));
      const laneSpacing = 97 * depth;
      const center = W / 2;
      const xs = [center - laneSpacing, center, center + laneSpacing];
      const obstacleW = 62 * depth + 12;
      const obstacleH = 34 * depth + 8;
      [0,1,2].forEach((lane) => {
        if (lane === gate.safe) return;
        ctx.fillStyle = "#e24f5d";
        ctx.fillRect(xs[lane] - obstacleW / 2, y - obstacleH / 2, obstacleW, obstacleH);
        ctx.fillStyle = "rgba(255,255,255,.28)";
        ctx.fillRect(xs[lane] - obstacleW / 2 + 4, y - obstacleH / 2 + 4, obstacleW - 8, 4);
      });
      ctx.fillStyle = "rgba(100,225,152,.18)";
      ctx.fillRect(xs[gate.safe] - obstacleW / 2, y - obstacleH / 2, obstacleW, obstacleH);
    }

    ctx.save();
    ctx.translate(s.x, PLAYER_Y);
    ctx.fillStyle = "#ffd34f";
    ctx.beginPath();
    ctx.moveTo(0, -28);
    ctx.lineTo(18, 24);
    ctx.lineTo(0, 16);
    ctx.lineTo(-18, 24);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#315fae";
    ctx.fillRect(-8, -12, 16, 20);
    ctx.restore();

    ctx.fillStyle = "rgba(23,35,55,.84)";
    ctx.fillRect(14, 14, W - 28, 52);
    ctx.fillStyle = "#fff";
    ctx.font = "800 12px system-ui";
    ctx.fillText(`PUERTAS ${s.passed}`, 26, 36);
    ctx.fillStyle = "#ffdd69";
    ctx.fillText(`${s.score.toLocaleString("es-ES")} PTS`, 152, 36);
    ctx.fillStyle = "#7fe3aa";
    ctx.fillText(`×${(speedFor(s.passed) / 190).toFixed(2)}`, 308, 36);
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
    const gates = buildGates();
    const nextDistance = gates[gates.length - 1].distance;
    state.current = {
      lane: 1,
      x: LANES[1],
      distance: 0,
      gates,
      nextPatternIndex: gates.length,
      nextGateDistance: nextDistance,
      running: true,
      ticks: 0,
      last: 0,
      acc: 0,
      passed: 0,
      score: 0,
    };
    setHud({ passed: 0, score: 0, speed: 1 });
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

  function move(delta: -1 | 1) {
    const s = state.current;
    if (!s.running) return;
    const next = Math.max(0, Math.min(2, s.lane + delta)) as Lane;
    if (next === s.lane) return;
    s.lane = next;
    gameTone("tap");
    haptic(5);
  }

  return (
    <div className="gameStage skillGameStage laneSurgeArena">
      <canvas ref={canvasRef} width={W} height={H} className="gameCanvas" aria-label="Lane Surge" />
      <div className="laneControls">
        <button onPointerDown={() => move(-1)}>◀ IZQUIERDA</button>
        <div><small>SUPERADAS</small><strong>{hud.passed}</strong></div>
        <button onPointerDown={() => move(1)}>DERECHA ▶</button>
      </div>
      <div className="gameRule">Busca el carril libre · una colisión termina la partida</div>
    </div>
  );
}
