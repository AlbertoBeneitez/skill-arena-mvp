"use client";
import { useCallback } from "react";
import type { GameRuntimeProps } from "@/lib/games";
import { gameTone } from "@/lib/gameFeedback";
import {
  SHOT_GALLERY_CORE_V9 as core,
  galleryTargetPosV9,
  type GalleryStateV9,
} from "@/lib/verified/shotGalleryCore.v9";
import CoreCanvasGame, { type CorePoint } from "./CoreCanvasGame";
import { t as tx, useI18n } from "@/lib/i18n";

/*
 * Presentation only (V9 killer range). Reads the authoritative state and never writes it. Plates are static;
 * positions come from galleryTargetPosV9, the same pure function the tests use.
 */
const PAINT = ["#3d8bff", "#ff5a4a", "#8fd43a", "#9a63ff", "#ffcc1f", "#ff4fa0", "#1fd1bd", "#ff8a1f"];
const GREY = "#9aa3ab";
const RED = "#ff2d3c";
const msOf = (ticks: number) => Math.round((ticks * 1000) / 120);
const RESULT_LAMP: Record<string, string> = { CORRECT: "#e8edf2", PARTIAL: "#ffcc1f", WRONG: RED, FALSE_START: RED, TIMEOUT: "#ff8a1f" };
const BOOTH = { x0: 8, y0: 150, x1: 382, y1: 556 };
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

/** Alien-head silhouette: wide cranium, narrow chin. Used for the steel plates. */
function headPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - r * 1.05);
  ctx.bezierCurveTo(x + r * 1.25, y - r * 1.05, x + r * 1.15, y + r * 0.2, x + r * 0.42, y + r * 0.85);
  ctx.quadraticCurveTo(x, y + r * 1.12, x - r * 0.42, y + r * 0.85);
  ctx.bezierCurveTo(x - r * 1.15, y + r * 0.2, x - r * 1.25, y - r * 1.05, x, y - r * 1.05);
  ctx.closePath();
}

function lamp(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, on: boolean) {
  ctx.fillStyle = on ? color : "rgba(255,255,255,.08)";
  if (on) { ctx.shadowColor = color; ctx.shadowBlur = 8; }
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
}

