"use client";
import { useCallback } from "react";
import { preload } from "react-dom";
import type { GameRuntimeProps } from "@/lib/games";
import { gameTone } from "@/lib/gameFeedback";
import {
  SHOT_GALLERY_CORE_V12 as core,
  GALLERY_V12_CIVILIAN,
  type GalleryStateV12,
  type GalleryTargetV12,
} from "@/lib/verified/shotGalleryCore.v12";
import CoreCanvasGame, { type CorePoint } from "./CoreCanvasGame";
import { t as tx, formatNumber, useI18n, type MessageKey } from "@/lib/i18n";

/*
 * Presentation only (V12 core: "Hangar 7", 12 spots behind four cover lines; score = accumulated reaction time).
 * Reads the authoritative state and never writes it. The painted hangar (scripts/render-gallery-scene.py) is drawn
 * in layers: background, then each row's creatures followed by that row's cover pieces, so nearer rows stay in
 * front. Every shot leaves a mark where it landed for the rest of the run (presentation memory of the taps).
 */
const SCENE_SRC = "/art/gallery-scene.webp?v=124";
const COVER_SRC = "/art/gallery-cover.webp?v=124";
const IMG_Y0 = -140, IMG_H = 900, IMG_PX = 2;
/** World-y slices of the cover layer, one per row (row r's creatures are drawn just before slice r). */
const COVER_SLICES: readonly (readonly [number, number])[] = [[246, 302], [302, 380], [380, 506], [506, 760]];
const ROW_Y = [232, 322, 420, 520];
const rowOf = (t: { y: number }) => Math.max(0, ROW_Y.indexOf(t.y));
const msOf = (ticks: number) => Math.round((ticks * 1000) / 120);
const noise = (n: number) => { const v = Math.sin(n * 12.9898) * 43758.5453; return v - Math.floor(v); };
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeOutBack = (t: number) => { const c = 1.6; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; };
const FONT = '"Unbounded", "Inter", system-ui, sans-serif';

type Pal = { body: string; dark: string; accent: string; eye: string };
/** Colour schemes per species (0..5) and civilians (6). Camouflaged decoys use another species' scheme. */
const PAL: readonly Pal[] = [
  { body: "#9b5cff", dark: "#34106e", accent: "#ff7ad9", eye: "#ffe14a" }, // kraken
  { body: "#aab6c8", dark: "#2c3442", accent: "#ff3b3b", eye: "#ff2b2b" }, // drone
  { body: "#86de4f", dark: "#225614", accent: "#e2ff7a", eye: "#ff9b2a" }, // mantis
  { body: "#ff8a2a", dark: "#8c3006", accent: "#ffd36a", eye: "#ffffff" }, // slime
  { body: "#3e4c70", dark: "#080b16", accent: "#5ef0ff", eye: "#a6fdff" }, // wraith
  { body: "#94826f", dark: "#2f2721", accent: "#ff6a1f", eye: "#ffc04a" }, // golem
  { body: "#eef2f6", dark: "#7f8b9b", accent: "#2f7bff", eye: "#ffb347" }, // civilian
];
const SPECIES_KEYS = ["kraken", "drone", "mantis", "slime", "wraith", "golem"] as const;
const speciesName = (i: number) => tx(`gallery.sp.${SPECIES_KEYS[i] ?? "kraken"}` as MessageKey);

function hexRgb(h: string) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function mix(a: string, b: string, t: number, alpha = 1) {
  const A = hexRgb(a), B = hexRgb(b);
  return `rgba(${Math.round(A[0] + (B[0] - A[0]) * t)},${Math.round(A[1] + (B[1] - A[1]) * t)},${Math.round(A[2] + (B[2] - A[2]) * t)},${alpha})`;
}
function ball(g: CanvasRenderingContext2D, x: number, y: number, r: number, p: Pal, rx = r, ry = r) {
  const gr = g.createRadialGradient(x - rx * 0.35, y - ry * 0.42, r * 0.08, x, y, r * 1.08);
  gr.addColorStop(0, mix(p.body, "#ffffff", 0.45)); gr.addColorStop(0.5, p.body); gr.addColorStop(1, p.dark);
  g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill();
}
/** A tapering limb as a string of overlapping discs along a quadratic curve. */
function limb(g: CanvasRenderingContext2D, pts: [number, number, number, number, number, number], r0: number, r1: number, p: Pal, suckers = false) {
  const [x0, y0, cx, cy, x1, y1] = pts;
  for (let k = 0; k <= 26; k++) {
    const t = k / 26, u = 1 - t;
    const x = u * u * x0 + 2 * u * t * cx + t * t * x1, y = u * u * y0 + 2 * u * t * cy + t * t * y1, r = r0 + (r1 - r0) * t;
    ball(g, x, y, r, p);
    if (suckers && k % 4 === 2) { g.fillStyle = mix(p.accent, "#ffffff", 0.2, 0.75); g.beginPath(); g.arc(x + r * 0.35, y + r * 0.25, r * 0.32, 0, Math.PI * 2); g.fill(); }
  }
}
function glowDot(g: CanvasRenderingContext2D, x: number, y: number, r: number, c: string) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r * 3);
  gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.25, c); gr.addColorStop(1, mix(c, c, 0, 0));
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r * 3, 0, Math.PI * 2); g.fill();
}

