"use client";
import type { GameRuntimeProps } from "@/lib/games";
import { drawSpaceBackdrop } from "@/lib/spaceBackdrop";
import {
  TOWER_DROP_CORE_V3,
  TOWER_DROP_V3,
  type TowerDropV3State,
} from "@/lib/verified/towerDropCore.v3";
import CoreCanvasGame from "./CoreCanvasGame";
// Presentation-only smoothing. Never read by the core; a new run (tick going
// backwards) resets it, so replays and previews stay deterministic.
const motion = { tick: -1, offsetY: Number.NaN, jaw: 1 };
function ease(state: TowerDropV3State, offsetY: number, gripping: boolean) {
  // Backwards or repeated ticks (new run, resize redraw, test) snap in place.
  if (state.tick <= motion.tick || Number.isNaN(motion.offsetY)) {
    motion.offsetY = offsetY;
    motion.jaw = gripping ? 0 : 1;
  } else if (state.tick !== motion.tick) {
    const steps = Math.min(8, state.tick - motion.tick);
    for (let n = 0; n < steps; n++) {
      // The tower glides down instead of jumping when a layer is added.
      motion.offsetY += (offsetY - motion.offsetY) * 0.07;
      motion.jaw += ((gripping ? 0 : 1) - motion.jaw) * 0.22;
    }
    if (Math.abs(offsetY - motion.offsetY) < 0.05) motion.offsetY = offsetY;
  }
  motion.tick = state.tick;
  return motion.offsetY;
}
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
  const easedOffsetY = ease(state, offsetY, state.phase === "swing");
  ctx.save();
  ctx.translate(195 * (1 - scale), easedOffsetY);
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
  // Two hinged claw arms drawn over the block so they stay visible: they close
  // around it while it swings and swing open after DROP. Presentation only.
  const open = motion.jaw,
    reach = Math.max(18, state.movingWMilli / 1000 / 2);
  ctx.strokeStyle = "#a4f9ed";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const side of [-1, 1]) {
    const swing = (0.18 + open * 0.75) * side,
      tipX = hookX + side * (reach - 3) + Math.sin(swing) * 10 * open,
      kneeX = hookX + side * (reach * 0.55 + open * 12);
    ctx.beginPath();
    ctx.moveTo(hookX, hookY + 2);
    ctx.lineTo(kneeX, hookY + 8);
    ctx.lineTo(tipX + side * open * 14, hookY + 8 + 16 - open * 3);
    ctx.lineTo(tipX - side * (1 - open) * 7, hookY + 12 + 14 * (1 - open) + 6);
    ctx.stroke();
  }
  ctx.fillStyle = "#88fff2";
  ctx.beginPath();
  ctx.arc(hookX, hookY, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineCap = "butt";
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
