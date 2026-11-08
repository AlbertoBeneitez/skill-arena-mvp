"use client";
import type { GameRuntimeProps } from "@/lib/games";
import { drawSpaceBackdrop } from "@/lib/spaceBackdrop";
import {
  PINBALL_CORE_V11,
  PINBALL_INLANES_V11,
  PINBALL_LSPINNER_V11,
  pinballUpperTipV11,
  PINBALL_DROPS_V11,
  PINBALL_LANES_V11,
  PINBALL_POSTS_V11,
  PINBALL_RTARGETS_V11,
  PINBALL_RULES_V11,
  PINBALL_SAUCER_V11,
  PINBALL_SLINGS_V11,
  PINBALL_SPINNER_V11,
  PINBALL_TARGETS_V11,
  PINBALL_WALLS_V11,
  pinballBumpersV11,
  pinballChargeLevelV11,
  pinballFlipperTipV11,
  pinballFrenzyV11,
  pinballTubePointV11,
  pinballTubeLengthV11,
  PINBALL_TUBES_V11,
  PINBALL_WORMHOLE_V11,
  type PinballStateV11,
} from "@/lib/verified/pinballCore.v11";
import CoreCanvasGame, { type CorePoint } from "./CoreCanvasGame";
import type { ScoreCell } from "../GameScoreboard";

import { t as tx, formatNumber, useI18n, type MessageKey } from "@/lib/i18n";
/*
 * Presentation only. Everything here reads the authoritative state and never
 * changes it: a classic space-themed table (chrome rails, printed playfield,
 * lamp inserts, pop bumpers with their values, drop targets, shooter lane,
 * apron). V11: the score lives in the shared scoreboard (no dot-matrix display).
 * Static art is cached once per layout and scale.
 */

const W = 390, H = 620;
const k = (v: number) => v / 1000;
const R = PINBALL_RULES_V11;
const BUMPER_COLORS = [
  ["#ff5a7a", "#a3173a"],
  ["#ffc94a", "#a86a00"],
  ["#5ad1ff", "#145b9e"],
  ["#8dff8a", "#1f7a2b"],
  ["#c08cff", "#5a2aa3"],
  ["#5cf0d8", "#0f7a6c"], // V11: the small sixth bumper by the saucer
] as const;
const LANE_LETTERS = ["A", "B", "C"];

// ---------- static art (cached) ----------
let artCache: { key: string; canvas: HTMLCanvasElement } | null = null;

function tableOutline(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  ctx.moveTo(18, 640); ctx.lineTo(18, 140); ctx.lineTo(46, 70); ctx.lineTo(110, 42); ctx.lineTo(290, 42);
  ctx.lineTo(372, 124); ctx.lineTo(372, 640);
  ctx.closePath();
}

function chromeLine(ctx: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, width = 7) {
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(0,0,0,.55)";
  ctx.lineWidth = width + 3;
  ctx.beginPath(); ctx.moveTo(ax + 1.5, ay + 2); ctx.lineTo(bx + 1.5, by + 2); ctx.stroke();
  ctx.strokeStyle = "#5f7387";
  ctx.lineWidth = width;
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
  ctx.strokeStyle = "#dfe9f3";
  ctx.lineWidth = Math.max(1.5, width * 0.32);
  ctx.beginPath(); ctx.moveTo(ax - 0.8, ay - 0.8); ctx.lineTo(bx - 0.8, by - 0.8); ctx.stroke();
}

function drawStaticArt(ctx: CanvasRenderingContext2D, layout: number) {
  // Playfield floor: deep indigo with printed nebulae.
  ctx.save();
  tableOutline(ctx);
  ctx.clip();
  const floor = ctx.createLinearGradient(0, 40, 0, 640);
  floor.addColorStop(0, "#160f3d");
  floor.addColorStop(0.45, "#0b1a46");
  floor.addColorStop(1, "#06102a");
  ctx.fillStyle = floor;
  ctx.fillRect(0, 0, W, H);
  for (const [x, y, r, c] of [
    [90, 210, 150, "rgba(170,60,220,.30)"],
    [300, 330, 170, "rgba(30,170,220,.22)"],
    [190, 520, 160, "rgba(255,110,60,.12)"],
  ] as const) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, c);
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  // Printed stars (fixed pattern, no RNG).
  for (let i = 0; i < 90; i++) {
    const x = 20 + ((i * 137) % 350), y = 46 + ((i * 251) % 590);
    ctx.globalAlpha = 0.25 + (i % 5) * 0.12;
    ctx.fillStyle = i % 7 === 0 ? "#ffe9a6" : "#cfe6ff";
    ctx.fillRect(x, y, i % 9 === 0 ? 2 : 1, i % 9 === 0 ? 2 : 1);
  }
  ctx.globalAlpha = 1;
  // Printed planet with ring behind the bumper field.
  ctx.save();
  ctx.translate(196, 232);
  const planet = ctx.createRadialGradient(-26, -26, 8, 0, 0, 70);
  planet.addColorStop(0, "rgba(120,140,255,.38)");
  planet.addColorStop(0.7, "rgba(60,40,150,.28)");
  planet.addColorStop(1, "rgba(20,10,60,0)");
  ctx.fillStyle = planet;
  ctx.beginPath(); ctx.arc(0, 0, 70, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(-0.35);
  ctx.strokeStyle = "rgba(180,200,255,.22)";
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.ellipse(0, 0, 112, 26, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  // Printed lane guides (decorative lines).
  ctx.strokeStyle = "rgba(140,200,255,.12)";
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 6]);
  for (const [ax, ay, bx, by] of [[46, 470, 112, 540], [322, 470, 278, 540], [70, 120, 120, 330], [320, 120, 270, 330]]) {
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
  }
  ctx.setLineDash([]);
  // Centre emblem ring under the multiplier lamps.
  ctx.strokeStyle = "rgba(255,210,120,.22)";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(195, 476, 36, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
  ctx.strokeStyle = "rgba(255,210,120,.12)";
  ctx.beginPath(); ctx.arc(195, 476, 46, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
  // V11 · Printed inserts (art only, no walls): a segmented ring round the centre emblem, chevron strips aimed at
  // each shot (left ramp, wormhole, upper flipper, saucer, orbit), a kicker plate under the upper flipper and
  // starbursts behind the bumper field.
  {
    const ringC = ["rgba(127,227,238,.28)", "rgba(199,155,255,.26)", "rgba(255,211,106,.26)", "rgba(255,111,216,.24)"];
    for (let i = 0; i < 16; i++) {
      ctx.strokeStyle = ringC[i % 4]; ctx.lineWidth = 7;
      const a0 = Math.PI * (0.98 + i * 0.065), a1 = a0 + Math.PI * 0.05;
      ctx.beginPath(); ctx.arc(195, 476, 60, a0, a1); ctx.stroke();
    }
    ctx.strokeStyle = "rgba(255,255,255,.08)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(195, 476, 66, Math.PI * 0.98, Math.PI * 2.02); ctx.stroke();
    // Kicker plate under the upper flipper pivot.
    const plate = ctx.createLinearGradient(300, 340, 346, 372);
    plate.addColorStop(0, "rgba(92,240,216,.05)"); plate.addColorStop(1, "rgba(92,240,216,.22)");
    ctx.fillStyle = plate;
    ctx.beginPath(); ctx.moveTo(346, 328); ctx.lineTo(346, 378); ctx.lineTo(292, 384); ctx.closePath(); ctx.fill();
    // Starbursts behind the bumpers.
    for (const p of pinballBumpersV11(layout)) {
      const x = k(p.x), y = k(p.y), r = k(p.r) + 14;
      ctx.strokeStyle = "rgba(255,255,255,.06)"; ctx.lineWidth = 1;
      for (let n = 0; n < 12; n++) {
        const a = (n / 12) * Math.PI * 2;
        ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * (r - 8), y + Math.sin(a) * (r - 8)); ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); ctx.stroke();
      }
    }
  }
  // Shooter lane floor.
  const lane = ctx.createLinearGradient(346, 0, 372, 0);
  lane.addColorStop(0, "#070d22");
  lane.addColorStop(0.5, "#121f45");
  lane.addColorStop(1, "#070d22");
  ctx.fillStyle = lane;
  ctx.fillRect(346, 150, 26, 470);
  // Apron plates below the inlane guides.
  const apron = ctx.createLinearGradient(0, 470, 0, 640);
  apron.addColorStop(0, "#2b3550");
  apron.addColorStop(1, "#141a2c");
  ctx.fillStyle = apron;
  ctx.beginPath(); ctx.moveTo(18, 474); ctx.lineTo(112, 556); ctx.lineTo(150, 640); ctx.lineTo(18, 640); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(346, 474); ctx.lineTo(278, 556); ctx.lineTo(240, 640); ctx.lineTo(346, 640); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.05)";
  for (let y = 520; y < 640; y += 6) ctx.fillRect(18, y, 328, 1);
  ctx.fillStyle = "rgba(255,210,140,.55)";
  ctx.font = "800 9px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("GALACTIC", 62, 600);
  ctx.fillText("PINBALL", 302, 600);
  ctx.restore();

  // Chrome rails along every wall.
  for (const w of PINBALL_WALLS_V11) chromeLine(ctx, k(w.ax), k(w.ay), k(w.bx), k(w.by), 7);
  // Cabinet side rails (outside the playfield).
  for (const x of [8, 382]) {
    const rail = ctx.createLinearGradient(x - 8, 0, x + 8, 0);
    rail.addColorStop(0, "#1b2433");
    rail.addColorStop(0.5, "#8fa3b8");
    rail.addColorStop(1, "#1b2433");
    ctx.fillStyle = rail;
    ctx.fillRect(x - 6, 120, 12, 500);
  }
  // Lane letters and drop-bank number plates.
  ctx.font = "900 10px system-ui";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,.55)";
  // V11: the lane letters sit inside their lamps (drawn with them), clear of the bumpers.
  // Kickers (slings) and posts get a rubber ring.
  for (const p of [...PINBALL_SLINGS_V11, ...PINBALL_POSTS_V11]) {
    ctx.fillStyle = "rgba(0,0,0,.45)";
    ctx.beginPath(); ctx.arc(k(p.x) + 1.5, k(p.y) + 2.5, k(p.r) + 3, 0, Math.PI * 2); ctx.fill();
  }
  // Bumper skirts (the coloured bodies are dynamic).
  for (const p of pinballBumpersV11(layout)) {
    ctx.fillStyle = "rgba(0,0,0,.5)";
    ctx.beginPath(); ctx.arc(k(p.x) + 3, k(p.y) + 5, k(p.r) + 5, 0, Math.PI * 2); ctx.fill();
  }
  // V11: each post's value printed beside it (lane separators above, field posts below).
  ctx.font = "800 7.5px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (const p of PINBALL_POSTS_V11) {
    const top = k(p.y) < 120, x = k(p.x), y = k(p.y) + (top ? -11 : k(p.r) + 9);
    ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.beginPath(); ctx.roundRect(x - 9, y - 5.5, 18, 11, 5.5); ctx.fill();
    ctx.fillStyle = "#9feaf5"; ctx.fillText(String(p.points), x, y + 0.5);
  }
  ctx.textBaseline = "alphabetic";
  // The dot-matrix display (with its housing) is drawn per frame by drawDmd, wherever there is room.
}

