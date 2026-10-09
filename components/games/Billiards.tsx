"use client";
import { useMemo } from "react";
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
  BILLIARDS_CORE_V2,
  BILLIARDS_V2_RULES,
  type BilliardsV2State,
} from "@/lib/verified/billiardsCore.v2";
import { billiardsAimAction } from "@/lib/verified/billiardsProtocol.v1";
import CoreCanvasGame, { type CorePoint } from "./CoreCanvasGame";

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
  for (const bumper of s.bumpers)
    circleContact(
      bumper.x / 1000,
      bumper.y / 1000,
      radius + bumper.radius / 1000,
    );
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

  ctx.save();
  ctx.beginPath();
  ctx.rect(42, 94, 306, 410);
  ctx.clip();
  // The cue's pullback shows selected power, without predicting an outcome.
  const pullback = 16 + s.power * 6;
  ctx.strokeStyle = "rgba(233,228,198,.85)";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x - dx * pullback, y - dy * pullback);
  ctx.lineTo(x - dx * (pullback + 34), y - dy * (pullback + 34));
  ctx.stroke();
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
  for (const bumper of s.bumpers) {
    const x = bumper.x / 1000,
      y = bumper.y / 1000,
      r = bumper.radius / 1000;
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.beginPath();
    ctx.ellipse(x + 3, y + 4, r, r * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#182231";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#dfa06e";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "#e8b986";
    ctx.fillRect(x - 4, y - 1, 8, 2);
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
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle =
      i <= s.power
        ? ["#79d8c3", "#8ccdeb", "#e5c58b"][s.power]
        : "rgba(134,171,187,.2)";
    ctx.fillRect(
      camera.centerX - 29 + i * 21,
      camera.rotated ? 592 : 535,
      16,
      8,
    );
  }
  ctx.restore();
}

function createPresentation() {
  let camera = getBilliardsCamera({ width: 390, height: 620 });
  let viewportKey = "";
  return {
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
      return aim(unprojectBilliardsPoint(camera, point), phase, state);
    },
  };
}
function aim(
  point: CorePoint,
  phase: "down" | "move" | "up",
  s: BilliardsV2State,
) {
  if (phase === "up" || s.phase !== "aim") return null;
  const cue = s.balls[0],
    dx = point.x - cue.x / 1000,
    dy = point.y - cue.y / 1000;
  if (dx * dx + dy * dy < 100) return null;
  const angle = (Math.atan2(dy, dx) + Math.PI * 2) % (Math.PI * 2);
  return billiardsAimAction(Math.round((angle * 180) / (Math.PI * 2)) % 180);
}
const controls = [
  { action: "POWER_LOW", label: "Potencia suave", symbol: "SUAVE" },
  { action: "POWER_MEDIUM", label: "Potencia media", symbol: "MEDIA" },
  { action: "POWER_HIGH", label: "Potencia fuerte", symbol: "FUERTE" },
  { action: "SHOOT", label: "Tirar bola", symbol: "TIRAR" },
];
const tones = { SHOOT: "tap" } as const;
const keys = {
  " ": "SHOOT",
  Enter: "SHOOT",
  "1": "POWER_LOW",
  "2": "POWER_MEDIUM",
  "3": "POWER_HIGH",
};
const hudLabel = (s: Readonly<BilliardsV2State>) =>
  `AVANCE ${s.height} / ${BILLIARDS_V2_RULES.targets} · ${s.shotsLeft} TIROS${s.scratch ? " · BLANCA EMBOCADA" : ""}`;
export default function Billiards(props: GameRuntimeProps) {
  const presentation = useMemo(createPresentation, []);
  return (
    <div className="billiardsVerified">
      <CoreCanvasGame
        {...props}
        core={BILLIARDS_CORE_V2}
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
