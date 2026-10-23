"use client";
import { useMemo } from "react";
import type { GameRuntimeProps } from "@/lib/games";
import type { LogicalCanvasViewport } from "@/lib/gameCanvas";
import { drawSpaceBackdrop } from "@/lib/spaceBackdrop";
import { ORB_RULES, orbDirection } from "@/lib/verified/orbBurstCore.v1";
import {
  ORB_BURST_CORE_V4,
  ORB_V4_RULES,
  orbCenterV4,
  orbMissLimitV4,
  type OrbV4State,
} from "@/lib/verified/orbBurstCore.v4";
import { orbAimAction } from "@/lib/verified/orbBurstProtocol.v1";
import {
  applyOrbCamera,
  getOrbCamera,
  unprojectOrbPoint,
  type OrbCamera,
} from "@/lib/orbPresentation";
import CoreCanvasGame, { type CorePoint } from "./CoreCanvasGame";
const colors = ["#66e9ff", "#ff8bbb", "#ffe082", "#a9f786", "#b9a0ff", "#7d8794", "#ff7a3d", "#ffffff", "#ffe44d"];
const specialNames: Record<number, string> = { 6: "BOMBA", 7: "ARCOÍRIS", 8: "RAYO" };
function orb(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: number,
  r = 17,
  origin?: "source" | "shot" | "pressure",
  ice = 0,
) {
  if (color === 7 || color === 8) {
    ctx.save();
    ctx.translate(x, y);
    if (color === 7) {
      const rainbow = ["#ff6b6b", "#ffd36b", "#8cf29a", "#6bd4ff", "#b58cff"];
      rainbow.forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, r, -Math.PI / 2 + (i * Math.PI * 2) / 5, -Math.PI / 2 + ((i + 1) * Math.PI * 2) / 5);
        ctx.fill();
      });
      ctx.fillStyle = "rgba(255,255,255,.85)";
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.38, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = "#1c2140";
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffe44d";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#ffe44d";
      ctx.beginPath();
      ctx.moveTo(3, -r * 0.8);
      ctx.lineTo(-r * 0.45, 2);
      ctx.lineTo(-1, 2);
      ctx.lineTo(-4, r * 0.8);
      ctx.lineTo(r * 0.5, -3);
      ctx.lineTo(1, -3);
      ctx.fill();
    }
    ctx.restore();
    return;
  }
  if (color === 5 || color === 6) {
    // Asteroid (never matches, only falls when cut off) and bomb (clears its neighbours).
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = color === 5 ? "#59616d" : "#2a1b22";
    ctx.strokeStyle = color === 5 ? "#aab4c0" : "#ff9a5c";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 9; i++) {
      const a = (i * Math.PI * 2) / 9,
        rr = r * (color === 5 ? (i % 2 ? 0.86 : 1) : 1);
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    if (color === 5) {
      ctx.fillStyle = "rgba(0,0,0,.28)";
      ctx.beginPath();
      ctx.arc(-5, -4, 4, 0, Math.PI * 2);
      ctx.arc(5, 5, 3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = "#d8c7a0";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(r * 0.3, -r * 0.7);
      ctx.quadraticCurveTo(r * 0.8, -r * 1.1, r * 0.9, -r * 0.55);
      ctx.stroke();
      ctx.fillStyle = "#ffb15e";
      ctx.beginPath();
      ctx.arc(r * 0.9, -r * 0.6, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.25)";
      ctx.beginPath();
      ctx.arc(-r * 0.3, -r * 0.2, r * 0.25, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return;
  }
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
  if (ice > 0) {
    ctx.fillStyle = "rgba(190,236,255,.42)";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(240,252,255,.95)";
    ctx.lineWidth = 2.4;
    ctx.stroke();
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.55, y - r * 0.2);
    ctx.lineTo(x - r * 0.1, y - r * 0.55);
    ctx.moveTo(x + r * 0.2, y - r * 0.6);
    ctx.lineTo(x + r * 0.55, y - r * 0.15);
    if (ice > 1) {
      ctx.moveTo(x - r * 0.5, y + r * 0.45);
      ctx.lineTo(x + r * 0.05, y + r * 0.1);
      ctx.lineTo(x + r * 0.5, y + r * 0.5);
    }
    ctx.stroke();
  }
  if (origin === "source") {
    ctx.strokeStyle = "rgba(235,254,255,.85)";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(x, y, r - 3, -2.65, -0.6);
    ctx.stroke();
  } else if (origin === "pressure") {
    ctx.strokeStyle = "rgba(16,29,44,.45)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 9, y + 7);
    ctx.lineTo(x - 3, y + 11);
    ctx.moveTo(x + 3, y + 7);
    ctx.lineTo(x + 9, y + 11);
    ctx.stroke();
  }
}
function drawAimGuide(
  ctx: CanvasRenderingContext2D,
  state: Readonly<OrbV4State>,
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
  state: OrbV4State,
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
    const p = orbCenterV4(state, bubble.row, bubble.col),
      y = p.yMilli / 1000 - descent;
    if (y < 2 || y > 539) continue;
    orb(ctx, p.xMilli / 1000, y, bubble.color, 17, bubble.origin, bubble.ice ?? 0);
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
  if (!state.shot && state.status === "running" && !state.settleRemaining)
    drawAimGuide(ctx, state);
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
        // These positions were captured before the grid parity/insertion
        // changed; never relocate an already removed orb to the new grid.
        const p = bubble;
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
    if (state.currentColor >= 6) {
      // One short word under a special orb: its name, never a tutorial.
      ctx.save();
      ctx.fillStyle = "#ffe9a8";
      ctx.font = "bold 10px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(specialNames[state.currentColor], 195, 604);
      ctx.restore();
    }
  }
  ctx.strokeStyle = "rgba(160,225,240,.55)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.arc(286, 574, 17, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  orb(ctx, 286, 574, state.nextColor, 12);
  // Stored power: a gauge that fills one segment per charge.
  for (let i = 0; i < ORB_V4_RULES.maxPower; i++) {
    ctx.fillStyle = i < state.power ? "#ff9f43" : "rgba(139,199,220,.2)";
    ctx.fillRect(100 + i * 14, 560, 10, 6);
  }
  // Remaining swaps as pips (no on-canvas text).
  for (let i = 0; i < ORB_V4_RULES.maxSwaps; i++) {
    ctx.fillStyle = i < state.swaps ? "#ffe082" : "rgba(139,199,220,.2)";
    ctx.beginPath();
    ctx.moveTo(130 + i * 13, 598);
    ctx.lineTo(135 + i * 13, 603);
    ctx.lineTo(130 + i * 13, 608);
    ctx.lineTo(125 + i * 13, 603);
    ctx.closePath();
    ctx.fill();
  }
  // Pressure is an actual state indicator, not an instruction or a forecast.
  for (let i = 0; i < orbMissLimitV4(state); i++) {
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
      state: OrbV4State,
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
      state: OrbV4State,
    ) {
      return pointAction(unprojectOrbPoint(camera, point), phase, state);
    },
    failureFinale: {
      durationMs: 300,
      render(
        ctx: CanvasRenderingContext2D,
        state: OrbV4State,
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
  state: OrbV4State,
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
  s: "SWAP",
  S: "SWAP",
  " ": "SHOOT",
  Enter: "SHOOT",
};
const hudLabel = (state: Readonly<OrbV4State>) =>
  `AVANCE ${state.height}/${ORB_V4_RULES.sourceGoal} · ${state.points} PTS${state.combo > 1 ? ` · COMBO ×${state.combo}` : ""}`;
const feedbackScore = (state: Readonly<OrbV4State>) =>
  state.height * 1000 - state.pressureRows;
export default function OrbBurstVerified(props: GameRuntimeProps) {
  const presentation = useMemo(createPresentation, []);
  return (
    <div className="orbVerified">
      <CoreCanvasGame
        {...props}
        core={ORB_BURST_CORE_V4}
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
        controls={[
          { action: "SWAP", label: "Cambiar la bola cargada por la siguiente", symbol: "⇄" },
          { action: "POWER_RAINBOW", label: "Poder arcoíris, cuesta 1", symbol: "🌈1" },
          { action: "POWER_BOMB", label: "Poder bomba, cuesta 2", symbol: "💣2" },
          { action: "POWER_LIGHTNING", label: "Poder rayo, cuesta 3", symbol: "⚡3" },
        ]}
        instruction=""
      />
    </div>
  );
}
