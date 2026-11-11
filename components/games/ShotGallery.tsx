"use client";
import { useCallback } from "react";
import type { GameRuntimeProps } from "@/lib/games";
import { gameTone } from "@/lib/gameFeedback";
import {
  SHOT_GALLERY_CORE_V13 as core,
  type GalleryBeingV13,
  type GalleryStateV13,
} from "@/lib/verified/shotGalleryCore.v13";
import CoreCanvasGame, { type CorePoint } from "./CoreCanvasGame";
import type { ScoreCell } from "../GameScoreboard";
import { AURAS, BOX_H, BOX_W, ORX, ORY, WORLD_H, WORLD_W, WORLD_Y0, drawBeing, drawFormIcon, paintLayer, rgba } from "./galleryJungleArt";

import { t as tx, formatNumber, useI18n } from "@/lib/i18n";

/*
 * Presentation only (V13 core: "Jungla de Xeno" — beings of three forms and four auras come out at ten hiding
 * places; each order is an aura colour or a form; score = accumulated reaction time). Reads the authoritative state
 * and never writes it. The jungle is painted by code into four cached layers (backdrop, then the covers of the far,
 * mid and near hiding places); each depth's beings are drawn just before the cover that hides them. Every shot leaves
 * a mark where it landed for the rest of the run (presentation memory of the taps).
 */
const msOf = (ticks: number) => Math.round((ticks * 1000) / 120);
const noise = (n: number) => { const v = Math.sin(n * 12.9898) * 43758.5453; return v - Math.floor(v); };
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeOutBack = (t: number) => { const c = 1.5; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; };
const FONT = '"Unbounded", "Inter", system-ui, sans-serif';

/* ---------------------------------------------------------------- cached jungle layers and their hit masks */
const PX = 2;
let layers: (HTMLCanvasElement | null)[] | null = null;
let masks: (Uint8ClampedArray | null)[] = [];
function jungle() {
  if (layers || typeof document === "undefined") return layers;
  layers = [0, 1, 2, 3].map((n) => {
    const c = document.createElement("canvas");
    c.width = WORLD_W * PX; c.height = WORLD_H * PX;
    const g = c.getContext("2d");
    if (!g) return null;
    g.scale(PX, PX); g.translate(0, -WORLD_Y0);
    paintLayer(g, n as 0 | 1 | 2 | 3);
    return c;
  });
  masks = layers.map((c, n) => {
    if (!c || n === 0) return null;
    try {
      const m = document.createElement("canvas");
      m.width = WORLD_W; m.height = WORLD_H;
      const g = m.getContext("2d", { willReadFrequently: true });
      if (!g) return null;
      g.drawImage(c, 0, 0, WORLD_W, WORLD_H);
      return g.getImageData(0, 0, WORLD_W, WORLD_H).data;
    } catch { return null; }
  });
  return layers;
}
/** The nearest cover layer (1..3) solid at a world point, or 0 for the open backdrop. */
function coverAt(x: number, y: number) {
  const px = Math.round(x), py = Math.round(y - WORLD_Y0);
  if (px < 0 || py < 0 || px >= WORLD_W || py >= WORLD_H) return 0;
  for (let n = 3; n >= 1; n--) { const m = masks[n]; if (m && m[(py * WORLD_W + px) * 4 + 3] > 128) return n; }
  return 0;
}

