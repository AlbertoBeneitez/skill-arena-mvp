"use client";
import type { GameRuntimeProps } from "@/lib/games";
import {
  JET_STREAM_CORE_V2,
  type JetStreamV2State,
} from "@/lib/verified/jetStreamCore.v2";
import { drawJetBackground, drawJetShip } from "./jet-stream/presentation";
import CoreCanvasGame from "./CoreCanvasGame";
function render(ctx: CanvasRenderingContext2D, state: JetStreamV2State) {
  drawJetBackground(ctx, state);
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
    let previous = 0;
    for (const window of gate.windows) {
      const top = (window.centerYMilli - window.gapMilli / 2) / 1000,
        bottom = (window.centerYMilli + window.gapMilli / 2) / 1000;
      segment(previous, top);
      previous = bottom;
    }
    segment(previous, 620);
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
const keys = { " ": "FLAP", ArrowUp: "FLAP" } as const;
export default function JetStreamV2(props: GameRuntimeProps) {
  return (
    <CoreCanvasGame
      {...props}
      core={JET_STREAM_CORE_V2}
      name="Jet Stream"
      render={render}
      primaryAction="FLAP"
      keys={keys}
      instruction="Toca para subir. Elige un paso y recoge las recargas de vida."
    />
  );
}
