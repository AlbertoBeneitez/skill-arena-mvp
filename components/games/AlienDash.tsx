"use client";
import type { GameRuntimeProps } from "@/lib/games";
import { drawSpaceBackdrop } from "@/lib/spaceBackdrop";
import {
  ALIEN_DASH_CORE,
  type AlienState,
} from "@/lib/verified/alienDashCore.v2";
import CoreCanvasGame from "./CoreCanvasGame";
function render(ctx: CanvasRenderingContext2D, s: AlienState) {
  drawSpaceBackdrop(ctx, 390, 620, s.scroll / 1000, s.tick);
  // Distant colony silhouettes and foreground transport deck provide depth, never hitboxes.
  ctx.fillStyle = "rgba(48,74,101,.48)";
  for (let i = 0; i < 8; i++) {
    const x = ((((i * 89 - (s.scroll / 1000) * 0.12) % 470) + 470) % 470) - 40,
      h = 38 + ((i * 23) % 50);
    ctx.fillRect(x, 440 - h, 44, h);
    ctx.fillStyle = "rgba(125,189,213,.3)";
    ctx.fillRect(x + 9, 448 - h, 4, 9);
    ctx.fillStyle = "rgba(48,74,101,.48)";
  }
  const ground = ctx.createLinearGradient(0, 508, 0, 620);
  ground.addColorStop(0, "#193349");
  ground.addColorStop(1, "#071c2e");
  ctx.fillStyle = ground;
  ctx.fillRect(0, 508, 390, 112);
  ctx.strokeStyle = "#6bd3c7";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 509);
  ctx.lineTo(390, 509);
  ctx.stroke();
  ctx.strokeStyle = "rgba(140,195,219,.17)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 9; i++) {
    const x = ((((i * 62 - s.scroll / 1000) % 500) + 500) % 500) - 50;
    ctx.beginPath();
    ctx.moveTo(x, 514);
    ctx.lineTo(x - 22, 578);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(0, 530);
  ctx.lineTo(390, 530);
  ctx.stroke();
  for (const a of s.actors) {
    const x = (a.x - s.scroll) / 1000,
      w = a.width / 1000,
      h = a.height / 1000,
      y = (a.bottom - a.height) / 1000;
    if (x > 430 || x + w < -35) continue;
    if (a.kind === "platform") {
      ctx.fillStyle = "#294d65";
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 5);
      ctx.fill();
      ctx.fillStyle = "#83d6cc";
      ctx.fillRect(x, y, w, 4);
      ctx.fillStyle = "#142d42";
      for (let j = 15; j < w; j += 32)
        ctx.fillRect(x + j, y + 10, 18, Math.max(3, h - 14));
    } else if (a.kind === "rock") {
      ctx.fillStyle = "#846b8a";
      ctx.beginPath();
      ctx.moveTo(x + 3, y + h);
      ctx.lineTo(x, y + 12);
      ctx.lineTo(x + w * 0.4, y);
      ctx.lineTo(x + w - 4, y + 7);
      ctx.lineTo(x + w, y + h);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#cba5bc";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + w * 0.4, y + 3);
      ctx.lineTo(x + w * 0.6, y + h * 0.5);
      ctx.lineTo(x + w * 0.3, y + h);
      ctx.stroke();
    } else if (a.kind === "drone") {
      ctx.fillStyle = "#9d86bd";
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e5d5ff";
      ctx.fillRect(x + w * 0.3, y + h * 0.25, w * 0.4, 4);
      ctx.fillStyle = "#60dbd0";
      ctx.fillRect(x + w * 0.35, y + h, w * 0.3, 3);
      if (a.bottom === 474000 && x > 125 && x < 330) {
        ctx.fillStyle = "#c8c3e6";
        ctx.font = "bold 10px system-ui";
        ctx.textAlign = "center";
        ctx.fillText("AGACHAR", x + w / 2, y - 11);
      }
    } else {
      ctx.fillStyle = "#cb977d";
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#201e35";
      ctx.beginPath();
      ctx.ellipse(x + w * 0.35, y + h * 0.45, 5, 7, -0.2, 0, Math.PI * 2);
      ctx.ellipse(x + w * 0.68, y + h * 0.45, 5, 7, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = a.fired ? "#de7d66" : "#ffd284";
      ctx.beginPath();
      ctx.arc(x + 8, y + h - 7, 4, 0, Math.PI * 2);
      ctx.fill();
      if (a.chargeTick !== null && !a.fired) {
        const progress = Math.min(1, (s.tick - a.chargeTick) / 60);
        ctx.strokeStyle = "rgba(255,157,119,.45)";
        ctx.setLineDash([4, 7]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 8, y + h - 7);
        ctx.lineTo(90, 483);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#513b42";
        ctx.fillRect(x, y - 12, w, 4);
        ctx.fillStyle = "#ffba83";
        ctx.fillRect(x, y - 12, w * progress, 4);
      }
    }
  }
  for (const l of s.collectibles) {
    if (l.collected) continue;
    const x = (l.x - s.scroll) / 1000,
      y = l.y / 1000;
    if (x < -20 || x > 420) continue;
    ctx.save();
    ctx.shadowColor = "#84e9cc";
    ctx.shadowBlur = 12;
    ctx.fillStyle = "#134d47";
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#9bf2d4";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#aeffe0";
    ctx.fillRect(x - 5, y - 1.5, 10, 3);
    ctx.fillRect(x - 1.5, y - 5, 3, 10);
    ctx.restore();
  }
  for (const b of s.bolts) {
    if (b.spent) continue;
    const x = (b.x - s.scroll) / 1000,
      y = b.y / 1000;
    ctx.strokeStyle = "#ffad95";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x + 10, y - 7);
    ctx.lineTo(x - 4, y + 2);
    ctx.stroke();
  }
  const duck = s.ducking && s.grounded,
    h = duck ? 29 : 46,
    y = s.feet / 1000 - h,
    blink = s.tick < s.shieldUntil && Math.floor(s.tick / 7) % 2 === 0;
  ctx.save();
  if (blink) ctx.globalAlpha = 0.45;
  ctx.fillStyle = "rgba(0,0,0,.3)";
  ctx.beginPath();
  ctx.ellipse(90, 508, 23, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#667eb4";
  ctx.beginPath();
  ctx.roundRect(74, y + 15, 31, Math.max(10, h - 16), 9);
  ctx.fill();
  ctx.fillStyle = "#a6e2c3";
  ctx.beginPath();
  ctx.ellipse(89, y + 13, 18, duck ? 10 : 15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#d3f0ff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(89, y + 12, 20, duck ? 12 : 18, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#172844";
  for (const x of [80, 91, 100]) {
    ctx.beginPath();
    ctx.arc(x, y + 10, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#b7d3ed";
  ctx.fillRect(76, s.feet / 1000 - 5, 11, 5);
  ctx.fillRect(93, s.feet / 1000 - 5, 11, 5);
  ctx.restore();
  if (s.tick - s.lastDamageTick < 70) {
    ctx.fillStyle = "rgba(255,117,114,.12)";
    ctx.fillRect(0, 0, 390, 620);
  }
  if (s.tick - s.lastPickupTick < 80) {
    ctx.fillStyle = "#adf5d8";
    ctx.font = "bold 13px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("ESCUDO RECUPERADO", 195, 126);
  }
  ctx.textAlign = "center";
  ctx.fillStyle = "#adcadd";
  ctx.font = "bold 12px system-ui";
  ctx.fillText(
    "EXPLORACIÓN EN CURSO",
    195,
    65,
  );
  ctx.font = "11px system-ui";
  ctx.fillText(`${Math.floor(s.tick / 120)} s / 120 s`, 195, 85);
  if (
    s.actors.some(
      (a) => a.chargeTick !== null && !a.fired && a.x - s.scroll < 390000,
    )
  ) {
    ctx.fillStyle = "#f4c5a0";
    ctx.font = "bold 13px system-ui";
    ctx.fillText("CENTINELA CARGANDO", 195, 192);
  }
  ctx.textAlign = "left";
}
const controls = [
    { action: "JUMP", label: "Saltar", symbol: "SALTAR" },
    {
      action: "DUCK_DOWN",
      releaseAction: "DUCK_UP",
      label: "Mantener agachado",
      symbol: "AGACHAR",
    },
  ],
  keys = { " ": "JUMP", ArrowUp: "JUMP", ArrowDown: "DUCK_DOWN" },
  releases = { ArrowDown: "DUCK_UP" },
  tones = { JUMP: "tap" } as const;
const failureFinale = {
  durationMs: 350,
  render(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = "rgba(115,40,66,.15)";
    ctx.fillRect(0, 0, 390, 620);
  },
};
const feedbackScore = (state: AlienState) => state.score - state.distancePoints;
export default function AlienDash(props: GameRuntimeProps) {
  return (
    <div className="alienDashVerified">
      <CoreCanvasGame
        {...props}
        core={ALIEN_DASH_CORE}
        feedbackScore={feedbackScore}
        name="Alien Dash"
        render={render}
        primaryAction="JUMP"
        controls={controls}
        keys={keys}
        keyReleases={releases}
        inputTones={tones}
        hideHudLabel
        failureFinale={failureFinale}
        instruction="Salta rocas y rayos. Mantén AGACHAR bajo drones. Los signos + recuperan escudos."
      />
    </div>
  );
}
