"use client";
import { useRef, useCallback, useEffect } from "react";
import type { GameRuntimeProps } from "@/lib/games";
import {
  ROULETTE_CORE_V7,
  ROULETTE_RULES_V7,
  ROULETTE_WHEEL,
  ROULETTE_RED,
  type RouletteStateV7 as RouletteStateV2,
} from "@/lib/verified/galacticRouletteCore.v7";
import { ROULETTE_BETS } from "@/lib/verified/galacticRouletteProtocol.v3";
import { ROULETTE_DENOMINATIONS } from "@/lib/verified/galacticRouletteProtocol.v7";
import {
  ROULETTE_BALL_DOCK,
  rouletteLauncherCanGrab,
  rouletteLauncherToss,
} from "@/lib/rouletteLaunchGesture";
import { drawSpaceBackdrop } from "@/lib/spaceBackdrop";
import CoreCanvasGame, { type CorePoint } from "./CoreCanvasGame";
const cx = 195,
  cy = 195;
function render(
  ctx: CanvasRenderingContext2D,
  s: RouletteStateV2,
  drag: CorePoint | null = null,
) {
  drawSpaceBackdrop(ctx, 390, 400, 1, s.tick);
  const rotation = (s.wheelPhase / 65536) * Math.PI * 2 - Math.PI / 2;
  ctx.fillStyle = "#193545";
  ctx.strokeStyle = "#dbb783";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(cx, cy, 155, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  for (let i = 0; i < 37; i++) {
    const a = rotation + ((i - 0.5) * Math.PI * 2) / 37,
      b = rotation + ((i + 0.5) * Math.PI * 2) / 37,
      n = ROULETTE_WHEEL[i];
    ctx.fillStyle =
      n === 0
        ? "#f1f5ee"
        : ROULETTE_RED.includes(n as (typeof ROULETTE_RED)[number])
          ? "#17956f"
          : "#2160b0";
    ctx.beginPath();
    ctx.arc(cx, cy, 119, a, b);
    ctx.arc(cx, cy, 91, b, a, true);
    ctx.closePath();
    ctx.fill();
    // Equal, clearly bounded pockets: green and blue read as the same width.
    ctx.strokeStyle = "rgba(245,232,200,.55)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.save();
    ctx.translate(
      cx + Math.cos((a + b) / 2) * 108,
      cy + Math.sin((a + b) / 2) * 108,
    );
    ctx.rotate((a + b) / 2 + Math.PI / 2);
    ctx.fillStyle = n === 0 ? "#102d50" : "#f9edda";
    ctx.textAlign = "center";
    ctx.font = "bold 11px system-ui";
    ctx.fillText(String(n), 0, 4);
    ctx.restore();
    ctx.strokeStyle = "rgba(232,195,135,.6)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 91, cy + Math.sin(a) * 91);
    ctx.lineTo(cx + Math.cos(a) * 120, cy + Math.sin(a) * 120);
    ctx.stroke();
  }
  // Top-down cone: a raised illuminated boss slopes down to the pockets.
  const cone = ctx.createRadialGradient(cx - 20, cy - 26, 8, cx, cy, 90);
  cone.addColorStop(0, "#c9bd91");
  cone.addColorStop(0.18, "#668281");
  cone.addColorStop(0.65, "#244c57");
  cone.addColorStop(1, "#0a202f");
  ctx.fillStyle = cone;
  ctx.beginPath();
  ctx.arc(cx, cy, 90, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 12; i++) {
    const a = rotation + i * Math.PI / 6;
    ctx.strokeStyle = i < 6 ? "rgba(231,217,174,.16)" : "rgba(0,8,18,.24)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 12, cy + Math.sin(a) * 12);
    ctx.lineTo(cx + Math.cos(a) * 87, cy + Math.sin(a) * 87);
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
  const settled = idle && !drag && s.lastNumber !== null && !s.lastMiss;
  const pocketAngle = rotation + ROULETTE_WHEEL.findIndex(n => n === s.lastNumber) * Math.PI * 2 / 37;
  // The ball waits on the launcher outside the wheel; a swipe only aims it.
  // The last moment is slow and soft: the ball drifts into its pocket with a damped wobble.
  const settleT = settled ? Math.min(1, Math.max(0, (s.tick - s.lastLandingTick) / 150)) : 1;
  const ease = 1 - (1 - settleT) ** 3;
  const wobble = settled ? Math.sin(settleT * Math.PI * 3) * (1 - settleT) * 3.5 : 0;
  const pocketX = cx + Math.cos(pocketAngle) * (104 + wobble), pocketY = cy + Math.sin(pocketAngle) * (104 + wobble);
  const x = settled ? s.ballX / 1000 + (pocketX - s.ballX / 1000) * ease
    : idle ? ROULETTE_BALL_DOCK.x : s.ballX / 1000;
  const y = settled ? s.ballY / 1000 + (pocketY - s.ballY / 1000) * ease
    : idle ? ROULETTE_BALL_DOCK.y : s.ballY / 1000;
  // Height changes size and shadow separation in a zenithal view; it never
  // shifts the authoritative horizontal trajectory towards the screen top.
  const radius = Math.hypot(x - cx, y - cy);
  const surface = s.inBowl && radius <= 151 ? radius < 90 ? (90 - radius) * 0.35 : Math.max(0, (radius - 115) * 0.35) : 0;
  const height = idle ? 0 : Math.max(0, s.ballZ / 1000 - surface - 6);
  // Launcher plate outside the wheel (the ball can only be thrown from here).
  if (idle || s.tick - s.flightStart < 40) {
    ctx.fillStyle = "rgba(14,38,52,.92)";
    ctx.strokeStyle = "rgba(169,219,238,.65)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(ROULETTE_BALL_DOCK.x - 34, ROULETTE_BALL_DOCK.y - 34, 68, 68, 16);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "rgba(169,219,238,.4)";
    ctx.beginPath();
    ctx.arc(ROULETTE_BALL_DOCK.x, ROULETTE_BALL_DOCK.y, 22, 0, Math.PI * 2);
    ctx.stroke();
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
  ctx.fillStyle = "rgba(0,4,14,.45)";
  ctx.beginPath();
  ctx.ellipse(x + 2 + height * 0.20, y + 3 + height * 0.26,
    6 + height * 0.07, 4 + height * 0.04, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f0f7ff";
  ctx.beginPath();
  ctx.arc(x, y, 6 + Math.min(height, 130) * 0.07, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(x - 2, y - 2, 2, 0, Math.PI * 2);
  ctx.fill();
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
  const stake = s.chipValues.reduce((a, b) => a + b, 0);
  const expiresIn = s.chips.length
    ? Math.max(0, Math.ceil((ROULETTE_RULES_V7.chipExpiryTicks - (s.tick - s.chipTicks[0])) / 120))
    : 0;
  ctx.fillStyle = expiresIn > 0 && expiresIn <= 3 ? "#ffb4a0" : "#a8c6d5";
  ctx.font = "bold 14px system-ui";
  ctx.fillText(
    stake ? `${stake} ${stake === 1 ? "FICHA" : "FICHAS"} EN LA MESA · ${expiresIn}s` : "SIN FICHAS EN LA MESA",
    cx,
    377,
  );
  // History of the last results, newest on the right; each dot has the pocket colour.
  const shown = s.history.slice(-ROULETTE_RULES_V7.historyLength);
  const slot = 24, left = cx - (ROULETTE_RULES_V7.historyLength * slot) / 2;
  for (let i = 0; i < ROULETTE_RULES_V7.historyLength; i++) {
    const n = shown[i - (ROULETTE_RULES_V7.historyLength - shown.length)];
    const hx = left + i * slot + slot / 2;
    if (n === undefined) {
      ctx.strokeStyle = "rgba(168,198,213,.28)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(hx, 31, 9, 0, Math.PI * 2);
      ctx.stroke();
      continue;
    }
    const latest = i === ROULETTE_RULES_V7.historyLength - 1;
    ctx.fillStyle = n === 0 ? "#f1f5ee" : ROULETTE_RED.includes(n as (typeof ROULETTE_RED)[number]) ? "#17956f" : "#2160b0";
    ctx.beginPath();
    ctx.arc(hx, 31, latest ? 11 : 9, 0, Math.PI * 2);
    ctx.fill();
    if (latest) {
      ctx.strokeStyle = "#ffe9a4";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.fillStyle = n === 0 ? "#102d50" : "#f9edda";
    ctx.font = "bold 10px system-ui";
    ctx.fillText(String(n), hx, 34.5);
  }
  if (s.lastPayout > 0 && s.tick - s.lastLandingTick < 120) {
    ctx.fillStyle = "#ffe9a4";
    ctx.font = "bold 19px system-ui";
    ctx.fillText(`+${s.lastPayout / 100} fichas`, cx, 103);
  }
}
const hudLabel = (s: Readonly<RouletteStateV2>) =>
  `${s.balanceMinor / 100} FICHAS · ${s.spins} TIRADAS`;
const feedbackScore = (s: Readonly<RouletteStateV2>) => s.balanceMinor;
const betLabels: Record<string, string> = {
  RED: "VERDE",
  BLACK: "AZUL",
  EVEN: "PAR",
  ODD: "IMPAR",
  LOW: "1–18",
  HIGH: "19–36",
  DOZEN_1: "1–12",
  DOZEN_2: "13–24",
  DOZEN_3: "25–36",
};
// Casino cloth shown permanently under the wheel: zero spans the three number
// rows, then dozens and outside bets. Every tap stacks one chip on that cell.
const choiceControl = {
  label: "Tapete de apuestas",
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
          label: betLabels[bet],
          tone: "#173e42",
          placement: { row: 4, column: 2 + (n - 1) * 4, columnSpan: 4 },
        };
      }
      const i = ["LOW", "EVEN", "RED", "BLACK", "ODD", "HIGH"].indexOf(bet);
      return {
        action: `BET_${bet}`,
        label: betLabels[bet],
        tone: bet === "RED" ? "#1f8a6b" : bet === "BLACK" ? "#1f4f8f" : "#173e42",
        placement: { row: 5, column: 2 + i * 2, columnSpan: 2 },
      };
    }),
    ...ROULETTE_DENOMINATIONS.map((d, i) => ({
      action: `CHIP_${d}`,
      label: `${d}`,
      tone: d === 1 ? "#5b6b78" : d === 5 ? "#8a3a45" : "#3a3f8a",
      placement: { row: 6, column: 1 + i * 2, columnSpan: 2 },
    })),
    { action: "BETS_UNDO", label: "↶ QUITAR", tone: "#3b3f2f", placement: { row: 6, column: 7, columnSpan: 3 } },
    { action: "BETS_CLEAR", label: "LIMPIAR", tone: "#4a2f35", placement: { row: 6, column: 10, columnSpan: 4 } },
    { action: "CASH_OUT", label: "TERMINAR PARTIDA", tone: "#5a3a1e", placement: { row: 7, column: 1, columnSpan: 13 } },
  ],
  value: (s: RouletteStateV2) => (s.chips.length ? `BET_${s.chips[s.chips.length - 1]}` : ""),
  badges: (s: RouletteStateV2) => {
    const counts: Record<string, number> = {};
    s.chips.forEach((bet, i) => { counts[`BET_${bet}`] = (counts[`BET_${bet}`] ?? 0) + s.chipValues[i]; });
    counts[`CHIP_${s.denomination}`] = 1;
    return counts;
  },
  disabled: (s: RouletteStateV2) =>
    s.landingTick !== -1 ||
    s.status !== "running" ||
    false,
};
export default function GalacticRoulette(props: GameRuntimeProps) {
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
        core={ROULETTE_CORE_V7}
        name="Galactic Roulette"
        instruction=""
        render={canvasRender}
        hideHudScore
        hudLabel={hudLabel}
        feedbackScore={feedbackScore}
        choiceControl={choiceControl}
        pointAction={(p, phase, s) => {
          if (phase === "down") {
            origin.current =
              ROULETTE_CORE_V7.canApply(s, "TOSS_D00_P00") &&
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
