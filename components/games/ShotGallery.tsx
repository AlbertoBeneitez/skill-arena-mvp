"use client";
import { useCallback } from "react";
import type { GameRuntimeProps } from "@/lib/games";
import { drawSpaceBackdrop } from "@/lib/spaceBackdrop";
import { gameTone } from "@/lib/gameFeedback";
import {
  SHOT_GALLERY_CORE_V3 as core,
  GALLERY_V3_COLORS,
  GALLERY_V3_SHAPES,
  type GalleryStateV3,
} from "@/lib/verified/shotGalleryCore.v3";
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

/** Paint splash: fixed irregular lobes plus droplets, so each colour reads as a blot of paint. */
function splash(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, size: number, seed: number) {
  ctx.fillStyle = color;
  ctx.beginPath();
  const lobes = 14;
  for (let i = 0; i <= lobes; i++) {
    const a = (i / lobes) * Math.PI * 2,
      r = size * (0.78 + 0.32 * Math.abs(Math.sin(a * 3 + seed)) + 0.12 * Math.cos(a * 5 + seed * 2));
    const px = x + Math.cos(a) * r,
      py = y + Math.sin(a) * r;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  for (let k = 0; k < 5; k++) {
    const a = seed * 1.7 + k * 1.26;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * size * 1.35, y + Math.sin(a) * size * 1.3, size * (0.09 + 0.04 * (k % 3)), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(255,255,255,.28)";
  ctx.beginPath();
  ctx.arc(x - size * 0.3, y - size * 0.32, size * 0.22, 0, Math.PI * 2);
  ctx.fill();
}

const hudLabel = (s: Readonly<GalleryStateV3>) => {
  const taps = s.results.flatMap((r) => r.taps);
  const avg = taps.length ? ` · MEDIA ${msOf(taps.reduce((a, b) => a + b, 0) / taps.length)} ms` : "";
  return `${s.correct} ACIERTOS · ${Math.min(12, s.trial + 1)}/12${avg}`;
};
const feedbackScore = (s: Readonly<GalleryStateV3>) => s.total;

/** Reaction times are kept on this device (last 30 runs): presentation/storage only. */
let savedSeed = "";
function persistReactions(s: GalleryStateV3) {
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
  const render = useCallback((ctx: CanvasRenderingContext2D, s: GalleryStateV3) => {
    persistReactions(s);
    const trial = s.trials[Math.min(s.trial, 11)],
      order = trial.order,
      colour = PAINT[order.color],
      ready = s.phase === "ready",
      f = { x0: 14, y0: 196, w: 362, h: 360 };
    drawSpaceBackdrop(ctx, 390, 620, 0, s.tick);
    // Order panel.
    ctx.fillStyle = "rgba(10,24,38,.9)";
    ctx.strokeStyle = "#496a7b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(14, 76, 362, 100, 14);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.fillStyle = "#9fb8c9";
    ctx.font = "bold 12px system-ui";
    const need = trial.answers.length;
    ctx.fillText(need > 1 ? `ORDEN · TOCA LOS ${need}` : "ORDEN · TOCA EL", 195, 98);
    if (order.kind === "COLOR") splash(ctx, colour, 195, 135, 24, order.color + 1);
    else if (order.kind === "SHAPE") {
      ctx.fillStyle = "#eaf2f8";
      figure(ctx, order.shape, 195, 135, 24);
    } else {
      splash(ctx, `${colour}55`, 195, 135, 30, order.color + 1);
      ctx.fillStyle = colour;
      figure(ctx, order.shape, 195, 135, 22);
    }
    ctx.fillStyle = "#c6dbe8";
    ctx.font = "bold 12px system-ui";
    ctx.fillText(
      order.kind === "COLOR"
        ? GALLERY_V3_COLORS[order.color]
        : order.kind === "SHAPE"
          ? GALLERY_V3_SHAPES[order.shape]
          : `${GALLERY_V3_SHAPES[order.shape]} ${GALLERY_V3_COLORS[order.color]}`,
      195,
      168,
    );
    // Red → green go signal.
    const pulse = 0.6 + 0.4 * Math.sin(s.tick * 0.12);
    ctx.save();
    ctx.shadowColor = ready ? "#5cffb0" : "#ff4d4d";
    ctx.shadowBlur = ready ? 18 : 10 * pulse;
    ctx.fillStyle = ready ? "#5cffb0" : "#ff4d4d";
    ctx.beginPath();
    ctx.arc(352, 98, ready ? 9 : 7 + pulse, 0, Math.PI * 2);
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
      ctx.fillStyle = PAINT[t.color];
      figure(ctx, t.shape, t.x, t.y, 22);
      ctx.strokeStyle = "rgba(0,0,0,.35)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
      if (hitAt >= 0) {
        ctx.fillStyle = "#f9ecd2";
        ctx.font = "bold 13px system-ui";
        ctx.fillText(`${msOf(s.tapTicks[hitAt] ?? s.results.at(-1)?.taps[hitAt] ?? 0)} ms`, t.x, t.y - 28);
      }
    });
    const since = s.tick - s.lastTapTick;
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
  const pick = useCallback((point: CorePoint, phase: "down" | "move" | "up", s: GalleryStateV3) => {
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
      <CoreCanvasGame {...props} core={core} name="Shot Gallery" instruction="" render={render} pointAction={pick} hideHudScore hudLabel={hudLabel} feedbackScore={feedbackScore} />
    </div>
  );
}
