"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameResult } from "@/lib/types";

type Props = {
  active: boolean;
  onFinish: (result: GameResult) => void;
};

const WIDTH = 390;
const HEIGHT = 700;
const GROUND = 590;
const PLAYER_X = 72;
const PLAYER_W = 38;
const PLAYER_H = 48;
const SPEED = 265;
const GRAVITY = 1850;
const JUMP = -680;
const FINISH_X = 4300;
const OBSTACLES = [
  [650, 42, 48], [920, 48, 68], [1210, 38, 44], [1460, 44, 84],
  [1750, 50, 54], [2020, 42, 76], [2300, 38, 48], [2540, 46, 92],
  [2820, 42, 58], [3100, 52, 72], [3380, 40, 48], [3650, 46, 88],
  [3920, 40, 56],
] as const;

export default function NeonDash({ active, onFinish }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const onFinishRef = useRef(onFinish);
  const stateRef = useRef({
    y: GROUND - PLAYER_H,
    vy: 0,
    worldX: 0,
    last: 0,
    startedAt: 0,
    running: false,
  });
  const [status, setStatus] = useState<"ready" | "running" | "lost" | "won">("ready");

  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const s = stateRef.current;

    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#081018";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.strokeStyle = "rgba(121,255,182,.08)";
    ctx.lineWidth = 1;
    for (let x = -((s.worldX * 0.25) % 52); x < WIDTH; x += 52) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, GROUND);
      ctx.stroke();
    }
    for (let y = 72; y < GROUND; y += 72) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WIDTH, y);
      ctx.stroke();
    }

    const progress = Math.min(100, Math.round((s.worldX / FINISH_X) * 100));
    ctx.fillStyle = "#1c2a24";
    ctx.fillRect(20, 24, WIDTH - 40, 7);
    ctx.fillStyle = "#79ffb6";
    ctx.fillRect(20, 24, ((WIDTH - 40) * progress) / 100, 7);
    ctx.fillStyle = "#d9ffe9";
    ctx.font = "700 14px ui-monospace, monospace";
    ctx.fillText(`${progress}%`, 20, 52);

    ctx.fillStyle = "#122018";
    ctx.fillRect(0, GROUND, WIDTH, HEIGHT - GROUND);
    ctx.fillStyle = "#79ffb6";
    ctx.fillRect(0, GROUND, WIDTH, 4);

    const finishScreenX = FINISH_X - s.worldX + PLAYER_X;
    if (finishScreenX > -50 && finishScreenX < WIDTH + 50) {
      ctx.fillStyle = "#ffe36e";
      ctx.fillRect(finishScreenX, 128, 5, GROUND - 128);
      ctx.fillText("META", finishScreenX - 18, 110);
    }

    for (const [ox, ow, oh] of OBSTACLES) {
      const x = ox - s.worldX + PLAYER_X;
      if (x < -80 || x > WIDTH + 80) continue;
      const obstacleY = GROUND - oh;
      ctx.fillStyle = "#ff6b77";
      ctx.fillRect(x, obstacleY, ow, oh);
      ctx.fillStyle = "#ffc0c6";
      ctx.fillRect(x, obstacleY, ow, 3);
    }

    ctx.fillStyle = "#79ffb6";
    ctx.fillRect(PLAYER_X, s.y, PLAYER_W, PLAYER_H);
    ctx.fillStyle = "#06110b";
    ctx.fillRect(PLAYER_X + 23, s.y + 10, 7, 7);
    ctx.fillStyle = "#e4fff0";
    ctx.fillRect(PLAYER_X + 5, s.y + PLAYER_H - 7, 9, 7);
    ctx.fillRect(PLAYER_X + PLAYER_W - 14, s.y + PLAYER_H - 7, 9, 7);

    ctx.fillStyle = "#79ffb6";
    ctx.beginPath();
    ctx.moveTo(PLAYER_X + PLAYER_W / 2, s.y - 14);
    ctx.lineTo(PLAYER_X + PLAYER_W / 2 - 7, s.y - 26);
    ctx.lineTo(PLAYER_X + PLAYER_W / 2 + 7, s.y - 26);
    ctx.closePath();
    ctx.fill();

    if (s.running && s.worldX < 360) {
      ctx.fillStyle = "#ffffff";
      ctx.font = "800 18px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText("TOCA PARA SALTAR", WIDTH / 2, 110);
      ctx.textAlign = "start";
    }

    if (!s.running && s.worldX === 0) {
      ctx.fillStyle = "rgba(255,255,255,.7)";
      ctx.font = "700 17px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText("NEON DASH", WIDTH / 2, 118);
      ctx.font = "500 13px ui-monospace, monospace";
      ctx.fillStyle = "rgba(255,255,255,.45)";
      ctx.fillText("Pulsa JUGAR para comenzar", WIDTH / 2, 144);
      ctx.textAlign = "start";
    }
  }, []);

  const finish = useCallback((won: boolean) => {
    const s = stateRef.current;
    if (!s.running) return;
    s.running = false;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    const timeMs = Math.max(1, performance.now() - s.startedAt);
    const score = won ? Math.max(1000, Math.round(1000000 / timeMs)) : Math.round(s.worldX);
    setStatus(won ? "won" : "lost");
    onFinishRef.current({ won, score, timeMs: Math.round(timeMs) });
  }, []);

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

  useEffect(() => { draw(); }, [draw]);

  useEffect(() => {
    if (active) start();
    return () => {
      stateRef.current.running = false;
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
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
    <div className="gameStage">
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        className="gameCanvas"
        onPointerDown={(e) => { e.preventDefault(); jump(); }}
        aria-label="Neon Dash"
      />
      <button className="jumpButton" type="button" onPointerDown={(e) => { e.preventDefault(); jump(); }} disabled={status !== "running"}>
        {status === "running" ? "SALTAR" : "ESPERANDO"}
      </button>
    </div>
  );
}
