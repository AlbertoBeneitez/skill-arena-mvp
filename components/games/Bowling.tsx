"use client";
import { useCallback, useRef } from "react";
import type { GameRuntimeProps } from "@/lib/games";
import { drawSpaceBackdrop } from "@/lib/spaceBackdrop";
import { gameTone } from "@/lib/gameFeedback";
import {
  BOWLING_CORE_V3 as core,
  BOWLING_RULES_V3 as R,
  bowlingScore,
  type BowlingStateV3,
} from "@/lib/verified/bowlingCore.v3";
import { BOWLING_V2_ANGLE_CENTRE, bowlingActionV2 as bowlingAction } from "@/lib/verified/bowlingProtocol.v2";
import { drawCartoon } from "./bowlingShow";
import { strokeOf, swipePower, throwFromStroke } from "@/lib/bowlingGesture.v3";
import CoreCanvasGame, { type CorePoint } from "./CoreCanvasGame";
import { t as tx, useI18n } from "@/lib/i18n";

/*
 * Presentation only (Bowling V3, v125). A perspective lane — a rendered maple/pine texture sampled one screen line at
 * a time, the pit wall with its masking unit, kickbacks and the pins reflected on the varnish — whose camera dollies
 * after the ball; a score sheet; and the strike / spare celebration (instant replay + a 10 s cartoon with the pins
 * as characters, skippable: a tap sends SKIP, which the core records). The throw gesture is turned into quantised
 * AIM / ANGLE / SPIN / POWER actions here: the straight line from where the stroke starts to where it ends is the
 * direction, the stroke's bend away from that line is the spin, the final flick speed is the power. Only those
 * actions reach the recorder and the replay.
 */
const MMU = 1000; // µm per mm
const F = 14000; // perspective focal distance (mm)
const KX = 0.3; // px per mm at the foul line
const LANE_MM = R.laneWidth / MMU;

type View = { H: number; nearY: number; horizonY: number; camZ: number; camX: number };
/** Rendered art (scripts/render-bowling-art.py); the procedural lane is the fallback until it has loaded. */
const art: { lane: HTMLImageElement | null; pit: HTMLImageElement | null; started: boolean } = { lane: null, pit: null, started: false };
function loadArt() {
  if (art.started || typeof Image === "undefined") return;
  art.started = true;
  const load = (src: string, key: "lane" | "pit") => { const img = new Image(); img.decoding = "async"; img.onload = () => { art[key] = img; }; img.src = src; };
  load("/art/bowling-lane.webp?v=125", "lane");
  load("/art/bowling-pit.webp?v=125", "pit");
}
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

