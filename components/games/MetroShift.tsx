"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameResult } from "@/lib/types";
import { gameTone, haptic } from "@/lib/gameFeedback";

type Props = {
  active: boolean;
  ghostEnabled: boolean;
  onFinish: (result: GameResult) => void;
};
type Lane = 0 | 1 | 2;
type Kind = "wall" | "barrier";
type Obstacle = {
  distance: number;
  lane: Lane;
  kind: Kind;
  passed: boolean;
};

const W = 390;
const H = 620;
const DT = 1 / 120;
const PLAYER_Y = 502;
const LANES = [98, 195, 292] as const;
const LANE_PATTERN: Lane[] = [1,0,2,2,1,0,1,2,0,0,2,1,0,2,1,1,0,2,2,0,1,2,0,1];
const KIND_PATTERN: Kind[] = [
  "wall","wall","barrier","wall","barrier","wall","wall","barrier",
  "wall","barrier","wall","wall","barrier","wall","barrier","wall",
  "wall","barrier","wall","wall","barrier","wall","barrier","wall",
];
const GAP_PATTERN = [258,238,246,224,238,214,228,208,220,204,214,198];
const GHOST_LANES: Lane[] = [1,1,0,0,1,2,2,1,0,1,2,1,1,0,2,2,1,0];

function initialObstacles() {
  const list: Obstacle[] = [];
  let distance = 660;

  for (let index = 0; index < 18; index += 1) {
    list.push({
      distance,
      lane: LANE_PATTERN[index % LANE_PATTERN.length],
      kind: KIND_PATTERN[index % KIND_PATTERN.length],
      passed: false,
    });
    distance += GAP_PATTERN[index % GAP_PATTERN.length];
  }

  return {
    list,
    nextDistance: list[list.length - 1].distance,
    nextIndex: 18,
  };
}

function speedFor(passed: number) {
  return Math.min(338, 186 + passed * 3.5);
}

