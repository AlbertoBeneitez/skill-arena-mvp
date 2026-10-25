"use client";
import { useCallback } from "react";
import type { GameRuntimeProps } from "@/lib/games";
import { gameTone } from "@/lib/gameFeedback";
import {
  SHOT_GALLERY_CORE_V11 as core,
  GALLERY_V11,
  galleryTargetPosV11,
  type GalleryStateV11,
} from "@/lib/verified/shotGalleryCore.v11";
import CoreCanvasGame, { type CorePoint } from "./CoreCanvasGame";
import { t as tx, formatNumber, useI18n } from "@/lib/i18n";

/*
 * Presentation only (V11: carnival tarp with 12 windows; score = accumulated reaction time). Reads the authoritative state and never writes it. Plates are static;
 * positions come from galleryTargetPosV11, the same pure function the tests use.
 */
const PAINT = ["#3d8bff", "#ff5a4a", "#8fd43a", "#9a63ff", "#ffcc1f", "#ff4fa0", "#1fd1bd", "#ff8a1f"];
const GREY = "#9aa3ab";
const RED = "#ff2d3c";
const msOf = (ticks: number) => Math.round((ticks * 1000) / 120);
const RESULT_LAMP: Record<string, string> = { CORRECT: "#e8edf2", PARTIAL: "#ffcc1f", WRONG: RED, FALSE_START: RED, TIMEOUT: "#ff8a1f" };
const noise = (n: number) => { const v = Math.sin(n * 12.9898) * 43758.5453; return v - Math.floor(v); };

function figure(ctx: CanvasRenderingContext2D, kind: number, x: number, y: number, size: number) {
  ctx.beginPath();
  if (kind === 0) ctx.arc(x, y, size, 0, Math.PI * 2);
  else if (kind === 2) ctx.rect(x - size * 0.88, y - size * 0.88, size * 1.76, size * 1.76);
  else if (kind === 4) {
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? size * 0.45 : size * 1.1;
      i ? ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r) : ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    ctx.closePath();
  } else {
    const n = kind === 1 ? 3 : 6;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / n;
      i ? ctx.lineTo(x + Math.cos(a) * size, y + Math.sin(a) * size) : ctx.moveTo(x + Math.cos(a) * size, y + Math.sin(a) * size);
    }
    ctx.closePath();
  }
  ctx.fill();
}

/** Was the last tap a hit (otherwise it was a penalty: wrong plate or false start)? */
const lastWasHit = (s: GalleryStateV11) => s.hits.length > 0 && s.tapTickAbs === s.lastTapTick;