function staticArt(ctx: CanvasRenderingContext2D, layout: number) {
  const scale = Math.max(1, Math.min(3, Math.abs(ctx.getTransform().a) || 1));
  const key = `${layout}:${scale.toFixed(2)}`;
  if (!artCache || artCache.key !== key) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(W * scale);
    canvas.height = Math.round(H * scale);
    const c = canvas.getContext("2d");
    if (c) {
      c.scale(scale, scale);
      drawStaticArt(c, layout);
    }
    artCache = { key, canvas };
  }
  return artCache.canvas;
}

// ---------- dynamic pieces ----------
function lamp(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, on: boolean, glow = 12) {
  ctx.fillStyle = on ? color : "rgba(255,255,255,.08)";
  ctx.strokeStyle = on ? "rgba(255,255,255,.75)" : "rgba(255,255,255,.18)";
  ctx.lineWidth = 1.2;
  if (on) { ctx.shadowColor = color; ctx.shadowBlur = glow; }
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;
}

function arrowLamp(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, color: string, on: boolean) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = on ? color : "rgba(255,255,255,.07)";
  ctx.strokeStyle = on ? "rgba(255,255,255,.8)" : "rgba(255,255,255,.16)";
  ctx.lineWidth = 1.2;
  if (on) { ctx.shadowColor = color; ctx.shadowBlur = 14; }
  ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(9, 5); ctx.lineTo(0, 1); ctx.lineTo(-9, 5); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.restore();
}

