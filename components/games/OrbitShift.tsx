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
const CY = 270;
const DT = 1 / 120;
const LANES = [72, 103, 134, 165] as const;

const HAZARD_LANES: Lane[] = [
  1,2,0,3,2,1,3,0,1,2,3,1,0,2,1,3,
  0,1,3,2,0,2,3,1,2,0,1,3,2,1,0,3,
];
const GAP_PATTERN = [
  1.5,1.34,1.43,1.29,1.39,1.25,1.33,1.23,1.31,1.19,1.27,1.17,
];
const GHOST_PATH: Lane[] = [
  1,2,2,3,2,1,0,1,2,3,2,1,0,1,1,2,3,3,2,1,0,1,2,2,
];

function speedFor(passed: number) {
  return Math.min(3.15, 1.5 + passed * 0.028);
}

export default function OrbitShift({ active, ghostEnabled, onFinish }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const finishRef = useRef(onFinish);
  const [laneDisplay, setLaneDisplay] = useState<Lane>(1);

  const state = useRef({
    progress: 0,
    lane: 1 as Lane,
    radius: LANES[1] as number,
    running: false,
    ticks: 0,
    last: 0,
    acc: 0,
    passed: 0,
    nextHazard: 1.72,
    nextIndex: 0,
  });

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

    // Smooth radial interpolation makes orbit changes readable but deterministic.
    s.radius += (LANES[s.lane] - s.radius) * 0.28;

    if (previous < s.nextHazard && s.progress >= s.nextHazard) {
      const hazardLane =
        HAZARD_LANES[s.nextIndex % HAZARD_LANES.length];

      if (Math.abs(s.radius - LANES[hazardLane]) < 18) {
        finish();
        return;
      }

      s.passed += 1;
      s.nextIndex += 1;

      const compression = Math.max(
        0.76,
        1 - Math.floor(s.passed / 14) * 0.035
      );

      s.nextHazard +=
        GAP_PATTERN[s.nextIndex % GAP_PATTERN.length] * compression;

      if (s.passed % 5 === 0) {
        gameTone("good");
        haptic(7);
      }
    }
  }, [finish]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const s = state.current;

    const bg = ctx.createRadialGradient(CX, CY, 20, CX, CY, 370);
    bg.addColorStop(0, "#2a4c88");
    bg.addColorStop(0.55, "#101e47");
    bg.addColorStop(1, "#060c20");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Rotating space grid gives motion without affecting gameplay.
    ctx.save();
    ctx.translate(CX, CY);
    ctx.rotate(-s.progress * 0.1);
    ctx.strokeStyle = "rgba(126,167,255,.085)";
    ctx.lineWidth = 1;

    for (let radius = 34; radius < 192; radius += 20) {
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 10) {
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * 34, Math.sin(angle) * 34);
      ctx.lineTo(Math.cos(angle) * 190, Math.sin(angle) * 190);
      ctx.stroke();
    }
    ctx.restore();

    LANES.forEach((radius, index) => {
      ctx.beginPath();
      ctx.arc(CX, CY, radius, 0, Math.PI * 2);
      ctx.strokeStyle =
        index === s.lane
          ? "rgba(111,226,255,.84)"
          : "rgba(255,255,255,.13)";
      ctx.lineWidth = index === s.lane ? 5 : 2;
      ctx.stroke();
    });

    // Upcoming hazards are visible far enough in advance to reward anticipation.
    let cursor = s.nextHazard;
    let index = s.nextIndex;

    for (let preview = 0; preview < 12; preview += 1) {
      const delta = cursor - s.progress;

      if (delta >= 0 && delta <= Math.PI * 2.25) {
        const lane =
          HAZARD_LANES[index % HAZARD_LANES.length];
        const angle = -Math.PI / 2 + delta;
        const radius = LANES[lane];
        const alpha = Math.max(
          0.18,
          1 - delta / (Math.PI * 2.25)
        );

        ctx.save();
        ctx.translate(CX, CY);
        ctx.rotate(angle);
        ctx.strokeStyle = `rgba(255,92,111,${alpha})`;
        ctx.lineWidth = preview === 0 ? 17 : 14;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.arc(0, 0, radius, -0.13, 0.13);
        ctx.stroke();

        if (preview === 0 && delta < 0.85) {
          ctx.strokeStyle = `rgba(255,212,90,${alpha})`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(0, 0, radius, -0.19, 0.19);
          ctx.stroke();
        }

        ctx.restore();
      }

      index += 1;
      const compression = Math.max(
        0.76,
        1 - Math.floor((s.passed + preview) / 14) * 0.035
      );
      cursor +=
        GAP_PATTERN[index % GAP_PATTERN.length] * compression;
    }

    const playerAngle = -Math.PI / 2;
    const px = CX + Math.cos(playerAngle) * s.radius;
    const py = CY + Math.sin(playerAngle) * s.radius;

    // Player trail improves motion readability.
    ctx.strokeStyle = "rgba(114,230,255,.24)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(CX, CY, s.radius, -Math.PI / 2 + 0.03, -Math.PI / 2 + 0.32);
    ctx.stroke();

    ctx.shadowBlur = 24;
    ctx.shadowColor = "#72e6ff";
    ctx.fillStyle = "#72e6ff";
    ctx.beginPath();
    ctx.arc(px, py, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    if (ghostEnabled) {
      const ghostLane =
        GHOST_PATH[s.passed % GHOST_PATH.length];
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
      ctx.fillText(
        "👻",
        CX + Math.cos(ghostAngle) * ghostRadius,
        CY + Math.sin(ghostAngle) * ghostRadius - 15
      );
      ctx.textAlign = "start";
    }

    // Minimal competitive HUD.
    ctx.fillStyle = "rgba(7,13,32,.84)";
    ctx.fillRect(14, 14, W - 28, 50);
    ctx.fillStyle = "#fff";
    ctx.font = "900 12px system-ui";
    ctx.textAlign = "left";
    ctx.fillText(`SUPERADOS ${s.passed}`, 26, 44);

    ctx.textAlign = "right";
    ctx.fillStyle = "#77e5ff";
    ctx.fillText(`ÓRBITA ${s.lane + 1}/4`, W - 26, 44);

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
      nextHazard: 1.72,
      nextIndex: 0,
    };

    setLaneDisplay(1);
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

    const next = Math.max(
      0,
      Math.min(3, s.lane + direction)
    ) as Lane;

    if (next === s.lane) {
      haptic(3);
      return;
    }

    s.lane = next;
    setLaneDisplay(next);
    gameTone("tap");
    haptic(5);
  }

  return (
    <div className="gameStage skillGameStage orbitShiftArena">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="gameCanvas"
        aria-label="Orbit Shift"
      />

      <div className="orbitControlDock" aria-label="Controles de órbita">
        <button
          type="button"
          onPointerDown={() => moveOrbit(-1)}
          disabled={laneDisplay === 0}
        >
          <span>↓</span>
          <b>BAJAR</b>
        </button>

        <div className="orbitPosition">
          <small>ÓRBITA</small>
          <strong>{laneDisplay + 1}</strong>
          <div className="orbitDots" aria-hidden="true">
            {LANES.map((_, index) => (
              <i
                key={index}
                className={index === laneDisplay ? "active" : ""}
              />
            ))}
          </div>
        </div>

        <button
          type="button"
          onPointerDown={() => moveOrbit(1)}
          disabled={laneDisplay === 3}
        >
          <b>SUBIR</b>
          <span>↑</span>
        </button>
      </div>
    </div>
  );
}
