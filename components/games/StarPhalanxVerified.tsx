"use client";
import type { GameRuntimeProps } from "@/lib/games";
import {
  PHALANX_CORE,
  PHALANX_RULES,
  type PhalanxState,
} from "@/lib/verified/starPhalanxCore.v2";
import { drawSpaceBackdrop } from "@/lib/spaceBackdrop";
import { drawPhalanxBolt } from "@/lib/phalanxPresentation";
import CoreCanvasGame, { type CorePoint } from "./CoreCanvasGame";
function render(ctx: CanvasRenderingContext2D, s: PhalanxState) {
  drawSpaceBackdrop(ctx, 390, 620, s.tick * 0.22, s.tick);
  ctx.fillStyle = "rgba(5,15,31,.45)";
  ctx.fillRect(0, 490, 390, 130);
  ctx.strokeStyle = "rgba(117,209,243,.12)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    ctx.moveTo(195 + i * 38 - 114, 490);
    ctx.lineTo(195 + i * 78 - 234, 620);
    ctx.stroke();
  }
  if (s.nextLayerTick !== null) {
    ctx.strokeStyle = "rgba(156,204,240,.25)";
    for (let i = 0; i < 3; i++) {
      const x = 151 + i * 44;
      ctx.beginPath();
      ctx.moveTo(x, 118);
      ctx.lineTo(x - 12, 141);
      ctx.lineTo(x + 12, 141);
      ctx.closePath();
      ctx.stroke();
    }
  }
  for (const e of s.enemies) {
    if (e.hp <= 0) continue;
    const x = (e.x + s.offset) / 1000,
      y = (e.y + s.descent) / 1000;
    if (s.chargeId === e.id) {
      ctx.save();
      ctx.setLineDash([5, 7]);
      ctx.strokeStyle = `rgba(255,127,143,${0.2 + (s.tick - s.chargeStarted) / 100})`;
      for (const lane of s.wave >= 4 || (s.wave >= 3 && e.maxHp > 1)
        ? [-22, 22]
        : [0]) {
        ctx.beginPath();
        ctx.moveTo(x + lane, y + 18);
        ctx.lineTo(x + lane, 575);
        ctx.stroke();
      }
      ctx.restore();
      ctx.fillStyle = "#ff8d9f";
      ctx.fillRect(
        x - 18,
        y - 27,
        36 * Math.min(1, (s.tick - s.chargeStarted) / 60),
        3,
      );
    }
    const color = e.maxHp > 1 ? "#c1a8ff" : s.wave >= 4 ? "#edaa76" : "#83e2df";
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 7;
    ctx.beginPath();
    ctx.moveTo(x, y + 14);
    ctx.lineTo(x - 16, y - 12);
    ctx.lineTo(x + 16, y - 12);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#173345";
    ctx.beginPath();
    ctx.moveTo(x, y + 6);
    ctx.lineTo(x - 8, y - 8);
    ctx.lineTo(x + 8, y - 8);
    ctx.closePath();
    ctx.fill();
    // Armor pips communicate remaining hits without covering the silhouette.
    if (e.maxHp > 1) {
      for (let hp = 0; hp < e.maxHp; hp++) {
        ctx.fillStyle = hp < e.hp ? "#eadcff" : "#4d4066";
        ctx.fillRect(x - (e.maxHp * 5 - 2) / 2 + hp * 5, y - 20, 3, 3);
      }
    }
    if (s.chargeId === e.id) {
      const charge = Math.min(
        1,
        Math.max(0, (s.tick - s.chargeStarted) / PHALANX_RULES.chargeTicks),
      );
      ctx.strokeStyle = "#ffb29e";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 20, -Math.PI / 2, -Math.PI / 2 + charge * Math.PI * 2);
      ctx.stroke();
    }
  }
  for (const b of s.shots) drawPhalanxBolt(ctx, b);

  const killAge = s.tick - s.lastKillTick;
  if (killAge >= 0 && killAge < 36) {
    ctx.globalAlpha = 1 - killAge / 36;
    ctx.fillStyle = "#e0fff5";
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI) / 5,
        d = killAge * 0.9;
      ctx.fillRect(
        s.lastKillX / 1000 + Math.cos(a) * d,
        s.lastKillY / 1000 + Math.sin(a) * d,
        2,
        2,
      );
    }
    ctx.globalAlpha = 1;
  }
  ctx.save();
  ctx.translate(s.shipX / 1000, 552);
  if (s.tick < s.shieldUntil && Math.floor(s.tick / 9) % 2)
    ctx.globalAlpha = 0.35;
  ctx.fillStyle = "#90eff1";
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.lineTo(18, 13);
  ctx.lineTo(0, 6);
  ctx.lineTo(-18, 13);
  ctx.closePath();
  ctx.fill();
  // Cockpit and metal wing trim retain the authoritative hull center.
  ctx.strokeStyle = "#4f9fb9";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-12, 8);
  ctx.lineTo(-3, 0);
  ctx.moveTo(12, 8);
  ctx.lineTo(3, 0);
  ctx.stroke();
  const shotAge = s.tick - s.lastPlayerShot;
  if (s.firing && shotAge >= 0 && shotAge < 8) {
    ctx.save();
    ctx.globalAlpha = 1 - shotAge / 8;
    ctx.strokeStyle = "#ecffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -22, 3 + shotAge * 0.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  if (s.tick < s.shieldUntil) {
    const remaining = Math.min(
      1,
      (s.shieldUntil - s.tick) / PHALANX_RULES.shieldTicks,
    );
    ctx.save();
    ctx.globalAlpha = 0.65;
    ctx.strokeStyle = "#c3e6ff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 25, -Math.PI / 2, -Math.PI / 2 + remaining * Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = "#d5f7ff";
  ctx.fillRect(-3, -6, 6, 13);
  if (s.firing) {
    ctx.fillStyle = "#7aa7f4";
    ctx.fillRect(-6, 12, 4, 9 + (s.tick % 6));
    ctx.fillRect(2, 12, 4, 9 + (s.tick % 6));
  }
  ctx.restore();
  if (s.tick - s.lastDamageTick < 18) {
    ctx.fillStyle = `rgba(244,87,124,${(1 - (s.tick - s.lastDamageTick) / 18) * 0.22})`;
    ctx.fillRect(0, 0, 390, 620);
  }
  ctx.textAlign = "left";
}
function pointAction(p: CorePoint, phase: "down" | "move" | "up") {
  if (phase === "up") return null;
  const aim = `AIM_${String(Math.max(0, Math.min(35, Math.round((p.x - 20) / 10)))).padStart(3, "0")}`;
  return phase === "down" ? [aim, "FIRE_DOWN"] : aim;
}
const inputTones = { FIRE_DOWN: "tap" } as const;
const feedbackScore = (s: Readonly<PhalanxState>) =>
  s.score - (3 - s.lives) * 250;
const keys = { " ": "FIRE_DOWN" } as const,
  keyReleases = { " ": "FIRE_UP" } as const;
const hudLabel = (s: Readonly<PhalanxState>) =>
  `${s.kills} NAVES · ${Math.max(0, Math.ceil((21600 - s.tick) / 120))}s`;
export default function StarPhalanxVerified(props: GameRuntimeProps) {
  return (
    <div className="phalanxVerified">
      <CoreCanvasGame
        {...props}
        core={PHALANX_CORE}
        name="Star Phalanx"
        hideHudScore
        render={render}
        inputTones={inputTones}
        feedbackScore={feedbackScore}
        pointAction={pointAction}
        coalescePointActions
        pointerReleaseAction="FIRE_UP"
        keys={keys}
        keyReleases={keyReleases}
        hudLabel={hudLabel}
        instruction="Mantén y arrastra para moverte y disparar. Suelta para pausar el fuego."
      />
    </div>
  );
}
