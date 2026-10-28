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
  BILLIARDS_CORE_V5,
  isSolid,
  isStripe,
  type BilliardsV5State,
} from "@/lib/verified/billiardsCore.v5";
import { pullBilliardsSling } from "@/lib/billiardsSling";
import CoreCanvasGame, { type CorePoint } from "./CoreCanvasGame";

import { t, formatNumber, useI18n } from "@/lib/i18n";
/** Pool colours: 1/9 yellow, 2/10 blue, 3/11 red, 4/12 purple, 5/13 orange, 6/14 green, 7/15 maroon, 8 black. */
const POOL_COLORS = ["#f6f3ea", "#f5c22f", "#2558c9", "#d8322a", "#6a3aa8", "#f07a1f", "#1d8a4a", "#8a2432", "#141414"];
const colorOf = (id: number) => POOL_COLORS[id === 0 ? 0 : id === 8 ? 8 : ((id - 1) % 8) + 1];

/** A pool ball: solid (full colour), stripe (white with a colour band), the black 8, the white cue ball. */
function drawPoolBall(ctx: CanvasRenderingContext2D, x: number, y: number, id: number, upright: boolean) {
  const r = 10, color = colorOf(id);
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
  if (isStripe(id)) {
    ctx.fillStyle = "#f4f1e8"; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.fillStyle = color; ctx.fillRect(x - r, y - r * 0.55, r * 2, r * 1.1);
  } else { ctx.fillStyle = color; ctx.fillRect(x - r, y - r, r * 2, r * 2); }
  // Shading: soft highlight top-left, darker rim.
  const shade = ctx.createRadialGradient(x - 4, y - 4, 1, x, y, r);
  shade.addColorStop(0, "rgba(255,255,255,.75)"); shade.addColorStop(0.3, "rgba(255,255,255,.08)");
  shade.addColorStop(0.8, "rgba(0,0,0,.12)"); shade.addColorStop(1, "rgba(0,0,0,.45)");
  ctx.fillStyle = shade; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
  if (id) {
    ctx.fillStyle = "#fbfaf4";
    ctx.beginPath(); ctx.arc(x, y, 4.8, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.translate(x, y);
    if (!upright) ctx.rotate(Math.PI / 2);
    ctx.fillStyle = "#111822";
    ctx.textAlign = "center";
    ctx.font = id < 10 ? "bold 7px system-ui" : "bold 6px system-ui";
    ctx.fillText(String(id), 0, 2.4);
    ctx.restore();
  }
}

/** A short aim ray, stopped by the first visible contact; no flight simulation. */
function drawAimGuide(ctx: CanvasRenderingContext2D, s: BilliardsV5State) {
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
  s: BilliardsV5State,
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
  // Target pocket for the 8 (opposite the one the seventh ball dropped into).
  if (s.eightPocket >= 0) {
    const p = BILLIARDS_POCKETS[s.eightPocket], px = p.x / 1000, py = p.y / 1000, pulse = 0.5 + 0.5 * Math.sin(s.tick * 0.12);
    ctx.save();
    ctx.strokeStyle = `rgba(255,214,110,${0.55 + 0.45 * pulse})`; ctx.lineWidth = 3;
    ctx.shadowColor = "#ffd36a"; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.arc(px, py, 24 + pulse * 3, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#141414"; ctx.beginPath(); ctx.arc(px, py, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fbfaf4"; ctx.beginPath(); ctx.arc(px, py, 3.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  if (s.phase === "aim") drawAimGuide(ctx, s);
  const own = s.group === "solids" ? isSolid : s.group === "stripes" ? isStripe : () => false;
  const recommended = s.balls.find((ball) => !ball.potted && (s.ownDown === 7 ? ball.id === 8 : own(ball.id)));
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
    drawPoolBall(ctx, x, y, ball.id, !camera.rotated);
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
  const barY = camera.rotated ? 592 : 452;
  for (let i = 0; i < 13; i++) {
    ctx.fillStyle = i <= s.power ? (s.power > 8 ? "#e5c58b" : "#79d8c3") : "rgba(134,171,187,.2)";
    ctx.fillRect(camera.centerX - 64 + i * 10, barY, 7, 8);
  }
  // Your group: its seven balls (potted ones dimmed), then the 8.
  if (!camera.rotated) {
    const ids = s.group === "solids" ? [1, 2, 3, 4, 5, 6, 7, 8] : s.group === "stripes" ? [9, 10, 11, 12, 13, 14, 15, 8] : [];
    ids.forEach((id, i) => {
      const b = s.balls.find((q) => q.id === id)!, x = camera.centerX - 87 + i * 25, y = 482;
      ctx.globalAlpha = b.potted ? 0.25 : id === 8 && s.ownDown < 7 ? 0.45 : 1;
      drawPoolBall(ctx, x, y, id, true);
      ctx.globalAlpha = 1;
    });
    ctx.fillStyle = "#a9c6d4"; ctx.font = "800 11px system-ui"; ctx.textAlign = "center";
    if (!ids.length) ctx.fillText(t("billiards.openTable"), camera.centerX, 486);
  }
  // Event call-outs (group, fouls, the 8): upright, for ~1.6 s.
  const ev = s.events[s.events.length - 1], age = ev ? s.tick - ev.tick : 999;
  if (ev && age < 200) {
    const text = ev.kind === "group" ? t(ev.group === "solids" ? "billiards.gotSolids" : "billiards.gotStripes")
      : ev.kind === "foul" ? t(ev.reason === "scratch" ? "billiards.foulScratch" : "billiards.foulOther")
      : ev.kind === "eightTarget" ? t("billiards.eightNow")
      : ev.kind === "respotEight" ? t("billiards.eightRespot")
      : ev.kind === "win" ? t("billiards.eightWin")
      : t(ev.reason === "EIGHT_WRONG_POCKET" ? "billiards.eightWrong" : ev.reason === "EIGHT_SCRATCH" ? "billiards.eightScratch" : "billiards.eightEarly");
    const good = ev.kind === "group" || ev.kind === "eightTarget" || ev.kind === "win" || ev.kind === "respotEight";
    ctx.globalAlpha = Math.min(1, (200 - age) / 30);
    ctx.font = "900 15px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const w = Math.min(360, ctx.measureText(text).width + 30), cy2 = camera.rotated ? 40 : 52;
    ctx.fillStyle = "rgba(6,14,30,.88)"; ctx.strokeStyle = good ? "rgba(92,255,176,.6)" : "rgba(255,110,120,.7)"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(camera.centerX - w / 2, cy2 - 17, w, 34, 17); ctx.fill(); ctx.stroke();
    ctx.fillStyle = good ? "#8affc6" : "#ff9aa4"; ctx.fillText(text, camera.centerX, cy2 + 1);
    ctx.globalAlpha = 1; ctx.textBaseline = "alphabetic";
  }
  ctx.restore();
}

/** Slingshot band from where the finger touched down to where it is now (screen space). */
function drawSling(ctx: CanvasRenderingContext2D, from: CorePoint, to: CorePoint) {
  const len = Math.hypot(to.x - from.x, to.y - from.y);
  if (len < 4) return;
  ctx.save();
  ctx.strokeStyle = "rgba(143,227,255,.55)"; ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
  ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = "rgba(143,227,255,.8)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(from.x, from.y, 9, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = "rgba(229,197,139,.9)"; ctx.beginPath(); ctx.arc(to.x, to.y, 6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function createPresentation() {
  let camera = getBilliardsCamera({ width: 390, height: 620 });
  let viewportKey = "";
  // Slingshot: world point where the finger touched down (anywhere), plus both screen points for the band.
  let drag: { from: { x: number; y: number }; screenFrom: CorePoint; screenNow: CorePoint } | null = null;
  return {
    clear() { drag = null; },
    render(
      ctx: CanvasRenderingContext2D,
      state: BilliardsV5State,
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
      if (drag && state.phase === "aim") drawSling(ctx, drag.screenFrom, drag.screenNow);
    },
    pointAction(
      point: CorePoint,
      phase: "down" | "move" | "up",
      state: BilliardsV5State,
    ) {
      const p = unprojectBilliardsPoint(camera, point);
      if (state.phase !== "aim") { drag = null; return null; }
      if (phase === "down") {
        const cue = state.balls[0];
        // The pull can start anywhere: there is always room, even with the cue ball against a cushion.
        drag = cue && !cue.potted ? { from: p, screenFrom: point, screenNow: point } : null;
        return null;
      }
      if (!drag) return null;
      drag.screenNow = point;
      const actions = pullBilliardsSling(drag.from, p);
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
const hudLabel = (s: Readonly<BilliardsV5State>) => {
  const base = s.group === "open" ? t("billiards.hudOpen", { shots: s.shotsLeft })
    : s.ownDown === 7 ? t("billiards.hudEight", { shots: s.shotsLeft })
    : t(s.group === "solids" ? "billiards.hudSolids" : "billiards.hudStripes", { n: s.ownDown, shots: s.shotsLeft });
  return `${base}${s.scratch ? ` · ${t("billiards.scratch")}` : ""}`;
};
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
        core={BILLIARDS_CORE_V5}
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
