"use client";
import { useRef, useCallback, useEffect } from "react";
import type { GameRuntimeProps } from "@/lib/games";
import {
  ROULETTE_CORE,
  ROULETTE_WHEEL,
  ROULETTE_RED,
  type RouletteState,
} from "@/lib/verified/galacticRouletteCore.v1";
import { ROULETTE_BETS } from "@/lib/verified/galacticRouletteProtocol.v1";
import {
  ROULETTE_BALL_DOCK,
  rouletteBallCanGrab,
  rouletteDragLaunch,
} from "@/lib/rouletteGesture";
import { drawSpaceBackdrop } from "@/lib/spaceBackdrop";
import CoreCanvasGame, { type CorePoint } from "./CoreCanvasGame";
const cx = 195,
  cy = 195;
function render(
  ctx: CanvasRenderingContext2D,
  s: RouletteState,
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
  ctx.fillStyle = "#0c2635";
  ctx.beginPath();
  ctx.arc(cx, cy, 88, 0, Math.PI * 2);
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
  let radius = 143;
  if (s.landingTick !== -1) {
    const remaining = s.landingTick - s.tick;
    radius = 143 - 45 * Math.max(0, 1 - remaining / 180);
  } else if (s.lastNumber !== null) radius = 98;
  const angle = (s.ballPhase / 65536) * Math.PI * 2 - Math.PI / 2;
  if (s.landingTick !== -1) {
    ctx.strokeStyle = "rgba(234,245,255,.25)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(
      cx,
      cy,
      radius,
      angle - 0.12 * Math.sign(s.ballSpeed),
      angle,
      s.ballSpeed < 0,
    );
    ctx.stroke();
  }
  const idle = s.landingTick === -1;
  const x = idle
      ? (drag?.x ?? ROULETTE_BALL_DOCK.x)
      : cx + Math.cos(angle) * radius,
    y = idle
      ? (drag?.y ?? ROULETTE_BALL_DOCK.y)
      : cy + Math.sin(angle) * radius;
  if (idle && !drag) {
    ctx.strokeStyle = "rgba(169,219,238,.6)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 28, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(10,28,45,.8)";
    ctx.beginPath();
    ctx.arc(x, y, 26, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#071320";
  ctx.beginPath();
  ctx.arc(x + 2, y + 4, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f0f7ff";
  ctx.beginPath();
  ctx.arc(x, y, 6, 0, Math.PI * 2);
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
  ctx.fillText(`${bet} · 5€`, cx, 377);
  if (s.lastPayout > 0 && s.tick - s.lastLandingTick < 120) {
    ctx.fillStyle = "#ffe9a4";
    ctx.font = "bold 19px system-ui";
    ctx.fillText(`+${s.lastPayout / 100}€`, cx, 103);
  }
}
const hudLabel = (s: Readonly<RouletteState>) =>
  `${(s.balanceMinor / 100).toFixed(2)} € FICTICIOS · ${(Math.max(0, 21600 - s.tick) / 120).toFixed(1)}s`;
const feedbackScore = (s: Readonly<RouletteState>) => s.balanceMinor;
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
  label: "Apuesta de ruleta",
  options: ROULETTE_BETS.map((bet) => ({
    action: `BET_${bet}`,
    label: `${bet.startsWith("NUMBER_") ? "NÚMERO " + Number(bet.slice(7)) : betLabels[bet]} · 5€ ficticios`,
  })),
  value: (s: RouletteState) => `BET_${s.bet}`,
  disabled: (s: RouletteState) =>
    s.landingTick !== -1 || s.status !== "running",
};
export default function GalacticRoulette(props: GameRuntimeProps) {
  const origin = useRef<CorePoint | null>(null),
    drag = useRef<CorePoint | null>(null);
  const canvasRender = useCallback(
    (ctx: CanvasRenderingContext2D, s: RouletteState) =>
      render(ctx, s, drag.current),
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
        origin.current = null;
        drag.current = null;
      }}
    >
      <CoreCanvasGame
        {...props}
        core={ROULETTE_CORE}
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
              s.landingTick === -1 && rouletteBallCanGrab(p) ? p : null;
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
          return rouletteDragLaunch(from, p);
        }}
      />
    </div>
  );
}
