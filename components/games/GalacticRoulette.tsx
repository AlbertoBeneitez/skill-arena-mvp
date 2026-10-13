"use client";
import { useRef, useCallback, useEffect } from "react";
import type { GameRuntimeProps } from "@/lib/games";
import {
  ROULETTE_CORE_V2,
  ROULETTE_WHEEL,
  ROULETTE_RED,
  type RouletteStateV2,
} from "@/lib/verified/galacticRouletteCore.v2";
import { ROULETTE_BETS_V2 } from "@/lib/verified/galacticRouletteProtocol.v2";
import {
  ROULETTE_BALL_DOCK,
  rouletteTossCanGrab,
  rouletteHandToss,
} from "@/lib/rouletteTossGesture";
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
          ? "#158568"
          : "#102d50";
    ctx.beginPath();
    ctx.arc(cx, cy, 119, a, b);
    ctx.arc(cx, cy, 91, b, a, true);
    ctx.closePath();
    ctx.fill();
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
  const x = settled ? cx + Math.cos(pocketAngle) * 104
    : idle ? (drag?.x ?? ROULETTE_BALL_DOCK.x) : s.ballX / 1000;
  const y = settled ? cy + Math.sin(pocketAngle) * 104
    : idle ? (drag?.y ?? ROULETTE_BALL_DOCK.y) : s.ballY / 1000;
  // Height changes size and shadow separation in a zenithal view; it never
  // shifts the authoritative horizontal trajectory towards the screen top.
  const height = idle ? 0 : Math.max(0, s.ballZ / 1000 - 6);
  if (idle && !drag) {
    ctx.strokeStyle = "rgba(169,219,238,.6)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ROULETTE_BALL_DOCK.x, ROULETTE_BALL_DOCK.y, 28, 0, Math.PI * 2);
    ctx.stroke();
    if (settled) {
      ctx.fillStyle = "rgba(240,247,255,.28)";
      ctx.beginPath();
      ctx.arc(ROULETTE_BALL_DOCK.x, ROULETTE_BALL_DOCK.y, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = "rgba(0,4,14,.45)";
  ctx.beginPath();
  ctx.ellipse(x + 2 + height * 0.12, y + 3 + height * 0.15,
    6 + height * 0.07, 4 + height * 0.04, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f0f7ff";
  ctx.beginPath();
  ctx.arc(x, y, 6 + height * 0.04, 0, Math.PI * 2);
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
  ctx.fillStyle = "#a8c6d5";
  ctx.font = "bold 14px system-ui";
  const bet = s.bet.startsWith("NUMBER_")
    ? s.bet.slice(7)
    : (
        {
          RED: "VERDE",
          BLACK: "AZUL",
          EVEN: "PAR",
          ODD: "IMPAR",
          LOW: "1–18",
          HIGH: "19–36",
          DOZEN_1: "1–12",
          DOZEN_2: "13–24",
          DOZEN_3: "25–36",
        } as Record<string, string>
      )[s.bet];
  ctx.fillText(`${bet ?? "2:1"} · 5€`, cx, 377);
  if (s.lastPayout > 0 && s.tick - s.lastLandingTick < 120) {
    ctx.fillStyle = "#ffe9a4";
    ctx.font = "bold 19px system-ui";
    ctx.fillText(`+${s.lastPayout / 100}€`, cx, 103);
  }
}
const hudLabel = (s: Readonly<RouletteStateV2>) =>
  `${(s.balanceMinor / 100).toFixed(2)} € FICTICIOS · ${(Math.max(0, 21600 - s.tick) / 120).toFixed(1)}s`;
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
const choiceControl = {
  label: "Tapete de apuestas",
  presentation: "grid" as const,
  columns: 5,
  options: ROULETTE_BETS_V2.map((bet) => {
    if (bet.startsWith("NUMBER_")) {
      const n = Number(bet.slice(7));
      return {
        action: `BET_${bet}`,
        label: String(n),
        tone:
          n === 0
            ? "#e9eeed"
            : ROULETTE_RED.includes(n as (typeof ROULETTE_RED)[number])
              ? "#176f5a"
              : "#102d50",
        placement:
          n === 0
            ? { row: 1, column: 1, columnSpan: 3 }
            : { row: 2 + Math.floor((n - 1) / 3), column: 1 + ((n - 1) % 3) },
      };
    }
    if (bet.startsWith("DOZEN_")) {
      const n = Number(bet.slice(6));
      return {
        action: `BET_${bet}`,
        label: betLabels[bet],
        tone: "#173e42",
        placement: { row: 2 + (n - 1) * 4, column: 4, rowSpan: 4 },
      };
    }
    if (bet.startsWith("COLUMN_"))
      return {
        action: `BET_${bet}`,
        label: `C${Number(bet.slice(7))} 2:1`,
        tone: "#173e42",
        placement: { row: 14, column: Number(bet.slice(7)) },
      };
    const i = ["LOW", "EVEN", "RED", "BLACK", "ODD", "HIGH"].indexOf(bet);
    return {
      action: `BET_${bet}`,
      label: betLabels[bet],
      tone: bet === "RED" ? "#176f5a" : bet === "BLACK" ? "#102d50" : "#173e42",
      placement: {
        row: 2 + i * 2,
        column: 5,
        rowSpan: 2,
      },
    };
  }),
  value: (s: RouletteStateV2) => `BET_${s.bet}`,
  disabled: (s: RouletteStateV2) =>
    s.landingTick !== -1 || s.status !== "running" || s.tick + 720 > 21600,
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
        core={ROULETTE_CORE_V2}
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
              ROULETTE_CORE_V2.canApply(s, "TOSS_D00_P00") &&
              rouletteTossCanGrab(p)
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
          const actions = rouletteHandToss(from, p);
          drag.current = actions ? p : null;
          return actions;
        }}
      />
    </div>
  );
}