/** Draws one creature centred on (0,0); body roughly x −55..55, y −62..60 (the lower part hides behind cover). */
function drawSpecies(g: CanvasRenderingContext2D, species: number, p: Pal) {
  g.lineCap = "round"; g.lineJoin = "round";
  if (species === 0) {
    // Kraken: one huge eye, raised curling tentacles.
    limb(g, [-20, 10, -50, -4, -42, -42], 9, 3, p, true);
    limb(g, [20, 10, 52, -2, 44, -40], 9, 3, p, true);
    limb(g, [-12, 18, -20, 40, -26, 62], 10, 6, p, true);
    limb(g, [12, 18, 22, 40, 26, 62], 10, 6, p, true);
    ball(g, 0, -16, 34, p, 31, 37);
    g.fillStyle = mix(p.accent, p.body, 0.3, 0.45);
    for (const [x, y, r] of [[-17, -36, 4], [-8, -46, 3], [14, -40, 3.5], [21, -26, 2.5], [-22, -20, 2.5]]) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = "#f6f2ff"; g.beginPath(); g.ellipse(0, -10, 15, 12.5, 0, 0, Math.PI * 2); g.fill();
    const iris = g.createRadialGradient(0, -10, 1, 0, -10, 9);
    iris.addColorStop(0, "#fff8c0"); iris.addColorStop(0.6, p.eye); iris.addColorStop(1, mix(p.eye, "#000000", 0.55));
    g.fillStyle = iris; g.beginPath(); g.arc(0, -10, 9, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#090410"; g.beginPath(); g.ellipse(0, -10, 2.6, 7.5, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "rgba(255,255,255,.9)"; g.beginPath(); g.arc(-4, -14, 2.2, 0, Math.PI * 2); g.fill();
    g.strokeStyle = p.dark; g.lineWidth = 3.5; g.beginPath(); g.arc(0, -8, 18, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
  } else if (species === 1) {
    // Drone: metal sphere, red visor slit, side blasters, thruster glow.
    glowDot(g, 0, 40, 7, p.accent);
    for (const sx of [-1, 1]) {
      g.fillStyle = mix(p.dark, "#000000", 0.2); g.beginPath(); g.roundRect(sx < 0 ? -50 : 28, -12, 22, 15, 4); g.fill();
      g.fillStyle = mix(p.body, "#ffffff", 0.2); g.fillRect(sx < 0 ? -48 : 30, -10, 18, 3);
      g.fillStyle = "#11151c"; g.beginPath(); g.arc(sx * 47, 2, 4.5, 0, Math.PI * 2); g.fill();
      glowDot(g, sx * 47, 2, 1.6, p.accent);
    }
    g.strokeStyle = mix(p.body, "#000000", 0.3); g.lineWidth = 2.2;
    for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(sx * 11, -32); g.lineTo(sx * 19, -54); g.stroke(); glowDot(g, sx * 19, -55, 2, p.accent); }
    ball(g, 0, -6, 31, p);
    g.strokeStyle = mix(p.dark, "#000000", 0.3, 0.9); g.lineWidth = 2; g.beginPath(); g.ellipse(0, -2, 31, 9, 0, 0, Math.PI); g.stroke();
    g.fillStyle = "#07090e"; g.beginPath(); g.roundRect(-24, -22, 48, 15, 7); g.fill();
    const slit = g.createLinearGradient(-20, 0, 20, 0);
    slit.addColorStop(0, mix(p.accent, p.accent, 0, 0)); slit.addColorStop(0.5, p.accent); slit.addColorStop(1, mix(p.accent, p.accent, 0, 0));
    g.fillStyle = slit; g.fillRect(-20, -16, 40, 3);
    glowDot(g, 0, -14.5, 3, p.eye);
    g.fillStyle = "rgba(255,255,255,.5)"; for (const [x, y] of [[-20, 6], [20, 6], [-12, 16], [12, 16]]) { g.beginPath(); g.arc(x, y, 1.3, 0, Math.PI * 2); g.fill(); }
  } else if (species === 2) {
    // Mantis: triangular head with compound eyes, raised scythes.
    for (const sx of [-1, 1]) {
      const sc = g.createLinearGradient(sx * 16, 0, sx * 46, -40);
      sc.addColorStop(0, p.dark); sc.addColorStop(1, p.body);
      g.fillStyle = sc; g.beginPath();
      g.moveTo(sx * 14, 2); g.quadraticCurveTo(sx * 40, -6, sx * 46, -38); g.quadraticCurveTo(sx * 50, -16, sx * 36, -2); g.quadraticCurveTo(sx * 30, -10, sx * 20, 10); g.closePath(); g.fill();
      g.strokeStyle = mix(p.accent, "#ffffff", 0.3, 0.9); g.lineWidth = 1.4; g.beginPath(); g.moveTo(sx * 45, -36); g.quadraticCurveTo(sx * 48, -16, sx * 36, -3); g.stroke();
    }
    ball(g, 0, 22, 22, p, 17, 28);
    g.strokeStyle = p.dark; g.lineWidth = 1.5; for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(-14, 10 + k * 8); g.quadraticCurveTo(0, 14 + k * 8, 14, 10 + k * 8); g.stroke(); }
    g.strokeStyle = mix(p.body, "#000000", 0.25); g.lineWidth = 1.6;
    for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(sx * 6, -42); g.quadraticCurveTo(sx * 12, -62, sx * 26, -64); g.stroke(); }
    const hd = g.createLinearGradient(0, -46, 0, -4);
    hd.addColorStop(0, mix(p.body, "#ffffff", 0.3)); hd.addColorStop(1, p.dark);
    g.fillStyle = hd; g.beginPath(); g.moveTo(-30, -40); g.quadraticCurveTo(0, -52, 30, -40); g.quadraticCurveTo(14, -18, 0, -4); g.quadraticCurveTo(-14, -18, -30, -40); g.fill();
    for (const sx of [-1, 1]) {
      const eg = g.createRadialGradient(sx * 15 - 3, -35, 1, sx * 15, -33, 11);
      eg.addColorStop(0, "#fff3c4"); eg.addColorStop(0.45, p.eye); eg.addColorStop(1, mix(p.eye, "#000000", 0.6));
      g.fillStyle = eg; g.beginPath(); g.ellipse(sx * 15, -33, 11, 9, sx * 0.35, 0, Math.PI * 2); g.fill();
      g.fillStyle = "rgba(0,0,0,.18)"; for (let k = 0; k < 9; k++) { g.beginPath(); g.arc(sx * 15 + ((k % 3) - 1) * 5, -33 + (Math.floor(k / 3) - 1) * 4.5, 1.1, 0, Math.PI * 2); g.fill(); }
    }
    g.strokeStyle = mix(p.dark, "#000000", 0.4); g.lineWidth = 2.4;
    for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(sx * 3, -8); g.quadraticCurveTo(sx * 8, -2, sx * 4, 3); g.stroke(); }
  } else if (species === 3) {
    // Slime: a glossy blob with three eyes and a toothy grin.
    g.save(); g.globalAlpha = 0.95;
    const bg = g.createRadialGradient(-12, -22, 4, 0, -4, 46);
    bg.addColorStop(0, mix(p.body, "#ffffff", 0.5)); bg.addColorStop(0.55, p.body); bg.addColorStop(1, p.dark);
    g.fillStyle = bg; g.beginPath();
    for (let k = 0; k <= 60; k++) {
      const a = (k / 60) * Math.PI * 2, r = 38 + 4 * Math.sin(a * 3 + 1) + 2.5 * Math.sin(a * 5 + 2);
      const x = Math.cos(a) * r * 1.05, y = -4 + Math.sin(a) * r * (Math.sin(a) > 0 ? 1.25 : 1);
      k ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.closePath(); g.fill(); g.restore();
    g.fillStyle = mix(p.accent, "#ffffff", 0.4, 0.35);
    for (const [x, y, r] of [[18, 10, 5], [-22, 14, 3.5], [8, 24, 3], [24, -10, 2.5]]) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = "rgba(255,255,255,.55)"; g.beginPath(); g.ellipse(-16, -28, 10, 5, -0.5, 0, Math.PI * 2); g.fill();
    for (const [x, y, r] of [[-13, -15, 9], [11, -21, 7], [5, -4, 5]]) {
      g.fillStyle = "#ffffff"; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#1a0a02"; g.beginPath(); g.arc(x + r * 0.2, y + r * 0.15, r * 0.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#ffffff"; g.beginPath(); g.arc(x - r * 0.1, y - r * 0.2, r * 0.16, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = "#2a0d02"; g.beginPath(); g.moveTo(-20, 8); g.quadraticCurveTo(0, 30, 22, 6); g.quadraticCurveTo(0, 16, -20, 8); g.fill();
    g.fillStyle = "#fff6e6";
    for (let k = 0; k < 6; k++) { const x = -15 + k * 6.4; g.beginPath(); g.moveTo(x, 10 + Math.abs(k - 2.5) * -0.6); g.lineTo(x + 3, 16); g.lineTo(x + 6, 10); g.fill(); }
  } else if (species === 4) {
    // Wraith: hooded cloak, a void face with two burning eyes, claws.
    const aura = g.createRadialGradient(0, -20, 6, 0, -14, 60);
    aura.addColorStop(0, mix(p.accent, p.accent, 0, 0.35)); aura.addColorStop(1, mix(p.accent, p.accent, 0, 0));
    g.fillStyle = aura; g.beginPath(); g.arc(0, -14, 60, 0, Math.PI * 2); g.fill();
    const cl = g.createLinearGradient(0, -62, 0, 60);
    cl.addColorStop(0, mix(p.body, "#ffffff", 0.25)); cl.addColorStop(0.5, p.body); cl.addColorStop(1, p.dark);
    g.fillStyle = cl; g.beginPath();
    g.moveTo(0, -62); g.quadraticCurveTo(28, -50, 30, -18); g.quadraticCurveTo(46, 0, 44, 60);
    for (let k = 0; k <= 8; k++) g.lineTo(44 - k * 11, 60 - (k % 2) * 10);
    g.quadraticCurveTo(-46, 0, -30, -18); g.quadraticCurveTo(-28, -50, 0, -62); g.fill();
    g.fillStyle = "#020306"; g.beginPath(); g.ellipse(0, -26, 17, 21, 0, 0, Math.PI * 2); g.fill();
    for (const sx of [-1, 1]) { glowDot(g, sx * 7, -28, 2.6, p.accent); g.fillStyle = p.eye; g.beginPath(); g.ellipse(sx * 7, -28, 4.5, 1.6, sx * -0.3, 0, Math.PI * 2); g.fill(); }
    g.strokeStyle = mix(p.accent, "#ffffff", 0.2, 0.6); g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, -62); g.quadraticCurveTo(26, -50, 28, -20); g.stroke();
    g.strokeStyle = "#cfd6e4"; g.lineWidth = 2.2;
    for (const sx of [-1, 1]) for (let f = 0; f < 3; f++) { g.beginPath(); g.moveTo(sx * 30, 4); g.quadraticCurveTo(sx * (40 + f * 3), -4 - f * 4, sx * (44 + f * 2), -14 - f * 6); g.stroke(); }
  } else if (species === 5) {
    // Golem: boulder head with magma cracks, raised stone fists.
    const rock = (pts: number[][]) => {
      const gr = g.createLinearGradient(-40, -50, 40, 30);
      gr.addColorStop(0, mix(p.body, "#ffffff", 0.3)); gr.addColorStop(0.55, p.body); gr.addColorStop(1, p.dark);
      g.fillStyle = gr; g.beginPath(); pts.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill();
    };
    rock([[-58, -30], [-44, -46], [-28, -40], [-26, -16], [-40, -4], [-56, -12]]);
    rock([[58, -30], [44, -46], [28, -40], [26, -16], [40, -4], [56, -12]]);
    rock([[-34, -38], [-10, -56], [22, -50], [38, -18], [32, 22], [0, 30], [-32, 22], [-40, -10]]);
    g.fillStyle = "rgba(0,0,0,.22)"; for (let k = 0; k < 22; k++) { g.beginPath(); g.arc(-30 + noise(k) * 60, -46 + noise(k + 9) * 66, 0.8 + noise(k + 3) * 1.6, 0, Math.PI * 2); g.fill(); }
    g.save(); g.shadowColor = p.accent; g.shadowBlur = 8; g.strokeStyle = p.accent; g.lineWidth = 2;
    for (const line of [[[-24, -30], [-12, -20], [-16, -6], [-4, 6]], [[18, -38], [10, -24], [20, -10]], [[-48, -34], [-38, -22]], [[48, -34], [40, -20]]]) {
      g.beginPath(); line.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
    }
    g.restore();
    g.fillStyle = "#1a1410"; g.beginPath(); g.roundRect(-20, -26, 40, 10, 4); g.fill();
    for (const sx of [-1, 1]) glowDot(g, sx * 9, -21, 2.4, p.eye);
  } else {
    // Civilian: astronaut with hands up.
    const suit: Pal = p;
    for (const sx of [-1, 1]) {
      limb(g, [sx * 18, -2, sx * 34, -10, sx * 34, -40], 6.5, 6, suit);
      g.fillStyle = suit.accent; g.beginPath(); g.arc(sx * 34, -45, 7, 0, Math.PI * 2); g.fill();
      g.fillStyle = mix(suit.accent, "#ffffff", 0.4); for (let f = 0; f < 4; f++) { g.beginPath(); g.roundRect(sx * 34 - 6 + f * 3.2, -56, 2.6, 8, 1.3); g.fill(); }
    }
    const tg = g.createLinearGradient(-22, 0, 22, 0);
    tg.addColorStop(0, suit.dark); tg.addColorStop(0.4, suit.body); tg.addColorStop(1, mix(suit.dark, "#000000", 0.1));
    g.fillStyle = tg; g.beginPath(); g.roundRect(-22, -8, 44, 64, 14); g.fill();
    g.fillStyle = suit.accent; g.fillRect(-22, 8, 44, 4); g.fillRect(-22, 16, 44, 2);
    g.fillStyle = "#1c2a3a"; g.beginPath(); g.roundRect(-9, 22, 18, 12, 3); g.fill();
    g.fillStyle = "#7ff0a0"; g.fillRect(-6, 25, 4, 2); g.fillStyle = "#ffcc4a"; g.fillRect(0, 25, 4, 2);
    ball(g, 0, -26, 23, suit);
    const vz = g.createLinearGradient(-12, -36, 12, -14);
    vz.addColorStop(0, "#ffe3a0"); vz.addColorStop(0.5, suit.eye); vz.addColorStop(1, "#7a3a10");
    g.fillStyle = vz; g.beginPath(); g.ellipse(0, -25, 15, 12, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "rgba(255,255,255,.7)"; g.beginPath(); g.ellipse(-6, -30, 5, 2.4, -0.6, 0, Math.PI * 2); g.fill();
    glowDot(g, 15, -44, 1.4, "#7ff0a0");
  }
}

const SPR = 3, BOX_W = 120, BOX_H = 132, ORX = 60, ORY = 68;
const spriteCache = new Map<string, HTMLCanvasElement | null>();
/** Atmospheric haze per row (far rows sit deeper in the hangar's blue air). */
const ROW_HAZE = [0.24, 0.13, 0.04, 0];
function sprite(species: number, tint: number, holo: boolean, haze = 0) {
  const key = `${species}:${tint}:${holo ? 1 : 0}:${haze}`;
  if (spriteCache.has(key)) return spriteCache.get(key) ?? null;
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = BOX_W * SPR; c.height = BOX_H * SPR;
  const g = c.getContext("2d");
  if (!g) { spriteCache.set(key, null); return null; }
  g.scale(SPR, SPR); g.translate(ORX, ORY);
  drawSpecies(g, species, PAL[tint] ?? PAL[species]);
  g.setTransform(1, 0, 0, 1, 0, 0);
  // Volume: warm top, cool dark toward the cover line.
  g.globalCompositeOperation = "source-atop";
  const vg = g.createLinearGradient(0, 0, 0, c.height);
  vg.addColorStop(0, "rgba(255,236,210,.10)"); vg.addColorStop(0.45, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,6,20,.5)");
  g.fillStyle = vg; g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = "source-over";
  // Rim light from the viewport behind (upper left): the silhouette minus itself shifted down-right.
  const rim = document.createElement("canvas");
  rim.width = c.width; rim.height = c.height;
  const rg = rim.getContext("2d");
  if (rg) {
    rg.drawImage(c, 0, 0);
    rg.globalCompositeOperation = "destination-out";
    rg.drawImage(c, 1.6 * SPR, 1.8 * SPR);
    rg.globalCompositeOperation = "source-in";
    rg.fillStyle = "rgba(175,222,255,.75)"; rg.fillRect(0, 0, rim.width, rim.height);
    g.drawImage(rim, 0, 0);
  }
  if (haze > 0) {
    g.globalCompositeOperation = "source-atop";
    g.fillStyle = `rgba(62,92,132,${haze})`; g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = "source-over";
  }
  if (holo) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = "source-atop";
    g.fillStyle = "rgba(90,232,255,.62)"; g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = "destination-out";
    g.fillStyle = "rgba(0,0,0,.55)";
    for (let y = 0; y < c.height; y += 3 * SPR) g.fillRect(0, y, c.width, SPR);
    g.globalCompositeOperation = "source-over";
  }
  spriteCache.set(key, c);
  return c;
}

