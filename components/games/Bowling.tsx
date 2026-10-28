"use client";
import { useCallback, useRef } from "react";
import type { GameRuntimeProps } from "@/lib/games";
import { drawSpaceBackdrop } from "@/lib/spaceBackdrop";
import { gameTone } from "@/lib/gameFeedback";
import {
  BOWLING_CORE_V2 as core,
  BOWLING_RULES_V2 as R,
  bowlingScore,
  type BowlingStateV2,
} from "@/lib/verified/bowlingCore.v2";
import { bowlingAction } from "@/lib/verified/bowlingProtocol.v1";
import CoreCanvasGame, { type CorePoint } from "./CoreCanvasGame";
import { t as tx, useI18n } from "@/lib/i18n";

/*
 * Presentation only. A perspective lane whose camera dollies after the ball, pins drawn as lit sprites, a score
 * sheet and the strike celebration (skippable: a tap sends SKIP, which the core records). The throw gesture is
 * turned into quantised AIM / ANGLE / SPIN / POWER actions here; only those reach the recorder and the replay.
 */
const MMU = 1000; // µm per mm
const F = 14000; // perspective focal distance (mm)
const KX = 0.3; // px per mm at the foul line
const LANE_MM = R.laneWidth / MMU;

type View = { H: number; nearY: number; horizonY: number; camZ: number; camX: number };
const motion = { tick: -1, camZ: 0, camX: 0, seed: "" };
type Gesture = { x: number; y: number; t: number; path: { x: number; y: number; t: number }[]; aimDrag: boolean };

function project(v: View, xmm: number, ymm: number) {
  const z = ymm - v.camZ;
  const s = F / (F + Math.max(-F * 0.6, z));
  // camX pans the lane so the rolling ball stays near the centre of the screen.
  return { x: 195 + (xmm - LANE_MM / 2 - v.camX * s) * KX * s, y: v.horizonY + (v.nearY - v.horizonY) * s, s };
}

function sheetMarks(frames: number[][]) {
  return frames.map((f, i) => {
    const out: string[] = [];
    f.forEach((n, k) => {
      const tenth = i === 9;
      const prevOpen = k > 0 && !(tenth && f[k - 1] === 10) && !(tenth && k === 2 && f[0] + f[1] === 10 && f[0] !== 10);
      if (n === 10 && (k === 0 || (tenth && !prevOpen) || (tenth && k === 2 && f[1] === 10))) out.push("X");
      else if (k > 0 && prevOpen && f[k - 1] + n === 10 && f[k - 1] !== 10) out.push("/");
      else out.push(n === 0 ? "–" : String(n));
    });
    return out;
  });
}

function drawSheet(ctx: CanvasRenderingContext2D, s: BowlingStateV2) {
  const marks = sheetMarks(s.frames), totals = bowlingScore(s.rolls).frames;
  const x0 = 8, y0 = 6, h = 46, w9 = 34, w10 = 68;
  ctx.fillStyle = "rgba(6,12,28,.92)";
  ctx.beginPath(); ctx.roundRect(x0 - 2, y0 - 2, 9 * w9 + w10 + 4, h + 4, 10); ctx.fill();
  for (let i = 0; i < 10; i++) {
    const x = x0 + i * w9, w = i === 9 ? w10 : w9, current = i === s.frame && s.status === "running";
    ctx.fillStyle = current ? "rgba(243,197,90,.16)" : "rgba(255,255,255,.04)";
    ctx.fillRect(x + 1, y0, w - 2, h);
    ctx.strokeStyle = current ? "#f3c55a" : "rgba(160,190,230,.25)"; ctx.lineWidth = 1;
    ctx.strokeRect(x + 1.5, y0 + 0.5, w - 3, h - 1);
    ctx.fillStyle = "rgba(160,190,230,.5)"; ctx.font = "700 8px system-ui"; ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText(String(i + 1), x + 4, y0 + 3);
    const cells = i === 9 ? 3 : 2, cw = 14;
    for (let k = 0; k < cells; k++) {
      const cx = x + w - (cells - k) * cw - 2;
      ctx.strokeStyle = "rgba(160,190,230,.22)"; ctx.strokeRect(cx + 0.5, y0 + 2.5, cw - 1, 14);
      const m = marks[i]?.[k];
      if (m) {
        ctx.fillStyle = m === "X" ? "#ff3d9a" : m === "/" ? "#7fe3ee" : "#eef4ff";
        ctx.font = "900 11px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(m, cx + cw / 2, y0 + 10);
      }
    }
    const total = totals[i];
    if (total !== null && total !== undefined) {
      ctx.fillStyle = "#f9ecd2"; ctx.font = "900 13px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(String(total), x + w / 2, y0 + 32);
    }
  }
}

