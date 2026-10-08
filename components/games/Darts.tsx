"use client";
import type { GameRuntimeProps } from "@/lib/games";
import { drawSpaceBackdrop } from "@/lib/spaceBackdrop";
import {
  DARTS_CORE,
  DARTS_RULES,
  DARTS_SECTORS,
  dartsReticle,
  type DartsState,
} from "@/lib/verified/dartsCore.v1";
import { dartsAimAction } from "@/lib/verified/dartsProtocol.v1";
import CoreCanvasGame, { type CorePoint } from "./CoreCanvasGame";
const cx = 195,
  cy = 285;
function ring(
  ctx: CanvasRenderingContext2D,
  r1: number,
  r2: number,
  start: number,
  end: number,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, r2, start, end);
  ctx.arc(cx, cy, r1, end, start, true);
  ctx.closePath();
  ctx.fill();
}
function render(ctx: CanvasRenderingContext2D, s: DartsState) {
  drawSpaceBackdrop(ctx, 390, 620, 0, s.tick);
  const stage = Math.min(4, Math.floor(s.throwIndex / 3)),
    remaining = Math.max(
      0,
      DARTS_RULES.deadlineSeconds[stage] - s.phaseTicks / 120,
    );
  ctx.fillStyle = "#0a192a";
  ctx.beginPath();
  ctx.arc(cx, cy, 161, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#547689";
  ctx.lineWidth = 2;
  ctx.stroke();
  for (let i = 0; i < 20; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 10 - Math.PI / 20,
      b = a + Math.PI / 10;
    ring(ctx, 24, 140, a, b, i % 2 ? "#c2ced1" : "#183444");
    ring(ctx, 78, 88, a, b, i % 2 ? "#d58a58" : "#37b89e");
    ring(ctx, 129, 140, a, b, i % 2 ? "#d58a58" : "#37b89e");
    ctx.strokeStyle = "rgba(2,15,27,.5)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 24, cy + Math.sin(a) * 24);
    ctx.lineTo(cx + Math.cos(a) * 140, cy + Math.sin(a) * 140);
    ctx.stroke();
    const angle = (a + b) / 2;
    ctx.fillStyle = "#d3e8ee";
    ctx.textAlign = "center";
    ctx.font = "bold 10px system-ui";
    ctx.fillText(
      String(DARTS_SECTORS[i]),
      cx + Math.cos(angle) * 151,
      cy + Math.sin(angle) * 151 + 3,
    );
  }
  ctx.fillStyle = "#3abb9f";
  ctx.beginPath();
  ctx.arc(cx, cy, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e3a16e";
  ctx.beginPath();
  ctx.arc(cx, cy, 10, 0, Math.PI * 2);
  ctx.fill();
  const t = s.target,
    tx = cx + t.x / 1000,
    ty = cy + t.y / 1000;
  ctx.strokeStyle = "#f3dca5";
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.arc(tx, ty, t.radius / 1000, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(255,229,160,.13)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,229,160,.8)";
  ctx.beginPath();
  ctx.moveTo(tx - 5, ty);
  ctx.lineTo(tx + 5, ty);
  ctx.moveTo(tx, ty - 5);
  ctx.lineTo(tx, ty + 5);
  ctx.stroke();
  for (const p of (s.phase === "flight" && s.phaseTicks < 24
    ? s.impacts.slice(0, -1)
    : s.impacts
  ).slice(-3)) {
    if (p.timeout) continue;
    ctx.fillStyle = p.goal ? "#d4fff0" : "#e7b997";
    ctx.beginPath();
    ctx.arc(cx + p.x / 1000, cy + p.y / 1000, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  if (s.phase === "aim") {
    const r = dartsReticle(s),
      x = cx + r.x / 1000,
      y = cy + r.y / 1000;
    ctx.strokeStyle = "#e9fcff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.moveTo(x - 13, y);
    ctx.lineTo(x - 4, y);
    ctx.moveTo(x + 4, y);
    ctx.lineTo(x + 13, y);
    ctx.moveTo(x, y - 13);
    ctx.lineTo(x, y - 4);
    ctx.moveTo(x, y + 4);
    ctx.lineTo(x, y + 13);
    ctx.stroke();
  } else {
    const last = s.impacts.at(-1);
    if (last && !last.timeout) {
      const progress = Math.min(1, s.phaseTicks / 24),
        x = cx + last.x / 1000,
        y = cy + last.y / 1000,
        dx = cx + (x - cx) * progress,
        dy = 550 + (y - 550) * progress;
      ctx.strokeStyle = "#e9fcff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(dx, dy);
      ctx.lineTo(dx - 4, dy + 12 * (1 - progress));
      ctx.stroke();
      if (s.phaseTicks > 24) {
        ctx.strokeStyle = last.goal ? "#a7ffe0" : "#ebb88c";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 5 + (s.phaseTicks - 24), 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }
  ctx.textAlign = "center";
  ctx.fillStyle = "#aed2e2";
  ctx.font = "bold 11px system-ui";
  ctx.fillText(
    `FASE ${stage + 1} / 5 · DARDO ${Math.min(15, s.throwIndex + 1)} / 15`,
    cx,
    59,
  );
  ctx.fillStyle = "#f1deb6";
  ctx.font = "bold 20px system-ui";
  ctx.fillText(t.label, cx, 91);
  ctx.fillStyle = "#1d3343";
  ctx.beginPath();
  ctx.roundRect(100, 104, 190, 4, 2);
  ctx.fill();
  ctx.fillStyle = remaining < 3 ? "#ffc081" : "#71dec8";
  ctx.beginPath();
  ctx.roundRect(
    100,
    104,
    190 *
      (s.phase === "aim" ? remaining / DARTS_RULES.deadlineSeconds[stage] : 1),
    4,
    2,
  );
  ctx.fill();
  for (let i = 0; i < 15; i++) {
    ctx.fillStyle =
      i < s.impacts.length
        ? s.impacts[i].goal
          ? "#79e3bf"
          : "#bc9c82"
        : "#344d60";
    ctx.beginPath();
    ctx.arc(90 + i * 15, 464, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  const last = s.impacts.at(-1);
  ctx.fillStyle = "#d6e9f1";
  ctx.font = "bold 13px system-ui";
  ctx.fillText(
    s.phase === "flight"
      ? last?.timeout
        ? "TIEMPO AGOTADO"
        : `${last?.goal ? "OBJETIVO · " : ""}+${last?.award ?? 0}`
      : s.throwIndex === 0
        ? "ARRASTRA LA MIRA · TOCA LANZAR"
        : "Espera al centro de la zona marcada",
    cx,
    492,
  );
  ctx.textAlign = "left";
}
function aim(point: CorePoint, phase: "down" | "move" | "up", s: DartsState) {
  if (s.phase !== "aim" || phase === "up") return null;
  return [
    dartsAimAction(
      "X",
      Math.max(0, Math.min(60, Math.round((point.x - cx) / 5) + 30)),
    ),
    dartsAimAction(
      "Y",
      Math.max(0, Math.min(60, Math.round((point.y - cy) / 5) + 30)),
    ),
  ];
}
const controls = [{ action: "THROW", label: "Lanzar dardo", symbol: "LANZAR" }],
  tones = { THROW: "tap" } as const,
  keys = { " ": "THROW", Enter: "THROW" };
export default function Darts(props: GameRuntimeProps) {
  return (
    <div className="dartsVerified">
      <CoreCanvasGame
        {...props}
        core={DARTS_CORE}
        name="Dardos"
        render={render}
        pointAction={aim}
        controls={controls}
        inputTones={tones}
        keys={keys}
        hideHudLabel
        instruction="Arrastra para apuntar. Lanza cuando la mira pase por el objetivo dorado."
      />
    </div>
  );
}
