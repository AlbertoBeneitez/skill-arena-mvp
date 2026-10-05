"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameResult } from "@/lib/types";
import { gameTone, haptic } from "@/lib/gameFeedback";

type Props = { active: boolean; onFinish: (result: GameResult) => void };
type Platform = { y: number; gap: number; redStart: number; passed: boolean };

const W = 390;
const H = 620;
const DT = 1 / 120;
const CX = W / 2;
const RADIUS = 122;
const BALL_Y = 178;
const GAP_PATTERN = [-1.05,-0.42,0.35,1.15,0.68,-0.76,0.08,1.42,-1.34,0.52,-0.18,0.92];
const RED_PATTERN = [0.15,1.42,-0.68,0.78,-1.35,0.44,1.02,-0.08,1.62,-0.92,0.3,-1.58];

function wrap(angle: number) {
  let value = angle;
  while (value > Math.PI) value -= Math.PI * 2;
  while (value < -Math.PI) value += Math.PI * 2;
  return value;
}

function angleDiff(a: number, b: number) {
  return Math.abs(wrap(a - b));
}

export default function HelixDive({ active, onFinish }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const finishRef = useRef(onFinish);
  const turnRef = useRef<-1 | 0 | 1>(0);
  const state = useRef({
    rotation: 0,
    fall: 0,
    vy: 0,
    score: 0,
    passed: 0,
    running: false,
    ticks: 0,
    last: 0,
    acc: 0,
    platforms: [] as Platform[],
    next: 0,
  });
  const [hud, setHud] = useState({ passed: 0 });

  useEffect(() => {
    finishRef.current = onFinish;
  }, [onFinish]);

  const makePlatform = (index: number, y: number): Platform => ({
    y,
    gap: GAP_PATTERN[index % GAP_PATTERN.length],
    redStart: RED_PATTERN[index % RED_PATTERN.length],
    passed: false,
  });

  const finish = useCallback(() => {
    const s = state.current;
    if (!s.running) return;
    s.running = false;
    turnRef.current = 0;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    const timeMs = Math.round((s.ticks * 1000) / 120);
    gameTone("bad");
    haptic([30, 24, 50]);
    finishRef.current({ won: false, score: s.score, timeMs });
  }, []);

  const step = useCallback(() => {
    const s = state.current;
    s.ticks += 1;

    const rotationSpeed = Math.min(2.45, 1.55 + s.passed * 0.018);
    s.rotation += turnRef.current * rotationSpeed * DT;

    const gravity = 650 + Math.min(260, s.passed * 7);
    s.vy += gravity * DT;
    s.fall += s.vy * DT;

    const worldBallY = BALL_Y + s.fall;
    const gapHalf = Math.max(0.24, 0.48 - s.passed * 0.0045);

    for (const platform of s.platforms) {
      const screenY = platform.y - s.fall;
      if (screenY < 80 || screenY > H + 60) continue;

      if (
        !platform.passed &&
        worldBallY >= platform.y - 5 &&
        worldBallY <= platform.y + 18 &&
        s.vy > 0
      ) {
        const gapAngle = wrap(platform.gap + s.rotation);
        const redAngle = wrap(platform.redStart + s.rotation);
        const atGap = angleDiff(-Math.PI / 2, gapAngle) < gapHalf;
        const atRed = angleDiff(-Math.PI / 2, redAngle) < 0.34;

        if (atRed) {
          finish();
          return;
        }

        if (atGap) {
          platform.passed = true;
          s.passed += 1;
          s.score += 420 + Math.min(420, s.passed * 16);
          s.vy += 65;
          gameTone(s.passed % 5 === 0 ? "good" : "tap");
          if (s.passed % 5 === 0) haptic(8);

          const last = s.platforms[s.platforms.length - 1];
          s.platforms.push(makePlatform(s.next, last.y + 118));
          s.next += 1;
          if (s.platforms.length > 18) s.platforms.shift();
        } else {
          s.vy = -250;
          s.fall = platform.y - BALL_Y - 8;
          gameTone("tap");
          haptic(4);
        }
      }
    }

    if (s.ticks % 6 === 0) {
      setHud({ passed: s.passed });
    }
  }, [finish]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const s = state.current;

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#17234f");
    bg.addColorStop(1, "#0a1028");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(255,255,255,.04)";
    for (let y = 90; y < H; y += 45) ctx.fillRect(0, y, W, 1);

    const gapHalf = Math.max(0.24, 0.48 - s.passed * 0.0045);
    for (const platform of s.platforms) {
      const y = platform.y - s.fall;
      if (y < 70 || y > H + 70) continue;
      const scale = 0.62 + Math.min(1, Math.max(0, (y - 70) / (H - 70))) * 0.38;
      const radius = RADIUS * scale;

      ctx.save();
      ctx.translate(CX, y);
      ctx.scale(1, 0.28);
      ctx.lineWidth = 26 * scale;
      ctx.lineCap = "butt";
      ctx.strokeStyle = "rgba(116,156,224,.65)";
      ctx.beginPath();
      ctx.arc(0, 0, radius, -Math.PI, Math.PI);
      ctx.stroke();

      const gap = wrap(platform.gap + s.rotation);
      ctx.strokeStyle = "#0a1028";
      ctx.lineWidth = 31 * scale;
      ctx.beginPath();
      ctx.arc(0, 0, radius, gap - gapHalf, gap + gapHalf);
      ctx.stroke();

      const red = wrap(platform.redStart + s.rotation);
      ctx.strokeStyle = "#ef5264";
      ctx.lineWidth = 28 * scale;
      ctx.beginPath();
      ctx.arc(0, 0, radius, red - 0.32, red + 0.32);
      ctx.stroke();
      ctx.restore();
    }

    ctx.fillStyle = "rgba(78,111,173,.45)";
    ctx.fillRect(CX - 8, 76, 16, H - 76);

    ctx.shadowBlur = 20;
    ctx.shadowColor = "#ffd45a";
    ctx.fillStyle = "#ffd45a";
    ctx.beginPath();
    ctx.arc(CX, BALL_Y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = "rgba(10,18,44,.82)";
    ctx.fillRect(14, 14, W - 28, 52);
    ctx.font = "800 12px system-ui";
    ctx.fillStyle = "#fff";
    ctx.fillText(`PISOS ${s.passed}`, 26, 36);
    ctx.fillStyle = "#a9bce5";
    ctx.fillText("TOCA IZQ / DCHA", 246, 36);

    ctx.fillStyle = "rgba(104,185,255,.12)";
    ctx.fillRect(0, 92, W / 2, H - 92);
    ctx.fillRect(W / 2, 92, W / 2, H - 92);
    ctx.fillStyle = "rgba(255,255,255,.44)";
    ctx.font = "900 28px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("◀", W * 0.24, H - 58);
    ctx.fillText("▶", W * 0.76, H - 58);
    ctx.textAlign = "start";
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

    draw();
    if (s.running) rafRef.current = requestAnimationFrame(loop);
  }, [draw, step]);

  const start = useCallback(() => {
    const platforms: Platform[] = [];
    for (let index = 0; index < 10; index += 1) {
      platforms.push(makePlatform(index, 280 + index * 118));
    }

    state.current = {
      rotation: 0,
      fall: 0,
      vy: 0,
      score: 0,
      passed: 0,
      running: true,
      ticks: 0,
      last: 0,
      acc: 0,
      platforms,
      next: 10,
    };
    turnRef.current = 0;
    setHud({ passed: 0 });
    draw();
    rafRef.current = requestAnimationFrame(loop);
  }, [draw, loop]);

  useEffect(() => {
    if (active) start();
    return () => {
      state.current.running = false;
      turnRef.current = 0;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [active, start]);

  function setTurnFromPointer(clientX: number) {
    const canvas = canvasRef.current;
    if (!canvas || !state.current.running) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * W;
    turnRef.current = x < W / 2 ? -1 : 1;
    haptic(3);
  }

  function stopTurn() {
    turnRef.current = 0;
  }

  return (
    <div className="gameStage skillGameStage helixDiveArena">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="gameCanvas"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          setTurnFromPointer(event.clientX);
        }}
        onPointerMove={(event) => {
          if (event.buttons) setTurnFromPointer(event.clientX);
        }}
        onPointerUp={stopTurn}
        onPointerCancel={stopTurn}
        aria-label="Helix Dive"
      />
      <div className="helixTouchLegend">
        <span>◀ IZQUIERDA</span>
        <b>{hud.passed} pisos</b>
        <span>DERECHA ▶</span>
      </div>
      <div className="gameRule">Mantén pulsado el lado hacia el que quieras girar · tocar rojo termina</div>
    </div>
  );
}
