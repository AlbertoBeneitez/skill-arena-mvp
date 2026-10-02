"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameResult } from "@/lib/types";
import { gameTone, haptic } from "@/lib/gameFeedback";

type Props = { active: boolean; onFinish: (result: GameResult) => void };
type Point = { x: number; y: number };
type Wall = { x: number; y: number; w: number; h: number };
type Stage = { target: Point; radius: number; walls: Wall[]; label: string };

const W = 390;
const H = 620;
const DT = 1 / 120;
const START: Point = { x: 78, y: 520 };
const BALL_R = 7;
const GRAVITY = 330;

const STAGES: Stage[] = [
  { target: { x: 305, y: 330 }, radius: 28, walls: [], label: "DIRECTO" },
  { target: { x: 318, y: 224 }, radius: 26, walls: [{ x: 188, y: 300, w: 28, h: 220 }], label: "BANCA" },
  { target: { x: 302, y: 158 }, radius: 24, walls: [{ x: 170, y: 245, w: 26, h: 275 }, { x: 270, y: 350, w: 92, h: 24 }], label: "DOBLE LECTURA" },
  { target: { x: 92, y: 180 }, radius: 23, walls: [{ x: 175, y: 210, w: 25, h: 310 }, { x: 70, y: 360, w: 90, h: 24 }], label: "REVERSO" },
];