/** A paint splash in ONE flat colour: an irregular round blob, no droplets, no shading. Shape is fixed per colour. */
function paintSplash(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, size: number, seed: number) {
  const h = (n: number) => { const v = Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453; return v - Math.floor(v); };
  ctx.fillStyle = color;
  ctx.beginPath();
  const lobes = 48;
  for (let i = 0; i <= lobes; i++) {
    const a = (i / lobes) * Math.PI * 2;
    const r = size * (0.84 + 0.1 * Math.sin(a * 3 + h(1) * 6) + 0.08 * Math.sin(a * 5 + h(2) * 6) + 0.05 * Math.sin(a * 9 + h(3) * 6));
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

/** Window geometry (logical px): every target owns one window of the 3 × 4 tarp grid. */
const WIN = { w: 104, h: 82 };
const TARGET_R = 33;
/** Tall phones: the window grid is centred in the taller tarp (presentation only; taps use the same offset). */
let gridDy = 0;
const offsetFor = (H: number) => Math.round(Math.min(130, Math.max(0, (H - 620) / 2)));
let tarpCache: { h: number; canvas: HTMLCanvasElement } | null = null;

/** Canvas tarp: weathered khaki canvas, vertical folds, stitched seams, grommets and ropes, 12 hemmed windows. */
function tarpArt(H: number) {
  if (tarpCache && tarpCache.h === H) return tarpCache.canvas;
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = 390 * 2; c.height = H * 2;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.scale(2, 2);
  const x0 = 8, y0 = 150, x1 = 382, y1 = H - 10;
  const base = ctx.createLinearGradient(0, y0, 0, y1);
  base.addColorStop(0, "#b9a47a"); base.addColorStop(0.5, "#a48e64"); base.addColorStop(1, "#7f6c4a");
  ctx.fillStyle = base; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  // Folds: soft vertical light/dark bands.
  for (let x = x0; x < x1; x += 22) {
    const k = Math.sin(x * 0.11) * 0.5 + 0.5;
    ctx.fillStyle = `rgba(${k > 0.5 ? "255,240,210" : "40,28,10"},${0.05 + Math.abs(k - 0.5) * 0.1})`;
    ctx.fillRect(x, y0, 22, y1 - y0);
  }
  // Weave: fine cross-hatch.
  ctx.strokeStyle = "rgba(60,44,20,.08)"; ctx.lineWidth = 0.6;
  for (let y = y0; y < y1; y += 3) { ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); }
  for (let x = x0; x < x1; x += 3) { ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke(); }
  // Stains.
  for (let i = 0; i < 14; i++) {
    const sx = x0 + noise(i + 3) * (x1 - x0), sy = y0 + noise(i + 30) * (y1 - y0), r = 10 + noise(i + 60) * 30;
    const g = ctx.createRadialGradient(sx, sy, 1, sx, sy, r);
    g.addColorStop(0, "rgba(70,50,20,.16)"); g.addColorStop(1, "rgba(70,50,20,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
  }
  // Top hem with grommets and ropes to the frame bar.
  ctx.fillStyle = "#3a2f22"; ctx.fillRect(x0 - 4, y0 - 14, x1 - x0 + 8, 8);
  ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.fillRect(x0, y0, x1 - x0, 10);
  for (let x = x0 + 16; x < x1; x += 34) {
    ctx.strokeStyle = "#d8c79a"; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x, y0 - 8); ctx.lineTo(x, y0 + 6); ctx.stroke();
    ctx.fillStyle = "#c9ced3"; ctx.beginPath(); ctx.arc(x, y0 + 6, 3.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#2a2118"; ctx.beginPath(); ctx.arc(x, y0 + 6, 1.8, 0, Math.PI * 2); ctx.fill();
  }
  // Windows: dark openings with a stitched hem.
  const dy = offsetFor(H);
  for (const wy0 of GALLERY_V11.windows.ys) for (const wx of GALLERY_V11.windows.xs) {
    const wy = wy0 + dy;
    const l = wx - WIN.w / 2, t = wy - WIN.h / 2;
    ctx.fillStyle = "rgba(40,28,12,.45)"; ctx.fillRect(l - 5, t - 5, WIN.w + 10, WIN.h + 10);
    const inside = ctx.createLinearGradient(0, t, 0, t + WIN.h);
    inside.addColorStop(0, "#0b0907"); inside.addColorStop(1, "#1b150e");
    ctx.fillStyle = inside; ctx.fillRect(l, t, WIN.w, WIN.h);
    ctx.setLineDash([4, 3]); ctx.strokeStyle = "rgba(240,226,190,.55)"; ctx.lineWidth = 1;
    ctx.strokeRect(l - 3, t - 3, WIN.w + 6, WIN.h + 6);
    ctx.setLineDash([]);
  }
  // Border seam and shadow at the foot.
  ctx.strokeStyle = "#4a3b28"; ctx.lineWidth = 3; ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
  const foot = ctx.createLinearGradient(0, y1 - 40, 0, y1);
  foot.addColorStop(0, "rgba(0,0,0,0)"); foot.addColorStop(1, "rgba(0,0,0,.45)");
  ctx.fillStyle = foot; ctx.fillRect(x0, y1 - 40, x1 - x0, 40);
  tarpCache = { h: H, canvas: c };
  return c;
}

/** The roll-up flap of a window: `open` 0 = closed (covers the window), 1 = rolled up at the top. */
function drawFlap(ctx: CanvasRenderingContext2D, wx: number, wy: number, open: number) {
  const l = wx - WIN.w / 2, t = wy - WIN.h / 2, h = WIN.h * (1 - open);
  if (h > 0.5) {
    const g = ctx.createLinearGradient(0, t, 0, t + h);
    g.addColorStop(0, "#b29c70"); g.addColorStop(1, "#97825a");
    ctx.fillStyle = g; ctx.fillRect(l - 2, t - 2, WIN.w + 4, h + 2);
    ctx.fillStyle = "rgba(60,40,16,.25)";
    for (let x = l + 6; x < l + WIN.w; x += 14) ctx.fillRect(x, t, 2, h);
    ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.fillRect(l - 2, t + h - 3, WIN.w + 4, 3);
  }
  // Rolled canvas at the top.
  const rr = 5 + 4 * open;
  const g2 = ctx.createLinearGradient(0, t - rr, 0, t + rr);
  g2.addColorStop(0, "#d6c393"); g2.addColorStop(1, "#7b6844");
  ctx.fillStyle = g2;
  ctx.beginPath(); ctx.roundRect(l - 4, t - rr - 2, WIN.w + 8, rr * 2, rr); ctx.fill();
}

/** Order card pinned to the top: the colour as a flat paint splash, the figure in grey. No lights, no ammo. */
function drawOrder(ctx: CanvasRenderingContext2D, s: GalleryStateV11) {
  const x = 8, y = 40, w = 374, h = 96;
  ctx.fillStyle = "#efe6cf"; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#3a2f22"; ctx.lineWidth = 3; ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = "rgba(90,70,40,.12)"; for (let k = 0; k < 6; k++) ctx.fillRect(x, y + 8 + k * 16, w, 1);
  // Round tally.
  for (let i = 0; i < 12; i++) {
    const r = s.results[i];
    ctx.fillStyle = r ? (r.type === "CORRECT" ? "#3a8a3a" : RED) : i === s.trial ? "#3a2f22" : "rgba(58,47,34,.2)";
    ctx.fillRect(x + 32 + i * 26, y + 9, 18, 5);
  }
  const trial = s.trials[Math.min(s.trial, 11)], order = trial.order;
  paintSplash(ctx, PAINT[order.color], 150, y + 54, 26, order.color + 1);
  ctx.fillStyle = "#6b5a40"; ctx.font = "900 24px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("+", 195, y + 54);
  ctx.fillStyle = GREY; figure(ctx, order.shape, 240, y + 54, 22);
  ctx.strokeStyle = "rgba(0,0,0,.35)"; ctx.lineWidth = 1.5; ctx.stroke();
}

/** A target board inside its window: round painted wood with the coloured figure; `up` 0..1 pops it up. */
function drawTarget(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, shape: number, up: number, alpha = 1) {
  if (up <= 0.02) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath(); ctx.rect(x - WIN.w / 2, y - WIN.h / 2, WIN.w, WIN.h); ctx.clip();
  const dy = (1 - up) * (TARGET_R * 2 + 10);
  ctx.translate(0, dy);
  ctx.fillStyle = "rgba(0,0,0,.5)"; ctx.beginPath(); ctx.arc(x + 3, y + 4, TARGET_R, 0, Math.PI * 2); ctx.fill();
  const wood = ctx.createRadialGradient(x - 10, y - 12, 4, x, y, TARGET_R);
  wood.addColorStop(0, "#fbf3df"); wood.addColorStop(1, "#d9c9a3");
  ctx.fillStyle = wood; ctx.beginPath(); ctx.arc(x, y, TARGET_R, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#5b4630"; ctx.lineWidth = 3; ctx.stroke();
  ctx.strokeStyle = "rgba(91,70,48,.35)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, TARGET_R - 6, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = color; figure(ctx, shape, x, y, 19);
  ctx.strokeStyle = "rgba(0,0,0,.35)"; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.restore();
}

/** Bullet hole: dark core, torn rim and radial cracks. Deterministic per id. */
function drawHole(ctx: CanvasRenderingContext2D, x: number, y: number, id: number) {
  ctx.strokeStyle = "rgba(10,10,10,.75)"; ctx.lineWidth = 1;
  for (let q = 0; q < 6; q++) {
    const a = noise(id * 7 + q) * Math.PI * 2, l = 7 + noise(id * 11 + q) * 9;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l * 0.5 + 1.5, y + Math.sin(a) * l * 0.5); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
  }
  ctx.fillStyle = "#c9ced3"; ctx.beginPath(); ctx.arc(x, y, 4.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#050505"; ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2); ctx.fill();
}

/** Red reticle. */
function drawReticle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha; ctx.strokeStyle = RED; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - r - 8, y); ctx.lineTo(x - r + 6, y); ctx.moveTo(x + r - 6, y); ctx.lineTo(x + r + 8, y);
  ctx.moveTo(x, y - r - 8); ctx.lineTo(x, y - r + 6); ctx.moveTo(x, y + r - 6); ctx.lineTo(x, y + r + 8);
  ctx.stroke();
  ctx.fillStyle = RED; ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

const hudLabel = (s: Readonly<GalleryStateV11>) => `${tx("gallery.timeHud", { n: formatNumber(s.totalMs), trial: Math.min(12, s.trial + 1) })}`;
const feedbackScore = (s: Readonly<GalleryStateV11>) => s.totalMs;

/** Reaction times are kept on this device (last 30 runs): presentation/storage only. */
let savedSeed = "";
function persistReactions(s: GalleryStateV11) {
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

export default function ShotGallery(props: GameRuntimeProps) {
  useI18n();
  const render = useCallback((ctx: CanvasRenderingContext2D, s: GalleryStateV11, view?: { width: number; height: number }) => {
    persistReactions(s);
    const H = Math.max(620, view?.height ?? 620), b = { x0: 8, y0: 150, x1: 382, y1: H - 10 };
    gridDy = offsetFor(H);
    const trial = s.trials[Math.min(s.trial, 11)], since = s.tick - s.lastTapTick;
    ctx.fillStyle = "#15110c"; ctx.fillRect(0, 0, 390, H);
    drawOrder(ctx, s);
    const kick = s.phase !== "waiting" && since >= 0 && since < 8 ? (8 - since) * 0.5 : 0;
    ctx.save();
    ctx.translate(0, -kick);
    const art = tarpArt(H);
    if (art) ctx.drawImage(art, 0, 0, 390, H);
    const elapsed = s.readyTick >= 0 ? s.tick - s.readyTick : 0;
    // Windows: the flaps roll up on the start (staggered), revealing the targets; they drop again between rounds.
    const byWindow = new Map(trial.targets.map((t, i) => [`${t.x},${t.y}`, i] as const));
    const fb = s.phase === "feedback" ? s.phaseTicks : 0;
    GALLERY_V11.windows.ys.forEach((wy0, row) => GALLERY_V11.windows.xs.forEach((wx, col) => {
      const wy = wy0 + gridDy;
      const stagger = (row * 3 + col) % 4;
      const open = s.phase === "waiting" ? 0 : s.phase === "ready" ? Math.min(1, Math.max(0, (elapsed - stagger) / 6)) : Math.max(0, 1 - Math.max(0, fb - 54) / 20);
      const i = byWindow.get(`${wx},${wy0}`);
      if (i !== undefined) {
        const t = trial.targets[i], hitAt = s.hits.indexOf(i);
        const knock = hitAt < 0 ? 0 : hitAt === s.hits.length - 1 ? Math.min(1, Math.max(0, (since - 4) / 8)) : 1;
        const dim = s.phase === "feedback" && !trial.answers.includes(i);
        drawTarget(ctx, wx, wy, PAINT[t.color], t.shape, open * (1 - knock), dim ? 0.35 : 1);
        if (hitAt >= 0 && knock < 1) drawHole(ctx, wx + 6, wy - 6, i + s.trial * 17);
        if (hitAt >= 0) {
          ctx.font = "900 13px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.lineWidth = 3; ctx.strokeStyle = "rgba(30,20,10,.85)"; ctx.fillStyle = "#fff3d6";
          const label = `${msOf(s.tapTicks[hitAt] ?? 0)} ms`;
          ctx.strokeText(label, wx, wy - WIN.h / 2 + 12); ctx.fillText(label, wx, wy - WIN.h / 2 + 12);
        }
      }
      drawFlap(ctx, wx, wy, open);
    }));
    // Impact: flash, sparks and the reticle locked on the target.
    const lastIdx = s.hits.length ? s.hits[s.hits.length - 1] : -1;
    if (lastIdx >= 0 && lastWasHit(s) && since >= 0 && since < 30) {
      const p0 = galleryTargetPosV11(trial.targets[lastIdx]), p = { x: p0.x, y: p0.y + gridDy }, k = since / 30;
      if (since < 4) { ctx.fillStyle = `rgba(255,250,235,${1 - since / 4})`; ctx.beginPath(); ctx.arc(p.x + 6, p.y - 6, 16 - since * 3, 0, Math.PI * 2); ctx.fill(); }
      for (let q = 0; q < 10; q++) {
        const ang = -Math.PI * 0.9 + (q / 9) * Math.PI * 0.8 + noise(q + lastIdx) * 0.3, d = 8 + k * 40;
        ctx.strokeStyle = `rgba(255,${180 + q * 7},90,${1 - k})`; ctx.lineWidth = 1.8;
        const sx = p.x + 6 + Math.cos(ang) * d, sy = p.y - 6 + Math.sin(ang) * d + k * k * 20;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - Math.cos(ang) * 6, sy - Math.sin(ang) * 6); ctx.stroke();
      }
      drawReticle(ctx, p.x, p.y, 30 + 12 * (1 - Math.min(1, since / 6)), 1 - k);
      ctx.fillStyle = "#ffcc1f"; ctx.font = "900 16px system-ui"; ctx.textAlign = "center";
      ctx.lineWidth = 3; ctx.strokeStyle = "rgba(30,20,10,.85)";
      ctx.strokeText(`+${s.lastAddedMs} ms`, p.x, p.y + WIN.h / 2 + 12 - since * 0.4); ctx.fillText(`+${s.lastAddedMs} ms`, p.x, p.y + WIN.h / 2 + 12 - since * 0.4);
    }
    if (!lastWasHit(s) && s.lastTapTick >= 0 && s.lastAddedMs > 0 && since >= 0 && since < 50) {
      ctx.strokeStyle = `rgba(255,45,60,${0.9 * (1 - since / 50)})`; ctx.lineWidth = 6;
      ctx.strokeRect(b.x0 + 3, b.y0 + 3, b.x1 - b.x0 - 6, b.y1 - b.y0 - 6);
      ctx.fillStyle = `rgba(255,80,90,${1 - since / 50})`; ctx.font = "900 22px system-ui"; ctx.textAlign = "center";
      ctx.fillText(`+${s.lastAddedMs} ms`, 195, b.y0 + 30 - since * 0.3);
    }
    const last = s.results.at(-1);
    if (s.phase === "feedback" && last) {
      const age = s.tick - (s.lastTapTick >= s.readyTick ? s.lastTapTick : s.readyTick);
      const text: Record<string, string> = { CORRECT: tx("gallery.hit"), PARTIAL: tx("gallery.partial"), WRONG: tx("gallery.wrong"), FALSE_START: tx("gallery.falseStart"), TIMEOUT: tx("gallery.timeout") };
      const grow = Math.min(1, Math.max(0, age) / 6), label = text[last.type] ?? "", my = (b.y0 + b.y1) / 2;
      ctx.font = `900 ${20 + Math.round(10 * grow)}px system-ui`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const wText = Math.min(360, ctx.measureText(label).width + 40);
      ctx.fillStyle = "rgba(20,14,8,.88)"; ctx.fillRect(195 - wText / 2, my - 24, wText, 48);
      ctx.fillStyle = RESULT_LAMP[last.type] ?? "#ffffff";
      ctx.fillText(label, 195, my);
      ctx.font = "800 14px system-ui"; ctx.fillStyle = "#e8edf2";
      ctx.fillText(`+${formatNumber(last.addedMs ?? 0)} ms`, 195, my + 40);
    }
    ctx.restore();
  }, []);
  const pick = useCallback((point: CorePoint, phase: "down" | "move" | "up", s: GalleryStateV11) => {
    if (phase !== "down" || s.phase === "feedback") return null;
    // Tapping before the tarp opens is a false start wherever the finger lands.
    if (s.phase === "waiting") return "PICK_0";
    let best = -1, bestDistance = 48;
    s.trials[s.trial].targets.forEach((t, i) => {
      const p = galleryTargetPosV11(t), d = Math.hypot(point.x - p.x, point.y - (p.y + gridDy));
      if (!s.hits.includes(i) && d < bestDistance) { best = i; bestDistance = d; }
    });
    if (best >= 0) gameTone("tap");
    return best < 0 ? null : `PICK_${best}`;
  }, []);
  return (
    <div className="shotGalleryVerified">
      <CoreCanvasGame {...props} core={core} name="Shot Gallery" instruction="" render={render} pointAction={pick} expandVerticalViewport hideHudScore hudLabel={hudLabel} feedbackScore={feedbackScore} />
    </div>
  );
}
