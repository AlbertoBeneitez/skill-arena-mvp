"use client";

import { useCallback, useEffect, useRef } from "react";
import type { GameResult } from "@/lib/types";
import { gameTone, haptic } from "@/lib/gameFeedback";

type Props = { active: boolean; onFinish: (result: GameResult) => void };
type Platform = {
  y: number;
  gap: number;
  redStart: number;
  passed: boolean;
  safeStart: boolean;
};

const W = 390;
const H = 620;
const DT = 1 / 120;
const CX = W / 2;
const BALL_Y = 182;
const BALL_R = 13;
const RADIUS = 126;
const BALL_ANGLE = 0;
const BALL_X = CX + RADIUS * 0.75;
const PLATFORM_STEP = 122;
const WARMUP_TICKS = 96;

const GAP_PATTERN = [0.55, -0.62, 0.92, -1.14, 0.34, 1.36, -0.28, -1.42, 0.76, -0.88, 1.12, -0.46];
const RED_PATTERN = [Math.PI, 1.46, -0.72, 0.82, -1.42, 0.47, 1.06, -0.14, 1.57, -0.96, 0.34, -1.54];

function wrap(angle: number) {
  let value = angle;
  while (value > Math.PI) value -= Math.PI * 2;
  while (value < -Math.PI) value += Math.PI * 2;
  return value;
}

function angleDistance(a: number, b: number) {
  return Math.abs(wrap(a - b));
}