function drawLane(ctx: CanvasRenderingContext2D, v: View, tick: number) {
  const pit = R.pitY / MMU, near = Math.max(0, v.camZ - 400);
  const quad = (x0: number, x1: number, y0: number, y1: number, fill: string | CanvasGradient) => {
    const a = project(v, x0, y0), b = project(v, x1, y0), c = project(v, x1, y1), d = project(v, x0, y1);
    ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath(); ctx.fill();
  };
  // Back wall of the pit with a neon band.
  const back = project(v, 0, pit + 400);
  ctx.fillStyle = "#070b18";
  ctx.fillRect(0, back.y - 120 * back.s, 390, 120 * back.s + 4);
  ctx.fillStyle = "#ff3d9a"; ctx.shadowColor = "#ff3d9a"; ctx.shadowBlur = 14;
  ctx.fillRect(0, back.y - 6, 390, 3);
  ctx.shadowBlur = 0;
  // Approach floor beyond the gutters.
  quad(-900, LANE_MM + 900, near, pit + 400, "#0b1226");
  // Gutters.
  quad(-235, 0, near, pit, "#151c2e");
  quad(LANE_MM, LANE_MM + 235, near, pit, "#151c2e");
  // Lane wood.
  const top = project(v, 0, pit), bottom = project(v, 0, near);
  const wood = ctx.createLinearGradient(0, top.y, 0, bottom.y);
  wood.addColorStop(0, "#8a5a30"); wood.addColorStop(0.5, "#c08a52"); wood.addColorStop(1, "#e2b47a");
  quad(0, LANE_MM, near, pit, wood);
  // Boards.
  ctx.strokeStyle = "rgba(90,52,24,.28)"; ctx.lineWidth = 1;
  for (let b = 1; b < 39; b++) {
    const x = (b * LANE_MM) / 39, a = project(v, x, near), c = project(v, x, pit);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y); ctx.stroke();
  }
  // Pin deck (lighter) and its glow.
  quad(0, LANE_MM, R.headPinY / MMU - 300, pit, "rgba(255,240,210,.18)");
  // Oil sheen on the front part.
  quad(0, LANE_MM, near, R.oilEndY / MMU, "rgba(255,255,255,.06)");
  // Targeting arrows and dots.
  for (let k = 0; k < 7; k++) {
    // Targeting arrows at the same fraction of the (longer) lane as on a regulation lane.
    const x = LANE_MM / 2 + (k - 3) * 135, y = 6900 + Math.abs(k - 3) * 450;
    const tip = project(v, x, y), l = project(v, x - 25, y - 560), r = project(v, x + 25, y - 560);
    ctx.fillStyle = "rgba(60,30,10,.75)"; ctx.beginPath(); ctx.moveTo(tip.x, tip.y); ctx.lineTo(l.x, l.y); ctx.lineTo(r.x, r.y); ctx.closePath(); ctx.fill();
  }
  // Neon edge lights chasing toward the pins.
  for (const x of [-235, LANE_MM + 235]) {
    for (let k = 0; k < 26; k++) {
      const y = near + ((k * 1200 + tick * 30) % Math.round(pit + 600));
      if (y > pit) continue;
      const p = project(v, x, y), on = k % 3 === Math.floor(tick / 12) % 3;
      ctx.fillStyle = on ? "#7fe3ee" : "rgba(127,227,238,.25)";
      ctx.beginPath(); ctx.arc(p.x, p.y, 2.6 * p.s, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Foul line.
  if (near < 50) { const a = project(v, 0, 0), b = project(v, LANE_MM, 0); ctx.fillStyle = "#ff3b5c"; ctx.fillRect(a.x, a.y - 2, b.x - a.x, 3); }
}

type PinFace = "plain" | "happy" | "dizzy" | "wow";
const hash01 = (n: number) => { const q = Math.sin(n * 12.9898) * 43758.5453; return q - Math.floor(q); };

/**
 * A pin. On the lane it is a plain, still pin (it only moves when the physics knocks it). Faces are used only in
 * the strike / spare celebrations: happy (^ ^ and a smile), dizzy (× ×) or wow (round eyes, open mouth).
 */
function drawPin(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, tilt: number, lift: number, face: PinFace = "plain", shadow = true) {
  const h = 380 * KX * s, w = 121 * KX * s;
  ctx.save();
  if (shadow) { ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.beginPath(); ctx.ellipse(x, y, w * 0.7, w * 0.25, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.translate(x, y - lift);
  ctx.rotate(tilt);
  const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  g.addColorStop(0, "#aeb8c6"); g.addColorStop(0.42, "#ffffff"); g.addColorStop(1, "#8f9aab");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, -h);
  ctx.bezierCurveTo(w * 0.34, -h, w * 0.36, -h * 0.82, w * 0.24, -h * 0.68);
  ctx.bezierCurveTo(w * 0.18, -h * 0.6, w * 0.56, -h * 0.4, w * 0.5, -h * 0.14);
  ctx.bezierCurveTo(w * 0.46, 0, -w * 0.46, 0, -w * 0.5, -h * 0.14);
  ctx.bezierCurveTo(-w * 0.56, -h * 0.4, -w * 0.18, -h * 0.6, -w * 0.24, -h * 0.68);
  ctx.bezierCurveTo(-w * 0.36, -h * 0.82, -w * 0.34, -h, 0, -h);
  ctx.fill();
  ctx.fillStyle = "#e12d3f";
  ctx.fillRect(-w * 0.25, -h * 0.72, w * 0.5, Math.max(1, h * 0.035));
  ctx.fillRect(-w * 0.23, -h * 0.665, w * 0.46, Math.max(1, h * 0.035));
  if (face !== "plain") {
    const ey = -h * 0.875, ex = w * 0.11, er = Math.max(1.1, w * 0.09);
    ctx.strokeStyle = "#1b1f2e"; ctx.fillStyle = "#1b1f2e"; ctx.lineWidth = Math.max(0.8, w * 0.04); ctx.lineCap = "round";
    for (const side of [-1, 1]) {
      const cx = side * ex;
      if (face === "happy") { ctx.beginPath(); ctx.arc(cx, ey + er * 0.4, er, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
      else if (face === "dizzy") { ctx.beginPath(); ctx.moveTo(cx - er, ey - er); ctx.lineTo(cx + er, ey + er); ctx.moveTo(cx + er, ey - er); ctx.lineTo(cx - er, ey + er); ctx.stroke(); }
      else { ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.ellipse(cx, ey, er * 1.15, er * 1.35, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#1b1f2e"; ctx.beginPath(); ctx.arc(cx, ey + er * 0.2, er * 0.45, 0, Math.PI * 2); ctx.fill(); }
    }
    if (face === "happy") { ctx.beginPath(); ctx.arc(0, ey + h * 0.035, w * 0.11, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); ctx.fillStyle = "rgba(255,110,150,.5)"; for (const side of [-1, 1]) { ctx.beginPath(); ctx.arc(side * w * 0.22, ey + h * 0.045, w * 0.055, 0, Math.PI * 2); ctx.fill(); } }
    else if (face === "dizzy") { ctx.beginPath(); ctx.moveTo(-w * 0.08, ey + h * 0.07); ctx.quadraticCurveTo(0, ey + h * 0.05, w * 0.08, ey + h * 0.075); ctx.stroke(); }
    else { ctx.fillStyle = "#1b1f2e"; ctx.beginPath(); ctx.ellipse(0, ey + h * 0.075, w * 0.07, h * 0.032, 0, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.restore();
}

function drawBall(ctx: CanvasRenderingContext2D, v: View, s: BowlingStateV2) {
  const b = s.ball;
  if (b.y / MMU < v.camZ - 300) return;
  const p = project(v, b.x / MMU, b.y / MMU), r = (R.ballRadius / MMU) * KX * p.s;
  ctx.fillStyle = "rgba(0,0,0,.4)";
  ctx.beginPath(); ctx.ellipse(p.x, p.y, r * 1.05, r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
  const cy = p.y - r;
  const g = ctx.createRadialGradient(p.x - r * 0.35, cy - r * 0.4, r * 0.1, p.x, cy, r);
  g.addColorStop(0, "#e4d8ff"); g.addColorStop(0.3, "#7a4dff"); g.addColorStop(1, "#1a0d55");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, cy, r, 0, Math.PI * 2); ctx.fill();
  // Galaxy swirl and finger holes rolling with the distance travelled.
  const roll = b.y / MMU / (R.ballRadius / MMU);
  ctx.save(); ctx.beginPath(); ctx.arc(p.x, cy, r, 0, Math.PI * 2); ctx.clip();
  ctx.strokeStyle = "rgba(255,120,220,.35)"; ctx.lineWidth = Math.max(1, r * 0.12);
  ctx.beginPath(); ctx.ellipse(p.x, cy, r * 0.9, r * 0.35, roll * 0.3, 0, Math.PI * 2); ctx.stroke();
  const holeY = cy + Math.cos(roll) * r * 0.45, vis = Math.sin(roll) < 0.6;
  if (vis) { ctx.fillStyle = "#0b0626"; for (const [dx, dy] of [[-0.22, -0.12], [0.2, -0.16], [0, 0.18]]) { ctx.beginPath(); ctx.arc(p.x + dx * r, holeY + dy * r, r * 0.1, 0, Math.PI * 2); ctx.fill(); } }
  ctx.restore();
  ctx.fillStyle = "rgba(255,255,255,.5)";
  ctx.beginPath(); ctx.ellipse(p.x - r * 0.35, cy - r * 0.42, r * 0.28, r * 0.15, -0.5, 0, Math.PI * 2); ctx.fill();
}

function drawPinsAndBall(ctx: CanvasRenderingContext2D, v: View, s: BowlingStateV2) {
  type Item = { y: number; draw: () => void };
  const items: Item[] = [];
  s.pins.forEach((pin) => {
    if (!pin.present) return;
    const p = project(v, pin.x / MMU, pin.y / MMU);
    let tilt = 0, lift = 0;
    // Standing pins stay perfectly still; a knocked pin tips over (presentation of the physics only).
    if (!pin.standing) {
      const age = Math.max(0, s.tick - pin.hitTick), dir = pin.vx === 0 ? (pin.x > R.laneWidth / 2 ? 1 : -1) : Math.sign(pin.vx);
      tilt = dir * Math.min(Math.PI / 2, age * 0.09);
      lift = Math.max(0, Math.sin(Math.min(Math.PI, age * 0.08)) * 26 * p.s);
    }
    items.push({ y: pin.y, draw: () => drawPin(ctx, p.x, p.y, p.s, tilt, lift) });
  });
  items.push({ y: s.ball.y, draw: () => drawBall(ctx, v, s) });
  items.sort((a, b) => b.y - a.y).forEach((it) => it.draw());
}

function drawAimGuide(ctx: CanvasRenderingContext2D, v: View, s: BowlingStateV2) {
  const x0 = (R.aimX0 + s.aim * R.aimStep) / MMU, slope = ((s.angle - 12) * R.angleStep) / 1_000_000;
  ctx.save();
  for (let k = 1; k < 12; k++) {
    const y = k * 900, p = project(v, x0 + slope * y, y);
    ctx.fillStyle = `rgba(127,227,238,${0.7 - k * 0.05})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, 3 * p.s + 1, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

/*
 * Strike / spare broadcast (v119). Two acts, like a TV bowling show:
 *  1. Instant replay: the real throw (captured frame by frame while it rolled) replayed in slow motion from a low,
 *     close camera on the pin deck, letterboxed, with the broadcast bug, impact flashes and sparks.
 *  2. Title: extruded metallic lettering that slams in with a chromatic split and motion ghosts, a lens-flare sweep,
 *     shockwave rings, light beams, a deterministic spark shower and a lower-third with frame, streak and total.
 * The look (gold / neon / cosmic) is picked per strike or spare from a hash of the seed, frame and roll count, so it
 * looks random but is identical on replay. Everything is a function of the state, the time since the celebration
 * started and the captured replay; the core decides how long it lasts and records the SKIP.
 */
type ReplayFrame = { tick: number; ball: BowlingStateV2["ball"]; pins: BowlingStateV2["pins"] };
const capture: { seed: string; rollStart: number; frames: ReplayFrame[] } = { seed: "", rollStart: -1, frames: [] };
/** Record the rolling ball and pins once per simulated tick (presentation memory only, never sent anywhere). */
function captureRoll(s: BowlingStateV2) {
  if (s.phase !== "rolling") return;
  if (capture.seed !== s.seed || capture.rollStart !== s.rollStartTick) { capture.seed = s.seed; capture.rollStart = s.rollStartTick; capture.frames = []; }
  const last = capture.frames[capture.frames.length - 1];
  if (last && last.tick >= s.tick) return;
  capture.frames.push({ tick: s.tick, ball: { ...s.ball }, pins: s.pins.map((p) => ({ ...p })) });
  if (capture.frames.length > 1400) capture.frames.shift();
}
function capturedFrame(tick: number) {
  const f = capture.frames;
  if (!f.length) return null;
  let lo = 0, hi = f.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (f[mid].tick <= tick) lo = mid; else hi = mid - 1; }
  return f[lo];
}

const STRIKE_THEMES = ["gold", "neon", "cosmic"] as const;
const SPARE_THEMES = ["steel", "neon", "gold"] as const;
type Theme = (typeof STRIKE_THEMES)[number] | (typeof SPARE_THEMES)[number];
function seedHash(seed: string) {
  let h = 7;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 1000003;
  return h;
}
function bowlingShow(s: Pick<BowlingStateV2, "seed" | "rolls" | "lastResult">): Theme {
  const strike = s.lastResult?.kind === "strike";
  const list = strike ? STRIKE_THEMES : SPARE_THEMES;
  const pick = Math.floor(hash01(seedHash(s.seed) * 0.001 + (s.lastResult?.frame ?? 0) * 7.13 + s.rolls.length * 3.7) * list.length);
  return list[Math.min(list.length - 1, pick)];
}
const PALETTE: Record<Theme, { face: string[]; edge: string; glow: string; spark: string[]; beam: string; bg: string }> = {
  gold: { face: ["#fffbe0", "#ffe27a", "#f5b52e", "#b86a00", "#ffd76a"], edge: "#5a2c00", glow: "#ffcf4a", spark: ["#fff3c4", "#ffd23f", "#ff9a3d"], beam: "255,205,90", bg: "rgba(26,10,40,.78)" },
  neon: { face: ["#ffffff", "#bff6ff", "#7fe3ee", "#ff6fd8", "#ffd6f5"], edge: "#2a0a4a", glow: "#ff6fd8", spark: ["#7fe3ee", "#ff6fd8", "#ffffff"], beam: "255,111,216", bg: "rgba(6,4,24,.8)" },
  cosmic: { face: ["#ffffff", "#e6ecff", "#a9b8ff", "#6a4dff", "#d9c8ff"], edge: "#120a3a", glow: "#9f8bff", spark: ["#ffffff", "#b9a8ff", "#7fe3ee"], beam: "160,140,255", bg: "rgba(4,4,22,.82)" },
  steel: { face: ["#ffffff", "#e8eef6", "#aab8c8", "#5a6a7e", "#dfe8f2"], edge: "#1a2230", glow: "#9fe8ff", spark: ["#ffffff", "#9fe8ff", "#dfe8f2"], beam: "160,230,255", bg: "rgba(6,12,26,.76)" },
};

/** Extruded metallic title with entrance slam, chromatic split, motion ghosts and a specular sweep. */
function proTitle(ctx: CanvasRenderingContext2D, label: string, t: number, cy: number, size: number, theme: Theme) {
  const pal = PALETTE[theme];
  const enter = Math.min(1, Math.max(0, t / 16));
  const ease = 1 - Math.pow(1 - enter, 3);
  const settle = t > 16 ? 1 + 0.06 * Math.exp(-(t - 16) / 6) * Math.cos((t - 16) * 0.9) : 1;
  const scale = (2.4 - 1.4 * ease) * settle;
  ctx.save();
  ctx.font = `900 ${size}px system-ui, sans-serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const w = ctx.measureText(label).width;
  const fit = Math.min(1, 340 / Math.max(1, w));
  ctx.translate(195, cy);
  // Motion ghosts while slamming in.
  if (t < 16) {
    for (let g = 3; g > 0; g--) {
      const sc = (scale + g * 0.18) * fit;
      ctx.save(); ctx.scale(sc, sc); ctx.globalAlpha = 0.12 * g * (1 - enter);
      ctx.fillStyle = pal.glow; ctx.fillText(label, 0, 0); ctx.restore();
    }
  }
  ctx.scale(scale * fit, scale * fit);
  ctx.globalAlpha = Math.min(1, t / 6);
  // Extrusion (depth) with a darkening gradient.
  for (let k = 9; k > 0; k--) {
    ctx.fillStyle = k > 6 ? "rgba(0,0,0,.55)" : pal.edge;
    ctx.fillText(label, k * 0.35, k * 0.9);
  }
  // Chromatic split right after the slam.
  const split = t < 30 ? (1 - t / 30) * 6 : 0;
  if (split > 0.3) {
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = "rgba(255,40,80,.55)"; ctx.fillText(label, -split, 0);
    ctx.fillStyle = "rgba(40,220,255,.55)"; ctx.fillText(label, split, 0);
    ctx.globalCompositeOperation = "source-over";
  }
  // Metallic face: banded gradient like polished metal.
  const face = ctx.createLinearGradient(0, -size / 2, 0, size / 2);
  face.addColorStop(0, pal.face[0]); face.addColorStop(0.42, pal.face[1]); face.addColorStop(0.5, pal.face[2]);
  face.addColorStop(0.78, pal.face[3]); face.addColorStop(1, pal.face[4]);
  ctx.shadowColor = pal.glow; ctx.shadowBlur = 22;
  ctx.fillStyle = face; ctx.fillText(label, 0, 0);
  ctx.shadowBlur = 0;
  // Bevel: thin light stroke on top, darker below.
  ctx.lineWidth = 1.6; ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.strokeText(label, 0, -0.6);
  ctx.lineWidth = 1; ctx.strokeStyle = "rgba(0,0,0,.35)"; ctx.strokeText(label, 0, 1.2);
  if (theme === "neon") {
    const flicker = t % 47 < 2 ? 0.4 : 1;
    ctx.globalAlpha = flicker; ctx.lineWidth = 3; ctx.strokeStyle = "#7fe3ee"; ctx.shadowColor = "#7fe3ee"; ctx.shadowBlur = 16; ctx.strokeText(label, 0, 0); ctx.shadowBlur = 0; ctx.globalAlpha = 1;
  }
  // Specular sweep through the letters only.
  const half = w / 2 + 40, band = ((t * 7) % 520) - 260;
  const pos = (x: number) => Math.max(0, Math.min(1, (x + half) / (2 * half)));
  const sh = ctx.createLinearGradient(-half, -size / 2, half, size / 2);
  sh.addColorStop(0, "rgba(255,255,255,0)"); sh.addColorStop(pos(band - 30), "rgba(255,255,255,0)");
  sh.addColorStop(pos(band), "rgba(255,255,255,.85)"); sh.addColorStop(pos(band + 30), "rgba(255,255,255,0)"); sh.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sh; ctx.fillText(label, 0, 0);
  ctx.restore();
}
function lensFlare(ctx: CanvasRenderingContext2D, t: number, cy: number, color: string) {
  const k = Math.min(1, t / 40), x = -60 + 510 * k, a = Math.sin(Math.min(Math.PI, k * Math.PI));
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  const g = ctx.createLinearGradient(0, cy, 390, cy);
  g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(Math.max(0, Math.min(1, x / 390)), `rgba(255,255,255,${0.95 * a})`); g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g; ctx.fillRect(0, cy - 3, 390, 6);
  const core = ctx.createRadialGradient(x, cy, 0, x, cy, 64);
  core.addColorStop(0, `rgba(255,255,255,${0.9 * a})`); core.addColorStop(0.3, `rgba(${color},${0.4 * a})`); core.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = core; ctx.beginPath(); ctx.arc(x, cy, 64, 0, Math.PI * 2); ctx.fill();
  // Ghost discs on the line through the centre of the screen, opposite the flare.
  for (const [f, r] of [[0.4, 10], [0.7, 6], [1.3, 14], [1.6, 5]] as const) {
    const gx = 195 + (195 - x) * f, gy = cy + (f - 1) * 18;
    ctx.fillStyle = `rgba(${color},${0.22 * a})`; ctx.beginPath(); ctx.arc(gx, gy, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
function shockwaves(ctx: CanvasRenderingContext2D, t: number, x: number, y: number, color: string) {
  for (let i = 0; i < 3; i++) {
    const u = t - i * 7;
    if (u < 0 || u > 46) continue;
    const r = 20 + u * 7.5, a = 1 - u / 46;
    ctx.strokeStyle = `rgba(${color},${0.7 * a})`; ctx.lineWidth = 6 * a + 1;
    ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.42, 0, 0, Math.PI * 2); ctx.stroke();
  }
}
function beams(ctx: CanvasRenderingContext2D, t: number, H: number, color: string, alpha: number) {
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 6; i++) {
    const base = 30 + i * 66, ang = -Math.PI / 2 + Math.sin(t * 0.02 + i * 1.3) * 0.35;
    const len = H * 1.1, wdt = 0.07;
    const g = ctx.createLinearGradient(base, H, base + Math.cos(ang) * len, H + Math.sin(ang) * len);
    g.addColorStop(0, `rgba(${color},${0.3 * alpha})`); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(base, H + 10);
    ctx.lineTo(base + Math.cos(ang - wdt) * len, H + Math.sin(ang - wdt) * len); ctx.lineTo(base + Math.cos(ang + wdt) * len, H + Math.sin(ang + wdt) * len);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
/** Deterministic spark shower: ballistic streaks from the title centre (no RNG, hash per particle). */
function sparks(ctx: CanvasRenderingContext2D, t: number, x0: number, y0: number, n: number, colors: string[], seed: number, H: number) {
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.lineCap = "round";
  for (let i = 0; i < n; i++) {
    const h = (k: number) => hash01((i + 1) * 12.9898 + seed * 78.233 + k * 37.719);
    const a = h(1) * Math.PI * 2, sp = 2.5 + h(2) * 6.5, delay = h(3) * 10, u = t - delay;
    if (u <= 0) continue;
    const vx = Math.cos(a) * sp, vy = Math.sin(a) * sp * 0.75 - 2.5, g = 0.09;
    const x = x0 + vx * u, y = y0 + vy * u + 0.5 * g * u * u;
    if (y > H + 20 || u > 120) continue;
    const life = 1 - u / 120;
    ctx.strokeStyle = colors[i % colors.length]; ctx.globalAlpha = Math.max(0, life);
    ctx.lineWidth = 1.2 + h(4) * 2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - vx * 2.2, y - (vy + g * u) * 2.2); ctx.stroke();
  }
  ctx.restore();
}
function lowerThird(ctx: CanvasRenderingContext2D, s: BowlingStateV2, t: number, H: number, theme: Theme, label: string) {
  const k = Math.min(1, Math.max(0, t / 18)), ease = 1 - Math.pow(1 - k, 3), pal = PALETTE[theme];
  const y = H - 150, w = 326, x = -w + (w + 32) * ease;
  ctx.save();
  ctx.globalAlpha = k;
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, "rgba(8,12,30,.96)"); g.addColorStop(1, "rgba(18,24,52,.9)");
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x, y, w, 58, 10); ctx.fill();
  ctx.fillStyle = pal.glow; ctx.fillRect(x, y, 6, 58);
  ctx.fillStyle = "rgba(255,255,255,.08)"; ctx.fillRect(x + 6, y + 28, w - 6, 1);
  const frame = (s.lastResult?.frame ?? 0) + 1;
  ctx.textBaseline = "middle"; ctx.textAlign = "left";
  ctx.fillStyle = pal.face[1]; ctx.font = "900 15px system-ui"; ctx.fillText(label, x + 18, y + 15);
  ctx.fillStyle = "#c7d4ea"; ctx.font = "700 12px system-ui"; ctx.fillText(tx("bowling.frameN", { n: frame }), x + 18, y + 43);
  if (s.lastResult?.kind === "strike" && s.streak >= 2) {
    ctx.fillStyle = "#7fe3ee"; ctx.fillText(s.streak >= 3 ? tx("bowling.turkey", { n: s.streak }) : tx("bowling.double"), x + 108, y + 43);
  }
  // Right: the running total once a frame is scored, otherwise the scoresheet mark (X / slash), like on TV.
  const total = bowlingScore(s.rolls).total;
  ctx.textAlign = "right";
  if (total > 0) {
    ctx.fillStyle = "#ffffff"; ctx.font = "900 26px system-ui"; ctx.fillText(String(total), x + w - 16, y + 32);
    ctx.font = "700 10px system-ui"; ctx.fillStyle = "#93a6c4"; ctx.fillText(tx("bowling.total"), x + w - 16, y + 11);
  } else {
    const strikeMark = s.lastResult?.kind === "strike";
    ctx.fillStyle = pal.glow; ctx.beginPath(); ctx.roundRect(x + w - 54, y + 11, 38, 36, 8); ctx.fill();
    ctx.fillStyle = "#0b1022"; ctx.font = "900 24px system-ui"; ctx.textAlign = "center";
    ctx.fillText(strikeMark ? "X" : "/", x + w - 35, y + 30);
  }
  ctx.restore();
}

/** Act 1: the captured throw in slow motion, close and low on the pin deck. Returns false when nothing was captured. */
function drawReplay(ctx: CanvasRenderingContext2D, s: BowlingStateV2, H: number, t: number, len: number, strike: boolean) {
  if (capture.seed !== s.seed || !capture.frames.length) return false;
  const frames = capture.frames;
  const firstHit = Math.min(...frames[frames.length - 1].pins.filter((p) => !p.standing && p.hitTick >= 0).map((p) => p.hitTick), Infinity);
  if (!Number.isFinite(firstHit)) return false;
  const from = Math.max(frames[0].tick, firstHit - (strike ? 42 : 34)), to = Math.min(frames[frames.length - 1].tick, firstHit + (strike ? 120 : 90));
  const rt = from + (to - from) * Math.min(1, t / len);
  const f = capturedFrame(Math.floor(rt));
  if (!f) return false;
  // Low, close camera centred on the deck; slow dolly in.
  const dolly = Math.min(1, t / len);
  const camZ = R.headPinY / MMU - 4400 + 1100 * dolly;
  const sDeck = F / (F + (R.headPinY / MMU + 450 - camZ)), nearY = H + 160, deckY = H * 0.6;
  const horizonY = (deckY - sDeck * nearY) / (1 - sDeck);
  const v: View = { H, nearY, horizonY, camZ, camX: 0 };
  ctx.save();
  // Own opaque backdrop: the live scene must not show through above the replay's horizon.
  drawSpaceBackdrop(ctx, 390, H, 0, Math.floor(rt));
  ctx.fillStyle = "rgba(4,6,16,.45)"; ctx.fillRect(0, 0, 390, H);
  drawLane(ctx, v, Math.floor(rt));
  drawPinsAndBall(ctx, v, { ...s, tick: Math.floor(rt), ball: f.ball, pins: f.pins } as BowlingStateV2);
  // Impact flashes and sparks where pins are being hit right now.
  for (const p of f.pins) {
    const age = rt - p.hitTick;
    if (p.hitTick < 0 || age < 0 || age > 14) continue;
    const q = project(v, p.x / MMU, p.y / MMU), a = 1 - age / 14;
    ctx.globalCompositeOperation = "lighter";
    const g = ctx.createRadialGradient(q.x, q.y - 30 * q.s, 0, q.x, q.y - 30 * q.s, 46 * q.s);
    g.addColorStop(0, `rgba(255,250,230,${0.85 * a})`); g.addColorStop(1, "rgba(255,200,120,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q.x, q.y - 30 * q.s, 46 * q.s, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2 + p.hitTick, d = (10 + age * 5) * q.s;
      ctx.strokeStyle = `rgba(255,220,150,${a})`; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(q.x + Math.cos(ang) * d, q.y - 30 * q.s + Math.sin(ang) * d * 0.6); ctx.lineTo(q.x + Math.cos(ang) * (d + 8), q.y - 30 * q.s + Math.sin(ang) * (d + 8) * 0.6); ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
  }
  // Broadcast look: letterbox, scanlines, vignette, REPLAY bug and slow-motion marker.
  const bar = 54 * Math.min(1, t / 8);
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, 390, bar); ctx.fillRect(0, H - bar, 390, bar);
  ctx.fillStyle = "rgba(255,255,255,.035)"; for (let y = bar; y < H - bar; y += 3) ctx.fillRect(0, y, 390, 1);
  const vig = ctx.createRadialGradient(195, H / 2, H * 0.25, 195, H / 2, H * 0.75);
  vig.addColorStop(0, "rgba(0,0,0,0)"); vig.addColorStop(1, "rgba(0,0,0,.55)");
  ctx.fillStyle = vig; ctx.fillRect(0, 0, 390, H);
  const blink = Math.floor(t / 20) % 2 === 0;
  ctx.fillStyle = "rgba(10,14,30,.85)"; ctx.beginPath(); ctx.roundRect(14, bar + 12, 150, 30, 6); ctx.fill();
  ctx.fillStyle = blink ? "#ff2d3c" : "rgba(255,45,60,.35)"; ctx.beginPath(); ctx.arc(30, bar + 27, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#ffffff"; ctx.font = "900 13px system-ui"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
  ctx.fillText(tx("bowling.replay"), 42, bar + 27);
  ctx.fillStyle = "rgba(255,255,255,.7)"; ctx.font = "800 11px ui-monospace, Menlo, monospace"; ctx.textAlign = "right";
  ctx.fillText(strike ? "×0.35" : "×0.45", 376, bar + 27);
  ctx.restore();
  return true;
}

function drawCelebration(ctx: CanvasRenderingContext2D, s: BowlingStateV2, H: number) {
  const kind = s.lastResult?.kind, t = s.tick - s.phaseTick;
  if (kind !== "strike" && kind !== "spare") return;
  const strike = kind === "strike", dur = strike ? R.strikeTicks : R.spareTicks;
  const theme = bowlingShow(s), pal = PALETTE[theme], label = strike ? tx("bowling.strike") : tx("bowling.spare");
  const replayLen = strike ? 250 : 140;
  const fadeOut = Math.max(0, Math.min(1, (dur - t) / 24));
  ctx.save();
  ctx.globalAlpha = fadeOut;
  // Act 1: instant replay (falls through to the title if nothing was captured).
  const replaying = t < replayLen && drawReplay(ctx, s, H, t, replayLen, strike);
  const t2 = replaying ? -1 : t - (capture.seed === s.seed && capture.frames.length ? replayLen : 0);
  if (t2 >= 0) {
    // Act 2: the title.
    const cy = H * 0.4;
    if (t2 < 10) { ctx.fillStyle = `rgba(255,255,255,${0.75 * (1 - t2 / 10)})`; ctx.fillRect(0, 0, 390, H); }
    ctx.fillStyle = pal.bg; ctx.fillRect(0, 0, 390, H);
    beams(ctx, t2, H, pal.beam, Math.min(1, t2 / 20));
    if (theme === "cosmic") {
      for (let i = 0; i < 60; i++) {
        const a = hash01(i * 3.1) * Math.PI * 2, r = ((hash01(i * 7.7) * 300 + t2 * (4 + hash01(i) * 6)) % 340);
        ctx.fillStyle = `rgba(255,255,255,${Math.min(1, r / 200)})`;
        ctx.fillRect(195 + Math.cos(a) * r, cy + Math.sin(a) * r, 2, 2);
      }
    }
    shockwaves(ctx, t2 - 12, 195, cy, pal.beam);
    sparks(ctx, t2 - 12, 195, cy, strike ? 130 : 70, pal.spark, (s.lastResult?.frame ?? 0) + s.rolls.length, H);
    proTitle(ctx, label, t2, cy, strike ? 80 : 62, theme);
    if (t2 > 8) lensFlare(ctx, t2 - 8, cy - 4, pal.beam);
    lowerThird(ctx, s, t2 - 24, H, theme, label);
  }
  // Skip pill.
  ctx.globalAlpha = Math.min(1, t / 20) * fadeOut;
  ctx.fillStyle = "rgba(6,12,28,.85)"; ctx.strokeStyle = "rgba(255,255,255,.5)"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(275, H - 64, 100, 38, 19); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#fff"; ctx.font = "800 14px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(tx("bowling.skip"), 325, H - 45);
  ctx.restore();
}

/** Chase-cam speed streaks around the ball (presentation). */
function drawSpeedLines(ctx: CanvasRenderingContext2D, v: View, s: BowlingStateV2, H: number) {
  const p = project(v, s.ball.x / MMU, s.ball.y / MMU), speed = Math.min(1, s.ball.vy / (R.powerMin + 8 * R.powerStep));
  if (p.y > H) return;
  ctx.save();
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + 0.2, d0 = 60 + ((s.tick * 9 + i * 37) % 120), d1 = d0 + 30 + 40 * speed;
    ctx.strokeStyle = `rgba(200,225,255,${0.08 + 0.18 * speed})`; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(p.x + Math.cos(a) * d0, p.y - 20 + Math.sin(a) * d0 * 0.6); ctx.lineTo(p.x + Math.cos(a) * d1, p.y - 20 + Math.sin(a) * d1 * 0.6); ctx.stroke();
  }
  ctx.restore();
}

/** Live swipe trail with a power bar so the throw reads before release (presentation). */
function drawSwipe(ctx: CanvasRenderingContext2D, g: Gesture | null) {
  if (!g || g.aimDrag || g.path.length < 2) return;
  const last = g.path[g.path.length - 1], up = g.y - last.y;
  if (up < 12) return;
  ctx.save();
  ctx.lineCap = "round";
  for (let i = 1; i < g.path.length; i++) {
    const a = g.path[i - 1], b = g.path[i];
    ctx.strokeStyle = `rgba(127,227,238,${0.15 + 0.7 * (i / g.path.length)})`; ctx.lineWidth = 2 + 8 * (i / g.path.length);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  const power = swipePower(g);
  ctx.fillStyle = "rgba(6,12,28,.8)"; ctx.beginPath(); ctx.roundRect(362, 250, 14, 200, 7); ctx.fill();
  const fill = ctx.createLinearGradient(0, 450, 0, 250);
  fill.addColorStop(0, "#5cffb0"); fill.addColorStop(0.6, "#ffd23f"); fill.addColorStop(1, "#ff3d9a");
  ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(364, 448 - (196 * (power + 1)) / 9, 10, (196 * (power + 1)) / 9, 5); ctx.fill();
  ctx.restore();
}

/** Throw speed measured over the last ~110 ms of the swipe (the flick), mapped onto POWER 0–8 on a gentler curve. */
function swipePower(g: Gesture) {
  const end = g.path[g.path.length - 1];
  let k = g.path.length - 1;
  while (k > 0 && end.t - g.path[k].t < 110) k--;
  const from = g.path[k], ms = Math.max(30, end.t - from.t), recent = (from.y - end.y) / ms;
  const overall = (g.y - end.y) / Math.max(60, end.t - g.t);
  const speed = Math.max(recent, overall);
  return Math.max(0, Math.min(8, Math.round((speed - 0.3) / 0.26)));
}

const hudLabel = (s: Readonly<BowlingStateV2>) => tx("bowling.hud", { frame: Math.min(10, s.frame + 1), roll: s.rollInFrame + 1 });

export default function Bowling(props: GameRuntimeProps) {
  useI18n();
  const gesture = useRef<Gesture | null>(null);
  const render = useCallback((ctx: CanvasRenderingContext2D, s: BowlingStateV2, view: { width: number; height: number }) => {
    const H = Math.max(620, view.height);
    if (s.seed !== motion.seed || s.tick < motion.tick) { motion.seed = s.seed; motion.camZ = 0; motion.camX = 0; }
    // Chase camera: tight behind the ball while it rolls (and panned onto its line), easing off near the pins so
    // the whole deck is in frame; glides back for the next throw.
    const rolling = s.phase === "rolling" && s.ball.active;
    const want = rolling ? Math.max(0, Math.min(R.headPinY / MMU - 4200, s.ball.y / MMU - 1500)) : s.phase === "rolling" ? motion.camZ : 0;
    const near = rolling ? Math.max(0, Math.min(1, (R.headPinY / MMU - 4200 - s.ball.y / MMU + 1500) / 3000)) : 0;
    const wantX = rolling ? (s.ball.x / MMU - LANE_MM / 2) * 0.7 * near : 0;
    const steps = Math.min(10, Math.max(0, s.tick - motion.tick));
    for (let i = 0; i < steps; i++) {
      motion.camZ += (want - motion.camZ) * (want > motion.camZ ? 0.32 : 0.06);
      motion.camX += (wantX - motion.camX) * 0.15;
    }
    motion.tick = s.tick;
    captureRoll(s);
    const nearY = H - 70, sPins = F / (F + R.headPinY / MMU), horizonY = (150 - sPins * nearY) / (1 - sPins);
    const v: View = { H, nearY, horizonY, camZ: motion.camZ, camX: motion.camX };
    drawSpaceBackdrop(ctx, 390, H, 0, s.tick);
    drawLane(ctx, v, s.tick);
    if (s.phase === "aim") drawAimGuide(ctx, v, s);
    drawPinsAndBall(ctx, v, s);
    if (rolling) drawSpeedLines(ctx, v, s, H);
    if (s.phase === "aim") drawSwipe(ctx, gesture.current);
    drawSheet(ctx, s);
    const last = s.lastResult, since = last ? s.tick - last.tick : 999;
    if (s.phase === "celebrate") drawCelebration(ctx, s, H);
    else if (last && since < 80 && (last.kind === "gutter" || last.kind === "open")) {
      ctx.globalAlpha = Math.max(0, 1 - since / 80);
      ctx.fillStyle = last.kind === "gutter" ? "#ff8a96" : "#f9ecd2";
      ctx.font = "900 26px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(last.kind === "gutter" ? tx("bowling.gutter") : String(last.knocked), 195, H * 0.4 - since * 0.3);
      ctx.globalAlpha = 1;
    }
  }, []);
  const pick = useCallback((point: CorePoint, phase: "down" | "move" | "up", s: BowlingStateV2) => {
    if (s.phase === "celebrate") return phase === "down" ? "SKIP" : null;
    if (s.phase !== "aim") return null;
    const now = typeof performance === "undefined" ? 0 : performance.now();
    if (phase === "down") { gesture.current = { x: point.x, y: point.y, t: now, path: [{ x: point.x, y: point.y, t: now }], aimDrag: false }; return null; }
    const g = gesture.current;
    if (!g) return null;
    g.path.push({ x: point.x, y: point.y, t: now });
    const dx = point.x - g.x, dy = point.y - g.y;
    if (phase === "move") {
      // A sideways drag before any upward swipe moves the ball across the approach.
      if (Math.abs(dy) < 26 && Math.abs(dx) > 6) {
        g.aimDrag = true;
        const lanePx = LANE_MM * KX, aim = Math.round(((point.x - (195 - lanePx / 2)) / lanePx * LANE_MM * MMU - R.aimX0) / R.aimStep);
        const next = Math.max(0, Math.min(20, aim));
        if (next !== s.aim) return bowlingAction("AIM", next);
      }
      return null;
    }
    gesture.current = null;
    if (dy > -30) return null;
    // Release: direction of the swipe → angle (gentler gain, small wobble ignored), flick speed → power,
    // bend of the path → spin.
    const tilt = dx / -dy, angle = Math.max(0, Math.min(24, Math.round(12 + (Math.abs(tilt) < 0.04 ? 0 : tilt) * 26)));
    const power = swipePower(g);
    const mid = g.path[Math.floor(g.path.length / 2)], chord = g.x + dx * ((mid.y - g.y) / (dy || -1));
    const bend = (chord - mid.x) / -dy, spin = Math.max(0, Math.min(8, Math.round(4 + (Math.abs(bend) < 0.03 ? 0 : bend) * 24)));
    gameTone("tap");
    return [bowlingAction("ANGLE", angle), bowlingAction("SPIN", spin), bowlingAction("POWER", power), "ROLL"];
  }, []);
  return (
    <div className="bowlingVerified">
      <CoreCanvasGame {...props} core={core} name="Bowling" instruction="" render={render} pointAction={pick}
        expandVerticalViewport hideHudScore hideHudLabel hudLabel={hudLabel} keys={{ Enter: "ROLL", " ": "SKIP" }} />
    </div>
  );
}