/** Range signal: one hard lamp. Red = plates down, hold fire. Green = shoot. */
function drawSignal(ctx: CanvasRenderingContext2D, x: number, y: number, ready: boolean, tick: number, scale = 1) {
  const pulse = 0.6 + 0.4 * Math.sin(tick * 0.18);
  ctx.fillStyle = "#050607"; ctx.strokeStyle = "#2b3038"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.rect(x - 13 * scale, y - 13 * scale, 26 * scale, 26 * scale); ctx.fill(); ctx.stroke();
  const c = ready ? "#43ff7a" : RED;
  ctx.fillStyle = c; ctx.shadowColor = c; ctx.shadowBlur = (ready ? 18 : 14 * pulse) * scale;
  ctx.beginPath(); ctx.arc(x, y, 8 * scale, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
}

const streakOf = (s: GalleryStateV9) => { let n = 0; for (let i = s.results.length - 1; i >= 0 && s.results[i].type === "CORRECT"; i--) n++; return n; };

/** Indoor range: dark concrete back wall, rubber berm at the foot, one row of overhead strip lights. */
function drawRange(ctx: CanvasRenderingContext2D, ready: boolean, b: typeof BOOTH) {
  const w = b.x1 - b.x0, h = b.y1 - b.y0;
  ctx.save();
  ctx.beginPath(); ctx.rect(b.x0, b.y0, w, h); ctx.clip();
  const wall = ctx.createLinearGradient(0, b.y0, 0, b.y1);
  wall.addColorStop(0, "#1d2126"); wall.addColorStop(0.7, "#15181c"); wall.addColorStop(1, "#0c0e10");
  ctx.fillStyle = wall; ctx.fillRect(b.x0, b.y0, w, h);
  // Concrete block joints.
  ctx.strokeStyle = "rgba(0,0,0,.35)"; ctx.lineWidth = 1;
  for (let y = b.y0 + 34, row = 0; y < b.y1 - 40; y += 34, row++) {
    ctx.beginPath(); ctx.moveTo(b.x0, y); ctx.lineTo(b.x1, y); ctx.stroke();
    for (let x = b.x0 + (row % 2 ? 0 : 36); x < b.x1; x += 72) { ctx.beginPath(); ctx.moveTo(x, y - 34); ctx.lineTo(x, y); ctx.stroke(); }
  }
  // Old impact pocks on the wall (fixed pattern).
  ctx.fillStyle = "rgba(0,0,0,.45)";
  for (let i = 0; i < 26; i++) { ctx.beginPath(); ctx.arc(b.x0 + noise(i + 1) * w, b.y0 + 20 + noise(i + 40) * (h - 80), 0.8 + noise(i + 80) * 1.6, 0, Math.PI * 2); ctx.fill(); }
  // Overhead light pools.
  for (let i = 0; i < 3; i++) {
    const cx = b.x0 + w * (0.18 + i * 0.32), pool = ctx.createRadialGradient(cx, b.y0, 4, cx, b.y0 + 120, 210);
    pool.addColorStop(0, "rgba(255,244,214,.16)"); pool.addColorStop(1, "rgba(255,244,214,0)");
    ctx.fillStyle = pool; ctx.fillRect(b.x0, b.y0, w, h);
    ctx.fillStyle = "rgba(255,246,222,.75)"; ctx.fillRect(cx - 34, b.y0, 68, 3);
  }
  // Rubber berm and floor.
  ctx.fillStyle = "#0a0b0c"; ctx.fillRect(b.x0, b.y1 - 30, w, 30);
  ctx.fillStyle = "rgba(255,204,31,.85)";
  for (let x = b.x0 - 20; x < b.x1; x += 28) { ctx.beginPath(); ctx.moveTo(x, b.y1 - 30); ctx.lineTo(x + 14, b.y1 - 30); ctx.lineTo(x + 6, b.y1 - 24); ctx.lineTo(x - 8, b.y1 - 24); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  ctx.strokeStyle = ready ? "#43ff7a" : "#2b3038"; ctx.lineWidth = ready ? 2.5 : 2;
  ctx.strokeRect(b.x0, b.y0, w, h);
}

/** Order slab: the colour as a flat swatch, the figure in grey, one cartridge per hit needed. */
function drawOrder(ctx: CanvasRenderingContext2D, s: GalleryStateV9, ready: boolean) {
  const x = 8, y = 40, w = 374, h = 96;
  ctx.fillStyle = "#0b0d0f"; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#2b3038"; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
  // Hazard edge.
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, 14, h); ctx.clip();
  ctx.fillStyle = "#ffcc1f"; ctx.fillRect(x, y, 14, h);
  ctx.fillStyle = "#0b0d0f";
  for (let k = -2; k < 12; k++) { ctx.beginPath(); ctx.moveTo(x, y + k * 14); ctx.lineTo(x + 14, y + k * 14 - 14); ctx.lineTo(x + 14, y + k * 14 - 7); ctx.lineTo(x, y + k * 14 + 7); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  // Round tally.
  for (let i = 0; i < 12; i++) {
    const r = s.results[i];
    ctx.fillStyle = r ? RESULT_LAMP[r.type] ?? "#fff" : i === s.trial ? "rgba(255,255,255,.55)" : "rgba(255,255,255,.1)";
    ctx.fillRect(x + 28 + i * 22, y + 8, 14, 4);
  }
  const trial = s.trials[Math.min(s.trial, 11)], order = trial.order;
  ctx.fillStyle = PAINT[order.color]; ctx.fillRect(118, y + 30, 40, 40);
  ctx.strokeStyle = "rgba(255,255,255,.25)"; ctx.lineWidth = 1; ctx.strokeRect(118, y + 30, 40, 40);
  ctx.fillStyle = "#5a636c"; ctx.font = "900 20px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("+", 182, y + 50);
  ctx.fillStyle = GREY; figure(ctx, order.shape, 220, y + 50, 19);
  // Cartridges: one per plate to drop, spent once hit.
  const need = trial.answers.length;
  for (let k = 0; k < need; k++) {
    const cx = 262 + k * 13, spent = k < s.hits.length;
    ctx.fillStyle = spent ? "#3a3f45" : "#d9a441"; ctx.fillRect(cx, y + 36, 7, 20);
    ctx.fillStyle = spent ? "#2b3038" : "#b87333"; ctx.beginPath(); ctx.moveTo(cx, y + 36); ctx.lineTo(cx + 3.5, y + 29); ctx.lineTo(cx + 7, y + 36); ctx.closePath(); ctx.fill();
  }
  drawSignal(ctx, x + w - 30, y + 50, ready, s.tick, 1);
  const streak = streakOf(s);
  if (streak >= 2) {
    ctx.fillStyle = "#ffcc1f"; ctx.font = "900 12px system-ui"; ctx.textAlign = "center";
    ctx.fillText(tx("gallery.streak", { n: streak }), 64, y + 52);
  }
}

/** Steel plate on a post: alien-head silhouette with the coloured figure painted on. `lift` 0..1 flips it up. */
function drawPlate(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, shape: number, lift: number, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#3b4148"; ctx.fillRect(x - 2, y + 24, 4, 26);
  ctx.fillStyle = "#24282d"; ctx.fillRect(x - 11, y + 48, 22, 5);
  ctx.translate(x, y + 26); ctx.scale(1, Math.max(0.06, lift)); ctx.translate(-x, -(y + 26));
  ctx.fillStyle = "rgba(0,0,0,.45)"; headPath(ctx, x + 3, y + 3, 26); ctx.fill();
  const steel = ctx.createLinearGradient(x - 26, y - 26, x + 26, y + 26);
  steel.addColorStop(0, "#8e979f"); steel.addColorStop(0.5, "#5d656d"); steel.addColorStop(1, "#3c4248");
  ctx.fillStyle = steel; headPath(ctx, x, y, 26); ctx.fill();
  ctx.strokeStyle = "#1a1d20"; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = color; figure(ctx, shape, x, y - 2, 13);
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

const hudLabel = (s: Readonly<GalleryStateV9>) => {
  const taps = s.results.flatMap((r) => r.taps);
  const avg = taps.length ? ` · ${tx("gallery.avg", { n: msOf(taps.reduce((a, b) => a + b, 0) / taps.length) })}` : "";
  return `${tx("gallery.hud", { n: s.correct, trial: Math.min(12, s.trial + 1) })}${avg}`;
};
const feedbackScore = (s: Readonly<GalleryStateV9>) => s.total;

/** Reaction times are kept on this device (last 30 runs): presentation/storage only. */
let savedSeed = "";
function persistReactions(s: GalleryStateV9) {
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
  const render = useCallback((ctx: CanvasRenderingContext2D, s: GalleryStateV9, view?: { width: number; height: number }) => {
    persistReactions(s);
    // The range runs to the bottom of the screen on tall phones (plates stay where the core puts them).
    const H = Math.max(620, view?.height ?? 620), b = { ...BOOTH, y1: Math.max(BOOTH.y1, H - 14) };
    const trial = s.trials[Math.min(s.trial, 11)], ready = s.phase === "ready", since = s.tick - s.lastTapTick;
    ctx.fillStyle = "#07080a"; ctx.fillRect(0, 0, 390, H);
    drawOrder(ctx, s, ready);
    // Recoil: a short vertical kick on every shot.
    const kick = s.phase !== "waiting" && since >= 0 && since < 8 ? (8 - since) * 0.5 : 0;
    ctx.save();
    ctx.translate(0, -kick);
    drawRange(ctx, ready, b);
    const elapsed = s.readyTick >= 0 ? s.tick - s.readyTick : 0;
    ctx.save();
    ctx.beginPath(); ctx.rect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); ctx.clip();
    trial.targets.forEach((t, i) => {
      const p = galleryTargetPosV9(t), hitAt = s.hits.indexOf(i);
      // Plates are down on red and snap up on green; a hit plate is knocked flat.
      const appear = s.phase === "waiting" ? 0 : Math.min(1, Math.max(0, (elapsed + 1 - (i % 4)) / 5));
      const knock = hitAt < 0 ? 0 : hitAt === s.hits.length - 1 ? Math.min(1, Math.max(0, (since - 4) / 8)) : 1;
      const dim = s.phase === "feedback" && !trial.answers.includes(i);
      drawPlate(ctx, p.x, p.y, PAINT[t.color], t.shape, Math.max(0.06, appear * (1 - 0.94 * knock)), dim ? 0.35 : 1);
      if (hitAt >= 0) {
        if (knock < 1) drawHole(ctx, p.x + 4, p.y - 6, i + s.trial * 17);
        else { ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(p.x - 18, p.y + 22, 36, 4); }
        const ms = msOf(s.tapTicks[hitAt] ?? 0);
        const rating = ms <= 380 ? [tx("gallery.bolt"), "#ffcc1f"] : ms <= 560 ? [tx("gallery.fast"), "#e8edf2"] : null;
        ctx.font = "800 12px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#e8edf2";
        ctx.fillText(`${ms} ms`, p.x, p.y - 38);
        if (rating) { ctx.font = "900 11px system-ui"; ctx.fillStyle = rating[1]; ctx.fillText(rating[0], p.x, p.y - 52); }
      }
    });
    ctx.restore();
    if (s.phase === "waiting") drawSignal(ctx, 195, (b.y0 + b.y1) / 2, false, s.tick, 2.2);
    // Impact: muzzle-white flash, a few hot sparks and the reticle locked on the plate.
    const lastIdx = s.hits.length ? s.hits[s.hits.length - 1] : -1;
    if (lastIdx >= 0 && s.lastAward >= 0 && since >= 0 && since < 30) {
      const p = galleryTargetPosV9(trial.targets[lastIdx]), k = since / 30;
      if (since < 4) { ctx.fillStyle = `rgba(255,250,235,${1 - since / 4})`; ctx.beginPath(); ctx.arc(p.x + 4, p.y - 6, 12 - since * 2, 0, Math.PI * 2); ctx.fill(); }
      for (let q = 0; q < 8; q++) {
        const ang = -Math.PI * 0.9 + (q / 7) * Math.PI * 0.8 + noise(q + lastIdx) * 0.3, d = 6 + k * 34;
        ctx.strokeStyle = `rgba(255,${180 + q * 8},90,${1 - k})`; ctx.lineWidth = 1.6;
        const sx = p.x + 4 + Math.cos(ang) * d, sy = p.y - 6 + Math.sin(ang) * d + k * k * 20;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - Math.cos(ang) * 5, sy - Math.sin(ang) * 5); ctx.stroke();
      }
      drawReticle(ctx, p.x, p.y - 2, 22 + 10 * (1 - Math.min(1, since / 6)), 1 - k);
      ctx.fillStyle = "#ffcc1f"; ctx.font = "900 15px system-ui"; ctx.textAlign = "center";
      ctx.fillText(`+${s.lastAward}`, p.x + 34, p.y - 12 - since * 0.5);
    }
    if (s.lastAward < 0 && since >= 0 && since < 50) {
      ctx.strokeStyle = `rgba(255,45,60,${0.9 * (1 - since / 50)})`; ctx.lineWidth = 6;
      ctx.strokeRect(b.x0 + 3, b.y0 + 3, b.x1 - b.x0 - 6, b.y1 - b.y0 - 6);
      ctx.fillStyle = `rgba(255,80,90,${1 - since / 50})`; ctx.font = "900 22px system-ui"; ctx.textAlign = "center";
      ctx.fillText(`${s.lastAward}`, 195, b.y0 + 30 - since * 0.3);
    }
    const last = s.results.at(-1);
    if (s.phase === "feedback" && last) {
      const age = s.tick - (s.lastTapTick >= s.readyTick ? s.lastTapTick : s.readyTick), streak = streakOf(s);
      const text: Record<string, string> = { CORRECT: streak >= 3 ? tx("gallery.streakBig", { n: streak }) : tx("gallery.hit"), PARTIAL: tx("gallery.partial"), WRONG: tx("gallery.wrong"), FALSE_START: tx("gallery.falseStart"), TIMEOUT: tx("gallery.timeout") };
      if (last.type === "FALSE_START" || last.type === "TIMEOUT") { ctx.fillStyle = "rgba(0,0,0,.65)"; ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); }
      const grow = Math.min(1, Math.max(0, age) / 6), label = text[last.type] ?? "";
      ctx.font = `900 ${20 + Math.round(10 * grow)}px system-ui`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const wText = Math.min(360, ctx.measureText(label).width + 40);
      ctx.fillStyle = "rgba(0,0,0,.8)"; ctx.fillRect(195 - wText / 2, (b.y0 + b.y1) / 2 - 24, wText, 48);
      ctx.fillStyle = RESULT_LAMP[last.type] ?? "#ffffff";
      ctx.fillText(label, 195, (b.y0 + b.y1) / 2);
    }
    ctx.restore();
  }, []);
  const pick = useCallback((point: CorePoint, phase: "down" | "move" | "up", s: GalleryStateV9) => {
    if (phase !== "down" || s.phase === "feedback") return null;
    // Tapping before the green light is a false start wherever the finger lands.
    if (s.phase === "waiting") return "PICK_0";
    let best = -1, bestDistance = 38;
    s.trials[s.trial].targets.forEach((t, i) => {
      const p = galleryTargetPosV9(t), d = Math.hypot(point.x - p.x, point.y - p.y);
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