function drawSheet(ctx: CanvasRenderingContext2D, s: BowlingStateV3) {
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

const GUTTER = 235, TEX_X0 = -GUTTER, TEX_X1 = LANE_MM + GUTTER;
/** The lane texture drawn row by row: each screen line samples the texture row of the lane distance it shows. */
function drawLaneTexture(ctx: CanvasRenderingContext2D, v: View, img: HTMLImageElement, near: number, pit: number) {
  const top = Math.max(0, Math.ceil(project(v, 0, pit).y)), bottom = Math.min(v.H, Math.floor(project(v, 0, near).y));
  const tw = img.naturalWidth, th = img.naturalHeight;
  for (let y = top; y <= bottom; y++) {
    const sc = (y - v.horizonY) / (v.nearY - v.horizonY);
    if (sc <= 0) continue;
    const wy = F / sc - F + v.camZ;
    if (wy < near - 1 || wy > pit) continue;
    const ty = Math.max(0, Math.min(th - 1, Math.floor((1 - wy / pit) * th)));
    const xl = 195 + (TEX_X0 - LANE_MM / 2 - v.camX * sc) * KX * sc, xr = 195 + (TEX_X1 - LANE_MM / 2 - v.camX * sc) * KX * sc;
    ctx.drawImage(img, 0, ty, tw, 1, xl, y, xr - xl, 1.25);
  }
}
/** Kickbacks: the side walls along the pin deck, with a neon edge. */
function drawKickbacks(ctx: CanvasRenderingContext2D, v: View, pit: number) {
  const y0 = R.headPinY / MMU - 900;
  for (const x of [TEX_X0, TEX_X1]) {
    const a = project(v, x, y0), b = project(v, x, pit), ha = 650 * KX * a.s, hb = 650 * KX * b.s;
    const g = ctx.createLinearGradient(0, a.y - ha, 0, a.y);
    g.addColorStop(0, "#1a2340"); g.addColorStop(1, "#0a0f22");
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(b.x, b.y - hb); ctx.lineTo(a.x, a.y - ha); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#ff3d9a"; ctx.lineWidth = 2; ctx.shadowColor = "#ff3d9a"; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.moveTo(a.x, a.y - ha); ctx.lineTo(b.x, b.y - hb); ctx.stroke(); ctx.shadowBlur = 0;
  }
}

function drawLane(ctx: CanvasRenderingContext2D, v: View, tick: number) {
  const pit = R.pitY / MMU, near = Math.max(0, v.camZ - 400);
  const quad = (x0: number, x1: number, y0: number, y1: number, fill: string | CanvasGradient) => {
    const a = project(v, x0, y0), b = project(v, x1, y0), c = project(v, x1, y1), d = project(v, x0, y1);
    ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath(); ctx.fill();
  };
  // Back wall of the pit: the rendered masking unit, or a neon band until it has loaded.
  const back = project(v, 0, pit + 300);
  if (art.pit) {
    const l = project(v, -1500, pit + 300), r = project(v, LANE_MM + 1500, pit + 300), hh = 2200 * KX * l.s;
    ctx.drawImage(art.pit, l.x, l.y - hh, r.x - l.x, hh);
  } else {
    ctx.fillStyle = "#070b18";
    ctx.fillRect(0, back.y - 120 * back.s, 390, 120 * back.s + 4);
    ctx.fillStyle = "#ff3d9a"; ctx.shadowColor = "#ff3d9a"; ctx.shadowBlur = 14;
    ctx.fillRect(0, back.y - 6, 390, 3);
    ctx.shadowBlur = 0;
  }
  // Approach floor beyond the gutters.
  quad(-900, LANE_MM + 900, near, pit + 300, "#0b1226");
  if (art.lane) {
    drawLaneTexture(ctx, v, art.lane, near, pit);
    quad(0, LANE_MM, R.headPinY / MMU - 300, pit, "rgba(255,240,210,.12)");
    drawKickbacks(ctx, v, pit);
    drawEdgeLights(ctx, v, near, pit, tick);
    return;
  }
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
  // Targeting arrows at the same fraction of the (longer) lane as on a regulation lane.
  for (let k = 0; k < 7; k++) {
    const x = LANE_MM / 2 + (k - 3) * 135, y = 8050 + Math.abs(k - 3) * 525;
    const tip = project(v, x, y), l = project(v, x - 25, y - 660), r = project(v, x + 25, y - 660);
    ctx.fillStyle = "rgba(60,30,10,.75)"; ctx.beginPath(); ctx.moveTo(tip.x, tip.y); ctx.lineTo(l.x, l.y); ctx.lineTo(r.x, r.y); ctx.closePath(); ctx.fill();
  }
  drawEdgeLights(ctx, v, near, pit, tick);
}
/** Neon edge lights on the cappings, chasing toward the pins. */
function drawEdgeLights(ctx: CanvasRenderingContext2D, v: View, near: number, pit: number, tick: number) {
  for (const x of [-GUTTER - 18, LANE_MM + GUTTER + 18]) {
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

function drawBall(ctx: CanvasRenderingContext2D, v: View, s: BowlingStateV3) {
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

function drawPinsAndBall(ctx: CanvasRenderingContext2D, v: View, s: BowlingStateV3) {
  type Item = { y: number; draw: () => void };
  const items: Item[] = [];
  // Reflections on the varnished deck first (standing pins and the ball, mirrored at their base).
  ctx.save();
  ctx.globalAlpha = 0.17;
  for (const pin of s.pins) {
    if (!pin.present || !pin.standing) continue;
    const p = project(v, pin.x / MMU, pin.y / MMU);
    ctx.save(); ctx.translate(0, p.y * 2); ctx.scale(1, -1); drawPin(ctx, p.x, p.y, p.s, 0, 0, "plain", false); ctx.restore();
  }
  if (s.ball.active && !s.ball.gutter && s.ball.y / MMU > v.camZ - 300) {
    const p = project(v, s.ball.x / MMU, s.ball.y / MMU), r = (R.ballRadius / MMU) * KX * p.s;
    ctx.fillStyle = "#7a4dff"; ctx.beginPath(); ctx.arc(p.x, p.y + r * 0.9, r * 0.9, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
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

function drawAimGuide(ctx: CanvasRenderingContext2D, v: View, s: BowlingStateV3) {
  const x0 = (R.aimX0 + s.aim * R.aimStep) / MMU, slope = ((s.angle - BOWLING_V2_ANGLE_CENTRE) * R.angleStep) / 1_000_000;
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
type ReplayFrame = { tick: number; ball: BowlingStateV3["ball"]; pins: BowlingStateV3["pins"] };
const capture: { seed: string; rollStart: number; frames: ReplayFrame[] } = { seed: "", rollStart: -1, frames: [] };
/** Record the rolling ball and pins once per simulated tick (presentation memory only, never sent anywhere). */
function captureRoll(s: BowlingStateV3) {
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

/** Act 1: the captured throw in slow motion, close and low on the pin deck. Returns false when nothing was captured. */
function drawReplay(ctx: CanvasRenderingContext2D, s: BowlingStateV3, H: number, t: number, len: number, strike: boolean) {
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
  drawPinsAndBall(ctx, v, { ...s, tick: Math.floor(rt), ball: f.ball, pins: f.pins } as BowlingStateV3);
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

const REPLAY_TICKS = 210;
/** True when the roll that ended in this strike / spare was captured and has a first hit to replay. */
function replayReady(s: BowlingStateV3) {
  if (capture.seed !== s.seed || !capture.frames.length) return false;
  return capture.frames[capture.frames.length - 1].pins.some((p) => !p.standing && p.hitTick >= 0);
}
/** Strike / spare: 1.75 s instant replay, then the 10 s cartoon (bowlingShow.ts). */
function drawCelebration(ctx: CanvasRenderingContext2D, s: BowlingStateV3, H: number) {
  const kind = s.lastResult?.kind, t = s.tick - s.phaseTick;
  if (kind !== "strike" && kind !== "spare") return;
  const strike = kind === "strike", dur = strike ? R.strikeTicks : R.spareTicks;
  const fadeOut = Math.max(0, Math.min(1, (dur - t) / 24)), replay = replayReady(s);
  ctx.save();
  ctx.globalAlpha = fadeOut;
  ctx.fillStyle = "#050812"; ctx.fillRect(0, 0, 390, H);
  if (!(replay && t < REPLAY_TICKS && drawReplay(ctx, s, H, t, REPLAY_TICKS, strike))) drawCartoon(ctx, s, H, t - (replay ? REPLAY_TICKS : 0));
  // Skip pill.
  ctx.globalAlpha = Math.min(1, t / 20) * fadeOut;
  ctx.fillStyle = "rgba(6,12,28,.85)"; ctx.strokeStyle = "rgba(255,255,255,.5)"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(275, H - 64, 100, 38, 19); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#fff"; ctx.font = "800 14px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(tx("bowling.skip"), 325, H - 45);
  ctx.restore();
}

/** Chase-cam speed streaks around the ball (presentation). */
function drawSpeedLines(ctx: CanvasRenderingContext2D, v: View, s: BowlingStateV3, H: number) {
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

/** Live stroke with its direction line and a power bar, so the throw reads before release (presentation). */
function drawSwipe(ctx: CanvasRenderingContext2D, g: Gesture | null) {
  if (!g || g.path.length < 2) return;
  const stroke = strokeOf(g), a = stroke[0], last = stroke[stroke.length - 1];
  if (!a || a.y - last.y < 12) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.setLineDash([5, 6]); ctx.strokeStyle = "rgba(255,255,255,.45)"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(last.x, last.y); ctx.stroke(); ctx.setLineDash([]);
  for (let i = 1; i < stroke.length; i++) {
    const p0 = stroke[i - 1], p1 = stroke[i];
    ctx.strokeStyle = `rgba(127,227,238,${0.15 + 0.7 * (i / stroke.length)})`; ctx.lineWidth = 2 + 8 * (i / stroke.length);
    ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
  }
  const power = swipePower(stroke);
  ctx.fillStyle = "rgba(6,12,28,.8)"; ctx.beginPath(); ctx.roundRect(362, 250, 14, 200, 7); ctx.fill();
  const fill = ctx.createLinearGradient(0, 450, 0, 250);
  fill.addColorStop(0, "#5cffb0"); fill.addColorStop(0.6, "#ffd23f"); fill.addColorStop(1, "#ff3d9a");
  ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(364, 448 - (196 * (power + 1)) / 9, 10, (196 * (power + 1)) / 9, 5); ctx.fill();
  ctx.restore();
}

const hudLabel = (s: Readonly<BowlingStateV3>) => tx("bowling.hud", { frame: Math.min(10, s.frame + 1), roll: s.rollInFrame + 1 });

/** One frame of the game (pure presentation of the state; exported for the offline render checks). */
export function renderBowling(ctx: CanvasRenderingContext2D, s: BowlingStateV3, view: { width: number; height: number }, g: Gesture | null = null) {
  const H = Math.max(620, view.height);
  loadArt();
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
  if (s.phase === "aim") drawSwipe(ctx, g);
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
}

export default function Bowling(props: GameRuntimeProps) {
  useI18n();
  const gesture = useRef<Gesture | null>(null);
  const render = useCallback((ctx: CanvasRenderingContext2D, s: BowlingStateV3, view: { width: number; height: number }) => renderBowling(ctx, s, view, gesture.current), []);
  const pick = useCallback((point: CorePoint, phase: "down" | "move" | "up", s: BowlingStateV3) => {
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
    const th = throwFromStroke(strokeOf(g));
    if (!th) return null;
    gameTone("tap");
    return [bowlingAction("ANGLE", th.angle), bowlingAction("SPIN", th.spin), bowlingAction("POWER", th.power), "ROLL"];
  }, []);
  return (
    <div className="bowlingVerified">
      <CoreCanvasGame {...props} core={core} name="Bowling" instruction="" render={render} pointAction={pick}
        expandVerticalViewport hideHudScore hideHudLabel hudLabel={hudLabel} keys={{ Enter: "ROLL", " ": "SKIP" }} />
    </div>
  );
}
