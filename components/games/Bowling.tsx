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

type View = { H: number; nearY: number; horizonY: number; camZ: number };
const motion = { tick: -1, camZ: 0, seed: "" };

function project(v: View, xmm: number, ymm: number) {
  const z = ymm - v.camZ;
  const s = F / (F + Math.max(-F * 0.6, z));
  return { x: 195 + (xmm - LANE_MM / 2) * KX * s, y: v.horizonY + (v.nearY - v.horizonY) * s, s };
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

function drawPin(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, tilt: number, lift: number) {
  const h = 380 * KX * s, w = 121 * KX * s;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,.35)";
  ctx.beginPath(); ctx.ellipse(x, y, w * 0.7, w * 0.25, 0, 0, Math.PI * 2); ctx.fill();
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
  for (const pin of s.pins) {
    if (!pin.present) continue;
    const p = project(v, pin.x / MMU, pin.y / MMU);
    let tilt = 0, lift = 0;
    if (!pin.standing) {
      const age = Math.max(0, s.tick - pin.hitTick), dir = pin.vx === 0 ? (pin.x > R.laneWidth / 2 ? 1 : -1) : Math.sign(pin.vx);
      tilt = dir * Math.min(Math.PI / 2, age * 0.09);
      lift = Math.max(0, Math.sin(Math.min(Math.PI, age * 0.08)) * 26 * p.s);
    }
    items.push({ y: pin.y, draw: () => drawPin(ctx, p.x, p.y, p.s, tilt, lift) });
  }
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

/** Strike / spare celebration. Pure function of the state and the time since it started. */
function drawCelebration(ctx: CanvasRenderingContext2D, s: BowlingStateV1, H: number, deck: { x: number; y: number }) {
  const kind = s.lastResult?.kind, t = s.tick - s.phaseTick;
  if (kind !== "strike" && kind !== "spare") return;
  const strike = kind === "strike", dur = strike ? R.strikeTicks : R.spareTicks, end = Math.max(0, (t - (dur - 30)) / 30);
  const cy = H * 0.42;
  ctx.save();
  ctx.globalAlpha = 1 - end;
  if (t < 14) { ctx.fillStyle = `rgba(255,255,255,${0.7 * (1 - t / 14)})`; ctx.fillRect(0, 0, 390, H); }
  ctx.fillStyle = "rgba(10,4,30,.42)"; ctx.fillRect(0, 0, 390, H);
  // Rotating light rays.
  const rays = strike ? 18 : 10;
  ctx.save(); ctx.translate(195, cy); ctx.rotate(t * 0.012);
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2, w = Math.PI / rays * 0.55;
    const g = ctx.createRadialGradient(0, 0, 10, 0, 0, 420);
    g.addColorStop(0, i % 2 ? "rgba(255,61,154,.55)" : "rgba(122,92,255,.55)"); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 420, a - w, a + w); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  // Particle burst from the pin deck (sparks, stars, confetti), seeded by the frame number.
  const n = strike ? 150 : 60;
  for (let i = 0; i < n; i++) {
    const h = (k: number) => { const q = Math.sin((i + 1) * 12.9898 + (s.lastResult!.frame + 1) * 78.233 + k * 37.719) * 43758.5453; return q - Math.floor(q); };
    const a = -Math.PI / 2 + (h(1) - 0.5) * Math.PI * 1.6, sp = (strike ? 5 : 3.5) * (0.4 + h(2)), life = Math.min(1, t / 120);
    const x = deck.x + Math.cos(a) * sp * t, y = deck.y + Math.sin(a) * sp * t + 0.045 * t * t;
    if (y > H + 20) continue;
    const col = ["#ff3d9a", "#7fe3ee", "#ffd23f", "#b98cff", "#5cffb0", "#ffffff"][i % 6];
    ctx.globalAlpha = (1 - end) * Math.max(0, 1 - life * 0.85);
    ctx.fillStyle = col;
    if (i % 3 === 0) { ctx.save(); ctx.translate(x, y); ctx.rotate(t * 0.2 + i); ctx.fillRect(-4, -2, 8, 4); ctx.restore(); }
    else if (i % 3 === 1) { ctx.beginPath(); ctx.arc(x, y, 2.4, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - Math.cos(a) * 9, y - Math.sin(a) * 9); ctx.stroke(); }
  }
  ctx.globalAlpha = 1 - end;
  // Pins flying at the camera (strike only).
  if (strike) {
    for (let i = 0; i < 10; i++) {
      const k = Math.min(1, t / 70), dir = i - 4.5;
      const x = deck.x + dir * 22 * k + Math.sin(i * 1.7) * 30 * k, y = deck.y - 120 * Math.sin(k * Math.PI * 0.9) + k * k * 120;
      ctx.save(); ctx.globalAlpha = (1 - end) * (1 - k * 0.6);
      drawPin(ctx, x, y + 40, 0.45 + k * 0.75, t * 0.15 * (i % 2 ? 1 : -1) + i, 0);
      ctx.restore();
    }
  }
  // Title: bounce-in, extruded, gradient, shimmer.
  const label = strike ? tx("bowling.strike") : tx("bowling.spare");
  const pop = t < 26 ? 1 + 0.45 * Math.sin((t / 26) * Math.PI) * (1 - t / 26) * 2 - (1 - Math.min(1, t / 10)) * 0.8 : 1 + 0.03 * Math.sin(t * 0.12);
  const shakeX = strike && t < 24 ? Math.sin(t * 2.1) * (24 - t) * 0.4 : 0;
  ctx.save();
  ctx.translate(195 + shakeX, cy);
  ctx.scale(pop, pop);
  ctx.font = `900 ${strike ? 64 : 48}px system-ui, sans-serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (let k = 8; k > 0; k--) { ctx.fillStyle = `rgba(${40 + k * 8},10,${70 + k * 10},1)`; ctx.fillText(label, k * 0.6, k * 1.1); }
  const g = ctx.createLinearGradient(0, -34, 0, 34);
  g.addColorStop(0, "#fff6c2"); g.addColorStop(0.35, "#ffd23f"); g.addColorStop(0.7, "#ff7a3d"); g.addColorStop(1, "#ff3d9a");
  ctx.fillStyle = g; ctx.fillText(label, 0, 0);
  ctx.lineWidth = 2.5; ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.strokeText(label, 0, 0);
  // Shimmer band clipped to the letters.
  ctx.globalCompositeOperation = "source-atop";
  const band = ((t * 6) % 600) - 300;
  const sh = ctx.createLinearGradient(band - 40, 0, band + 40, 0);
  sh.addColorStop(0, "rgba(255,255,255,0)"); sh.addColorStop(0.5, "rgba(255,255,255,.85)"); sh.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sh; ctx.fillRect(-200, -50, 400, 100);
  ctx.globalCompositeOperation = "source-over";
  ctx.restore();
  if (strike && s.streak >= 2) {
    ctx.fillStyle = "#7fe3ee"; ctx.shadowColor = "#7fe3ee"; ctx.shadowBlur = 14;
    ctx.font = "900 22px system-ui"; ctx.textAlign = "center";
    ctx.fillText(s.streak >= 3 ? tx("bowling.turkey", { n: s.streak }) : tx("bowling.double"), 195, cy + 58);
    ctx.shadowBlur = 0;
  }
  // Skip pill.
  ctx.globalAlpha = Math.min(1, t / 20) * (1 - end);
  ctx.fillStyle = "rgba(6,12,28,.85)"; ctx.strokeStyle = "rgba(255,255,255,.5)"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(275, H - 64, 100, 38, 19); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#fff"; ctx.font = "800 14px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(tx("bowling.skip"), 325, H - 45);
  ctx.restore();
}

const hudLabel = (s: Readonly<BowlingStateV1>) => tx("bowling.hud", { frame: Math.min(10, s.frame + 1), roll: s.rollInFrame + 1 });

export default function Bowling(props: GameRuntimeProps) {
  useI18n();
  const gesture = useRef<{ x: number; y: number; t: number; path: { x: number; y: number }[]; aimDrag: boolean } | null>(null);
  const render = useCallback((ctx: CanvasRenderingContext2D, s: BowlingStateV1, view: { width: number; height: number }) => {
    const H = Math.max(620, view.height);
    if (s.seed !== motion.seed || s.tick < motion.tick) { motion.seed = s.seed; motion.camZ = 0; }
    // Camera dolly: follow the ball down the lane while it rolls; glide back for the next throw.
    const want = s.phase === "rolling" ? Math.max(0, Math.min(10500, s.ball.y / MMU - 3500)) : 0;
    const steps = Math.min(10, Math.max(0, s.tick - motion.tick));
    for (let i = 0; i < steps; i++) motion.camZ += (want - motion.camZ) * (want > motion.camZ ? 0.2 : 0.06);
    motion.tick = s.tick;
    const nearY = H - 70, sPins = F / (F + R.headPinY / MMU), horizonY = (150 - sPins * nearY) / (1 - sPins);
    const v: View = { H, nearY, horizonY, camZ: motion.camZ };
    drawSpaceBackdrop(ctx, 390, H, 0, s.tick);
    drawLane(ctx, v, s.tick);
    if (s.phase === "aim") drawAimGuide(ctx, v, s);
    drawPinsAndBall(ctx, v, s);
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
    if (phase === "down") { gesture.current = { x: point.x, y: point.y, t: now, path: [point], aimDrag: false }; return null; }
    const g = gesture.current;
    if (!g) return null;
    g.path.push(point);
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
    if (dy > -40) return null;
    // Release: direction → angle, speed → power, bend of the path → spin.
    const ms = Math.max(60, now - g.t), speed = -dy / ms;
    const angle = Math.max(0, Math.min(24, Math.round(12 + (dx / -dy) * 40)));
    const power = Math.max(0, Math.min(8, Math.round((speed - 0.35) / 0.18)));
    const mid = g.path[Math.floor(g.path.length / 2)], chord = g.x + dx * ((mid.y - g.y) / (dy || -1));
    const spin = Math.max(0, Math.min(8, Math.round(4 + ((chord - mid.x) / -dy) * 30)));
    gameTone("tap");
    return [bowlingAction("ANGLE", angle), bowlingAction("SPIN", spin), bowlingAction("POWER", power), "ROLL"];
  }, []);
  return (
    <div className="bowlingVerified">
      <CoreCanvasGame {...props} core={core} name="Galactic Bowling" instruction="" render={render} pointAction={pick}
        expandVerticalViewport hideHudScore hideHudLabel hudLabel={hudLabel} keys={{ Enter: "ROLL", " ": "SKIP" }} />
    </div>
  );
}
