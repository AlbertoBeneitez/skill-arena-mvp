"use client";
import type { GameRuntimeProps } from "@/lib/games";
import {
  STACK_SHIFT_CORE,
  stackCells,
  stackLandingY,
  stackPiece,
  type StackShiftState,
} from "@/lib/verified/stackShiftCore.v1";
import { drawSpaceBackdrop } from "@/lib/spaceBackdrop";
import CoreCanvasGame from "./CoreCanvasGame";
const colors = [
  "#5fd4e8",
  "#f5ba5b",
  "#73d69d",
  "#a986e8",
  "#ef7d94",
  "#6f96ed",
];
export const STACK_SHIFT_VIEW = {
  x: 35,
  y: 36,
  cell: 36,
  columns: 8,
  rows: 16,
  bottom: 612,
} as const;
function render(ctx: CanvasRenderingContext2D, s: StackShiftState) {
  drawSpaceBackdrop(ctx, 390, 620, s.tick * 0.05, s.tick);
  const { x: bx, y: by, cell, columns, rows } = STACK_SHIFT_VIEW;
  const width = columns * cell,
    height = rows * cell;
  ctx.fillStyle = "rgba(4,12,25,.94)";
  ctx.fillRect(bx - 4, by - 4, width + 8, height + 8);
  ctx.strokeStyle = "#335e79";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(bx - 4, by - 4, width + 8, height + 8);
  ctx.strokeStyle = "rgba(167,207,235,.075)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= 8; x++) {
    ctx.beginPath();
    ctx.moveTo(bx + x * cell, by);
    ctx.lineTo(bx + x * cell, by + height);
    ctx.stroke();
  }
  for (let y = 0; y <= 16; y++) {
    ctx.beginPath();
    ctx.moveTo(bx, by + y * cell);
    ctx.lineTo(bx + width, by + y * cell);
    ctx.stroke();
  }
  function block(x: number, y: number, kind: number, ghost = false) {
    const px = bx + x * cell,
      py = by + y * cell;
    if (y < 0) return;
    ctx.save();
    if (ghost) {
      ctx.strokeStyle = colors[kind];
      ctx.globalAlpha = 0.5;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(px + 4, py + 4, cell - 8, cell - 8);
    } else {
      ctx.fillStyle = colors[kind];
      ctx.fillRect(px + 2, py + 2, cell - 4, cell - 4);
      ctx.fillStyle = "rgba(255,255,255,.3)";
      ctx.fillRect(px + 3, py + 3, cell - 6, 3);
      ctx.fillStyle = "rgba(0,0,0,.26)";
      ctx.fillRect(px + 3, py + cell - 6, cell - 6, 3);
      ctx.strokeStyle = "rgba(255,255,255,.2)";
      ctx.strokeRect(px + 2.5, py + 2.5, cell - 5, cell - 5);
    }
    ctx.restore();
  }
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 8; x++)
      if (s.board[y][x]) block(x, y, s.board[y][x] - 1);
  if (s.pieceActive) {
    const cells = stackCells(s.pieceKind, s.rotation),
      landing = stackLandingY(s);
    for (const [x, y] of cells) block(s.x + x, landing + y, s.pieceKind, true);
    for (const [x, y] of cells) block(s.x + x, s.y + y, s.pieceKind);
  }
  const age = s.tick - s.lastLockTick;
  if (age >= 0 && age < 24) {
    ctx.strokeStyle = `rgba(160,241,233,${(1 - age / 24) * 0.7})`;
    ctx.lineWidth = 4;
    ctx.strokeRect(bx - 4, by - 4, width + 8, height + 8);
  }
  const clearAge = s.tick - s.lastClearTick;
  if (clearAge >= 0 && clearAge < 30) {
    ctx.fillStyle = `rgba(210,255,245,${(1 - clearAge / 30) * 0.65})`;
    for (const row of s.clearedRows)
      ctx.fillRect(bx, by + row * cell, width, cell);
  }
  ctx.fillStyle = "#8edbda";
  ctx.fillRect(bx - 5, by + height, width + 10, 4);
  ctx.textAlign = "left";
  ctx.fillStyle = "#9bc1d5";
  ctx.font = "9px system-ui";
  ctx.fillText("SIGUIENTE", 334, 64);
  const next = stackPiece(s.seed, s.pieceIndex + 1);
  for (const [x, y] of stackCells(next)) {
    ctx.fillStyle = colors[next];
    ctx.fillRect(336 + x * 12, 74 + y * 12, 10, 10);
  }
  if (s.status === "failed") {
    ctx.fillStyle = "rgba(216,81,109,.17)";
    ctx.fillRect(bx, by, width, height);
  }
}
const hudLabel = (s: Readonly<StackShiftState>) => `${s.lines}/18 FILAS`;
const keys = {
  ArrowLeft: "LEFT",
  ArrowRight: "RIGHT",
  ArrowUp: "ROTATE",
  ArrowDown: "SOFT_DROP",
  " ": "HARD_DROP",
} as const;
const controls = [
  { action: "LEFT", label: "Mover izquierda", symbol: "←" },
  { action: "ROTATE", label: "Girar pieza", symbol: "↻" },
  { action: "RIGHT", label: "Mover derecha", symbol: "→" },
  { action: "HARD_DROP", label: "Asentar pieza", symbol: "BAJAR" },
] as const;
export default function StackShiftVerified(props: GameRuntimeProps) {
  return (
    <div className="stackShiftVerified">
      <CoreCanvasGame
        {...props}
        core={STACK_SHIFT_CORE}
        name="Stack Shift"
        hudLabel={hudLabel}
        render={render}
        keys={keys}
        controls={controls}
        instruction="← → mueve · ↻ gira · BAJAR asienta sobre la silueta"
      />
    </div>
  );
}
