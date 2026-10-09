"use client";
import type { GameRuntimeProps } from "@/lib/games";
import {
  MAZE_V2_RULES,
  mazeEnemyAwakeV2,
  mazeEnemyPreparingV2,
  mazeChasingV2,
  type MazeV2State,
} from "@/lib/verified/mazeRushCore.v2";
import { drawSpaceBackdrop } from "@/lib/spaceBackdrop";
import type { LogicalCanvasViewport } from "@/lib/gameCanvas";
import CoreCanvasGame from "./CoreCanvasGame";
import { MAZE_CORE_V3, mazeMovePeriodV3 } from "@/lib/verified/mazeRushCore.v3";
// Heading is an icon on the current player, never a projected route.
function drawDirection(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  direction: MazeV2State["direction"],
  color: string,
) {
  ctx.save();
  ctx.translate(x, y);
  // Keep decoration distinct from the existing player/node observation colors.
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  if (direction === "STOP") {
    ctx.fillRect(-size * 0.55, -size * 0.55, size * 0.35, size * 1.1);
    ctx.fillRect(size * 0.2, -size * 0.55, size * 0.35, size * 1.1);
  } else {
    const angle =
      direction === "UP"
        ? -Math.PI / 2
        : direction === "DOWN"
          ? Math.PI / 2
          : direction === "LEFT"
            ? Math.PI
            : 0;
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(-size * 0.65, 0);
    ctx.lineTo(size * 0.65, 0);
    ctx.moveTo(size * 0.15, -size * 0.5);
    ctx.lineTo(size * 0.65, 0);
    ctx.lineTo(size * 0.15, size * 0.5);
    ctx.stroke();
  }
  ctx.restore();
}
function render(
  ctx: CanvasRenderingContext2D,
  s: MazeV2State,
  viewport: LogicalCanvasViewport,
) {
  drawSpaceBackdrop(
    ctx,
    viewport.width,
    viewport.height,
    s.tick * 0.02,
    s.tick,
  );
  const b = s.board,
    horizontal = viewport.width > viewport.height,
    baseCell = Math.floor(Math.min(346 / b.width, 442 / b.height)),
    cell = horizontal
      ? Math.floor(Math.min((viewport.width - 24) / b.width, 550 / b.height))
      : baseCell,
    nodeScale = cell / baseCell,
    pulseRadius = 8 * nodeScale,
    ox = (viewport.width - b.width * cell) / 2,
    oy = horizontal ? 48 : 88;
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
          b.pulses[i] ? pulseRadius : 6 * nodeScale,
          0,
          Math.PI * 2,
        );
        ctx.fill();
        if (b.pulses[i]) {
          ctx.strokeStyle = "#90cfc4";
          ctx.strokeRect(
            x + cell / 2 - pulseRadius,
            y + cell / 2 - pulseRadius,
            pulseRadius * 2,
            pulseRadius * 2,
          );
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
  // A short ease-out smooths arrival without projecting into an unvisited tile.
  const progress = Math.min(1, age / Math.floor(mazeMovePeriodV3(s) / 2)),
    t = 1 - (1 - progress) ** 3;
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
  drawDirection(ctx, x, y, cell * 0.18, s.direction, "#123449");
  const inputAge = s.tick - s.lastInputTick;
  if (s.lastInputTick >= 0 && inputAge >= 0 && inputAge < 18) {
    ctx.save();
    ctx.fillStyle = "#213e4e";
    ctx.strokeStyle = "#c4e7ed";
    ctx.globalAlpha = 0.65 * (1 - inputAge / 18);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, cell * (0.35 + (0.06 * inputAge) / 18), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  if (s.queued !== s.direction) {
    // A small badge stays within this cell and confirms the buffered turn.
    const badgeX = x + cell * 0.27,
      badgeY = y - cell * 0.27;
    ctx.save();
    ctx.fillStyle = "#14273f";
    ctx.beginPath();
    ctx.arc(badgeX, badgeY, cell * 0.17, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    drawDirection(ctx, badgeX, badgeY, cell * 0.12, s.queued, "#f0d694");
  }
  if (s.tick < s.poweredUntil || s.tick < s.protectedUntil) {
    const powered = s.tick < s.poweredUntil,
      until = powered ? s.poweredUntil : s.protectedUntil,
      duration = powered
        ? MAZE_V2_RULES.pulseTicks
        : MAZE_V2_RULES.protectionTicks,
      remaining = Math.min(1, Math.max(0, (until - s.tick) / duration));
    ctx.save();
    ctx.strokeStyle = powered ? "#9cf0d6" : "#efdb8c";
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.2;
    ctx.beginPath();
    ctx.arc(x, y, cell * 0.43, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(
      x,
      y,
      cell * 0.43,
      -Math.PI / 2,
      -Math.PI / 2 + remaining * Math.PI * 2,
    );
    ctx.stroke();
    ctx.restore();
  }
  const pickupAge = s.tick - s.lastPickupTick;
  if (s.lastPickupTick >= 0 && pickupAge >= 0 && pickupAge < 48) {
    const progress = pickupAge / 48,
      radius = cell * (0.38 + progress * 0.12);
    ctx.save();
    ctx.fillStyle = "#143b38";
    ctx.strokeStyle = "#b8efde";
    ctx.globalAlpha = 0.7 * (1 - progress);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();
    for (const [dx, dy] of [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
    ]) {
      ctx.beginPath();
      ctx.moveTo(x + dx * radius * 0.82, y + dy * radius * 0.82);
      ctx.lineTo(x + dx * radius, y + dy * radius);
      ctx.stroke();
    }
    ctx.restore();
  }
  for (const [i, e] of b.enemies.entries()) {
    const p = center(e.cell),
      awake = mazeEnemyAwakeV2(s, i),
      preparing = mazeEnemyPreparingV2(s, i);
    ctx.fillStyle = preparing
      ? "#b29c61"
      : !awake
        ? "#536782"
        : s.tick < s.poweredUntil
          ? "#a281dc"
          : mazeChasingV2(s)
            ? "#ed8a91"
            : "#efb876";
    ctx.beginPath();
    ctx.arc(p.x, p.y, cell * 0.29, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#122238";
    ctx.fillRect(p.x - 5, p.y - 2, 3, 3);
    ctx.fillRect(p.x + 2, p.y - 2, 3, 3);
    // Antennae make the existing threat silhouette distinct from a pickup.
    // Preserve its authoritative center and the original colored body arc.
    ctx.save();
    ctx.fillStyle = "#122238";
    ctx.strokeStyle = preparing ? "#f0d694" : awake ? "#d6e1e9" : "#8398ad";
    ctx.lineWidth = 1.3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(p.x - cell * 0.12, p.y - cell * 0.24);
    ctx.lineTo(p.x - cell * 0.22, p.y - cell * 0.36);
    ctx.moveTo(p.x + cell * 0.12, p.y - cell * 0.24);
    ctx.lineTo(p.x + cell * 0.22, p.y - cell * 0.36);
    ctx.stroke();
    if (awake) {
      ctx.strokeStyle = "#122238";
      ctx.beginPath();
      ctx.moveTo(p.x - cell * 0.1, p.y + cell * 0.13);
      ctx.lineTo(p.x + cell * 0.1, p.y + cell * 0.13);
      ctx.stroke();
    }
    ctx.restore();
    if (preparing) {
      ctx.strokeStyle = "#efdba0";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(
        p.x,
        p.y,
        cell * (0.36 + (0.07 * (s.tick % 60)) / 60),
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    }
  }
  ctx.fillStyle = "#c9dfef";
  ctx.textAlign = "center";
  ctx.font = "12px system-ui";
  const message =
    s.tick < s.poweredUntil
      ? `PULSO · ${Math.ceil((s.poweredUntil - s.tick) / 120)} s`
      : b.enemies.some((_, i) => mazeEnemyPreparingV2(s, i))
        ? "PERSEGUIDOR ACTIVÁNDOSE"
        : "";
  ctx.fillText(message, viewport.width / 2, horizontal ? 24 : 64);
  if (s.tick - s.lastDamageTick < 60) {
    ctx.fillStyle = `rgba(224,72,113,${0.22 * (1 - (s.tick - s.lastDamageTick) / 60)})`;
    ctx.fillRect(0, 0, viewport.width, viewport.height);
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
const hudLabel = (s: Readonly<MazeV2State>) =>
  `${s.collected}/${s.board.total} NODOS`;
export default function MazeRushVerified(props: GameRuntimeProps) {
  return (
    <div className="mazeRushVerified">
      <CoreCanvasGame
        {...props}
        core={MAZE_CORE_V3}
        hideHudScore
        expandHorizontalViewport
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
