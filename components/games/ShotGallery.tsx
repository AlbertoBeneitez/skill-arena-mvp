"use client";
import { useCallback } from "react";
import type { GameRuntimeProps } from "@/lib/games";
import { drawSpaceBackdrop } from "@/lib/spaceBackdrop";
import { gameTone } from "@/lib/gameFeedback";
import {
  SHOT_GALLERY_CORE_V5 as core,
      type GalleryStateV5,
} from "@/lib/verified/shotGalleryCore.v5";
import CoreCanvasGame, { type CorePoint } from "./CoreCanvasGame";

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

const hudLabel = (s: Readonly<GalleryStateV5>) => {
  const taps = s.results.flatMap((r) => r.taps);
  const avg = taps.length ? ` · MEDIA ${msOf(taps.reduce((a, b) => a + b, 0) / taps.length)} ms` : "";
  return `${s.correct} ACIERTOS · ${Math.min(12, s.trial + 1)}/12${avg}`;
};
const feedbackScore = (s: Readonly<GalleryStateV5>) => s.total;

/** Reaction times are kept on this device (last 30 runs): presentation/storage only. */
let savedSeed = "";
function persistReactions(s: GalleryStateV5) {
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

export default function ShotGallery(props: GameRuntimeProps) {
  const render = useCallback((ctx: CanvasRenderingContext2D, s: GalleryStateV5) => {
    persistReactions(s);
    const trial = s.trials[Math.min(s.trial, 11)],
      order = trial.order,
      colour = PAINT[order.color],
      ready = s.phase === "ready",
      f = { x0: 14, y0: 150, w: 362, h: 406 };
    drawSpaceBackdrop(ctx, 390, 620, 0, s.tick);
    // Order panel: colour splash and/or grey figure only (no text).
    ctx.fillStyle = "rgba(10,24,38,.9)";
    ctx.strokeStyle = "#496a7b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(14, 70, 362, 66, 14);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = "center";
    const GREY = "#aeb7c0";
    if (order.kind === "COLOR") {
      splash(ctx, colour, 195, 103, 17, order.color + 1);
    } else if (order.kind === "SHAPE") {
      ctx.fillStyle = GREY;
      figure(ctx, order.shape, 195, 103, 20);
    } else {
      splash(ctx, colour, 140, 103, 16, order.color + 1);
      ctx.fillStyle = "#eaf2f8";
      ctx.beginPath();
      ctx.roundRect(188, 101, 14, 4, 2);
      ctx.roundRect(193, 96, 4, 14, 2);
      ctx.fill();
      ctx.fillStyle = GREY;
      figure(ctx, order.shape, 250, 103, 18);
    }
    // One pip per target still to hit (symbols, not text).
    const need = trial.answers.length;
    for (let k = 0; k < need; k++) {
      ctx.fillStyle = k < s.hits.length ? "#5cffb0" : "rgba(180,210,225,.55)";
      ctx.beginPath();
      ctx.arc(195 + (k - (need - 1) / 2) * 12, 127, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Red → green go signal.
    const pulse = 0.6 + 0.4 * Math.sin(s.tick * 0.12);
    ctx.save();
    ctx.shadowColor = ready ? "#5cffb0" : "#ff4d4d";
    ctx.shadowBlur = ready ? 18 : 10 * pulse;
    ctx.fillStyle = ready ? "#5cffb0" : "#ff4d4d";
    ctx.beginPath();
    ctx.arc(352, 103, ready ? 9 : 7 + pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Shooting field.
    ctx.fillStyle = "rgba(10,24,38,.94)";
    ctx.strokeStyle = ready ? "#4f9a86" : "#496a7b";
    ctx.beginPath();
    ctx.roundRect(f.x0, f.y0 - 8, f.w, f.h + 16, 14);
    ctx.fill();
    ctx.stroke();
    if (s.phase === "waiting") {
      ctx.strokeStyle = "rgba(100,150,170,.25)";
      ctx.lineWidth = 1;
      for (let y = f.y0; y < f.y0 + f.h; y += 16) {
        ctx.beginPath();
        ctx.moveTo(f.x0 + 6, y);
        ctx.lineTo(f.x0 + f.w - 6, y);
        ctx.stroke();
      }
      ctx.fillStyle = "#5c7686";
      ctx.font = "bold 15px system-ui";
      ctx.fillText("ESPERA AL VERDE", 195, f.y0 + f.h / 2);
      return;
    }
    trial.targets.forEach((t, i) => {
      const hitAt = s.hits.indexOf(i);
      const done = s.phase === "feedback" ? s.results.at(-1)?.taps.length ? trial.answers.includes(i) && hitAt >= 0 : false : hitAt >= 0;
      ctx.save();
      if (done) ctx.globalAlpha = 0.28;
      const appear = Math.min(1, (s.tick - s.readyTick + 1) / 10);
      ctx.translate(t.x, t.y);
      ctx.scale(0.6 + 0.4 * appear, 0.6 + 0.4 * appear);
      ctx.translate(-t.x, -t.y);
      // Soft ring so figures read on the dark field.
      ctx.fillStyle = "rgba(255,255,255,.07)";
      ctx.beginPath();
      ctx.arc(t.x, t.y, 31, 0, Math.PI * 2);
      ctx.fill();
      if (t.type === "SPLASH") splash(ctx, PAINT[t.color], t.x, t.y, 20, t.color + (i % 5));
      else {
        ctx.fillStyle = "#aeb7c0";
        figure(ctx, t.shape, t.x, t.y, 22);
        ctx.strokeStyle = "rgba(0,0,0,.45)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      ctx.restore();
      if (hitAt >= 0) {
        ctx.fillStyle = "#f9ecd2";
        ctx.font = "bold 13px system-ui";
        ctx.fillText(`${msOf(s.tapTicks[hitAt] ?? s.results.at(-1)?.taps[hitAt] ?? 0)} ms`, t.x, t.y - 28);
      }
    });
    const since = s.tick - s.lastTapTick;
    // Shooting effect: tracer from the muzzle, impact flash, shock ring and sparks.
    const lastHit = s.hits.length ? trial.targets[s.hits[s.hits.length - 1]] : null;
    if (lastHit && s.lastAward >= 0 && since >= 0 && since < 36) {
      const k = since / 36;
      if (since < 8) {
        ctx.strokeStyle = `rgba(255,244,196,${1 - since / 8})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(195, f.y0 + f.h + 12);
        ctx.lineTo(lastHit.x, lastHit.y);
        ctx.stroke();
      }
      ctx.fillStyle = `rgba(255,255,255,${Math.max(0, 0.9 - k * 2.2)})`;
      ctx.beginPath();
      ctx.arc(lastHit.x, lastHit.y, 6 + k * 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(255,220,140,${1 - k})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(lastHit.x, lastHit.y, 10 + k * 46, 0, Math.PI * 2);
      ctx.stroke();
      for (let q = 0; q < 10; q++) {
        const ang = (q / 10) * Math.PI * 2 + 0.3;
        ctx.strokeStyle = `rgba(255,236,170,${1 - k})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(lastHit.x + Math.cos(ang) * (12 + k * 20), lastHit.y + Math.sin(ang) * (12 + k * 20));
        ctx.lineTo(lastHit.x + Math.cos(ang) * (22 + k * 44), lastHit.y + Math.sin(ang) * (22 + k * 44));
        ctx.stroke();
      }
      // Bullet-hole crosshair stays a little longer.
      ctx.strokeStyle = `rgba(20,30,40,${0.6 * (1 - k)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(lastHit.x, lastHit.y, 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (s.lastAward < 0 && since >= 0 && since < 60) {
      ctx.fillStyle = `rgba(255,120,120,${1 - since / 60})`;
      ctx.font = "bold 20px system-ui";
      ctx.fillText(`${s.lastAward}`, 195, f.y0 - 16 - since * 0.3);
    }
    const last = s.results.at(-1);
    if (s.phase === "feedback" && last && (last.type === "FALSE_START" || last.type === "TIMEOUT")) {
      ctx.fillStyle = "rgba(6,14,24,.7)";
      ctx.fillRect(f.x0, f.y0 - 8, f.w, f.h + 16);
      ctx.fillStyle = last.type === "FALSE_START" ? "#ff8a8a" : "#e6c88c";
      ctx.font = "bold 22px system-ui";
      ctx.fillText(last.type === "FALSE_START" ? "DEMASIADO PRONTO" : "TARDE", 195, f.y0 + f.h / 2);
    }
  }, []);
  const pick = useCallback((point: CorePoint, phase: "down" | "move" | "up", s: GalleryStateV5) => {
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
