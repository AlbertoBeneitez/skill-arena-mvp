"use client";
import type { GameRuntimeProps } from "@/lib/games";
import { drawSpaceBackdrop } from "@/lib/spaceBackdrop";
import {
  riverLaneRects,
  type RiverState,
} from "@/lib/verified/riverDashCore.v1";
import { RIVER_DASH_CORE_V2 } from "@/lib/verified/riverDashCore.v2";
import CoreCanvasGame from "./CoreCanvasGame";
function render(ctx: CanvasRenderingContext2D, state: RiverState) {
  drawSpaceBackdrop(ctx, 390, 620, 3, state.tick);
  const ox = 15,
    oy = 58,
    cell = 44;
  state.lanes.forEach((lane, row) => {
    const y = oy + row * cell;
    ctx.fillStyle =
      lane.kind === "safe"
        ? "rgba(18,64,65,.95)"
        : lane.kind === "river"
          ? "rgba(14,34,77,.92)"
          : "rgba(24,35,53,.92)";
    ctx.fillRect(ox, y, 360, cell);
    ctx.strokeStyle =
      lane.kind === "river" ? "rgba(90,167,246,.22)" : "rgba(115,224,219,.18)";
    ctx.beginPath();
    ctx.moveTo(ox, y);
    ctx.lineTo(375, y);
    ctx.stroke();
    if (lane.kind === "safe") {
      ctx.fillStyle = "rgba(145,247,229,.3)";
      for (let x = ox + 9; x < 375; x += 40)
        ctx.fillRect(x, y + cell / 2 - 1, 18, 3);
      return;
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(ox, y, 360, cell);
    ctx.clip();
    for (const rect of riverLaneRects(state, row)) {
      const x = ox + rect.xMilli / 1000,
        w = rect.wMilli / 1000;
      ctx.fillStyle = lane.kind === "river" ? "#275b78" : "#bf7286";
      ctx.beginPath();
      ctx.roundRect(x, y + 7, w, cell - 14, 6);
      ctx.fill();
      ctx.strokeStyle = lane.kind === "river" ? "#81d9e7" : "#ffc2be";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = lane.kind === "river" ? "#91ebe3" : "#ffd5be";
      ctx.fillRect(x + 7, y + 12, Math.max(5, w - 14), 3);
      ctx.fillStyle = "#173548";
      ctx.fillRect(x + w * 0.35, y + 19, w * 0.3, 8);
    }
    ctx.restore();
  });
  const x = 15 + state.xMilli / 1000,
    y = oy + (state.row + 0.5) * 44;
  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = "#9effde";
  ctx.shadowBlur = 12;
  ctx.fillStyle = "#b2ffda";
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.lineTo(11, 8);
  ctx.lineTo(0, 5);
  ctx.lineTo(-11, 8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.font = "bold 12px system-ui";
  ctx.textAlign = "center";
  ctx.fillStyle = "#bbf8ed";
  ctx.fillText(
    state.tick - state.lastCrossTick < 60
      ? `CRUCE ${state.crossings} COMPLETADO`
      : `${state.crossings} CRUCES`,
    195,
    42,
  );
  ctx.textAlign = "left";
}
const keys = {
  ArrowUp: "UP",
  ArrowDown: "DOWN",
  ArrowLeft: "LEFT",
  ArrowRight: "RIGHT",
  w: "UP",
  s: "DOWN",
  a: "LEFT",
  d: "RIGHT",
} as const;
const controls = [
  { action: "LEFT", label: "Izquierda", symbol: "←" },
  { action: "UP", label: "Arriba", symbol: "↑" },
  { action: "DOWN", label: "Abajo", symbol: "↓" },
  { action: "RIGHT", label: "Derecha", symbol: "→" },
] as const;
export default function RiverDashVerified(props: GameRuntimeProps) {
  return (
    <div className="riverVerified">
      <CoreCanvasGame
        {...props}
        core={RIVER_DASH_CORE_V2}
        name="River Dash"
        render={render}
        keys={keys}
        controls={controls}
        gestureAction={(a, b) => {
          const dx = b.x - a.x,
            dy = b.y - a.y;
          if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return null;
          return Math.abs(dx) > Math.abs(dy)
            ? dx > 0
              ? "RIGHT"
              : "LEFT"
            : dy > 0
              ? "DOWN"
              : "UP";
        }}
        instruction="Evita el tráfico. Apóyate por completo y avanza con las plataformas."
      />
    </div>
  );
}
