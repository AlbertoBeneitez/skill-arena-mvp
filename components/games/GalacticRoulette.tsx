"use client";
import { useRef, useCallback, useEffect } from "react";
import type { GameRuntimeProps } from "@/lib/games";
import {
  ROULETTE_CORE_V11,
  ROULETTE_RULES_V11,
  ROULETTE_WHEEL,
  ROULETTE_RED,
  type RouletteStateV11 as RouletteStateV2,
  rouletteSurfaceV11,
} from "@/lib/verified/galacticRouletteCore.v11";
import { ROULETTE_BETS } from "@/lib/verified/galacticRouletteProtocol.v3";
import { ROULETTE_DENOMINATIONS } from "@/lib/verified/galacticRouletteProtocol.v8";
import {
  ROULETTE_BALL_DOCK,
  rouletteLauncherCanGrab,
  rouletteLauncherToss,
} from "@/lib/rouletteLaunchGesture";
import { drawSpaceBackdrop } from "@/lib/spaceBackdrop";
import CoreCanvasGame, { type CorePoint } from "./CoreCanvasGame";
import { t, formatNumber, useI18n } from "@/lib/i18n";
const cx = 195,
  cy = 195;
/**
 * v120: the wheel is drawn 8 % larger and lower (V11 logical height 440), so the row of last results sits above it
 * with a clear gap. Physics coordinates never change: everything in wheel space is drawn through this transform and
 * touches are mapped back with toWheel().
 */
const WHEEL_SCALE = 1.08, WHEEL_DY = 34;
export const toWheel = (p: CorePoint): CorePoint => ({ x: cx + (p.x - cx) / WHEEL_SCALE, y: cy + (p.y - cy - WHEEL_DY) / WHEEL_SCALE });
const BALL_R = ROULETTE_RULES_V11.ballRadius / 1000;
// Presentation radii (the authoritative ball physics live in the core).
const NUMBER_OUTER = 121,
  NUMBER_INNER = 104,
  POCKET_OUTER = 103,
  POCKET_INNER = 84,
  POCKET_REST = 93.5;
