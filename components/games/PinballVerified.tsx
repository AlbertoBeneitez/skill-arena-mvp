"use client";
import type { GameRuntimeProps } from "@/lib/games";
import { drawSpaceBackdrop } from "@/lib/spaceBackdrop";
import {
  PINBALL_BUMPER_RADIUS_V8,
  PINBALL_CORE_V8,
  PINBALL_DROPS_V8,
  PINBALL_LANES_V8,
  PINBALL_POSTS_V8,
  PINBALL_RTARGETS_V8,
  PINBALL_RULES_V8,
  PINBALL_SAUCER_V8,
  PINBALL_SLINGS_V8,
  PINBALL_SPINNER_V8,
  PINBALL_TARGETS_V8,
  PINBALL_WALLS_V8,
  pinballBumpersV8,
  pinballChargeLevelV8,
  pinballFlipperTipV8,
  pinballFrenzyV8,
  pinballTubePointV8,
  pinballTubeLengthV8,
  PINBALL_TUBES_V8,
  PINBALL_WORMHOLE_V8,
  type PinballStateV8,
} from "@/lib/verified/pinballCore.v8";
import CoreCanvasGame, { type CorePoint } from "./CoreCanvasGame";

import { t as tx, formatNumber, useI18n, type MessageKey } from "@/lib/i18n";
/*
 * Presentation only. Everything here reads the authoritative state and never
 * changes it: a classic space-themed table (chrome rails, printed playfield,
 * lamp inserts, pop bumpers, drop targets, shooter lane, apron) plus a
 * dot-matrix score display. Static art is cached once per layout and scale.
 */