/* ---------------------------------------------------------------- beings (sprites lit from inside by the aura) */
const SPR = 3;
const spriteCache = new Map<string, HTMLCanvasElement | null>();
const HAZE = [0.2, 0.08, 0];
function sprite(form: number, aura: number, depth = 2) {
  const key = `${form}:${aura}:${depth}`;
  if (spriteCache.has(key)) return spriteCache.get(key) ?? null;
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = BOX_W * SPR; c.height = BOX_H * SPR;
  const g = c.getContext("2d");
  if (!g) { spriteCache.set(key, null); return null; }
  const a = AURAS[aura] ?? AURAS[0];
  g.scale(SPR, SPR); g.translate(ORX, ORY);
  drawBeing(g, form, aura);
  g.setTransform(1, 0, 0, 1, 0, 0);
  // The aura shining from inside: the body takes its colour near the heart, darkening toward the edges.
  g.globalCompositeOperation = "source-atop";
  const cx = ORX * SPR, cy = (ORY - 20) * SPR;
  const inner = g.createRadialGradient(cx, cy, 0, cx, cy, 80 * SPR);
  inner.addColorStop(0, rgba(a.glow, 0.16)); inner.addColorStop(0.5, rgba(a.mid, 0.05)); inner.addColorStop(1, "rgba(0,0,0,.3)");
  g.fillStyle = inner; g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = "source-over";
  // Rim of aura light round the silhouette (it spills from behind).
  const rim = document.createElement("canvas");
  rim.width = c.width; rim.height = c.height;
  const rg = rim.getContext("2d");
  if (rg) {
    rg.drawImage(c, 0, 0);
    rg.globalCompositeOperation = "destination-out";
    rg.drawImage(c, 0, 2.2 * SPR);
    rg.globalCompositeOperation = "source-in";
    rg.fillStyle = rgba(a.glow, 0.7); rg.fillRect(0, 0, rim.width, rim.height);
    g.drawImage(rim, 0, 0);
  }
  if (HAZE[depth] > 0) {
    g.globalCompositeOperation = "source-atop";
    g.fillStyle = `rgba(24,64,60,${HAZE[depth]})`; g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = "source-over";
  }
  spriteCache.set(key, c);
  return c;
}
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

/* ---------------------------------------------------------------- shot marks (presentation memory of the taps) */
type Mark = { x: number; y: number; tick: number; trial: number; layer: number; target: number; id: number };
let marks: Mark[] = [], marksSeed = "", lastTickSeen = 0;
function syncMarks(s: GalleryStateV13) {
  if (marksSeed !== s.seed || s.tick < lastTickSeen) { marks = []; marksSeed = s.seed; }
  lastTickSeen = s.tick;
}
/** Tall phones: the scene is centred in the taller canvas (presentation only; taps use the same offset). */
let gridDy = 0;
const offsetFor = (H: number) => Math.round(Math.min(130, Math.max(0, (H - 620) / 2)));

/** How far a being is out of hiding (0 hidden, 1 out), its knock-down and where it is drawn this frame. */
function pose(s: GalleryStateV13, i: number, t: GalleryBeingV13) {
  const sc = t.scaleMilli / 1000, fb = s.phase === "feedback" ? s.phaseTicks : 0;
  const delay = (t.spot * 5) % 9;
  const up = s.phase === "waiting" || s.readyTick < 0 ? 0 : easeOutBack(clamp01((s.tick - s.readyTick - delay * 0.4) / 9));
  const down = s.phase === "feedback" ? clamp01((fb - 54) / 14) : 0;
  const hitAt = s.hits.indexOf(i), hitTick = hitAt >= 0 ? s.readyTick + (s.tapTicks[hitAt] ?? 0) : -1;
  const age = hitTick >= 0 ? s.tick - hitTick : -1;
  const knock = hitTick >= 0 ? clamp01((age - 3) / 14) : 0;
  const wrongAge = s.lastPick === i && hitAt < 0 && s.lastTapTick >= s.readyTick ? s.tick - s.lastTapTick : -1;
  // v158: a hit being explodes where it stands (see drawBeingAt), it no longer sinks back into cover.
  const rise = Math.max(0, up * (1 - down));
  const breathe = Math.sin((s.tick + t.spot * 23) * 0.05) * 1.2 * sc;
  let x = t.x, y = t.y + gridDy + breathe, tilt = 0;
  if (t.dir === "UP") y += (1 - rise) * 128 * sc;
  else { const side = t.dir === "LEFT" ? 1 : -1; x += side * (1 - rise) * 112 * sc; tilt = side * (1 - Math.min(1, rise)) * 0.18; }
  return { sc, rise, knock, age, wrongAge, x, y, tilt };
}
function clipFor(ctx: CanvasRenderingContext2D, t: GalleryBeingV13, H: number) {
  ctx.beginPath();
  if (t.dir === "UP") ctx.rect(-20, -400, 430, t.edge + gridDy + 400);
  else if (t.dir === "LEFT") ctx.rect(-20, -400, t.edge + 20, H + 800);
  else ctx.rect(t.edge, -400, 430 - t.edge, H + 800);
  ctx.clip();
}

