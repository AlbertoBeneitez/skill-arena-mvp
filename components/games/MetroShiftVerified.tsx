"use client";
import type { GameRuntimeProps } from "@/lib/games";
import {
  METRO_CORE,
  METRO_LANES,
  type MetroState,
} from "@/lib/verified/metroShiftCore.v1";
import { drawSpaceBackdrop } from "@/lib/spaceBackdrop";
import CoreCanvasGame from "./CoreCanvasGame";
import { metroObstacleDepth } from "./metro-shift/presentation";
function render(ctx: CanvasRenderingContext2D, s: MetroState) {
  drawSpaceBackdrop(ctx, 390, 620, s.distance / 15000, s.tick);
  const sector = Math.min(3, 1 + Math.floor(s.passed / 20));
  const glow = ["#67b9d2", "#aaa0e5", "#76d8bb"][sector - 1];
  ctx.fillStyle = "#101d2d";
  ctx.beginPath();
  ctx.moveTo(124, 100);
  ctx.lineTo(266, 100);
  ctx.lineTo(390, 620);
  ctx.lineTo(0, 620);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#25425a";
  ctx.lineWidth = 1;
  for (let lane = 0; lane <= 7; lane++) {
    ctx.beginPath();
    ctx.moveTo(124 + (lane * 142) / 7, 100);
    ctx.lineTo((lane * 390) / 7, 620);
    ctx.stroke();
  }
  for (let i = 0; i < 9; i++) {
    const z = (((i * 130000 - s.distance) % 1170000) + 1170000) % 1170000,
      d = 1 - z / 1170000,
      y = 100 + d * 520;
    ctx.strokeStyle = `rgba(126,180,205,${0.12 + d * 0.12})`;
    ctx.beginPath();
    ctx.moveTo(124 * (1 - d), y);
    ctx.lineTo(390 - 124 * (1 - d), y);
    ctx.stroke();
  }
  ctx.strokeStyle = glow;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(116, 100);
  ctx.lineTo(-8, 620);
  ctx.moveTo(274, 100);
  ctx.lineTo(398, 620);
  ctx.stroke();
  // Ground footprints cross the player's line; height is rendered above them.
  for (const g of [...s.groups].reverse()) {
    const dz = (g.z - s.distance) / 1000;
    if (g.passed || dz > 1100 || dz < -120) continue;
    const d = metroObstacleDepth(dz),
      y = 100 + 420 * d;
    for (const h of g.hazards) {
      const x = 195 + (METRO_LANES[h.lane] / 1000 - 195) * (0.34 + 0.66 * d),
        w = 40 * d,
        height = (h.kind === "wall" ? 110 : 24) * d;
      ctx.fillStyle = "rgba(0,0,0,.32)";
      ctx.beginPath();
      ctx.ellipse(x, y + 3, w * 0.6, 7 * d, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = h.kind === "wall" ? "#77475f" : "#c89b51";
      ctx.fillRect(x - w / 2, y - height, w, height);
      ctx.fillStyle = h.kind === "wall" ? "#ce829d" : "#f5d17d";
      ctx.fillRect(x - w / 2, y - height, w, 4 * d);
      ctx.strokeStyle = h.kind === "wall" ? "#eea0b8" : "#f5d17d";
      ctx.lineWidth = 1;
      ctx.strokeRect(x - w / 2, y - height, w, height);
      if (h.kind === "wall") {
        ctx.strokeStyle = "rgba(255,208,223,.35)";
        ctx.beginPath();
        ctx.moveTo(x - w * 0.33, y - height + 10 * d);
        ctx.lineTo(x + w * 0.33, y - 10 * d);
        ctx.moveTo(x + w * 0.33, y - height + 10 * d);
        ctx.lineTo(x - w * 0.33, y - 10 * d);
        ctx.stroke();
      } else {
        ctx.fillStyle = "#443624";
        for (let k = 0; k < 3; k++)
          ctx.fillRect(
            x - w / 2 + 6 * d + k * 11 * d,
            y - height + 7 * d,
            5 * d,
            10 * d,
          );
      }
    }
    if (g.pickupLane !== null && !g.collected) {
      const x =
        195 + (METRO_LANES[g.pickupLane] / 1000 - 195) * (0.34 + 0.66 * d);
      ctx.fillStyle = "#aaf3d0";
      ctx.beginPath();
      ctx.arc(x, y - 16 * d, 10 * d, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#244a44";
      ctx.fillRect(x - d, y - 21 * d, 2 * d, 10 * d);
      ctx.fillRect(x - 5 * d, y - 17 * d, 10 * d, 2 * d);
    }
  }
  const x = s.x / 1000,
    py = 520 + s.jumpY / 1000;
  ctx.strokeStyle = "rgba(132,199,221,.3)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(12, 520);
  ctx.lineTo(378, 520);
  ctx.stroke();
  ctx.fillStyle = "rgba(0,0,0,.4)";
  ctx.beginPath();
  ctx.ellipse(x, 525, 18, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(x, py);
  if (s.tick < s.shieldUntil && s.tick % 16 < 8) ctx.globalAlpha = 0.5;
  ctx.fillStyle = "rgba(123,208,255,.35)";
  ctx.beginPath();
  ctx.moveTo(-8, 18);
  ctx.lineTo(0, 37 + (s.tick % 8));
  ctx.lineTo(8, 18);
  ctx.fill();
  ctx.fillStyle = "#e8f3ff";
  ctx.beginPath();
  ctx.moveTo(0, -24);
  ctx.lineTo(18, 20);
  ctx.lineTo(0, 12);
  ctx.lineTo(-18, 20);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#6fc9e2";
  ctx.beginPath();
  ctx.ellipse(0, -4, 5, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.textAlign = "center";
  ctx.fillStyle = "#c6ddec";
  ctx.font = "12px system-ui";
  const hit = s.tick - s.lastDamageTick;
  if (hit >= 0 && hit < 50) {
    ctx.fillStyle = `rgba(225,82,123,${0.2 * (1 - hit / 50)})`;
    ctx.fillRect(0, 0, 390, 620);
  }
  const pickup = s.tick - s.lastPickupTick;
  if (pickup >= 0 && pickup < 45) {
    ctx.strokeStyle = `rgba(166,255,209,${1 - pickup / 45})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, py, 22 + pickup, 0, Math.PI * 2);
    ctx.stroke();
  }
}
const keys = {
  ArrowLeft: "LEFT",
  ArrowRight: "RIGHT",
  ArrowUp: "JUMP",
  " ": "JUMP",
} as const;
const controls = [
  { action: "LEFT", label: "Cambiar carril izquierda", symbol: "←" },
  { action: "JUMP", label: "Saltar valla", symbol: "SALTAR" },
  { action: "RIGHT", label: "Cambiar carril derecha", symbol: "→" },
] as const;
const hudLabel = (s: Readonly<MetroState>) =>
  `${s.passed}/60 PASOS`;
const inputTones = { LEFT: "tap", RIGHT: "tap", JUMP: "tap" } as const;
const gestureAction = (
  from: { x: number; y: number },
  to: { x: number; y: number },
) => {
  const dx = to.x - from.x,
    dy = to.y - from.y;
  return Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 22
    ? dx < 0
      ? "LEFT"
      : "RIGHT"
    : dy < -22
      ? "JUMP"
      : null;
};
export default function MetroShiftVerified(props: GameRuntimeProps) {
  return (
    <div className="metroShiftVerified">
      <CoreCanvasGame
        {...props}
        core={METRO_CORE}
        name="Metro Shift"
        render={render}
        hudLabel={hudLabel}
        keys={keys}
        controls={controls}
        gestureAction={gestureAction}
        inputTones={inputTones}
        instruction="← → cambia carril · SALTAR supera las vallas ámbar"
      />
    </div>
  );
}
