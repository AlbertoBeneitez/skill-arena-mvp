"use client";
import type { GameRuntimeProps } from "@/lib/games";
import { drawSpaceBackdrop } from "@/lib/spaceBackdrop";
import {
  PINBALL_BUMPER_RADIUS_V3,
  PINBALL_CORE_V3,
  PINBALL_DROPS_V3,
  PINBALL_LANES_V3,
  PINBALL_POSTS_V3,
  PINBALL_RTARGETS_V3,
  PINBALL_RULES_V3,
  PINBALL_SAUCER_V3,
  PINBALL_SLINGS_V3,
  PINBALL_SPINNER_V3,
  PINBALL_TARGETS_V3,
  PINBALL_WALLS_V3,
  pinballBumpersV3,
  pinballChargeLevelV3,
  pinballFlipperTipV3,
  type PinballStateV3,
} from "@/lib/verified/pinballCore.v3";
import CoreCanvasGame, { type CorePoint } from "./CoreCanvasGame";

const k = (v: number) => v / 1000;
function flipper(ctx: CanvasRenderingContext2D, s: PinballStateV3, side: "left" | "right") {
  const angle = side === "left" ? s.left : s.right,
    held = side === "left" ? s.leftHeld : s.rightHeld,
    tip = pinballFlipperTipV3(side, angle);
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

function render(ctx: CanvasRenderingContext2D, s: PinballStateV3) {
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
  for (const w of PINBALL_WALLS_V3) {
    ctx.beginPath();
    ctx.moveTo(k(w.ax), k(w.ay));
    ctx.lineTo(k(w.bx), k(w.by));
    ctx.stroke();
  }
  // Slim guide lights along the inlanes.
  ctx.strokeStyle = "rgba(140,230,255,.25)";
  ctx.lineWidth = 7;
  for (const w of PINBALL_WALLS_V3.slice(-2)) {
    ctx.beginPath();
    ctx.moveTo(k(w.ax), k(w.ay));
    ctx.lineTo(k(w.bx), k(w.by));
    ctx.stroke();
  }
  ctx.restore();
  // Stand-up targets.
  PINBALL_TARGETS_V3.forEach((t, i) => {
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
  PINBALL_LANES_V3.forEach((l, i) => {
    ctx.fillStyle = s.lanes[i] ? "#9fffb8" : "rgba(160,230,255,.22)";
    ctx.shadowColor = s.lanes[i] ? "#7cf0a0" : "transparent";
    ctx.shadowBlur = s.lanes[i] ? 12 : 0;
    ctx.beginPath();
    ctx.arc(k(l.x), k(l.y), 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  });
  // Skill-shot lane flashes while the window is open.
  if (s.launchTick >= 0 && !s.skillDone && s.tick - s.launchTick <= PINBALL_RULES_V3.skillWindowTicks) {
    const l = PINBALL_LANES_V3[s.skillLane], on = Math.floor(s.tick / 8) % 2 === 0;
    ctx.strokeStyle = on ? "#ffe082" : "rgba(255,224,130,.2)";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(k(l.x), k(l.y), 13, 0, Math.PI * 2); ctx.stroke();
  }
  // Right stand-up targets (light the saucer).
  PINBALL_RTARGETS_V3.forEach((t2, i) => {
    ctx.strokeStyle = s.rTargets[i] ? "#ffe082" : "#c58a4e";
    ctx.shadowColor = s.rTargets[i] ? "#ffcf6a" : "transparent";
    ctx.shadowBlur = s.rTargets[i] ? 10 : 0;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(k(t2.ax) - 3, k(t2.ay));
    ctx.lineTo(k(t2.bx) - 3, k(t2.by));
    ctx.stroke();
    ctx.shadowBlur = 0;
  });
  // Drop-target bank: standing targets are solid, dropped ones are a dim slot.
  PINBALL_DROPS_V3.forEach((w, i) => {
    const age = s.tick - s.dropFlash[i];
    ctx.lineCap = "round";
    ctx.lineWidth = s.drops[i] ? 3 : 8;
    ctx.strokeStyle = s.drops[i] ? "rgba(255,255,255,.18)" : "#ff9d5c";
    ctx.shadowColor = age >= 0 && age < 20 ? "#ffd27a" : "transparent";
    ctx.shadowBlur = age >= 0 && age < 20 ? 14 : 0;
    ctx.beginPath(); ctx.moveTo(k(w.ax), k(w.ay)); ctx.lineTo(k(w.bx), k(w.by)); ctx.stroke();
    ctx.shadowBlur = 0;
  });
  // Spinner: a blade whose angle follows the spin counter.
  {
    const sp = PINBALL_SPINNER_V3, cx = k(sp.x0 + sp.x1) / 2, cy = k(sp.y0 + sp.y1) / 2, a = s.spins * 1.1;
    ctx.strokeStyle = "rgba(160,230,255,.3)"; ctx.lineWidth = 1;
    ctx.strokeRect(k(sp.x0), k(sp.y0), k(sp.x1 - sp.x0), k(sp.y1 - sp.y0));
    ctx.strokeStyle = "#8fe3ff"; ctx.lineWidth = 4; ctx.lineCap = "round";
    const w = 22 * Math.abs(Math.cos(a));
    ctx.beginPath(); ctx.moveTo(cx - w, cy); ctx.lineTo(cx + w, cy); ctx.stroke();
  }
  // Saucer.
  {
    const c = PINBALL_SAUCER_V3, lit = s.saucerLit && Math.floor(s.tick / 10) % 2 === 0;
    ctx.fillStyle = "#050b17"; ctx.strokeStyle = lit ? "#ffe082" : "#7f9fdc"; ctx.lineWidth = 3;
    ctx.shadowColor = s.saucerLit ? "#ffcf6a" : "transparent"; ctx.shadowBlur = s.saucerLit ? 16 : 0;
    ctx.beginPath(); ctx.arc(k(c.x), k(c.y), 14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
  }
  // Bumpers, slings and posts.
  pinballBumpersV3(s.layout).forEach((p, i) => {
    const age = s.tick - s.bumperFlash[i], lit = age >= 0 && age < 14;
    const g = ctx.createRadialGradient(k(p.x) - 6, k(p.y) - 6, 2, k(p.x), k(p.y), 20);
    g.addColorStop(0, lit ? "#fff7d6" : "#d8f4ff");
    g.addColorStop(0.5, lit ? "#ffb76a" : "#5fb7d8");
    g.addColorStop(1, lit ? "#c35a2c" : "#1f4f78");
    ctx.fillStyle = g;
    ctx.shadowColor = lit ? "#ffb76a" : "#3fb8dd";
    ctx.shadowBlur = lit ? 22 : 8;
    ctx.beginPath();
    ctx.arc(k(p.x), k(p.y), k(PINBALL_BUMPER_RADIUS_V3) + (lit ? 3 : 0), 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#e9fbff";
    ctx.lineWidth = 2;
    ctx.stroke();
  });
  PINBALL_SLINGS_V3.forEach((p, i) => {
    const age = s.tick - s.slingFlash[i];
    ctx.fillStyle = age >= 0 && age < 10 ? "#ffd27a" : "#7a8fe0";
    ctx.beginPath();
    ctx.arc(k(p.x), k(p.y), 10, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = "#bfe9f7";
  for (const p of PINBALL_POSTS_V3) {
    ctx.beginPath();
    ctx.arc(k(p.x), k(p.y), 5, 0, Math.PI * 2);
    ctx.fill();
  }
  flipper(ctx, s, "left");
  flipper(ctx, s, "right");
  // Spring: charge bar inside the lane.
  const level = pinballChargeLevelV3(s.charge);
  ctx.fillStyle = "rgba(255,255,255,.08)";
  ctx.fillRect(351, 420, 16, 160);
  if (s.phase === "lane" && s.chargeHeld) {
    const h = (s.charge / (PINBALL_RULES_V3.maxChargeLevel * PINBALL_RULES_V3.chargeStepTicks)) * 160;
    ctx.fillStyle = level >= 5 ? "#9fffb8" : "#ffd27a";
    ctx.fillRect(351, 580 - h, 16, h);
  }
  for (let i = 1; i <= PINBALL_RULES_V3.maxChargeLevel; i++) {
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
  // Drain gap: pulsing red hazard line between the flippers.
  {
    ctx.strokeStyle = `rgba(255,110,110,${0.3 + 0.25 * Math.sin(s.tick / 12)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(PINBALL_RULES_V3.leftPivot.x / 1000 + 60, 606); ctx.lineTo(PINBALL_RULES_V3.rightPivot.x / 1000 - 60, 606);
    ctx.stroke();
  }
  const left = Math.max(0, 1 - s.tick / PINBALL_RULES_V3.maxFinalTick);
  ctx.fillStyle = "rgba(255,255,255,.12)";
  ctx.fillRect(34, 54, 180, 6);
  ctx.fillStyle = left > 0.25 ? "#7cf0c8" : "#ff7a95";
  ctx.fillRect(34, 54, 180 * left, 6);
  ctx.fillStyle = "#ffe082";
  ctx.font = "900 16px system-ui";
  ctx.textAlign = "right";
  ctx.fillText(`×${s.multiplier}`, 330, 66);
  if (s.combo > 0 && s.tick - s.lastShotTick < PINBALL_RULES_V3.comboWindowTicks) {
    ctx.fillStyle = "#ff9d5c";
    ctx.font = "900 13px system-ui";
    ctx.fillText(`COMBO ×${s.combo + 1}`, 330, 84);
  }
  // Event bursts and call-outs, drawn from the deterministic event feed.
  const callouts: Record<string, [string, string]> = {
    SKILL: ["¡SKILL SHOT!", "#ffe082"], JACKPOT: ["¡JACKPOT!", "#ffd27a"], DROPS: ["BLOQUE ABATIDO", "#ff9d5c"],
    LANES: ["A-B-C ×", "#9fffb8"], TARGETS: ["DIANAS ×", "#9fffb8"], RAMP: ["RAMPA", "#8fe3ff"], ORBIT: ["ÓRBITA", "#8fe3ff"],
    SAUCERLIT: ["PLATO ENCENDIDO", "#ffe082"], COMBO: ["COMBO", "#ff9d5c"], DRAIN: ["¡BOLA PERDIDA! ×1", "#ff8a8a"], BONUS: ["BONUS FINAL", "#ffe082"],
    FLICK: ["PUNTA", "#d5f3ff"],
  };
  for (const ev of s.feed) {
    const age = s.tick - ev.tick;
    if (age < 0 || age > 70) continue;
    const x = Math.max(36, Math.min(340, k(ev.x))), y = k(ev.y);
    if (age < 22 && ev.kind !== "SPINNER" && ev.kind !== "EJECT" && ev.kind !== "LAUNCH") {
      ctx.strokeStyle = `rgba(255,236,170,${1 - age / 22})`;
      ctx.lineWidth = 2;
      for (let n = 0; n < 8; n++) {
        const a = (n / 8) * Math.PI * 2 + ev.tick * 0.7, r1 = 6 + age * 1.2, r2 = r1 + 7 + age * 0.5;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1);
        ctx.lineTo(x + Math.cos(a) * r2, y + Math.sin(a) * r2);
        ctx.stroke();
      }
    }
    if (ev.points > 0 && ev.kind !== "BONUS") {
      ctx.globalAlpha = Math.max(0, 1 - age / 70);
      ctx.fillStyle = "#fff2c0";
      ctx.font = "900 14px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(`+${ev.points}`, x, y - 16 - age * 0.4);
      ctx.globalAlpha = 1;
    }
    const c = callouts[ev.kind];
    if (c && age < 70) {
      const grow = Math.min(1, age / 8);
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, age - 40) / 30);
      ctx.fillStyle = c[1];
      ctx.shadowColor = c[1]; ctx.shadowBlur = 14;
      ctx.font = `900 ${16 + Math.round(8 * grow)}px system-ui`;
      ctx.textAlign = "center";
      ctx.fillText(ev.kind === "BONUS" ? `BONUS FINAL +${ev.points}` : c[0], 195, 320 - (ev.kind === "COMBO" ? 24 : 0) - age * 0.2);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
  }
  if (s.status === "failed") {
    ctx.fillStyle = "rgba(216,81,109,.15)";
    ctx.fillRect(0, 0, 390, 620);
  }
}

function pointAction(point: CorePoint, phase: "down" | "move" | "up", s: PinballStateV3) {
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
const hudLabel = (s: Readonly<PinballStateV3>) => `${Math.max(0, Math.ceil((PINBALL_RULES_V3.maxFinalTick - s.tick) / PINBALL_RULES_V3.tickRate))} s · ×${s.multiplier}`;

export default function PinballVerified(props: GameRuntimeProps) {
  return (
    <div className="pinballVerified">
      <CoreCanvasGame
        {...props}
        core={PINBALL_CORE_V3}
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
