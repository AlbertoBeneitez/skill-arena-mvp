"use client";
import type { GameRuntimeProps } from "@/lib/games";
import { drawSpaceBackdrop } from "@/lib/spaceBackdrop";
import {
  TOWER_DROP_CORE_V3,
  TOWER_DROP_V3,
  type TowerDropV3State,
} from "@/lib/verified/towerDropCore.v3";
import CoreCanvasGame from "./CoreCanvasGame";
function render(ctx: CanvasRenderingContext2D, state: TowerDropV3State) {
  drawSpaceBackdrop(ctx, 390, 620, 1, state.tick);
  const floor = 540,
    blockH = 30,
    groundScreenY = 580,
    pivotY = floor - blockH - 320 - TOWER_DROP_V3.ropeLengthMilli / 1000,
    craneTop = pivotY - 24;
  // Fit the complete tower first. Once zoom would make the landing area too
  // small, compress only the older settled layers; crane, rope and active
  // block still share one uniform scale and the foundation remains visible.
  const scale = Math.max(
      0.55,
      Math.min(
        0.83,
        (groundScreenY - 80) /
          (floor - craneTop + state.blocks.length * blockH),
      ),
    ),
    landingScreenY = Math.max(
      80 + (floor - craneTop) * scale,
      groundScreenY - state.blocks.length * blockH * scale,
    ),
    offsetY = landingScreenY - floor * scale,
    groundY = (groundScreenY - offsetY) / scale,
    olderBlockH =
      state.blocks.length > 1
        ? (groundY - floor - blockH) / (state.blocks.length - 1)
        : blockH;
  ctx.save();
  ctx.translate(195 * (1 - scale), offsetY);
  ctx.scale(scale, scale);
  const block = (
    x: number,
    y: number,
    w: number,
    level: number,
    h = blockH,
  ) => {
    const hue = 180 + ((level * 13) % 105);
    ctx.fillStyle = `hsl(${hue},60%,48%)`;
    ctx.fillRect(x, y, w, Math.max(0.5, h - Math.min(2, h / 8)));
    ctx.fillStyle = "rgba(210,255,255,.35)";
    ctx.fillRect(x, y, w, Math.min(4, h / 5));
    if (h >= 5) {
      ctx.strokeStyle = "rgba(205,255,255,.4)";
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    }
    if (h >= 18) {
      ctx.fillStyle = "rgba(0,15,50,.2)";
      for (let n = x + 12; n < x + w - 8; n += 24)
        ctx.fillRect(n, y + h / 3, 10, h / 4);
    }
  };
  {
    ctx.fillStyle = "#173949";
    ctx.fillRect(45, groundY, 300, 14);
    ctx.fillStyle = "#65b5bb";
    ctx.fillRect(45, groundY, 300, 3);
    for (let x = 55; x < 335; x += 40) {
      ctx.fillStyle = "#8fffe1";
      ctx.fillRect(x, groundY + 7, 12, 3);
    }
  }
  state.blocks.forEach((b, index) => {
    const fromTop = state.blocks.length - 1 - index,
      h = fromTop === 0 ? blockH : olderBlockH,
      y = fromTop === 0 ? floor : floor + blockH + (fromTop - 1) * olderBlockH;
    block(b.xMilli / 1000, y, b.wMilli / 1000, index, h);
  });
  ctx.strokeStyle = "#63869a";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(25, pivotY - 18);
  ctx.lineTo(365, pivotY - 18);
  ctx.stroke();
  ctx.fillStyle = "#c4eff8";
  ctx.fillRect(183, pivotY - 24, 24, 24);
  const hookX = (state.movingXMilli + state.movingWMilli / 2) / 1000,
    hookY = floor - blockH - 320 - state.hookRiseMilli / 1000;
  ctx.strokeStyle = "#d2effb";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(195, pivotY);
  ctx.lineTo(hookX, hookY);
  ctx.stroke();
  ctx.fillStyle = "#88fff2";
  ctx.beginPath();
  ctx.arc(hookX, hookY, 5, 0, Math.PI * 2);
  ctx.fill();
  if (state.phase === "swing") {
    block(
      state.movingXMilli / 1000,
      hookY,
      state.movingWMilli / 1000,
      state.height + 1,
    );
  } else {
    const x = state.fallXMilli / 1000,
      y = floor - blockH - 320 + state.fallYMilli / 1000;
    if (state.phase === "tipping-left" || state.phase === "tipping-right") {
      const pivot = state.tipPivotXMilli / 1000;
      ctx.save();
      ctx.translate(pivot, floor);
      ctx.rotate(
        (((state.tipDirection * state.tipAngleMilliDeg) / 1000) * Math.PI) /
          180,
      );
      block(x - pivot, -blockH, state.movingWMilli / 1000, state.height + 1);
      ctx.restore();
    } else block(x, y, state.movingWMilli / 1000, state.height + 1);
  }
  ctx.font = "bold 13px system-ui";
  ctx.textAlign = "center";
  ctx.fillStyle = "#c4f1fa";
  if (state.combo > 1) ctx.fillText(`PERFECTO ×${state.combo}`, 195, 112);
  ctx.textAlign = "left";
  ctx.restore();
}
const keys = { " ": "DROP", Enter: "DROP" } as const;
export default function TowerDropV3(props: GameRuntimeProps) {
  return (
    <CoreCanvasGame
      {...props}
      core={TOWER_DROP_CORE_V3}
      name="Tower Drop"
      hideHudScore
      render={render}
      primaryAction="DROP"
      keys={keys}
      instruction="Toca para soltar. Alinea el apoyo sobre la torre."
    />
  );
}
