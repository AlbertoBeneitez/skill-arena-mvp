"use client";
import { useMemo } from "react";
import type { GameRuntimeProps } from "@/lib/games";
import type { LogicalCanvasViewport } from "@/lib/gameCanvas";
import { drawSpaceBackdrop } from "@/lib/spaceBackdrop";
import { ORB_RULES, orbDirection } from "@/lib/verified/orbBurstCore.v1";
import {
  ORB_BURST_CORE_V2,
  ORB_V2_RULES,
  orbCenterV2,
  orbMissLimitV2,
  type OrbV2State,
} from "@/lib/verified/orbBurstCore.v2";
import { orbAimAction } from "@/lib/verified/orbBurstProtocol.v1";
import {
  applyOrbCamera,
  getOrbCamera,
  unprojectOrbPoint,
  type OrbCamera,
} from "@/lib/orbPresentation";
import CoreCanvasGame, { type CorePoint } from "./CoreCanvasGame";
const colors = ["#66e9ff", "#ff8bbb", "#ffe082", "#a9f786", "#b9a0ff"];
function orb(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: number,
  r = 17,
  origin?: "source" | "shot" | "pressure",
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
  state: Readonly<OrbV2State>,
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
  state: OrbV2State,
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
    const p = orbCenterV2(state, bubble.row, bubble.col),
      y = p.yMilli / 1000 - descent;
    if (y < 2 || y > 539) continue;
    orb(ctx, p.xMilli / 1000, y, bubble.color, 17, bubble.origin);
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
  if (!state.shot) orb(ctx, 195, 574, state.currentColor);
  orb(ctx, 286, 574, state.nextColor, 12);
  // Pressure is an actual state indicator, not an instruction or a forecast.
  for (let i = 0; i < orbMissLimitV2(state); i++) {
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
      state: OrbV2State,
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
      state: OrbV2State,
    ) {
      return pointAction(unprojectOrbPoint(camera, point), phase, state);
    },
    failureFinale: {
      durationMs: 300,
      render(
        ctx: CanvasRenderingContext2D,
        state: OrbV2State,
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
  state: OrbV2State,
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
const hudLabel = (state: Readonly<OrbV2State>) =>
  `AVANCE ${state.height}/${ORB_V2_RULES.sourceGoal}`;
const feedbackScore = (state: Readonly<OrbV2State>) =>
  state.height * 1000 - state.pressureRows;
export default function OrbBurstVerified(props: GameRuntimeProps) {
  const presentation = useMemo(createPresentation, []);
  return (
    <div className="orbVerified">
      <CoreCanvasGame
        {...props}
        core={ORB_BURST_CORE_V2}
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
        instruction=""
      />
    </div>
  );
}