export default function VectorStrike({ active, onFinish }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const finishRef = useRef(onFinish);
  const state = useRef({
    ball: { ...START },
    vx: 0,
    vy: 0,
    flying: false,
    aiming: false,
    aim: { ...START },
    hitCount: 0,
    score: 0,
    running: false,
    ticks: 0,
    shotTicks: 0,
    readyTicks: 0,
    last: 0,
    acc: 0,
  });
  const [hud, setHud] = useState({ hitCount: 0, score: 0, cycle: 1 });

  useEffect(() => { finishRef.current = onFinish; }, [onFinish]);

  const resetShot = useCallback(() => {
    const s = state.current;
    s.ball = { ...START };
    s.vx = 0;
    s.vy = 0;
    s.flying = false;
    s.aiming = false;
    s.shotTicks = 0;
    s.readyTicks = 0;
  }, []);

  const finish = useCallback(() => {
    const s = state.current;
    if (!s.running) return;
    s.running = false;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    const timeMs = Math.round((s.ticks * 1000) / 120);
    const score = Math.max(0, s.score + s.hitCount * 140);
    gameTone("bad");
    haptic([28, 28, 48]);
    finishRef.current({ won: false, score, timeMs });
  }, []);

  function overlapsCircleRect(x: number, y: number, r: number, wall: Wall) {
    const closestX = Math.max(wall.x, Math.min(x, wall.x + wall.w));
    const closestY = Math.max(wall.y, Math.min(y, wall.y + wall.h));
    const dx = x - closestX;
    const dy = y - closestY;
    return dx * dx + dy * dy <= r * r;
  }

  const currentStage = useCallback(() => {
    const s = state.current;
    const base = STAGES[s.hitCount % STAGES.length];
    const cycle = Math.floor(s.hitCount / STAGES.length);
    const radius = Math.max(13, base.radius - cycle * 2);
    return { ...base, radius, cycle };
  }, []);

  const step = useCallback(() => {
    const s = state.current;
    s.ticks += 1;
    if (!s.flying) {
      s.readyTicks += 1;
      if (s.readyTicks > 960) finish();
      return;
    }

    const stage = currentStage();
    s.shotTicks += 1;
    const prevX = s.ball.x;
    const prevY = s.ball.y;
    s.vy += GRAVITY * DT;
    s.ball.x += s.vx * DT;
    s.ball.y += s.vy * DT;

    if (s.ball.x - BALL_R <= 0 && s.vx < 0) {
      s.ball.x = BALL_R;
      s.vx *= -0.88;
    }
    if (s.ball.x + BALL_R >= W && s.vx > 0) {
      s.ball.x = W - BALL_R;
      s.vx *= -0.88;
    }
    if (s.ball.y - BALL_R <= 0 && s.vy < 0) {
      s.ball.y = BALL_R;
      s.vy *= -0.88;
    }

    for (const wall of stage.walls) {
      if (!overlapsCircleRect(s.ball.x, s.ball.y, BALL_R, wall)) continue;
      const cameFromSide = prevX + BALL_R <= wall.x || prevX - BALL_R >= wall.x + wall.w;
      if (cameFromSide) {
        s.vx *= -0.88;
        s.ball.x = prevX;
      } else {
        s.vy *= -0.88;
        s.ball.y = prevY;
      }
      gameTone("tap");
      haptic(4);
      break;
    }

    const dx = s.ball.x - stage.target.x;
    const dy = s.ball.y - stage.target.y;
    if (dx * dx + dy * dy <= (stage.radius + BALL_R) * (stage.radius + BALL_R)) {
      const shotSeconds = s.shotTicks / 120;
      const speedBonus = Math.max(0, 650 - Math.round(shotSeconds * 95));
      const precisionBonus = Math.max(0, Math.round(900 - Math.sqrt(dx * dx + dy * dy) * 22));
      s.score += 1180 + speedBonus + precisionBonus + stage.cycle * 120;
      s.hitCount += 1;
      gameTone("good");
      haptic([12, 16, 18]);
      resetShot();
      setHud({
        hitCount: s.hitCount,
        score: s.score,
        cycle: Math.floor(s.hitCount / STAGES.length) + 1,
      });
      return;
    }

    if (s.ball.y - BALL_R > H || s.ball.x < -30 || s.ball.x > W + 30 || s.shotTicks > 760) {
      finish();
    }
  }, [currentStage, finish, resetShot]);

  const predict = useCallback((vx: number, vy: number, stage: Stage) => {
    const points: Point[] = [];
    let x = START.x;
    let y = START.y;
    let sx = vx;
    let sy = vy;
    for (let i = 0; i < 145; i += 5) {
      for (let k = 0; k < 5; k++) {
        const px = x;
        const py = y;
        sy += GRAVITY * DT;
        x += sx * DT;
        y += sy * DT;
        if (x - BALL_R <= 0 && sx < 0) { x = BALL_R; sx *= -0.88; }
        if (x + BALL_R >= W && sx > 0) { x = W - BALL_R; sx *= -0.88; }
        if (y - BALL_R <= 0 && sy < 0) { y = BALL_R; sy *= -0.88; }
        for (const wall of stage.walls) {
          if (!overlapsCircleRect(x, y, BALL_R, wall)) continue;
          const side = px + BALL_R <= wall.x || px - BALL_R >= wall.x + wall.w;
          if (side) { sx *= -0.88; x = px; }
          else { sy *= -0.88; y = py; }
          break;
        }
      }
      points.push({ x, y });
      if (y > H) break;
    }
    return points;
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const s = state.current;
    const stage = currentStage();

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#eef8ff");
    bg.addColorStop(.64, "#cfe7f6");
    bg.addColorStop(.65, "#acc688");
    bg.addColorStop(1, "#718c5a");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(83,111,140,.16)";
    for (let x = 0; x < W; x += 40) ctx.fillRect(x, 0, 1, H);
    for (let y = 0; y < H; y += 40) ctx.fillRect(0, y, W, 1);

    stage.walls.forEach((wall) => {
      ctx.fillStyle = "#40506a";
      ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
      ctx.fillStyle = "rgba(255,255,255,.22)";
      ctx.fillRect(wall.x + 4, wall.y + 4, Math.max(0, wall.w - 8), 4);
    });

    const pulse = 1 + Math.sin(s.ticks / 10) * .08;
    ctx.save();
    ctx.translate(stage.target.x, stage.target.y);
    ctx.scale(pulse, pulse);
    ctx.beginPath();
    ctx.arc(0, 0, stage.radius, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,204,72,.28)";
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#f1b93d";
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, stage.radius * .34, 0, Math.PI * 2);
    ctx.fillStyle = "#f1b93d";
    ctx.fill();
    ctx.restore();

    if (s.aiming && !s.flying) {
      const dx = s.aim.x - START.x;
      const dy = s.aim.y - START.y;
      const mag = Math.hypot(dx, dy);
      const power = Math.min(1, mag / 150);
      const angle = Math.atan2(dy, dx);
      const speed = 310 + power * 250;
      const prediction = predict(Math.cos(angle) * speed, Math.sin(angle) * speed, stage);
      prediction.forEach((point, index) => {
        if (index % 2) return;
        ctx.globalAlpha = Math.max(.12, .65 - index * .025);
        ctx.beginPath();
        ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = "#315fba";
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "#315fba";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(START.x, START.y);
      ctx.lineTo(s.aim.x, s.aim.y);
      ctx.stroke();
    }

    ctx.shadowBlur = 15;
    ctx.shadowColor = "#4fc6ff";
    ctx.fillStyle = "#315fba";
    ctx.beginPath();
    ctx.arc(s.ball.x, s.ball.y, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = "#243b61";
    ctx.beginPath();
    ctx.arc(START.x, START.y, 18, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(36,55,88,.84)";
    ctx.fillRect(14, 14, W - 28, 52);
    ctx.fillStyle = "#fff";
    ctx.font = "800 12px system-ui";
    ctx.fillText(`DIANAS ${s.hitCount}`, 26, 36);
    ctx.fillText(stage.label, 132, 36);
    ctx.fillStyle = "#ffdc68";
    ctx.fillText(`${s.score.toLocaleString("es-ES")} PTS`, 270, 36);
    ctx.fillStyle = "rgba(255,255,255,.72)";
    ctx.font = "700 10px system-ui";
    const readyLeft = Math.max(0, 8 - s.readyTicks / 120);
    ctx.fillText(s.flying ? "EN VUELO" : `UN TIRO · ${readyLeft.toFixed(1)}s PARA DECIDIR`, 26, 54);
  }, [currentStage, predict]);

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
      ball: { ...START },
      vx: 0,
      vy: 0,
      flying: false,
      aiming: false,
      aim: { ...START },
      hitCount: 0,
      score: 0,
      running: true,
      ticks: 0,
      shotTicks: 0,
      readyTicks: 0,
      last: 0,
      acc: 0,
    };
    setHud({ hitCount: 0, score: 0, cycle: 1 });
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

  function canvasPoint(clientX: number, clientY: number) {
    const canvas = canvasRef.current;
    if (!canvas) return START;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * W,
      y: ((clientY - rect.top) / rect.height) * H,
    };
  }

  function beginAim(clientX: number, clientY: number) {
    const s = state.current;
    if (!s.running || s.flying) return;
    s.aiming = true;
    s.aim = canvasPoint(clientX, clientY);
    haptic(4);
  }

  function moveAim(clientX: number, clientY: number) {
    if (!state.current.aiming || state.current.flying) return;
    state.current.aim = canvasPoint(clientX, clientY);
  }

  function releaseAim() {
    const s = state.current;
    if (!s.aiming || s.flying) return;
    const dx = s.aim.x - START.x;
    const dy = s.aim.y - START.y;
    const mag = Math.hypot(dx, dy);
    if (mag < 28) {
      s.aiming = false;
      return;
    }
    const power = Math.min(1, mag / 150);
    const angle = Math.atan2(dy, dx);
    const speed = 310 + power * 250;
    s.vx = Math.cos(angle) * speed;
    s.vy = Math.sin(angle) * speed;
    s.ball = { ...START };
    s.flying = true;
    s.aiming = false;
    s.shotTicks = 0;
    s.readyTicks = 0;
    gameTone("tap");
    haptic(8);
  }

  return (
    <div className="gameStage skillGameStage vectorArena">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="gameCanvas"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          beginAim(event.clientX, event.clientY);
        }}
        onPointerMove={(event) => moveAim(event.clientX, event.clientY)}
        onPointerUp={releaseAim}
        onPointerCancel={releaseAim}
        aria-label="Vector Strike"
      />
      <div className="vectorHud">
        <span>DIANAS {hud.hitCount}</span>
        <b>{hud.score.toLocaleString("es-ES")} pts</b>
        <span>NIVEL {hud.cycle}</span>
      </div>
      <div className="gameRule">Cada diana da paso a la siguiente · el primer fallo termina la partida</div>
    </div>
  );
}
