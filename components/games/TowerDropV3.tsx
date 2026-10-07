"use client";
import type { GameRuntimeProps } from "@/lib/games";
import { drawSpaceBackdrop } from "@/lib/spaceBackdrop";
import {
  TOWER_DROP_CORE_V3,
  TOWER_DROP_V3,
  forecastTowerLanding,
  type TowerDropV3State,
} from "@/lib/verified/towerDropCore.v3";
import CoreCanvasGame from "./CoreCanvasGame";
function render(ctx: CanvasRenderingContext2D, state: TowerDropV3State) {
  drawSpaceBackdrop(ctx, 390, 620, 1, state.tick);
  // Uniform projection keeps the rope arc and block proportions coherent.
  ctx.save();
  ctx.translate(33, 68);
  ctx.scale(0.83, 0.83);
  const floor = 540,
    blockH = 30;
  const block = (x: number, y: number, w: number, level: number) => {
    const hue = 180 + ((level * 13) % 105);
    ctx.fillStyle = `hsl(${hue},60%,48%)`;
    ctx.fillRect(x, y, w, blockH - 2);
    ctx.fillStyle = "rgba(210,255,255,.35)";
    ctx.fillRect(x, y, w, 4);
    ctx.strokeStyle = "rgba(205,255,255,.4)";
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, blockH - 3);
    ctx.fillStyle = "rgba(0,15,50,.2)";
    for (let n = x + 12; n < x + w - 8; n += 24) ctx.fillRect(n, y + 10, 10, 8);
  };
  const groundY = floor + state.blocks.length * blockH;
  if (groundY < 655) {
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
    const y = floor + (state.blocks.length - 1 - index) * blockH;
    if (y < 620) block(b.xMilli / 1000, y, b.wMilli / 1000, index);
  });
  const pivotY = floor - blockH - 320 - TOWER_DROP_V3.ropeLengthMilli / 1000;
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
    const landing = forecastTowerLanding(state),
      center = (landing.xMilli + state.movingWMilli / 2) / 1000;
    ctx.save();
    ctx.setLineDash([4, 7]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = landing.stable ? "#75efd5" : "#fbaf78";
    ctx.beginPath();
    ctx.moveTo(hookX, hookY + blockH);
    ctx.lineTo(center, floor - 4);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = landing.stable
      ? "rgba(79,238,190,.2)"
      : "rgba(255,145,91,.15)";
    ctx.fillRect(
      landing.xMilli / 1000,
      floor - 5,
      state.movingWMilli / 1000,
      5,
    );
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
