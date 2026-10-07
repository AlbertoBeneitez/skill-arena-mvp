"use client";
import type { GameRuntimeProps } from "@/lib/games";
import { drawSpaceBackdrop } from "@/lib/spaceBackdrop";
import {
  SERPENT_CORE,
  SERPENT_V1,
  type SerpentState,
} from "@/lib/verified/serpentCore.v1";
import CoreCanvasGame from "./CoreCanvasGame";
const cell = 300 / SERPENT_V1.cols,
  ox = 45,
  oy = 62;
function render(ctx: CanvasRenderingContext2D, state: SerpentState) {
  drawSpaceBackdrop(ctx, 390, 620, 2, state.tick);
  ctx.fillStyle = "rgba(3,19,33,.85)";
  ctx.fillRect(ox, oy, 300, cell * SERPENT_V1.rows);
  ctx.strokeStyle = "rgba(104,227,222,.12)";
  ctx.lineWidth = 0.6;
  for (let x = 0; x <= SERPENT_V1.cols; x++) {
    ctx.beginPath();
    ctx.moveTo(ox + x * cell, oy);
    ctx.lineTo(ox + x * cell, oy + SERPENT_V1.rows * cell);
    ctx.stroke();
  }
  for (let y = 0; y <= SERPENT_V1.rows; y++) {
    ctx.beginPath();
    ctx.moveTo(ox, oy + y * cell);
    ctx.lineTo(ox + 300, oy + y * cell);
    ctx.stroke();
  }
  ctx.strokeStyle = "#4bb2bb";
  ctx.lineWidth = 2;
  ctx.strokeRect(ox, oy, 300, cell * SERPENT_V1.rows);
  if (state.food) {
    const x = ox + (state.food.x + 0.5) * cell,
      y = oy + (state.food.y + 0.5) * cell;
    ctx.save();
    ctx.shadowColor = "#ffe698";
    ctx.shadowBlur = 13;
    ctx.fillStyle = "#ffe896";
    ctx.beginPath();
    ctx.arc(x, y, cell * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  state.snake.forEach((p, index) => {
    const x = ox + p.x * cell + 1,
      y = oy + p.y * cell + 1;
    ctx.fillStyle =
      index === 0
        ? "#c7fff2"
        : `hsl(${165 + (index % 20)},65%,${Math.max(34, 60 - index * 0.9)}%)`;
    ctx.beginPath();
    ctx.roundRect(x, y, cell - 2, cell - 2, 4);
    ctx.fill();
    if (!index) {
      ctx.fillStyle = "#073c40";
      const vertical = state.direction === "UP" || state.direction === "DOWN";
      const ex =
          state.direction === "LEFT"
            ? 2
            : state.direction === "RIGHT"
              ? cell - 7
              : 3,
        ey =
          state.direction === "UP"
            ? 2
            : state.direction === "DOWN"
              ? cell - 7
              : 3;
      ctx.fillRect(x + ex, y + ey, 2.5, 2.5);
      ctx.fillRect(
        x + ex + (vertical ? 6 : 0),
        y + ey + (vertical ? 0 : 6),
        2.5,
        2.5,
      );
    }
  });
  if (state.tick - state.lastEatTick < 45) {
    ctx.fillStyle = "#fff3b0";
    ctx.font = "bold 14px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("+1000", 195, 46);
    ctx.textAlign = "left";
  }
  ctx.fillStyle = "#a2d6e6";
  ctx.font = "11px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(
    `${state.foods} NÚCLEOS · ${state.wrapCount} PORTALES`,
    195,
    550,
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
export default function Serpent(props: GameRuntimeProps) {
  return (
    <div className="serpentVerified">
      <CoreCanvasGame
        {...props}
        core={SERPENT_CORE}
        name="Serpent"
        render={render}
        keys={keys}
        controls={controls}
        gestureAction={(a, b) => {
          const dx = b.x - a.x,
            dy = b.y - a.y;
          if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return null;
          return Math.abs(dx) > Math.abs(dy)
            ? dx > 0
              ? "RIGHT"
              : "LEFT"
            : dy > 0
              ? "DOWN"
              : "UP";
        }}
        instruction="Desliza o usa las flechas. Los cuatro bordes son portales."
      />
    </div>
  );
}
