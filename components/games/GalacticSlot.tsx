"use client";
import type { GameRuntimeProps } from "@/lib/games";
import {
  SLOT_RULES,
  type SlotState,
} from "@/lib/verified/galacticSlotCore.v1";
import { SLOT_CORE_V3 } from "@/lib/verified/galacticSlotCore.v3";
import { drawSpaceBackdrop } from "@/lib/spaceBackdrop";
import { slotVisibleSteps, slotReelPosition } from "@/lib/slotPresentation.v2";
import CoreCanvasGame from "./CoreCanvasGame";
const colors = [
  "#f7d75f",
  "#ff934d",
  "#fa526e",
  "#f4cb87",
  "#9ee7ff",
  "#a4a6fa",
  "#79e7c9",
  "#fff2c6",
];
const marks = ["", "", "", "♧", "★", "BAR", "◆", "7"];
function symbol(
  ctx: CanvasRenderingContext2D,
  id: number,
  x: number,
  y: number,
  size: number,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = colors[id];
  if (id < 3) {
    ctx.beginPath();
    if (id === 2) {
      ctx.arc(-size * 0.2, 0, size * 0.23, 0, Math.PI * 2);
      ctx.arc(size * 0.2, size * 0.05, size * 0.23, 0, Math.PI * 2);
    } else
      ctx.ellipse(
        0,
        0,
        size * 0.33,
        size * (id === 0 ? 0.23 : 0.33),
        id === 0 ? -0.4 : 0,
        0,
        Math.PI * 2,
      );
    ctx.fill();
    ctx.strokeStyle = "#8acb99";
    ctx.lineWidth = Math.max(1, size * 0.05);
    ctx.beginPath();
    ctx.moveTo(-size * 0.2, -size * 0.22);
    ctx.quadraticCurveTo(0, -size * 0.6, size * 0.2, -size * 0.22);
    ctx.stroke();
  } else if (id === 3) {
    ctx.beginPath();
    ctx.moveTo(-size * 0.3, size * 0.2);
    ctx.quadraticCurveTo(-size * 0.22, size * 0.1, -size * 0.2, -size * 0.15);
    ctx.quadraticCurveTo(0, -size * 0.5, size * 0.2, -size * 0.15);
    ctx.quadraticCurveTo(size * 0.22, size * 0.1, size * 0.3, size * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, size * 0.28, size * 0.07, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.font = `900 ${id === 5 ? size * 0.36 : size * 0.72}px system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(marks[id], 0, 0);
  }
  ctx.restore();
}
function render(ctx: CanvasRenderingContext2D, s: SlotState) {
  drawSpaceBackdrop(ctx, 390, 620, 2, s.tick);
  // The three reel tables stay on top for the whole run (they are different in every game:
  // they come from the match seed). The highlighted row is where each reel sits right now.
  const layout = { top: 292, height: 150, center: 367, pitch: 70, symbolSize: 56, tableY: 218 };
  ctx.fillStyle = "rgba(6,16,34,.88)";
  ctx.beginPath();
  ctx.roundRect(24, 38, 342, 148, 16);
  ctx.fill();
  ctx.fillStyle = "#8fa8bd";
  ctx.font = "bold 10px system-ui";
  ctx.textAlign = "center";
  for (let i = 0; i < 3; i++) {
    const x = 85 + i * 110;
    ctx.fillText(`RODILLO ${i + 1}`, x, 52);
    for (let j = 0; j < 8; j++) {
      const y = 66 + j * 14.5;
      if (s.positions[i] === j) {
        ctx.fillStyle = "rgba(115,212,255,.28)";
        ctx.beginPath();
        ctx.roundRect(x - 40, y - 7, 80, 14, 6);
        ctx.fill();
      }
      symbol(ctx, s.strips[i][j], x, y, 15);
    }
    ctx.fillStyle = "#8fa8bd";
    ctx.font = "bold 10px system-ui";
  }
  for (let id = 0; id < 8; id++) {
    const x = 47 + (id % 4) * 91,
      y = layout.tableY + Math.floor(id / 4) * 24;
    symbol(ctx, id, x - 12, y, 22);
    ctx.fillStyle = "#d8e7f4";
    ctx.textAlign = "left";
    ctx.font = "bold 11px system-ui";
    ctx.fillText(`×3  ${SLOT_RULES.tripleMultipliers[id] * 5}`, x + 3, y + 4);
  }
  ctx.textAlign = "center";
  for (const [x, label, amount] of [
    [107, "Pareja", "10"],
    [280, "7 sin pareja", "5"],
  ] as const) {
    ctx.fillStyle = "#a5b9cd";
    ctx.font = "400 10px system-ui";
    ctx.fillText(label, x - 14, layout.tableY + 46);
    ctx.fillStyle = "#e0d2a6";
    ctx.font = "500 10px system-ui";
    ctx.fillText(amount, x + 34, layout.tableY + 46);
  }
  const lit = s.tick - s.lastSettledTick < 90 && s.lastPayout > 0;
  ctx.fillStyle = "#132940";
  ctx.strokeStyle = lit ? "#ffe9a4" : "#59788b";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(22, layout.top, 346, layout.height, 22);
  ctx.fill();
  ctx.stroke();
  for (let i = 0; i < 3; i++) {
    const x = 85 + i * 110;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x - 44, layout.top + 7, 88, layout.height - 14, 12);
    ctx.clip();
    ctx.fillStyle = "#061322";
    ctx.fillRect(x - 44, layout.top + 7, 88, layout.height - 14);
    const p = slotReelPosition(s, i);
    const index = Math.floor(p),
      fraction = p - index;
    for (let k = -1; k <= 2; k++)
      symbol(
        ctx,
        s.strips[i][(((index + k) % 8) + 8) % 8],
        x,
        layout.center + (k - fraction) * layout.pitch,
        layout.symbolSize,
      );
    ctx.restore();
    ctx.fillStyle = "#edf6ff";
    ctx.font = "bold 16px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(String(slotVisibleSteps(s.steps[i])), x, layout.top + layout.height + 26);
  }
  if (lit) {
    ctx.fillStyle = "#ffe9a4";
    ctx.font = "bold 18px system-ui";
    ctx.fillText(`+${s.lastPayout / 100} fichas`, 195, layout.top - 8);
  }
}
const hudLabel = (s: Readonly<SlotState>) =>
  `${(s.balanceMinor / 100).toFixed(2)} FICHAS · ${(Math.max(0, 21600 - s.tick) / 120).toFixed(1)}s${s.steps.every(step => step === 0) ? " · 000 NO PERMITIDO" : ""}`;
const feedbackScore = (s: Readonly<SlotState>) => s.balanceMinor;
export default function GalacticSlot(props: GameRuntimeProps) {
  return (
    <div className="slotVerified">
      <CoreCanvasGame
        {...props}
        core={SLOT_CORE_V3}
        name="Galactic Slot"
        instruction=""
        render={render}
        hideHudScore
        hudLabel={hudLabel}
        feedbackScore={feedbackScore}
        keys={{ " ": "SPIN" }}
        controls={[
          {
            action: "REEL_0_LESS",
            label: "Reducir avance de ruleta 1",
            symbol: "−",
          },
          {
            action: "REEL_0_MORE",
            label: "Aumentar avance de ruleta 1",
            symbol: "+",
          },
          {
            action: "REEL_1_LESS",
            label: "Reducir avance de ruleta 2",
            symbol: "−",
          },
          {
            action: "REEL_1_MORE",
            label: "Aumentar avance de ruleta 2",
            symbol: "+",
          },
          {
            action: "REEL_2_LESS",
            label: "Reducir avance de ruleta 3",
            symbol: "−",
          },
          {
            action: "REEL_2_MORE",
            label: "Aumentar avance de ruleta 3",
            symbol: "+",
          },
          {
            action: "SPIN",
            label: "Girar ruletas por 5 euros ficticios",
            symbol: "⟳ 5 fichas",
          },
        ]}
      />
    </div>
  );
}
