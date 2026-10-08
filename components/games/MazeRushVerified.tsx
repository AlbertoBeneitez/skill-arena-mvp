"use client";
import type { GameRuntimeProps } from "@/lib/games";
import {
  MAZE_CORE,
  mazeEnemiesAwake,
  mazeChasing,
  mazeMovePeriod,
  type MazeState,
} from "@/lib/verified/mazeRushCore.v1";
import { drawSpaceBackdrop } from "@/lib/spaceBackdrop";
import CoreCanvasGame from "./CoreCanvasGame";
function render(ctx: CanvasRenderingContext2D, s: MazeState) {
  drawSpaceBackdrop(ctx, 390, 620, s.tick * 0.02, s.tick);
  const b = s.board,
    cell = Math.floor(Math.min(346 / b.width, 442 / b.height)),
    ox = (390 - b.width * cell) / 2,
    oy = 88;
  ctx.fillStyle = "rgba(6,15,31,.93)";
  ctx.fillRect(ox - 4, oy - 4, b.width * cell + 8, b.height * cell + 8);
  for (let i = 0; i < b.walls.length; i++) {
    const x = ox + (i % b.width) * cell,
      y = oy + Math.floor(i / b.width) * cell;
    if (b.walls[i]) {
      ctx.fillStyle = "#233d5c";
      ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
      ctx.fillStyle = "#3e6584";
      ctx.fillRect(x + 2, y + 2, cell - 4, 2);
    } else {
      ctx.strokeStyle = "rgba(88,139,167,.12)";
      ctx.strokeRect(x + 1, y + 1, cell - 2, cell - 2);
      if (b.nodes[i]) {
        ctx.fillStyle = b.pulses[i] ? "#9cf0d6" : "#d2e2f4";
        ctx.beginPath();
        ctx.arc(
          x + cell / 2,
          y + cell / 2,
          b.pulses[i] ? 6 : 2.5,
          0,
          Math.PI * 2,
        );
        ctx.fill();
        if (b.pulses[i]) {
          ctx.strokeStyle = "#90cfc4";
          ctx.strokeRect(x + cell / 2 - 8, y + cell / 2 - 8, 16, 16);
        }
      }
    }
  }
  const center = (i: number) => ({
    x: ox + ((i % b.width) + 0.5) * cell,
    y: oy + (Math.floor(i / b.width) + 0.5) * cell,
  });
  const p = center(s.player),
    old = center(s.previousPlayer),
    age = s.tick - s.lastMoveTick;
  // Interpolate only adjacent visual positions; contact/inputs use integer cells.
  const t = Math.min(1, age / Math.min(6, mazeMovePeriod(s)));
  const adjacent = Math.abs(old.x - p.x) + Math.abs(old.y - p.y) === cell;
  const x = adjacent ? old.x + (p.x - old.x) * t : p.x,
    y = adjacent ? old.y + (p.y - old.y) * t : p.y;
  ctx.fillStyle = "#87e8f3";
  ctx.beginPath();
  ctx.moveTo(x, y - cell * 0.31);
  ctx.lineTo(x + cell * 0.31, y);
  ctx.lineTo(x, y + cell * 0.31);
  ctx.lineTo(x - cell * 0.31, y);
  ctx.closePath();
  ctx.fill();
  if (s.tick < s.poweredUntil || s.tick < s.protectedUntil) {
    ctx.strokeStyle = s.tick < s.poweredUntil ? "#9cf0d6" : "#efdb8c";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, cell * 0.43, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (const e of b.enemies) {
    const p = center(e.cell),
      awake = mazeEnemiesAwake(s) && s.tick >= e.dormantUntil;
    ctx.fillStyle = !awake
      ? "#536782"
      : s.tick < s.poweredUntil
        ? "#a281dc"
        : mazeChasing(s)
          ? "#ed8a91"
          : "#efb876";
    ctx.beginPath();
    ctx.arc(p.x, p.y, cell * 0.29, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#122238";
    ctx.fillRect(p.x - 5, p.y - 2, 3, 3);
    ctx.fillRect(p.x + 2, p.y - 2, 3, 3);
  }
  ctx.fillStyle = "#c9dfef";
  ctx.textAlign = "center";
  ctx.font = "12px system-ui";
  const message =
    s.clearUntil !== null
      ? "SECTOR COMPLETADO · RECUPERAS UN ESCUDO"
      : s.tick < s.readyAt
        ? "Desliza o usa las flechas · ■ para planear"
        : s.tick < s.poweredUntil
          ? `PULSO · ${Math.ceil((s.poweredUntil - s.tick) / 120)} s DE PROTECCIÓN`
          : mazeEnemiesAwake(s)
            ? "Anticipa los giros · busca los pulsos verdes"
            : "Recoge nodos · los verdes activan protección";
  ctx.fillText(message, 195, 64);
  if (s.tick - s.lastDamageTick < 60) {
    ctx.fillStyle = `rgba(224,72,113,${0.22 * (1 - (s.tick - s.lastDamageTick) / 60)})`;
    ctx.fillRect(0, 0, 390, 620);
  }
}
const keys = {
  ArrowUp: "UP",
  ArrowLeft: "LEFT",
  ArrowDown: "DOWN",
  ArrowRight: "RIGHT",
  " ": "STOP",
} as const;
const controls = [
  { action: "LEFT", label: "Girar izquierda", symbol: "←" },
  { action: "UP", label: "Girar arriba", symbol: "↑" },
  { action: "STOP", label: "Detener movimiento", symbol: "■" },
  { action: "DOWN", label: "Girar abajo", symbol: "↓" },
  { action: "RIGHT", label: "Girar derecha", symbol: "→" },
] as const;
const gestureAction = (
  from: { x: number; y: number },
  to: { x: number; y: number },
) => {
  const dx = to.x - from.x,
    dy = to.y - from.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return null;
  return Math.abs(dx) > Math.abs(dy)
    ? dx > 0
      ? "RIGHT"
      : "LEFT"
    : dy > 0
      ? "DOWN"
      : "UP";
};
const hudLabel = (s: Readonly<MazeState>) =>
  `SECTOR ${s.sector}/3 · ${s.stageCollected}/${s.board.total}`;
export default function MazeRushVerified(props: GameRuntimeProps) {
  return (
    <div className="mazeRushVerified">
      <CoreCanvasGame
        {...props}
        core={MAZE_CORE}
        name="Maze Rush"
        render={render}
        keys={keys}
        controls={controls}
        gestureAction={gestureAction}
        hudLabel={hudLabel}
        instruction="Desliza para girar · ■ detiene · verde protege"
      />
    </div>
  );
}