/** v158: a hit being bursts from the exact point the player tapped: a white flash, then the body shatters into
 * pieces thrown away from the shot, with a fireball and a shock ring in its aura colour. */
const EXPLODE = 34, SHARDS_X = 4, SHARDS_Y = 5;
function drawExplosion(ctx: CanvasRenderingContext2D, s: GalleryStateV13, i: number, t: GalleryBeingV13, p: ReturnType<typeof pose>, H: number) {
  const a = AURAS[t.aura] ?? AURAS[0], age = p.age;
  const m = [...marks].reverse().find((q) => q.target === i && q.trial === s.trial);
  const hx = m ? m.x : p.x, hy = (m ? m.y : t.y - 34 * p.sc) + gridDy;
  const spr = sprite(t.form, t.aura, t.layer);
  const k = clamp01(age / EXPLODE);
  // Shards: the sprite cut into a grid, each piece pushed away from the shot point, spinning and falling.
  if (spr && age >= 3 && !posterMode) {
    const cw = BOX_W / SHARDS_X, chh = BOX_H / SHARDS_Y, e = age - 3;
    ctx.save();
    ctx.globalAlpha = clamp01(1 - e / (EXPLODE - 6));
    for (let gy = 0; gy < SHARDS_Y; gy++) for (let gx = 0; gx < SHARDS_X; gx++) {
      const lx = -ORX + (gx + 0.5) * cw, ly = -ORY + (gy + 0.5) * chh;
      const wx = p.x + lx * p.sc, wy = p.y + ly * p.sc;
      const n = noise(i * 37 + gy * 5 + gx), dx = wx - hx, dy = wy - hy, d = Math.hypot(dx, dy) || 1;
      const sp = (2.2 + n * 3.2) * p.sc * 2;
      const ox = (dx / d) * sp * e, oy = (dy / d) * sp * e - 1.4 * e + 0.09 * e * e;
      ctx.save();
      ctx.translate(wx + ox, wy + oy); ctx.rotate((n - 0.5) * 0.22 * e);
      ctx.drawImage(spr, (ORX + lx - cw / 2) * SPR, (ORY + ly - chh / 2) * SPR, cw * SPR, chh * SPR, (-cw / 2) * p.sc, (-chh / 2) * p.sc, cw * p.sc, chh * p.sc);
      ctx.restore();
    }
    ctx.restore();
  } else if (spr && age < 3) {
    ctx.save();
    clipFor(ctx, t, H);
    ctx.translate(p.x, p.y); if (p.tilt) ctx.rotate(p.tilt); ctx.scale(p.sc, p.sc);
    ctx.drawImage(spr, -ORX, -ORY, BOX_W, BOX_H);
    const fl = flashOf(spr);
    if (fl && !posterMode) ctx.drawImage(fl, -ORX, -ORY, BOX_W, BOX_H);
    ctx.restore();
  }
  if (posterMode) return;
  // Fireball and shock ring from the shot point.
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const fr = (26 + 96 * Math.sqrt(k)) * p.sc, fa = clamp01(1 - k * 1.05);
  const fb = ctx.createRadialGradient(hx, hy, 0, hx, hy, fr);
  fb.addColorStop(0, `rgba(255,255,255,${0.95 * fa})`); fb.addColorStop(0.25, rgba(a.core, 0.9 * fa)); fb.addColorStop(0.6, rgba(a.glow, 0.55 * fa)); fb.addColorStop(1, rgba(a.deep, 0));
  ctx.fillStyle = fb; ctx.beginPath(); ctx.arc(hx, hy, fr, 0, Math.PI * 2); ctx.fill();
  if (age < 22) {
    const rr = (20 + 140 * (age / 22)) * p.sc;
    ctx.strokeStyle = rgba(a.glow, 0.9 * (1 - age / 22)); ctx.lineWidth = 6 * (1 - age / 22) + 1;
    ctx.beginPath(); ctx.arc(hx, hy, rr, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

function drawBeingAt(ctx: CanvasRenderingContext2D, s: GalleryStateV13, i: number, t: GalleryBeingV13, H: number) {
  const p = pose(s, i, t);
  if (p.rise <= 0.001) return;
  if (p.age >= 0) { if (p.age < EXPLODE) drawExplosion(ctx, s, i, t, p, H); return; }
  const a = AURAS[t.aura] ?? AURAS[0];
  ctx.save();
  clipFor(ctx, t, H);
  const dim = s.phase === "feedback" && !s.trials[s.trial].answers.includes(i) ? 0.45 : 1;
  // outer aura: a slow pulse behind the body, brighter for the near ones
  const pulse = 0.75 + 0.25 * Math.sin((s.tick + t.spot * 31) * 0.09);
  ctx.globalCompositeOperation = "lighter";
  const cy = p.y - 34 * p.sc, rr = 74 * p.sc;
  const halo = ctx.createRadialGradient(p.x, cy, 4 * p.sc, p.x, cy, rr);
  halo.addColorStop(0, rgba(a.glow, 0.42 * pulse * dim)); halo.addColorStop(0.5, rgba(a.mid, 0.16 * pulse * dim)); halo.addColorStop(1, rgba(a.deep, 0));
  ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(p.x, cy, rr, 0, Math.PI * 2); ctx.fill();
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = dim;
  ctx.translate(p.x, p.y);
  if (p.tilt) ctx.rotate(p.tilt);
  ctx.scale(p.sc, p.sc);
  const spr = sprite(t.form, t.aura, t.layer);
  if (spr) ctx.drawImage(spr, -ORX, -ORY, BOX_W, BOX_H);
  else { ctx.fillStyle = a.mid; ctx.beginPath(); ctx.ellipse(0, -20, 34, 50, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = 1;
  if (p.wrongAge >= 0 && p.wrongAge < 24) {
    ctx.strokeStyle = `rgba(255,70,80,${1 - p.wrongAge / 24})`; ctx.lineWidth = 3 / p.sc;
    ctx.beginPath(); ctx.ellipse(0, -30, 52, 64, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
  for (const m of marks) if (m.trial === s.trial && m.target === i) drawMark(ctx, p.x + (m.x - t.x), p.y + (m.y - t.y), s.tick - m.tick, m.id, p.sc);
}

function drawMark(ctx: CanvasRenderingContext2D, x: number, y: number, age: number, id: number, sc: number) {
  if (age < 0) return;
  const hot = clamp01(1 - age / 100), r = 6 * sc;
  const sg = ctx.createRadialGradient(x, y, 0, x, y, r * 1.6);
  sg.addColorStop(0, "rgba(0,0,0,.85)"); sg.addColorStop(0.45, "rgba(6,12,8,.55)"); sg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(x, y, r * 1.6, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,.6)"; ctx.lineWidth = 0.9;
  for (let q = 0; q < 5; q++) {
    const a = noise(id * 7 + q) * Math.PI * 2, l = (5 + noise(id * 11 + q) * 6) * sc;
    ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5); ctx.lineTo(x + Math.cos(a) * l * 1.3, y + Math.sin(a) * l * 1.3); ctx.stroke();
  }
  ctx.fillStyle = "#030504"; ctx.beginPath(); ctx.arc(x, y, 2.3 * sc, 0, Math.PI * 2); ctx.fill();
  if (hot > 0) {
    const hg = ctx.createRadialGradient(x, y, 0, x, y, r * 1.2);
    hg.addColorStop(0, `rgba(220,255,250,${hot})`); hg.addColorStop(0.35, `rgba(90,240,220,${0.8 * hot})`); hg.addColorStop(1, "rgba(60,200,200,0)");
    ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(x, y, r * 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }
}

/** The order (v158): the word "Objetivo" and, beside it, the thing to destroy — a nebula with rays in that aura's
 * colour, or that form as a colourless figure. No names: the picture is the order. */
const greyCache = new Map<number, HTMLCanvasElement | null>();
function greyForm(form: number) {
  if (greyCache.has(form)) return greyCache.get(form) ?? null;
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = BOX_W * 2; c.height = BOX_H * 2;
  const g = c.getContext("2d");
  if (!g) { greyCache.set(form, null); return null; }
  g.scale(2, 2); g.translate(ORX, ORY); drawFormIcon(g, form);
  try {
    const img = g.getImageData(0, 0, c.width, c.height), d = img.data;
    for (let q = 0; q < d.length; q += 4) {
      const l = Math.min(255, (0.3 * d[q] + 0.59 * d[q + 1] + 0.11 * d[q + 2]) * 1.12 + 10);
      d[q] = d[q + 1] = d[q + 2] = l;
    }
    g.putImageData(img, 0, 0);
  } catch { /* a tainted canvas cannot happen here; keep the drawing as is */ }
  greyCache.set(form, c);
  return c;
}
function drawNebula(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, aura: number, tick: number) {
  const a = AURAS[aura] ?? AURAS[0];
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  // Rays: thin wedges turning slowly, alternating long and short.
  const spin = tick * 0.006;
  for (let q = 0; q < 14; q++) {
    const ang = spin + (q / 14) * Math.PI * 2, len = r * (q % 2 ? 0.95 : 1.3) * (0.9 + 0.1 * Math.sin(tick * 0.05 + q)), w = 0.11;
    const rg = ctx.createLinearGradient(x, y, x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    rg.addColorStop(0, rgba(a.core, 0.75)); rg.addColorStop(0.5, rgba(a.glow, 0.35)); rg.addColorStop(1, rgba(a.glow, 0));
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(ang - w) * len, y + Math.sin(ang - w) * len);
    ctx.lineTo(x + Math.cos(ang + w) * len, y + Math.sin(ang + w) * len);
    ctx.closePath(); ctx.fill();
  }
  // Cloud: three drifting lobes and a bright heart.
  for (let q = 0; q < 3; q++) {
    const ang = tick * 0.01 + q * 2.1, cx = x + Math.cos(ang) * r * 0.28, cy = y + Math.sin(ang) * r * 0.2;
    const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.75);
    cg.addColorStop(0, rgba(a.glow, 0.6)); cg.addColorStop(0.55, rgba(a.mid, 0.34)); cg.addColorStop(1, rgba(a.deep, 0));
    ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(cx, cy, r * 0.8, 0, Math.PI * 2); ctx.fill();
  }
  const pulse = 0.85 + 0.15 * Math.sin(tick * 0.12);
  const hg = ctx.createRadialGradient(x, y, 0, x, y, r * 0.42 * pulse);
  hg.addColorStop(0, "rgba(255,255,255,.95)"); hg.addColorStop(0.35, rgba(a.core, 0.9)); hg.addColorStop(1, rgba(a.glow, 0));
  ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(x, y, r * 0.42 * pulse, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
function drawBriefing(ctx: CanvasRenderingContext2D, s: GalleryStateV13) {
  const x = 8, y = 50, w = 374, h = 94;
  const bg = ctx.createLinearGradient(0, y, 0, y + h);
  bg.addColorStop(0, "rgba(6,20,18,.94)"); bg.addColorStop(1, "rgba(2,8,8,.95)");
  ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(x, y, w, h, 14); ctx.fill();
  ctx.strokeStyle = "rgba(120,240,210,.32)"; ctx.lineWidth = 1; ctx.stroke();
  const order = s.trials[Math.min(s.trial, 11)].order, cyMid = y + h / 2;
  ctx.textBaseline = "middle"; ctx.textAlign = "left";
  ctx.font = `800 21px ${FONT}`; ctx.fillStyle = "#f2fbf7";
  const label = tx("gallery.objective"), lw = ctx.measureText(label).width;
  ctx.fillText(label, x + 18, cyMid + 1);
  // The picture of what to destroy, beside the word.
  const vx = x + 18 + lw + 66, vy = cyMid;
  ctx.save();
  ctx.beginPath(); ctx.roundRect(x + 1, y + 1, w - 2, h - 2, 13); ctx.clip();
  if (order.kind === "AURA") drawNebula(ctx, vx, vy, 46, order.value, s.tick);
  else {
    // Head and chest of the figure fill the panel's height (the legs fall below its edge).
    const ic = greyForm(order.value), ih = 150, iw = ih * (BOX_W / BOX_H);
    if (ic) ctx.drawImage(ic, vx - iw / 2, y + 2, iw, ih);
  }
  ctx.restore();
  // The twelve orders: two rows of six on the right (done green, missed red, current blinking).
  for (let i = 0; i < 12; i++) {
    const r = s.results[i], col = i % 6, row = Math.floor(i / 6);
    const cx = x + w - 18 - (5 - col) * 13, cy = cyMid - 8 + row * 16, cur = i === s.trial && s.status === "running";
    ctx.fillStyle = r ? (r.type === "CORRECT" ? "#5ff0c0" : "#ff4a5a") : cur ? `rgba(255,255,255,${0.55 + 0.45 * Math.sin(s.tick * 0.15)})` : "rgba(140,200,190,.18)";
    ctx.beginPath(); ctx.roundRect(cx - 4.5, cy - 2.5, 9, 5, 2); ctx.fill();
  }
}

const hudLabel = (s: Readonly<GalleryStateV13>) => `${tx("gallery.timeHud", { n: formatNumber(s.totalMs), trial: Math.min(12, s.trial + 1) })}`;
const feedbackScore = (s: Readonly<GalleryStateV13>) => s.totalMs;
const scoreCells = (s: Readonly<GalleryStateV13>): ScoreCell[] => [
  { label: tx("hud.reaction"), value: `${formatNumber(s.totalMs)} ms`, main: true },
  { label: tx("hud.target"), value: `${Math.min(12, s.trial + 1)}/12` },
];

/** Reaction times are kept on this device (last 30 runs): presentation/storage only. */
let savedSeed = "";
function persistReactions(s: GalleryStateV13) {
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

/** Drifting mist and spores over the jungle (deterministic from the tick). */
function atmosphere(ctx: CanvasRenderingContext2D, s: GalleryStateV13, H: number) {
  const t = s.tick;
  for (let k = 0; k < 3; k++) {
    const y = 250 + k * 110 + gridDy, x = ((t * (0.12 + k * 0.05) + k * 140) % 620) - 115;
    const g = ctx.createRadialGradient(x, y, 10, x, y, 170);
    g.addColorStop(0, "rgba(140,220,200,.07)"); g.addColorStop(1, "rgba(140,220,200,0)");
    ctx.fillStyle = g; ctx.fillRect(x - 170, y - 70, 340, 140);
  }
  ctx.globalCompositeOperation = "lighter";
  for (let k = 0; k < 22; k++) {
    const sp = 0.1 + noise(k) * 0.25, x = (noise(k + 7) * 420 + Math.sin(t * 0.01 + k) * 14) % 400, y = ((noise(k + 3) * (H + 100) - t * sp) % (H + 100) + H + 100) % (H + 100) - 50;
    const blink = 0.45 + 0.55 * Math.sin(t * 0.08 + k * 2.1);
    const c = k % 3 === 0 ? "166,255,90" : "92,240,216";
    const g = ctx.createRadialGradient(x, y, 0, x, y, 4);
    g.addColorStop(0, `rgba(${c},${0.7 * blink})`); g.addColorStop(1, `rgba(${c},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";
}

let posterMode = false;
/** Whole frame (also used to render the catalogue cover offline: `poster` drops the texts and the flash). */
export function renderGallery(ctx: CanvasRenderingContext2D, s: GalleryStateV13, view?: { width: number; height: number }, poster = false) {
  posterMode = poster;
  syncMarks(s);
  if (!poster) persistReactions(s);
  const H = Math.max(620, view?.height ?? 620);
  gridDy = offsetFor(H);
  const L = jungle();
  const trial = s.trials[Math.min(s.trial, 11)];
  const lastMark = marks[marks.length - 1];
  const since = lastMark ? s.tick - lastMark.tick : 999;
  const kick = since >= 0 && since < 6 ? (6 - since) * 0.45 : 0;
  ctx.save();
  ctx.translate(0, -kick);
  const layer = (n: number) => {
    const c = L?.[n];
    if (c) ctx.drawImage(c, 0, WORLD_Y0 + gridDy, WORLD_W, WORLD_H);
    else if (n === 0) { const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#04141a"); g.addColorStop(1, "#020605"); ctx.fillStyle = g; ctx.fillRect(0, -10, 390, H + 20); }
  };
  layer(0);
  // marks on the open backdrop (and on bodies already gone)
  const bodyGone = (m: Mark) => m.target < 0 || m.trial !== s.trial || s.phase === "waiting" || pose(s, m.target, trial.targets[m.target] ?? trial.targets[0]).rise <= 0.001;
  for (const m of marks) if (m.layer === 0 && bodyGone(m)) drawMark(ctx, m.x, m.y + gridDy, s.tick - m.tick, m.id, 0.8);
  // depth by depth: the beings of that depth, then the cover in front of them, then marks on that cover
  for (let d = 0; d < 3; d++) {
    trial.targets.forEach((t, i) => { if (t.layer === d) drawBeingAt(ctx, s, i, t, H); });
    layer(d + 1);
    for (const m of marks) if (m.layer === d + 1) drawMark(ctx, m.x, m.y + gridDy, s.tick - m.tick, m.id, 0.85 + d * 0.1);
  }
  atmosphere(ctx, s, H);
  // hit bursts: the aura escaping as sparks, and the time of the shot
  trial.targets.forEach((t, i) => {
    const k = s.hits.indexOf(i);
    if (k < 0) return;
    const age = s.tick - (s.readyTick + (s.tapTicks[k] ?? 0)), p = pose(s, i, t);
    if (age < 0 || age > 44) return;
    const a = AURAS[t.aura], m = [...marks].reverse().find((q) => q.target === i && q.trial === s.trial);
    const ox = m ? m.x : t.x, oy = (m ? m.y : t.y - 30) + gridDy;
    ctx.globalCompositeOperation = "lighter";
    for (let q = 0; q < 16; q++) {
      const ang = noise(q + i * 13) * Math.PI * 2, sp = 1 + noise(q * 3 + i) * 2.4;
      const sx = ox + Math.cos(ang) * sp * age, sy = oy + Math.sin(ang) * sp * age - 0.02 * age * age;
      ctx.fillStyle = rgba(q % 3 ? a.glow : a.core, clamp01(1 - age / 44));
      ctx.beginPath(); ctx.arc(sx, sy, 2.4 * (1 - age / 52), 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
    if (age < 36 && !poster) {
      const label = `${msOf(s.tapTicks[k] - (k ? s.tapTicks[k - 1] : 0))} ms`;
      ctx.font = `800 13px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.lineWidth = 3; ctx.strokeStyle = "rgba(0,10,8,.85)"; ctx.fillStyle = "#9ffff0";
      const ly = t.y + gridDy - 100 * p.sc - age * 0.5;
      ctx.globalAlpha = clamp01(1.4 - age / 30);
      ctx.strokeText(label, t.x, ly); ctx.fillText(label, t.x, ly);
      ctx.globalAlpha = 1;
    }
  });
  // penalty: a wrong being or a false start
  const hitLast = s.hits.length > 0 && s.tapTickAbs === s.lastTapTick;
  const pAge = s.tick - s.lastTapTick;
  if (!hitLast && s.lastAddedMs > 0 && s.lastTapTick >= 0 && pAge >= 0 && pAge < 50 && !poster) {
    const t = s.lastPick >= 0 ? trial.targets[s.lastPick] : null;
    const px = t ? t.x : 195, py = (t ? t.y - 104 * (t.scaleMilli / 1000) : 380) + gridDy - pAge * 0.4;
    ctx.globalAlpha = clamp01(1 - pAge / 50);
    ctx.font = `900 14px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const label = `${t ? `${tx("gallery.notTarget")} ` : ""}+${s.lastAddedMs} ms`;
    ctx.lineWidth = 3.5; ctx.strokeStyle = "rgba(30,0,4,.9)"; ctx.fillStyle = "#ff5a68";
    ctx.strokeText(label, Math.min(300, Math.max(90, px)), py); ctx.fillText(label, Math.min(300, Math.max(90, px)), py);
    ctx.globalAlpha = 1;
    if (!t) { ctx.strokeStyle = `rgba(255,45,60,${0.8 * (1 - pAge / 50)})`; ctx.lineWidth = 5; ctx.strokeRect(4, 146, 382, H - 150); }
  }
  // feedback: ring the targets still standing
  if (s.phase === "feedback") trial.answers.forEach((i) => {
    if (s.hits.includes(i)) return;
    const t = trial.targets[i], p = pose(s, i, t);
    if (p.rise <= 0.05) return;
    ctx.strokeStyle = `rgba(255,70,80,${0.6 + 0.4 * Math.sin(s.tick * 0.3)})`; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(p.x, p.y - 34 * p.sc, 58 * p.sc, 0, Math.PI * 2); ctx.stroke();
  });
  // v158: no blasters and no tracers — the shot lands exactly where the finger touched (the mark and its flash).
  ctx.restore();
  if (poster) return;
  drawBriefing(ctx, s);
  const last = s.results.at(-1);
  if (s.phase === "feedback" && last) {
    const text: Record<string, string> = { CORRECT: tx("gallery.clear"), PARTIAL: tx("gallery.partial"), WRONG: tx("gallery.wrong"), FALSE_START: tx("gallery.falseStart"), TIMEOUT: tx("gallery.timeout") };
    const grow = clamp01(s.phaseTicks / 6), label = text[last.type] ?? "", my = 150 + (H - 150) / 2;
    ctx.font = `900 ${18 + Math.round(8 * grow)}px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const wText = Math.min(360, ctx.measureText(label).width + 44);
    ctx.fillStyle = "rgba(2,10,8,.9)"; ctx.beginPath(); ctx.roundRect(195 - wText / 2, my - 30, wText, 62, 14); ctx.fill();
    const good = last.type === "CORRECT";
    ctx.strokeStyle = good ? "rgba(95,240,192,.7)" : "rgba(255,74,90,.7)"; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = good ? "#7ff6d6" : last.type === "PARTIAL" ? "#ffd36a" : "#ff6b78";
    ctx.fillText(label, 195, my - 6);
    ctx.font = `700 12px ${FONT}`; ctx.fillStyle = "#e8edf2";
    ctx.fillText(`+${formatNumber(last.addedMs ?? 0)} ms`, 195, my + 18);
  }
}

/** The being under the finger (nearest depth first), unless a nearer cover is in the way (presentation hit test;
 * the core decides the outcome). */
export function pickGallery(point: CorePoint, phase: "down" | "move" | "up", s: GalleryStateV13) {
  if (phase !== "down" || s.phase === "feedback" || point.y < 146) return null;
  syncMarks(s);
  jungle();
  const trial = s.trials[s.trial], wy = point.y - gridDy;
  const cover = coverAt(point.x, wy);
  const addMark = (target: number, layer: number) => marks.push({ x: point.x, y: wy, tick: s.tick, trial: s.trial, layer, target, id: marks.length + s.trial * 31 });
  if (s.phase === "waiting") { addMark(-1, cover); return "PICK_0"; }
  let best = -1, bestD = 1, bestLayer = -1;
  trial.targets.forEach((t, i) => {
    if (s.hits.includes(i)) return;
    const p = pose(s, i, t);
    if (p.rise < 0.5) return;
    if (t.dir === "UP" ? wy > t.edge + 2 : t.dir === "LEFT" ? point.x > t.edge + 2 : point.x < t.edge - 2) return;
    if (cover > t.layer) return; // a nearer cover is in the way
    const dx = (point.x - p.x) / (46 * p.sc), dy = (point.y - (p.y - 34 * p.sc)) / (66 * p.sc), d = dx * dx + dy * dy;
    if (d < 1 && (t.layer > bestLayer || (t.layer === bestLayer && d < bestD))) { best = i; bestD = d; bestLayer = t.layer; }
  });
  if (best >= 0) {
    addMark(best, -1);
    gameTone("tap");
    return `PICK_${best}`;
  }
  addMark(-1, cover);
  return null;
}

export default function ShotGallery(props: GameRuntimeProps) {
  useI18n();
  const render = useCallback((ctx: CanvasRenderingContext2D, s: GalleryStateV13, view?: { width: number; height: number }) => renderGallery(ctx, s, view), []);
  const pick = useCallback(pickGallery, []);
  return (
    <div className="shotGalleryVerified">
      <CoreCanvasGame {...props} core={core} name="Shot Gallery" instruction="" render={render} pointAction={pick} multiTouch expandVerticalViewport hideHudScore hudLabel={hudLabel} scoreCells={scoreCells} feedbackScore={feedbackScore} />
    </div>
  );
}
