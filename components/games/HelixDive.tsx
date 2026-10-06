"use client";

import { useCallback, useEffect, useRef } from "react";
import type { GameResult } from "@/lib/types";
import { gameTone, haptic } from "@/lib/gameFeedback";

type Props = { active: boolean; onFinish: (result: GameResult) => void };
type Platform = { y: number; gap: number; redStart: number; passed: boolean };

const W = 390;
const H = 620;
const DT = 1 / 120;
const CX = W / 2;
const BALL_Y = 176;
const BALL_R = 13;
const RADIUS = 124;
const BALL_ANGLE = 0;
const BALL_X = CX + RADIUS * 0.75;
const PLATFORM_STEP = 118;

const GAP_PATTERN = [-1.08,-.46,.28,1.12,.66,-.82,.04,1.38,-1.28,.49,-.20,.90];
const RED_PATTERN = [.20,1.48,-.72,.82,-1.42,.47,1.06,-.14,1.57,-.96,.34,-1.54];

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
    last: 0,
    acc: 0,
    platforms: [] as Platform[],
    next: 0,
  });

  useEffect(() => {
    finishRef.current = onFinish;
  }, [onFinish]);

  const makePlatform = useCallback((index: number, y: number): Platform => ({
    y,
    gap: GAP_PATTERN[index % GAP_PATTERN.length],
    redStart: RED_PATTERN[index % RED_PATTERN.length],
    passed: false,
  }), []);

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

  const step = useCallback(() => {
    const s = state.current;
    s.ticks += 1;

    // Smooth left/right steering. The direction always matches the touched half.
    const maxTurn = Math.min(2.65, 1.92 + s.passed * 0.012);
    const targetAngularVelocity = turnRef.current * maxTurn;
    s.angularVelocity += (targetAngularVelocity - s.angularVelocity) * 0.16;
    if (turnRef.current === 0 && Math.abs(s.angularVelocity) < 0.002) {
      s.angularVelocity = 0;
    }
    s.rotation = wrap(s.rotation + s.angularVelocity * DT);

    const previousWorldY = BALL_Y + s.fall;
    const gravity = 650 + Math.min(250, s.passed * 6);
    s.vy += gravity * DT;
    s.fall += s.vy * DT;
    const currentWorldY = BALL_Y + s.fall;

    const gapHalf = Math.max(0.26, 0.49 - s.passed * 0.004);
    const redHalf = Math.min(0.39, 0.31 + s.passed * 0.0015);

    if (s.vy > 0) {
      for (const platform of s.platforms) {
        if (platform.passed) continue;

        const collisionY = platform.y - BALL_R * 0.25;
        const crossedPlatform =
          previousWorldY < collisionY && currentWorldY >= collisionY;

        if (!crossedPlatform) continue;

        const gapAngle = wrap(platform.gap + s.rotation);
        const redAngle = wrap(platform.redStart + s.rotation);
        const throughGap = angleDistance(BALL_ANGLE, gapAngle) <= gapHalf;
        const hitRed = angleDistance(BALL_ANGLE, redAngle) <= redHalf;

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

        // Safe section: bounce cleanly from the exact collision plane.
        s.fall = collisionY - BALL_Y - 0.5;
        s.vy = -285;
        gameTone("tap");
        haptic(4);
        break;
      }
    }
  }, [finish, makePlatform]);

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

    const gapHalf = Math.max(0.26, 0.49 - s.passed * 0.004);
    const redHalf = Math.min(0.39, 0.31 + s.passed * 0.0015);

    for (const platform of s.platforms) {
      const y = platform.y - s.fall;
      if (y < 62 || y > H + 70) continue;

      const perspective = Math.max(0.58, Math.min(1, 0.64 + (y / H) * 0.38));
      const radius = RADIUS * perspective;

      ctx.save();
      ctx.translate(CX, y);
      ctx.scale(1, 0.29);

      ctx.lineWidth = 27 * perspective;
      ctx.strokeStyle = "rgba(116,156,224,.72)";
      ctx.beginPath();
      ctx.arc(0, 0, radius, -Math.PI, Math.PI);
      ctx.stroke();

      const gap = wrap(platform.gap + s.rotation);
      ctx.lineWidth = 33 * perspective;
      ctx.strokeStyle = "#081026";
      ctx.beginPath();
      ctx.arc(0, 0, radius, gap - gapHalf, gap + gapHalf);
      ctx.stroke();

      const red = wrap(platform.redStart + s.rotation);
      ctx.lineWidth = 29 * perspective;
      ctx.strokeStyle = "#ef5264";
      ctx.beginPath();
      ctx.arc(0, 0, radius, red - redHalf, red + redHalf);
      ctx.stroke();

      ctx.restore();
    }

    ctx.fillStyle = "rgba(78,111,173,.42)";
    ctx.fillRect(CX - 7, 72, 14, H - 72);

    ctx.strokeStyle = "rgba(255,212,90,.34)";
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

    // Compact HUD.
    ctx.fillStyle = "rgba(8,16,38,.84)";
    ctx.fillRect(14, 14, W - 28, 48);
    ctx.fillStyle = "#fff";
    ctx.font = "900 12px system-ui";
    ctx.textAlign = "left";
    ctx.fillText(`PISOS ${s.passed}`, 26, 44);
    ctx.fillStyle = "#83e6f5";
    ctx.textAlign = "right";
    ctx.fillText("EVITA ROJO", W - 26, 44);

    // Touch zones are shown inside the playfield instead of separate buttons.
    ctx.fillStyle = "rgba(92,164,255,.07)";
    ctx.fillRect(0, 80, W / 2, H - 80);
    ctx.fillRect(W / 2, 80, W / 2, H - 80);
    ctx.fillStyle = "rgba(255,255,255,.42)";
    ctx.font = "900 30px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("◀", W * 0.24, H - 40);
    ctx.fillText("▶", W * 0.76, H - 40);
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
    for (let index = 0; index < 12; index += 1) {
      platforms.push(makePlatform(index, 278 + index * PLATFORM_STEP));
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

  const setDirection = useCallback((clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !state.current.running) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * W;
    const next: -1 | 1 = x < W / 2 ? -1 : 1;
    if (turnRef.current !== next) haptic(3);
    turnRef.current = next;
  }, []);

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
          setDirection(event.clientX);
        }}
        onPointerMove={(event) => {
          if (event.buttons) setDirection(event.clientX);
        }}
        onPointerUp={stopDirection}
        onPointerCancel={stopDirection}
        aria-label="Helix Dive"
      />
      <div className="gameRule floatingGameRule">Mantén izquierda o derecha para girar</div>
    </div>
  );
}
