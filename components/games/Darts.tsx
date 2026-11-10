"use client";
import { useCallback, useEffect, useRef } from "react";
import type { GameRuntimeProps } from "@/lib/games";
import {
  DARTS_CORE_V3,
  DARTS_RULES_V3,
  dartsStageV3,
  type DartsStateV3,
} from "@/lib/verified/dartsCore.v3";
import { DARTS_SECTORS } from "@/lib/verified/dartsCore.v1";
import {
  dartPerspectiveFlight,
  dartPerspectivePose,
} from "@/lib/dartsFlightPerspective";
import { drawDart, type DartLook } from "@/lib/dartsPresentation";
import { playerAvatar } from "@/lib/playerLook";
import { dartsAimAction } from "@/lib/verified/dartsProtocol.v1";
import { dartsFlickAimV4, type DartsGestureSample } from "@/lib/verified/dartsGesture.v4";
import { drawSpaceBackdrop } from "@/lib/spaceBackdrop";
import CoreCanvasGame, { type CorePoint } from "./CoreCanvasGame";
import type { ScoreCell } from "../GameScoreboard";

import { t, formatNumber, useI18n } from "@/lib/i18n";
const cx = 195,
  cy = 285;
// Visual zoom only (outer ring 161 * 1.15 = 185 of 195 half-width); aim input
// uses the inverse, so authoritative coordinates are unchanged.
const BOARD_ZOOM = 1.15;
/**
 * v164: the darts wear the player — the avatar is printed across the four flights and the barrel rings and flight
 * edges take the avatar's overall colour (the mean of its pixels, measured once per image). Presentation only.
 */
const look: { src: string; value: DartLook } = { src: "", value: { image: null, color: "#6bdde2" } };
function averageColor(img: HTMLImageElement) {
  try {
    const c = document.createElement("canvas"); c.width = c.height = 24;
    const g = c.getContext("2d", { willReadFrequently: true });
    if (!g) return null;
    // Only the circle that the flights show counts.
    g.beginPath(); g.arc(12, 12, 12, 0, Math.PI * 2); g.clip(); g.drawImage(img, 0, 0, 24, 24);
    const d = g.getImageData(0, 0, 24, 24).data;
    let r = 0, gg = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 200) continue; r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; }
    return n ? `rgb(${Math.round(r / n)},${Math.round(gg / n)},${Math.round(b / n)})` : null;
  } catch { return null; }
}
function dartLook(): DartLook {
  const src = playerAvatar();
  if (src && src !== look.src && typeof Image !== "undefined" && typeof document !== "undefined") {
    look.src = src;
    const img = new Image();
    img.decoding = "async";
    img.onload = () => { if (look.src === src) look.value = { image: img, color: averageColor(img) ?? look.value.color }; };
    img.src = src;
  }
  return look.value;
}
/** Dart held under the finger while aiming (presentation only). */
const held = { active: false, x: 0, y: 0, trail: [] as { x: number; y: number }[] };
/**
 * v123 · Tournament arena (presentation only; the V3 scoring geometry is untouched): a dark hall under a lighting truss,
 * two spotlights crossing on the board with dust in the beams, crowd lights out of focus, the board in a black
 * surround with a chrome number ring, classic tournament colours on sisal, a silver spider, an LED halo, the oche
 * glowing on the floor, and a flash + shockwave on every impact (stronger on bull, treble and double).
 * The static board is cached in an offscreen canvas once.
 */
const BOARD_CLASSIC = { dark: "#121216", light: "#e9dcbc", red: "#b8141f", green: "#0d7a47" };
let boardCache: HTMLCanvasElement | null = null;
const BOARD_PX = 3, BOARD_R = 160; // cached at 3× around the board centre (logical radius incl. surround)
/**
 * v162 · A tournament board in detail (presentation only; the V3 scoring radii 10/24/78/88/129/140 are untouched):
 * a black catch ring with a machined steel bezel, pressed sisal (radial fibre texture, mottled tone per bed and
 * worn pin holes), lacquered doubles and trebles with their own sheen, a raised silver spider drawn with its
 * shadow and its lit edge, a wire number ring and embossed white numbers, and a key light from the upper left.
 */
