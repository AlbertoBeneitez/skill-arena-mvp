"use client";
import type { GameRuntimeProps } from "@/lib/games";
import {
  JET_STREAM_CORE_V4,
  type JetStreamV4State,
} from "@/lib/verified/jetStreamCore.v4";
import { drawJetBackground, drawJetShip } from "./jet-stream/presentation";
import CoreCanvasGame from "./CoreCanvasGame";
function render(ctx: CanvasRenderingContext2D, state: JetStreamV4State) {
  drawJetBackground(ctx, state);
  // Extend only the opaque bodies through visual letterboxing. The signed
  // 390×620 field, windows and colliders stay exactly V4 in every viewport.
  const transform = ctx.getTransform();
  const topOfCanvas =
    transform.d > 0 ? Math.min(0, -transform.f / transform.d) : 0;
  const bottomOfCanvas =
    transform.d > 0
      ? Math.max(620, (ctx.canvas.height - transform.f) / transform.d)
      : 620;
  for (const gate of state.gates) {
    const x = (gate.worldXMilli - state.scrollMilli) / 1000;
    if (x < -50 || x > 420) continue;
    const segment = (top: number, bottom: number) => {
      if (bottom <= top) return;
      const gradient = ctx.createLinearGradient(x, 0, x + 30, 0);
      gradient.addColorStop(0, gate.damaged ? "#744368" : "#1c4d66");
      gradient.addColorStop(0.5, gate.damaged ? "#b77279" : "#3498b3");
      gradient.addColorStop(1, "#153147");
      ctx.fillStyle = gradient;
      ctx.fillRect(x, top, 30, bottom - top);
      ctx.strokeStyle = "#86d8df";
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, top + 1, 28, bottom - top - 2);
      ctx.fillStyle = "#b9ffff";
      ctx.fillRect(x, top, 30, 3);
      ctx.fillRect(x, bottom - 3, 30, 3);
    };
    let previous = topOfCanvas;
    for (const window of gate.windows) {
      const top = (window.centerYMilli - window.gapMilli / 2) / 1000,
        bottom = (window.centerYMilli + window.gapMilli / 2) / 1000;
      segment(previous, top);
      previous = bottom;
    }
    segment(previous, bottomOfCanvas);
    if (gate.pickup && !gate.collected) {
      const y = gate.centerYMilli / 1000;
      ctx.save();
      ctx.translate(x + 15, y);
      ctx.shadowColor = "#77ffc5";
      ctx.shadowBlur = 16;
      ctx.fillStyle = "#9affd3";
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#155d59";
      ctx.fillRect(-6, -2, 12, 4);
      ctx.fillRect(-2, -6, 4, 12);
      ctx.restore();
    }
  }
  ctx.save();
  if (state.tick < state.shieldUntilTick && Math.floor(state.tick / 8) % 2)
    ctx.globalAlpha = 0.45;
  if (state.status !== "failed")
    drawJetShip(
      ctx,
      state,
      Math.max(0, 1 - (state.tick - state.lastFlapTick) / 16),
    );
  ctx.restore();
  ctx.font = "bold 12px system-ui";
  ctx.fillStyle = "#b9e8ff";
  ctx.textAlign = "center";
  ctx.fillText(
    `${state.passed} PORTALES · ${state.collected} RECARGAS`,
    195,
    82,
  );
  ctx.textAlign = "left";
}
const failureFinale = {
  durationMs: 720,
  render(
    ctx: CanvasRenderingContext2D,
    state: JetStreamV4State,
    elapsedMs: number,
  ) {
    const t = Math.min(1, elapsedMs / 720),
      x = 92,
      y = state.yMilli / 1000;
    ctx.save();
    ctx.globalAlpha = 1 - t;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, 18 + t * 68);
    glow.addColorStop(0, "rgba(255,244,196,.95)");
    glow.addColorStop(0.3, "rgba(255,147,78,.7)");
    glow.addColorStop(1, "rgba(255,80,120,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, 18 + t * 68, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffe8a8";
    ctx.lineWidth = 3 * (1 - t) + 1;
    ctx.beginPath();
    ctx.arc(x, y, 8 + t * 82, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 24; i++) {
      const angle = (i * Math.PI * 2) / 24,
        distance = t * (30 + (i % 5) * 13);
      ctx.fillStyle = i % 2 ? "#ffad77" : "#fff4ce";
      const px = x + Math.cos(angle) * distance,
        py = y + Math.sin(angle) * distance + t * t * 18;
      ctx.fillRect(px - 2, py - 2, 4 * (1 - t) + 1, 4 * (1 - t) + 1);
    }
    ctx.restore();
  },
};
const inputTones = { FLAP: "tap" } as const;
const keys = { " ": "FLAP", ArrowUp: "FLAP" } as const;
export default function JetStreamV3(props: GameRuntimeProps) {
  return (
    <CoreCanvasGame
      {...props}
      core={JET_STREAM_CORE_V4}
      name="Jet Stream"
      hideHudLabel
      hideHudScore
      failureFinale={failureFinale}
      render={render}
      primaryAction="FLAP"
      keys={keys}
      inputTones={inputTones}
      instruction="Toques cortos para subir. Pasa por un hueco y recoge escudos verdes."
    />
  );
}
