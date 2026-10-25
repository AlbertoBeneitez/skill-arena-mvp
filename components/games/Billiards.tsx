"use client";
import { useMemo, useEffect } from "react";
import type { GameRuntimeProps } from "@/lib/games";
import { drawSpaceBackdrop } from "@/lib/spaceBackdrop";
import type { LogicalCanvasViewport } from "@/lib/gameCanvas";
import {
  applyBilliardsCamera,
  getBilliardsCamera,
  unprojectBilliardsPoint,
  type BilliardsCamera,
} from "@/lib/billiardsPresentation";
import {
  BILLIARDS_POCKETS,
  BILLIARDS_RULES,
  billiardsDirection,
} from "@/lib/verified/billiardsCore.v1";
import {
  BILLIARDS_V2_RULES,
  type BilliardsV2State,
} from "@/lib/verified/billiardsCore.v2";
import { BILLIARDS_CORE_V4 } from "@/lib/verified/billiardsCore.v4";
import { grabBilliardsCue, pullBilliardsCue, type CueDrag } from "@/lib/billiardsPullback";
import CoreCanvasGame, { type CorePoint } from "./CoreCanvasGame";

import { t, formatNumber, useI18n } from "@/lib/i18n";
const ballColors = [
  "#eaf8ff",
  "#72e4d1",
  "#ffc777",
  "#bda4f7",
  "#8fc9ff",
  "#f2a8be",
  "#b8e28a",
  "#78cedb",
  "#edb889",
  "#a3a9f0",
  "#e7df94",
];