export default function HelixDive({ active, onFinish }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const finishRef = useRef(onFinish);
  const turnRef = useRef<-1 | 0 | 1>(0);

  const state = useRef({
    rotation: 0,
    angularVelocity: 0,
    fall: 0,
    vy: 0,
    score: 0,
    passed: 0,
    running: false,
    ticks: 0,
    warmupTicks: WARMUP_TICKS,
    last: 0,
    acc: 0,
    platforms: [] as Platform[],
    next: 0,
  });

  useEffect(() => {
    finishRef.current = onFinish;
  }, [onFinish]);

  const makePlatform = useCallback((index: number, y: number): Platform => {
    if (index === 0) {
      return {
        y,
        gap: BALL_ANGLE,
        redStart: Math.PI,
        passed: false,
        safeStart: true,
      };
    }

    return {
      y,
      gap: GAP_PATTERN[(index - 1) % GAP_PATTERN.length],
      redStart: RED_PATTERN[index % RED_PATTERN.length],
      passed: false,
      safeStart: index === 1,
    };
  }, []);

  const finish = useCallback(() => {
    const s = state.current;
    if (!s.running) return;

    s.running = false;
    turnRef.current = 0;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);

    gameTone("bad");
    haptic([30, 24, 50]);

    finishRef.current({
      won: false,
      score: s.score,
      timeMs: Math.round((s.ticks * 1000) / 120),
    });
  }, []);

  const updateRotation = useCallback(() => {
    const s = state.current;
    const maxTurn = Math.min(2.55, 1.78 + s.passed * 0.014);
    const target = turnRef.current * maxTurn;

    s.angularVelocity += (target - s.angularVelocity) * 0.2;
    if (turnRef.current === 0) s.angularVelocity *= 0.88;
    if (Math.abs(s.angularVelocity) < 0.001) s.angularVelocity = 0;

    s.rotation = wrap(s.rotation + s.angularVelocity * DT);
  }, []);

  const step = useCallback(() => {
    const s = state.current;
    s.ticks += 1;
    updateRotation();

    if (s.warmupTicks > 0) {
      s.warmupTicks -= 1;
      return;
    }

    const previousWorldY = BALL_Y + s.fall;
    const gravity = 610 + Math.min(260, s.passed * 7);
    s.vy += gravity * DT;
    s.fall += s.vy * DT;
    const currentWorldY = BALL_Y + s.fall;

    const gapHalf = Math.max(0.27, 0.5 - s.passed * 0.004);
    const redHalf = Math.min(0.4, 0.31 + s.passed * 0.0015);

    if (s.vy <= 0) return;

    for (const platform of s.platforms) {
      if (platform.passed) continue;

      const collisionY = platform.y - BALL_R * 0.2;
      const crossed =
        previousWorldY < collisionY && currentWorldY >= collisionY;

      if (!crossed) continue;

      const gapAngle = wrap(platform.gap + s.rotation);
      const redAngle = wrap(platform.redStart + s.rotation);

      const throughGap =
        angleDistance(BALL_ANGLE, gapAngle) <= gapHalf;
      const hitRed =
        !platform.safeStart &&
        angleDistance(BALL_ANGLE, redAngle) <= redHalf;

      if (hitRed) {
        finish();
        return;
      }

      if (throughGap) {
        platform.passed = true;
        s.passed += 1;
        s.score += 420 + Math.min(500, s.passed * 18);

        const last = s.platforms[s.platforms.length - 1];
        s.platforms.push(
          makePlatform(s.next, last.y + PLATFORM_STEP)
        );
        s.next += 1;
        if (s.platforms.length > 20) s.platforms.shift();

        gameTone(s.passed % 5 === 0 ? "good" : "tap");
        if (s.passed % 5 === 0) haptic(8);
        continue;
      }

      s.fall = collisionY - BALL_Y - 0.5;
      s.vy = -275;
      gameTone("tap");
      haptic(4);
      break;
    }
  }, [finish, makePlatform, updateRotation]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const s = state.current;

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#17234f");
    bg.addColorStop(1, "#081026");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(255,255,255,.035)";
    for (let y = 84; y < H; y += 44) ctx.fillRect(0, y, W, 1);

    const gapHalf = Math.max(0.27, 0.5 - s.passed * 0.004);
    const redHalf = Math.min(0.4, 0.31 + s.passed * 0.0015);

    for (const platform of s.platforms) {
      const y = platform.y - s.fall;
      if (y < 62 || y > H + 70) continue;

      const perspective = Math.max(
        0.58,
        Math.min(1, 0.64 + (y / H) * 0.38)
      );
      const radius = RADIUS * perspective;

      ctx.save();
      ctx.translate(CX, y);
      ctx.scale(1, 0.29);

      ctx.lineWidth = 27 * perspective;
      ctx.strokeStyle = "rgba(116,156,224,.78)";
      ctx.beginPath();
      ctx.arc(0, 0, radius, -Math.PI, Math.PI);
      ctx.stroke();

      const gap = wrap(platform.gap + s.rotation);
      ctx.lineWidth = 34 * perspective;
      ctx.strokeStyle = "#081026";
      ctx.beginPath();
      ctx.arc(0, 0, radius, gap - gapHalf, gap + gapHalf);
      ctx.stroke();

      if (!platform.safeStart) {
        const red = wrap(platform.redStart + s.rotation);
        ctx.lineWidth = 29 * perspective;
        ctx.strokeStyle = "#ef5264";
        ctx.beginPath();
        ctx.arc(0, 0, radius, red - redHalf, red + redHalf);
        ctx.stroke();
      }

      ctx.restore();
    }

    ctx.fillStyle = "rgba(78,111,173,.42)";
    ctx.fillRect(CX - 7, 72, 14, H - 72);

    ctx.strokeStyle = "rgba(255,212,90,.35)";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.moveTo(CX, BALL_Y);
    ctx.lineTo(BALL_X, BALL_Y);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.shadowBlur = 22;
    ctx.shadowColor = "#ffd45a";
    ctx.fillStyle = "#ffd45a";
    ctx.beginPath();
    ctx.arc(BALL_X, BALL_Y, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = "rgba(8,16,38,.88)";
    ctx.fillRect(14, 14, W - 28, 48);
    ctx.fillStyle = "#fff";
    ctx.font = "900 12px system-ui";
    ctx.textAlign = "left";
    ctx.fillText(`PISOS ${s.passed}`, 26, 44);
    ctx.fillStyle = "#83e6f5";
    ctx.textAlign = "right";
    ctx.fillText(
      s.warmupTicks > 0 ? "PREPÁRATE" : "EVITA ROJO",
      W - 26,
      44
    );

    if (s.warmupTicks > 0) {
      const seconds = Math.max(
        1,
        Math.ceil(s.warmupTicks / 120)
      );

      ctx.fillStyle = "rgba(7,15,34,.68)";
      ctx.fillRect(72, 244, W - 144, 96);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.font = "950 16px system-ui";
      ctx.fillText("COLOCA EL HUECO", CX, 279);
      ctx.fillStyle = "#ffd45a";
      ctx.font = "950 28px system-ui";
      ctx.fillText(String(seconds), CX, 318);
      ctx.textAlign = "start";
    }
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
    for (let index = 0; index < 12; index += 1) {
      platforms.push(
        makePlatform(index, 316 + index * PLATFORM_STEP)
      );
    }

    state.current = {
      rotation: 0,
      angularVelocity: 0,
      fall: 0,
      vy: 0,
      score: 0,
      passed: 0,
      running: true,
      ticks: 0,
      warmupTicks: WARMUP_TICKS,
      last: 0,
      acc: 0,
      platforms,
      next: 12,
    };

    turnRef.current = 0;
    draw();
    rafRef.current = requestAnimationFrame(loop);
  }, [draw, loop, makePlatform]);

  useEffect(() => {
    if (active) start();

    return () => {
      state.current.running = false;
      turnRef.current = 0;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [active, start]);

  const setDirection = useCallback((direction: -1 | 1) => {
    if (!state.current.running) return;
    if (turnRef.current !== direction) haptic(3);
    turnRef.current = direction;
  }, []);

  const setDirectionFromX = useCallback((clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !state.current.running) return;

    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * W;
    setDirection(x < W / 2 ? -1 : 1);
  }, [setDirection]);

  const stopDirection = useCallback(() => {
    turnRef.current = 0;
  }, []);

  return (
    <div className="gameStage skillGameStage helixDiveArena">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="gameCanvas"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          setDirectionFromX(event.clientX);
        }}
        onPointerMove={(event) => {
          if (event.buttons) setDirectionFromX(event.clientX);
        }}
        onPointerUp={stopDirection}
        onPointerCancel={stopDirection}
        aria-label="Helix Dive"
      />

      <div className="helixControlKeys" aria-label="Controles de giro">
        <button
          type="button"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            setDirection(-1);
          }}
          onPointerUp={stopDirection}
          onPointerCancel={stopDirection}
        >
          <span>◀</span>
          <b>IZQUIERDA</b>
        </button>
        <button
          type="button"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            setDirection(1);
          }}
          onPointerUp={stopDirection}
          onPointerCancel={stopDirection}
        >
          <b>DERECHA</b>
          <span>▶</span>
        </button>
      </div>
    </div>
  );
}
