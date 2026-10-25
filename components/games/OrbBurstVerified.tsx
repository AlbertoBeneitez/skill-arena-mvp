"use client";
import { useMemo } from "react";
import type { GameRuntimeProps } from "@/lib/games";
import type { LogicalCanvasViewport } from "@/lib/gameCanvas";
import { drawSpaceBackdrop } from "@/lib/spaceBackdrop";
import { ORB_RULES, orbDirection } from "@/lib/verified/orbBurstCore.v1";
import {
  ORB_BURST_CORE_V6,
  orbCenterV6,
  orbMissLimitV6,
  type OrbV6State,
} from "@/lib/verified/orbBurstCore.v6";
import { orbAimAction } from "@/lib/verified/orbBurstProtocol.v1";
import {
  applyOrbCamera,
  getOrbCamera,
  unprojectOrbPoint,
  type OrbCamera,
} from "@/lib/orbPresentation";
import CoreCanvasGame, { type CorePoint } from "./CoreCanvasGame";
import { t as tx, formatNumber, useI18n } from "@/lib/i18n";
/** Six classic bubble colours (each also has its own glyph for colour-blind players). */
const colors = ["#3fa9ff", "#ff4f6d", "#ffd23f", "#4fdc7a", "#b07bff", "#ff9a3c"];
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
  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(0.3, colors[color]);
  gradient.addColorStop(1, "#101a33");
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
  } else if (color === 4) {
    ctx.rotate(Math.PI / 4);
    ctx.strokeRect(-4, -4, 8, 8);
  } else {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) { const a = (i * Math.PI) / 3; i ? ctx.lineTo(Math.cos(a) * 5.5, Math.sin(a) * 5.5) : ctx.moveTo(Math.cos(a) * 5.5, Math.sin(a) * 5.5); }
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
  // Gloss.
  ctx.fillStyle = "rgba(255,255,255,.45)";
  ctx.beginPath(); ctx.ellipse(x - r * 0.35, y - r * 0.42, r * 0.32, r * 0.18, -0.5, 0, Math.PI * 2); ctx.fill();
}
function drawAimGuide(
  ctx: CanvasRenderingContext2D,
  state: Readonly<OrbV6State>,
) {
  const direction = orbDirection(state.aimIndex);
  ctx.save();
  ctx.strokeStyle = "rgba(205,244,255,.7)";
  ctx.lineWidth = 2;
  ctx.setLineDash([3, 7]);
  ctx.beginPath();
  ctx.moveTo(
    195 + (direction.x / direction.length) * 24,
    574 + (direction.y / direction.length) * 24,
  );
  ctx.lineTo(
    195 + (direction.x / direction.length) * 84,
    574 + (direction.y / direction.length) * 84,
  );
  ctx.stroke();
  ctx.restore();
}
function renderField(
  ctx: CanvasRenderingContext2D,
  state: OrbV6State,
  camera: OrbCamera,
) {
  ctx.save();
  applyOrbCamera(ctx, camera);
  ctx.fillStyle = "rgba(4,15,31,.72)";
  ctx.beginPath();
  ctx.roundRect(6, 20, 378, 501, 16);
  ctx.fill();
  ctx.strokeStyle = "rgba(123,214,241,.25)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.rect(6, 20, 378, 501);
  ctx.clip();
  const insertionAge = state.tick - state.lastInsertionTick;
  // The core locks launch for 18 ticks after every insertion. Only those
  // safe settling frames interpolate; shots always see the true collider.
  const descent =
    state.status === "running" &&
    !state.shot &&
    state.settleRemaining > 0 &&
    insertionAge >= 0 &&
    insertionAge < 12
      ? (ORB_RULES.rowHeightMilli / 1000) * (1 - insertionAge / 12)
      : 0;
  for (const bubble of state.bubbles) {
    const p = orbCenterV6(state, bubble.row, bubble.col),
      y = p.yMilli / 1000 - descent;
    if (y < 2 || y > 539) continue;
    orb(ctx, p.xMilli / 1000, y, bubble.color, 17);
  }
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = "rgba(255,151,166,.6)";
  ctx.setLineDash([5, 8]);
  ctx.beginPath();
  ctx.moveTo(16, 502);
  ctx.lineTo(374, 502);
  ctx.stroke();
  ctx.restore();
  if (!state.shot && state.status === "running")
    drawAimGuide(ctx, state);
  if (state.shot)
    orb(
      ctx,
      state.shot.xMilli / 1000,
      state.shot.yMilli / 1000,
      state.shot.color,
    );
  if (state.burst) {
    const ticks = state.tick - state.burst.tick;
    if (ticks >= 0 && ticks < 90) {
      ctx.save();
      for (const bubble of state.burst.bubbles) {
        // Positions captured before removal: popped orbs burst in place, hanging ones fall away.
        const x = bubble.xMilli / 1000, y0 = bubble.yMilli / 1000;
        if (bubble.drop) {
          const t = ticks / 120, y = y0 + 40 * t + 900 * t * t;
          if (y < 640) { ctx.globalAlpha = Math.max(0, 1 - ticks / 90); orb(ctx, x + Math.sin(bubble.col + ticks * 0.05) * 4, y, bubble.color, 17); }
        } else if (ticks < 40) {
          const k = ticks / 40;
          ctx.globalAlpha = 1 - k;
          ctx.strokeStyle = colors[bubble.color];
          ctx.lineWidth = 3 * (1 - k) + 1;
          ctx.beginPath(); ctx.arc(x, y0, 12 + k * 22, 0, Math.PI * 2); ctx.stroke();
          for (let i = 0; i < 6; i++) {
            const a = (i * Math.PI * 2) / 6 + bubble.col;
            ctx.fillStyle = colors[bubble.color];
            ctx.beginPath(); ctx.arc(x + Math.cos(a) * k * 30, y0 + Math.sin(a) * k * 30 + k * k * 14, 3 * (1 - k) + 1, 0, Math.PI * 2); ctx.fill();
          }
        }
      }
      ctx.globalAlpha = 1;
      if (ticks < 70 && state.burst.points > 0) {
        const last = state.burst.bubbles[0];
        ctx.fillStyle = state.burst.dropped ? "#ffd23f" : "#e9fbff";
        ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 12;
        ctx.font = `900 ${state.burst.dropped >= 4 ? 24 : 18}px system-ui`;
        ctx.textAlign = "center";
        ctx.fillText(`+${formatNumber(state.burst.points)}`, last.xMilli / 1000, last.yMilli / 1000 - 10 - ticks * 0.4);
        ctx.shadowBlur = 0;
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
  const direction = orbDirection(state.aimIndex);
  ctx.strokeStyle = "#78cbdf";
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(
    195 + (direction.x / direction.length) * 21,
    574 + (direction.y / direction.length) * 21,
  );
  ctx.lineTo(
    195 + (direction.x / direction.length) * 34,
    574 + (direction.y / direction.length) * 34,
  );
  ctx.stroke();
  if (!state.shot) {
    orb(ctx, 195, 574, state.currentColor);
  }
  ctx.strokeStyle = "rgba(160,225,240,.55)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.arc(286, 574, 17, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  orb(ctx, 286, 574, state.nextColor, 12);
  // Pressure is an actual state indicator, not an instruction or a forecast.
  for (let i = 0; i < orbMissLimitV6(state); i++) {
    ctx.fillStyle = i < state.misses ? "#ff9dad" : "rgba(139,199,220,.24)";
    ctx.beginPath();
    ctx.arc(49 + i * 14, 546, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
function createPresentation() {
  let camera = getOrbCamera({ width: 390, height: 620 }),
    viewportKey = "";
  return {
    render(
      ctx: CanvasRenderingContext2D,
      state: OrbV6State,
      viewport: LogicalCanvasViewport,
    ) {
      const dpr =
        typeof window === "undefined"
          ? 1
          : Math.min(2, Math.max(1, window.devicePixelRatio || 1));
      const key = `${viewport.width}:${viewport.height}:${ctx.canvas.width}:${ctx.canvas.height}:${dpr}`;
      if (key !== viewportKey) {
        viewportKey = key;
        const transform = ctx.getTransform();
        camera = getOrbCamera(
          viewport,
          Math.hypot(transform.a, transform.b) / dpr,
        );
      }
      drawSpaceBackdrop(
        ctx,
        viewport.width,
        viewport.height,
        state.tick * 0.03,
        state.tick,
      );
      renderField(ctx, state, camera);
    },
    pointAction(
      point: CorePoint,
      phase: "down" | "move" | "up",
      state: OrbV6State,
    ) {
      return pointAction(unprojectOrbPoint(camera, point), phase, state);
    },
    failureFinale: {
      durationMs: 300,
      render(
        ctx: CanvasRenderingContext2D,
        state: OrbV6State,
        elapsedMs: number,
      ) {
        if (state.status !== "failed") return;
        ctx.save();
        applyOrbCamera(ctx, camera);
        const fade = 1 - Math.min(1, Math.max(0, elapsedMs) / 300);
        ctx.strokeStyle = `rgba(255,126,148,${fade})`;
        ctx.lineWidth = 3 + 7 * (1 - fade);
        ctx.beginPath();
        ctx.moveTo(16, 502);
        ctx.lineTo(374, 502);
        ctx.stroke();
        ctx.restore();
      },
    },
  };
}
function pointAction(
  point: CorePoint,
  phase: "down" | "move" | "up",
  state: OrbV6State,
) {
  if (phase === "up") return "SHOOT";
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
  s: "SWAP",
  S: "SWAP",
  " ": "SHOOT",
  Enter: "SHOOT",
};
const hudLabel = (state: Readonly<OrbV6State>) =>
  `${tx("play.pts", { n: formatNumber(state.points) })}${state.combo > 1 ? ` · ${tx("play.combo", { n: state.combo })}` : ""}`;
const feedbackScore = (state: Readonly<OrbV6State>) => state.points;
export default function OrbBurstVerified(props: GameRuntimeProps) {
  useI18n();
  const presentation = useMemo(createPresentation, []);
  return (
    <div className="orbVerified">
      <CoreCanvasGame
        {...props}
        core={ORB_BURST_CORE_V6}
        name="Orb Burst"
        render={presentation.render}
        pointAction={presentation.pointAction}
        expandHorizontalViewport
        hudLabel={hudLabel}
        hideHudScore
        feedbackScore={feedbackScore}
        failureFinale={presentation.failureFinale}
        inputTones={inputTones}
        keys={keys}
        controls={[{ action: "SWAP", label: tx("orb.swap"), symbol: "⇄" }]}
        instruction=""
      />
    </div>
  );
}
