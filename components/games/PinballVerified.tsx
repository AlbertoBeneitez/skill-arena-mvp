"use client";
import type { GameRuntimeProps } from "@/lib/games";
import { drawSpaceBackdrop } from "@/lib/spaceBackdrop";
import {
  PINBALL_BUMPER_RADIUS,
  PINBALL_CORE_V1,
  PINBALL_LANES,
  PINBALL_POSTS,
  PINBALL_RULES,
  PINBALL_SLINGS,
  PINBALL_TARGETS,
  PINBALL_WALLS,
  pinballBumpers,
  pinballChargeLevel,
  pinballFlipperTip,
  type PinballState,
} from "@/lib/verified/pinballCore.v1";
import CoreCanvasGame, { type CorePoint } from "./CoreCanvasGame";

const k = (v: number) => v / 1000;
function flipper(ctx: CanvasRenderingContext2D, s: PinballState, side: "left" | "right") {
  const angle = side === "left" ? s.left : s.right,
    held = side === "left" ? s.leftHeld : s.rightHeld,
    tip = pinballFlipperTip(side, angle);
  ctx.save();
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(0,0,0,.4)";
  ctx.lineWidth = 15;
  ctx.beginPath();
  ctx.moveTo(k(tip.pivot.x) + 2, k(tip.pivot.y) + 4);
  ctx.lineTo(k(tip.x) + 2, k(tip.y) + 4);
  ctx.stroke();
  ctx.strokeStyle = held ? "#ffe29a" : "#8fe3ff";
  ctx.shadowColor = held ? "#ffcf6a" : "#58cfe6";
  ctx.shadowBlur = held ? 14 : 6;
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.moveTo(k(tip.pivot.x), k(tip.pivot.y));
  ctx.lineTo(k(tip.x), k(tip.y));
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#0b2234";
  ctx.beginPath();
  ctx.arc(k(tip.pivot.x), k(tip.pivot.y), 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function render(ctx: CanvasRenderingContext2D, s: PinballState) {
  drawSpaceBackdrop(ctx, 390, 620, s.tick * 0.02, s.tick);
  // Table panel and playfield glow.
  ctx.save();
  ctx.fillStyle = "rgba(5,14,31,.82)";
  ctx.beginPath();
  ctx.moveTo(18, 640); ctx.lineTo(18, 140); ctx.lineTo(46, 70); ctx.lineTo(110, 42); ctx.lineTo(290, 42);
  ctx.lineTo(372, 124); ctx.lineTo(372, 640);
  ctx.fill();
  ctx.strokeStyle = "#5fa8c0";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  for (const w of PINBALL_WALLS) {
    ctx.beginPath();
    ctx.moveTo(k(w.ax), k(w.ay));
    ctx.lineTo(k(w.bx), k(w.by));
    ctx.stroke();
  }
  // Slim guide lights along the inlanes.
  ctx.strokeStyle = "rgba(140,230,255,.25)";
  ctx.lineWidth = 7;
  for (const w of PINBALL_WALLS.slice(-2)) {
    ctx.beginPath();
    ctx.moveTo(k(w.ax), k(w.ay));
    ctx.lineTo(k(w.bx), k(w.by));
    ctx.stroke();
  }
  ctx.restore();
  // Outlane markers (the only place a ball can be lost).
  ctx.fillStyle = "rgba(255,125,150,.5)";
  for (const x of [32, 334]) {
    ctx.beginPath();
    ctx.moveTo(x - 7, 520); ctx.lineTo(x + 7, 520); ctx.lineTo(x, 538);
    ctx.fill();
  }
  // Stand-up targets.
  PINBALL_TARGETS.forEach((t, i) => {
    ctx.strokeStyle = s.targets[i] ? "#ffe082" : "#c58a4e";
    ctx.shadowColor = s.targets[i] ? "#ffcf6a" : "transparent";
    ctx.shadowBlur = s.targets[i] ? 10 : 0;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(k(t.ax) + 3, k(t.ay));
    ctx.lineTo(k(t.bx) + 3, k(t.by));
    ctx.stroke();
    ctx.shadowBlur = 0;
  });
  // Rollover lanes.
  PINBALL_LANES.forEach((l, i) => {
    ctx.fillStyle = s.lanes[i] ? "#9fffb8" : "rgba(160,230,255,.22)";
    ctx.shadowColor = s.lanes[i] ? "#7cf0a0" : "transparent";
    ctx.shadowBlur = s.lanes[i] ? 12 : 0;
    ctx.beginPath();
    ctx.arc(k(l.x), k(l.y), 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  });
  // Ramp lane marker.
  ctx.strokeStyle = s.tick - s.lastRampTick < 40 ? "#ffe082" : "rgba(160,230,255,.28)";
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 5]);
  ctx.strokeRect(24, 160, 40, 40);
  ctx.setLineDash([]);
  // Bumpers, slings and posts.
  pinballBumpers(s.layout).forEach((p, i) => {
    const age = s.tick - s.bumperFlash[i], lit = age >= 0 && age < 14;
    const g = ctx.createRadialGradient(k(p.x) - 6, k(p.y) - 6, 2, k(p.x), k(p.y), 20);
    g.addColorStop(0, lit ? "#fff7d6" : "#d8f4ff");
    g.addColorStop(0.5, lit ? "#ffb76a" : "#5fb7d8");
    g.addColorStop(1, lit ? "#c35a2c" : "#1f4f78");
    ctx.fillStyle = g;
    ctx.shadowColor = lit ? "#ffb76a" : "#3fb8dd";
    ctx.shadowBlur = lit ? 22 : 8;
    ctx.beginPath();
    ctx.arc(k(p.x), k(p.y), k(PINBALL_BUMPER_RADIUS) + (lit ? 3 : 0), 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#e9fbff";
    ctx.lineWidth = 2;
    ctx.stroke();
  });
  PINBALL_SLINGS.forEach((p, i) => {
    const age = s.tick - s.slingFlash[i];
    ctx.fillStyle = age >= 0 && age < 10 ? "#ffd27a" : "#7a8fe0";
    ctx.beginPath();
    ctx.arc(k(p.x), k(p.y), 10, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = "#bfe9f7";
  for (const p of PINBALL_POSTS) {
    ctx.beginPath();
    ctx.arc(k(p.x), k(p.y), 5, 0, Math.PI * 2);
    ctx.fill();
  }
  flipper(ctx, s, "left");
  flipper(ctx, s, "right");
  // Spring: charge bar inside the lane.
  const level = pinballChargeLevel(s.charge);
  ctx.fillStyle = "rgba(255,255,255,.08)";
  ctx.fillRect(351, 420, 16, 160);
  if (s.phase === "lane" && s.chargeHeld) {
    const h = (s.charge / (PINBALL_RULES.maxChargeLevel * PINBALL_RULES.chargeStepTicks)) * 160;
    ctx.fillStyle = level >= 5 ? "#9fffb8" : "#ffd27a";
    ctx.fillRect(351, 580 - h, 16, h);
  }
  for (let i = 1; i <= PINBALL_RULES.maxChargeLevel; i++) {
    ctx.fillStyle = "rgba(255,255,255,.25)";
    ctx.fillRect(351, 580 - i * 20, 16, 1);
  }
  ctx.fillStyle = "#6a8aa0";
  ctx.fillRect(348, 585 + (s.chargeHeld ? 8 : 0), 22, 5);
  // Ball.
  if (s.phase !== "waiting") {
    const b = s.ball, x = k(b.x), y = k(b.y);
    const sp = Math.hypot(b.vx, b.vy);
    if (sp > 250000) {
      ctx.strokeStyle = "rgba(210,244,255,.22)";
      ctx.lineWidth = 8;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - (b.vx / sp) * 16, y - (b.vy / sp) * 16);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.beginPath();
    ctx.ellipse(x + 3, y + 4, 9, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    const g = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, 9);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.45, "#c9d9e6");
    g.addColorStop(1, "#5b7186");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.fill();
  }
  // Saver glow, remaining balls and multiplier.
  if (s.saver > 0) {
    ctx.strokeStyle = `rgba(159,255,184,${0.25 + 0.2 * Math.sin(s.tick / 10)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(132, 610); ctx.lineTo(258, 610);
    ctx.stroke();
  }
  for (let i = 0; i < PINBALL_RULES.balls; i++) {
    ctx.fillStyle = i < s.lives ? "#e8f4fb" : "rgba(180,210,225,.2)";
    ctx.beginPath();
    ctx.arc(34 + i * 18, 58, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#ffe082";
  ctx.font = "900 16px system-ui";
  ctx.textAlign = "right";
  ctx.fillText(`×${s.multiplier}`, 330, 66);
  // Score pop-ups.
  const ev = s.lastEvent;
  if (ev && ev.points > 0 && s.tick - ev.tick < 60) {
    const age = (s.tick - ev.tick) / 60;
    ctx.globalAlpha = 1 - age;
    ctx.fillStyle = ev.kind === "TARGETS" || ev.kind === "LANES" ? "#9fffb8" : "#fff2c0";
    ctx.font = "900 15px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(`+${ev.points}`, Math.max(40, Math.min(330, k(ev.x))), k(ev.y) - 18 - age * 26);
    ctx.globalAlpha = 1;
  }
  if (ev && ev.kind === "SAVE" && s.tick - ev.tick < 90) {
    ctx.fillStyle = "#9fffb8";
    ctx.font = "900 14px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("¡SALVADA!", 195, 560);
  }
  if (s.status === "failed") {
    ctx.fillStyle = "rgba(216,81,109,.15)";
    ctx.fillRect(0, 0, 390, 620);
  }
}

function pointAction(point: CorePoint, phase: "down" | "move" | "up", s: PinballState) {
  if (phase === "move" || point.y > 540) return null;
  const left = point.x < 195;
  if (phase === "down") return left ? "FLIP_LEFT_PRESS" : "FLIP_RIGHT_PRESS";
  if (left && s.leftHeld) return "FLIP_LEFT_RELEASE";
  if (!left && s.rightHeld) return "FLIP_RIGHT_RELEASE";
  return null;
}

const keys = {
  ArrowLeft: "FLIP_LEFT_PRESS", z: "FLIP_LEFT_PRESS", Z: "FLIP_LEFT_PRESS",
  ArrowRight: "FLIP_RIGHT_PRESS", x: "FLIP_RIGHT_PRESS", X: "FLIP_RIGHT_PRESS",
  " ": "PLUNGER_HOLD", ArrowDown: "PLUNGER_HOLD",
} as const;
const keyReleases = {
  ArrowLeft: "FLIP_LEFT_RELEASE", z: "FLIP_LEFT_RELEASE", Z: "FLIP_LEFT_RELEASE",
  ArrowRight: "FLIP_RIGHT_RELEASE", x: "FLIP_RIGHT_RELEASE", X: "FLIP_RIGHT_RELEASE",
  " ": "PLUNGER_RELEASE", ArrowDown: "PLUNGER_RELEASE",
} as const;
const controls = [
  { action: "FLIP_LEFT_PRESS", releaseAction: "FLIP_LEFT_RELEASE", label: "Pala izquierda", symbol: "◀", style: { width: 104 } },
  { action: "PLUNGER_HOLD", releaseAction: "PLUNGER_RELEASE", label: "Muelle: mantén y suelta", symbol: "MUELLE", style: { width: 120, fontSize: 15 } },
  { action: "FLIP_RIGHT_PRESS", releaseAction: "FLIP_RIGHT_RELEASE", label: "Pala derecha", symbol: "▶", style: { width: 104 } },
] as const;
const inputTones = { PLUNGER_RELEASE: "tap", FLIP_LEFT_PRESS: "tap", FLIP_RIGHT_PRESS: "tap" } as const;
const hudLabel = (s: Readonly<PinballState>) => `BOLA ${Math.min(s.ballNo, PINBALL_RULES.balls)}/${PINBALL_RULES.balls} · ×${s.multiplier}`;

export default function PinballVerified(props: GameRuntimeProps) {
  return (
    <div className="pinballVerified">
      <CoreCanvasGame
        {...props}
        core={PINBALL_CORE_V1}
        name="Pinball"
        render={render}
        pointAction={pointAction}
        keys={keys}
        keyReleases={keyReleases}
        controls={controls}
        inputTones={inputTones}
        hudLabel={hudLabel}
        instruction=""
      />
    </div>
  );
}