/** White silhouette of a sprite, for the hit flash. */
const flashCache = new Map<HTMLCanvasElement, HTMLCanvasElement | null>();
function flashOf(src: HTMLCanvasElement) {
  if (flashCache.has(src)) return flashCache.get(src) ?? null;
  const c = document.createElement("canvas");
  c.width = src.width; c.height = src.height;
  const g = c.getContext("2d");
  if (!g) { flashCache.set(src, null); return null; }
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = "source-atop";
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, c.width, c.height);
  flashCache.set(src, c);
  return c;
}

/* ---------------------------------------------------------------- scene images (painted once, cached) */
let sceneImg: HTMLImageElement | null = null, coverImg: HTMLImageElement | null = null, coverAlpha: Uint8ClampedArray | null = null;
function assets() {
  if (sceneImg || typeof Image === "undefined") return;
  sceneImg = new Image(); sceneImg.decoding = "async"; sceneImg.src = SCENE_SRC;
  coverImg = new Image(); coverImg.decoding = "async"; coverImg.src = COVER_SRC;
  coverImg.onload = () => {
    try {
      const c = document.createElement("canvas"); c.width = 390 * IMG_PX; c.height = IMG_H * IMG_PX;
      const g = c.getContext("2d", { willReadFrequently: true });
      if (!g || !coverImg) return;
      g.drawImage(coverImg, 0, 0);
      coverAlpha = g.getImageData(0, 0, c.width, c.height).data;
    } catch { coverAlpha = null; }
  };
}
const ready = (im: HTMLImageElement | null): im is HTMLImageElement => !!im && im.complete && im.naturalWidth > 0;
/** Which cover row (0..3) is solid at a world point, or −1 for the background. */
function coverRowAt(x: number, y: number) {
  if (!coverAlpha) return -1;
  const px = Math.round(x * IMG_PX), py = Math.round((y - IMG_Y0) * IMG_PX);
  if (px < 0 || py < 0 || px >= 390 * IMG_PX || py >= IMG_H * IMG_PX) return -1;
  if (coverAlpha[(py * 390 * IMG_PX + px) * 4 + 3] < 128) return -1;
  return COVER_SLICES.findIndex(([a, b]) => y >= a && y < b);
}

