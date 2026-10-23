"use client";
import type { GameRuntimeProps } from "@/lib/games";
import { drawSpaceBackdrop } from "@/lib/spaceBackdrop";
import {
  RIVER_DASH_CORE_V4,
  type RiverV4State,
  riverRectsV4,
} from "@/lib/verified/riverDashCore.v4";
import CoreCanvasGame from "./CoreCanvasGame";
function render(ctx: CanvasRenderingContext2D, state: RiverV4State) {
  // Arrival/camera only: the core has already evaluated the destination.
  const age = Math.max(0, Math.min(1, (state.tick - state.lastMoveTick) / 12));
  const ease = state.status === "running" ? 1 - (1 - age) ** 3 : 1;
  const rowPosition = state.fromRow + (state.row - state.fromRow) * ease;
  const cameraRows = Math.max(0, rowPosition - 4);
  drawSpaceBackdrop(ctx, 390, 620, cameraRows * 15, state.tick);
  const ox = 15,
    oy = 58,
    cell = 44;
  // A contained field keeps every playable edge visible above the touch controls.
  ctx.save();
  ctx.beginPath();
  ctx.rect(ox, oy, 360, 484);
  ctx.clip();
  state.lanes.forEach((lane, row) => {
    const y = oy + (10 - (row) + cameraRows) * cell;
    if (y + cell < oy || y > oy + 484) return;
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
    if (lane.kind === "river") {
      // Flow lines move with the actual lane direction. They never resemble solid support.
      ctx.strokeStyle = "rgba(91,168,228,.23)";
      ctx.lineWidth = 1;
      const phase = (state.tick * lane.speedMilli / 120000 * lane.direction) % 64;
      for (let k = -1; k < 7; k++) {
        const fx = ox + k * 64 + phase;
        ctx.beginPath();
        ctx.moveTo(fx, y + 17);
        ctx.lineTo(fx + 24, y + 17);
        ctx.moveTo(fx + 13, y + 32);
        ctx.lineTo(fx + 44, y + 32);
        ctx.stroke();
      }
    }
    if (lane.kind === "road") {
      ctx.fillStyle = "rgba(185,204,226,.22)";
      for (let k = 0; k < 9; k++) ctx.fillRect(ox + k * 44 + 8, y + 21, 19, 2);
    }
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
    for (const rect of riverRectsV4(state, row)) {
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
      if (lane.kind === "river") {
        // Deck ribs distinguish rideable platforms from traffic, even without colour.
        ctx.strokeStyle = "rgba(153,233,238,.42)";
        ctx.lineWidth = 1;
        for (let rib = 17; rib < w - 7; rib += 22) {
          ctx.beginPath();
          ctx.moveTo(x + rib, y + 17);
          ctx.lineTo(x + rib, y + 33);
          ctx.stroke();
        }
      } else {
        const front = lane.direction > 0 ? x + w - 5 : x + 2;
        const rear = lane.direction > 0 ? x + 2 : x + w - 5;
        ctx.fillStyle = "#173548";
        ctx.fillRect(x + w * .3, y + 18, w * .4, 12);
        ctx.fillStyle = "#fff0b7";
        ctx.fillRect(front, y + 12, 3, 5);
        ctx.fillRect(front, y + 28, 3, 5);
        ctx.fillStyle = "#e74f79";
        ctx.fillRect(rear, y + 13, 3, 4);
        ctx.fillRect(rear, y + 29, 3, 4);
      }
    }
    ctx.restore();
  });
  const x =
      15 + (state.fromXMilli + (state.xMilli - state.fromXMilli) * ease) / 1000,
    y = oy + (10 - (rowPosition) + cameraRows + 0.5) * cell;
  ctx.save();
  // Ground shadow stays on the lane; the ship has a short, readable hop arc.
  const hop = state.status === "running" ? Math.sin(age * Math.PI) * 7 : 0;
  ctx.fillStyle = "rgba(0,0,0,.38)";
  ctx.beginPath();
  ctx.ellipse(x, y + 7, 11 - hop * .35, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.translate(x, y - hop);
  ctx.shadowColor = state.status === "failed" ? "#ef8098" : "#9effde";
  ctx.shadowBlur = 12;
  ctx.fillStyle = state.status === "failed" ? "#f4a9bd" : "#b2ffda";
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.lineTo(11, 8);
  ctx.lineTo(0, 5);
  ctx.lineTo(-11, 8);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#214f67";
  ctx.beginPath();
  ctx.ellipse(0, -3, 3, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.restore();
}
const hudLabel = (s: Readonly<RiverV4State>) => `AVANCE ${s.height}`;
const failureFinale = {
  durationMs: 420,
  render(ctx: CanvasRenderingContext2D, state: RiverV4State, elapsedMs: number) {
    render(ctx, state);
    const progress = Math.min(1, elapsedMs / 420);
    const cameraRows = Math.max(0, state.row - 4);
    const x = 15 + state.xMilli / 1000;
    const y = 58 + (10 - (state.row) + cameraRows + .5) * 44;
    ctx.save();
    ctx.globalAlpha = 1 - progress;
    ctx.strokeStyle = "#e6b8bd";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, y, 9 + progress * 38, 5 + progress * 22, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#f5c5a6";
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4;
      ctx.fillRect(x + Math.cos(angle) * progress * 45 - 2, y + Math.sin(angle) * progress * 30 - 2, 4, 4);
    }
    ctx.restore();
  },
};
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
        core={RIVER_DASH_CORE_V4}
        name="River Dash"
        render={render}
        keys={keys}
        controls={controls}
        hudLabel={hudLabel}
        hideHudScore
        failureFinale={failureFinale}
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