const W = 390, H = 620;
const k = (v: number) => v / 1000;
const R = PINBALL_RULES_V8;
const BUMPER_COLORS = [
  ["#ff5a7a", "#a3173a"],
  ["#ffc94a", "#a86a00"],
  ["#5ad1ff", "#145b9e"],
  ["#8dff8a", "#1f7a2b"],
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
  for (const w of PINBALL_WALLS_V8) chromeLine(ctx, k(w.ax), k(w.ay), k(w.bx), k(w.by), 7);
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
  PINBALL_LANES_V8.forEach((l, i) => ctx.fillText(LANE_LETTERS[i], k(l.x), k(l.y) + 24));
  // Kickers (slings) and posts get a rubber ring.
  for (const p of [...PINBALL_SLINGS_V8, ...PINBALL_POSTS_V8]) {
    ctx.fillStyle = "rgba(0,0,0,.45)";
    ctx.beginPath(); ctx.arc(k(p.x) + 1.5, k(p.y) + 2.5, k(p.r) + 3, 0, Math.PI * 2); ctx.fill();
  }
  // Bumper skirts (the coloured bodies are dynamic).
  for (const p of pinballBumpersV8(layout)) {
    ctx.fillStyle = "rgba(0,0,0,.5)";
    ctx.beginPath(); ctx.arc(k(p.x) + 3, k(p.y) + 5, k(PINBALL_BUMPER_RADIUS_V8) + 5, 0, Math.PI * 2); ctx.fill();
  }
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

let dotPattern: { scale: number; pattern: CanvasPattern | null } | null = null;
function dmdDots(ctx: CanvasRenderingContext2D) {
  const scale = Math.max(1, Math.abs(ctx.getTransform().a) || 1);
  if (!dotPattern || dotPattern.scale !== scale) {
    const tile = document.createElement("canvas");
    const s = Math.max(2, Math.round(2 * scale));
    tile.width = s; tile.height = s;
    const t = tile.getContext("2d");
    if (t) {
      t.fillStyle = "rgba(0,0,0,.38)";
      t.fillRect(0, s - Math.max(1, Math.round(scale * 0.6)), s, s);
      t.fillRect(s - Math.max(1, Math.round(scale * 0.6)), 0, s, s);
    }
    const pattern = ctx.createPattern(tile, "repeat");
    pattern?.setTransform(new DOMMatrix().scale(1 / scale));
    dotPattern = { scale, pattern };
  }
  return dotPattern.pattern;
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

function flipper(ctx: CanvasRenderingContext2D, s: PinballStateV8, side: "left" | "right") {
  const angle = side === "left" ? s.left : s.right,
    held = side === "left" ? s.leftHeld : s.rightHeld,
    tip = pinballFlipperTipV8(side, angle);
  const px = k(tip.pivot.x), py = k(tip.pivot.y), tx = k(tip.x), ty = k(tip.y);
  const len = Math.hypot(tx - px, ty - py) || 1, nx = -(ty - py) / len, ny = (tx - px) / len;
  const bat = (ox: number, oy: number) => {
    ctx.beginPath();
    ctx.moveTo(px + nx * 9 + ox, py + ny * 9 + oy);
    ctx.lineTo(tx + nx * 5 + ox, ty + ny * 5 + oy);
    ctx.arc(tx + ox, ty + oy, 5, Math.atan2(ny, nx), Math.atan2(-ny, -nx));
    ctx.lineTo(px - nx * 9 + ox, py - ny * 9 + oy);
    ctx.arc(px + ox, py + oy, 9, Math.atan2(-ny, -nx), Math.atan2(ny, nx));
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
  ctx.strokeStyle = held ? "#ff8a3d" : "#e2374f";
  ctx.lineWidth = 3;
  bat(0, 0); ctx.stroke();
  ctx.fillStyle = "#9aa9b8";
  ctx.beginPath(); ctx.arc(px, py, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawBall(ctx: CanvasRenderingContext2D, s: PinballStateV8, scale = 1) {
  const b = s.ball, x = k(b.x), y = k(b.y);
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
} as const;
/** Call-out text in the active language (A-B-C is the same everywhere). */
const CALLOUTS = new Proxy({} as Record<string, [string, string] | undefined>, {
  get(_, kind: string) {
    const entry = (CALLOUT_KEYS as Record<string, readonly [string, string]>)[kind];
    if (!entry) return undefined;
    return [entry[0] ? tx(entry[0] as MessageKey) : "A-B-C", entry[1]];
  },
});
const BIG = new Set(["SKILL", "JACKPOT", "DROPS", "BONUS", "DRAIN", "MISSION", "EXTRATIME", "HURRYGO", "SAVED", "FRENZY", "WORMHOLE"]);

/** Score display: always above the table, in the strip reserved by topInset (it grows when there is more room). */
const DMD_INSET = 54;
function dmdBox(top: number) {
  const headroom = Math.max(DMD_INSET, -top);
  const h = headroom >= 64 ? 48 : 42;
  return { y: -h - 6, h, big: true };
}
function drawDmd(ctx: CanvasRenderingContext2D, s: PinballStateV8, top = 0) {
  const { y: y0, h, big } = dmdBox(top), cy = y0 + h / 2;
  ctx.save();
  // Bezel.
  ctx.fillStyle = "#05070d";
  ctx.strokeStyle = "#566b80";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(14, y0 - 3, 362, h + 6, 8); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.roundRect(18, y0, 354, h, 6); ctx.clip();
  ctx.fillStyle = "#120700";
  ctx.fillRect(18, y0, 354, h);
  // Latest call-out takes over the display for a moment.
  let call: { text: string; age: number } | null = null;
  for (const ev of s.feed) {
    const age = s.tick - ev.tick, c = CALLOUTS[ev.kind];
    if (c && age >= 0 && age < 110 && (!call || age < call.age)) {
      call = { text: ev.kind === "BONUS" ? tx("pinball.bonusPts", { n: formatNumber(ev.points) }) : ev.kind === "COMBO" ? tx("play.combo", { n: s.combo + 1 }) : c[0], age };
    }
  }
  ctx.fillStyle = "#ffb03a";
  ctx.shadowColor = "#ff8a00";
  ctx.shadowBlur = 10;
  ctx.textBaseline = "middle";
  if (call && Math.floor(call.age / 9) % 2 === 0 || (call && call.age > 36)) {
    ctx.font = `900 ${big ? 26 : 19}px ui-monospace, Menlo, monospace`;
    ctx.textAlign = "center";
    ctx.fillText(call.text, 195, cy);
  } else if (!call) {
    ctx.font = `900 ${big ? 30 : 20}px ui-monospace, Menlo, monospace`;
    ctx.textAlign = "left";
    ctx.fillText(formatNumber(s.score), 28, cy + 1);
    const secs = Math.max(0, Math.ceil((s.endTick - s.tick) / R.tickRate));
    ctx.font = `800 ${big ? 16 : 12}px ui-monospace, Menlo, monospace`;
    ctx.textAlign = "right";
    ctx.fillStyle = secs <= 10 && Math.floor(s.tick / 30) % 2 === 0 ? "#ff4a2a" : "#ff9a1f";
    ctx.fillText(`${secs}s`, 362, cy - h * 0.23);
    ctx.fillStyle = "#ff9a1f";
    const frenzy = pinballFrenzyV8(s);
    ctx.fillText(frenzy ? `×${s.multiplier}×2` : `×${s.multiplier}`, 362, cy + h * 0.24);
    // Extra-time tokens earned (missions), centre of the display.
    for (let i = 0; i < R.maxExtraTimes; i++) {
      ctx.fillStyle = i < Math.min(R.maxExtraTimes, s.missions) ? "#7cffd8" : "rgba(255,154,31,.25)";
      ctx.fillRect(236 + i * 14, cy - 4, 9, 9);
    }
  }
  ctx.shadowBlur = 0;
  const pattern = dmdDots(ctx);
  if (pattern) { ctx.fillStyle = pattern; ctx.fillRect(18, y0, 354, h); }
  // Glass reflection.
  const glass = ctx.createLinearGradient(0, y0, 0, y0 + h);
  glass.addColorStop(0, "rgba(255,255,255,.08)");
  glass.addColorStop(0.5, "rgba(255,255,255,0)");
  ctx.fillStyle = glass;
  ctx.fillRect(18, y0, 354, h);
  ctx.restore();
}

/** Points every `step` px along a passage with unit tangent and normal (static geometry, cached per tube). */
const railSamples = new Map<number, { x: number; y: number; tx: number; ty: number; nx: number; ny: number; d: number }[]>();
function samplesFor(tube: number, step = 6) {
  const hit = railSamples.get(tube);
  if (hit) return hit;
  const total = pinballTubeLengthV8(tube), out: { x: number; y: number; tx: number; ty: number; nx: number; ny: number; d: number }[] = [];
  for (let d = 0; d <= total; d += step * 1000) {
    const a = pinballTubePointV8(tube, Math.max(0, d - 3000)), b = pinballTubePointV8(tube, Math.min(total, d + 3000)), p = pinballTubePointV8(tube, d);
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
function habitrail(ctx: CanvasRenderingContext2D, tube: number, t: number, lit: boolean, rider: PinballStateV8 | null) {
  const path = PINBALL_TUBES_V8[tube].path.map((p) => ({ x: k(p.x), y: k(p.y) }));
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
      const p = pinballTubePointV8(tube, Math.round(d * pinballTubeLengthV8(tube)));
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
  const x = k(PINBALL_WORMHOLE_V8.x), y = k(PINBALL_WORMHOLE_V8.y), r = k(PINBALL_WORMHOLE_V8.r) + 6;
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

function render(ctx: CanvasRenderingContext2D, s: PinballStateV8, view?: { top?: number }) {
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
  PINBALL_LANES_V8.forEach((l, i) => {
    const nextSkill = s.phase === "lane" && !s.skillDone && s.launches % 3 === i;
    const skill = (skillOpen && s.skillLane === i) || nextSkill;
    lamp(ctx, k(l.x), k(l.y), 8, skill ? "#ffe082" : "#7cffb0", s.lanes[i] > 0 || (skill && chase % 2 === 0) || (idle && (chase + i) % 3 === 0 && s.launchTick < 0));
  });
  // Spinner: striped plate whose visible width follows the spin counter.
  {
    const sp = PINBALL_SPINNER_V8, cx = k(sp.x0 + sp.x1) / 2, cy = k(sp.y0 + sp.y1) / 2, a = s.spins * 1.1;
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
  // Saucer with chasing ring lamps when lit.
  {
    const c = PINBALL_SAUCER_V8, cx = k(c.x), cy = k(c.y);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      lamp(ctx, cx + Math.cos(a) * 22, cy + Math.sin(a) * 22, 2.6, "#ffd36a", s.saucerLit > 0 && (chase + i) % 4 < 2, 8);
    }
    const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, 15);
    g.addColorStop(0, "#000"); g.addColorStop(0.7, "#141a2c"); g.addColorStop(1, "#5f7387");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = s.saucerLit ? "#ffe082" : "#9aa9b8"; ctx.lineWidth = 2; ctx.stroke();
  }
  // Ramp / orbit arrows: lit right after a shot, blinking while a combo is open.
  const comboOpen = s.combo > 0 && t - s.lastShotTick < R.comboWindowTicks;
  arrowLamp(ctx, 52, 222, -0.35, "#5ad1ff", t - s.lastRampTick < 60 || (comboOpen && chase % 2 === 0));
  arrowLamp(ctx, 320, 222, 0.35, "#5ad1ff", t - s.lastOrbitTick < 60 || (comboOpen && chase % 2 === 1));
  arrowLamp(ctx, 296, 168, -0.6, "#ffd36a", s.saucerLit > 0 && chase % 2 === 0);

  // Stand-up targets: coloured faces with an insert lamp beside each.
  PINBALL_TARGETS_V8.forEach((tg, i) => {
    const hit = s.targets[i] > 0, ax = k(tg.ax), ay = k(tg.ay), by = k(tg.by);
    ctx.fillStyle = hit ? "#ffd36a" : "#e2374f";
    ctx.fillRect(ax - 1, ay, 7, by - ay);
    ctx.fillStyle = "rgba(255,255,255,.5)"; ctx.fillRect(ax + 4, ay + 2, 1.5, by - ay - 4);
    lamp(ctx, ax + 20, (ay + by) / 2, 4, "#ffd36a", hit);
  });
  PINBALL_RTARGETS_V8.forEach((tg, i) => {
    const hit = s.rTargets[i] > 0, ax = k(tg.ax), ay = k(tg.ay), by = k(tg.by);
    ctx.fillStyle = hit ? "#ffd36a" : "#3a8dff";
    ctx.fillRect(ax - 6, ay, 7, by - ay);
    ctx.fillStyle = "rgba(255,255,255,.5)"; ctx.fillRect(ax - 5, ay + 2, 1.5, by - ay - 4);
    lamp(ctx, ax - 20, (ay + by) / 2, 4, "#5ad1ff", hit);
  });
  // Drop-target bank: raised blocks; a dropped one leaves a slot and lights its lamp.
  PINBALL_DROPS_V8.forEach((w, i) => {
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
  pinballBumpersV8(s.layout).forEach((p, i) => {
    const x = k(p.x), y = k(p.y), r = k(PINBALL_BUMPER_RADIUS_V8);
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
    ctx.fillStyle = lit ? hi : lo;
    ctx.beginPath();
    for (let n = 0; n < 10; n++) {
      const a = -Math.PI / 2 + (n * Math.PI) / 5, rr = n % 2 === 0 ? r * 0.42 : r * 0.18;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fill();
    if (age >= 0 && age < 18) {
      ctx.strokeStyle = `rgba(255,255,255,${0.8 - age / 22})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, r + 4 + age * 1.6, 0, Math.PI * 2); ctx.stroke();
    }
  });
  // Kickers (slings): black rubber ring, chrome post, lamp that flashes on a kick.
  PINBALL_SLINGS_V8.forEach((p, i) => {
    const x = k(p.x), y = k(p.y), age = t - s.slingFlash[i], lit = age >= 0 && age < 10;
    ctx.fillStyle = "#0b0b0f";
    ctx.beginPath(); ctx.arc(x, y, k(p.r) + 2, 0, Math.PI * 2); ctx.fill();
    lamp(ctx, x, y, k(p.r) - 2, "#ff5a7a", lit, 18);
    ctx.fillStyle = "#dfe9f3";
    ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
  });
  for (const p of PINBALL_POSTS_V8) {
    const x = k(p.x), y = k(p.y);
    ctx.fillStyle = "#0b0b0f"; ctx.beginPath(); ctx.arc(x, y, k(p.r) + 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#dfe9f3"; ctx.beginPath(); ctx.arc(x, y, k(p.r) - 1.5, 0, Math.PI * 2); ctx.fill();
  }
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
  if (pinballFrenzyV8(s) && s.status === "running") {
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
  wormhole(ctx, t, s.tube === 2);
  // Wormhole exit portal at the end of the tunnel.
  {
    const end = PINBALL_TUBES_V8[2].path.at(-1)!, ex = k(end.x), ey = k(end.y), on = s.tube === 2;
    const g = ctx.createRadialGradient(ex, ey, 1, ex, ey, 13);
    g.addColorStop(0, on ? "#f3e6ff" : "#1a0b3a"); g.addColorStop(0.6, on ? "rgba(199,155,255,.7)" : "rgba(80,40,160,.55)"); g.addColorStop(1, "rgba(120,80,255,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ex, ey, 13, 0, Math.PI * 2); ctx.fill();
  }
  if (s.tube === 2) {
    // Underground: a glowing pulse travels the tunnel with the ball; the ball itself shrinks into the vortex
    // and grows back out of the exit portal, following its real position the whole time.
    ctx.save(); ctx.setLineDash([4, 6]); ctx.strokeStyle = "rgba(199,155,255,.55)"; ctx.lineWidth = 3;
    ctx.beginPath(); PINBALL_TUBES_V8[2].path.forEach((p, i) => (i ? ctx.lineTo(k(p.x), k(p.y)) : ctx.moveTo(k(p.x), k(p.y)))); ctx.stroke();
    ctx.restore();
    const blend = R.tubeBlendMilli, total = pinballTubeLengthV8(2);
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

  flipper(ctx, s, "left");
  flipper(ctx, s, "right");

  // Shooter lane: power lamps and a spring plunger that compresses with the charge.
  {
    const level = pinballChargeLevelV8(s.charge), charging = s.phase === "lane" && s.chargeHeld;
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

  drawDmd(ctx, s, view?.top ?? 0);

  if (s.status === "failed") {
    ctx.fillStyle = "rgba(216,81,109,.15)";
    ctx.fillRect(0, 0, W, H);
  }
}

function pointAction(point: CorePoint, phase: "down" | "move" | "up", s: PinballStateV8) {
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
const hudLabel = (s: Readonly<PinballStateV8>) => tx("pinball.hud", { secs: Math.max(0, Math.ceil((s.endTick - s.tick) / PINBALL_RULES_V8.tickRate)), mult: s.multiplier });

export default function PinballVerified(props: GameRuntimeProps) {
  useI18n();
  return (
    <div className="pinballVerified">
      <CoreCanvasGame
        {...props}
        core={PINBALL_CORE_V8}
        name="Pinball"
        render={render}
        pointAction={pointAction}
        keys={keys}
        keyReleases={keyReleases}
        controls={controls}
        inputTones={inputTones}
        hudLabel={hudLabel}
        hideHudLabel
        hideHudScore
        topInset={DMD_INSET}
        instruction=""
      />
    </div>
  );
}
