"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameResult } from "@/lib/types";
import { gameTone, haptic } from "@/lib/gameFeedback";

type Props = { active: boolean; onFinish: (result: GameResult) => void };
type Panel = { lane: 0 | 1 | 2; y: number; speed: number; hit: boolean; id: number };

const W = 390;
const H = 620;
const DT = 1 / 120;
const IMPACT_Y = 515;
const LANE_X = [95, 195, 295] as const;
const LANE_PATTERN: Array<0 | 1 | 2> = [1,0,2,1,2,0,0,2,1,1,0,2,2,1,0,1];
const GAP_PATTERN = [184,168,196,160,180,152,172,148,164,144,158,140];

export default function ShatterShot({ active, onFinish }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const finishRef = useRef(onFinish);
  const state = useRef({
    panels: [] as Panel[],
    index: 0,
    hits: 0,
    ticks: 0,
    nextSpawnTick: 24,
    running: false,
    last: 0,
    acc: 0,
    score: 0,
    combo: 0,
  });
  const [hud, setHud] = useState({ hits: 0, score: 0, combo: 0 });

  useEffect(() => { finishRef.current = onFinish; }, [onFinish]);

  const finish = useCallback(() => {
    const s = state.current;
    if (!s.running) return;
    s.running = false;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    const timeMs = Math.round((s.ticks * 1000) / 120);
    gameTone("bad");
    haptic([30,25,52]);
    finishRef.current({ won: false, score: s.score, timeMs });
  }, []);

  const spawn = useCallback(() => {
    const s = state.current;
    const i = s.index++;
    const level = Math.floor(i / 8);
    const speed = Math.min(335, 153 + level * 11);
    s.panels.push({
      lane: LANE_PATTERN[i % LANE_PATTERN.length],
      y: 82,
      speed,
      hit: false,
      id: i,
    });
    const gapTicks = Math.max(88, GAP_PATTERN[i % GAP_PATTERN.length] - level * 4);
    s.nextSpawnTick = s.ticks + gapTicks;
  }, []);

  const tap = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const s = state.current;
    if (!canvas || !s.running) return;

    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * W;
    const y = ((clientY - rect.top) / rect.height) * H;

    let best: Panel | null = null;
    let bestDistance = Infinity;
    for (const panel of s.panels) {
      if (panel.hit) continue;
      const px = LANE_X[panel.lane];
      const distance = Math.hypot(x - px, y - panel.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = panel;
      }
    }

    if (!best || bestDistance > 42) {
      finish();
      return;
    }

    best.hit = true;
    s.hits += 1;
    s.combo += 1;
    const urgency = Math.max(0, Math.min(1, best.y / IMPACT_Y));
    s.score += 380 + Math.round(urgency * 360) + Math.min(500, s.combo * 24);
    gameTone(s.combo % 5 === 0 ? "good" : "tap");
    haptic(s.combo % 5 === 0 ? 10 : 5);
    setHud({ hits: s.hits, score: s.score, combo: s.combo });
  }, [finish]);

  const step = useCallback(() => {
    const s = state.current;
    s.ticks += 1;

    if (s.ticks >= s.nextSpawnTick) spawn();

    for (const panel of s.panels) {
      if (panel.hit) continue;
      panel.y += panel.speed * DT;
      if (panel.y >= IMPACT_Y) {
        finish();
        return;
      }
    }

    s.panels = s.panels.filter((panel) => !panel.hit && panel.y < H + 50);
  }, [finish, spawn]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const s = state.current;

    const bg = ctx.createLinearGradient(0,0,0,H);
    bg.addColorStop(0,"#07132f");
    bg.addColorStop(1,"#162b48");
    ctx.fillStyle = bg;
    ctx.fillRect(0,0,W,H);

    ctx.strokeStyle = "rgba(104,173,255,.12)";
    ctx.lineWidth = 2;
    [95,195,295].forEach((laneX) => {
      ctx.beginPath();
      ctx.moveTo(W/2,72);
      ctx.lineTo(laneX,H);
      ctx.stroke();
    });

    ctx.strokeStyle = "#ef5b69";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(38,IMPACT_Y);
    ctx.lineTo(W-38,IMPACT_Y);
    ctx.stroke();

    for (const panel of s.panels) {
      if (panel.hit) continue;
      const x = LANE_X[panel.lane];
      const scale = 0.55 + Math.min(1, panel.y / IMPACT_Y) * 0.6;
      ctx.save();
      ctx.translate(x,panel.y);
      ctx.scale(scale,scale);
      ctx.shadowBlur = 18;
      ctx.shadowColor = "#6de6ff";
      ctx.fillStyle = "rgba(78,204,235,.75)";
      ctx.fillRect(-28,-22,56,44);
      ctx.strokeStyle = "#b8f3ff";
      ctx.lineWidth = 3;
      ctx.strokeRect(-28,-22,56,44);
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#fff";
      ctx.font = "900 16px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("✦",0,6);
      ctx.restore();
    }

    ctx.fillStyle = "rgba(7,14,34,.84)";
    ctx.fillRect(14,14,W-28,52);
    ctx.font = "800 12px system-ui";
    ctx.fillStyle = "#fff";
    ctx.fillText(`ROMPIDOS ${s.hits}`,26,36);
    ctx.fillStyle = "#ffdc67";
    ctx.fillText(`COMBO ×${s.combo}`,150,36);
    ctx.fillStyle = "#78e3a5";
    ctx.fillText(`NIVEL ${1+Math.floor(s.index/8)}`,300,36);
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

    if (s.ticks % 4 === 0) {
      setHud({ hits: s.hits, score: s.score, combo: s.combo });
    }
    draw();
    if (s.running) rafRef.current = requestAnimationFrame(loop);
  }, [draw, step]);

  const start = useCallback(() => {
    state.current = {
      panels: [],
      index: 0,
      hits: 0,
      ticks: 0,
      nextSpawnTick: 24,
      running: true,
      last: 0,
      acc: 0,
      score: 0,
      combo: 0,
    };
    setHud({ hits: 0, score: 0, combo: 0 });
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
    <div className="gameStage skillGameStage shatterShotArena">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="gameCanvas"
        onPointerDown={(event) => tap(event.clientX,event.clientY)}
        aria-label="Shatter Shot"
      />
      <div className="shatterHud">
        <span>ROMPIDOS {hud.hits}</span>
        <b>{hud.score.toLocaleString("es-ES")} pts</b>
        <span>×{hud.combo}</span>
      </div>
      <div className="gameRule">No dejes que ningún panel alcance la línea roja · cada ciclo acelera</div>
    </div>
  );
}