/* ---------------------------------------------------------------- shot marks (presentation memory of the taps) */
type Mark = { x: number; y: number; tick: number; trial: number; layer: number; target: number; id: number };
let marks: Mark[] = [], marksSeed = "", lastTickSeen = 0;
function syncMarks(s: GalleryStateV12) {
  if (marksSeed !== s.seed || s.tick < lastTickSeen) { marks = []; marksSeed = s.seed; }
  lastTickSeen = s.tick;
}
/** Tall phones: the scene is centred in the taller canvas (presentation only; taps use the same offset). */
let gridDy = 0;
const offsetFor = (H: number) => Math.round(Math.min(130, Math.max(0, (H - 620) / 2)));

/** Rise of a creature out of its cover (0 hidden, 1 up), its knock-down and its per-frame offset. */
function pose(s: GalleryStateV12, i: number, t: GalleryTargetV12) {
  const sc = t.scaleMilli / 1000, fb = s.phase === "feedback" ? s.phaseTicks : 0;
  const up = s.phase === "waiting" || s.readyTick < 0 ? 0 : easeOutBack(clamp01((s.tick - s.readyTick) / 8));
  const down = s.phase === "feedback" ? clamp01((fb - 54) / 14) : 0;
  const hitAt = s.hits.indexOf(i), hitTick = hitAt >= 0 ? s.readyTick + (s.tapTicks[hitAt] ?? 0) : -1;
  const age = hitTick >= 0 ? s.tick - hitTick : -1;
  const knock = hitTick >= 0 ? clamp01((age - 4) / 12) : 0;
  const wrongAge = s.lastPick === i && hitAt < 0 && s.lastTapTick >= s.readyTick ? s.tick - s.lastTapTick : -1;
  const duck = t.species === GALLERY_V12_CIVILIAN && wrongAge >= 0 ? clamp01(wrongAge / 6) * 0.35 : 0;
  const rise = Math.max(0, up * (1 - down) - knock * knock * 1.2 - duck);
  const bob = Math.sin((s.tick + t.spot * 17) * 0.07) * 1.4 * sc;
  return { sc, rise, knock, age, wrongAge, y: t.y + gridDy + (1 - rise) * 96 * sc + bob, x: t.x };
}