/** A short aim ray, stopped by the first visible contact; no flight simulation. */
function drawAimGuide(ctx: CanvasRenderingContext2D, s: BilliardsV2State) {
  const cue = s.balls[0];
  if (!cue || cue.potted) return;
  const direction = billiardsDirection(s.aim),
    dx = direction.x / direction.length,
    dy = direction.y / direction.length,
    x = cue.x / 1000,
    y = cue.y / 1000,
    radius = BILLIARDS_RULES.radius / 1000;
  let distance = 96,
    contact = false;
  const circleContact = (cx: number, cy: number, r: number) => {
    const ox = x - cx,
      oy = y - cy,
      projection = ox * dx + oy * dy,
      discriminant = projection * projection - (ox * ox + oy * oy - r * r);
    if (discriminant < 0) return;
    const near = -projection - Math.sqrt(discriminant);
    if (near >= 0 && near < distance) {
      distance = near;
      contact = true;
    }
  };
  for (const ball of s.balls) {
    if (ball.id && !ball.potted)
      circleContact(ball.x / 1000, ball.y / 1000, radius * 2);
  }
  const railContact = (travel: number) => {
    if (travel >= 0 && travel < distance) {
      distance = travel;
      contact = true;
    }
  };
  if (dx > 0) railContact((BILLIARDS_RULES.right / 1000 - radius - x) / dx);
  else if (dx < 0) railContact((BILLIARDS_RULES.left / 1000 + radius - x) / dx);
  if (dy > 0) railContact((BILLIARDS_RULES.bottom / 1000 - radius - y) / dy);
  else if (dy < 0) railContact((BILLIARDS_RULES.top / 1000 + radius - y) / dy);

  // The cue stick is drawn over the rail and outside the cloth, so it stays
  // visible when the ball is far from the middle (it used to be clipped).
  // Its pullback shows the selected power, without predicting an outcome.
  const pullback = 9 + s.power * 3.2,
    cueLength = 150,
    tipX = x - dx * pullback,
    tipY = y - dy * pullback,
    buttX = x - dx * (pullback + cueLength),
    buttY = y - dy * (pullback + cueLength),
    nx = -dy,
    ny = dx;
  ctx.save();
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(0,0,0,.35)";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(tipX + 2, tipY + 4);
  ctx.lineTo(buttX + 2, buttY + 4);
  ctx.stroke();
  ctx.fillStyle = "#e9d7a4";
  ctx.beginPath();
  ctx.moveTo(tipX + nx * 1.8, tipY + ny * 1.8);
  ctx.lineTo(tipX - nx * 1.8, tipY - ny * 1.8);
  ctx.lineTo(buttX - nx * 4.2, buttY - ny * 4.2);
  ctx.lineTo(buttX + nx * 4.2, buttY + ny * 4.2);
  ctx.fill();
  ctx.strokeStyle = "#7a4d2c";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(x - dx * (pullback + cueLength * 0.62), y - dy * (pullback + cueLength * 0.62));
  ctx.lineTo(buttX, buttY);
  ctx.stroke();
  ctx.strokeStyle = "#8fe3ff";
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(tipX - dx * 5, tipY - dy * 5);
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.rect(42, 94, 306, 410);
  ctx.clip();
  if (distance > radius + 2) {
    ctx.strokeStyle = "rgba(220,254,248,.65)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 5]);
    ctx.beginPath();
    ctx.moveTo(x + dx * (radius + 2), y + dy * (radius + 2));
    ctx.lineTo(x + dx * distance, y + dy * distance);
    ctx.stroke();
    ctx.setLineDash([]);
    if (contact) {
      // Tangent mark indicates current contact geometry, never a landing circle.
      const endX = x + dx * distance,
        endY = y + dy * distance;
      ctx.beginPath();
      ctx.moveTo(endX - dy * 4, endY + dx * 4);
      ctx.lineTo(endX + dy * 4, endY - dx * 4);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function renderTable(
  ctx: CanvasRenderingContext2D,
  s: BilliardsV2State,
  camera: BilliardsCamera,
) {
  ctx.save();
  applyBilliardsCamera(ctx, camera);
  ctx.fillStyle = "#091724";
  ctx.beginPath();
  ctx.roundRect(24, 76, 342, 447, 26);
  ctx.fill();
  ctx.shadowColor = "rgba(69,210,195,.2)";
  ctx.shadowBlur = 12;
  ctx.strokeStyle = "#52768c";
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.shadowBlur = 0;
  const cloth = ctx.createLinearGradient(42, 94, 348, 504);
  cloth.addColorStop(0, "#134953");
  cloth.addColorStop(0.5, "#123745");
  cloth.addColorStop(1, "#102d3d");
  ctx.fillStyle = cloth;
  ctx.fillRect(42, 94, 306, 410);
  ctx.strokeStyle = "rgba(132,208,215,.075)";
  ctx.lineWidth = 1;
  for (let x = 62; x < 348; x += 24) {
    ctx.beginPath();
    ctx.moveTo(x, 94);
    ctx.lineTo(x, 504);
    ctx.stroke();
  }
  for (let y = 118; y < 504; y += 24) {
    ctx.beginPath();
    ctx.moveTo(42, y);
    ctx.lineTo(348, y);
    ctx.stroke();
  }
  ctx.strokeStyle = "#60acb5";
  ctx.lineWidth = 3;
  ctx.strokeRect(42, 94, 306, 410);
  // Small rail sights make contact angles readable without extra UI copy.
  ctx.fillStyle = "#7bb3bb";
  for (const y of [166, 234, 366, 434]) {
    ctx.fillRect(31, y, 3, 3);
    ctx.fillRect(356, y, 3, 3);
  }
  for (const x of [126, 264]) {
    ctx.fillRect(x, 83, 3, 3);
    ctx.fillRect(x, 513, 3, 3);
  }
  for (const pocket of BILLIARDS_POCKETS) {
    const x = pocket.x / 1000,
      y = pocket.y / 1000;
    const shadow = ctx.createRadialGradient(x, y, 10, x, y, 23);
    shadow.addColorStop(0, "#01070d");
    shadow.addColorStop(1, "#15323d");
    ctx.fillStyle = shadow;
    ctx.beginPath();
    ctx.arc(x, y, 21, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#7395a6";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = "#55d9c7";
    ctx.beginPath();
    ctx.arc(x, y, 15, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (s.phase === "aim") drawAimGuide(ctx, s);
  const recommended = s.balls.find((ball) => ball.id > 0 && !ball.potted);
  const contactAge = s.tick - s.lastContactTick;
  for (const ball of s.balls) {
    if (ball.potted) continue;
    const x = ball.x / 1000,
      y = ball.y / 1000;
    if (s.phase === "moving" && ball.vx * ball.vx + ball.vy * ball.vy > 60000) {
      ctx.strokeStyle = ball.id
        ? "rgba(119,232,216,.18)"
        : "rgba(225,247,255,.23)";
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(
        x - Math.max(-16, Math.min(16, ball.vx / 180)),
        y - Math.max(-16, Math.min(16, ball.vy / 180)),
      );
      ctx.stroke();
    }
    if (s.phase === "aim" && ball.id === recommended?.id) {
      ctx.strokeStyle = "rgba(157,255,220,.4)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, 13, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.beginPath();
    ctx.ellipse(x + 3, y + 5, 10, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    const sphere = ctx.createRadialGradient(x - 4, y - 4, 1, x, y, 10);
    sphere.addColorStop(0, "#fff");
    sphere.addColorStop(0.25, ballColors[ball.id % ballColors.length]);
    sphere.addColorStop(1, ball.id ? "#294553" : "#8da7b7");
    ctx.fillStyle = sphere;
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fill();
    if (ball.id) {
      ctx.fillStyle = "rgba(236,251,251,.78)";
      ctx.beginPath();
      ctx.arc(x, y, 5.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.translate(x, y);
      if (camera.rotated) ctx.rotate(Math.PI / 2);
      ctx.fillStyle = "#112535";
      ctx.textAlign = "center";
      ctx.font = ball.id < 10 ? "bold 9px system-ui" : "bold 8px system-ui";
      ctx.fillText(String(ball.id), 0, 2.8);
      ctx.restore();
    }
    if (
      s.phase === "moving" &&
      contactAge >= 0 &&
      contactAge < 18 &&
      (ball.vx || ball.vy)
    ) {
      ctx.strokeStyle = `rgba(237,255,250,${0.45 * (1 - contactAge / 18)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, 10.5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  if (s.tick - s.lastPotTick >= 0 && s.tick - s.lastPotTick < 70) {
    const age = (s.tick - s.lastPotTick) / 70,
      x = s.lastPotX / 1000,
      y = s.lastPotY / 1000;
    ctx.strokeStyle = `rgba(142,255,210,${1 - age})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 12 + age * 25, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = `rgba(180,255,225,${1 - age})`;
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4,
        spread = 10 + age * 30;
      ctx.fillRect(
        x + Math.cos(angle) * spread - 1,
        y + Math.sin(angle) * spread - 1,
        2,
        2,
      );
    }
  }
  ctx.restore();
  // Power stays upright, separate from the rotated physical table.
  ctx.save();
  for (let i = 0; i < 13; i++) {
    ctx.fillStyle = i <= s.power ? (s.power > 8 ? "#e5c58b" : "#79d8c3") : "rgba(134,171,187,.2)";
    ctx.fillRect(camera.centerX - 64 + i * 10, camera.rotated ? 592 : 535, 7, 8);
  }
  ctx.restore();
}

function createPresentation() {
  let camera = getBilliardsCamera({ width: 390, height: 620 });
  let viewportKey = "";
  let drag: CueDrag | null = null;
  return {
    clear() { drag = null; },
    render(
      ctx: CanvasRenderingContext2D,
      state: BilliardsV2State,
      viewport: LogicalCanvasViewport,
    ) {
      const dpr =
        typeof window === "undefined"
          ? 1
          : Math.min(2, Math.max(1, window.devicePixelRatio || 1));
      const key = `${viewport.width}:${viewport.height}:${ctx.canvas.width}:${ctx.canvas.height}:${dpr}`;
      if (key !== viewportKey) {
        viewportKey = key;
        drag = null;
        const transform = ctx.getTransform();
        camera = getBilliardsCamera(
          viewport,
          Math.hypot(transform.a, transform.b) / dpr,
        );
      }
      drawSpaceBackdrop(ctx, viewport.width, viewport.height, 0, state.tick);
      renderTable(ctx, state, camera);
    },
    pointAction(
      point: CorePoint,
      phase: "down" | "move" | "up",
      state: BilliardsV2State,
    ) {
      const p = unprojectBilliardsPoint(camera, point);
      if (state.phase !== "aim") { drag = null; return null; }
      if (phase === "down") {
        const cue = state.balls[0];
        drag = cue && !cue.potted ? grabBilliardsCue(p, {x: cue.x / 1000, y: cue.y / 1000}, state.aim) : null;
        return null;
      }
      if (!drag) return null;
      const actions = pullBilliardsCue(drag, p);
      if (phase === "up") {
        drag = null;
        return actions ? [...actions, "SHOOT"] : null;
      }
      return actions;
    },
  };
}
const controls: readonly {action: string; label: string; symbol: string}[] = [];
const tones = { SHOOT: "tap" } as const;
const keys = {
  " ": "SHOOT",
  Enter: "SHOOT",
  "1": "POWER_00",
  "2": "POWER_06",
  "3": "POWER_12",
};
const hudLabel = (s: Readonly<BilliardsV2State>) =>
  `${t("billiards.hud", { n: s.height, total: BILLIARDS_V2_RULES.targets, shots: s.shotsLeft })}${s.scratch ? ` · ${t("billiards.scratch")}` : ""}`;
export default function Billiards(props: GameRuntimeProps) {
  useI18n();
  const presentation = useMemo(createPresentation, []);
  useEffect(() => {
    const clear = presentation.clear;
    clear();
    window.addEventListener("blur", clear);
    window.addEventListener("resize", clear);
    return () => { window.removeEventListener("blur", clear); window.removeEventListener("resize", clear); clear(); };
  }, [presentation, props.active, props.seed]);
  return (
    <div className="billiardsVerified" onPointerCancel={presentation.clear} onLostPointerCapture={presentation.clear}>
      <CoreCanvasGame
        {...props}
        core={BILLIARDS_CORE_V4}
        name="Billar"
        render={presentation.render}
        pointAction={presentation.pointAction}
        expandHorizontalViewport
        controls={controls}
        keys={keys}
        inputTones={tones}
        hudLabel={hudLabel}
        hideHudScore
        instruction=""
      />
    </div>
  );
}
