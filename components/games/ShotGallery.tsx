"use client";
import { useCallback } from "react";
import type { GameRuntimeProps } from "@/lib/games";
import { drawSpaceBackdrop } from "@/lib/spaceBackdrop";
import { gameTone } from "@/lib/gameFeedback";
import {
  SHOT_GALLERY_CORE_V8 as core,
  GALLERY_V8,
  galleryTargetPosV8,
  type GalleryStateV8,
} from "@/lib/verified/shotGalleryCore.v8";
import CoreCanvasGame, { type CorePoint } from "./CoreCanvasGame";
import { t as tx, useI18n } from "@/lib/i18n";

/*
 * Presentation only (V8 alien shooting range). Reads the authoritative state and never writes it. Stands slide
 * along three rails; positions come from galleryTargetPosV8, the same pure function the tests use.
 */
const PAINT = ["#4fa8ff", "#ff7a6b", "#a8e05f", "#a47bff", "#ffd23f", "#ff6fb5", "#2fd9c8", "#ff9a3c"];
const GREY = "#aeb7c0";
const msOf = (ticks: number) => Math.round((ticks * 1000) / 120);
const RESULT_LAMP: Record<string, string> = { CORRECT: "#5cffb0", PARTIAL: "#ffd23f", WRONG: "#ff5a6a", FALSE_START: "#ff5a6a", TIMEOUT: "#ff9a3c" };
const BOOTH = { x0: 8, y0: 150, x1: 382, y1: 548 };

