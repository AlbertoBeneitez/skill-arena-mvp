"use client";
import type { GameRuntimeProps } from "@/lib/games";
import {
  BRICK_RELAY_CORE,
  relayBrickX,
  type BrickState,
} from "@/lib/verified/brickRelayCore.v1";
import { drawSpaceBackdrop } from "@/lib/spaceBackdrop";
import CoreCanvasGame from "./CoreCanvasGame";
const colors = ["#5e8fe8", "#6fd7c3", "#f0bb59", "#d97a8f", "#9f7ee2"];
function render(ctx: CanvasRenderingContext2D, s: BrickState) {
  drawSpaceBackdrop(ctx, 390, 620, s.tick * 0.045, s.tick);
  ctx.strokeStyle = "rgba(100,160,198,.15)";
  ctx.lineWidth = 1;
  ctx.strokeRect(4, 108, 382, 502);
  for (const b of s.bricks) {
    if (!b.hp) continue;
    const x = relayBrickX(b, s.tick) / 1000,
      y = b.y / 1000,
      w = b.w / 1000,
      h = b.h / 1000,
      color =
        b.kind === "armor"
          ? "#8996b9"
          : b.kind === "blast"
            ? "#f0bb59"
            : colors[b.id % 5];
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "rgba(255,255,255,.28)";
    ctx.fillRect(x + 2, y + 2, w - 4, 3);
    ctx.fillStyle = "rgba(0,0,0,.24)";
    ctx.fillRect(x + 2, y + h - 4, w - 4, 3);
    if (b.kind === "armor") {
      ctx.strokeStyle = "#d5dfee";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 4, y + 5, w - 8, h - 10);
      for (let i = 0; i < b.hp; i++) {
        ctx.fillStyle = "#ecf2fd";
        ctx.fillRect(x + w / 2 - 5 + i * 6, y + h / 2 - 1, 3, 3);
      }
    }
    if (b.kind === "blast") {
      ctx.fillStyle = "#3d2b13";
      ctx.beginPath();
      ctx.moveTo(x + w / 2, y + 4);
      ctx.lineTo(x + w / 2 + 6, y + 10);
      ctx.lineTo(x + w / 2, y + 16);
      ctx.lineTo(x + w / 2 - 6, y + 10);
      ctx.closePath();
      ctx.fill();
    }
    if (b.drift) {
      ctx.fillStyle = "rgba(255,255,255,.45)";
      ctx.fillRect(x + 4, y + 7, 3, 5);
      ctx.fillRect(x + w - 7, y + 7, 3, 5);
    }
  }
  const x = s.paddleX / 1000,
    w = s.paddleW / 1000;
  ctx.fillStyle = "#6de0ef";
  ctx.fillRect(x - w / 2, 570, w, 14);
  ctx.fillStyle = "#cef8ff";
  ctx.fillRect(x - w / 2 + 3, 572, w - 6, 3);
  ctx.fillStyle = "#16434d";
  ctx.fillRect(x - 2, 577, 4, 5);
  ctx.strokeStyle = "rgba(109,224,239,.3)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - w / 2 + 8, 567);
  ctx.lineTo(x - w / 2 - 4, 550);
  ctx.moveTo(x + w / 2 - 8, 567);
  ctx.lineTo(x + w / 2 + 4, 550);
  ctx.stroke();
  ctx.fillStyle = "#ffd864";
  ctx.beginPath();
  ctx.arc(s.ballX / 1000, s.ballY / 1000, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,232,168,.3)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(s.ballX / 1000, s.ballY / 1000);
  ctx.lineTo((s.ballX - s.vx * 7) / 1000, (s.ballY - s.vy * 7) / 1000);
  ctx.stroke();
  const age = s.tick - s.lastHitTick;
  if (age >= 0 && age < 24) {
    ctx.strokeStyle = `rgba(240,248,255,${1 - age / 24})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(
      s.lastHitX / 1000,
      s.lastHitY / 1000,
      10 + age * 1.5,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
  }
  const blast = s.tick - s.lastBlastTick;
  if (blast >= 0 && blast < 35) {
    ctx.strokeStyle = `rgba(255,204,113,${1 - blast / 35})`;
    ctx.beginPath();
    ctx.arc(
      s.lastHitX / 1000,
      s.lastHitY / 1000,
      18 + blast * 2,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
  }
  const miss = s.tick - s.lastMissTick;
  if (miss >= 0 && miss < 60) {
    ctx.fillStyle = `rgba(215,75,111,${0.18 * (1 - miss / 60)})`;
    ctx.fillRect(0, 0, 390, 620);
  }
  ctx.textAlign = "center";
  ctx.font = "12px system-ui";
  ctx.fillStyle = "#d3e4f6";
  if (s.waveUntil !== null)
    ctx.fillText("SECTOR COMPLETADO · RECUPERAS UNA VIDA", 195, 310);
}
const pointAction = (p: { x: number }, phase: "down" | "move" | "up") =>
  phase === "up"
    ? null
    : `AIM_${String(Math.max(0, Math.min(78, Math.round(p.x / 5)))).padStart(3, "0")}`;
const keys = { ArrowLeft: "LEFT", ArrowRight: "RIGHT" } as const;
const hudLabel = (s: Readonly<BrickState>) =>
  `SECTOR ${s.wave}/4 · ${s.destroyed} BLOQUES`;
export default function BrickRelayVerified(props: GameRuntimeProps) {
  return (
    <CoreCanvasGame
      {...props}
      core={BRICK_RELAY_CORE}
      name="Brick Relay"
      render={render}
      pointAction={pointAction}
      keys={keys}
      hudLabel={hudLabel}
      instruction="Arrastra para mover · los bordes cambian el ángulo del rebote"
    />
  );
}