export default function MetroShift({ active, ghostEnabled, onFinish }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const finishRef = useRef(onFinish);
  const swipeRef = useRef<{ x: number; y: number } | null>(null);
  const state = useRef({
    lane: 1 as Lane,
    x: LANES[1] as number,
    distance: 0,
    obstacles: [] as Obstacle[],
    nextDistance: 0,
    nextIndex: 0,
    running: false,
    ticks: 0,
    last: 0,
    acc: 0,
    passed: 0,
    score: 0,
    jumpY: 0,
    jumpVy: 0,
    laneFlash: 0,
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
    gameTone("bad");
    haptic([32, 25, 52]);
    finishRef.current({ won: false, score: s.score, timeMs });
  }, []);

  const extend = useCallback(() => {
    const s = state.current;
    const index = s.nextIndex++;
    const compression = Math.max(
      0.76,
      1 - Math.floor(s.passed / 18) * 0.032
    );

    s.nextDistance +=
      GAP_PATTERN[index % GAP_PATTERN.length] * compression;

    s.obstacles.push({
      distance: s.nextDistance,
      lane: LANE_PATTERN[index % LANE_PATTERN.length],
      kind: KIND_PATTERN[index % KIND_PATTERN.length],
      passed: false,
    });

    if (s.obstacles.length > 26) s.obstacles.shift();
  }, []);

  const step = useCallback(() => {
    const s = state.current;
    s.ticks += 1;

    const previous = s.distance;
    s.distance += speedFor(s.passed) * DT;

    s.x += (LANES[s.lane] - s.x) * 0.28;
    s.laneFlash = Math.max(0, s.laneFlash - 1);

    s.jumpVy += 1220 * DT;
    s.jumpY += s.jumpVy * DT;
    if (s.jumpY > 0) {
      s.jumpY = 0;
      s.jumpVy = 0;
    }

    for (const obstacle of s.obstacles) {
      if (obstacle.passed) continue;

      const previousY = obstacle.distance - previous;
      const screenY = obstacle.distance - s.distance;

      if (previousY > PLAYER_Y && screenY <= PLAYER_Y) {
        const sameLane = Math.abs(s.x - LANES[obstacle.lane]) < 36;

        if (sameLane) {
          if (obstacle.kind === "wall") {
            finish();
            return;
          }

          if (obstacle.kind === "barrier" && s.jumpY > -38) {
            finish();
            return;
          }
        }

        obstacle.passed = true;
        s.passed += 1;
        s.score += 270 + Math.min(520, s.passed * 16);

        if (s.passed % 5 === 0) {
          gameTone("good");
          haptic(8);
        }

        extend();
      }
    }

    if (s.ticks % 6 === 0) {
      setHud({ passed: s.passed, lane: s.lane + 1 });
    }
  }, [extend, finish]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const s = state.current;

    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#6db8df");
    sky.addColorStop(0.38, "#dcecf4");
    sky.addColorStop(0.39, "#556556");
    sky.addColorStop(1, "#202827");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // City silhouettes
    ctx.fillStyle = "rgba(37,54,66,.42)";
    const skylineOffset = (s.distance * 0.08) % 96;
    for (let x = -96 - skylineOffset; x < W + 96; x += 96) {
      const h1 = 72 + ((Math.floor((x + skylineOffset) / 96) % 3 + 3) % 3) * 24;
      ctx.fillRect(x, 106 - h1, 54, h1);
      ctx.fillRect(x + 61, 126 - h1 * 0.72, 28, h1 * 0.72);
    }

    // Perspective road
    ctx.beginPath();
    ctx.moveTo(124, 112);
    ctx.lineTo(266, 112);
    ctx.lineTo(370, H);
    ctx.lineTo(20, H);
    ctx.closePath();
    ctx.fillStyle = "#2d343f";
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,.5)";
    ctx.lineWidth = 3;
    ctx.setLineDash([18, 18]);
    for (const x of [160, 230]) {
      ctx.beginPath();
      ctx.moveTo(x + (x < 195 ? 14 : -14), 112);
      ctx.lineTo(x + (x < 195 ? -38 : 38), H);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Current lane highlight
    const laneX = LANES[s.lane];
    ctx.fillStyle = "rgba(87,210,235,.08)";
    ctx.beginPath();
    const laneIndex = s.lane;
    const bottomLeft = laneIndex === 0 ? 25 : laneIndex === 1 ? 138 : 250;
    const bottomRight = laneIndex === 0 ? 138 : laneIndex === 1 ? 250 : 365;
    const topLeft = laneIndex === 0 ? 124 : laneIndex === 1 ? 172 : 219;
    const topRight = laneIndex === 0 ? 172 : laneIndex === 1 ? 219 : 266;
    ctx.moveTo(topLeft, 112);
    ctx.lineTo(topRight, 112);
    ctx.lineTo(bottomRight, H);
    ctx.lineTo(bottomLeft, H);
    ctx.closePath();
    ctx.fill();

    // Obstacles
    for (const obstacle of s.obstacles) {
      const y = obstacle.distance - s.distance;
      if (y < 72 || y > H + 60) continue;

      const depth = Math.max(0.28, Math.min(1, (y - 80) / 455));
      const spacing = 97 * depth;
      const center = W / 2;
      const xs = [center - spacing, center, center + spacing];
      const x = xs[obstacle.lane];
      const width = 58 * depth + 15;

      if (obstacle.kind === "wall") {
        const height = 70 * depth + 18;
        ctx.fillStyle = "#df5362";
        ctx.fillRect(x - width / 2, y - height / 2, width, height);
        ctx.fillStyle = "rgba(255,255,255,.26)";
        ctx.fillRect(x - width / 2 + 5, y - height / 2 + 5, width - 10, 5);
        ctx.fillStyle = "#ffd260";
        ctx.fillRect(x - width / 2 + 6, y + height / 2 - 14, width - 12, 7);
      } else {
        const height = 28 * depth + 10;
        ctx.fillStyle = "#e1a83c";
        ctx.fillRect(x - width / 2, y - height / 2, width, height);
        ctx.fillStyle = "rgba(255,255,255,.3)";
        ctx.fillRect(x - width / 2 + 5, y - height / 2 + 4, width - 10, 4);
      }
    }

    // Opponent ghost
    if (ghostEnabled) {
      const ghostLane =
        GHOST_LANES[Math.min(GHOST_LANES.length - 1, s.passed % GHOST_LANES.length)];
      const ghostX = LANES[ghostLane];
      ctx.save();
      ctx.globalAlpha = 0.34;
      ctx.translate(ghostX, PLAYER_Y - 54);
      ctx.fillStyle = "#d7f8ff";
      ctx.beginPath();
      ctx.moveTo(0, -23);
      ctx.lineTo(15, 19);
      ctx.lineTo(0, 13);
      ctx.lineTo(-15, 19);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 0.78;
      ctx.fillStyle = "#e9fbff";
      ctx.font = "900 12px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("👻", 0, -31);
      ctx.restore();
    }

    // Player
    ctx.save();
    ctx.translate(s.x, PLAYER_Y + s.jumpY);
    ctx.rotate(Math.max(-0.18, Math.min(0.18, (LANES[s.lane] - s.x) / 100)));
    ctx.shadowBlur = 15;
    ctx.shadowColor = "#ffd34f";
    ctx.fillStyle = "#ffd34f";
    ctx.beginPath();
    ctx.moveTo(0, -28);
    ctx.lineTo(18, 23);
    ctx.lineTo(0, 16);
    ctx.lineTo(-18, 23);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#315fae";
    ctx.fillRect(-7, -11, 14, 20);
    ctx.restore();

    ctx.fillStyle = "rgba(23,35,55,.86)";
    ctx.fillRect(14, 14, W - 28, 52);
    ctx.font = "800 12px system-ui";
    ctx.fillStyle = "#fff";
    ctx.fillText(`SUPERADOS ${s.passed}`, 26, 36);
    ctx.fillStyle = "#77e5ff";
    ctx.fillText(`CARRIL ${s.lane + 1}/3`, 270, 36);
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
    const initial = initialObstacles();

    state.current = {
      lane: 1,
      x: LANES[1],
      distance: 0,
      obstacles: initial.list,
      nextDistance: initial.nextDistance,
      nextIndex: initial.nextIndex,
      running: true,
      ticks: 0,
      last: 0,
      acc: 0,
      passed: 0,
      score: 0,
      jumpY: 0,
      jumpVy: 0,
      laneFlash: 0,
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

  function move(direction: -1 | 1) {
    const s = state.current;
    if (!s.running) return;

    const next = Math.max(0, Math.min(2, s.lane + direction)) as Lane;
    if (next === s.lane) return;

    s.lane = next;
    s.laneFlash = 12;
    setHud({ passed: s.passed, lane: next + 1 });
    gameTone("tap");
    haptic(5);
  }

  function jump() {
    const s = state.current;
    if (!s.running || s.jumpY < -2) return;

    s.jumpVy = -440;
    gameTone("tap");
    haptic(5);
  }

  function localPoint(clientX: number, clientY: number) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * W,
      y: ((clientY - rect.top) / rect.height) * H,
    };
  }

  function gesture(dx: number, dy: number) {
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 30) move(1);
      else if (dx < -30) move(-1);
    } else if (dy < -30) {
      jump();
    }
  }

  return (
    <div className="gameStage skillGameStage metroShiftArena">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="gameCanvas"
        onPointerDown={(event) => {
          swipeRef.current = localPoint(event.clientX, event.clientY);
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerUp={(event) => {
          if (!swipeRef.current) return;
          const point = localPoint(event.clientX, event.clientY);
          gesture(point.x - swipeRef.current.x, point.y - swipeRef.current.y);
          swipeRef.current = null;
        }}
        onPointerCancel={() => {
          swipeRef.current = null;
        }}
        aria-label="Metro Shift"
      />

      <div className="metroControls metroControlsV7">
        <button type="button" onPointerDown={() => move(-1)}>◀</button>
        <button type="button" onPointerDown={jump}>↑ SALTAR</button>
        <button type="button" onPointerDown={() => move(1)}>▶</button>
      </div>

      <div className="metroLegend">
        <span><i className="wallSample" /> cambia de carril</span>
        <span><i className="barrierSample" /> salta</span>
        {ghostEnabled && <span>👻 rival</span>}
      </div>

      <div className="gameRule">Botones o gesto · sigue hasta la primera colisión</div>
    </div>
  );
}
