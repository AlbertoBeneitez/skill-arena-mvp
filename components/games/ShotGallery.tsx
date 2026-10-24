"use client";
import { useCallback } from "react";
import type { GameRuntimeProps } from "@/lib/games";
import { drawSpaceBackdrop } from "@/lib/spaceBackdrop";
import { gameTone } from "@/lib/gameFeedback";
import {
  SHOT_GALLERY_CORE_V7 as core,
  type GalleryStateV7,
} from "@/lib/verified/shotGalleryCore.v7";
import CoreCanvasGame, { type CorePoint } from "./CoreCanvasGame";

import { t as tx, formatNumber, useI18n } from "@/lib/i18n";
const PAINT = ["#4fa8ff", "#ff7a6b", "#a8e05f", "#a47bff", "#ffd23f", "#ff6fb5", "#2fd9c8", "#ff9a3c"];
const msOf = (ticks: number) => Math.round((ticks * 1000) / 120);

function figure(ctx: CanvasRenderingContext2D, kind: number, x: number, y: number, size: number) {
  ctx.beginPath();
  if (kind === 0) ctx.arc(x, y, size, 0, Math.PI * 2);
  else if (kind === 2) ctx.roundRect(x - size * 0.9, y - size * 0.9, size * 1.8, size * 1.8, 6);
  else if (kind === 4) {
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5,
        r = i % 2 ? size * 0.45 : size * 1.1;
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

/** Paint splash: wet central blob, thrown streaks with teardrop tips, satellite droplets and a gloss.
 * Deterministic (no Math.random): the same colour+seed always draws the same blot. */
function splash(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, size: number, seed: number) {
  const h = (n: number) => {
    const v = Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453;
    return v - Math.floor(v);
  };
  ctx.save();
  ctx.fillStyle = color;
  // Streaks flung outwards (tapered), drawn first so the blob swallows their roots.
  const streaks = 7 + Math.floor(h(1) * 4);
  for (let k = 0; k < streaks; k++) {
    const a = (k / streaks) * Math.PI * 2 + h(k + 3) * 0.6;
    const len = size * (1.25 + h(k + 9) * 0.9);
    const w = size * (0.1 + h(k + 15) * 0.14);
    const nx = -Math.sin(a), ny = Math.cos(a);
    const bx = x + Math.cos(a) * size * 0.55, by = y + Math.sin(a) * size * 0.55;
    const tx = x + Math.cos(a) * len, ty = y + Math.sin(a) * len;
    ctx.beginPath();
    ctx.moveTo(bx + nx * w * 2.2, by + ny * w * 2.2);
    ctx.quadraticCurveTo(x + Math.cos(a) * len * 0.8 + nx * w, y + Math.sin(a) * len * 0.8 + ny * w, tx, ty);
    ctx.quadraticCurveTo(x + Math.cos(a) * len * 0.8 - nx * w, y + Math.sin(a) * len * 0.8 - ny * w, bx - nx * w * 2.2, by - ny * w * 2.2);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(tx + Math.cos(a) * w * 1.2, ty + Math.sin(a) * w * 1.2, w * 1.35, 0, Math.PI * 2);
    ctx.fill();
  }
  // Blob.
  ctx.beginPath();
  const lobes = 28;
  for (let i = 0; i <= lobes; i++) {
    const a = (i / lobes) * Math.PI * 2;
    const r = size * (0.74 + 0.16 * Math.sin(a * 2 + h(2) * 6) + 0.11 * Math.sin(a * 3 + h(4) * 6) + 0.07 * Math.sin(a * 5 + h(5) * 6) + 0.04 * Math.sin(a * 9 + h(6) * 6));
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  // Satellite droplets.
  for (let k = 0; k < 9; k++) {
    const a = h(k + 30) * Math.PI * 2, d = size * (1.35 + h(k + 40) * 0.75), r = size * (0.04 + h(k + 50) * 0.1);
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // Darker wet rim + gloss.
  ctx.strokeStyle = "rgba(0,0,0,.18)";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,.35)";
  ctx.beginPath();
  ctx.ellipse(x - size * 0.28, y - size * 0.32, size * 0.24, size * 0.13, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.2)";
  ctx.beginPath();
  ctx.arc(x + size * 0.22, y + size * 0.3, size * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

const hudLabel = (s: Readonly<GalleryStateV7>) => {
  const taps = s.results.flatMap((r) => r.taps);
  const avg = taps.length ? ` · ${tx("gallery.avg", { n: msOf(taps.reduce((a, b) => a + b, 0) / taps.length) })}` : "";
  return `${tx("gallery.hud", { n: s.correct, trial: Math.min(12, s.trial + 1) })}${avg}`;
};
const feedbackScore = (s: Readonly<GalleryStateV7>) => s.total;

/** Reaction times are kept on this device (last 30 runs): presentation/storage only. */
let savedSeed = "";
function persistReactions(s: GalleryStateV7) {
  if (s.status === "running" || savedSeed === s.seed) return;
  savedSeed = s.seed;
  try {
    const taps = s.results.flatMap((r) => r.taps.map(msOf));
    if (!taps.length) return;
    const key = "galactic-shot-gallery-reactions",
      history = JSON.parse(localStorage.getItem(key) ?? "[]") as unknown[];
    history.push({
      at: Date.now(),
      seed: s.seed,
      averageMs: Math.round(taps.reduce((a, b) => a + b, 0) / taps.length),
      bestMs: Math.min(...taps),
      taps,
    });
    localStorage.setItem(key, JSON.stringify(history.slice(-30)));
  } catch {
    /* storage may be blocked */
  }
}

/* ---------- v107 booth presentation (pure: reads state, never writes it) ---------- */
const FIELD = { x0: 14, y0: 150, w: 362, h: 406 };
const RESULT_LAMP: Record<string, string> = { CORRECT: "#5cffb0", PARTIAL: "#ffd23f", WRONG: "#ff5a6a", FALSE_START: "#ff5a6a", TIMEOUT: "#ff9a3c" };

function bulb(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, on: boolean) {
  ctx.fillStyle = on ? color : "rgba(255,255,255,.12)";
  if (on) { ctx.shadowColor = color; ctx.shadowBlur = 10; }
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
}

function streakOf(s: GalleryStateV7) {
  let n = 0;
  for (let i = s.results.length - 1; i >= 0 && s.results[i].type === "CORRECT"; i--) n++;
  return n;
}

function drawAwning(ctx: CanvasRenderingContext2D, tick: number) {
  const top = 38, depth = 20, n = 13, w = 362 / n;
  for (let i = 0; i < n; i++) {
    const x = 14 + i * w;
    ctx.fillStyle = i % 2 ? "#1d2f6b" : "#c2185b";
    ctx.beginPath();
    ctx.moveTo(x, top); ctx.lineTo(x + w, top); ctx.lineTo(x + w, top + depth);
    ctx.quadraticCurveTo(x + w / 2, top + depth + 9 + Math.sin(tick * 0.05 + i) * 1.2, x, top + depth);
    ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = "rgba(255,255,255,.18)";
  ctx.fillRect(14, top, 362, 3);
}

function drawMarquee(ctx: CanvasRenderingContext2D, s: GalleryStateV7) {
  const x = 14, y = 64, w = 362, h = 74, chase = Math.floor(s.tick / 7);
  const frame = ctx.createLinearGradient(0, y, 0, y + h);
  frame.addColorStop(0, "#3a2a10"); frame.addColorStop(1, "#1c1406");
  ctx.fillStyle = frame;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 14); ctx.fill();
  ctx.strokeStyle = "#e7b54a"; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = "#0b1626";
  ctx.beginPath(); ctx.roundRect(x + 12, y + 14, w - 24, h - 24, 10); ctx.fill();
  // Top row: one bulb per round (result colour, current one blinks).
  for (let i = 0; i < 12; i++) {
    const bx = x + 26 + i * ((w - 52) / 11), r = s.results[i];
    const current = i === s.trial && !r;
    bulb(ctx, bx, y + 7, 3.6, r ? RESULT_LAMP[r.type] ?? "#ffffff" : "#ffffff", !!r || (current && chase % 2 === 0));
  }
  // Side and bottom bulbs chase.
  for (let i = 0; i < 4; i++) {
    bulb(ctx, x + 6, y + 16 + i * 14, 2.6, "#ffd36a", (chase + i) % 4 === 0);
    bulb(ctx, x + w - 6, y + 16 + i * 14, 2.6, "#ffd36a", (chase + i + 2) % 4 === 0);
  }
  for (let i = 0; i < 16; i++) bulb(ctx, x + 22 + i * ((w - 44) / 15), y + h - 5, 2.4, "#ffd36a", (chase + i) % 3 === 0);
}

function drawSignal(ctx: CanvasRenderingContext2D, x: number, y: number, ready: boolean, tick: number, scale = 1) {
  const pulse = 0.6 + 0.4 * Math.sin(tick * 0.12);
  ctx.fillStyle = "#05080f";
  ctx.strokeStyle = "#556677"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(x - 11 * scale, y - 22 * scale, 22 * scale, 44 * scale, 8 * scale); ctx.fill(); ctx.stroke();
  ctx.fillStyle = ready ? "rgba(255,77,77,.18)" : "#ff4d4d";
  if (!ready) { ctx.shadowColor = "#ff4d4d"; ctx.shadowBlur = 16 * pulse; }
  ctx.beginPath(); ctx.arc(x, y - 10 * scale, 7 * scale, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = ready ? "#5cffb0" : "rgba(92,255,176,.15)";
  if (ready) { ctx.shadowColor = "#5cffb0"; ctx.shadowBlur = 20; }
  ctx.beginPath(); ctx.arc(x, y + 10 * scale, 7 * scale, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
}

function drawBoothWall(ctx: CanvasRenderingContext2D, ready: boolean, tick: number) {
  const f = FIELD;
  ctx.save();
  ctx.beginPath(); ctx.roundRect(f.x0, f.y0 - 8, f.w, f.h + 16, 14); ctx.clip();
  const wall = ctx.createLinearGradient(0, f.y0, 0, f.y0 + f.h);
  wall.addColorStop(0, "#1a1240"); wall.addColorStop(1, "#0a1630");
  ctx.fillStyle = wall;
  ctx.fillRect(f.x0, f.y0 - 8, f.w, f.h + 16);
  // Printed stars on the back wall.
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(220,235,255,${0.15 + (i % 4) * 0.1 + 0.08 * Math.sin(tick * 0.03 + i)})`;
    ctx.fillRect(f.x0 + 8 + ((i * 89) % (f.w - 16)), f.y0 + ((i * 47) % f.h), i % 6 ? 1 : 2, i % 6 ? 1 : 2);
  }
  // Shelves (decorative rails).
  for (const y of [f.y0 + 120, f.y0 + 250, f.y0 + 380]) {
    ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fillRect(f.x0, y + 3, f.w, 4);
    ctx.fillStyle = "rgba(160,190,230,.14)"; ctx.fillRect(f.x0, y, f.w, 3);
  }
  // Curtains on both sides.
  for (const side of [0, 1]) {
    for (let i = 0; i < 4; i++) {
      const x = side ? f.x0 + f.w - 4 - i * 5 : f.x0 + 4 + i * 5;
      const g = ctx.createLinearGradient(x - 3, 0, x + 3, 0);
      g.addColorStop(0, "#5a0b2a"); g.addColorStop(0.5, "#b5225a"); g.addColorStop(1, "#5a0b2a");
      ctx.fillStyle = g;
      ctx.fillRect(x - 3, f.y0 - 8, 6, f.h + 16);
    }
  }
  ctx.restore();
  ctx.strokeStyle = ready ? "#5cffb0" : "#5a6f86";
  ctx.lineWidth = ready ? 2.5 : 2;
  if (ready) { ctx.shadowColor = "#5cffb0"; ctx.shadowBlur = 12; }
  ctx.beginPath(); ctx.roundRect(f.x0, f.y0 - 8, f.w, f.h + 16, 14); ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawPlate(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "rgba(0,0,0,.35)";
  ctx.beginPath(); ctx.ellipse(x + 2, y + 33, 24, 5, 0, 0, Math.PI * 2); ctx.fill();
  const plate = ctx.createRadialGradient(x - 8, y - 10, 2, x, y, 32);
  plate.addColorStop(0, "#f4f7fb"); plate.addColorStop(1, "#8d9cad");
  ctx.fillStyle = plate;
  ctx.beginPath(); ctx.arc(x, y, 31, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(200,40,70,.35)"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(x, y, 27, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = "#1a2433";
  ctx.beginPath(); ctx.arc(x, y, 25, 0, Math.PI * 2); ctx.fill();
}

export default function ShotGallery(props: GameRuntimeProps) {
  useI18n();
  const render = useCallback((ctx: CanvasRenderingContext2D, s: GalleryStateV7) => {
    persistReactions(s);
    const trial = s.trials[Math.min(s.trial, 11)],
      order = trial.order,
      colour = PAINT[order.color],
      ready = s.phase === "ready",
      f = FIELD,
      since = s.tick - s.lastTapTick;
    drawSpaceBackdrop(ctx, 390, 620, 0, s.tick);
    drawAwning(ctx, s.tick);
    drawMarquee(ctx, s);
    // Order (no text): colour splash, grey figure, or the coloured figure with both traits.
    ctx.textAlign = "center";
    const GREY = "#aeb7c0";
    if (order.kind === "COLOR") splash(ctx, colour, 195, 101, 15, order.color + 1);
    else if (order.kind === "SHAPE") {
      ctx.fillStyle = GREY;
      figure(ctx, order.shape, 195, 101, 18);
    } else {
      ctx.fillStyle = colour;
      figure(ctx, order.shape, 195, 101, 18);
      ctx.strokeStyle = "rgba(255,255,255,.55)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    // One pip per target still to hit.
    const need = trial.answers.length;
    for (let k = 0; k < need; k++) bulb(ctx, 195 + (k - (need - 1) / 2) * 12, 124, 2.8, "#5cffb0", k < s.hits.length);
    drawSignal(ctx, 344, 101, ready, s.tick, 0.82);
    const streak = streakOf(s);
    if (streak >= 2) {
      ctx.fillStyle = "#ffb03a";
      ctx.shadowColor = "#ff7a00"; ctx.shadowBlur = 10;
      ctx.font = "900 12px system-ui";
      ctx.fillText(tx("gallery.streak", { n: streak }), 62, 105);
      ctx.shadowBlur = 0;
    }

    // Small shake on every shot (hit or miss) during play.
    const shake = s.phase !== "waiting" && since >= 0 && since < 10 ? Math.sin(since * 2.4) * (10 - since) * 0.35 : 0;
    ctx.save();
    ctx.translate(shake, 0);
    drawBoothWall(ctx, ready, s.tick);

    if (s.phase === "waiting") {
      drawSignal(ctx, 195, f.y0 + f.h / 2, false, s.tick, 2.2);
      ctx.restore();
      return;
    }
    // Paint splats left on the back wall by this round's hits.
    s.hits.forEach((idx, n) => {
      const t = trial.targets[idx];
      ctx.globalAlpha = 0.55;
      splash(ctx, t.color >= 0 ? PAINT[t.color] : "#ffd36a", t.x, t.y - 4, 26, idx + n * 7 + s.trial * 13);
      ctx.globalAlpha = 1;
    });
    trial.targets.forEach((t, i) => {
      const hitAt = s.hits.indexOf(i);
      const done = s.phase === "feedback" ? s.results.at(-1)?.taps.length ? trial.answers.includes(i) && hitAt >= 0 : false : hitAt >= 0;
      // Pop-up: each plate flips up from its shelf with a small overshoot.
      const raw = Math.min(1, Math.max(0, (s.tick - s.readyTick + 1 - i * 0.6) / 8));
      const appear = raw < 1 ? raw * (1.15 - 0.15 * raw) : 1;
      // Knock-down: a hit plate tips backwards.
      const knock = hitAt < 0 ? 0 : hitAt === s.hits.length - 1 ? Math.min(1, Math.max(0, since / 10)) : 1;
      const sy = Math.max(0.12, appear * (1 - 0.82 * knock));
      ctx.save();
      ctx.translate(t.x, t.y + 32);
      ctx.scale(0.85 + 0.15 * appear, sy);
      ctx.translate(-t.x, -(t.y + 32));
      if (done) ctx.globalAlpha = 0.45;
      drawPlate(ctx, t.x, t.y);
      if (t.type === "COMBO") {
        ctx.fillStyle = PAINT[t.color];
        figure(ctx, t.shape, t.x, t.y, 19);
        ctx.strokeStyle = "rgba(255,255,255,.55)";
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (t.type === "SPLASH") splash(ctx, PAINT[t.color], t.x, t.y, 15, t.color + (i % 5));
      else {
        ctx.fillStyle = "#aeb7c0";
        figure(ctx, t.shape, t.x, t.y, 19);
        ctx.strokeStyle = "rgba(0,0,0,.45)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      ctx.restore();
      if (hitAt >= 0) {
        const ms = msOf(s.tapTicks[hitAt] ?? s.results.at(-1)?.taps[hitAt] ?? 0);
        const rating = ms <= 380 ? [tx("gallery.bolt"), "#ffe14a"] : ms <= 560 ? [tx("gallery.fast"), "#7cffb0"] : null;
        ctx.font = "900 13px system-ui";
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(0,0,0,.7)";
        ctx.fillStyle = "#f9ecd2";
        ctx.strokeText(`${ms} ms`, t.x, t.y - 36);
        ctx.fillText(`${ms} ms`, t.x, t.y - 36);
        if (rating) {
          ctx.font = "900 11px system-ui";
          ctx.fillStyle = rating[1];
          ctx.strokeText(rating[0], t.x, t.y - 50);
          ctx.fillText(rating[0], t.x, t.y - 50);
        }
      }
    });
    // Shot: impact flash, shock ring and sparks on the plate that was hit.
    const lastHit = s.hits.length ? trial.targets[s.hits[s.hits.length - 1]] : null;
    if (lastHit && s.lastAward >= 0 && since >= 0 && since < 36) {
      const k = since / 36;
      if (since < 6) {
        // Bullet hole flash: a bright star burst at the point of impact.
        ctx.fillStyle = `rgba(255,248,210,${1 - since / 6})`;
        ctx.shadowColor = "#ffd36a"; ctx.shadowBlur = 16;
        ctx.beginPath();
        for (let q = 0; q < 16; q++) {
          const a = (q / 16) * Math.PI * 2, r = q % 2 ? 6 : 16 - since;
          q ? ctx.lineTo(lastHit.x + Math.cos(a) * r, lastHit.y + Math.sin(a) * r) : ctx.moveTo(lastHit.x + Math.cos(a) * r, lastHit.y + Math.sin(a) * r);
        }
        ctx.closePath(); ctx.fill();
        ctx.shadowBlur = 0;
      }
      ctx.fillStyle = `rgba(255,255,255,${Math.max(0, 0.9 - k * 2.2)})`;
      ctx.beginPath(); ctx.arc(lastHit.x, lastHit.y, 6 + k * 26, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = `rgba(255,220,140,${1 - k})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(lastHit.x, lastHit.y, 10 + k * 46, 0, Math.PI * 2); ctx.stroke();
      for (let q = 0; q < 12; q++) {
        const ang = (q / 12) * Math.PI * 2 + 0.3, d = 12 + k * 48;
        ctx.fillStyle = q % 2 ? `rgba(255,236,170,${1 - k})` : `rgba(127,227,238,${1 - k})`;
        ctx.beginPath(); ctx.arc(lastHit.x + Math.cos(ang) * d, lastHit.y + Math.sin(ang) * d + k * k * 18, 2.2 * (1 - k) + 0.5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = "#ffe9a6";
      ctx.font = "900 16px system-ui";
      ctx.strokeStyle = "rgba(0,0,0,.6)"; ctx.lineWidth = 3;
      ctx.strokeText(`+${s.lastAward}`, lastHit.x + 30, lastHit.y - 10 - since * 0.6);
      ctx.fillText(`+${s.lastAward}`, lastHit.x + 30, lastHit.y - 10 - since * 0.6);
    }
    if (s.lastAward < 0 && since >= 0 && since < 60) {
      // Miss: red edge flash and the penalty.
      ctx.strokeStyle = `rgba(255,80,100,${0.9 * (1 - since / 60)})`;
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.roundRect(f.x0 + 3, f.y0 - 5, f.w - 6, f.h + 10, 12); ctx.stroke();
      ctx.fillStyle = `rgba(255,120,120,${1 - since / 60})`;
      ctx.font = "900 22px system-ui";
      ctx.fillText(`${s.lastAward}`, 195, f.y0 + 30 - since * 0.3);
    }
    const last = s.results.at(-1);
    if (s.phase === "feedback" && last) {
      const age = s.tick - (s.lastTapTick >= s.readyTick ? s.lastTapTick : s.readyTick);
      const text: Record<string, string> = { CORRECT: streak >= 3 ? tx("gallery.streakBig", { n: streak }) : tx("gallery.hit"), PARTIAL: tx("gallery.partial"), WRONG: tx("gallery.wrong"), FALSE_START: tx("gallery.falseStart"), TIMEOUT: tx("gallery.timeout") };
      if (last.type === "FALSE_START" || last.type === "TIMEOUT") {
        ctx.fillStyle = "rgba(6,14,24,.7)";
        ctx.fillRect(f.x0, f.y0 - 8, f.w, f.h + 16);
      }
      const grow = Math.min(1, Math.max(0, age) / 8);
      ctx.fillStyle = RESULT_LAMP[last.type] ?? "#ffffff";
      ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 18;
      ctx.font = `900 ${18 + Math.round(10 * grow)}px system-ui`;
      ctx.fillText(text[last.type] ?? "", 195, f.y0 + f.h / 2);
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }, []);
  const pick = useCallback((point: CorePoint, phase: "down" | "move" | "up", s: GalleryStateV7) => {
    if (phase !== "down" || s.phase === "feedback") return null;
    // Tapping before the green dot is a false start wherever the finger lands.
    if (s.phase === "waiting") return "PICK_0";
    let best = -1,
      bestDistance = 36;
    s.trials[s.trial].targets.forEach((t, i) => {
      const d = Math.hypot(point.x - t.x, point.y - t.y);
      if (!s.hits.includes(i) && d < bestDistance) {
        best = i;
        bestDistance = d;
      }
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
