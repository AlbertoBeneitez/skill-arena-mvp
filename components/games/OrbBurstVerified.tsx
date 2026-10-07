"use client";
import { useMemo } from "react";
import type { GameRuntimeProps } from "@/lib/games";
import { drawSpaceBackdrop } from "@/lib/spaceBackdrop";
import {
  ORB_BURST_CORE,
  ORB_RULES,
  orbCenter,
  forecastOrb,
  orbMissLimit,
  type OrbState,
} from "@/lib/verified/orbBurstCore.v1";
import { orbAimAction } from "@/lib/verified/orbBurstProtocol.v1";
import CoreCanvasGame, { type CorePoint } from "./CoreCanvasGame";
const colors = ["#66e9ff", "#ff8bbb", "#ffe082", "#a9f786", "#b9a0ff"];
function orb(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: number,
  r = 17,
) {
  const gradient = ctx.createRadialGradient(
    x - r * 0.3,
    y - r * 0.35,
    1,
    x,
    y,
    r,
  );
  gradient.addColorStop(0, "#f5ffff");
  gradient.addColorStop(0.28, colors[color]);
  gradient.addColorStop(1, "#163049");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = colors[color];
  ctx.lineWidth = 1.3;
  ctx.stroke();
  // A distinct internal glyph also identifies each color.
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = "#16223b";
  ctx.lineWidth = 2;
  if (color === 0) {
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.stroke();
  } else if (color === 1) {
    ctx.strokeRect(-4, -4, 8, 8);
  } else if (color === 2) {
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(6, 5);
    ctx.lineTo(-6, 5);
    ctx.closePath();
    ctx.stroke();
  } else if (color === 3) {
    ctx.beginPath();
    ctx.moveTo(-5, 0);
    ctx.lineTo(5, 0);
    ctx.moveTo(0, -5);
    ctx.lineTo(0, 5);
    ctx.stroke();
  } else {
    ctx.rotate(Math.PI / 4);
    ctx.strokeRect(-4, -4, 8, 8);
  }
  ctx.restore();
}
function renderer() {
  let cacheKey = "",
    path: ReturnType<typeof forecastOrb>["points"] = [];
  return (ctx: CanvasRenderingContext2D, state: OrbState) => {
    drawSpaceBackdrop(ctx, 390, 620, state.tick * 0.03, state.tick);
    ctx.fillStyle = "rgba(4,15,31,.72)";
    ctx.beginPath();
    ctx.roundRect(6, 20, 378, 501, 16);
    ctx.fill();
    ctx.strokeStyle = "rgba(123,214,241,.25)";
    ctx.lineWidth = 1;
    ctx.stroke();
    for (const bubble of state.bubbles) {
      const p = orbCenter(bubble.row, bubble.col);
      orb(ctx, p.xMilli / 1000, p.yMilli / 1000, bubble.color);
    }
    ctx.save();
    ctx.strokeStyle = "rgba(255,151,166,.6)";
    ctx.setLineDash([5, 8]);
    ctx.beginPath();
    ctx.moveTo(16, 502);
    ctx.lineTo(374, 502);
    ctx.stroke();
    ctx.restore();
    if (!state.shot && state.status === "running" && !state.settleRemaining) {
      const key = `${state.seed}:${state.boardRevision}:${state.aimIndex}:${state.shotOrdinal}`;
      if (key !== cacheKey) {
        cacheKey = key;
        path = forecastOrb(state).points;
      }
      const shown = state.stage < 2 ? path : path.slice(0, 12);
      ctx.fillStyle = "rgba(205,244,255,.65)";
      for (const p of shown) {
        ctx.beginPath();
        ctx.arc(p.xMilli / 1000, p.yMilli / 1000, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (state.shot)
      orb(
        ctx,
        state.shot.xMilli / 1000,
        state.shot.yMilli / 1000,
        state.shot.color,
      );
    if (state.burst) {
      const age = (state.tick - state.burst.tick) / 70;
      if (age >= 0 && age < 1) {
        ctx.save();
        ctx.globalAlpha = 1 - age;
        for (const bubble of state.burst.bubbles) {
          const p = orbCenter(bubble.row, bubble.col);
          ctx.strokeStyle = colors[bubble.color];
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(
            p.xMilli / 1000,
            p.yMilli / 1000,
            18 + age * 18,
            0,
            Math.PI * 2,
          );
          ctx.stroke();
          for (let i = 0; i < 5; i++) {
            const a = (i * Math.PI * 2) / 5 + bubble.col;
            ctx.fillStyle = colors[bubble.color];
            ctx.fillRect(
              p.xMilli / 1000 + Math.cos(a) * age * 35 - 2,
              p.yMilli / 1000 + Math.sin(a) * age * 35 + age * 12 - 2,
              4,
              4,
            );
          }
        }
        ctx.restore();
      }
    }
    ctx.fillStyle = "#112c43";
    ctx.strokeStyle = "#66c7de";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(195, 581, 43, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (!state.shot) orb(ctx, 195, 574, state.currentColor);
    orb(ctx, 286, 574, state.nextColor, 12);
    ctx.textAlign = "center";
    ctx.font = "bold 11px system-ui";
    ctx.fillStyle = "#b8d8e9";
    ctx.fillText("SIGUIENTE", 286, 601);
    ctx.font = "bold 12px system-ui";
    ctx.fillStyle = "#d2f5ff";
    ctx.fillText(`SECTOR ${state.stage + 1}`, 68, 548);
    ctx.fillStyle =
      state.misses >= orbMissLimit(state.stage) - 2 ? "#ffadac" : "#afcad8";
    ctx.font = "bold 10px system-ui";
    ctx.fillText(
      `${orbMissLimit(state.stage) - state.misses} FALLOS ANTES DEL DESCENSO`,
      250,
      538,
    );
    if (state.tick < 120 * 7 && state.shotOrdinal < 2) {
      ctx.fillStyle = "#e4f6ff";
      ctx.font = "bold 13px system-ui";
      ctx.fillText("APUNTA · SUELTA · JUNTA 3", 195, 470);
    }
    if (state.tick - state.lastStageTick < 100) {
      ctx.fillStyle = "#affff1";
      ctx.font = "bold 22px system-ui";
      ctx.fillText("SECTOR DESPEJADO", 195, 290);
    }
    ctx.textAlign = "left";
  };
}
function pointAction(
  point: CorePoint,
  phase: "down" | "move" | "up",
  state: OrbState,
) {
  if (phase === "up") return "SHOOT";
  if (state.shot || state.settleRemaining) return null;
  const angle = Math.atan2(Math.min(-40, point.y - 574), point.x - 195);
  const positive = (angle + Math.PI * 2) % (Math.PI * 2),
    phaseIndex = (positive * 4096) / (Math.PI * 2);
  return orbAimAction(
    Math.max(0, Math.min(88, Math.round((phaseIndex - 2192) / 20))),
  );
}
const inputTones = { SHOOT: "tap" } as const;
const keys = {
  ArrowLeft: "AIM_LEFT",
  ArrowRight: "AIM_RIGHT",
  " ": "SHOOT",
  Enter: "SHOOT",
};
const controls = [{ action: "SHOOT", label: "Lanzar orbe", symbol: "LANZAR" }];
export default function OrbBurstVerified(props: GameRuntimeProps) {
  const render = useMemo(renderer, []);
  return (
    <div className="orbVerified">
      <CoreCanvasGame
        {...props}
        core={ORB_BURST_CORE}
        name="Orb Burst"
        render={render}
        pointAction={pointAction}
        inputTones={inputTones}
        keys={keys}
        controls={controls}
        instruction="Arrastra para apuntar y suelta para lanzar. Junta 3 del mismo color."
      />
    </div>
  );
}