function render(
  ctx: CanvasRenderingContext2D,
  s: RouletteStateV2,
  drag: CorePoint | null = null,
) {
  drawSpaceBackdrop(ctx, 390, 440, 1, s.tick);
  ctx.save();
  ctx.translate(cx, cy + WHEEL_DY);
  ctx.scale(WHEEL_SCALE, WHEEL_SCALE);
  ctx.translate(-cx, -cy);
  const rotation = (s.wheelPhase / 65536) * Math.PI * 2 - Math.PI / 2;
  ctx.fillStyle = "#193545";
  ctx.strokeStyle = "#dbb783";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(cx, cy, 155, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Each number has two parts, like a real wheel: an outer numbered band and,
  // just inside it, its own square pocket where the ball comes to rest.
  const pocketColor = (n: number) =>
    n === 0 ? "#f1f5ee" : ROULETTE_RED.includes(n as (typeof ROULETTE_RED)[number]) ? "#17956f" : "#2160b0";
  const pocketFloor = (n: number) =>
    n === 0 ? "#b9c3bd" : ROULETTE_RED.includes(n as (typeof ROULETTE_RED)[number]) ? "#0d6a4f" : "#163f7c";
  for (let i = 0; i < 37; i++) {
    const a = rotation + ((i - 0.5) * Math.PI * 2) / 37,
      b = rotation + ((i + 0.5) * Math.PI * 2) / 37,
      mid = (a + b) / 2,
      n = ROULETTE_WHEEL[i];
    // Numbered band.
    ctx.fillStyle = pocketColor(n);
    ctx.beginPath();
    ctx.arc(cx, cy, NUMBER_OUTER, a, b);
    ctx.arc(cx, cy, NUMBER_INNER, b, a, true);
    ctx.closePath();
    ctx.fill();
    ctx.save();
    ctx.translate(cx + Math.cos(mid) * (NUMBER_OUTER + NUMBER_INNER) / 2, cy + Math.sin(mid) * (NUMBER_OUTER + NUMBER_INNER) / 2);
    ctx.rotate(mid + Math.PI / 2);
    ctx.fillStyle = n === 0 ? "#102d50" : "#fbf2e2";
    ctx.textAlign = "center";
    ctx.font = "800 10px system-ui";
    ctx.fillText(String(n), 0, 3.6);
    ctx.restore();
    // Square pocket: a recessed floor (darker, shaded towards the rim) framed by frets.
    const floor = ctx.createRadialGradient(cx, cy, POCKET_INNER, cx, cy, POCKET_OUTER);
    floor.addColorStop(0, pocketFloor(n));
    floor.addColorStop(0.55, pocketColor(n));
    floor.addColorStop(1, pocketFloor(n));
    ctx.fillStyle = floor;
    ctx.beginPath();
    ctx.arc(cx, cy, POCKET_OUTER, a + 0.012, b - 0.012);
    ctx.arc(cx, cy, POCKET_INNER, b - 0.012, a + 0.012, true);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,.35)";
    ctx.lineWidth = 1;
    ctx.stroke();
    // Raised metal fret between pockets (a solid wall in the core): cast shadow, body and a bright top edge.
    // V11 frets are low (2.5 px): a thin bar with a short shadow.
    const sh = 0.012;
    ctx.strokeStyle = "rgba(0,0,0,.32)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a + sh) * POCKET_INNER, cy + Math.sin(a + sh) * POCKET_INNER);
    ctx.lineTo(cx + Math.cos(a + sh) * POCKET_OUTER, cy + Math.sin(a + sh) * POCKET_OUTER);
    ctx.stroke();
    ctx.strokeStyle = "#b8975a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * (POCKET_INNER - 1), cy + Math.sin(a) * (POCKET_INNER - 1));
    ctx.lineTo(cx + Math.cos(a) * (POCKET_OUTER + 1), cy + Math.sin(a) * (POCKET_OUTER + 1));
    ctx.stroke();
    ctx.strokeStyle = "#fff1c8";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * POCKET_INNER, cy + Math.sin(a) * POCKET_INNER);
    ctx.lineTo(cx + Math.cos(a) * POCKET_OUTER, cy + Math.sin(a) * POCKET_OUTER);
    ctx.stroke();
    ctx.strokeStyle = "rgba(245,232,200,.55)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * NUMBER_INNER, cy + Math.sin(a) * NUMBER_INNER);
    ctx.lineTo(cx + Math.cos(a) * NUMBER_OUTER, cy + Math.sin(a) * NUMBER_OUTER);
    ctx.stroke();
  }
  // Gold rings separating ball track, numbers and pockets.
  ctx.strokeStyle = "#dcc28a";
  for (const [r, w] of [[NUMBER_OUTER, 2], [NUMBER_INNER, 1.6], [POCKET_INNER, 2]] as const) {
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Top-down cone: a raised illuminated boss slopes down to the pockets.
  const cone = ctx.createRadialGradient(cx - 20, cy - 26, 8, cx, cy, POCKET_INNER);
  cone.addColorStop(0, "#c9bd91");
  cone.addColorStop(0.18, "#668281");
  cone.addColorStop(0.65, "#244c57");
  cone.addColorStop(1, "#0a202f");
  ctx.fillStyle = cone;
  ctx.beginPath();
  ctx.arc(cx, cy, POCKET_INNER - 1, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 12; i++) {
    const a = rotation + i * Math.PI / 6;
    ctx.strokeStyle = i < 6 ? "rgba(231,217,174,.16)" : "rgba(0,8,18,.24)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 12, cy + Math.sin(a) * 12);
    ctx.lineTo(cx + Math.cos(a) * (POCKET_INNER - 3), cy + Math.sin(a) * (POCKET_INNER - 3));
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(0,5,14,.35)";
  ctx.beginPath();
  ctx.ellipse(cx + 5, cy + 7, 19, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e5cd96";
  ctx.beginPath();
  ctx.arc(cx, cy, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#b99b71";
  ctx.lineWidth = 2;
  for (const r of [125, 143]) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Solid outer wall the ball bounces off (core V4 wallRadius 148).
  ctx.strokeStyle = "#e9d9b0";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, 149, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    ctx.save();
    ctx.translate(cx + Math.cos(a) * 130, cy + Math.sin(a) * 130);
    ctx.rotate(a);
    ctx.fillStyle = "#c7ac7a";
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(5, 0);
    ctx.lineTo(0, 5);
    ctx.lineTo(-5, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  const idle = s.landingTick === -1;
  const settled = idle && s.lastNumber !== null && !s.lastMiss;
  const pocketAngle = rotation + ROULETTE_WHEEL.findIndex(n => n === s.lastNumber) * Math.PI * 2 / 37;
  // The ball waits on the launcher outside the wheel; a swipe only aims it.
  // The last moment is slow and soft: the ball drifts into its pocket with a damped wobble.
  const settleT = settled ? Math.min(1, Math.max(0, (s.tick - s.lastLandingTick) / 150)) : 1;
  const ease = 1 - (1 - settleT) ** 3;
  const wobble = settled ? Math.sin(settleT * Math.PI * 3) * (1 - settleT) * 3.5 : 0;
  const pocketX = cx + Math.cos(pocketAngle) * (POCKET_REST + wobble), pocketY = cy + Math.sin(pocketAngle) * (POCKET_REST + wobble);
  const x = settled ? s.ballX / 1000 + (pocketX - s.ballX / 1000) * ease
    : idle ? ROULETTE_BALL_DOCK.x : s.ballX / 1000;
  const y = settled ? s.ballY / 1000 + (pocketY - s.ballY / 1000) * ease
    : idle ? ROULETTE_BALL_DOCK.y : s.ballY / 1000;
  if (settled && settleT >= 1) {
    const half = Math.PI / 37;
    ctx.save();
    ctx.strokeStyle = "#ffe9a4";
    ctx.shadowColor = "#ffd36a";
    ctx.shadowBlur = 12;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, NUMBER_OUTER, pocketAngle - half, pocketAngle + half);
    ctx.arc(cx, cy, POCKET_INNER, pocketAngle + half, pocketAngle - half, true);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
  // Height changes size and shadow separation in a zenithal view; it never
  // shifts the authoritative horizontal trajectory towards the screen top.
  const radius = Math.hypot(x - cx, y - cy);
  const surface = s.inBowl && radius <= 151 ? rouletteSurfaceV11(radius * 1000).z / 1000 : 0;
  const height = idle ? 0 : Math.max(0, s.ballZ / 1000 - surface - BALL_R);
  // Launcher: an orbital "magnetic cradle" outside the wheel — a hexagonal pad, three clamp prongs and counter-rotating
  // coil rings that hold the ball in the air; dragging charges the coils (faster, warmer, sparks between the prongs).
  if (idle || s.tick - s.flightStart < 40) {
    const dock = ROULETTE_BALL_DOCK, t = s.tick;
    let charge = 0;
    if (idle && drag) charge = Math.max(0, Math.min(1, (Math.hypot(drag.x - dock.x, drag.y - dock.y) - 24) / 180));
    ctx.save();
    ctx.translate(dock.x, dock.y);
    // Hex pad with a glowing rim.
    ctx.beginPath();
    for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + (i * Math.PI) / 3; i ? ctx.lineTo(Math.cos(a) * 36, Math.sin(a) * 36) : ctx.moveTo(Math.cos(a) * 36, Math.sin(a) * 36); }
    ctx.closePath();
    const pad = ctx.createRadialGradient(-8, -10, 4, 0, 0, 40);
    pad.addColorStop(0, "#2a4a63"); pad.addColorStop(1, "#0a1826");
    ctx.fillStyle = pad; ctx.fill();
    ctx.strokeStyle = `rgba(${charge > 0 ? "255,214,120" : "127,227,238"},${0.55 + 0.35 * charge})`; ctx.lineWidth = 2; ctx.stroke();
    // Floor glow under the floating ball.
    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 26);
    glow.addColorStop(0, `rgba(${charge > 0 ? "255,220,140" : "140,235,255"},${0.35 + 0.4 * charge})`); glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.fill();
    // Counter-rotating coil rings.
    const spin = 0.03 + 0.2 * charge;
    for (const [r, dir, col] of [[17, 1, "127,227,238"], [23, -1, "199,155,255"], [29, 1, "255,210,122"]] as const) {
      ctx.save(); ctx.rotate(dir * t * spin);
      ctx.strokeStyle = `rgba(${col},${0.5 + 0.4 * charge})`; ctx.lineWidth = 1.6;
      ctx.setLineDash([r * 0.9, r * 0.5]);
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    ctx.setLineDash([]);
    // Three clamp prongs pointing at the ball, with sparks while charging.
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / 3 + t * 0.004;
      ctx.strokeStyle = "#c9d6e3"; ctx.lineWidth = 3; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * 33, Math.sin(a) * 33); ctx.lineTo(Math.cos(a) * 12, Math.sin(a) * 12); ctx.stroke();
      ctx.fillStyle = charge > 0 ? "#ffd27a" : "#7fe3ee";
      ctx.beginPath(); ctx.arc(Math.cos(a) * 12, Math.sin(a) * 12, 2, 0, Math.PI * 2); ctx.fill();
      if (charge > 0.05 && (t + i * 3) % 6 < 3) {
        const b = a + (Math.PI * 2) / 3;
        ctx.strokeStyle = `rgba(255,240,190,${0.4 + 0.6 * charge})`; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * 12, Math.sin(a) * 12);
        ctx.lineTo(Math.cos((a + b) / 2) * 6 + (i - 1) * 2, Math.sin((a + b) / 2) * 6); ctx.lineTo(Math.cos(b) * 12, Math.sin(b) * 12); ctx.stroke();
      }
    }
    ctx.restore();
  }
  if (idle && drag) {
    // Aim guide: direction and length of the throw (quantised like the real action).
    const dx = drag.x - ROULETTE_BALL_DOCK.x,
      dy = drag.y - ROULETTE_BALL_DOCK.y,
      length = Math.hypot(dx, dy);
    if (length >= 28) {
      const power = Math.max(0, Math.min(15, Math.round((length - 24) / 12)));
      const ux = dx / length,
        uy = dy / length,
        reach = 40 + power * 9;
      ctx.save();
      ctx.strokeStyle = "rgba(255,233,164,.85)";
      ctx.fillStyle = "rgba(255,233,164,.85)";
      ctx.lineWidth = 3;
      ctx.setLineDash([7, 6]);
      ctx.beginPath();
      ctx.moveTo(ROULETTE_BALL_DOCK.x + ux * 14, ROULETTE_BALL_DOCK.y + uy * 14);
      ctx.lineTo(ROULETTE_BALL_DOCK.x + ux * reach, ROULETTE_BALL_DOCK.y + uy * reach);
      ctx.stroke();
      ctx.setLineDash([]);
      const tx = ROULETTE_BALL_DOCK.x + ux * (reach + 8),
        ty = ROULETTE_BALL_DOCK.y + uy * (reach + 8);
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx - ux * 12 - uy * 7, ty - uy * 12 + ux * 7);
      ctx.lineTo(tx - ux * 12 + uy * 7, ty - uy * 12 - ux * 7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
  const drawBall = (bx: number, by: number, bh: number) => {
    ctx.fillStyle = "rgba(0,4,14,.45)";
    ctx.beginPath();
    ctx.ellipse(bx + 2 + bh * 0.20, by + 3 + bh * 0.26, BALL_R + bh * 0.07, BALL_R * 0.66 + bh * 0.04, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f0f7ff";
    ctx.beginPath();
    ctx.arc(bx, by, BALL_R + Math.min(bh, 130) * 0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(bx - 2, by - 2, 2, 0, Math.PI * 2);
    ctx.fill();
  };
  // The previous ball never vanishes: it stays in its pocket while the next one waits on the launcher.
  if (idle && settled) {
    drawBall(x, y, 0);
    drawBall(ROULETTE_BALL_DOCK.x, ROULETTE_BALL_DOCK.y, 0);
  } else drawBall(x, y, height);
  ctx.strokeStyle = "#c7ac7a";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(cx - 24 * Math.cos(rotation), cy - 24 * Math.sin(rotation));
  ctx.lineTo(cx + 24 * Math.cos(rotation), cy + 24 * Math.sin(rotation));
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(
    cx - 24 * Math.cos(rotation + Math.PI / 2),
    cy - 24 * Math.sin(rotation + Math.PI / 2),
  );
  ctx.lineTo(
    cx + 24 * Math.cos(rotation + Math.PI / 2),
    cy + 24 * Math.sin(rotation + Math.PI / 2),
  );
  ctx.stroke();
  ctx.fillStyle = "#edf1e4";
  ctx.font = "900 28px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(s.lastNumber === null ? "" : String(s.lastNumber), cx, 270);
    const onCloth = s.landingTick !== -1 ? s.lockedChips : s.chips;
  const onClothValues = s.landingTick !== -1 ? s.lockedValues : s.chipValues;
  const stake = onClothValues.reduce((a, b) => a + b, 0);
  ctx.fillStyle = "#a8c6d5";
  ctx.font = "bold 14px system-ui";
  ctx.fillText(
    onCloth.length ? (stake === 1 ? t("roulette.onTableOne") : t("roulette.onTable", { n: stake })) : t("roulette.noChips"),
    cx,
    377,
  );
  ctx.restore();
  // History of the last results above the wheel (screen space, clear of the rim), newest on the right.
  const shown = s.history.slice(-ROULETTE_RULES_V11.historyLength);
  const slot = 24, left = cx - (ROULETTE_RULES_V11.historyLength * slot) / 2;
  for (let i = 0; i < ROULETTE_RULES_V11.historyLength; i++) {
    const n = shown[i - (ROULETTE_RULES_V11.historyLength - shown.length)];
    const hx = left + i * slot + slot / 2;
    if (n === undefined) {
      ctx.strokeStyle = "rgba(168,198,213,.28)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(hx, 22, 9, 0, Math.PI * 2);
      ctx.stroke();
      continue;
    }
    const latest = i === ROULETTE_RULES_V11.historyLength - 1;
    ctx.fillStyle = n === 0 ? "#f1f5ee" : ROULETTE_RED.includes(n as (typeof ROULETTE_RED)[number]) ? "#17956f" : "#2160b0";
    ctx.beginPath();
    ctx.arc(hx, 22, latest ? 11 : 9, 0, Math.PI * 2);
    ctx.fill();
    if (latest) {
      ctx.strokeStyle = "#ffe9a4";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.fillStyle = n === 0 ? "#102d50" : "#f9edda";
    ctx.font = "bold 10px system-ui";
    ctx.fillText(String(n), hx, 25.5);
  }
  if (s.lastPayout > 0 && s.tick - s.lastLandingTick < 120) {
    ctx.fillStyle = "#ffe9a4";
    ctx.font = "bold 19px system-ui";
    ctx.fillText(t("roulette.won", { n: formatNumber(s.lastPayout / 100) }), cx, cy + WHEEL_DY + (103 - cy) * WHEEL_SCALE);
  }
}
const hudLabel = (s: Readonly<RouletteStateV2>) =>
  t("roulette.hud", { chips: formatNumber(s.balanceMinor / 100), spins: s.spins });
const feedbackScore = (s: Readonly<RouletteStateV2>) => s.balanceMinor;
const betLabels: Record<string, string> = {
  get RED() { return t("roulette.green"); },
  get BLACK() { return t("roulette.blue"); },
  get EVEN() { return t("roulette.even"); },
  get ODD() { return t("roulette.odd"); },
  LOW: "1–18",
  HIGH: "19–36",
  DOZEN_1: "1–12",
  DOZEN_2: "13–24",
  DOZEN_3: "25–36",
};
// Casino cloth shown permanently under the wheel: zero spans the three number
// rows, then dozens and outside bets. Every tap stacks one chip on that cell.
const choiceControl = {
  get label() { return t("roulette.cloth"); },
  presentation: "table" as const,
  columns: 13,
  options: [
    ...ROULETTE_BETS.map((bet) => {
      if (bet.startsWith("NUMBER_")) {
        const n = Number(bet.slice(7));
        return {
          action: `BET_${bet}`,
          label: String(n),
          tone:
            n === 0
              ? "#e9eeed"
              : ROULETTE_RED.includes(n as (typeof ROULETTE_RED)[number])
                ? "#1f8a6b"
                : "#1f4f8f",
          placement:
            n === 0
              ? { row: 1, column: 1, rowSpan: 3 }
              : { row: 3 - ((n - 1) % 3), column: 2 + Math.floor((n - 1) / 3) },
        };
      }
      if (bet.startsWith("DOZEN_")) {
        const n = Number(bet.slice(6));
        return {
          action: `BET_${bet}`,
          get label() { return betLabels[bet]; },
          tone: "#173e42",
          placement: { row: 4, column: 2 + (n - 1) * 4, columnSpan: 4 },
        };
      }
      const i = ["LOW", "EVEN", "RED", "BLACK", "ODD", "HIGH"].indexOf(bet);
      return {
        action: `BET_${bet}`,
        get label() { return betLabels[bet]; },
        tone: bet === "RED" ? "#1f8a6b" : bet === "BLACK" ? "#1f4f8f" : "#173e42",
        placement: { row: 5, column: 2 + i * 2, columnSpan: 2 },
      };
    }),
    ...ROULETTE_DENOMINATIONS.map((d, i) => ({
      action: `CHIP_${d}`,
      label: `${d}`,
      placement: { row: 6, column: 1 + i * 2, columnSpan: 2 },
    })),
    { action: "BETS_UNDO", get label() { return t("roulette.undo"); }, tone: "#3b3f2f", placement: { row: 6, column: 7, columnSpan: 3 } },
    { action: "BETS_CLEAR", get label() { return t("roulette.clear"); }, tone: "#4a2f35", placement: { row: 6, column: 10, columnSpan: 4 } },
    { action: "CASH_OUT", get label() { return t("roulette.cashOut"); }, tone: "#5a3a1e", placement: { row: 7, column: 1, columnSpan: 13 } },
  ],
  value: (s: RouletteStateV2) => (s.chips.length ? `BET_${s.chips[s.chips.length - 1]}` : ""),
  badges: (s: RouletteStateV2) => {
    const counts: Record<string, number> = {};
    // Chips stay visible while the ball is in play and leave the cloth when the spin ends.
    const shown = s.landingTick !== -1 ? s.lockedChips : s.chips, values = s.landingTick !== -1 ? s.lockedValues : s.chipValues;
    shown.forEach((bet, i) => { counts[`BET_${bet}`] = (counts[`BET_${bet}`] ?? 0) + values[i]; });
    // Dominant denomination per cell drives the badge colour (highest value placed there).
    shown.forEach((bet, i) => { counts[`~BET_${bet}`] = Math.max(counts[`~BET_${bet}`] ?? 0, values[i]); });
    counts[`CHIP_${s.denomination}`] = 1;
    return counts;
  },
  disabled: (s: RouletteStateV2) =>
    s.landingTick !== -1 ||
    s.status !== "running" ||
    false,
};
export default function GalacticRoulette(props: GameRuntimeProps) {
  useI18n();
  const origin = useRef<CorePoint | null>(null),
    drag = useRef<CorePoint | null>(null);
  const canvasRender = useCallback(
    (ctx: CanvasRenderingContext2D, s: RouletteStateV2) => {
      if (s.landingTick !== -1) drag.current = null;
      render(ctx, s, drag.current);
    },
    [],
  );
  useEffect(() => {
    const clear = () => {
      origin.current = null;
      drag.current = null;
    };
    window.addEventListener("blur", clear);
    window.addEventListener("resize", clear);
    return () => {
      window.removeEventListener("blur", clear);
      window.removeEventListener("resize", clear);
      clear();
    };
  }, []);
  return (
    <div
      className="rouletteVerified rouletteMobile"
      onPointerCancel={() => {
        origin.current = null;
        drag.current = null;
      }}
      onLostPointerCapture={() => {
        if (origin.current) {
          origin.current = null;
          drag.current = null;
        }
      }}
    >
      <CoreCanvasGame
        {...props}
        core={ROULETTE_CORE_V11}
        name="Galactic Roulette"
        instruction=""
        render={canvasRender}
        hideHudScore
        hudLabel={hudLabel}
        feedbackScore={feedbackScore}
        choiceControl={choiceControl}
        pointAction={(screen, phase, s) => {
          const p = toWheel(screen);
          if (phase === "down") {
            origin.current =
              ROULETTE_CORE_V11.canApply(s, "TOSS_D00_P00") &&
              rouletteLauncherCanGrab(p)
                ? p
                : null;
            drag.current = origin.current ? p : null;
            return null;
          }
          if (!origin.current) return null;
          if (phase === "move") {
            drag.current = p;
            return null;
          }
          const from = origin.current;
          origin.current = null;
          drag.current = null;
          return rouletteLauncherToss(from, p);
        }}
      />
    </div>
  );
}
