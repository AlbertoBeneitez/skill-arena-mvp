"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameResult } from "@/lib/types";
import { gameTone, haptic } from "@/lib/gameFeedback";

type Props = {
  active: boolean;
  ghostEnabled: boolean;
  onFinish: (result: GameResult) => void;
};

type Lane = 0 | 1 | 2 | 3;

const W = 390;
const H = 620;
const CX = W / 2;
const CY = 304;
const DT = 1 / 120;
const LANES = [72, 102, 132, 162] as const;

const HAZARD_LANES: Lane[] = [
  1,2,0,3,2,1,3,0,1,2,3,1,0,2,1,3,
  0,1,3,2,0,2,3,1,2,0,1,3,2,1,0,3,
];
const GAP_PATTERN = [1.48,1.34,1.42,1.28,1.38,1.24,1.32,1.22,1.30,1.18,1.26,1.16];
const GHOST_PATH: Lane[] = [1,2,2,3,2,1,0,1,2,3,2,1,0,1,1,2,3,3,2,1,0,1,2,2];

function speedFor(passed: number) {
  return Math.min(3.15, 1.52 + passed * 0.028);
}

export default function OrbitShift({ active, ghostEnabled, onFinish }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const finishRef = useRef(onFinish);
  const state = useRef({
    progress: 0,
    lane: 1 as Lane,
    radius: LANES[1] as number,
    running: false,
    ticks: 0,
    last: 0,
    acc: 0,
    passed: 0,
    nextHazard: 1.55,
    nextIndex: 0,
  });
  const [hud, setHud] = useState({ passed: 0, lane: 2 });

  useEffect(() => {
    finishRef.current = onFinish;
  }, [onFinish]);

  const finish = useCallback(() => {
    const s = state.current;
    if (!s.running) return;
    s.running = false;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    const timeMs = Math.round((s.ticks * 1000) / 120);
    const score = s.passed * 420 + Math.round(timeMs / 50);
    gameTone("bad");
    haptic([34, 24, 50]);
    finishRef.current({ won: false, score, timeMs });
  }, []);

  const step = useCallback(() => {
    const s = state.current;
    s.ticks += 1;

    const previous = s.progress;
    s.progress += speedFor(s.passed) * DT;
    s.radius += (LANES[s.lane] - s.radius) * 0.25;

    if (previous < s.nextHazard && s.progress >= s.nextHazard) {
      const hazardLane = HAZARD_LANES[s.nextIndex % HAZARD_LANES.length];

      if (Math.abs(s.radius - LANES[hazardLane]) < 18) {
        finish();
        return;
      }

      s.passed += 1;
      s.nextIndex += 1;

      const compression = Math.max(0.76, 1 - Math.floor(s.passed / 14) * 0.035);
      s.nextHazard += GAP_PATTERN[s.nextIndex % GAP_PATTERN.length] * compression;

      if (s.passed % 5 === 0) {
        gameTone("good");
        haptic(7);
      }
    }

    if (s.ticks % 5 === 0) {
      setHud({ passed: s.passed, lane: s.lane + 1 });
    }
  }, [finish]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const s = state.current;

    const bg = ctx.createRadialGradient(CX, CY, 20, CX, CY, 360);
    bg.addColorStop(0, "#294b88");
    bg.addColorStop(0.58, "#111e46");
    bg.addColorStop(1, "#070d22");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(CX, CY);
    ctx.rotate(-s.progress * 0.11);
    ctx.strokeStyle = "rgba(126,167,255,.09)";
    ctx.lineWidth = 1;
    for (let radius = 35; radius < 190; radius += 20) {
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 10) {
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * 35, Math.sin(angle) * 35);
      ctx.lineTo(Math.cos(angle) * 185, Math.sin(angle) * 185);
      ctx.stroke();
    }
    ctx.restore();

    LANES.forEach((radius, index) => {
      ctx.beginPath();
      ctx.arc(CX, CY, radius, 0, Math.PI * 2);
      ctx.strokeStyle =
        index === s.lane
          ? "rgba(111,226,255,.72)"
          : "rgba(255,255,255,.13)";
      ctx.lineWidth = index === s.lane ? 5 : 2;
      ctx.stroke();
    });

    let cursor = s.nextHazard;
    let index = s.nextIndex;
    for (let preview = 0; preview < 12; preview += 1) {
      const delta = cursor - s.progress;
      if (delta >= 0 && delta <= Math.PI * 2.2) {
        const lane = HAZARD_LANES[index % HAZARD_LANES.length];
        const angle = -Math.PI / 2 + delta;
        const radius = LANES[lane];
        const alpha = Math.max(0.2, 1 - delta / (Math.PI * 2.2));

        ctx.save();
        ctx.translate(CX, CY);
        ctx.rotate(angle);
        ctx.strokeStyle = `rgba(255,92,111,${alpha})`;
        ctx.lineWidth = 15;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.arc(0, 0, radius, -0.12, 0.12);
        ctx.stroke();
        ctx.restore();
      }

      index += 1;
      const compression = Math.max(
        0.76,
        1 - Math.floor((s.passed + preview) / 14) * 0.035
      );
      cursor += GAP_PATTERN[index % GAP_PATTERN.length] * compression;
    }

    const playerAngle = -Math.PI / 2;
    const px = CX + Math.cos(playerAngle) * s.radius;
    const py = CY + Math.sin(playerAngle) * s.radius;

    ctx.shadowBlur = 24;
    ctx.shadowColor = "#72e6ff";
    ctx.fillStyle = "#72e6ff";
    ctx.beginPath();
    ctx.arc(px, py, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    if (ghostEnabled) {
      const ghostLane = GHOST_PATH[Math.min(GHOST_PATH.length - 1, s.passed % GHOST_PATH.length)];
      const ghostRadius = LANES[ghostLane];
      const ghostAngle = -Math.PI / 2 + 0.28;
      ctx.globalAlpha = 0.42;
      ctx.fillStyle = "#d6f7ff";
      ctx.beginPath();
      ctx.arc(
        CX + Math.cos(ghostAngle) * ghostRadius,
        CY + Math.sin(ghostAngle) * ghostRadius,
        9,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#d6f7ff";
      ctx.font = "900 11px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("👻", CX + Math.cos(ghostAngle) * ghostRadius, CY + Math.sin(ghostAngle) * ghostRadius - 15);
      ctx.textAlign = "start";
    }

    ctx.fillStyle = "rgba(7,13,32,.82)";
    ctx.fillRect(14, 14, W - 28, 54);
    ctx.fillStyle = "#fff";
    ctx.font = "800 12px system-ui";
    ctx.fillText(`SUPERADOS ${s.passed}`, 26, 37);
    ctx.fillStyle = "#77e5ff";
    ctx.fillText(`ÓRBITA ${s.lane + 1}/4`, 267, 37);

    ctx.fillStyle = "rgba(92,164,255,.08)";
    ctx.fillRect(0, 82, W, (H - 82) / 2);
    ctx.fillStyle = "rgba(255,255,255,.36)";
    ctx.font = "900 30px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("↑", CX, 118);
    ctx.fillText("↓", CX, H - 36);
    ctx.textAlign = "start";
  }, [ghostEnabled]);

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
      progress: 0,
      lane: 1,
      radius: LANES[1],
      running: true,
      ticks: 0,
      last: 0,
      acc: 0,
      passed: 0,
      nextHazard: 1.55,
      nextIndex: 0,
    };
    setHud({ passed: 0, lane: 2 });
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

  function moveOrbit(direction: -1 | 1) {
    const s = state.current;
    if (!s.running) return;
    const next = Math.max(0, Math.min(3, s.lane + direction)) as Lane;
    if (next === s.lane) return;
    s.lane = next;
    setHud({ passed: s.passed, lane: next + 1 });
    gameTone("tap");
    haptic(5);
  }

  function touch(clientY: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const y = ((clientY - rect.top) / rect.height) * H;
    moveOrbit(y < H / 2 ? 1 : -1);
  }

  return (
    <div className="gameStage skillGameStage orbitShiftArena">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="gameCanvas"
        onPointerDown={(event) => touch(event.clientY)}
        aria-label="Orbit Shift"
      />
      <div className="gameRule floatingGameRule">Arriba: sube de órbita · abajo: baja</div>
    </div>
  );
}