function drawCreature(ctx: CanvasRenderingContext2D, s: GalleryStateV12, i: number, t: GalleryTargetV12) {
  const p = pose(s, i, t);
  if (p.rise <= 0.001) return;
  const cover = t.cover + gridDy;
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, 390, cover); ctx.clip();
  const dim = s.phase === "feedback" && t.decoy !== "NONE" ? 0.5 : 1;
  let alpha = dim;
  if (t.holo) {
    const fl = noise(Math.floor(s.tick / 3) + t.spot * 7);
    alpha *= 0.5 + 0.22 * fl;
    if (p.wrongAge >= 0) alpha *= clamp01(1 - p.wrongAge / 18);
    // projector light rising from the cover edge: the only tell
    const beam = ctx.createLinearGradient(0, cover, 0, cover - 90 * p.sc);
    beam.addColorStop(0, "rgba(110,235,255,.32)"); beam.addColorStop(1, "rgba(110,235,255,0)");
    ctx.fillStyle = beam; ctx.beginPath(); ctx.moveTo(p.x - 10 * p.sc, cover); ctx.lineTo(p.x + 10 * p.sc, cover); ctx.lineTo(p.x + 40 * p.sc, cover - 90 * p.sc); ctx.lineTo(p.x - 40 * p.sc, cover - 90 * p.sc); ctx.fill();
  }
  ctx.globalAlpha = alpha;
  ctx.translate(p.x, p.y);
  if (p.knock > 0) ctx.rotate((t.x < 195 ? -1 : 1) * p.knock * 0.35);
  const glitch = t.holo && noise(Math.floor(s.tick / 2) + t.spot) > 0.86 ? (noise(s.tick) - 0.5) * 8 : 0;
  ctx.scale(p.sc, p.sc);
  const spr = sprite(t.species, t.tint, t.holo, ROW_HAZE[rowOf(t)] ?? 0);
  if (spr) ctx.drawImage(spr, -ORX + glitch, -ORY, BOX_W, BOX_H);
  else { ctx.fillStyle = (PAL[t.tint] ?? PAL[0]).body; ctx.beginPath(); ctx.ellipse(0, -10, 32, 44, 0, 0, Math.PI * 2); ctx.fill(); }
  // hit flash: the creature itself flares white, then a red-hot tint fades
  if (p.age >= 0 && p.age < 8 && spr && !posterMode) {
    const fl = flashOf(spr);
    if (fl) { ctx.globalAlpha = alpha * (p.age < 3 ? 0.9 : 0.9 * (1 - (p.age - 3) / 5)); ctx.drawImage(fl, -ORX + glitch, -ORY, BOX_W, BOX_H); ctx.globalAlpha = alpha; }
  }
  // wrong pick: red flash on a solid decoy
  if (!t.holo && p.wrongAge >= 0 && p.wrongAge < 24) {
    ctx.strokeStyle = `rgba(255,60,70,${1 - p.wrongAge / 24})`; ctx.lineWidth = 3 / p.sc;
    ctx.beginPath(); ctx.ellipse(0, -12, 44, 52, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
  // marks on the body while it is visible
  for (const m of marks) if (m.trial === s.trial && m.target === i) {
    const lx = m.x - t.x, ly = m.y - t.y;
    drawMark(ctx, p.x + lx, p.y + ly, s.tick - m.tick, m.id, p.sc, false, cover);
  }
}

function drawMark(ctx: CanvasRenderingContext2D, x: number, y: number, age: number, id: number, sc: number, glass: boolean, clipBelow = Infinity) {
  if (age < 0 || y > clipBelow) return;
  const hot = clamp01(1 - age / 100);
  if (glass) {
    ctx.strokeStyle = "rgba(220,240,255,.55)"; ctx.lineWidth = 0.8;
    for (let q = 0; q < 7; q++) {
      const a = noise(id * 5 + q) * Math.PI * 2, l = (9 + noise(id * 9 + q) * 12) * sc;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l * 0.55 + 1, y + Math.sin(a) * l * 0.55); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(x, y, 5 * sc, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "rgba(5,8,14,.85)"; ctx.beginPath(); ctx.arc(x, y, 1.8 * sc, 0, Math.PI * 2); ctx.fill();
    return;
  }
  const r = 6 * sc;
  const sg = ctx.createRadialGradient(x, y, 0, x, y, r * 1.6);
  sg.addColorStop(0, "rgba(0,0,0,.85)"); sg.addColorStop(0.45, "rgba(12,10,8,.55)"); sg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(x, y, r * 1.6, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,.6)"; ctx.lineWidth = 0.9;
  for (let q = 0; q < 5; q++) {
    const a = noise(id * 7 + q) * Math.PI * 2, l = (5 + noise(id * 11 + q) * 6) * sc;
    ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5); ctx.lineTo(x + Math.cos(a) * l * 1.3, y + Math.sin(a) * l * 1.3); ctx.stroke();
  }
  ctx.fillStyle = "#050404"; ctx.beginPath(); ctx.arc(x, y, 2.3 * sc, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(190,196,204,.45)"; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(x, y, 3 * sc, Math.PI * 0.9, Math.PI * 1.9); ctx.stroke();
  if (hot > 0) {
    const hg = ctx.createRadialGradient(x, y, 0, x, y, r * 1.2);
    hg.addColorStop(0, `rgba(255,230,160,${hot})`); hg.addColorStop(0.35, `rgba(255,120,40,${0.8 * hot})`); hg.addColorStop(1, "rgba(255,80,20,0)");
    ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(x, y, r * 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }
}

/** Two blasters at the bottom corners; the side that fired recoils and flashes. */
function drawGuns(ctx: CanvasRenderingContext2D, H: number, s: GalleryStateV12) {
  for (const side of [-1, 1]) {
    let last: Mark | undefined;
    for (let k = marks.length - 1; k >= 0; k--) if (side < 0 ? marks[k].x < 195 : marks[k].x >= 195) { last = marks[k]; break; }
    const age = last ? s.tick - last.tick : 999, kick = age >= 0 && age < 8 ? (8 - age) * 1.3 : 0;
    const charge = clamp01((age - 6) / 30);
    ctx.save();
    ctx.translate(side < 0 ? 62 : 328, H + 10 + kick);
    ctx.rotate(side * -0.3);
    // grip and hand guard
    const metalG = ctx.createLinearGradient(-22, 0, 22, 0);
    metalG.addColorStop(0, "#0b0f16"); metalG.addColorStop(0.35, "#3d495e"); metalG.addColorStop(0.6, "#232c3b"); metalG.addColorStop(1, "#090c12");
    ctx.fillStyle = metalG; ctx.beginPath(); ctx.roundRect(-21, -64, 42, 82, 10); ctx.fill();
    ctx.fillStyle = "#151b26"; ctx.beginPath(); ctx.roundRect(-15, -60, 30, 20, 5); ctx.fill();
    // energy cell
    const cell = ctx.createLinearGradient(0, -58, 0, -42);
    cell.addColorStop(0, `rgba(127,246,255,${0.35 + 0.6 * charge})`); cell.addColorStop(1, `rgba(40,140,200,${0.3 + 0.4 * charge})`);
    ctx.fillStyle = cell; ctx.beginPath(); ctx.roundRect(-11, -57, 22 * (0.25 + 0.75 * charge), 14, 3); ctx.fill();
    // barrel shroud and emitter
    const sh = ctx.createLinearGradient(-12, 0, 12, 0);
    sh.addColorStop(0, "#10151e"); sh.addColorStop(0.5, "#4a576d"); sh.addColorStop(1, "#10151e");
    ctx.fillStyle = sh; ctx.beginPath(); ctx.moveTo(-14, -64); ctx.lineTo(-10, -112); ctx.lineTo(10, -112); ctx.lineTo(14, -64); ctx.closePath(); ctx.fill();
    for (const y of [-74, -86, -98]) { ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(-11, y, 22, 3); }
    ctx.fillStyle = "#06080c"; ctx.beginPath(); ctx.ellipse(0, -113, 9, 3.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(127,246,255,${0.5 + 0.5 * charge})`; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.ellipse(0, -113, 9, 3.6, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "rgba(127,246,255,.8)"; ctx.fillRect(-17, -40, 2, 36); ctx.fillRect(15, -40, 2, 36);
    if (age >= 0 && age < 6) {
      ctx.globalCompositeOperation = "lighter";
      const fl = ctx.createRadialGradient(0, -118, 0, 0, -118, 34);
      fl.addColorStop(0, `rgba(255,255,255,${1 - age / 6})`); fl.addColorStop(0.3, `rgba(120,240,255,${0.85 * (1 - age / 6)})`); fl.addColorStop(1, "rgba(120,240,255,0)");
      ctx.fillStyle = fl; ctx.beginPath(); ctx.arc(0, -118, 34, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = "source-over";
    }
    ctx.restore();
  }
}

/** Top briefing panel: the species to take down (portraits + names) and the round tally. */
function drawBriefing(ctx: CanvasRenderingContext2D, s: GalleryStateV12) {
  const x = 8, y = 46, w = 374, h = 98;
  const bg = ctx.createLinearGradient(0, y, 0, y + h);
  bg.addColorStop(0, "rgba(8,18,34,.94)"); bg.addColorStop(1, "rgba(3,8,18,.94)");
  ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(x, y, w, h, 14); ctx.fill();
  ctx.strokeStyle = "rgba(110,225,245,.38)"; ctx.lineWidth = 1; ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,.06)"; for (let k = y + 4; k < y + h; k += 3) { ctx.beginPath(); ctx.moveTo(x + 2, k); ctx.lineTo(x + w - 2, k); ctx.stroke(); }
  // corner brackets
  ctx.strokeStyle = "#7fe3ee"; ctx.lineWidth = 2;
  for (const [cx, cy, dx, dy] of [[x + 6, y + 6, 1, 1], [x + w - 6, y + 6, -1, 1], [x + 6, y + h - 6, 1, -1], [x + w - 6, y + h - 6, -1, -1]]) {
    ctx.beginPath(); ctx.moveTo(cx, cy + dy * 10); ctx.lineTo(cx, cy); ctx.lineTo(cx + dx * 10, cy); ctx.stroke();
  }
  ctx.textBaseline = "middle"; ctx.textAlign = "left";
  ctx.font = `700 9px ${FONT}`; ctx.fillStyle = "rgba(160,230,245,.85)";
  ctx.fillText(tx("gallery.target"), x + 18, y + 17);
  // round tally (12 LEDs)
  for (let i = 0; i < 12; i++) {
    const r = s.results[i], cx = x + w - 18 - (11 - i) * 13, cy = y + 17;
    const cur = i === s.trial && s.status === "running";
    ctx.fillStyle = r ? (r.type === "CORRECT" ? "#5ff0c0" : "#ff4a5a") : cur ? `rgba(255,255,255,${0.55 + 0.45 * Math.sin(s.tick * 0.15)})` : "rgba(140,170,200,.18)";
    ctx.beginPath(); ctx.roundRect(cx - 4.5, cy - 2.5, 9, 5, 2); ctx.fill();
  }
  const order = s.trials[Math.min(s.trial, 11)].order.species;
  const slots = order.length === 1 ? [{ px: 132, nx: 168 }] : [{ px: 44, nx: 78 }, { px: 214, nx: 248 }];
  order.forEach((sp, k) => {
    const { px, nx } = slots[k], py = y + 62;
    const ring = ctx.createRadialGradient(px, py, 10, px, py, 30);
    ring.addColorStop(0, mix(PAL[sp].accent, PAL[sp].accent, 0, 0.0)); ring.addColorStop(0.8, mix(PAL[sp].accent, PAL[sp].accent, 0, 0.28)); ring.addColorStop(1, mix(PAL[sp].accent, PAL[sp].accent, 0, 0));
    ctx.fillStyle = ring; ctx.beginPath(); ctx.arc(px, py, 30, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.beginPath(); ctx.arc(px, py, 24, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = "#050b16"; ctx.fillRect(px - 24, py - 24, 48, 48);
    const spr = sprite(sp, sp, false);
    if (spr) ctx.drawImage(spr, (ORX - 34) * SPR, (ORY - 58) * SPR, 68 * SPR, 68 * SPR, px - 26, py - 26, 52, 52);
    ctx.restore();
    ctx.strokeStyle = PAL[sp].accent; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, py, 24, 0, Math.PI * 2); ctx.stroke();
    ctx.font = `800 ${order.length === 1 ? 19 : 14}px ${FONT}`; ctx.fillStyle = "#f2f8ff";
    ctx.fillText(speciesName(sp), nx, py);
  });
  if (order.length === 2) { ctx.font = `800 16px ${FONT}`; ctx.fillStyle = "rgba(160,230,245,.7)"; ctx.textAlign = "center"; ctx.fillText("+", 196, y + 62); }
}

const hudLabel = (s: Readonly<GalleryStateV12>) => `${tx("gallery.timeHud", { n: formatNumber(s.totalMs), trial: Math.min(12, s.trial + 1) })}`;
const feedbackScore = (s: Readonly<GalleryStateV12>) => s.totalMs;

/** Reaction times are kept on this device (last 30 runs): presentation/storage only. */
let savedSeed = "";
function persistReactions(s: GalleryStateV12) {
  if (s.status === "running" || savedSeed === s.seed) return;
  savedSeed = s.seed;
  try {
    const taps = s.results.flatMap((r) => r.taps.map(msOf));
    if (!taps.length) return;
    const key = "galactic-shot-gallery-reactions", history = JSON.parse(localStorage.getItem(key) ?? "[]") as unknown[];
    history.push({ at: Date.now(), seed: s.seed, averageMs: Math.round(taps.reduce((a, b) => a + b, 0) / taps.length), bestMs: Math.min(...taps), taps });
    localStorage.setItem(key, JSON.stringify(history.slice(-30)));
  } catch { /* storage may be blocked */ }
}

let posterMode = false;
/** Whole frame (also used to render the catalogue cover offline: `poster` drops the HUD texts and the flash). */
export function renderGallery(ctx: CanvasRenderingContext2D, s: GalleryStateV12, view?: { width: number; height: number }, poster = false) {
  assets();
  posterMode = poster;
  syncMarks(s);
  if (!poster) persistReactions(s);
  const H = Math.max(620, view?.height ?? 620);
  gridDy = offsetFor(H);
  const trial = s.trials[Math.min(s.trial, 11)];
  const lastMark = marks[marks.length - 1];
  const since = lastMark ? s.tick - lastMark.tick : 999;
  const kick = since >= 0 && since < 6 ? (6 - since) * 0.45 : 0;
  ctx.save();
  ctx.translate(0, -kick);
  // 1 · background
  if (ready(sceneImg)) ctx.drawImage(sceneImg, 0, IMG_Y0 + gridDy, 390, IMG_H);
  else {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#0b1426"); g.addColorStop(1, "#05070d");
    ctx.fillStyle = g; ctx.fillRect(0, -10, 390, H + 20);
  }
  // emergency beacons pulse
  const pulse = 0.5 + 0.5 * Math.sin(s.tick * 0.06);
  ctx.globalCompositeOperation = "lighter";
  for (const bx of [30, 160, 230, 360]) {
    const by = 252 + 15 + gridDy, gl = ctx.createRadialGradient(bx, by, 0, bx, by, 26);
    gl.addColorStop(0, `rgba(255,60,50,${0.35 * pulse})`); gl.addColorStop(1, "rgba(255,60,50,0)");
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(bx, by, 26, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";
  // marks on the background (and on bodies already gone)
  const bodyGone = (m: Mark) => m.target < 0 || m.trial !== s.trial || s.phase === "waiting" || pose(s, m.target, trial.targets[m.target] ?? trial.targets[0]).rise <= 0.001;
  for (const m of marks) if (m.layer < 0 && bodyGone(m)) drawMark(ctx, m.x, m.y + gridDy, s.tick - m.tick, m.id, 0.8 + (m.y - 200) / 1000, m.y < 196 && m.x > 14 && m.x < 376);
  // 2 · rows back to front: creatures, then the row's cover slice, then marks on that cover
  for (let row = 0; row < 4; row++) {
    trial.targets.forEach((t, i) => { if (rowOf(t) === row) drawCreature(ctx, s, i, t); });
    const [a, b] = COVER_SLICES[row];
    if (ready(coverImg)) ctx.drawImage(coverImg, 0, (a - IMG_Y0) * IMG_PX, 390 * IMG_PX, (b - a) * IMG_PX, 0, a + gridDy, 390, b - a);
    for (const m of marks) if (m.layer === row) drawMark(ctx, m.x, m.y + gridDy, s.tick - m.tick, m.id, 0.8 + row * 0.1, false);
  }
  // 3 · hit sparks (ichor in the creature's colours) and floating times
  trial.targets.forEach((t, i) => {
    const k = s.hits.indexOf(i);
    if (k < 0) return;
    const age = s.tick - (s.readyTick + (s.tapTicks[k] ?? 0)), p = pose(s, i, t);
    if (age < 0 || age > 40) return;
    const c = PAL[t.tint] ?? PAL[0], m = [...marks].reverse().find((q) => q.target === i && q.trial === s.trial);
    const ox = m ? m.x : t.x, oy = (m ? m.y : t.y - 14) + gridDy;
    for (let q = 0; q < 12; q++) {
      const ang = noise(q + i * 13) * Math.PI * 2, sp = 1.2 + noise(q * 3 + i) * 2.2;
      const sx = ox + Math.cos(ang) * sp * age, sy = oy + Math.sin(ang) * sp * age + 0.04 * age * age;
      ctx.fillStyle = mix(c.accent, "#ffffff", 0.2, clamp01(1 - age / 40));
      ctx.beginPath(); ctx.arc(sx, sy, 2.2 * (1 - age / 50), 0, Math.PI * 2); ctx.fill();
    }
    if (age < 36 && !poster) {
      const label = `${msOf(s.tapTicks[k] - (k ? s.tapTicks[k - 1] : 0))} ms`;
      ctx.font = `800 13px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.lineWidth = 3; ctx.strokeStyle = "rgba(0,8,16,.85)"; ctx.fillStyle = "#7ff6ff";
      const ly = t.y + gridDy - 64 * p.sc - age * 0.5;
      ctx.globalAlpha = clamp01(1.4 - age / 30);
      ctx.strokeText(label, t.x, ly); ctx.fillText(label, t.x, ly);
      ctx.globalAlpha = 1;
    }
  });
  // penalty: a decoy, a civilian or a false start
  const hitLast = s.hits.length > 0 && s.tapTickAbs === s.lastTapTick;
  const pAge = s.tick - s.lastTapTick;
  if (!hitLast && s.lastAddedMs > 0 && s.lastTapTick >= 0 && pAge >= 0 && pAge < 50) {
    const t = s.lastPick >= 0 ? trial.targets[s.lastPick] : null;
    const civ = t?.species === GALLERY_V12_CIVILIAN;
    const px = t ? t.x : 195, py = (t ? t.y - 70 * (t.scaleMilli / 1000) : 380) + gridDy - pAge * 0.4;
    ctx.globalAlpha = clamp01(1 - pAge / 50);
    ctx.font = `900 ${civ ? 17 : 15}px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const label = `${t ? (civ ? tx("gallery.civilian") : t.holo ? tx("gallery.holo") : tx("gallery.decoy")) + " " : ""}+${s.lastAddedMs} ms`;
    ctx.lineWidth = 3.5; ctx.strokeStyle = "rgba(30,0,4,.9)"; ctx.fillStyle = "#ff5a68";
    ctx.strokeText(label, Math.min(320, Math.max(70, px)), py); ctx.fillText(label, Math.min(320, Math.max(70, px)), py);
    ctx.globalAlpha = 1;
    if (!t || civ) { ctx.strokeStyle = `rgba(255,45,60,${0.8 * (1 - pAge / 50)})`; ctx.lineWidth = 5; ctx.strokeRect(4, 146, 382, H - 150); }
  }
  // feedback: show the real targets left standing
  if (s.phase === "feedback") trial.answers.forEach((i) => {
    if (s.hits.includes(i)) return;
    const t = trial.targets[i], p = pose(s, i, t);
    if (p.rise <= 0.05) return;
    ctx.strokeStyle = `rgba(255,70,80,${0.6 + 0.4 * Math.sin(s.tick * 0.3)})`; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(t.x, p.y - 14 * p.sc, 40 * p.sc, 0, Math.PI * 2); ctx.stroke();
  });
  // 4 · tracers from the guns to every fresh mark
  ctx.globalCompositeOperation = "lighter";
  for (const m of marks) {
    const age = s.tick - m.tick;
    if (age < 0 || age > 5) continue;
    const gx = m.x < 195 ? 102 : 288, gy = H - 98;
    const k = 1 - age / 6;
    ctx.strokeStyle = `rgba(120,240,255,${0.55 * k})`; ctx.lineWidth = 7 * k;
    ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(m.x, m.y + gridDy); ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${0.95 * k})`; ctx.lineWidth = 2 * k;
    ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(m.x, m.y + gridDy); ctx.stroke();
  }
  ctx.globalCompositeOperation = "source-over";
  drawGuns(ctx, H, s);
  ctx.restore();
  // 5 · briefing on top (does not shake)
  if (poster) return;
  drawBriefing(ctx, s);
  const last = s.results.at(-1);
  if (s.phase === "feedback" && last) {
    const text: Record<string, string> = { CORRECT: tx("gallery.clear"), PARTIAL: tx("gallery.partial"), WRONG: tx("gallery.wrong"), FALSE_START: tx("gallery.falseStart"), TIMEOUT: tx("gallery.timeout") };
    const grow = clamp01(s.phaseTicks / 6), label = text[last.type] ?? "", my = 150 + (H - 150) / 2;
    ctx.font = `900 ${18 + Math.round(8 * grow)}px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const wText = Math.min(360, ctx.measureText(label).width + 44);
    ctx.fillStyle = "rgba(3,8,18,.9)"; ctx.beginPath(); ctx.roundRect(195 - wText / 2, my - 30, wText, 62, 14); ctx.fill();
    const good = last.type === "CORRECT";
    ctx.strokeStyle = good ? "rgba(95,240,192,.7)" : "rgba(255,74,90,.7)"; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = good ? "#7ff6d6" : last.type === "PARTIAL" ? "#ffd36a" : "#ff6b78";
    ctx.fillText(label, 195, my - 6);
    ctx.font = `700 12px ${FONT}`; ctx.fillStyle = "#e8edf2";
    ctx.fillText(`+${formatNumber(last.addedMs ?? 0)} ms`, 195, my + 18);
  }
}

/** Nearest visible, standing creature under the finger (presentation hit test; the core decides the outcome). */
export function pickGallery(point: CorePoint, phase: "down" | "move" | "up", s: GalleryStateV12) {
  if (phase !== "down" || s.phase === "feedback" || point.y < 146) return null;
  syncMarks(s);
  const trial = s.trials[s.trial];
  const addMark = (target: number, layer: number) => marks.push({ x: point.x, y: point.y - gridDy, tick: s.tick, trial: s.trial, layer, target, id: marks.length + s.trial * 31 });
  // Tapping before they pop out is a false start wherever the finger lands.
  if (s.phase === "waiting") { addMark(-1, coverRowAt(point.x, point.y - gridDy)); return "PICK_0"; }
  let best = -1, bestD = 1;
  trial.targets.forEach((t, i) => {
    if (s.hits.includes(i)) return;
    const p = pose(s, i, t);
    if (p.rise < 0.5 || point.y > t.cover + gridDy + 4) return;
    const dx = (point.x - t.x) / (40 * p.sc), dy = (point.y - (p.y - 14 * p.sc)) / (50 * p.sc), d = dx * dx + dy * dy;
    if (d < bestD) { best = i; bestD = d; }
  });
  const layer = coverRowAt(point.x, point.y - gridDy);
  // A creature standing in front of its own cover takes the shot unless the cover row is nearer.
  if (best >= 0 && (layer < 0 || layer <= rowOf(trial.targets[best]))) {
    addMark(best, -1);
    gameTone("tap");
    return `PICK_${best}`;
  }
  addMark(-1, layer);
  return null;
}

export default function ShotGallery(props: GameRuntimeProps) {
  useI18n();
  preload(SCENE_SRC, { as: "image" });
  preload(COVER_SRC, { as: "image" });
  const render = useCallback((ctx: CanvasRenderingContext2D, s: GalleryStateV12, view?: { width: number; height: number }) => renderGallery(ctx, s, view), []);
  const pick = useCallback(pickGallery, []);
  return (
    <div className="shotGalleryVerified">
      <CoreCanvasGame {...props} core={core} name="Shot Gallery" instruction="" render={render} pointAction={pick} multiTouch expandVerticalViewport hideHudScore hudLabel={hudLabel} feedbackScore={feedbackScore} />
    </div>
  );
}