function flipper(ctx: CanvasRenderingContext2D, s: PinballStateV11, side: "left" | "right" | "upper") {
  const angle = side === "left" ? s.left : s.right,
    held = side === "left" ? s.leftHeld : s.rightHeld,
    tip = side === "upper" ? pinballUpperTipV11(angle) : pinballFlipperTipV11(side, angle);
  const thick = side === "upper" ? 7.5 : 9;
  const px = k(tip.pivot.x), py = k(tip.pivot.y), tx = k(tip.x), ty = k(tip.y);
  const len = Math.hypot(tx - px, ty - py) || 1, nx = -(ty - py) / len, ny = (tx - px) / len;
  const bat = (ox: number, oy: number) => {
    ctx.beginPath();
    ctx.moveTo(px + nx * thick + ox, py + ny * thick + oy);
    ctx.lineTo(tx + nx * 5 + ox, ty + ny * 5 + oy);
    ctx.arc(tx + ox, ty + oy, 5, Math.atan2(ny, nx), Math.atan2(-ny, -nx));
    ctx.lineTo(px - nx * thick + ox, py - ny * thick + oy);
    ctx.arc(px + ox, py + oy, thick, Math.atan2(-ny, -nx), Math.atan2(ny, nx));
    ctx.closePath();
  };
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,.45)";
  bat(2, 4); ctx.fill();
  const g = ctx.createLinearGradient(px, py - 9, px, py + 9);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(1, "#c9d6e3");
  ctx.fillStyle = g;
  if (held) { ctx.shadowColor = "#ffd36a"; ctx.shadowBlur = 16; }
  bat(0, 0); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = side === "upper" ? (held ? "#bff9ef" : "#20b8a6") : held ? "#ff8a3d" : "#e2374f";
  ctx.lineWidth = 3;
  bat(0, 0); ctx.stroke();
  ctx.fillStyle = "#9aa9b8";
  ctx.beginPath(); ctx.arc(px, py, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawBall(ctx: CanvasRenderingContext2D, s: PinballStateV11, scale = 1, b: { x: number; y: number; vx: number; vy: number } = s.ball) {
  const x = k(b.x), y = k(b.y);
  const sp = Math.hypot(b.vx, b.vy);
  if (scale < 1) { ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale); ctx.translate(-x, -y); ctx.globalAlpha = Math.max(0.2, scale); }
  if (sp > 220000 && scale === 1) {
    const ux = b.vx / sp, uy = b.vy / sp;
    for (let i = 1; i <= 4; i++) {
      ctx.fillStyle = `rgba(150,220,255,${0.16 - i * 0.03})`;
      ctx.beginPath(); ctx.arc(x - ux * i * 7, y - uy * i * 7, 9 - i, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.fillStyle = "rgba(0,0,0,.4)";
  ctx.beginPath(); ctx.ellipse(x + 3, y + 5, 9, 7, 0, 0, Math.PI * 2); ctx.fill();
  const g = ctx.createRadialGradient(x - 3, y - 4, 1, x, y, 10);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.35, "#dfe8f1");
  g.addColorStop(0.75, "#7f93a8");
  g.addColorStop(1, "#3a4a5c");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill();
  // Reflection of the playfield lights.
  ctx.fillStyle = "rgba(255,120,170,.35)";
  ctx.beginPath(); ctx.ellipse(x + 3, y + 4, 3.5, 1.6, -0.6, 0, Math.PI * 2); ctx.fill();
  if (scale < 1) ctx.restore();
}

const CALLOUT_KEYS = {
  SKILL: ["pinball.skill", "#ffe082"], JACKPOT: ["pinball.jackpot", "#ffd27a"], DROPS: ["pinball.drops", "#ff9d5c"],
  LANES: ["", "#9fffb8"], TARGETS: ["pinball.targets", "#9fffb8"], RAMP: ["pinball.ramp", "#8fe3ff"], ORBIT: ["pinball.orbit", "#8fe3ff"],
  SAUCERLIT: ["pinball.saucer", "#ffe082"], COMBO: ["pinball.combo", "#ff9d5c"], DRAIN: ["pinball.drain", "#ff8a8a"], BONUS: ["pinball.bonus", "#ffe082"],
  FLICK: ["pinball.flick", "#d5f3ff"],
  MISSION: ["pinball.mission", "#9fffb8"], EXTRATIME: ["pinball.extraTime", "#7cffd8"], HURRY: ["pinball.hurry", "#ffd36a"],
  HURRYGO: ["pinball.hurryGo", "#ffe082"], SAVED: ["pinball.saved", "#8fe3ff"], FRENZY: ["pinball.frenzy", "#ff6fd8"],
  RAIL: ["pinball.rail", "#9fe8ff"], WORMHOLE: ["pinball.wormhole", "#c79bff"],
  LOCKLIT: ["pinball.lockLit", "#7cffd8"], LOCK: ["pinball.lock", "#7cffd8"], MULTIBALL: ["pinball.multiball", "#ff6fd8"],
  SUPERLIT: ["pinball.superLit", "#c79bff"], SUPER: ["pinball.super", "#ffe082"], MBEND: ["pinball.mbEnd", "#ffb03a"],
  RUSH: ["pinball.rush", "#ff9dff"], MODE0: ["pinball.mode0", "#ff9dff"], MODE1: ["pinball.mode1", "#ff9dff"],
  MODE2: ["pinball.mode2", "#ff9dff"], MODEEND: ["pinball.modeEnd", "#ffb03a"],
  INLANES: ["pinball.inlanes", "#5cf0d8"],
} as const;
const MODE_KEYS = ["pinball.mode0", "pinball.mode1", "pinball.mode2"] as const;
/** Call-out text in the active language (A-B-C is the same everywhere). */
const CALLOUTS = new Proxy({} as Record<string, [string, string] | undefined>, {
  get(_, kind: string) {
    const entry = (CALLOUT_KEYS as Record<string, readonly [string, string]>)[kind];
    if (!entry) return undefined;
    return [entry[0] ? tx(entry[0] as MessageKey) : "A-B-C", entry[1]];
  },
});
const BIG = new Set(["SKILL", "JACKPOT", "DROPS", "BONUS", "DRAIN", "MISSION", "EXTRATIME", "HURRYGO", "SAVED", "FRENZY", "WORMHOLE", "MULTIBALL", "SUPER", "LOCK", "MODE0", "MODE1", "MODE2", "INLANES"]);

/** Rows reserved above the table for the shared scoreboard (presentation only). */
const SCORE_INSET = 54;

/** Points every `step` px along a passage with unit tangent and normal (static geometry, cached per tube). */
const railSamples = new Map<number, { x: number; y: number; tx: number; ty: number; nx: number; ny: number; d: number }[]>();
function samplesFor(tube: number, step = 6) {
  const hit = railSamples.get(tube);
  if (hit) return hit;
  const total = pinballTubeLengthV11(tube), out: { x: number; y: number; tx: number; ty: number; nx: number; ny: number; d: number }[] = [];
  for (let d = 0; d <= total; d += step * 1000) {
    const a = pinballTubePointV11(tube, Math.max(0, d - 3000)), b = pinballTubePointV11(tube, Math.min(total, d + 3000)), p = pinballTubePointV11(tube, d);
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    out.push({ x: k(p.x), y: k(p.y), tx: dx / len, ty: dy / len, nx: -dy / len, ny: dx / len, d: d / total });
  }
  railSamples.set(tube, out);
  return out;
}
const RAIL_HUES = [[127, 227, 238], [199, 155, 255], [255, 111, 216], [255, 210, 122]] as const;
const railHue = (u: number) => {
  const f = ((u % 1) + 1) % 1 * RAIL_HUES.length, i = Math.floor(f), w = f - i, a = RAIL_HUES[i], b = RAIL_HUES[(i + 1) % RAIL_HUES.length];
  return `${Math.round(a[0] + (b[0] - a[0]) * w)},${Math.round(a[1] + (b[1] - a[1]) * w)},${Math.round(a[2] + (b[2] - a[2]) * w)}`;
};
/**
 * Showy habitrail dressing (presentation only): an energy stream flowing inside the acrylic, LED strips on both
 * chrome rails cycling through the table colours, chrome clamps with bolts and direction chevrons that chase toward
 * the exit. Everything speeds up and brightens while the rail is lit.
 */
function railDecor(ctx: CanvasRenderingContext2D, tube: number, t: number, lit: boolean, under: boolean) {
  const pts = samplesFor(tube), n = pts.length, speed = lit ? 0.03 : 0.008;
  ctx.save();
  if (under) {
    // Energy stream inside the tube.
    ctx.lineCap = "round";
    for (let i = 1; i < n; i++) {
      const a = pts[i - 1], b = pts[i], wave = 0.5 + 0.5 * Math.sin(a.d * 26 - t * (lit ? 0.5 : 0.16));
      ctx.strokeStyle = `rgba(${railHue(a.d - t * speed)},${(lit ? 0.5 : 0.3) + wave * (lit ? 0.35 : 0.2)})`;
      ctx.lineWidth = 4 + wave * 2;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    ctx.restore();
    return;
  }
  // Chrome clamps every ~48 px (two bolts each).
  for (let i = 4; i < n - 2; i += 8) {
    const p = pts[i], w = 10.5;
    ctx.strokeStyle = "#2b3644"; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(p.x - p.nx * w, p.y - p.ny * w); ctx.lineTo(p.x + p.nx * w, p.y + p.ny * w); ctx.stroke();
    ctx.strokeStyle = "#dfe9f4"; ctx.lineWidth = 2.2; ctx.stroke();
    ctx.fillStyle = "#8ea2b8";
    for (const sgn of [-1, 1]) { ctx.beginPath(); ctx.arc(p.x + p.nx * w * sgn, p.y + p.ny * w * sgn, 1.8, 0, Math.PI * 2); ctx.fill(); }
  }
  // LED strips just outside both rails.
  for (let i = 0; i < n; i += 2) {
    const p = pts[i], phase = (p.d * 40 - t * (lit ? 0.9 : 0.25)) % 4, on = phase > -1 && phase < 1.2 ? 1 : 0.28;
    const col = railHue(p.d * 2 - t * speed);
    for (const sgn of [-1, 1]) {
      const lx = p.x + p.nx * 9.5 * sgn, ly = p.y + p.ny * 9.5 * sgn;
      if (on === 1) { ctx.fillStyle = `rgba(${col},.28)`; ctx.beginPath(); ctx.arc(lx, ly, 4.2, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = on === 1 ? `rgb(${col})` : `rgba(${col},.4)`;
      ctx.beginPath(); ctx.arc(lx, ly, on === 1 ? 2.1 : 1.4, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Chevrons pointing to the exit, chasing along the tube.
  for (let i = 6; i < n - 3; i += 10) {
    const p = pts[i], k2 = ((i / 10 - t * (lit ? 0.4 : 0.12)) % 6 + 6) % 6, a = k2 < 1 ? 0.95 : 0.25;
    ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = 1.6;
    const bx = p.x - p.tx * 3, by = p.y - p.ty * 3;
    ctx.beginPath();
    ctx.moveTo(bx + p.nx * 4 - p.tx * 3, by + p.ny * 4 - p.ty * 3); ctx.lineTo(bx + p.tx * 2, by + p.ty * 2); ctx.lineTo(bx - p.nx * 4 - p.tx * 3, by - p.ny * 4 - p.ty * 3);
    ctx.stroke();
  }
  // Exit ring.
  const e = pts[n - 1], pulse = 0.5 + 0.5 * Math.sin(t * (lit ? 0.4 : 0.1));
  ctx.strokeStyle = `rgba(${railHue(-t * speed)},${0.5 + 0.5 * pulse})`; ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.ellipse(e.x, e.y, 10, 10, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

/** Habitrail: shadow, translucent acrylic tube and two chrome rails following the passage path. While the ball rides,
 * it is drawn inside the tube (under the rails and the acrylic sheen) at its real position, so the entry is seamless. */
function habitrail(ctx: CanvasRenderingContext2D, tube: number, t: number, lit: boolean, rider: PinballStateV11 | null) {
  const path = PINBALL_TUBES_V11[tube].path.map((p) => ({ x: k(p.x), y: k(p.y) }));
  const trace = (dx: number, dy: number) => { ctx.beginPath(); path.forEach((p, i) => (i ? ctx.lineTo(p.x + dx, p.y + dy) : ctx.moveTo(p.x + dx, p.y + dy))); };
  ctx.save();
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  trace(5, 8); ctx.strokeStyle = "rgba(0,0,0,.35)"; ctx.lineWidth = 16; ctx.stroke();
  trace(0, 0); ctx.strokeStyle = lit ? "rgba(140,230,255,.32)" : "rgba(160,200,255,.14)"; ctx.lineWidth = 16; ctx.stroke();
  railDecor(ctx, tube, t, lit, true);
  // Entrance mouth: a flared chrome funnel the ball rolls straight into.
  {
    const a = path[0], b = path[1], ang = Math.atan2(b.y - a.y, b.x - a.x);
    ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(ang);
    const g = ctx.createLinearGradient(-10, 0, 12, 0);
    g.addColorStop(0, "rgba(10,20,40,.0)"); g.addColorStop(1, "rgba(10,20,40,.55)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(-12, -13); ctx.lineTo(8, -8); ctx.lineTo(8, 8); ctx.lineTo(-12, 13); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#e9f2fb"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-12, -13); ctx.lineTo(8, -7.5); ctx.moveTo(-12, 13); ctx.lineTo(8, 7.5); ctx.stroke();
    ctx.restore();
  }
  if (rider) {
    ctx.save(); ctx.shadowColor = "#9fe8ff"; ctx.shadowBlur = 14; drawBall(ctx, rider); ctx.restore();
    // Acrylic sheen over the ball: it is inside the tube.
    trace(0, 0); ctx.strokeStyle = "rgba(200,240,255,.16)"; ctx.lineWidth = 15; ctx.stroke();
  }
  for (const off of [-6.5, 6.5]) {
    ctx.beginPath();
    path.forEach((p, i) => {
      const q = path[Math.min(path.length - 1, i + 1)], o = path[Math.max(0, i - 1)];
      const dx = q.x - o.x, dy = q.y - o.y, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
      i ? ctx.lineTo(p.x + nx * off, p.y + ny * off) : ctx.moveTo(p.x + nx * off, p.y + ny * off);
    });
    ctx.strokeStyle = "#5f7387"; ctx.lineWidth = 3; ctx.stroke();
    ctx.strokeStyle = "#e9f2fb"; ctx.lineWidth = 1.2; ctx.stroke();
  }
  railDecor(ctx, tube, t, lit, false);
  // Chase lights along the rail when it was just used (or while riding).
  if (lit) {
    for (let i = 0; i < 24; i++) {
      const d = ((i / 24) * 1 + t * 0.01) % 1;
      const p = pinballTubePointV11(tube, Math.round(d * pinballTubeLengthV11(tube)));
      ctx.fillStyle = i % 2 ? "#9fe8ff" : "#ffffff";
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 0.3 + i);
      ctx.beginPath(); ctx.arc(k(p.x), k(p.y), 1.6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
/** Wormhole scoop: rotating spiral vortex with a lamp ring. */
function wormhole(ctx: CanvasRenderingContext2D, t: number, active: boolean) {
  const x = k(PINBALL_WORMHOLE_V11.x), y = k(PINBALL_WORMHOLE_V11.y), r = k(PINBALL_WORMHOLE_V11.r) + 6;
  ctx.save();
  const g = ctx.createRadialGradient(x, y, 1, x, y, r + 6);
  g.addColorStop(0, "#000"); g.addColorStop(0.55, "#2a0f5a"); g.addColorStop(1, "rgba(120,80,255,0)");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r + 6, 0, Math.PI * 2); ctx.fill();
  ctx.translate(x, y); ctx.rotate(t * (active ? 0.25 : 0.06));
  for (let arm = 0; arm < 4; arm++) {
    ctx.rotate(Math.PI / 2);
    ctx.strokeStyle = arm % 2 ? "rgba(199,155,255,.8)" : "rgba(127,227,238,.8)"; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let q = 0; q <= 20; q++) { const a = q * 0.18, rr = 2 + q * (r / 20); q ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(0, 0); }
    ctx.stroke();
  }
  ctx.restore();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    lamp(ctx, x + Math.cos(a) * (r + 7), y + Math.sin(a) * (r + 7), 2, "#c79bff", active || (Math.floor(t / 6) + i) % 5 === 0, 8);
  }
}

/** V11 · Arrow inserts aimed at each shot: three chevrons on a dark insert; they chase toward the shot while it is lit
 * (hurry-up, multiball, super jackpot, an open combo or a half-lit inlane pair) and glow dimly otherwise. */
const SHOT_STRIPS = [
  { from: [92, 306], to: [54, 246], color: "#5ad1ff" }, // left ramp
  { from: [216, 366], to: [256, 318], color: "#c79bff" }, // wormhole
  { from: [246, 440], to: [290, 398], color: "#5cf0d8" }, // upper flipper
  { from: [296, 268], to: [318, 214], color: "#5ad1ff" }, // orbit
  { from: [270, 208], to: [298, 164], color: "#ffd36a" }, // saucer
] as const;
function shotStrip(ctx: CanvasRenderingContext2D, i: number, on: boolean, t: number) {
  const { from, to, color } = SHOT_STRIPS[i], a = Math.atan2(to[1] - from[1], to[0] - from[0]);
  for (let n = 0; n < 3; n++) {
    const f = n / 2, x = from[0] + (to[0] - from[0]) * f, y = from[1] + (to[1] - from[1]) * f;
    const lit = on && Math.floor(t / 8) % 3 === n;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a + Math.PI / 2);
    ctx.fillStyle = "rgba(0,0,0,.45)";
    ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(10, 5); ctx.lineTo(0, 1); ctx.lineTo(-10, 5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = lit ? color : on ? `${color}88` : `${color}33`;
    if (lit) { ctx.shadowColor = color; ctx.shadowBlur = 12; }
    ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(8, 4); ctx.lineTo(0, 0.5); ctx.lineTo(-8, 4); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}
/** V11: left spinner at the mouth of the left habitrail (drawn over the rail art; a framed plate that turns with its
 * spin count, and its value). */
function leftSpinner(ctx: CanvasRenderingContext2D, s: PinballStateV11) {
  const sp = PINBALL_LSPINNER_V11, cx = k(sp.x0 + sp.x1) / 2, cy = k(sp.y0 + sp.y1) / 2, a = s.lSpins * 1.1;
  ctx.strokeStyle = "rgba(200,220,255,.4)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx - 16, cy - 8); ctx.lineTo(cx + 16, cy - 8); ctx.stroke();
  const w = 15 * Math.abs(Math.cos(a)), hgt = 4 + 4 * Math.abs(Math.sin(a));
  const g = ctx.createLinearGradient(cx - w, 0, cx + w, 0);
  g.addColorStop(0, "#5f7387"); g.addColorStop(0.5, "#f2f7fc"); g.addColorStop(1, "#5f7387");
  ctx.fillStyle = g; ctx.fillRect(cx - w, cy - hgt / 2, w * 2, hgt);
  ctx.fillStyle = "rgba(90,209,255,.85)"; if (w > 5) ctx.fillRect(cx - w * 0.6, cy - 1, w * 1.2, 2);
  ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.beginPath(); ctx.roundRect(cx - 10, cy + 8, 20, 10, 5); ctx.fill();
  ctx.fillStyle = "#9feaf5"; ctx.font = "800 7px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(String(R.leftSpinnerPoints), cx, cy + 13.5); ctx.textBaseline = "alphabetic";
}

export function renderPinball(ctx: CanvasRenderingContext2D, s: PinballStateV11) {
  drawSpaceBackdrop(ctx, W, H, s.tick * 0.02, s.tick);
  ctx.drawImage(staticArt(ctx, s.layout), 0, 0, W, H);
  const t = s.tick, idle = s.phase !== "play";
  const chase = Math.floor(t / 6);

  // Time bar along the top arch (green → red).
  {
    const left = Math.max(0, (s.endTick - t) / s.endTick);
    ctx.strokeStyle = "rgba(255,255,255,.08)";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(112, 48); ctx.lineTo(288, 48); ctx.stroke();
    ctx.strokeStyle = left > 0.25 ? "#5cf0c0" : "#ff5a7a";
    ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.moveTo(112, 48); ctx.lineTo(112 + 176 * left, 48); ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // Rollover lanes A-B-C with skill-shot flashing.
  const skillOpen = s.launchTick >= 0 && !s.skillDone && t - s.launchTick <= R.skillWindowTicks;
  PINBALL_LANES_V11.forEach((l, i) => {
    const nextSkill = s.phase === "lane" && !s.skillDone && s.launches % 3 === i;
    const skill = (skillOpen && s.skillLane === i) || nextSkill;
    const on = s.lanes[i] > 0 || (skill && chase % 2 === 0) || (idle && (chase + i) % 3 === 0 && s.launchTick < 0);
    lamp(ctx, k(l.x), k(l.y), 8, skill ? "#ffe082" : "#7cffb0", on);
    ctx.fillStyle = on ? "#0b2414" : "rgba(255,255,255,.6)";
    ctx.font = "900 9px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(LANE_LETTERS[i], k(l.x), k(l.y) + 0.5);
    ctx.textBaseline = "alphabetic";
  });
  // Spinner: striped plate whose visible width follows the spin counter.
  {
    const sp = PINBALL_SPINNER_V11, cx = k(sp.x0 + sp.x1) / 2, cy = k(sp.y0 + sp.y1) / 2, a = s.spins * 1.1;
    ctx.strokeStyle = "rgba(200,220,255,.35)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - 26, cy - 10); ctx.lineTo(cx + 26, cy - 10); ctx.stroke();
    const w = 24 * Math.abs(Math.cos(a)), hgt = 5 + 5 * Math.abs(Math.sin(a));
    const g = ctx.createLinearGradient(cx - w, 0, cx + w, 0);
    g.addColorStop(0, "#7c8ea3"); g.addColorStop(0.5, "#f2f7fc"); g.addColorStop(1, "#7c8ea3");
    ctx.fillStyle = g;
    ctx.fillRect(cx - w, cy - hgt / 2, w * 2, hgt);
    ctx.fillStyle = "rgba(255,80,110,.8)";
    if (w > 6) ctx.fillRect(cx - w * 0.6, cy - 1, w * 1.2, 2);
  }
  // V11: inlane rollovers on the guides (lit once passed; both → 2500 and a ball save).
  PINBALL_INLANES_V11.forEach((l, i) => {
    const x = k(l.x), y = k(l.y), on = s.inlanes[i] > 0, flash = t - s.inlaneFlash[i] < 16;
    ctx.fillStyle = "rgba(0,0,0,.5)"; ctx.beginPath(); ctx.roundRect(x - 9, y - 5, 18, 10, 5); ctx.fill();
    ctx.fillStyle = on || flash ? "#5cf0d8" : "rgba(255,255,255,.12)";
    if (on) { ctx.shadowColor = "#5cf0d8"; ctx.shadowBlur = 10; }
    ctx.beginPath(); ctx.roundRect(x - 7, y - 3, 14, 6, 3); ctx.fill(); ctx.shadowBlur = 0;
  });
  // Saucer with chasing ring lamps when lit.
  {
    const c = PINBALL_SAUCER_V11, cx = k(c.x), cy = k(c.y);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      lamp(ctx, cx + Math.cos(a) * 22, cy + Math.sin(a) * 22, 2.6, s.lockLit ? "#7cffd8" : "#ffd36a", (s.saucerLit > 0 || s.lockLit > 0) && (chase + i) % 4 < 2, 8);
    }
    const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, 15);
    g.addColorStop(0, "#000"); g.addColorStop(0.7, "#141a2c"); g.addColorStop(1, "#5f7387");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = s.lockLit ? "#7cffd8" : s.saucerLit ? "#ffe082" : "#9aa9b8"; ctx.lineWidth = 2; ctx.stroke();
  }
  // Ramp / orbit arrows: lit right after a shot, blinking while a combo is open.
  const comboOpen = s.combo > 0 && t - s.lastShotTick < R.comboWindowTicks;
  arrowLamp(ctx, 52, 222, -0.35, "#5ad1ff", t - s.lastRampTick < 60 || (comboOpen && chase % 2 === 0));
  arrowLamp(ctx, 320, 222, 0.35, "#5ad1ff", t - s.lastOrbitTick < 60 || (comboOpen && chase % 2 === 1));
  arrowLamp(ctx, 296, 168, -0.6, "#ffd36a", s.saucerLit > 0 && chase % 2 === 0);
  // V11: chevron strips toward each shot.
  {
    const open = comboOpen || s.multiball > 0;
    shotStrip(ctx, 0, s.hurry > 0 || open, t);
    shotStrip(ctx, 1, s.superLit > 0 || open, t);
    shotStrip(ctx, 2, s.inlanes.some(Boolean), t);
    shotStrip(ctx, 3, s.hurry > 0 || open, t);
    shotStrip(ctx, 4, s.saucerLit > 0 || s.lockLit > 0, t);
  }
  // V11: wormhole and upper-flipper arrows (lit for the super jackpot / while a combo is open).
  arrowLamp(ctx, 248, 332, 0.75, "#c79bff", s.superLit > 0 ? chase % 2 === 0 : comboOpen && chase % 3 === 0);
  arrowLamp(ctx, 278, 406, 0.85, "#5cf0d8", s.inlanes.some(Boolean) && chase % 2 === 1);

  // Stand-up targets: coloured faces with an insert lamp beside each.
  PINBALL_TARGETS_V11.forEach((tg, i) => {
    const hit = s.targets[i] > 0, ax = k(tg.ax), ay = k(tg.ay), by = k(tg.by);
    ctx.fillStyle = hit ? "#ffd36a" : "#e2374f";
    ctx.fillRect(ax - 1, ay, 7, by - ay);
    ctx.fillStyle = "rgba(255,255,255,.5)"; ctx.fillRect(ax + 4, ay + 2, 1.5, by - ay - 4);
    lamp(ctx, ax + 20, (ay + by) / 2, 4, "#ffd36a", hit);
  });
  PINBALL_RTARGETS_V11.forEach((tg, i) => {
    const hit = s.rTargets[i] > 0, ax = k(tg.ax), ay = k(tg.ay), by = k(tg.by);
    ctx.fillStyle = hit ? "#ffd36a" : "#3a8dff";
    ctx.fillRect(ax - 6, ay, 7, by - ay);
    ctx.fillStyle = "rgba(255,255,255,.5)"; ctx.fillRect(ax - 5, ay + 2, 1.5, by - ay - 4);
    lamp(ctx, ax - 20, (ay + by) / 2, 4, "#5ad1ff", hit);
  });
  // Drop-target bank: raised blocks; a dropped one leaves a slot and lights its lamp.
  PINBALL_DROPS_V11.forEach((w, i) => {
    const ax = k(w.ax), ay = k(w.ay), bx = k(w.bx), by = k(w.by), age = t - s.dropFlash[i];
    const down = s.drops[i] > 0;
    if (down) {
      ctx.strokeStyle = "rgba(0,0,0,.6)"; ctx.lineWidth = 4; ctx.lineCap = "butt";
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    } else {
      ctx.lineCap = "butt";
      ctx.strokeStyle = "rgba(0,0,0,.5)"; ctx.lineWidth = 10;
      ctx.beginPath(); ctx.moveTo(ax + 2, ay + 4); ctx.lineTo(bx + 2, by + 4); ctx.stroke();
      ctx.strokeStyle = age >= 0 && age < 20 ? "#fff1c4" : "#ff8a3d"; ctx.lineWidth = 9;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      ctx.fillStyle = "#3b1500"; ctx.font = "900 8px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(String(i + 1), (ax + bx) / 2, (ay + by) / 2 + 0.5);
      ctx.textBaseline = "alphabetic";
    }
    lamp(ctx, (ax + bx) / 2, (ay + by) / 2 + 16, 4, "#ff8a3d", down);
  });
  // Multiplier lamps ×1…×5 on the centre emblem.
  for (let m = 1; m <= R.maxMultiplier; m++) {
    const a = Math.PI * (1.15 + ((m - 1) / (R.maxMultiplier - 1)) * 0.7);
    const x = 195 + Math.cos(a) * 36, y = 476 + Math.sin(a) * 36;
    const on = s.multiplier >= m;
    lamp(ctx, x, y, 7, "#ffcf4a", on);
    ctx.fillStyle = on ? "#2a1700" : "rgba(255,255,255,.35)";
    ctx.font = "900 7px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(`×${m}`, x, y + 0.5);
    ctx.textBaseline = "alphabetic";
  }

  // Pop bumpers: skirt ring, coloured body, white star cap; flash + shock ring when hit.
  pinballBumpersV11(s.layout).forEach((p, i) => {
    const x = k(p.x), y = k(p.y), r = k(p.r);
    const age = t - s.bumperFlash[i], lit = age >= 0 && age < 14;
    const [hi, lo] = BUMPER_COLORS[i % BUMPER_COLORS.length];
    ctx.fillStyle = "#11182a";
    ctx.beginPath(); ctx.arc(x, y, r + 4, 0, Math.PI * 2); ctx.fill();
    for (let n = 0; n < 10; n++) {
      const a = (n / 10) * Math.PI * 2;
      ctx.fillStyle = lit || (idle && (chase + n) % 5 === 0) ? hi : "rgba(255,255,255,.12)";
      ctx.beginPath(); ctx.arc(x + Math.cos(a) * (r + 1.5), y + Math.sin(a) * (r + 1.5), 1.6, 0, Math.PI * 2); ctx.fill();
    }
    const body = ctx.createRadialGradient(x - 5, y - 6, 2, x, y, r);
    body.addColorStop(0, lit ? "#ffffff" : hi);
    body.addColorStop(1, lo);
    ctx.fillStyle = body;
    if (lit) { ctx.shadowColor = hi; ctx.shadowBlur = 26; }
    ctx.beginPath(); ctx.arc(x, y, r - 2 + (lit ? 1.5 : 0), 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    const cap = ctx.createRadialGradient(x - 3, y - 4, 1, x, y, r * 0.62);
    cap.addColorStop(0, "#ffffff"); cap.addColorStop(1, "#c9d6e3");
    ctx.fillStyle = cap;
    ctx.beginPath(); ctx.arc(x, y, r * 0.6, 0, Math.PI * 2); ctx.fill();
    // V11: the cap shows the bumper's own value.
    ctx.fillStyle = lit ? hi : lo;
    ctx.font = `900 ${r >= 18 ? 10 : 8}px system-ui`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(String(s.mode === 0 ? p.points * R.stormFactor : p.points), x, y + 0.5);
    ctx.textBaseline = "alphabetic";
    if (age >= 0 && age < 18) {
      ctx.strokeStyle = `rgba(255,255,255,${0.8 - age / 22})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, r + 4 + age * 1.6, 0, Math.PI * 2); ctx.stroke();
    }
  });
  // Kickers (slings): black rubber ring, chrome post, lamp that flashes on a kick.
  PINBALL_SLINGS_V11.forEach((p, i) => {
    const x = k(p.x), y = k(p.y), age = t - s.slingFlash[i], lit = age >= 0 && age < 10;
    ctx.fillStyle = "#0b0b0f";
    ctx.beginPath(); ctx.arc(x, y, k(p.r) + 2, 0, Math.PI * 2); ctx.fill();
    lamp(ctx, x, y, k(p.r) - 2, "#ff5a7a", lit, 18);
    ctx.fillStyle = lit ? "#2a0610" : "#ffd6de";
    ctx.font = "900 7px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(String(p.points), x, y + 0.5);
    ctx.textBaseline = "alphabetic";
  });
  // V11 rubber posts (cyan-lit) and lane separators: a black rubber ring round a chrome pin; the ring flares and a
  // shock ring spreads when the ball is kicked off it.
  PINBALL_POSTS_V11.forEach((p, i) => {
    const x = k(p.x), y = k(p.y), r = k(p.r), age = t - s.postFlash[i], lit = age >= 0 && age < 10, big = p.points >= 50;
    ctx.fillStyle = "#0b0b0f"; ctx.beginPath(); ctx.arc(x, y, r + 3, 0, Math.PI * 2); ctx.fill();
    if (big) lamp(ctx, x, y, r + 1, "#5ad1ff", lit, 16);
    else if (lit) { ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, r + 2, 0, Math.PI * 2); ctx.stroke(); }
    const pin = ctx.createRadialGradient(x - r * 0.3, y - r * 0.4, 0.5, x, y, r);
    pin.addColorStop(0, "#ffffff"); pin.addColorStop(1, "#8fa3b8");
    ctx.fillStyle = pin; ctx.beginPath(); ctx.arc(x, y, Math.max(2, r - (big ? 2.5 : 1.2)), 0, Math.PI * 2); ctx.fill();
    if (age >= 0 && age < 14) {
      ctx.strokeStyle = `rgba(160,235,255,${0.8 - age / 18})`; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(x, y, r + 4 + age * 1.3, 0, Math.PI * 2); ctx.stroke();
    }
  });
  // Inlane lamps feeding the flippers.
  lamp(ctx, 66, 520, 4, "#5ad1ff", s.combo > 0 && comboOpen);
  lamp(ctx, 300, 520, 4, "#5ad1ff", s.combo > 0 && comboOpen);
  // Shoot-again style drain lamp between the flippers.
  lamp(ctx, 195, 600, 5, "#ff5a7a", s.drains > 0 && s.phase !== "play" && Math.floor(t / 20) % 2 === 0);

  // Mission inserts (lanes · targets · drops): all three lit = MISSION + extra time.
  {
    const labels = ["ABC", "▮▮", "▼▼"], colors = ["#7cffb0", "#ff6f86", "#ff9a3d"];
    for (let i = 0; i < 3; i++) {
      const x = 157 + i * 38, y = 421, on = s.mission[i] > 0, pulse = !on && s.mission.filter(Boolean).length === 2;
      ctx.fillStyle = "rgba(0,0,0,.45)";
      ctx.beginPath(); ctx.roundRect(x - 16, y - 8, 32, 16, 8); ctx.fill();
      ctx.fillStyle = on ? colors[i] : pulse && chase % 2 === 0 ? `${colors[i]}88` : "rgba(255,255,255,.12)";
      if (on) { ctx.shadowColor = colors[i]; ctx.shadowBlur = 10; }
      ctx.beginPath(); ctx.roundRect(x - 14, y - 6, 28, 12, 6); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = on ? "#10141f" : "rgba(255,255,255,.55)";
      ctx.font = "900 7px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(labels[i], x, y + 0.5);
      ctx.textBaseline = "alphabetic";
    }
  }
  // Hurry-up: a jackpot counting down; the ramp and the orbit arrows flash gold until it is collected.
  if (s.hurry > 0) {
    const flash = chase % 2 === 0;
    arrowLamp(ctx, 52, 222, -0.35, "#ffd36a", flash);
    arrowLamp(ctx, 320, 222, 0.35, "#ffd36a", !flash);
    const frac = (s.hurry - R.hurryFloor) / (R.hurryStart - R.hurryFloor);
    ctx.save();
    ctx.fillStyle = "rgba(20,10,0,.72)";
    ctx.beginPath(); ctx.roundRect(135, 340, 120, 30, 15); ctx.fill();
    ctx.fillStyle = "#ffd36a";
    ctx.beginPath(); ctx.roundRect(139, 364, 112 * Math.max(0, frac), 3, 1.5); ctx.fill();
    ctx.shadowColor = "#ffb000"; ctx.shadowBlur = 12;
    ctx.font = "900 14px ui-monospace, Menlo, monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(tx("pinball.hurryValue", { n: formatNumber(s.hurry) }), 195, 353);
    ctx.restore();
  }
  // V9: two lock lamps beside the saucer (one per locked ball); jackpot arrows on the ramp and orbit in multiball;
  // the running mode with its seconds left.
  for (let i = 0; i < 2; i++) lamp(ctx, 292 + i * 14, 104, 3.4, "#7cffd8", s.locks > i || (s.multiball > 0 && chase % 2 === i), 10);
  if (s.multiball) { arrowLamp(ctx, 52, 222, -0.35, "#ff6fd8", chase % 2 === 0); arrowLamp(ctx, 320, 222, 0.35, "#ff6fd8", chase % 2 === 1); }
  if (s.mode >= 0) {
    const left = Math.max(0, Math.ceil((s.modeUntil - t) / R.tickRate));
    ctx.save();
    ctx.fillStyle = "rgba(10,0,20,.72)";
    ctx.beginPath(); ctx.roundRect(125, s.hurry > 0 ? 302 : 340, 140, 30, 15); ctx.fill();
    ctx.fillStyle = "#ff9dff"; ctx.shadowColor = "#ff5ad2"; ctx.shadowBlur = 12;
    ctx.font = "900 12px ui-monospace, Menlo, monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(`${tx(MODE_KEYS[s.mode])} ${left}`, 195, (s.hurry > 0 ? 302 : 340) + 15);
    ctx.restore();
  }
  // Ball save lamp between the flippers (blinks in its last second and a half).
  {
    const left = s.saveUntil - t, on = s.phase === "play" && left > 0 && (left > 180 || chase % 2 === 0);
    lamp(ctx, 195, 584, 6, "#8fe3ff", on, 14);
    ctx.fillStyle = on ? "#06202c" : "rgba(255,255,255,.3)";
    ctx.font = "900 5px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("SAVE", 195, 584.5);
    ctx.textBaseline = "alphabetic";
  }
  // Frenzy: the whole table pulses and every point counts double.
  if (pinballFrenzyV11(s) && s.status === "running") {
    const pulse = 0.5 + 0.5 * Math.sin(t * 0.25);
    ctx.save();
    tableOutline(ctx);
    ctx.strokeStyle = `rgba(255,90,210,${0.45 + 0.45 * pulse})`;
    ctx.lineWidth = 5;
    ctx.shadowColor = "#ff5ad2"; ctx.shadowBlur = 22;
    ctx.stroke();
    ctx.restore();
  }

  // Passages: the wormhole scoop and the two habitrails over the table.
  wormhole(ctx, t, s.tube === 2 || (s.superLit > 0 && chase % 2 === 0));
  // Wormhole exit portal at the end of the tunnel.
  {
    const end = PINBALL_TUBES_V11[2].path.at(-1)!, ex = k(end.x), ey = k(end.y), on = s.tube === 2;
    const g = ctx.createRadialGradient(ex, ey, 1, ex, ey, 13);
    g.addColorStop(0, on ? "#f3e6ff" : "#1a0b3a"); g.addColorStop(0.6, on ? "rgba(199,155,255,.7)" : "rgba(80,40,160,.55)"); g.addColorStop(1, "rgba(120,80,255,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ex, ey, 13, 0, Math.PI * 2); ctx.fill();
  }
  if (s.tube === 2) {
    // Underground: a glowing pulse travels the tunnel with the ball; the ball itself shrinks into the vortex
    // and grows back out of the exit portal, following its real position the whole time.
    ctx.save(); ctx.setLineDash([4, 6]); ctx.strokeStyle = "rgba(199,155,255,.55)"; ctx.lineWidth = 3;
    ctx.beginPath(); PINBALL_TUBES_V11[2].path.forEach((p, i) => (i ? ctx.lineTo(k(p.x), k(p.y)) : ctx.moveTo(k(p.x), k(p.y)))); ctx.stroke();
    ctx.restore();
    const blend = R.tubeBlendMilli, total = pinballTubeLengthV11(2);
    const inside = Math.min(1, s.tubeD / blend, (total - s.tubeD) / blend);
    if (inside < 1) drawBall(ctx, s, Math.max(0.15, 1 - inside));
    else {
      ctx.save(); ctx.fillStyle = "rgba(199,155,255,.85)"; ctx.shadowColor = "#c79bff"; ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.arc(k(s.ball.x), k(s.ball.y), 7, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
  }
  const lastRail = (tube: number) => s.feed.some((e) => (e.kind === "RAIL" || e.kind === (tube ? "ORBIT" : "RAMP")) && t - e.tick < 90);
  habitrail(ctx, 0, t, s.tube === 0 || lastRail(0), s.tube === 0 ? s : null);
  habitrail(ctx, 1, t, s.tube === 1 || lastRail(1), s.tube === 1 ? s : null);

  leftSpinner(ctx, s);
  flipper(ctx, s, "left");
  flipper(ctx, s, "right");
  flipper(ctx, s, "upper");

  // Shooter lane: power lamps and a spring plunger that compresses with the charge.
  {
    const level = pinballChargeLevelV11(s.charge), charging = s.phase === "lane" && s.chargeHeld;
    for (let i = 0; i < R.maxChargeLevel; i++) {
      const on = charging ? i < level : s.phase === "lane" && (chase + i) % R.maxChargeLevel === 0;
      lamp(ctx, 359, 556 - i * 18, 3.2, i >= R.maxChargeLevel - 2 ? "#7cffb0" : "#ffcf4a", on, 8);
    }
    const pull = charging ? (s.charge / (R.maxChargeLevel * R.chargeStepTicks)) * 16 : 0;
    ctx.strokeStyle = "#9aa9b8"; ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i <= 8; i++) {
      const y = 590 + pull * 0.3 + i * (2.6 + pull * 0.06);
      ctx.lineTo(i % 2 ? 365 : 353, y);
    }
    ctx.stroke();
    ctx.fillStyle = "#c9d6e3";
    ctx.fillRect(352, 584 + pull, 14, 5);
    ctx.fillStyle = "#e2374f";
    ctx.beginPath(); ctx.roundRect(354, 612 + pull * 0.4, 10, 8, 2); ctx.fill();
  }

  if (s.phase !== "waiting" && s.tube < 0) drawBall(ctx, s);
  // V9 multiball: every other ball in play.
  for (const e of s.extra) drawBall(ctx, s, 1, e);

  // Event bursts, floating points and big call-outs from the deterministic feed.
  for (const ev of s.feed) {
    const age = t - ev.tick;
    if (age < 0 || age > 70) continue;
    const x = Math.max(36, Math.min(340, k(ev.x))), y = k(ev.y);
    if (age < 22 && ev.kind !== "SPINNER" && ev.kind !== "EJECT" && ev.kind !== "LAUNCH") {
      for (let n = 0; n < 10; n++) {
        const a = (n / 10) * Math.PI * 2 + ev.tick * 0.7, r1 = 4 + age * 1.6;
        ctx.fillStyle = n % 2 ? `rgba(255,236,170,${1 - age / 22})` : `rgba(120,220,255,${1 - age / 22})`;
        ctx.beginPath(); ctx.arc(x + Math.cos(a) * r1, y + Math.sin(a) * r1 + age * 0.3, 1.8, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (ev.points > 0 && ev.kind !== "BONUS") {
      ctx.globalAlpha = Math.max(0, 1 - age / 70);
      ctx.fillStyle = "#fff2c0";
      ctx.strokeStyle = "rgba(0,0,0,.6)"; ctx.lineWidth = 3;
      ctx.font = "900 13px system-ui";
      ctx.textAlign = "center";
      ctx.strokeText(`+${ev.points}`, x, y - 16 - age * 0.4);
      ctx.fillText(`+${ev.points}`, x, y - 16 - age * 0.4);
      ctx.globalAlpha = 1;
    }
    if (BIG.has(ev.kind) && age < 26) {
      // Whole-table light flash for the big moments.
      ctx.save();
      tableOutline(ctx);
      ctx.clip();
      ctx.fillStyle = ev.kind === "DRAIN" ? `rgba(255,60,80,${0.22 * (1 - age / 26)})` : `rgba(255,220,120,${0.2 * (1 - age / 26)})`;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    const c = CALLOUTS[ev.kind];
    if (c && BIG.has(ev.kind) && age < 70) {
      const grow = Math.min(1, age / 8);
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, age - 40) / 30);
      ctx.fillStyle = c[1];
      ctx.shadowColor = c[1]; ctx.shadowBlur = 18;
      ctx.font = `900 ${18 + Math.round(10 * grow)}px system-ui`;
      ctx.textAlign = "center";
      ctx.fillText(ev.kind === "BONUS" ? tx("pinball.bonusPts", { n: formatNumber(ev.points) }) : c[0], 195, 340 - age * 0.25);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
  }

  // V11: the score lives in the shared scoreboard; the latest small call-out shows on the apron above the flippers.
  {
    let call: { text: string; color: string; age: number } | null = null;
    for (const ev of s.feed) {
      const age = t - ev.tick, c = CALLOUTS[ev.kind];
      if (c && !BIG.has(ev.kind) && age >= 0 && age < 80 && (!call || age < call.age)) call = { text: ev.kind === "COMBO" ? tx("play.combo", { n: s.combo + 1 }) : c[0], color: c[1], age };
    }
    if (call) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, call.age - 50) / 30);
      ctx.fillStyle = "rgba(6,8,16,.7)"; ctx.beginPath(); ctx.roundRect(135, 498, 120, 20, 10); ctx.fill();
      ctx.fillStyle = call.color; ctx.shadowColor = call.color; ctx.shadowBlur = 10;
      ctx.font = "800 11px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(call.text, 195, 508.5);
      ctx.restore();
    }
  }

  if (s.status === "failed") {
    ctx.fillStyle = "rgba(216,81,109,.15)";
    ctx.fillRect(0, 0, W, H);
  }
}

function pointAction(point: CorePoint, phase: "down" | "move" | "up", s: PinballStateV11) {
  if (phase === "move" || point.y > 540) return null;
  const left = point.x < 195;
  if (phase === "down") return left ? "FLIP_LEFT_PRESS" : "FLIP_RIGHT_PRESS";
  if (left && s.leftHeld) return "FLIP_LEFT_RELEASE";
  if (!left && s.rightHeld) return "FLIP_RIGHT_RELEASE";
  return null;
}

const keys = {
  ArrowLeft: "FLIP_LEFT_PRESS", z: "FLIP_LEFT_PRESS", Z: "FLIP_LEFT_PRESS",
  ArrowRight: "FLIP_RIGHT_PRESS", x: "FLIP_RIGHT_PRESS", X: "FLIP_RIGHT_PRESS",
  " ": "PLUNGER_HOLD", ArrowDown: "PLUNGER_HOLD",
} as const;
const keyReleases = {
  ArrowLeft: "FLIP_LEFT_RELEASE", z: "FLIP_LEFT_RELEASE", Z: "FLIP_LEFT_RELEASE",
  ArrowRight: "FLIP_RIGHT_RELEASE", x: "FLIP_RIGHT_RELEASE", X: "FLIP_RIGHT_RELEASE",
  " ": "PLUNGER_RELEASE", ArrowDown: "PLUNGER_RELEASE",
} as const;
const controls = [
  { action: "FLIP_LEFT_PRESS", releaseAction: "FLIP_LEFT_RELEASE", get label() { return tx("pinball.leftFlipper"); }, symbol: "◀", style: { width: 104 } },
  { action: "PLUNGER_HOLD", releaseAction: "PLUNGER_RELEASE", get label() { return tx("pinball.plungerAria"); }, get symbol() { return tx("pinball.plunger"); }, style: { width: 120, fontSize: 15 } },
  { action: "FLIP_RIGHT_PRESS", releaseAction: "FLIP_RIGHT_RELEASE", get label() { return tx("pinball.rightFlipper"); }, symbol: "▶", style: { width: 104 } },
] as const;
const inputTones = { PLUNGER_RELEASE: "tap", FLIP_LEFT_PRESS: "tap", FLIP_RIGHT_PRESS: "tap" } as const;
const hudLabel = (s: Readonly<PinballStateV11>) => tx("pinball.hud", { secs: Math.max(0, Math.ceil((s.endTick - s.tick) / PINBALL_RULES_V11.tickRate)), mult: s.multiplier });
const scoreCells = (s: Readonly<PinballStateV11>): ScoreCell[] => {
  const secs = Math.max(0, Math.ceil((s.endTick - s.tick) / PINBALL_RULES_V11.tickRate));
  return [
    { label: tx("hud.points"), value: formatNumber(s.score), main: true },
    { label: tx("hud.time"), value: `${secs} s`, alert: secs <= 10 },
    { label: tx("hud.mult"), value: pinballFrenzyV11(s) ? `×${s.multiplier} ×2` : `×${s.multiplier}` },
  ];
};

export default function PinballVerified(props: GameRuntimeProps) {
  useI18n();
  return (
    <div className="pinballVerified">
      <CoreCanvasGame
        {...props}
        core={PINBALL_CORE_V11}
        name="Pinball"
        render={renderPinball}
        pointAction={pointAction}
        keys={keys}
        keyReleases={keyReleases}
        controls={controls}
        inputTones={inputTones}
        hudLabel={hudLabel}
        scoreCells={scoreCells}
        hideHudLabel
        hideHudScore
        topInset={SCORE_INSET}
        instruction=""
      />
    </div>
  );
}