function boardSprite() {
  if (boardCache || typeof document === "undefined") return boardCache;
  const c = document.createElement("canvas");
  c.width = c.height = BOARD_R * 2 * BOARD_PX;
  const g = c.getContext("2d");
  if (!g) return null;
  g.scale(BOARD_PX, BOARD_PX);
  g.translate(BOARD_R, BOARD_R);
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const TAU = Math.PI * 2;
  // Catch ring: black foam with a fine grain, a steel bezel and an inner lip.
  const sur = g.createRadialGradient(-50, -60, 10, 0, 0, BOARD_R);
  sur.addColorStop(0, "#2b2c33"); sur.addColorStop(0.7, "#121318"); sur.addColorStop(1, "#050508");
  g.fillStyle = sur; g.beginPath(); g.arc(0, 0, BOARD_R - 1, 0, TAU); g.fill();
  for (let k = 0; k < 1400; k++) {
    const a = rnd() * TAU, r = 141 + rnd() * 18;
    g.fillStyle = rnd() < 0.5 ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.35)";
    g.fillRect(Math.cos(a) * r, Math.sin(a) * r, 0.8, 0.8);
  }
  const bezel = g.createLinearGradient(-BOARD_R, -BOARD_R, BOARD_R, BOARD_R);
  bezel.addColorStop(0, "#f2f5f9"); bezel.addColorStop(0.3, "#8d96a6"); bezel.addColorStop(0.55, "#dfe5ec"); bezel.addColorStop(1, "#3f4652");
  g.strokeStyle = bezel; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, BOARD_R - 2, 0, TAU); g.stroke();
  g.strokeStyle = "rgba(0,0,0,.6)"; g.lineWidth = 1; g.beginPath(); g.arc(0, 0, BOARD_R - 4, 0, TAU); g.stroke();
  // Sisal beds and the coloured rings.
  const seg = (r1: number, r2: number, a: number, b: number, fill: string | CanvasGradient) => {
    g.fillStyle = fill; g.beginPath(); g.arc(0, 0, r2, a, b); g.arc(0, 0, r1, b, a, true); g.closePath(); g.fill();
  };
  const lacquer = (r1: number, r2: number, base: string) => {
    const q = g.createRadialGradient(0, 0, r1, 0, 0, r2);
    q.addColorStop(0, base); q.addColorStop(0.45, base); q.addColorStop(1, "rgba(0,0,0,.25)");
    return q;
  };
  for (let i = 0; i < 20; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 10 - Math.PI / 20, b = a + Math.PI / 10, even = i % 2 === 0;
    seg(24, 140, a, b, even ? BOARD_CLASSIC.dark : BOARD_CLASSIC.light);
    seg(78, 88, a, b, even ? BOARD_CLASSIC.red : BOARD_CLASSIC.green);
    seg(129, 140, a, b, even ? BOARD_CLASSIC.red : BOARD_CLASSIC.green);
    seg(78, 88, a, b, lacquer(78, 88, "rgba(255,255,255,0)"));
    seg(129, 140, a, b, lacquer(129, 140, "rgba(255,255,255,0)"));
  }
  g.fillStyle = BOARD_CLASSIC.green; g.beginPath(); g.arc(0, 0, 24, 0, TAU); g.fill();
  const bull = g.createRadialGradient(-3, -3, 1, 0, 0, 10);
  bull.addColorStop(0, "#e2333f"); bull.addColorStop(1, "#8e0e18");
  g.fillStyle = bull; g.beginPath(); g.arc(0, 0, 10, 0, TAU); g.fill();
  // Pressed sisal: short radial fibres (the board is made of compressed bristles seen end-on), mottled tone.
  g.save();
  g.beginPath(); g.arc(0, 0, 140, 0, TAU); g.clip();
  for (let k = 0; k < 9000; k++) {
    const a = rnd() * TAU, r = Math.sqrt(rnd()) * 140, len = 0.4 + rnd() * 1.1;
    const x = Math.cos(a) * r, y = Math.sin(a) * r, d = rnd() * TAU;
    g.strokeStyle = rnd() < 0.55 ? `rgba(0,0,0,${0.08 + rnd() * 0.12})` : `rgba(255,248,230,${0.04 + rnd() * 0.08})`;
    g.lineWidth = 0.45;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(d) * len, y + Math.sin(d) * len); g.stroke();
  }
  for (let k = 0; k < 70; k++) {
    const a = rnd() * TAU, r = Math.sqrt(rnd()) * 138, rr = 5 + rnd() * 14;
    const m = g.createRadialGradient(Math.cos(a) * r, Math.sin(a) * r, 0, Math.cos(a) * r, Math.sin(a) * r, rr);
    m.addColorStop(0, rnd() < 0.5 ? "rgba(0,0,0,.07)" : "rgba(255,240,210,.05)"); m.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = m; g.beginPath(); g.arc(Math.cos(a) * r, Math.sin(a) * r, rr, 0, TAU); g.fill();
  }
  // Worn pin holes, denser around 20, 19 and the bull (where most darts land).
  const holes = (n: number, ang: number, spread: number, r0: number, r1: number) => {
    for (let k = 0; k < n; k++) {
      const a = ang + (rnd() - 0.5) * spread, r = r0 + rnd() * (r1 - r0);
      g.fillStyle = `rgba(0,0,0,${0.35 + rnd() * 0.3})`;
      g.beginPath(); g.arc(Math.cos(a) * r, Math.sin(a) * r, 0.35 + rnd() * 0.3, 0, TAU); g.fill();
    }
  };
  holes(160, -Math.PI / 2, 0.5, 30, 140);
  holes(90, Math.PI / 2, 0.5, 30, 140);
  holes(70, 0, TAU, 0, 30);
  holes(120, 0, TAU, 24, 140);
  // Soft inner shadow under the spider's outer ring.
  const rim = g.createRadialGradient(0, 0, 120, 0, 0, 141);
  rim.addColorStop(0, "rgba(0,0,0,0)"); rim.addColorStop(1, "rgba(0,0,0,.35)");
  g.fillStyle = rim; g.beginPath(); g.arc(0, 0, 141, 0, TAU); g.fill();
  g.restore();
  // Raised silver spider: shadow, body, lit edge.
  const wires = (stroke: string, width: number, dx: number, dy: number) => {
    g.strokeStyle = stroke; g.lineWidth = width;
    for (let i = 0; i < 20; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 10 - Math.PI / 20;
      g.beginPath(); g.moveTo(Math.cos(a) * 24 + dx, Math.sin(a) * 24 + dy); g.lineTo(Math.cos(a) * 140 + dx, Math.sin(a) * 140 + dy); g.stroke();
    }
    for (const r of [10, 24, 78, 88, 129, 140]) { g.beginPath(); g.arc(dx, dy, r, 0, TAU); g.stroke(); }
  };
  wires("rgba(0,0,0,.55)", 1.1, 0.7, 0.9);
  wires("#aeb7c4", 0.85, 0, 0);
  wires("rgba(255,255,255,.75)", 0.35, -0.25, -0.3);
  // Number ring: a round wire with embossed white numbers.
  g.strokeStyle = "rgba(0,0,0,.6)"; g.lineWidth = 1.4; g.beginPath(); g.arc(0.6, 0.8, 147, 0, TAU); g.stroke();
  g.strokeStyle = "#c9d1dc"; g.lineWidth = 1; g.beginPath(); g.arc(0, 0, 147, 0, TAU); g.stroke();
  g.textAlign = "center"; g.textBaseline = "middle"; g.font = "800 12.5px system-ui, sans-serif";
  for (let i = 0; i < 20; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 10, x = Math.cos(angle) * 151.5, y = Math.sin(angle) * 151.5;
    g.save(); g.translate(x, y);
    g.fillStyle = "rgba(0,0,0,.7)"; g.fillText(String(DARTS_SECTORS[i]), 0.6, 1.2);
    const chrome = g.createLinearGradient(0, -7, 0, 7);
    chrome.addColorStop(0, "#ffffff"); chrome.addColorStop(0.55, "#e6ebf1"); chrome.addColorStop(1, "#a7b0bd");
    g.fillStyle = chrome; g.fillText(String(DARTS_SECTORS[i]), 0, 0.5);
    g.restore();
  }
  // Key light from the upper left, falloff to the lower right, and a faint spec on the lacquer.
  const light = g.createRadialGradient(-60, -70, 10, 0, 0, 175);
  light.addColorStop(0, "rgba(255,246,226,.18)"); light.addColorStop(0.55, "rgba(0,0,0,0)"); light.addColorStop(1, "rgba(0,0,0,.42)");
  g.fillStyle = light; g.beginPath(); g.arc(0, 0, BOARD_R, 0, TAU); g.fill();
  g.strokeStyle = "rgba(255,255,255,.16)"; g.lineWidth = 2;
  g.beginPath(); g.arc(0, 0, 134.5, Math.PI * 1.05, Math.PI * 1.45); g.stroke();
  g.beginPath(); g.arc(0, 0, 83, Math.PI * 1.08, Math.PI * 1.42); g.stroke();
  boardCache = c;
  return c;
}
// Static arena layers, cached per view height and backing scale (presentation only).
// Per frame only the twinkling bokeh, the breathing cones and the dust are drawn live.
type ArenaCache = { key: string; under: HTMLCanvasElement; over: HTMLCanvasElement; cones: HTMLCanvasElement[]; bokeh: HTMLCanvasElement[] };
let arenaCache: ArenaCache | null = null;
const BOKEH_COLS = ["255,190,110", "127,227,238", "255,110,160", "200,210,255"] as const;
function layer(w: number, h: number, k: number, paint: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.ceil(w * k)); c.height = Math.max(1, Math.ceil(h * k));
  const g = c.getContext("2d")!; g.scale(k, k); paint(g);
  return c;
}
function coneShape(g: CanvasRenderingContext2D, lx: number, side: number) {
  g.beginPath(); g.moveTo(lx - 8, 14); g.lineTo(lx + 8, 14); g.lineTo(cx + side * -40 + 150 * side, cy + 160); g.lineTo(cx + side * -40 - 120 * side, cy + 190); g.closePath();
}
function arenaLayers(viewH: number, k: number): ArenaCache {
  const key = `${viewH}:${k}`;
  if (arenaCache?.key === key) return arenaCache;
  const under = layer(390, viewH, k, (g) => paintUnder(g, viewH));
  // One full-intensity bokeh sprite per colour (radius 18 covers every size); drawn scaled with alpha.
  const bokeh = BOKEH_COLS.map((col) => layer(36, 36, k, (g) => paintBokeh(g, col, 18, 18, 18, 1)));
  const cones = ([[48, 1], [342, -1]] as const).map(([lx, side]) => layer(390, viewH, k, (g) => paintCone(g, lx, side, 1)));
  const over = layer(390, viewH, k, (g) => paintOver(g, viewH));
  arenaCache = { key, under, over, cones, bokeh };
  return arenaCache;
}
function paintUnder(g: CanvasRenderingContext2D, viewH: number) {
  const hall = g.createLinearGradient(0, 0, 0, viewH);
  hall.addColorStop(0, "rgba(6,8,18,.78)"); hall.addColorStop(0.5, "rgba(8,10,24,.7)"); hall.addColorStop(1, "rgba(3,4,10,.9)");
  g.fillStyle = hall; g.fillRect(0, 0, 390, viewH);
  // Lighting truss across the top (the bokeh below never reaches it).
  g.fillStyle = "#151924"; g.fillRect(0, 4, 390, 10);
  g.strokeStyle = "rgba(150,165,190,.35)"; g.lineWidth = 1;
  for (let x = 0; x < 390; x += 14) { g.beginPath(); g.moveTo(x, 4); g.lineTo(x + 7, 14); g.lineTo(x + 14, 4); g.stroke(); }
}
function paintBokeh(g: CanvasRenderingContext2D, col: string, x: number, y: number, r: number, alpha: number) {
  const bo = g.createRadialGradient(x, y, 0, x, y, r);
  bo.addColorStop(0, `rgba(${col},${alpha})`); bo.addColorStop(1, `rgba(${col},0)`);
  g.fillStyle = bo; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
}
function paintCone(g: CanvasRenderingContext2D, lx: number, side: number, alpha: number) {
  const cone = g.createLinearGradient(lx, 14, cx, cy + 40);
  cone.addColorStop(0, `rgba(255,244,220,${alpha})`); cone.addColorStop(1, "rgba(255,244,220,0)");
  g.fillStyle = cone; coneShape(g, lx, side); g.fill();
}
function paintOver(g: CanvasRenderingContext2D, viewH: number) {
  for (const lx of [48, 195, 342]) {
    g.fillStyle = "#262c3a"; g.fillRect(lx - 10, 10, 20, 12);
    const lamp = g.createRadialGradient(lx, 22, 0, lx, 22, 16);
    lamp.addColorStop(0, "rgba(255,248,230,.95)"); lamp.addColorStop(1, "rgba(255,248,230,0)");
    g.fillStyle = lamp; g.beginPath(); g.arc(lx, 22, 16, 0, Math.PI * 2); g.fill();
  }
  // Coloured washes on the back wall, low on both sides (stage lighting).
  for (const [x0, col] of [[0, "255,70,150"], [390, "60,200,230"]] as const) {
    const wash = g.createRadialGradient(x0, viewH * 0.62, 0, x0, viewH * 0.62, 260);
    wash.addColorStop(0, `rgba(${col},.22)`); wash.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = wash; g.fillRect(0, 0, 390, viewH);
  }
  // Floor and the oche (throw line) near the bottom.
  const floorY = viewH - 150;
  const fl = g.createLinearGradient(0, floorY, 0, viewH);
  fl.addColorStop(0, "rgba(20,24,40,0)"); fl.addColorStop(0.3, "rgba(22,26,44,.85)"); fl.addColorStop(1, "rgba(10,12,22,.95)");
  g.fillStyle = fl; g.fillRect(0, floorY, 390, viewH - floorY);
  g.strokeStyle = "rgba(127,227,238,.06)"; g.lineWidth = 1;
  for (let q = -8; q <= 8; q++) { g.beginPath(); g.moveTo(195 + q * 18, floorY + 30); g.lineTo(195 + q * 60, viewH); g.stroke(); }
  const ocheY = viewH - 48;
  const oche = g.createLinearGradient(40, 0, 350, 0);
  oche.addColorStop(0, "rgba(255,210,122,0)"); oche.addColorStop(0.5, "rgba(255,210,122,.75)"); oche.addColorStop(1, "rgba(255,210,122,0)");
  g.fillStyle = oche; g.fillRect(40, ocheY, 310, 3);
}