function figure(ctx: CanvasRenderingContext2D, kind: number, x: number, y: number, size: number) {
  ctx.beginPath();
  if (kind === 0) ctx.arc(x, y, size, 0, Math.PI * 2);
  else if (kind === 2) ctx.roundRect(x - size * 0.9, y - size * 0.9, size * 1.8, size * 1.8, 5);
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

/** Paint splash as one single wet blob (no droplets), deterministic per seed. */
function splash(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, size: number, seed: number) {
  const h = (n: number) => { const v = Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453; return v - Math.floor(v); };
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  const lobes = 36;
  for (let i = 0; i <= lobes; i++) {
    const a = (i / lobes) * Math.PI * 2;
    const r = size * (0.82 + 0.12 * Math.sin(a * 3 + h(2) * 6) + 0.07 * Math.sin(a * 5 + h(4) * 6) + 0.04 * Math.sin(a * 8 + h(5) * 6));
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,.18)"; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,.32)";
  ctx.beginPath(); ctx.ellipse(x - size * 0.3, y - size * 0.32, size * 0.26, size * 0.14, -0.6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function bulb(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, on: boolean) {
  ctx.fillStyle = on ? color : "rgba(255,255,255,.12)";
  if (on) { ctx.shadowColor = color; ctx.shadowBlur = 10; }
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
}

function drawSignal(ctx: CanvasRenderingContext2D, x: number, y: number, ready: boolean, tick: number, scale = 1) {
  const pulse = 0.6 + 0.4 * Math.sin(tick * 0.12);
  ctx.fillStyle = "#05080f"; ctx.strokeStyle = "#556677"; ctx.lineWidth = 1.5;
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

const streakOf = (s: GalleryStateV8) => { let n = 0; for (let i = s.results.length - 1; i >= 0 && s.results[i].type === "CORRECT"; i--) n++; return n; };

/** Alien range booth: metal frame, neon trim, a mural of an alien world on the back wall and three glowing rails. */
function drawBooth(ctx: CanvasRenderingContext2D, ready: boolean, tick: number) {
  const b = BOOTH, w = b.x1 - b.x0, h = b.y1 - b.y0;
  ctx.save();
  ctx.beginPath(); ctx.roundRect(b.x0, b.y0, w, h, 16); ctx.clip();
  const wall = ctx.createLinearGradient(0, b.y0, 0, b.y1);
  wall.addColorStop(0, "#1a0f3a"); wall.addColorStop(0.55, "#2a1550"); wall.addColorStop(1, "#0d1a33");
  ctx.fillStyle = wall; ctx.fillRect(b.x0, b.y0, w, h);
  // Mural: two moons and an alien horizon with spires.
  ctx.fillStyle = "rgba(168,224,95,.16)"; ctx.beginPath(); ctx.arc(300, 196, 34, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(255,111,181,.14)"; ctx.beginPath(); ctx.arc(90, 186, 18, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(47,217,200,.10)";
  ctx.beginPath(); ctx.moveTo(b.x0, 300);
  for (let x = b.x0; x <= b.x1; x += 18) ctx.lineTo(x, 296 - 22 * Math.abs(Math.sin(x * 0.045)) - (x % 72 === 0 ? 30 : 0));
  ctx.lineTo(b.x1, b.y1); ctx.lineTo(b.x0, b.y1); ctx.closePath(); ctx.fill();
  for (let i = 0; i < 30; i++) {
    ctx.fillStyle = `rgba(220,235,255,${0.12 + (i % 4) * 0.08})`;
    ctx.fillRect(b.x0 + 8 + ((i * 89) % (w - 16)), b.y0 + 6 + ((i * 37) % 120), 1.5, 1.5);
  }
  // Rails: conveyor tracks with moving chevrons.
  GALLERY_V8.rails.forEach((y, r) => {
    const ry = y + 40;
    ctx.fillStyle = "#1b2436"; ctx.fillRect(b.x0, ry, w, 12);
    ctx.fillStyle = "rgba(127,227,238,.55)"; ctx.fillRect(b.x0, ry, w, 2);
    ctx.fillStyle = "rgba(0,0,0,.4)"; ctx.fillRect(b.x0, ry + 12, w, 4);
    const dir = r % 2 === 0 ? 1 : -1, shift = ((tick * 0.6 * dir) % 24 + 24) % 24;
    ctx.fillStyle = "rgba(127,227,238,.22)";
    for (let x = b.x0 - 24 + shift; x < b.x1 + 24; x += 24) {
      ctx.beginPath(); ctx.moveTo(x, ry + 4); ctx.lineTo(x + 6 * dir, ry + 7); ctx.lineTo(x, ry + 10); ctx.closePath(); ctx.fill();
    }
  });
  ctx.restore();
  // Neon frame.
  ctx.strokeStyle = ready ? "#5cffb0" : "#a8e05f";
  ctx.lineWidth = ready ? 3 : 2;
  ctx.shadowColor = ready ? "#5cffb0" : "#6f9f3a"; ctx.shadowBlur = ready ? 16 : 6;
  ctx.beginPath(); ctx.roundRect(b.x0, b.y0, w, h, 16); ctx.stroke();
  ctx.shadowBlur = 0;
}

/** Marquee with the order (colour blob + grey figure), one lamp per round and the start light. */
function drawMarquee(ctx: CanvasRenderingContext2D, s: GalleryStateV8, ready: boolean) {
  const x = 8, y = 40, w = 374, h = 96, chase = Math.floor(s.tick / 7);
  const frame = ctx.createLinearGradient(0, y, 0, y + h);
  frame.addColorStop(0, "#22303f"); frame.addColorStop(1, "#0d151f");
  ctx.fillStyle = frame; ctx.beginPath(); ctx.roundRect(x, y, w, h, 16); ctx.fill();
  ctx.strokeStyle = "#a8e05f"; ctx.lineWidth = 2; ctx.shadowColor = "#a8e05f"; ctx.shadowBlur = 8; ctx.stroke(); ctx.shadowBlur = 0;
  for (let i = 0; i < 12; i++) {
    const bx = x + 26 + i * ((w - 52) / 11), r = s.results[i], current = i === s.trial && !r;
    bulb(ctx, bx, y + 10, 3.6, r ? RESULT_LAMP[r.type] ?? "#ffffff" : "#ffffff", !!r || (current && chase % 2 === 0));
  }
  // Order screen.
  ctx.fillStyle = "#06101c"; ctx.beginPath(); ctx.roundRect(x + 70, y + 22, w - 140, h - 34, 12); ctx.fill();
  ctx.strokeStyle = "rgba(168,224,95,.35)"; ctx.lineWidth = 1; ctx.stroke();
  const trial = s.trials[Math.min(s.trial, 11)], order = trial.order;
  splash(ctx, PAINT[order.color], 160, y + 53, 20, order.color + 1);
  ctx.fillStyle = "#e9f4ff"; ctx.font = "900 22px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("+", 195, y + 53);
  ctx.fillStyle = GREY; figure(ctx, order.shape, 232, y + 53, 19);
  ctx.strokeStyle = "rgba(0,0,0,.45)"; ctx.lineWidth = 1.5; ctx.stroke();
  const need = trial.answers.length;
  for (let k = 0; k < need; k++) bulb(ctx, 195 + (k - (need - 1) / 2) * 12, y + 84, 3, "#5cffb0", k < s.hits.length);
  drawSignal(ctx, x + w - 34, y + 54, ready, s.tick, 0.9);
  const streak = streakOf(s);
  if (streak >= 2) {
    ctx.fillStyle = "#ffb03a"; ctx.shadowColor = "#ff7a00"; ctx.shadowBlur = 10; ctx.font = "900 12px system-ui";
    ctx.fillText(tx("gallery.streak", { n: streak }), x + 36, y + 56);
    ctx.shadowBlur = 0;
  }
}

/** A target stand: a saucer-shaped plate with antennae on a stick; the coloured figure is painted on the plate. */
function drawStand(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, shape: number, lift: number, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#7d8aa0"; ctx.fillRect(x - 2.5, y + 14, 5, 26);
  ctx.fillStyle = "#3a465c"; ctx.beginPath(); ctx.roundRect(x - 12, y + 36, 24, 8, 3); ctx.fill();
  ctx.translate(x, y + 20);
  ctx.scale(1, Math.max(0.08, lift));
  ctx.translate(-x, -(y + 20));
  ctx.strokeStyle = "#c8d3e0"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x - 14, y - 22); ctx.lineTo(x - 21, y - 36); ctx.moveTo(x + 14, y - 22); ctx.lineTo(x + 21, y - 36); ctx.stroke();
  ctx.fillStyle = "#5cffb0";
  ctx.beginPath(); ctx.arc(x - 21, y - 37, 3, 0, Math.PI * 2); ctx.arc(x + 21, y - 37, 3, 0, Math.PI * 2); ctx.fill();
  const plate = ctx.createRadialGradient(x - 8, y - 10, 2, x, y, 34);
  plate.addColorStop(0, "#f4f7fb"); plate.addColorStop(1, "#8d9cad");
  ctx.fillStyle = plate; ctx.beginPath(); ctx.ellipse(x, y, 31, 28, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#16202f"; ctx.beginPath(); ctx.ellipse(x, y, 25, 22, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = color; figure(ctx, shape, x, y, 15);
  ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.restore();
}

const hudLabel = (s: Readonly<GalleryStateV8>) => {
  const taps = s.results.flatMap((r) => r.taps);
  const avg = taps.length ? ` · ${tx("gallery.avg", { n: msOf(taps.reduce((a, b) => a + b, 0) / taps.length) })}` : "";
  return `${tx("gallery.hud", { n: s.correct, trial: Math.min(12, s.trial + 1) })}${avg}`;
};
const feedbackScore = (s: Readonly<GalleryStateV8>) => s.total;

/** Reaction times are kept on this device (last 30 runs): presentation/storage only. */
let savedSeed = "";
function persistReactions(s: GalleryStateV8) {
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
  const render = useCallback((ctx: CanvasRenderingContext2D, s: GalleryStateV8) => {
    persistReactions(s);
    const trial = s.trials[Math.min(s.trial, 11)], ready = s.phase === "ready", b = BOOTH, since = s.tick - s.lastTapTick;
    drawSpaceBackdrop(ctx, 390, 620, 0, s.tick);
    drawMarquee(ctx, s, ready);
    const shake = s.phase !== "waiting" && since >= 0 && since < 10 ? Math.sin(since * 2.4) * (10 - since) * 0.35 : 0;
    ctx.save();
    ctx.translate(shake, 0);
    drawBooth(ctx, ready, s.tick);
    const elapsed = s.readyTick >= 0 ? s.tick - s.readyTick : 0;
    // Paint blobs left on the back wall by this round's hits.
    s.hits.forEach((idx, n) => {
      const t = trial.targets[idx], p = galleryTargetPosV8(t, s.tapTicks[n] ?? elapsed);
      ctx.globalAlpha = 0.5; splash(ctx, PAINT[t.color], p.x, p.y - 6, 22, idx + n * 7 + s.trial * 13); ctx.globalAlpha = 1;
    });
    ctx.save();
    ctx.beginPath(); ctx.roundRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0, 16); ctx.clip();
    trial.targets.forEach((t, i) => {
      const hitAt = s.hits.indexOf(i);
      const p = galleryTargetPosV8(t, hitAt >= 0 ? s.tapTicks[hitAt] ?? elapsed : s.phase === "waiting" ? 0 : elapsed);
      // Plates are down on red; they flip up with a small overshoot on green; a hit plate tips back.
      const raw = s.phase === "waiting" ? 0 : Math.min(1, Math.max(0, (elapsed + 1 - (i % 4) * 1.5) / 8));
      const appear = raw < 1 ? raw * (1.15 - 0.15 * raw) : 1;
      const knock = hitAt < 0 ? 0 : hitAt === s.hits.length - 1 ? Math.min(1, Math.max(0, since / 10)) : 1;
      const dim = s.phase === "feedback" && !trial.answers.includes(i);
      drawStand(ctx, p.x, p.y, PAINT[t.color], t.shape, Math.max(0.1, appear * (1 - 0.85 * knock)), dim ? 0.4 : 1);
      if (hitAt >= 0) {
        const ms = msOf(s.tapTicks[hitAt] ?? 0);
        const rating = ms <= 380 ? [tx("gallery.bolt"), "#ffe14a"] : ms <= 560 ? [tx("gallery.fast"), "#7cffb0"] : null;
        ctx.font = "900 13px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineWidth = 3; ctx.strokeStyle = "rgba(0,0,0,.7)"; ctx.fillStyle = "#f9ecd2";
        ctx.strokeText(`${ms} ms`, p.x, p.y - 46); ctx.fillText(`${ms} ms`, p.x, p.y - 46);
        if (rating) { ctx.font = "900 11px system-ui"; ctx.fillStyle = rating[1]; ctx.strokeText(rating[0], p.x, p.y - 60); ctx.fillText(rating[0], p.x, p.y - 60); }
      }
    });
    ctx.restore();
    if (s.phase === "waiting") drawSignal(ctx, 195, (b.y0 + b.y1) / 2, false, s.tick, 2.2);
    // Impact: star flash, shock ring and sparks on the plate that was hit.
    const lastIdx = s.hits.length ? s.hits[s.hits.length - 1] : -1;
    if (lastIdx >= 0 && s.lastAward >= 0 && since >= 0 && since < 36) {
      const p = galleryTargetPosV8(trial.targets[lastIdx], s.tapTicks[s.hits.length - 1] ?? elapsed), k = since / 36;
      if (since < 6) {
        ctx.fillStyle = `rgba(255,248,210,${1 - since / 6})`; ctx.shadowColor = "#ffd36a"; ctx.shadowBlur = 16;
        ctx.beginPath();
        for (let q = 0; q < 16; q++) { const a = (q / 16) * Math.PI * 2, r = q % 2 ? 6 : 16 - since; q ? ctx.lineTo(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r) : ctx.moveTo(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r); }
        ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
      }
      ctx.strokeStyle = `rgba(168,224,95,${1 - k})`; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(p.x, p.y, 10 + k * 46, 0, Math.PI * 2); ctx.stroke();
      for (let q = 0; q < 12; q++) {
        const ang = (q / 12) * Math.PI * 2 + 0.3, d = 12 + k * 48;
        ctx.fillStyle = q % 2 ? `rgba(255,236,170,${1 - k})` : `rgba(92,255,176,${1 - k})`;
        ctx.beginPath(); ctx.arc(p.x + Math.cos(ang) * d, p.y + Math.sin(ang) * d + k * k * 18, 2.2 * (1 - k) + 0.5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = "#ffe9a6"; ctx.font = "900 16px system-ui"; ctx.textAlign = "center"; ctx.strokeStyle = "rgba(0,0,0,.6)"; ctx.lineWidth = 3;
      ctx.strokeText(`+${s.lastAward}`, p.x + 30, p.y - 10 - since * 0.6); ctx.fillText(`+${s.lastAward}`, p.x + 30, p.y - 10 - since * 0.6);
    }
    if (s.lastAward < 0 && since >= 0 && since < 60) {
      ctx.strokeStyle = `rgba(255,80,100,${0.9 * (1 - since / 60)})`; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.roundRect(b.x0 + 3, b.y0 + 3, b.x1 - b.x0 - 6, b.y1 - b.y0 - 6, 14); ctx.stroke();
      ctx.fillStyle = `rgba(255,120,120,${1 - since / 60})`; ctx.font = "900 22px system-ui"; ctx.textAlign = "center";
      ctx.fillText(`${s.lastAward}`, 195, b.y0 + 30 - since * 0.3);
    }
    const last = s.results.at(-1);
    if (s.phase === "feedback" && last) {
      const age = s.tick - (s.lastTapTick >= s.readyTick ? s.lastTapTick : s.readyTick), streak = streakOf(s);
      const text: Record<string, string> = { CORRECT: streak >= 3 ? tx("gallery.streakBig", { n: streak }) : tx("gallery.hit"), PARTIAL: tx("gallery.partial"), WRONG: tx("gallery.wrong"), FALSE_START: tx("gallery.falseStart"), TIMEOUT: tx("gallery.timeout") };
      if (last.type === "FALSE_START" || last.type === "TIMEOUT") { ctx.fillStyle = "rgba(6,14,24,.7)"; ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); }
      const grow = Math.min(1, Math.max(0, age) / 8);
      ctx.fillStyle = RESULT_LAMP[last.type] ?? "#ffffff"; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 18;
      ctx.font = `900 ${18 + Math.round(10 * grow)}px system-ui`; ctx.textAlign = "center";
      ctx.fillText(text[last.type] ?? "", 195, (b.y0 + b.y1) / 2);
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }, []);
  const pick = useCallback((point: CorePoint, phase: "down" | "move" | "up", s: GalleryStateV8) => {
    if (phase !== "down" || s.phase === "feedback") return null;
    // Tapping before the green light is a false start wherever the finger lands.
    if (s.phase === "waiting") return "PICK_0";
    const elapsed = s.tick - s.readyTick;
    let best = -1, bestDistance = 36;
    s.trials[s.trial].targets.forEach((t, i) => {
      const p = galleryTargetPosV8(t, elapsed), d = Math.hypot(point.x - p.x, point.y - p.y);
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
