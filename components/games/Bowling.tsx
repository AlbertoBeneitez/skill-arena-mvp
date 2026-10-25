"use client";
import { useCallback, useRef } from "react";
import type { GameRuntimeProps } from "@/lib/games";
import { drawSpaceBackdrop } from "@/lib/spaceBackdrop";
import { gameTone } from "@/lib/gameFeedback";
import {
  BOWLING_CORE_V1 as core,
  BOWLING_RULES_V1 as R,
  bowlingScore,
  type BowlingStateV1,
} from "@/lib/verified/bowlingCore.v1";
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

function drawSheet(ctx: CanvasRenderingContext2D, s: BowlingStateV1) {
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
    const x = LANE_MM / 2 + (k - 3) * 135, y = 4600 + Math.abs(k - 3) * 300;
    const tip = project(v, x, y), l = project(v, x - 25, y - 380), r = project(v, x + 25, y - 380);
    ctx.fillStyle = "rgba(60,30,10,.75)"; ctx.beginPath(); ctx.moveTo(tip.x, tip.y); ctx.lineTo(l.x, l.y); ctx.lineTo(r.x, r.y); ctx.closePath(); ctx.fill();
  }
  // Neon edge lights chasing toward the pins.
  for (const x of [-235, LANE_MM + 235]) {
    for (let k = 0; k < 24; k++) {
      const y = near + ((k * 800 + tick * 22) % 19000);
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

function drawBall(ctx: CanvasRenderingContext2D, v: View, s: BowlingStateV1) {
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

function drawPinsAndBall(ctx: CanvasRenderingContext2D, v: View, s: BowlingStateV1) {
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

function drawAimGuide(ctx: CanvasRenderingContext2D, v: View, s: BowlingStateV1) {
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
 * Strike / spare celebrations: several "broadcasts", one picked per strike/spare from a hash of the seed, the frame
 * and the roll count (looks random to the player, identical on replay). Pure functions of the state and the time
 * since the celebration started; the core decides how long it lasts and records the SKIP.
 */
const STRIKE_SHOWS = ["supernova", "disco", "fireworks", "comet"] as const;
const SPARE_SHOWS = ["burst", "highfive", "neon"] as const;
function seedHash(seed: string) {
  let h = 7;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 1000003;
  return h;
}
function bowlingShow(s: Pick<BowlingStateV1, "seed" | "rolls" | "lastResult">) {
  const strike = s.lastResult?.kind === "strike";
  const list = strike ? STRIKE_SHOWS : SPARE_SHOWS;
  const pick = Math.floor(hash01(seedHash(s.seed) * 0.001 + (s.lastResult?.frame ?? 0) * 7.13 + s.rolls.length * 3.7) * list.length);
  return list[Math.min(list.length - 1, pick)];
}
const CONFETTI = ["#ff3d9a", "#7fe3ee", "#ffd23f", "#b98cff", "#5cffb0", "#ffffff"];

function title(ctx: CanvasRenderingContext2D, label: string, t: number, cy: number, size: number, shake = 0) {
  const pop = t < 26 ? 1 + 0.45 * Math.sin((t / 26) * Math.PI) * (1 - t / 26) * 2 - (1 - Math.min(1, t / 10)) * 0.8 : 1 + 0.03 * Math.sin(t * 0.12);
  ctx.save();
  ctx.translate(195 + (shake && t < 24 ? Math.sin(t * 2.1) * (24 - t) * shake : 0), cy);
  ctx.scale(Math.max(0.01, pop), Math.max(0.01, pop));
  ctx.font = `900 ${size}px system-ui, sans-serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (let k = 8; k > 0; k--) { ctx.fillStyle = `rgba(${40 + k * 8},10,${70 + k * 10},1)`; ctx.fillText(label, k * 0.6, k * 1.1); }
  const g = ctx.createLinearGradient(0, -size / 2, 0, size / 2);
  g.addColorStop(0, "#fff6c2"); g.addColorStop(0.35, "#ffd23f"); g.addColorStop(0.7, "#ff7a3d"); g.addColorStop(1, "#ff3d9a");
  ctx.fillStyle = g; ctx.fillText(label, 0, 0);
  ctx.lineWidth = 2.5; ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.strokeText(label, 0, 0);
  // Shine sweeping through the letters only (a moving white band in the text fill, never over the scene).
  const band = ((t * 6) % 600) - 300, wHalf = Math.max(1, ctx.measureText(label).width / 2 + 40);
  const pos = (x: number) => Math.max(0, Math.min(1, (x + wHalf) / (2 * wHalf)));
  const sh = ctx.createLinearGradient(-wHalf, 0, wHalf, 0);
  sh.addColorStop(0, "rgba(255,255,255,0)");
  sh.addColorStop(pos(band - 40), "rgba(255,255,255,0)");
  sh.addColorStop(pos(band), "rgba(255,255,255,.8)");
  sh.addColorStop(pos(band + 40), "rgba(255,255,255,0)");
  sh.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sh; ctx.fillText(label, 0, 0);
  ctx.restore();
}
function rays(ctx: CanvasRenderingContext2D, t: number, cy: number, n: number) {
  ctx.save(); ctx.translate(195, cy); ctx.rotate(t * 0.012);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, w = (Math.PI / n) * 0.55;
    const g = ctx.createRadialGradient(0, 0, 10, 0, 0, 420);
    g.addColorStop(0, i % 2 ? "rgba(255,61,154,.55)" : "rgba(122,92,255,.55)"); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 420, a - w, a + w); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
function burst(ctx: CanvasRenderingContext2D, x0: number, y0: number, t: number, n: number, speed: number, seed: number, H: number, fade: number) {
  for (let i = 0; i < n; i++) {
    const h = (k: number) => hash01((i + 1) * 12.9898 + seed * 78.233 + k * 37.719);
    const a = -Math.PI / 2 + (h(1) - 0.5) * Math.PI * 1.6, sp = speed * (0.4 + h(2)), life = Math.min(1, t / 120);
    const x = x0 + Math.cos(a) * sp * t, y = y0 + Math.sin(a) * sp * t + 0.045 * t * t;
    if (y > H + 20) continue;
    const col = CONFETTI[i % 6];
    ctx.globalAlpha = fade * Math.max(0, 1 - life * 0.85);
    ctx.fillStyle = col;
    if (i % 3 === 0) { ctx.save(); ctx.translate(x, y); ctx.rotate(t * 0.2 + i); ctx.fillRect(-4, -2, 8, 4); ctx.restore(); }
    else if (i % 3 === 1) { ctx.beginPath(); ctx.arc(x, y, 2.4, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - Math.cos(a) * 9, y - Math.sin(a) * 9); ctx.stroke(); }
  }
  ctx.globalAlpha = fade;
}
/** One firework: a rising spark, then a ring of falling sparks. */
function firework(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, color: string, fade: number) {
  if (t < 0) return;
  if (t < 22) {
    const k = t / 22, yy = y + (1 - k) * 260;
    ctx.fillStyle = "#fff3c4"; ctx.globalAlpha = fade;
    ctx.beginPath(); ctx.arc(x, yy, 2.5, 0, Math.PI * 2); ctx.fill();
    return;
  }
  const u = t - 22;
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2, d = Math.min(70, u * 3.2) * (0.85 + 0.15 * Math.sin(i * 3));
    const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d + u * u * 0.012;
    ctx.globalAlpha = fade * Math.max(0, 1 - u / 70);
    ctx.strokeStyle = color; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - Math.cos(a) * 7, py - Math.sin(a) * 7); ctx.stroke();
  }
  ctx.globalAlpha = fade;
}

function drawCelebration(ctx: CanvasRenderingContext2D, s: BowlingStateV1, H: number, deck: { x: number; y: number }) {
  const kind = s.lastResult?.kind, t = s.tick - s.phaseTick;
  if (kind !== "strike" && kind !== "spare") return;
  const strike = kind === "strike", dur = strike ? R.strikeTicks : R.spareTicks, end = Math.max(0, (t - (dur - 30)) / 30);
  const fade = 1 - end, cy = H * 0.42, show = bowlingShow(s), frame = s.lastResult!.frame + 1;
  const label = strike ? tx("bowling.strike") : tx("bowling.spare");
  ctx.save();
  ctx.globalAlpha = fade;
  if (t < 14) { ctx.fillStyle = `rgba(255,255,255,${0.7 * (1 - t / 14)})`; ctx.fillRect(0, 0, 390, H); }
  ctx.fillStyle = show === "disco" || show === "fireworks" ? "rgba(4,2,18,.72)" : "rgba(10,4,30,.42)";
  ctx.fillRect(0, 0, 390, H);

  if (show === "supernova" || show === "burst") {
    rays(ctx, t, cy, strike ? 18 : 10);
    burst(ctx, deck.x, deck.y, t, strike ? 150 : 60, strike ? 5 : 3.5, frame, H, fade);
    if (strike) {
      for (let i = 0; i < 10; i++) {
        const k = Math.min(1, t / 70), dir = i - 4.5;
        const x = deck.x + dir * 22 * k + Math.sin(i * 1.7) * 30 * k, y = deck.y - 120 * Math.sin(k * Math.PI * 0.9) + k * k * 120;
        ctx.save(); ctx.globalAlpha = fade * (1 - k * 0.6);
        drawPin(ctx, x, y + 40, 0.45 + k * 0.75, t * 0.15 * (i % 2 ? 1 : -1) + i, 0, "dizzy", false);
        ctx.restore();
      }
    }
    title(ctx, label, t, cy, strike ? 64 : 48, strike ? 0.4 : 0);
  } else if (show === "disco") {
    // Mirror ball, sweeping spotlights and a kick-line of ten happy pins.
    for (const side of [-1, 1]) {
      const a = Math.PI / 2 + side * (0.35 + 0.3 * Math.sin(t * 0.05 + side));
      const g = ctx.createLinearGradient(195, 40, 195 + Math.cos(a) * 600, 40 + Math.sin(a) * 600);
      g.addColorStop(0, side < 0 ? "rgba(255,61,154,.45)" : "rgba(127,227,238,.45)"); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(195, 40);
      ctx.lineTo(195 + Math.cos(a - 0.16) * 700, 40 + Math.sin(a - 0.16) * 700); ctx.lineTo(195 + Math.cos(a + 0.16) * 700, 40 + Math.sin(a + 0.16) * 700);
      ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle = "rgba(255,255,255,.6)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(195, 0); ctx.lineTo(195, 22); ctx.stroke();
    const mg = ctx.createRadialGradient(188, 34, 2, 195, 42, 20);
    mg.addColorStop(0, "#ffffff"); mg.addColorStop(1, "#6b7a90");
    ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(195, 42, 20, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 14; i++) {
      const a = i * 0.9 + t * 0.06, r = 60 + (i % 5) * 50;
      ctx.fillStyle = CONFETTI[i % 6]; ctx.globalAlpha = fade * (0.4 + 0.4 * Math.sin(t * 0.3 + i));
      ctx.beginPath(); ctx.arc(195 + Math.cos(a) * r, 42 + Math.abs(Math.sin(a)) * r * 1.6, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = fade;
    const base = H * 0.72, enter = Math.min(1, t / 40);
    for (let i = 0; i < 10; i++) {
      const x = 32 + i * 36, hop = Math.max(0, Math.sin(t * 0.22 + i * 0.6)) * 22 * enter;
      const y = base + (1 - enter) * 260 - hop, tilt = Math.sin(t * 0.22 + i * 0.6) * 0.22;
      drawPin(ctx, x, y, 0.62, tilt, 0, i % 3 === 0 ? "wow" : "happy");
    }
    title(ctx, label, t, cy - 30, 60, 0.3);
  } else if (show === "fireworks") {
    const plan: [number, number, number, string][] = [[0, 90, 130, "#ff3d9a"], [24, 300, 110, "#7fe3ee"], [50, 195, 80, "#ffd23f"], [80, 120, 170, "#5cffb0"], [110, 270, 160, "#b98cff"], [150, 195, 120, "#ff7a3d"]];
    for (const [start, x, y, c] of plan) firework(ctx, x, y, t - start, c, fade);
    ctx.globalAlpha = fade;
    ctx.fillStyle = "rgba(127,227,238,.25)"; ctx.fillRect(0, H * 0.8, 390, 2);
    for (let i = 0; i < 10; i++) {
      const x = 32 + i * 36, wave = Math.sin(t * 0.16 + i) * 0.18;
      drawPin(ctx, x, H * 0.8, 0.6, wave, 0, t < 40 ? "wow" : "happy");
    }
    title(ctx, label, t, cy, 62, 0.2);
  } else if (show === "comet") {
    // The ball crosses as a comet; the knocked pins orbit the title.
    const k = Math.min(1, t / 46), bx = -40 + 470 * k, by = H * 0.75 - 420 * k * (1 - 0.35 * k);
    for (let i = 1; i <= 18; i++) {
      const q = Math.max(0, k - i * 0.025), tx2 = -40 + 470 * q, ty2 = H * 0.75 - 420 * q * (1 - 0.35 * q);
      ctx.globalAlpha = fade * (1 - i / 18) * 0.6;
      ctx.fillStyle = i % 2 ? "#b98cff" : "#7fe3ee";
      ctx.beginPath(); ctx.arc(tx2, ty2, 16 - i * 0.7, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = fade;
    if (k < 1) {
      const g = ctx.createRadialGradient(bx - 5, by - 6, 2, bx, by, 18);
      g.addColorStop(0, "#e4d8ff"); g.addColorStop(0.4, "#7a4dff"); g.addColorStop(1, "#1a0d55");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx, by, 18, 0, Math.PI * 2); ctx.fill();
    }
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + t * 0.03, depth = Math.sin(a);
      const x = 195 + Math.cos(a) * 150, y = cy + depth * 70 + 30;
      ctx.globalAlpha = fade * Math.min(1, Math.max(0, (t - 20) / 20));
      drawPin(ctx, x, y, 0.45 + 0.2 * (depth + 1), a * 2 + t * 0.08, 0, "dizzy", false);
    }
    ctx.globalAlpha = fade;
    for (let i = 0; i < 30; i++) {
      const sx = (i * 97 + t * 3) % 390, sy = (i * 53) % H;
      ctx.fillStyle = "rgba(255,255,255,.7)"; ctx.fillRect(sx, sy, 2, 2);
    }
    title(ctx, label, t, cy, 62, 0.5);
  } else if (show === "highfive") {
    const k = Math.min(1, t / 30), lean = k >= 1 ? 0.35 : 0.1;
    drawPin(ctx, 195 - 160 + 130 * k, H * 0.62, 1.1, lean, 0, "happy");
    drawPin(ctx, 195 + 160 - 130 * k, H * 0.62, 1.1, -lean, 0, "happy");
    if (t >= 30) {
      const u = t - 30;
      ctx.strokeStyle = `rgba(255,233,164,${Math.max(0, 1 - u / 30)})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(195, H * 0.62 - 120, 10 + u * 3, 0, Math.PI * 2); ctx.stroke();
      burst(ctx, 195, H * 0.62 - 120, u, 40, 3, frame, H, fade);
    }
    title(ctx, label, t, cy - 40, 48);
  } else {
    // Neon wipe: a diagonal band sweeps across and leaves the title; three pins bow in turn.
    const k = Math.min(1, t / 36), x = -120 + 640 * k;
    ctx.save();
    ctx.translate(x, cy); ctx.rotate(-0.35);
    const g = ctx.createLinearGradient(-60, 0, 60, 0);
    g.addColorStop(0, "rgba(255,61,154,0)"); g.addColorStop(0.5, "rgba(255,61,154,.9)"); g.addColorStop(1, "rgba(127,227,238,0)");
    ctx.fillStyle = g; ctx.fillRect(-60, -300, 120, 600);
    ctx.restore();
    if (k > 0.4) title(ctx, label, t - 14, cy, 50);
    for (let i = 0; i < 3; i++) {
      const bow = Math.max(0, Math.sin(Math.min(Math.PI, Math.max(0, (t - 40 - i * 12) / 18))));
      drawPin(ctx, 135 + i * 60, H * 0.7, 0.9, bow * 0.6, 0, "happy");
    }
  }
  if (strike && s.streak >= 2) {
    ctx.fillStyle = "#7fe3ee"; ctx.shadowColor = "#7fe3ee"; ctx.shadowBlur = 14;
    ctx.font = "900 22px system-ui"; ctx.textAlign = "center";
    ctx.fillText(s.streak >= 3 ? tx("bowling.turkey", { n: s.streak }) : tx("bowling.double"), 195, cy + 58);
    ctx.shadowBlur = 0;
  }
  // Skip pill.
  ctx.globalAlpha = Math.min(1, t / 20) * fade;
  ctx.fillStyle = "rgba(6,12,28,.85)"; ctx.strokeStyle = "rgba(255,255,255,.5)"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(275, H - 64, 100, 38, 19); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#fff"; ctx.font = "800 14px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(tx("bowling.skip"), 325, H - 45);
  ctx.restore();
}

/** Chase-cam speed streaks around the ball (presentation). */
function drawSpeedLines(ctx: CanvasRenderingContext2D, v: View, s: BowlingStateV1, H: number) {
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

const hudLabel = (s: Readonly<BowlingStateV1>) => tx("bowling.hud", { frame: Math.min(10, s.frame + 1), roll: s.rollInFrame + 1 });

export default function Bowling(props: GameRuntimeProps) {
  useI18n();
  const gesture = useRef<Gesture | null>(null);
  const render = useCallback((ctx: CanvasRenderingContext2D, s: BowlingStateV1, view: { width: number; height: number }) => {
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
    if (s.phase === "celebrate") drawCelebration(ctx, s, H, project(v, LANE_MM / 2, R.headPinY / MMU + 400));
    else if (last && since < 80 && (last.kind === "gutter" || last.kind === "open")) {
      ctx.globalAlpha = Math.max(0, 1 - since / 80);
      ctx.fillStyle = last.kind === "gutter" ? "#ff8a96" : "#f9ecd2";
      ctx.font = "900 26px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(last.kind === "gutter" ? tx("bowling.gutter") : String(last.knocked), 195, H * 0.4 - since * 0.3);
      ctx.globalAlpha = 1;
    }
  }, []);
  const pick = useCallback((point: CorePoint, phase: "down" | "move" | "up", s: BowlingStateV1) => {
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