/** The same arena painted straight onto the context (no DOM, e.g. presentation tests). */
function drawArenaDirect(ctx: CanvasRenderingContext2D, viewH: number, tick: number) {
  paintUnder(ctx, viewH);
  for (let q = 0; q < 34; q++) {
    const x = (q * 97.3) % 390, y = 40 + ((q * 53.7) % 150) + (q % 3) * 120;
    paintBokeh(ctx, BOKEH_COLS[q % 4], x, y, 6 + (q % 5) * 3, 0.26 + 0.16 * (0.5 + 0.5 * Math.sin(tick * 0.03 + q * 1.7)));
  }
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const [lx, side] of [[48, 1], [342, -1]] as const) paintCone(ctx, lx, side, 0.32 * (0.85 + 0.15 * Math.sin(tick * 0.02 + side)));
  ctx.restore();
  paintOver(ctx, viewH);
}
function drawArena(ctx: CanvasRenderingContext2D, viewH: number, tick: number) {
  drawSpaceBackdrop(ctx, 390, viewH, 0, tick);
  if (typeof document === "undefined" || typeof ctx.getTransform !== "function") { drawArenaDirect(ctx, viewH, tick); return; }
  const m = ctx.getTransform();
  const k = Math.min(3, Math.max(1, Math.round(Math.hypot(m.a, m.b) * 4) / 4));
  const L = arenaLayers(viewH, k);
  ctx.drawImage(L.under, 0, 0, 390, viewH);
  // Crowd lights out of focus (behind the board, both sides and above).
  ctx.save();
  for (let q = 0; q < 34; q++) {
    const x = (q * 97.3) % 390, y = 40 + ((q * 53.7) % 150) + (q % 3) * 120;
    const tw = 0.5 + 0.5 * Math.sin(tick * 0.03 + q * 1.7);
    const r = 6 + (q % 5) * 3;
    ctx.globalAlpha = 0.26 + 0.16 * tw;
    ctx.drawImage(L.bokeh[q % 4], x - r, y - r, r * 2, r * 2);
  }
  // Spotlight cones crossing on the board, with a slow breath and dust motes.
  ctx.globalCompositeOperation = "lighter";
  for (const [i, side] of [[0, 1], [1, -1]] as const) {
    ctx.globalAlpha = 0.32 * (0.85 + 0.15 * Math.sin(tick * 0.02 + side));
    ctx.drawImage(L.cones[i], 0, 0, 390, viewH);
  }
  ctx.globalAlpha = 1;
  for (let q = 0; q < 26; q++) {
    const t0 = (tick * (0.15 + (q % 5) * 0.04) + q * 37) % 300;
    const x = 70 + ((q * 61) % 250) + Math.sin((tick + q * 40) * 0.01) * 10, y = 30 + t0;
    ctx.fillStyle = `rgba(255,246,226,${0.25 * (1 - t0 / 300)})`; ctx.fillRect(x, y, 1.4, 1.4);
  }
  ctx.restore();
  ctx.drawImage(L.over, 0, 0, 390, viewH);
}
function render(ctx: CanvasRenderingContext2D, s: DartsStateV3, view?: { width: number; height: number }) {
  const viewH = Math.max(620, view?.height ?? 620);
  drawArena(ctx, viewH, s.tick);
  // Enlarged dartboard and embedded impacts; keep the V3 scoring geometry.
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(BOARD_ZOOM, BOARD_ZOOM);
  ctx.translate(-cx, -cy);
  const stage = dartsStageV3(s),
    remaining = Math.max(
      0,
      DARTS_RULES_V3.deadlineSeconds[stage] - s.phaseTicks / 120,
    );
  // Board shadow on the wall and the LED halo around the surround.
  ctx.fillStyle = "rgba(0,0,0,.55)";
  ctx.beginPath(); ctx.ellipse(cx + 7, cy + 11, 166, 166, 0, 0, Math.PI * 2); ctx.fill();
  const halo = 0.6 + 0.4 * Math.sin(s.tick * 0.025);
  const ring = ctx.createRadialGradient(cx, cy, 156, cx, cy, 180);
  ring.addColorStop(0, `rgba(127,227,238,${0.55 * halo})`); ring.addColorStop(0.35, `rgba(127,227,238,${0.18 * halo})`); ring.addColorStop(1, "rgba(127,227,238,0)");
  ctx.fillStyle = ring; ctx.beginPath(); ctx.arc(cx, cy, 180, 0, Math.PI * 2); ctx.fill();
  const sprite = boardSprite();
  if (sprite) ctx.drawImage(sprite, cx - BOARD_R, cy - BOARD_R, BOARD_R * 2, BOARD_R * 2);
  ctx.strokeStyle = `rgba(160,240,248,${0.5 + 0.3 * halo})`; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(cx, cy, BOARD_R + 1, 0, Math.PI * 2); ctx.stroke();
  // Impact flash and shockwave (stronger on bull, treble and double).
  {
    const hitNow = s.impacts.at(-1);
    const age = s.phase === "flight" ? s.phaseTicks - DARTS_RULES_V3.impactTicks : 999;
    if (hitNow && !hitNow.timeout && age >= 0 && age < 50) {
      const hx = cx + hitNow.x / 1000, hy = cy + hitNow.y / 1000, r = Math.hypot(hitNow.x, hitNow.y) / 1000;
      const big = r <= 24 || (r >= 78 && r <= 88) || (r >= 129 && r <= 140);
      const k = age / 50, col = big ? "255,214,110" : "190,248,255";
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const fl = ctx.createRadialGradient(hx, hy, 0, hx, hy, (big ? 46 : 26) * (0.6 + k));
      fl.addColorStop(0, `rgba(${col},${(big ? 0.9 : 0.6) * (1 - k)})`); fl.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = fl; ctx.beginPath(); ctx.arc(hx, hy, (big ? 46 : 26) * (0.6 + k), 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = `rgba(${col},${0.8 * (1 - k)})`; ctx.lineWidth = big ? 2.5 : 1.5;
      ctx.beginPath(); ctx.arc(hx, hy, 6 + k * (big ? 60 : 34), 0, Math.PI * 2); ctx.stroke();
      if (big) for (let q = 0; q < 10; q++) {
        const a = q * 0.628 + 0.3, d0 = 6 + k * 18, d1 = d0 + 10 + k * 26;
        ctx.beginPath(); ctx.moveTo(hx + Math.cos(a) * d0, hy + Math.sin(a) * d0); ctx.lineTo(hx + Math.cos(a) * d1, hy + Math.sin(a) * d1); ctx.stroke();
      }
      ctx.restore();
    }
  }

  // The tip stays at the server-owned impact. Never display the newest
  // recorded impact before the flying dart has actually reached the board.
  for (let i = 0; i < s.impacts.length; i++) {
    const hit = s.impacts[i];
    const flying = i === s.impacts.length - 1 && s.phase === "flight";
    if (hit.timeout || (flying && s.phaseTicks < DARTS_RULES_V3.impactTicks)) continue;
    const pose = dartPerspectiveFlight(cx + hit.x / 1000, cy + hit.y / 1000, DARTS_RULES_V3.impactTicks);
    drawDart(ctx, { ...pose, scale: 0.62 }, dartLook());
  }
  const pose = (s.phase === "flight" && s.phaseTicks >= DARTS_RULES_V3.impactTicks) || (s.phase === "aim" && held.active)
    ? null : dartPerspectivePose(s);
  if (pose) {
    const impact = s.impacts.at(-1);
    if (s.phase === "flight" && s.phaseTicks < 120 && impact) {
      ctx.strokeStyle = "rgba(184,246,255,.42)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (
        let age = Math.max(0, s.phaseTicks - 6);
        age <= s.phaseTicks;
        age += 2
      ) {
        const p = dartPerspectiveFlight(
          cx + impact.x / 1000,
          cy + impact.y / 1000,
          age,
        );
        if (age === Math.max(0, s.phaseTicks - 6)) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
    drawDart(ctx, pose, dartLook());
  }
  ctx.restore();
  if (s.phase === "aim" && held.active) {
    // The dart sits in the fingers: a short motion trail and the dart tilted along the movement.
    const tr = held.trail, a = tr.length > 2 ? tr[tr.length - 3] : tr[0];
    for (let i = 1; i < tr.length; i++) {
      ctx.strokeStyle = `rgba(142,233,214,${(i / tr.length) * 0.5})`; ctx.lineWidth = 2 + 6 * (i / tr.length);
      ctx.beginPath(); ctx.moveTo(tr[i - 1].x, tr[i - 1].y - 30); ctx.lineTo(tr[i].x, tr[i].y - 30); ctx.stroke();
    }
    const tilt = a ? Math.max(-0.6, Math.min(0.6, (held.x - a.x) / 40)) : 0;
    drawDart(ctx, { x: held.x, y: held.y - 30, angle: tilt, scale: 1.35 }, dartLook());
  }
  const hit = s.impacts.at(-1);
  if (hit && s.phase === "flight" && s.phaseTicks >= DARTS_RULES_V3.impactTicks) {
    ctx.fillStyle = hit.points ? "#a1eed3" : "#e6b597";
    ctx.textAlign = "center";
    ctx.font = "900 32px system-ui";
    ctx.fillText(`+${hit.points}`, cx, 500);
  }
  ctx.fillStyle = "#b4d3df";
  ctx.textAlign = "center";
  ctx.font = "bold 13px system-ui";
  // v154: the darts left are in the shared scoreboard (and the row of darts at the bottom).
  const left = Math.max(0, 20 - s.impacts.length);
  // Fila de dardos restantes (themed counter) at the bottom of the screen.
  const rowY = viewH - 26;
  for (let i = 0; i < 20; i++) {
    const dx = 195 + (i - 9.5) * 16;
    ctx.fillStyle = i < left ? "#8ee9d6" : "rgba(120,150,170,.25)";
    ctx.beginPath();
    ctx.moveTo(dx, rowY - 9);
    ctx.lineTo(dx + 4, rowY + 7);
    ctx.lineTo(dx - 4, rowY + 7);
    ctx.closePath();
    ctx.fill();
  }
  if (s.phase === "aim") {
    // Handle for the throw swipe: pulsing ring + chevrons in the lower thumb zone.
    const pulse = 0.5 + 0.5 * Math.sin(s.tick / 14);
    const hy = viewH - 92;
    ctx.strokeStyle = `rgba(142,233,214,${0.25 + pulse * 0.35})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(195, hy, 26 + pulse * 6, 0, Math.PI * 2);
    ctx.stroke();
    for (let k = 0; k < 3; k++) {
      ctx.strokeStyle = `rgba(142,233,214,${0.2 + ((pulse + k / 3) % 1) * 0.6})`;
      ctx.beginPath();
      ctx.moveTo(183, hy - 4 - k * 9);
      ctx.lineTo(195, hy - 12 - k * 9);
      ctx.lineTo(207, hy - 4 - k * 9);
      ctx.stroke();
    }
  }
  ctx.fillStyle = "#294257";
  ctx.beginPath();
  ctx.roundRect(105, 85, 180, 4, 2);
  ctx.fill();
  ctx.fillStyle = remaining < 3 ? "#e7b488" : "#81d6b7";
  ctx.beginPath();
  ctx.roundRect(
    105,
    85,
    180 *
      (s.phase === "aim"
        ? remaining / DARTS_RULES_V3.deadlineSeconds[stage]
        : 1),
    4,
    2,
  );
  ctx.fill();
  ctx.textAlign = "left";
}
const tones = { THROW: "tap" } as const,
  keys = { " ": "THROW", Enter: "THROW" };
const feedbackScore = (s: Readonly<DartsStateV3>) => s.total;
const hudLabel = (s: Readonly<DartsStateV3>) => t("play.points", { n: formatNumber(s.total) });
const scoreCells = (s: Readonly<DartsStateV3>): ScoreCell[] => [
  { label: t("hud.points"), value: formatNumber(s.total), main: true },
  { label: t("hud.darts"), value: String(Math.max(0, 20 - s.impacts.length)) },
];
export default function Darts(props: GameRuntimeProps) {
  useI18n();
  // Grab-and-throw: touching anywhere picks the dart up (it follows the finger); the flick itself — direction and
  // speed at release — decides where it lands (dartsFlickAimV4). A slow or downward release puts it back.
  const pathRef = useRef<DartsGestureSample[] | null>(null);
  useEffect(() => {
    pathRef.current = null;
    held.active = false;
    return () => {
      pathRef.current = null;
      held.active = false;
    };
  }, [props.active, props.seed]);
  const aim = useCallback(
    (point: CorePoint, phase: "down" | "move" | "up", state: DartsStateV3) => {
      if (state.phase !== "aim") {
        pathRef.current = null;
        held.active = false;
        return null;
      }
      const now = typeof performance === "undefined" ? 0 : performance.now();
      if (phase === "down") {
        pathRef.current = [{ x: point.x, y: point.y, t: now }];
        held.active = true; held.x = point.x; held.y = point.y; held.trail = [{ x: point.x, y: point.y }];
        return null;
      }
      const path = pathRef.current;
      if (!path) return null;
      path.push({ x: point.x, y: point.y, t: now });
      held.x = point.x; held.y = point.y; held.trail.push({ x: point.x, y: point.y }); if (held.trail.length > 12) held.trail.shift();
      if (phase === "move") return null;
      pathRef.current = null;
      held.active = false;
      const flick = dartsFlickAimV4(path);
      if (!flick) return null;
      const out: string[] = [];
      if (flick.x !== state.aimX) out.push(dartsAimAction("X", flick.x));
      if (flick.y !== state.aimY) out.push(dartsAimAction("Y", flick.y));
      out.push("THROW");
      return out;
    },
    [],
  );
  return (
    <div className="dartsVerified">
      <CoreCanvasGame
        {...props}
        core={DARTS_CORE_V3}
        name="Dardos"
        render={render}
        pointAction={aim}
        controls={[]}
        inputTones={tones}
        keys={keys}
        hideHudScore
        expandVerticalViewport
        hudLabel={hudLabel}
        scoreCells={scoreCells}
        feedbackScore={feedbackScore}
        instruction=""
      />
    </div>
  );
}
