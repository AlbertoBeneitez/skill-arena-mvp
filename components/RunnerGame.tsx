"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type GameResult = { won: boolean; score: number; timeMs: number };

type Props = {
  active: boolean;
  onFinish: (result: GameResult) => void;
};

const WIDTH = 900;
const HEIGHT = 360;
const GROUND = 292;
const PLAYER_X = 135;
const PLAYER_W = 34;
const PLAYER_H = 42;
const SPEED = 265;
const GRAVITY = 1850;
const JUMP = -680;
const FINISH_X = 4300;
const OBSTACLES = [
  [650, 42, 48], [920, 48, 68], [1210, 38, 44], [1460, 44, 84],
  [1750, 50, 54], [2020, 42, 76], [2300, 38, 48], [2540, 46, 92],
  [2820, 42, 58], [3100, 52, 72], [3380, 40, 48], [3650, 46, 88],
  [3920, 40, 56]
] as const;

export default function RunnerGame({ active, onFinish }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const stateRef = useRef({ y: GROUND - PLAYER_H, vy: 0, worldX: 0, last: 0, startedAt: 0, running: false });
  const [status, setStatus] = useState<"ready" | "running" | "lost" | "won">("ready");

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const s = stateRef.current;

    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    sky.addColorStop(0, "#11182a");
    sky.addColorStop(1, "#07101b");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.strokeStyle = "rgba(255,255,255,.045)";
    ctx.lineWidth = 1;
    for (let x = -((s.worldX * 0.25) % 60); x < WIDTH; x += 60) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, GROUND); ctx.stroke();
    }
    for (let y = 40; y < GROUND; y += 50) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WIDTH, y); ctx.stroke();
    }

    ctx.fillStyle = "#17243a";
    ctx.fillRect(0, GROUND, WIDTH, HEIGHT - GROUND);
    ctx.fillStyle = "#2b4062";
    ctx.fillRect(0, GROUND, WIDTH, 4);

    const finishScreenX = FINISH_X - s.worldX + PLAYER_X;
    if (finishScreenX < WIDTH + 80) {
      ctx.fillStyle = "#7cf29a";
      ctx.fillRect(finishScreenX, 72, 5, GROUND - 72);
      ctx.font = "700 14px system-ui";
      ctx.fillText("META", finishScreenX - 16, 58);
    }

    for (const [ox, ow, oh] of OBSTACLES) {
      const x = ox - s.worldX + PLAYER_X;
      if (x < -80 || x > WIDTH + 80) continue;
      const grad = ctx.createLinearGradient(x, GROUND - oh, x + ow, GROUND);
      grad.addColorStop(0, "#ff7f6a");
      grad.addColorStop(1, "#ff4f72");
      ctx.fillStyle = grad;
      ctx.fillRect(x, GROUND - oh, ow, oh);
    }

    ctx.fillStyle = "#66e3ff";
    ctx.fillRect(PLAYER_X, s.y, PLAYER_W, PLAYER_H);
    ctx.fillStyle = "#07101b";
    ctx.fillRect(PLAYER_X + 20, s.y + 9, 7, 7);

    ctx.fillStyle = "rgba(255,255,255,.75)";
    ctx.font = "600 14px system-ui";
    ctx.fillText(`Recorrido: ${Math.min(100, Math.round((s.worldX / FINISH_X) * 100))}%`, 20, 28);
  }, []);

  const finish = useCallback((won: boolean) => {
    const s = stateRef.current;
    if (!s.running) return;
    s.running = false;
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    const timeMs = Math.max(1, performance.now() - s.startedAt);
    const score = won ? Math.max(1000, Math.round(1000000 / timeMs)) : Math.round(s.worldX);
    setStatus(won ? "won" : "lost");
    onFinish({ won, score, timeMs: Math.round(timeMs) });
  }, [onFinish]);

  const loop = useCallback((now: number) => {
    const s = stateRef.current;
    if (!s.running) return;
    const dt = Math.min(0.032, (now - s.last) / 1000 || 0);
    s.last = now;
    s.worldX += SPEED * dt;
    s.vy += GRAVITY * dt;
    s.y += s.vy * dt;
    if (s.y > GROUND - PLAYER_H) {
      s.y = GROUND - PLAYER_H;
      s.vy = 0;
    }

    const px1 = s.worldX;
    const px2 = px1 + PLAYER_W;
    const py1 = s.y;
    const py2 = s.y + PLAYER_H;
    for (const [ox, ow, oh] of OBSTACLES) {
      const collisionX = px2 > ox && px1 < ox + ow;
      const obstacleTop = GROUND - oh;
      const collisionY = py2 > obstacleTop && py1 < GROUND;
      if (collisionX && collisionY) {
        finish(false);
        draw();
        return;
      }
    }
    if (s.worldX >= FINISH_X) {
      finish(true);
      draw();
      return;
    }
    draw();
    frameRef.current = requestAnimationFrame(loop);
  }, [draw, finish]);

  const start = useCallback(() => {
    const s = stateRef.current;
    s.y = GROUND - PLAYER_H;
    s.vy = 0;
    s.worldX = 0;
    s.last = performance.now();
    s.startedAt = s.last;
    s.running = true;
    setStatus("running");
    draw();
    frameRef.current = requestAnimationFrame(loop);
  }, [draw, loop]);

  const jump = useCallback(() => {
    const s = stateRef.current;
    const grounded = Math.abs(s.y - (GROUND - PLAYER_H)) < 2;
    if (s.running && grounded) s.vy = JUMP;
  }, []);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    if (active) start();
    return () => {
      stateRef.current.running = false;
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [active, start]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        jump();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [jump]);

  return (
    <div className="gameShell">
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        className="gameCanvas"
        onPointerDown={jump}
        aria-label="Juego de carrera determinista"
      />
      <div className="gameFooter">
        <span>Espacio / ↑ / tocar pantalla para saltar</span>
        <span className={`statusDot ${status}`}>{status === "running" ? "EN PARTIDA" : status.toUpperCase()}</span>
      </div>
    </div>
  );
}
