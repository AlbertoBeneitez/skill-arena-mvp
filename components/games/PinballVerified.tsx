"use client";
import type { GameRuntimeProps } from "@/lib/games";
import { drawSpaceBackdrop } from "@/lib/spaceBackdrop";
import {
  PINBALL_CORE_V14,
  PINBALL_DIVIDERS_V14,
  PINBALL_DROPS_V14,
  PINBALL_INLANES_V14,
  PINBALL_LANES_V14,
  PINBALL_LSPINNER_V14,
  PINBALL_MOUTHS_V14,
  PINBALL_ORBIT_ZONES_V14,
  PINBALL_POSTS_V14,
  PINBALL_RTARGETS_V14,
  PINBALL_RULES_V14,
  PINBALL_SAUCER_V14,
  PINBALL_SCOOP_ROOF_V14,
  PINBALL_SLINGS_V14,
  PINBALL_SPINNER_V14,
  PINBALL_STARS_V14,
  PINBALL_TARGETS_V14,
  PINBALL_TUBES_V14,
  PINBALL_WALLS_V14,
  PINBALL_WORMHOLE_V14,
  pinballBumpersV14,
  pinballChargeLevelV14,
  pinballFlipperTipV14,
  pinballFrenzyV14,
  pinballTubeLengthV14,
  pinballTubePointV14,
  pinballUpperTipV14,
  pinballStretchPxV14 as Y,
  type PinballStateV14,
} from "@/lib/verified/pinballCore.v14";
import CoreCanvasGame, { type CorePoint } from "./CoreCanvasGame";
import type { ScoreCell } from "../GameScoreboard";
import { t as tx, formatNumber, useI18n, type MessageKey } from "@/lib/i18n";

/*
 * Presentation only (V14 table). Everything here reads the authoritative state and never changes it.
 * Art direction (owner, 9-nov-2026): first the routes the ball can take, each in one steady colour — left orbit cyan,
 * right orbit green, left ramp violet, right ramp magenta, centre scoop gold — then the decoration. Ramps are clear
 * plastic going up and chrome wire coming down; lamps breathe slowly instead of cycling colours. Static art is
 * cached once per scale.
 */

const W = 390, H = 620;
const k = (v: number) => v / 1000;
const R = PINBALL_RULES_V14;
type RGB = readonly [number, number, number];
// V14: saturated neon per route on an almost black floor (more contrast).
const ROUTE = {
  lOrbit: [0, 229, 255] as RGB,
  rOrbit: [57, 255, 136] as RGB,
  lRamp: [160, 92, 255] as RGB,
  rRamp: [255, 47, 168] as RGB,
  scoop: [255, 196, 0] as RGB,
};
/** Bumper colours by value: the big triangle cyan / magenta / gold, the small side pair violet. */
const BUMPER_TONES: readonly [RGB, RGB][] = [
  [[0, 229, 255], [0, 70, 120]], [[255, 47, 168], [110, 0, 70]], [[255, 196, 0], [120, 60, 0]],
  [[160, 92, 255], [50, 20, 120]], [[160, 92, 255], [50, 20, 120]],
];
const GOLD: RGB = [233, 194, 122];
const rgba = (c: RGB, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
/** Slow breathing (period ≈ 1.6 s at 120 ticks/s). */
const breathe = (t: number, phase = 0) => 0.5 + 0.5 * Math.sin(t * 0.032 + phase);
const LANE_LETTERS = ["A", "B", "C"];
/** Centre of the emblem between the slings. */
const EMBLEM_Y = 476;
const TUBE_ROUTE = [ROUTE.lOrbit, ROUTE.rOrbit, ROUTE.scoop, ROUTE.lRamp, ROUTE.rRamp] as const;

// ---------- geometry helpers ----------
type Pt = { x: number; y: number };
const pathOf = (tube: number): Pt[] => PINBALL_TUBES_V14[tube].path.map((p) => ({ x: k(p.x), y: k(p.y) }));
/** Smooth polyline through the points (quadratic midpoints). */
function smooth(ctx: CanvasRenderingContext2D, pts: readonly Pt[], dx = 0, dy = 0) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x + dx, pts[0].y + dy);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2;
    ctx.quadraticCurveTo(pts[i].x + dx, pts[i].y + dy, mx + dx, my + dy);
  }
  const last = pts[pts.length - 1];
  ctx.lineTo(last.x + dx, last.y + dy);
}
/** Points offset sideways from a polyline (for rails). */
function offsetPath(pts: readonly Pt[], off: number): Pt[] {
  return pts.map((p, i) => {
    const q = pts[Math.min(pts.length - 1, i + 1)], o = pts[Math.max(0, i - 1)];
    const dx = q.x - o.x, dy = q.y - o.y, len = Math.hypot(dx, dy) || 1;
    return { x: p.x - (dy / len) * off, y: p.y + (dx / len) * off };
  });
}
function chevron(ctx: CanvasRenderingContext2D, x: number, y: number, ang: number, size: number, fill: string, glow?: string) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(ang);
  if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 10; }
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(size, 0); ctx.lineTo(-size * 0.6, -size * 0.85); ctx.lineTo(-size * 0.15, 0); ctx.lineTo(-size * 0.6, size * 0.85);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}
function tableOutline(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  ctx.moveTo(18, 640); ctx.lineTo(18, Y(140)); ctx.lineTo(46, Y(70)); ctx.lineTo(110, Y(42)); ctx.lineTo(290, Y(42));
  ctx.lineTo(372, Y(124)); ctx.lineTo(372, 640);
  ctx.closePath();
}
function chromeLine(ctx: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, width = 6) {
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(0,0,0,.5)"; ctx.lineWidth = width + 3;
  ctx.beginPath(); ctx.moveTo(ax + 1.5, ay + 2); ctx.lineTo(bx + 1.5, by + 2); ctx.stroke();
  ctx.strokeStyle = "#566377"; ctx.lineWidth = width;
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
  ctx.strokeStyle = "#e3ebf3"; ctx.lineWidth = Math.max(1.4, width * 0.3);
  ctx.beginPath(); ctx.moveTo(ax - 0.7, ay - 0.7); ctx.lineTo(bx - 0.7, by - 0.7); ctx.stroke();
}

/** Shot lanes painted on the floor: from where the flippers send the ball to each mouth (arrow inserts). */
const SHOT_LANES = [
  { from: [226, 444], via: [160, 410], to: [126, 334], color: ROUTE.lRamp }, // right flipper → left ramp
  { from: [164, 444], via: [230, 410], to: [264, 334], color: ROUTE.rRamp }, // left flipper → right ramp
  { from: [195, 424], via: [195, 380], to: [195, 336], color: ROUTE.scoop }, // centre → scoop (through a dropped target)
  { from: [72, 424], via: [40, 340], to: [44, Y(236)], color: ROUTE.lOrbit }, // left orbit
  { from: [318, 424], via: [328, 340], to: [322, Y(236)], color: ROUTE.rOrbit }, // right orbit
] as const;
/** Point and heading at f (0…1) along a curved shot lane (quadratic). */
function laneAt(l: (typeof SHOT_LANES)[number], f: number) {
  const [ax, ay] = l.from, [cx, cy] = l.via, [bx, by] = l.to, u = 1 - f;
  const x = u * u * ax + 2 * u * f * cx + f * f * bx, y = u * u * ay + 2 * u * f * cy + f * f * by;
  const dx = 2 * u * (cx - ax) + 2 * f * (bx - cx), dy = 2 * u * (cy - ay) + 2 * f * (by - cy);
  return { x, y, ang: Math.atan2(dy, dx) };
}

/** Saturn porthole between the slings (static part; cached with the rest of the art). */
function drawSaturnEmblem(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  const R0 = 46;
  ctx.save();
  // Outer glow and the chrome bezel with bolts.
  const halo = ctx.createRadialGradient(cx, cy, R0 - 4, cx, cy, R0 + 22);
  halo.addColorStop(0, "rgba(255,190,110,.35)"); halo.addColorStop(1, "rgba(255,190,110,0)");
  ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(cx, cy, R0 + 22, 0, Math.PI * 2); ctx.fill();
  const bezel = ctx.createLinearGradient(cx - R0, cy - R0, cx + R0, cy + R0);
  bezel.addColorStop(0, "#f4f7fb"); bezel.addColorStop(0.3, "#7d8798"); bezel.addColorStop(0.55, "#dfe6ee"); bezel.addColorStop(1, "#2b313d");
  ctx.fillStyle = bezel; ctx.beginPath(); ctx.arc(cx, cy, R0 + 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#0b0e18"; ctx.beginPath(); ctx.arc(cx, cy, R0 + 0.5, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.26, bx = cx + Math.cos(a) * (R0 + 2.6), by = cy + Math.sin(a) * (R0 + 2.6);
    ctx.fillStyle = "#3a4250"; ctx.beginPath(); ctx.arc(bx, by, 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.75)"; ctx.beginPath(); ctx.arc(bx - 0.4, by - 0.5, 0.6, 0, Math.PI * 2); ctx.fill();
  }
  // The window: deep space with a nebula and stars.
  ctx.beginPath(); ctx.arc(cx, cy, R0 - 1, 0, Math.PI * 2); ctx.clip();
  const space = ctx.createRadialGradient(cx - 10, cy - 14, 4, cx, cy, R0);
  space.addColorStop(0, "#2a1a5c"); space.addColorStop(0.55, "#120c34"); space.addColorStop(1, "#05040f");
  ctx.fillStyle = space; ctx.fillRect(cx - R0, cy - R0, R0 * 2, R0 * 2);
  for (const [nx, ny, nr, c] of [[-22, -20, 30, "255,80,170"], [24, 18, 26, "0,190,255"], [10, -28, 20, "255,190,80"]] as const) {
    const g = ctx.createRadialGradient(cx + nx, cy + ny, 0, cx + nx, cy + ny, nr);
    g.addColorStop(0, `rgba(${c},.28)`); g.addColorStop(1, `rgba(${c},0)`);
    ctx.fillStyle = g; ctx.fillRect(cx - R0, cy - R0, R0 * 2, R0 * 2);
  }
  for (let i = 0; i < 26; i++) {
    const sx = cx - R0 + ((i * 53) % (R0 * 2)), sy = cy - R0 + ((i * 97) % (R0 * 2));
    ctx.fillStyle = `rgba(230,240,255,${0.35 + (i % 4) * 0.15})`; ctx.fillRect(sx, sy, i % 6 ? 0.8 : 1.4, i % 6 ? 0.8 : 1.4);
  }
  // Rings: several bands with the dark gap; the back half first.
  const tilt = -0.36, rx = 40, ry = 10.5;
  const rings = (from: number, to: number) => {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(tilt);
    for (const [k2, w, c] of [[1, 3.2, "rgba(232,205,160,.9)"], [0.86, 2.2, "rgba(196,150,96,.85)"], [0.77, 0.9, "rgba(20,12,30,.9)"], [0.7, 2.6, "rgba(250,226,186,.95)"], [0.6, 1.4, "rgba(170,120,80,.7)"]] as const) {
      ctx.strokeStyle = c; ctx.lineWidth = w;
      ctx.beginPath(); ctx.ellipse(0, 0, rx * k2, ry * k2, 0, from, to); ctx.stroke();
    }
    ctx.restore();
  };
  rings(Math.PI, Math.PI * 2);
  // The planet: cloud bands clipped to the disc, a terminator, rim light.
  const pr = 20;
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, pr, 0, Math.PI * 2); ctx.clip();
  const body = ctx.createLinearGradient(cx, cy - pr, cx, cy + pr);
  body.addColorStop(0, "#f6d9a2"); body.addColorStop(0.5, "#e2a560"); body.addColorStop(1, "#a35f2c");
  ctx.fillStyle = body; ctx.fillRect(cx - pr, cy - pr, pr * 2, pr * 2);
  ctx.translate(cx, cy); ctx.rotate(tilt);
  for (const [y, h, c] of [[-14, 3, "rgba(255,240,210,.45)"], [-8, 2.4, "rgba(150,82,36,.45)"], [-3, 4, "rgba(255,226,180,.35)"], [3, 2.2, "rgba(140,70,30,.5)"], [8, 3.2, "rgba(250,214,160,.35)"], [13, 2.6, "rgba(120,60,26,.5)"]] as const) {
    ctx.fillStyle = c; ctx.fillRect(-pr * 1.3, y, pr * 2.6, h);
  }
  ctx.restore();
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, pr, 0, Math.PI * 2); ctx.clip();
  const night = ctx.createRadialGradient(cx - 8, cy - 8, pr * 0.5, cx - 3, cy - 3, pr * 1.45);
  night.addColorStop(0, "rgba(0,0,0,0)"); night.addColorStop(0.72, "rgba(10,4,20,.1)"); night.addColorStop(1, "rgba(10,4,20,.6)");
  ctx.fillStyle = night; ctx.fillRect(cx - pr, cy - pr, pr * 2, pr * 2);
  // Shadow of the rings across the planet.
  ctx.translate(cx, cy); ctx.rotate(tilt);
  ctx.fillStyle = "rgba(40,18,10,.35)"; ctx.beginPath(); ctx.ellipse(0, 3.5, rx * 0.9, 2.6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = "rgba(255,236,200,.85)"; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.arc(cx, cy, pr - 0.6, Math.PI * 0.95, Math.PI * 1.6); ctx.stroke();
  // Front half of the rings over the planet.
  rings(0, Math.PI);
  // Glass: a soft reflection across the window.
  const glass = ctx.createLinearGradient(cx - R0, cy - R0, cx + R0 * 0.2, cy + R0 * 0.2);
  glass.addColorStop(0, "rgba(255,255,255,.22)"); glass.addColorStop(0.45, "rgba(255,255,255,.04)"); glass.addColorStop(0.5, "rgba(255,255,255,0)");
  ctx.fillStyle = glass; ctx.beginPath(); ctx.arc(cx, cy, R0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = rgba(GOLD, 0.6); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, R0 + 7.5, 0, Math.PI * 2); ctx.stroke();
}

// ---------- static art (cached) ----------
let artCache: { key: string; canvas: HTMLCanvasElement } | null = null;

function drawStaticArt(ctx: CanvasRenderingContext2D) {
  ctx.save();
  tableOutline(ctx);
  ctx.clip();
  // Floor: deep indigo-blue, lighter toward the middle.
  const floor = ctx.createLinearGradient(0, 40, 0, 640);
  floor.addColorStop(0, "#0b0626"); floor.addColorStop(0.5, "#070b2a"); floor.addColorStop(1, "#03040f");
  ctx.fillStyle = floor; ctx.fillRect(0, 0, W, H);
  // Nebula clouds (soft, few colours).
  for (const [x, y, r, c, a] of [
    [196, Y(190), 140, [130, 40, 255], 0.42], [70, 330, 120, [0, 160, 255], 0.3], [320, 330, 120, [255, 30, 150], 0.28],
    [195, 476, 110, [255, 170, 40], 0.16], [196, Y(60), 120, [0, 220, 200], 0.14],
  ] as const) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(c, a)); g.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  // Spiral galaxy behind the bumper nest.
  ctx.save();
  ctx.translate(197, Y(190)); ctx.rotate(-0.3); ctx.scale(1, 0.62);
  for (let arm = 0; arm < 2; arm++) {
    for (let i = 0; i < 70; i++) {
      const a = i * 0.11 + arm * Math.PI, rr = 6 + i * 1.6;
      ctx.fillStyle = `rgba(210,190,255,${0.22 - i * 0.0026})`;
      ctx.beginPath(); ctx.arc(Math.cos(a) * rr, Math.sin(a) * rr, 2.6 - i * 0.025, 0, Math.PI * 2); ctx.fill();
    }
  }
  const core = ctx.createRadialGradient(0, 0, 0, 0, 0, 30);
  core.addColorStop(0, "rgba(255,240,220,.38)"); core.addColorStop(1, "rgba(255,240,220,0)");
  ctx.fillStyle = core; ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // Printed stars (fixed pattern, no RNG).
  for (let i = 0; i < 110; i++) {
    const x = 20 + ((i * 137) % 350), y = 16 + ((i * 251) % 620);
    ctx.globalAlpha = 0.18 + (i % 5) * 0.1;
    ctx.fillStyle = i % 7 === 0 ? "#ffe9a6" : "#cfe6ff";
    ctx.fillRect(x, y, i % 9 === 0 ? 2 : 1, i % 9 === 0 ? 2 : 1);
  }
  ctx.globalAlpha = 1;

  // ROUTES FIRST — orbit tracks along the walls and round the top arch (painted bands with a dashed centre line).
  for (const tube of [0, 1]) {
    const pts = pathOf(tube), c = TUBE_ROUTE[tube];
    const z = PINBALL_ORBIT_ZONES_V14[tube];
    const start = { x: k(z.x0 + z.x1) / 2, y: 430 };
    const track = [start, ...pts];
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    smooth(ctx, track); ctx.strokeStyle = rgba(c, 0.1); ctx.lineWidth = 30; ctx.stroke();
    for (const off of [-13, 13]) { smooth(ctx, offsetPath(track, off)); ctx.strokeStyle = rgba(c, 0.38); ctx.lineWidth = 1.4; ctx.stroke(); }
    ctx.setLineDash([2, 9]); smooth(ctx, track); ctx.strokeStyle = rgba(c, 0.32); ctx.lineWidth = 1.4; ctx.stroke(); ctx.setLineDash([]);
  }
  // Shot lanes from the flippers to each mouth: a faint band and three arrow inserts (lit per frame).
  for (const l of SHOT_LANES) {
    const [fx, fy] = l.from, [tx2, ty] = l.to;
    const g = ctx.createLinearGradient(fx, fy, tx2, ty);
    g.addColorStop(0, rgba(l.color, 0)); g.addColorStop(1, rgba(l.color, 0.22));
    ctx.strokeStyle = g; ctx.lineWidth = 22; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(fx, fy); ctx.quadraticCurveTo(l.via[0], l.via[1], tx2, ty); ctx.stroke();
    for (const off of [-11, 11]) {
      ctx.strokeStyle = rgba(l.color, 0.28); ctx.lineWidth = 1;
      ctx.beginPath();
      for (let q = 0; q <= 20; q++) { const p = laneAt(l, q / 20), nx = -Math.sin(p.ang), ny = Math.cos(p.ang); if (q) ctx.lineTo(p.x + nx * off, p.y + ny * off); else ctx.moveTo(p.x + nx * off, p.y + ny * off); }
      ctx.stroke();
    }
    for (let n = 0; n < 3; n++) {
      const p = laneAt(l, 0.3 + n * 0.25);
      chevron(ctx, p.x + 1, p.y + 2, p.ang, 9, "rgba(0,0,0,.5)");
      chevron(ctx, p.x, p.y, p.ang, 8.5, rgba(l.color, 0.22));
    }
  }
  // Painted bumper arena: a gold-rimmed triangle under the nest with starburst rays.
  {
    const bs = pinballBumpersV14(0);
    ctx.save();
    ctx.beginPath(); ctx.moveTo(k(bs[0].x) - 34, k(bs[0].y) - 22); ctx.lineTo(k(bs[1].x) + 34, k(bs[1].y) - 22); ctx.lineTo(k(bs[2].x), k(bs[2].y) + 40); ctx.closePath();
    ctx.fillStyle = "rgba(40,10,90,.45)"; ctx.fill();
    ctx.strokeStyle = rgba(GOLD, 0.45); ctx.lineWidth = 1.5; ctx.stroke();
    for (let n = 0; n < 28; n++) {
      const a = (n / 28) * Math.PI * 2, cx = 197, cy = 186;
      ctx.strokeStyle = n % 2 ? "rgba(160,92,255,.16)" : "rgba(0,229,255,.12)"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * 70, cy + Math.sin(a) * 52); ctx.lineTo(cx + Math.cos(a) * 92, cy + Math.sin(a) * 70); ctx.stroke();
    }
    ctx.restore();
  }
  // Side panels below the ramp mouths: painted comets (art only) behind the progress ladders.
  for (const [x, y, dir, c] of [[78, 352, 1, ROUTE.lRamp], [312, 352, -1, ROUTE.rRamp]] as const) {
    const g = ctx.createLinearGradient(x, y, x + dir * 60, y + 46);
    g.addColorStop(0, rgba(c, 0.55)); g.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.quadraticCurveTo(x + dir * 30, y + 6, x + dir * 66, y + 52); ctx.quadraticCurveTo(x + dir * 20, y + 18, x, y + 6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2); ctx.fill();
  }
  // Centre emblem (v162): Saturn in a chrome porthole — a deep-space window with a nebula and stars, the planet with
  // its cloud bands and a terminator, multi-band rings (with their gap) passing behind and in front of it, the
  // planet's shadow on the rings and a warm rim light. Our own art; the live glints are drawn per frame.
  drawSaturnEmblem(ctx, 195, EMBLEM_Y);
  // Shooter lane floor.
  const lane = ctx.createLinearGradient(346, 0, 372, 0);
  lane.addColorStop(0, "#060a1c"); lane.addColorStop(0.5, "#101a3c"); lane.addColorStop(1, "#060a1c");
  ctx.fillStyle = lane; ctx.fillRect(346, Y(150), 26, 620 - Y(150));
  // Apron plates below the guides.
  const apron = ctx.createLinearGradient(0, 470, 0, 640);
  apron.addColorStop(0, "#232c45"); apron.addColorStop(1, "#11172a");
  ctx.fillStyle = apron;
  ctx.beginPath(); ctx.moveTo(18, 468); ctx.lineTo(118, 552); ctx.lineTo(150, 640); ctx.lineTo(18, 640); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(346, 468); ctx.lineTo(272, 552); ctx.lineTo(240, 640); ctx.lineTo(346, 640); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = rgba(GOLD, 0.35); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(30, 600); ctx.lineTo(118, 600); ctx.moveTo(272, 600); ctx.lineTo(334, 600); ctx.stroke();
  ctx.fillStyle = rgba(GOLD, 0.6); ctx.font = "800 8.5px system-ui"; ctx.textAlign = "center";
  ctx.fillText("GALACTIC", 66, 590); ctx.fillText("PINBALL", 300, 590);
  ctx.restore();

  // Chrome rails along every outer wall and guide.
  const outer = PINBALL_WALLS_V14.length - PINBALL_MOUTHS_V14.length * 3 - PINBALL_SCOOP_ROOF_V14.length;
  for (const w of PINBALL_WALLS_V14.slice(0, outer)) chromeLine(ctx, k(w.ax), k(w.ay), k(w.bx), k(w.by), 6);
  // Cabinet side rails.
  for (const x of [8, 382]) {
    const rail = ctx.createLinearGradient(x - 8, 0, x + 8, 0);
    rail.addColorStop(0, "#161d2b"); rail.addColorStop(0.5, "#8996aa"); rail.addColorStop(1, "#161d2b");
    ctx.fillStyle = rail; ctx.fillRect(x - 6, Y(120), 12, 620 - Y(120));
  }
  // Shadows under the round things.
  for (const p of [...PINBALL_SLINGS_V14, ...PINBALL_POSTS_V14]) {
    ctx.fillStyle = "rgba(0,0,0,.45)";
    ctx.beginPath(); ctx.arc(k(p.x) + 1.5, k(p.y) + 2.5, k(p.r) + 3, 0, Math.PI * 2); ctx.fill();
  }
  for (const p of pinballBumpersV14(0)) {
    ctx.fillStyle = "rgba(0,0,0,.5)";
    ctx.beginPath(); ctx.arc(k(p.x) + 3, k(p.y) + 5, k(p.r) + 5, 0, Math.PI * 2); ctx.fill();
  }
  // Post values.
  ctx.font = "800 7.5px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (const p of PINBALL_POSTS_V14) {
    const top = k(p.y) < 120, x = k(p.x), y = k(p.y) + (top ? -11 : k(p.r) + 9);
    ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.beginPath(); ctx.roundRect(x - 9, y - 5.5, 18, 11, 5.5); ctx.fill();
    ctx.fillStyle = rgba(GOLD, 0.95); ctx.fillText(String(p.points), x, y + 0.5);
  }
  ctx.textBaseline = "alphabetic";
}

function staticArt(ctx: CanvasRenderingContext2D) {
  const scale = Math.max(1, Math.min(3, Math.abs(ctx.getTransform().a) || 1));
  const key = scale.toFixed(2);
  if (!artCache || artCache.key !== key) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(W * scale); canvas.height = Math.round(H * scale);
    const c = canvas.getContext("2d");
    if (c) { c.scale(scale, scale); drawStaticArt(c); }
    artCache = { key, canvas };
  }
  return artCache.canvas;
}

// ---------- dynamic pieces ----------
function lamp(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, on: boolean, glow = 10) {
  ctx.fillStyle = on ? color : "rgba(255,255,255,.07)";
  ctx.strokeStyle = on ? "rgba(255,255,255,.7)" : "rgba(255,255,255,.16)";
  ctx.lineWidth = 1.1;
  if (on) { ctx.shadowColor = color; ctx.shadowBlur = glow; }
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;
}

function flipper(ctx: CanvasRenderingContext2D, s: PinballStateV14, side: "left" | "right" | "upper") {
  const angle = side === "left" ? s.left : s.right,
    held = side === "left" ? s.leftHeld : s.rightHeld,
    tip = side === "upper" ? pinballUpperTipV14(angle) : pinballFlipperTipV14(side, angle);
  const thick = side === "upper" ? 7.5 : 9;
  const px = k(tip.pivot.x), py = k(tip.pivot.y), tx2 = k(tip.x), ty = k(tip.y);
  const len = Math.hypot(tx2 - px, ty - py) || 1, nx = -(ty - py) / len, ny = (tx2 - px) / len;
  const bat = (ox: number, oy: number) => {
    ctx.beginPath();
    ctx.moveTo(px + nx * thick + ox, py + ny * thick + oy);
    ctx.lineTo(tx2 + nx * 5 + ox, ty + ny * 5 + oy);
    ctx.arc(tx2 + ox, ty + oy, 5, Math.atan2(ny, nx), Math.atan2(-ny, -nx));
    ctx.lineTo(px - nx * thick + ox, py - ny * thick + oy);
    ctx.arc(px + ox, py + oy, thick, Math.atan2(-ny, -nx), Math.atan2(ny, nx));
    ctx.closePath();
  };
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,.45)"; bat(2, 4); ctx.fill();
  const g = ctx.createLinearGradient(px, py - 9, px, py + 9);
  g.addColorStop(0, "#ffffff"); g.addColorStop(1, "#cbd5e2");
  ctx.fillStyle = g;
  if (held) { ctx.shadowColor = rgba(GOLD, 1); ctx.shadowBlur = 14; }
  bat(0, 0); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = side === "upper" ? "#c64d97" : held ? "#e9a23a" : "#b8323f";
  ctx.lineWidth = 3; bat(0, 0); ctx.stroke();
  ctx.fillStyle = "#9aa9b8"; ctx.beginPath(); ctx.arc(px, py, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawBall(ctx: CanvasRenderingContext2D, b: { x: number; y: number; vx: number; vy: number }, scale = 1) {
  const x = k(b.x), y = k(b.y);
  const sp = Math.hypot(b.vx, b.vy);
  if (scale < 1) { ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale); ctx.translate(-x, -y); ctx.globalAlpha = Math.max(0.2, scale); }
  if (sp > 260000 && scale === 1) {
    const ux = b.vx / sp, uy = b.vy / sp;
    for (let i = 1; i <= 3; i++) {
      ctx.fillStyle = `rgba(200,225,255,${0.14 - i * 0.035})`;
      ctx.beginPath(); ctx.arc(x - ux * i * 7, y - uy * i * 7, 9 - i, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.fillStyle = "rgba(0,0,0,.4)";
  ctx.beginPath(); ctx.ellipse(x + 3, y + 5, 9, 7, 0, 0, Math.PI * 2); ctx.fill();
  const g = ctx.createRadialGradient(x - 3, y - 4, 1, x, y, 10);
  g.addColorStop(0, "#ffffff"); g.addColorStop(0.35, "#e2e9f1"); g.addColorStop(0.75, "#8395a9"); g.addColorStop(1, "#3b4a5c");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(233,194,122,.35)";
  ctx.beginPath(); ctx.ellipse(x + 3, y + 4, 3.5, 1.6, -0.6, 0, Math.PI * 2); ctx.fill();
  if (scale < 1) ctx.restore();
}

const CALLOUT_KEYS = {
  SKILL: ["pinball.skill", "#ffe082"], JACKPOT: ["pinball.jackpot", "#ffd27a"], DROPS: ["pinball.drops", "#ffb36a"],
  LANES: ["", "#9fffb8"], TARGETS: ["pinball.targets", "#9fffb8"], RAMP: ["pinball.ramp", "#d2b8ff"], ORBIT: ["pinball.orbit", "#8fe8f2"],
  SAUCERLIT: ["pinball.saucer", "#ffe082"], COMBO: ["pinball.combo", "#ffb36a"], DRAIN: ["pinball.drain", "#ff8a8a"], BONUS: ["pinball.bonus", "#ffe082"],
  FLICK: ["pinball.flick", "#d5f3ff"],
  MISSION: ["pinball.mission", "#9fffb8"], EXTRATIME: ["pinball.extraTime", "#7cffd8"], HURRY: ["pinball.hurry", "#ffd36a"],
  HURRYGO: ["pinball.hurryGo", "#ffe082"], SAVED: ["pinball.saved", "#8fe3ff"], FRENZY: ["pinball.frenzy", "#ff8fd0"],
  RAIL: ["pinball.rail", "#d2b8ff"], WORMHOLE: ["pinball.wormhole", "#ffd36a"],
  LOCKLIT: ["pinball.lockLit", "#7cffd8"], LOCK: ["pinball.lock", "#7cffd8"], MULTIBALL: ["pinball.multiball", "#ff8fd0"],
  SUPERLIT: ["pinball.superLit", "#ffd36a"], SUPER: ["pinball.super", "#ffe082"], MBEND: ["pinball.mbEnd", "#ffb03a"],
  RUSH: ["pinball.rush", "#ff9dff"], MODE0: ["pinball.mode0", "#ff9dff"], MODE1: ["pinball.mode1", "#ff9dff"],
  MODE2: ["pinball.mode2", "#ff9dff"], MODEEND: ["pinball.modeEnd", "#ffb03a"],
  INLANES: ["pinball.inlanes", "#5cf0d8"],
} as const;
const MODE_KEYS = ["pinball.mode0", "pinball.mode1", "pinball.mode2"] as const;
const CALLOUTS = new Proxy({} as Record<string, [string, string] | undefined>, {
  get(_, kind: string) {
    const entry = (CALLOUT_KEYS as Record<string, readonly [string, string]>)[kind];
    if (!entry) return undefined;
    return [entry[0] ? tx(entry[0] as MessageKey) : "A-B-C", entry[1]];
  },
});
const BIG = new Set(["SKILL", "JACKPOT", "DROPS", "BONUS", "DRAIN", "MISSION", "EXTRATIME", "HURRYGO", "SAVED", "FRENZY", "WORMHOLE", "MULTIBALL", "SUPER", "LOCK", "MODE0", "MODE1", "MODE2", "INLANES"]);
/** Rows reserved above the table for the shared scoreboard (presentation only). */
const SCORE_INSET = 30; // v162: the taller V14 table sits right under the scoreboard

/** Points every `step` px along a passage, with the normal (cached per tube). */
const railSamples = new Map<number, { x: number; y: number; nx: number; ny: number; tx: number; ty: number; d: number }[]>();
function samplesFor(tube: number, step = 5) {
  const hit = railSamples.get(tube);
  if (hit) return hit;
  const total = pinballTubeLengthV14(tube), out: { x: number; y: number; nx: number; ny: number; tx: number; ty: number; d: number }[] = [];
  for (let d = 0; d <= total; d += step * 1000) {
    const a = pinballTubePointV14(tube, Math.max(0, d - 3000)), b = pinballTubePointV14(tube, Math.min(total, d + 3000)), p = pinballTubePointV14(tube, d);
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    out.push({ x: k(p.x), y: k(p.y), tx: dx / len, ty: dy / len, nx: -dy / len, ny: dx / len, d: d / total });
  }
  railSamples.set(tube, out);
  return out;
}
/** Fraction of the path where the plastic part of a ramp ends: its apex (the highest point of the loop). */
const apexCache = new Map<number, number>();
const apexD = (tube: number) => {
  const hit = apexCache.get(tube);
  if (hit !== undefined) return hit;
  const path = PINBALL_TUBES_V14[tube].path;
  let top = 0;
  path.forEach((p, i) => { if (p.y < path[top].y) top = i; });
  let d = 0;
  for (let i = 1; i <= top; i++) d += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
  const f = d / pinballTubeLengthV14(tube);
  apexCache.set(tube, f);
  return f;
};

/** Ramp mouth on the floor: chrome U-guides and a lit entry flap in the ramp's colour. */
function mouthArt(ctx: CanvasRenderingContext2D, side: number, t: number, lit: number) {
  const m = PINBALL_MOUTHS_V14[side], c = side ? ROUTE.rRamp : ROUTE.lRamp;
  const cx = k(m.x), cy = k(m.y), ux = m.ux / 1000, uy = m.uy / 1000, nx = -uy, ny = ux, hw = k(m.hw), dp = k(m.depth);
  // Floor of the mouth (dark, glowing into the ramp).
  const g = ctx.createLinearGradient(cx, cy, cx + ux * dp, cy + uy * dp);
  g.addColorStop(0, rgba(c, 0.12 + 0.25 * lit)); g.addColorStop(1, "rgba(5,6,16,.9)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(cx + nx * hw, cy + ny * hw); ctx.lineTo(cx + nx * hw + ux * dp, cy + ny * hw + uy * dp);
  ctx.lineTo(cx - nx * hw + ux * dp, cy - ny * hw + uy * dp); ctx.lineTo(cx - nx * hw, cy - ny * hw);
  ctx.closePath(); ctx.fill();
  // Chrome U.
  chromeLine(ctx, cx + nx * hw, cy + ny * hw, cx + nx * hw + ux * dp, cy + ny * hw + uy * dp, 5);
  chromeLine(ctx, cx - nx * hw, cy - ny * hw, cx - nx * hw + ux * dp, cy - ny * hw + uy * dp, 5);
  chromeLine(ctx, cx + nx * hw + ux * dp, cy + ny * hw + uy * dp, cx - nx * hw + ux * dp, cy - ny * hw + uy * dp, 5);
  // Entry flap: a lit strip across the opening.
  ctx.strokeStyle = rgba(c, 0.55 + 0.4 * lit * breathe(t, side)); ctx.lineWidth = 3; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(cx + nx * (hw - 3), cy + ny * (hw - 3)); ctx.lineTo(cx - nx * (hw - 3), cy - ny * (hw - 3)); ctx.stroke();
}

/** A ramp: clear tinted plastic going up (shadow, body, ribs, rims), chrome wire coming back down to the inlane. The
 * ball riding it is drawn inside the plastic (under the top sheen) or on the wires. */
function rampArt(ctx: CanvasRenderingContext2D, tube: number, lit: number, part: "shadow" | "body") {
  const c = TUBE_ROUTE[tube], pts = samplesFor(tube), apex = apexD(tube);
  const plastic = pts.filter((p) => p.d <= apex + 0.01), wire = pts.filter((p) => p.d >= apex - 0.01);
  const poly = (list: readonly Pt[], off: number, dx = 0, dy = 0) => {
    ctx.beginPath();
    list.forEach((p, i) => {
      const q = p as (typeof pts)[number];
      const x = p.x + q.nx * off + dx, y = p.y + q.ny * off + dy;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    });
  };
  ctx.save();
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  if (part === "shadow") {
    // Shadow on the floor (the ramp is raised).
    poly(plastic, 0, 6, 9); ctx.strokeStyle = "rgba(0,0,0,.32)"; ctx.lineWidth = 22; ctx.stroke();
    poly(wire, 0, 4, 6); ctx.strokeStyle = "rgba(0,0,0,.28)"; ctx.lineWidth = 12; ctx.stroke();
    ctx.restore();
    return;
  }
  // Plastic body: tinted, brighter while lit.
  poly(plastic, 0); ctx.strokeStyle = rgba(c, 0.16 + 0.14 * lit); ctx.lineWidth = 21; ctx.stroke();
  // Ribs across the plastic.
  for (let i = 3; i < plastic.length - 1; i += 5) {
    const p = plastic[i];
    ctx.strokeStyle = rgba([255, 255, 255], 0.13); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(p.x + p.nx * 10, p.y + p.ny * 10); ctx.lineTo(p.x - p.nx * 10, p.y - p.ny * 10); ctx.stroke();
  }
  // Direction arrows inside the plastic (steady; brighter while lit).
  for (let i = 8; i < plastic.length - 4; i += 12) {
    const p = plastic[i];
    chevron(ctx, p.x, p.y, Math.atan2(p.ty, p.tx), 4.5, rgba(c, 0.35 + 0.5 * lit));
  }
  // Rims of the plastic (white edge with a tinted inner line) and the top sheen.
  for (const off of [-10, 10]) {
    poly(plastic, off); ctx.strokeStyle = "rgba(235,242,255,.85)"; ctx.lineWidth = 1.6; ctx.stroke();
    poly(plastic, off * 0.82); ctx.strokeStyle = rgba(c, 0.55); ctx.lineWidth = 1; ctx.stroke();
  }
  poly(plastic, -4); ctx.strokeStyle = "rgba(255,255,255,.12)"; ctx.lineWidth = 3; ctx.stroke();
  // Wire return: two chrome wires with clamps.
  for (const off of [-4.5, 4.5]) {
    poly(wire, off); ctx.strokeStyle = "#4b586b"; ctx.lineWidth = 2.6; ctx.stroke();
    poly(wire, off); ctx.strokeStyle = "#eef3fa"; ctx.lineWidth = 1.1; ctx.stroke();
  }
  for (let i = 6; i < wire.length - 2; i += 9) {
    const p = wire[i];
    ctx.strokeStyle = "#2c3644"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(p.x + p.nx * 7, p.y + p.ny * 7); ctx.lineTo(p.x - p.nx * 7, p.y - p.ny * 7); ctx.stroke();
    ctx.strokeStyle = rgba(c, 0.5 + 0.4 * lit); ctx.lineWidth = 1.2; ctx.stroke();
  }
  ctx.restore();
}

/** Each ramp is painted once per scale into small sprites (its bounding box): the shadow, the body unlit and lit. */
type RampLayer = { x: number; y: number; w: number; h: number; c: HTMLCanvasElement };
const rampLayers = new Map<string, RampLayer | null>();
function rampLayer(ctx: CanvasRenderingContext2D, tube: number, kind: "shadow" | "dim" | "lit"): RampLayer | null {
  if (typeof document === "undefined" || typeof ctx.getTransform !== "function") return null;
  const scale = Math.max(1, Math.min(3, Math.abs(ctx.getTransform().a) || 1));
  const key = `${tube}:${kind}:${scale.toFixed(2)}`;
  if (rampLayers.has(key)) return rampLayers.get(key) ?? null;
  const pts = samplesFor(tube), pad = 24;
  const x = Math.floor(Math.min(...pts.map((p) => p.x)) - pad), y = Math.floor(Math.min(...pts.map((p) => p.y)) - pad);
  const w = Math.ceil(Math.max(...pts.map((p) => p.x)) + pad) - x, h = Math.ceil(Math.max(...pts.map((p) => p.y)) + pad) - y;
  const c = document.createElement("canvas");
  c.width = Math.ceil(w * scale); c.height = Math.ceil(h * scale);
  const g = c.getContext("2d");
  if (!g) { rampLayers.set(key, null); return null; }
  g.scale(scale, scale); g.translate(-x, -y);
  rampArt(g, tube, kind === "lit" ? 1 : 0.15, kind === "shadow" ? "shadow" : "body");
  const layer = { x, y, w, h, c };
  rampLayers.set(key, layer);
  return layer;
}
function drawRamp(ctx: CanvasRenderingContext2D, tube: number, lit: number, kind: "shadow" | "body") {
  if (kind === "shadow") {
    const sh = rampLayer(ctx, tube, "shadow");
    if (sh) ctx.drawImage(sh.c, sh.x, sh.y, sh.w, sh.h); else rampArt(ctx, tube, lit, "shadow");
    return;
  }
  const dim = rampLayer(ctx, tube, "dim"), hot = rampLayer(ctx, tube, "lit");
  if (!dim || !hot) { rampArt(ctx, tube, lit, "body"); return; }
  ctx.drawImage(dim.c, dim.x, dim.y, dim.w, dim.h);
  if (lit > 0.18) { ctx.globalAlpha = Math.min(1, (lit - 0.15) / 0.85); ctx.drawImage(hot.c, hot.x, hot.y, hot.w, hot.h); ctx.globalAlpha = 1; }
}

/** Centre scoop (the wormhole) under its roof: a gold vortex, brighter when it is open or the super jackpot is lit. */
function scoopArt(ctx: CanvasRenderingContext2D, s: PinballStateV14, t: number) {
  const x = k(PINBALL_WORMHOLE_V14.x), y = k(PINBALL_WORMHOLE_V14.y), r = k(PINBALL_WORMHOLE_V14.r) + 4;
  const open = s.drops.some(Boolean), hot = s.superLit > 0 || s.tube === 2;
  const g = ctx.createRadialGradient(x, y, 1, x, y, r + 8);
  g.addColorStop(0, "#000"); g.addColorStop(0.6, "#2b1a05"); g.addColorStop(1, rgba(ROUTE.scoop, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r + 8, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.translate(x, y); ctx.rotate(t * (hot ? 0.12 : 0.025));
  for (let arm = 0; arm < 3; arm++) {
    ctx.rotate((Math.PI * 2) / 3);
    ctx.strokeStyle = rgba(ROUTE.scoop, hot ? 0.95 : open ? 0.7 : 0.4); ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (let q = 0; q <= 18; q++) { const a = q * 0.2, rr = 1.5 + q * (r / 18); if (q) ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else ctx.moveTo(0, 0); }
    ctx.stroke();
  }
  ctx.restore();
  // The roof: a chrome chevron over the scoop.
  for (const w of PINBALL_SCOOP_ROOF_V14) chromeLine(ctx, k(w.ax), k(w.ay), k(w.bx), k(w.by), 5);
  lamp(ctx, 195, 279, 3.2, rgba(ROUTE.scoop, 1), hot || (open && breathe(t) > 0.5), 10);
}

/** Lit level of each route (0…1) this frame: just used, feature lit, or an open combo. */
function routeLight(s: PinballStateV14, t: number) {
  const comboOpen = s.combo > 0 && t - s.lastShotTick < R.comboWindowTicks;
  const recent = (tick: number) => Math.max(0, 1 - (t - tick) / 90);
  const feature = s.hurry > 0 || s.multiball > 0 || s.mode === 2;
  const pulse = breathe(t);
  return {
    lRamp: Math.max(recent(s.rampTicks[0]), feature || comboOpen ? 0.4 + 0.6 * pulse : 0.15),
    rRamp: Math.max(recent(s.rampTicks[1]), feature || comboOpen ? 0.4 + 0.6 * breathe(t, 1.6) : 0.15),
    lOrbit: Math.max(recent(s.orbitTicks[0]), feature || comboOpen ? 0.4 + 0.6 * breathe(t, 0.8) : 0.12),
    rOrbit: Math.max(recent(s.orbitTicks[1]), feature || comboOpen ? 0.4 + 0.6 * breathe(t, 2.4) : 0.12),
    scoop: Math.max(s.tube === 2 ? 1 : 0, s.superLit > 0 ? 0.5 + 0.5 * pulse : s.drops.some(Boolean) ? 0.35 + 0.4 * pulse : 0.12),
  };
}

export function renderPinball(ctx: CanvasRenderingContext2D, s: PinballStateV14) {
  drawSpaceBackdrop(ctx, W, H, s.tick * 0.02, s.tick);
  ctx.drawImage(staticArt(ctx), 0, 0, W, H);
  const t = s.tick, idle = s.phase !== "play";
  const light = routeLight(s, t);

  // Shot-lane arrow inserts (lit by their route).
  const laneLit = [light.lRamp, light.rRamp, light.scoop, light.lOrbit, light.rOrbit];
  SHOT_LANES.forEach((l, i) => {
    const on = laneLit[i];
    for (let n = 0; n < 3; n++) {
      const p = laneAt(l, 0.3 + n * 0.25);
      // The arrows nearer the shot light up first as the route warms up.
      const a = Math.max(0, Math.min(1, on * 1.4 - (2 - n) * 0.2));
      if (a > 0.05) chevron(ctx, p.x, p.y, p.ang, 8.5, rgba(l.color, 0.25 + 0.75 * a), a > 0.6 ? rgba(l.color, 1) : undefined);
    }
  });
  // Orbit tracks glow while their route is lit.
  for (const tube of [0, 1]) {
    const on = tube ? light.rOrbit : light.lOrbit;
    if (on < 0.2) continue;
    const z = PINBALL_ORBIT_ZONES_V14[tube];
    const track = [{ x: k(z.x0 + z.x1) / 2, y: 430 }, ...pathOf(tube)];
    ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round";
    smooth(ctx, track); ctx.strokeStyle = rgba(TUBE_ROUTE[tube], 0.16 * on); ctx.lineWidth = 26; ctx.stroke();
    ctx.restore();
  }

  // Time bar along the top arch.
  {
    const left = Math.max(0, (s.endTick - t) / s.endTick);
    ctx.strokeStyle = "rgba(255,255,255,.08)"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(112, Y(47)); ctx.lineTo(288, Y(47)); ctx.stroke();
    ctx.strokeStyle = left > 0.25 ? "#5ad8b8" : "#ff6a7a";
    ctx.beginPath(); ctx.moveTo(112, Y(47)); ctx.lineTo(112 + 176 * left, Y(47)); ctx.stroke();
  }
  // Rollover lanes A-B-C (the skill-shot lane breathes gold).
  const skillOpen = s.launchTick >= 0 && !s.skillDone && t - s.launchTick <= R.skillWindowTicks;
  PINBALL_LANES_V14.forEach((l, i) => {
    const nextSkill = s.phase === "lane" && !s.skillDone && s.launches % 3 === i;
    const skill = (skillOpen && s.skillLane === i) || nextSkill;
    const on = s.lanes[i] > 0 || (skill && breathe(t) > 0.4);
    lamp(ctx, k(l.x), k(l.y), 8, skill ? "#ffd36a" : "#8ef0c4", on);
    ctx.fillStyle = on ? "#0b2414" : "rgba(255,255,255,.6)";
    ctx.font = "900 9px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(LANE_LETTERS[i], k(l.x), k(l.y) + 0.5);
    ctx.textBaseline = "alphabetic";
  });
  // Top spinner.
  {
    const sp = PINBALL_SPINNER_V14, cx = k(sp.x0 + sp.x1) / 2, cy = k(sp.y0 + sp.y1) / 2, a = s.spins * 1.1;
    ctx.strokeStyle = "rgba(200,220,255,.35)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - 24, cy - 9); ctx.lineTo(cx + 24, cy - 9); ctx.stroke();
    const w = 22 * Math.abs(Math.cos(a)), hgt = 5 + 5 * Math.abs(Math.sin(a));
    const g = ctx.createLinearGradient(cx - w, 0, cx + w, 0);
    g.addColorStop(0, "#7c8ea3"); g.addColorStop(0.5, "#f2f7fc"); g.addColorStop(1, "#7c8ea3");
    ctx.fillStyle = g; ctx.fillRect(cx - w, cy - hgt / 2, w * 2, hgt);
    ctx.fillStyle = rgba(GOLD, 0.9); if (w > 6) ctx.fillRect(cx - w * 0.6, cy - 1, w * 1.2, 2);
  }
  // Left spinner at the mouth of the left orbit.
  {
    const sp = PINBALL_LSPINNER_V14, cx = k(sp.x0 + sp.x1) / 2, cy = k(sp.y0 + sp.y1) / 2, a = s.lSpins * 1.1;
    const w = 14 * Math.abs(Math.cos(a)), hgt = 4 + 4 * Math.abs(Math.sin(a));
    const g = ctx.createLinearGradient(cx - w, 0, cx + w, 0);
    g.addColorStop(0, "#5f7387"); g.addColorStop(0.5, "#f2f7fc"); g.addColorStop(1, "#5f7387");
    ctx.fillStyle = g; ctx.fillRect(cx - w, cy - hgt / 2, w * 2, hgt);
    ctx.fillStyle = rgba(ROUTE.lOrbit, 0.9); if (w > 5) ctx.fillRect(cx - w * 0.6, cy - 1, w * 1.2, 2);
  }
  // Inlane rollovers.
  PINBALL_INLANES_V14.forEach((l, i) => {
    const x = k(l.x), y = k(l.y), on = s.inlanes[i] > 0, flash = t - s.inlaneFlash[i] < 16;
    ctx.fillStyle = "rgba(0,0,0,.5)"; ctx.beginPath(); ctx.roundRect(x - 9, y - 5, 18, 10, 5); ctx.fill();
    ctx.fillStyle = on || flash ? "#5cf0d8" : "rgba(255,255,255,.12)";
    if (on) { ctx.shadowColor = "#5cf0d8"; ctx.shadowBlur = 8; }
    ctx.beginPath(); ctx.roundRect(x - 7, y - 3, 14, 6, 3); ctx.fill(); ctx.shadowBlur = 0;
  });
  // Saucer (lock / jackpot) with its ring lamps and the two lock lamps.
  {
    const c = PINBALL_SAUCER_V14, cx = k(c.x), cy = k(c.y), hot = s.saucerLit > 0 || s.lockLit > 0;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      lamp(ctx, cx + Math.cos(a) * 21, cy + Math.sin(a) * 21, 2.4, s.lockLit ? "#7cffd8" : "#ffd36a", hot && breathe(t, i * 0.4) > 0.35, 6);
    }
    const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, 15);
    g.addColorStop(0, "#000"); g.addColorStop(0.7, "#141a2c"); g.addColorStop(1, "#5f7387");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = s.lockLit ? "#7cffd8" : s.saucerLit ? "#ffe082" : "#9aa9b8"; ctx.lineWidth = 2; ctx.stroke();
    for (let i = 0; i < 2; i++) lamp(ctx, cx - 7 + i * 14, cy - 27, 3.2, "#7cffd8", s.locks > i, 8);
  }
  // Stand-up targets.
  PINBALL_TARGETS_V14.forEach((tg, i) => {
    const hit = s.targets[i] > 0, ax = k(tg.ax), ay = k(tg.ay), by = k(tg.by);
    ctx.fillStyle = hit ? "#ffd36a" : "#d23b55"; ctx.fillRect(ax - 1, ay, 7, by - ay);
    ctx.fillStyle = "rgba(255,255,255,.45)"; ctx.fillRect(ax + 4, ay + 2, 1.5, by - ay - 4);
    lamp(ctx, ax + 18, (ay + by) / 2, 3.6, "#ffd36a", hit);
  });
  PINBALL_RTARGETS_V14.forEach((tg, i) => {
    const hit = s.rTargets[i] > 0, ax = k(tg.ax), ay = k(tg.ay), by = k(tg.by);
    ctx.fillStyle = hit ? "#7cffd8" : "#3f6fe0"; ctx.fillRect(ax - 6, ay, 7, by - ay);
    ctx.fillStyle = "rgba(255,255,255,.45)"; ctx.fillRect(ax - 5, ay + 2, 1.5, by - ay - 4);
    lamp(ctx, ax - 18, (ay + by) / 2, 3.6, "#7cffd8", hit);
  });
  // Centre scoop under its roof, then the drop bank in front of it.
  scoopArt(ctx, s, t);
  PINBALL_DROPS_V14.forEach((w, i) => {
    const ax = k(w.ax), ay = k(w.ay), bx = k(w.bx), by = k(w.by), age = t - s.dropFlash[i], down = s.drops[i] > 0;
    ctx.lineCap = "butt";
    if (down) {
      ctx.strokeStyle = "rgba(0,0,0,.6)"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    } else {
      ctx.strokeStyle = "rgba(0,0,0,.5)"; ctx.lineWidth = 10;
      ctx.beginPath(); ctx.moveTo(ax + 2, ay + 4); ctx.lineTo(bx + 2, by + 4); ctx.stroke();
      ctx.strokeStyle = age >= 0 && age < 20 ? "#fff1c4" : "#f0a33c"; ctx.lineWidth = 9;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      ctx.fillStyle = "#3b1d00"; ctx.font = "900 8px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(String(i + 1), (ax + bx) / 2, (ay + by) / 2 + 0.5);
      ctx.textBaseline = "alphabetic";
    }
    lamp(ctx, (ax + bx) / 2, (ay + by) / 2 + 15, 3.6, "#ffc94a", down);
  });
  // Ramp mouths (on the floor) with the next ramp value on a plaque beside each.
  for (const side of [0, 1]) {
    mouthArt(ctx, side, t, side ? light.rRamp : light.lRamp);
    const m = PINBALL_MOUTHS_V14[side], c = side ? ROUTE.rRamp : ROUTE.lRamp;
    const px = k(m.x) + (side ? -24 : 24), py = k(m.y) + 36;
    ctx.fillStyle = "rgba(6,6,18,.82)"; ctx.beginPath(); ctx.roundRect(px - 18, py - 7, 36, 14, 7); ctx.fill();
    ctx.strokeStyle = rgba(c, 0.7); ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = rgba(c, 1); ctx.font = "900 8.5px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(formatNumber(s.rampValue), px, py + 0.5);
    ctx.textBaseline = "alphabetic";
  }
  // Saturn porthole, live (v162): a moon orbiting in front of the rings and a light glint sweeping the chrome bezel.
  {
    const cx = 195, cy = EMBLEM_Y, a = t * 0.012, mx = Math.cos(a) * 34, my = Math.sin(a) * 9;
    if (my > -2) {
      const x = cx + mx * Math.cos(-0.36) - my * Math.sin(-0.36), y = cy + mx * Math.sin(-0.36) + my * Math.cos(-0.36);
      const mg = ctx.createRadialGradient(x - 1, y - 1, 0.3, x, y, 3.4);
      mg.addColorStop(0, "#ffffff"); mg.addColorStop(1, "#8a93a8");
      ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
    }
    const g0 = (t * 0.02) % (Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,.75)"; ctx.lineWidth = 2; ctx.lineCap = "round";
    ctx.beginPath(); ctx.arc(cx, cy, 49, g0, g0 + 0.35); ctx.stroke();
  }
  // Multiplier lamps ×1…×5 in a row above the emblem.
  for (let m = 1; m <= R.maxMultiplier; m++) {
    const x = 195 + (m - 3) * 22, y = EMBLEM_Y - 58, on = s.multiplier >= m;
    lamp(ctx, x, y, 7, "#ffcf4a", on, 8);
    ctx.fillStyle = on ? "#2a1700" : "rgba(255,255,255,.4)";
    ctx.font = "900 7px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(`×${m}`, x, y + 0.5);
    ctx.textBaseline = "alphabetic";
  }
  // Mission inserts (lanes · targets · drops) on the emblem's lower rim.
  {
    const labels = ["ABC", "▮▮", "▼▼"], colors = ["#8ef0c4", "#ff7f95", "#ffb36a"];
    for (let i = 0; i < 3; i++) {
      const x = 157 + i * 38, y = EMBLEM_Y + 58, on = s.mission[i] > 0, near = !on && s.mission.filter(Boolean).length === 2;
      ctx.fillStyle = "rgba(0,0,0,.5)"; ctx.beginPath(); ctx.roundRect(x - 16, y - 8, 32, 16, 8); ctx.fill();
      ctx.fillStyle = on ? colors[i] : near ? `${colors[i]}${Math.round(40 + 80 * breathe(t)).toString(16).padStart(2, "0")}` : "rgba(255,255,255,.1)";
      if (on) { ctx.shadowColor = colors[i]; ctx.shadowBlur = 8; }
      ctx.beginPath(); ctx.roundRect(x - 14, y - 6, 28, 12, 6); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = on ? "#10141f" : "rgba(255,255,255,.55)";
      ctx.font = "900 7px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(labels[i], x, y + 0.5);
      ctx.textBaseline = "alphabetic";
    }
  }

  // V14 middle dividers: a black rubber band round two chrome pins, under a coloured plastic cap; a hit flashes it.
  PINBALL_DIVIDERS_V14.forEach((dv, i) => {
    const ax = k(dv.ax), ay = k(dv.ay), bx = k(dv.bx), by = k(dv.by), r = k(dv.r), age = t - s.dividerFlash[i], hit = age >= 0 && age < 12;
    const c = i ? ROUTE.rRamp : ROUTE.lRamp;
    ctx.save(); ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(0,0,0,.5)"; ctx.lineWidth = 2 * r + 6;
    ctx.beginPath(); ctx.moveTo(ax + 2, ay + 3); ctx.lineTo(bx + 2, by + 3); ctx.stroke();
    ctx.strokeStyle = "#0b0b0f"; ctx.lineWidth = 2 * r + 3;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    const g = ctx.createLinearGradient(ax, ay, bx, by);
    g.addColorStop(0, hit ? "#ffffff" : rgba(c, 1)); g.addColorStop(1, hit ? rgba(c, 1) : rgba(ROUTE.scoop, 1));
    ctx.strokeStyle = g; ctx.lineWidth = 2 * r - 1;
    if (hit) { ctx.shadowColor = rgba(c, 1); ctx.shadowBlur = 14; }
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    ctx.shadowBlur = 0;
    for (const [px, py] of [[ax, ay], [bx, by]]) {
      const pin = ctx.createRadialGradient(px - 1, py - 1, 0.5, px, py, 3.6);
      pin.addColorStop(0, "#ffffff"); pin.addColorStop(1, "#7f93a8");
      ctx.fillStyle = pin; ctx.beginPath(); ctx.arc(px, py, 3.4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.font = "800 7px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const lx = (ax + bx) / 2 + (i ? 14 : -14), ly = (ay + by) / 2;
    ctx.beginPath(); ctx.roundRect(lx - 8, ly - 5.5, 16, 11, 5.5); ctx.fill();
    ctx.fillStyle = rgba(GOLD, 1); ctx.fillText(String(dv.points), lx, ly + 0.5); ctx.textBaseline = "alphabetic";
  });
  // V14 star rollovers down the centre lane (lit once passed; three make a set).
  PINBALL_STARS_V14.forEach((st, i) => {
    const x = k(st.x), y = k(st.y), on = s.stars[i] > 0, age = t - s.starFlash[i], flash = age >= 0 && age < 18;
    ctx.save(); ctx.translate(x, y); ctx.rotate(-Math.PI / 2);
    ctx.beginPath();
    for (let q = 0; q < 10; q++) { const rr = q % 2 ? 3.4 : 8, a = (q / 10) * Math.PI * 2; if (q) ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else ctx.moveTo(rr, 0); }
    ctx.closePath();
    ctx.fillStyle = on || flash ? rgba(ROUTE.scoop, 1) : "rgba(30,20,0,.75)";
    if (on || flash) { ctx.shadowColor = rgba(ROUTE.scoop, 1); ctx.shadowBlur = flash ? 16 : 8; }
    ctx.fill(); ctx.shadowBlur = 0;
    ctx.strokeStyle = rgba(ROUTE.scoop, on ? 1 : 0.7); ctx.lineWidth = 1.2; ctx.stroke();
    ctx.restore();
  });
  // V14 progress ladders beside the emblem: the end bonus (left) and lock → multiball → jackpots (right).
  for (let i = 0; i < 6; i++) {
    lamp(ctx, 110 + i * 8, 414 + i * 6, 3.2, rgba(GOLD, 1), s.bonusCount > i * 2, 8);
    const mb = [s.locks > 0, s.locks > 1 || s.multiball > 0, s.multiball > 0, s.jackpots % 3 > 0 || s.superLit > 0, s.jackpots % 3 > 1 || s.superLit > 0, s.superLit > 0][i];
    lamp(ctx, 280 - i * 8, 414 + i * 6, 3.2, i < 2 ? "#39ff88" : i === 2 ? rgba(ROUTE.rRamp, 1) : rgba(ROUTE.scoop, 1), mb, 8);
  }
  // Pop bumpers: one family (indigo body, gold rim, white cap with the value); a hit flashes them.
  pinballBumpersV14(s.layout).forEach((p, i) => {
    const x = k(p.x), y = k(p.y), r = k(p.r), age = t - s.bumperFlash[i], hit = age >= 0 && age < 12;
    const storm = s.mode === 0, [hi, lo] = BUMPER_TONES[i % BUMPER_TONES.length];
    ctx.fillStyle = "#05060f"; ctx.beginPath(); ctx.arc(x, y, r + 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = hit ? "#ffffff" : rgba(hi, storm ? 0.5 + 0.5 * breathe(t, i) : 0.95); ctx.lineWidth = 2.4; ctx.stroke();
    const body = ctx.createRadialGradient(x - 5, y - 6, 2, x, y, r);
    body.addColorStop(0, hit ? "#ffffff" : rgba(hi, 1)); body.addColorStop(1, rgba(lo, 1));
    ctx.fillStyle = body;
    if (hit) { ctx.shadowColor = rgba(hi, 1); ctx.shadowBlur = 20; }
    ctx.beginPath(); ctx.arc(x, y, r - 1 + (hit ? 1.5 : 0), 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    const cap = ctx.createRadialGradient(x - 3, y - 4, 1, x, y, r * 0.62);
    cap.addColorStop(0, "#ffffff"); cap.addColorStop(1, "#d3dae6");
    ctx.fillStyle = cap; ctx.beginPath(); ctx.arc(x, y, r * 0.58, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = rgba(lo, 1);
    ctx.font = `900 ${r >= 18 ? 10 : 8}px system-ui`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(String(storm ? p.points * R.stormFactor : p.points), x, y + 0.5);
    ctx.textBaseline = "alphabetic";
    if (age >= 0 && age < 16) {
      ctx.strokeStyle = rgba(hi, 0.85 - age / 20); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, r + 4 + age * 1.5, 0, Math.PI * 2); ctx.stroke();
    }
  });
  // Kickers (slings) and rubber posts.
  PINBALL_SLINGS_V14.forEach((p, i) => {
    const x = k(p.x), y = k(p.y), age = t - s.slingFlash[i], hit = age >= 0 && age < 10;
    ctx.fillStyle = "#0b0b0f"; ctx.beginPath(); ctx.arc(x, y, k(p.r) + 2, 0, Math.PI * 2); ctx.fill();
    lamp(ctx, x, y, k(p.r) - 2, "#e9506a", hit, 14);
    ctx.fillStyle = hit ? "#2a0610" : "#ffd6de";
    ctx.font = "900 7px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(String(p.points), x, y + 0.5);
    ctx.textBaseline = "alphabetic";
  });
  PINBALL_POSTS_V14.forEach((p, i) => {
    const x = k(p.x), y = k(p.y), r = k(p.r), age = t - s.postFlash[i], hit = age >= 0 && age < 10;
    ctx.fillStyle = "#0b0b0f"; ctx.beginPath(); ctx.arc(x, y, r + 3, 0, Math.PI * 2); ctx.fill();
    if (hit) { ctx.strokeStyle = rgba(GOLD, 0.95); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, r + 2, 0, Math.PI * 2); ctx.stroke(); }
    const pin = ctx.createRadialGradient(x - r * 0.3, y - r * 0.4, 0.5, x, y, r);
    pin.addColorStop(0, "#ffffff"); pin.addColorStop(1, "#8fa3b8");
    ctx.fillStyle = pin; ctx.beginPath(); ctx.arc(x, y, Math.max(2, r - 1.2), 0, Math.PI * 2); ctx.fill();
  });
  // Ball save lamp and drain lamp between the flippers.
  {
    const left = s.saveUntil - t, on = s.phase === "play" && left > 0 && (left > 180 || breathe(t * 4) > 0.5);
    lamp(ctx, 195, 584, 6, "#8fe3ff", on, 12);
    ctx.fillStyle = on ? "#06202c" : "rgba(255,255,255,.3)";
    ctx.font = "900 5px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("SAVE", 195, 584.5);
    ctx.textBaseline = "alphabetic";
  }
  // Hurry-up value and the running mode (centre plaque over the drop bank's lane).
  if (s.hurry > 0) {
    const frac = (s.hurry - R.hurryFloor) / (R.hurryStart - R.hurryFloor);
    ctx.save();
    ctx.fillStyle = "rgba(20,10,0,.75)"; ctx.beginPath(); ctx.roundRect(135, 344, 120, 28, 14); ctx.fill();
    ctx.fillStyle = "#ffd36a"; ctx.beginPath(); ctx.roundRect(139, 366, 112 * Math.max(0, frac), 3, 1.5); ctx.fill();
    ctx.font = "900 13px ui-monospace, Menlo, monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(tx("pinball.hurryValue", { n: formatNumber(s.hurry) }), 195, 356);
    ctx.restore();
  }
  if (s.mode >= 0) {
    const left = Math.max(0, Math.ceil((s.modeUntil - t) / R.tickRate)), y = s.hurry > 0 ? 376 : 344;
    ctx.save();
    ctx.fillStyle = "rgba(10,0,20,.75)"; ctx.beginPath(); ctx.roundRect(125, y, 140, 28, 14); ctx.fill();
    ctx.fillStyle = "#ff9dff"; ctx.font = "900 12px ui-monospace, Menlo, monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(`${tx(MODE_KEYS[s.mode])} ${left}`, 195, y + 14);
    ctx.restore();
  }
  // Frenzy: a slow pulse round the whole table.
  if (pinballFrenzyV14(s) && s.status === "running") {
    ctx.save(); tableOutline(ctx);
    ctx.strokeStyle = `rgba(255,140,210,${0.35 + 0.4 * breathe(t * 2)})`; ctx.lineWidth = 4; ctx.stroke();
    ctx.restore();
  }

  // Wormhole ride: a dotted gold path underground and the ball shrinking into / out of the scoop.
  if (s.tube === 2) {
    ctx.save(); ctx.setLineDash([3, 6]); ctx.strokeStyle = rgba(ROUTE.scoop, 0.6); ctx.lineWidth = 2.5;
    smooth(ctx, pathOf(2)); ctx.stroke(); ctx.restore();
    const blend = R.tubeBlendMilli, total = pinballTubeLengthV14(2);
    const inside = Math.min(1, s.tubeD / blend, (total - s.tubeD) / blend);
    if (inside < 1) drawBall(ctx, s.ball, Math.max(0.15, 1 - inside));
    else { ctx.save(); ctx.fillStyle = rgba(ROUTE.scoop, 0.9); ctx.shadowColor = rgba(ROUTE.scoop, 1); ctx.shadowBlur = 14; ctx.beginPath(); ctx.arc(k(s.ball.x), k(s.ball.y), 6, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
    const end = PINBALL_TUBES_V14[2].path.at(-1)!;
    const g = ctx.createRadialGradient(k(end.x), k(end.y), 1, k(end.x), k(end.y), 13);
    g.addColorStop(0, "#fff3d0"); g.addColorStop(1, rgba(ROUTE.scoop, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(k(end.x), k(end.y), 13, 0, Math.PI * 2); ctx.fill();
  }

  flipper(ctx, s, "left");
  flipper(ctx, s, "right");
  flipper(ctx, s, "upper");

  // The ball on the floor or riding an orbit (orbits are floor tracks).
  if (s.phase !== "waiting" && (s.tube < 0 || s.tube === 0 || s.tube === 1)) drawBall(ctx, s.ball);
  for (const e of s.extra) drawBall(ctx, e);

  // Ramps over everything on the floor (raised plastic and wires). A ball on the plastic is drawn between the ramp's
  // shadow and its body (inside the tinted plastic); a ball on the wire return is drawn over the wires.
  for (const tube of [3, 4]) {
    const riding = s.tube === tube, onPlastic = riding && s.tubeD / pinballTubeLengthV14(tube) <= apexD(tube);
    const lit = Math.max(riding ? 1 : 0, tube === 3 ? light.lRamp : light.rRamp);
    drawRamp(ctx, tube, lit, "shadow");
    if (onPlastic) { ctx.save(); ctx.shadowColor = rgba(TUBE_ROUTE[tube], 1); ctx.shadowBlur = 12; drawBall(ctx, s.ball); ctx.restore(); }
    drawRamp(ctx, tube, lit, "body");
    if (riding && !onPlastic) { ctx.save(); ctx.shadowColor = rgba(TUBE_ROUTE[tube], 1); ctx.shadowBlur = 10; drawBall(ctx, s.ball); ctx.restore(); }
  }

  // Shooter lane: power lamps and the spring plunger.
  {
    const level = pinballChargeLevelV14(s.charge), charging = s.phase === "lane" && s.chargeHeld;
    for (let i = 0; i < R.maxChargeLevel; i++) {
      const on = charging ? i < level : s.phase === "lane" && i === 0;
      lamp(ctx, 359, 556 - i * 18, 3.2, i >= R.maxChargeLevel - 2 ? "#8ef0c4" : "#ffcf4a", on, 6);
    }
    const pull = charging ? (s.charge / (R.maxChargeLevel * R.chargeStepTicks)) * 16 : 0;
    ctx.strokeStyle = "#9aa9b8"; ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i <= 8; i++) { const y = 590 + pull * 0.3 + i * (2.6 + pull * 0.06); ctx.lineTo(i % 2 ? 365 : 353, y); }
    ctx.stroke();
    ctx.fillStyle = "#c9d6e3"; ctx.fillRect(352, 584 + pull, 14, 5);
    ctx.fillStyle = "#b8323f"; ctx.beginPath(); ctx.roundRect(354, 612 + pull * 0.4, 10, 8, 2); ctx.fill();
  }
  if (idle && s.phase === "lane" && s.launches === 0) {
    // Nothing else animates before the first launch: the table waits calmly.
  }

  // Event bursts, floating points and big call-outs from the deterministic feed.
  for (const ev of s.feed) {
    const age = t - ev.tick;
    if (age < 0 || age > 70) continue;
    const x = Math.max(36, Math.min(340, k(ev.x))), y = k(ev.y);
    if (age < 20 && ev.kind !== "SPINNER" && ev.kind !== "LSPINNER" && ev.kind !== "EJECT" && ev.kind !== "LAUNCH") {
      for (let n = 0; n < 8; n++) {
        const a = (n / 8) * Math.PI * 2 + ev.tick * 0.7, r1 = 4 + age * 1.5;
        ctx.fillStyle = `rgba(255,232,170,${1 - age / 20})`;
        ctx.beginPath(); ctx.arc(x + Math.cos(a) * r1, y + Math.sin(a) * r1, 1.7, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (ev.points > 0 && ev.kind !== "BONUS") {
      ctx.globalAlpha = Math.max(0, 1 - age / 70);
      ctx.fillStyle = "#fff2c0"; ctx.strokeStyle = "rgba(0,0,0,.6)"; ctx.lineWidth = 3;
      ctx.font = "900 13px system-ui"; ctx.textAlign = "center";
      ctx.strokeText(`+${ev.points}`, x, y - 16 - age * 0.4);
      ctx.fillText(`+${ev.points}`, x, y - 16 - age * 0.4);
      ctx.globalAlpha = 1;
    }
    if (BIG.has(ev.kind) && age < 26) {
      ctx.save(); tableOutline(ctx); ctx.clip();
      ctx.fillStyle = ev.kind === "DRAIN" ? `rgba(255,60,80,${0.18 * (1 - age / 26)})` : `rgba(255,220,140,${0.14 * (1 - age / 26)})`;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    const c = CALLOUTS[ev.kind];
    if (c && BIG.has(ev.kind) && age < 70) {
      const grow = Math.min(1, age / 8);
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, age - 40) / 30);
      ctx.fillStyle = c[1]; ctx.shadowColor = c[1]; ctx.shadowBlur = 14;
      ctx.font = `900 ${18 + Math.round(10 * grow)}px system-ui`; ctx.textAlign = "center";
      ctx.fillText(ev.kind === "BONUS" ? tx("pinball.bonusPts", { n: formatNumber(ev.points) }) : c[0], 195, 410 - age * 0.25);
      ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    }
  }
  // The latest small call-out on a plaque above the flippers.
  {
    let call: { text: string; color: string; age: number } | null = null;
    for (const ev of s.feed) {
      const age = t - ev.tick, c = CALLOUTS[ev.kind];
      if (c && !BIG.has(ev.kind) && age >= 0 && age < 80 && (!call || age < call.age)) call = { text: ev.kind === "COMBO" ? tx("play.combo", { n: s.combo + 1 }) : c[0], color: c[1], age };
    }
    if (call) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, call.age - 50) / 30);
      ctx.fillStyle = "rgba(6,8,16,.78)"; ctx.beginPath(); ctx.roundRect(135, 545, 120, 20, 10); ctx.fill();
      ctx.fillStyle = call.color;
      ctx.font = "800 11px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(call.text, 195, 555.5);
      ctx.restore();
    }
  }
  if (s.status === "failed") { ctx.fillStyle = "rgba(216,81,109,.12)"; ctx.fillRect(0, 0, W, H); }
}

function pointAction(point: CorePoint, phase: "down" | "move" | "up", s: PinballStateV14) {
  if (phase === "move" || point.y > 540) return null;
  const left = point.x < 195;
  if (phase === "down") return left ? "FLIP_LEFT_PRESS" : "FLIP_RIGHT_PRESS";
  if (left && s.leftHeld) return "FLIP_LEFT_RELEASE";
  if (!left && s.rightHeld) return "FLIP_RIGHT_RELEASE";
  return null;
}

const keys = {
  ArrowLeft: "FLIP_LEFT_PRESS", z: "FLIP_LEFT_PRESS", Z: "FLIP_LEFT_PRESS",
  ArrowRight: "FLIP_RIGHT_PRESS", x: "FLIP_RIGHT_PRESS", X: "FLIP_RIGHT_PRESS",
  " ": "PLUNGER_HOLD", ArrowDown: "PLUNGER_HOLD",
} as const;
const keyReleases = {
  ArrowLeft: "FLIP_LEFT_RELEASE", z: "FLIP_LEFT_RELEASE", Z: "FLIP_LEFT_RELEASE",
  ArrowRight: "FLIP_RIGHT_RELEASE", x: "FLIP_RIGHT_RELEASE", X: "FLIP_RIGHT_RELEASE",
  " ": "PLUNGER_RELEASE", ArrowDown: "PLUNGER_RELEASE",
} as const;
const controls = [
  { action: "FLIP_LEFT_PRESS", releaseAction: "FLIP_LEFT_RELEASE", get label() { return tx("pinball.leftFlipper"); }, symbol: "◀", style: { width: 104 } },
  { action: "PLUNGER_HOLD", releaseAction: "PLUNGER_RELEASE", get label() { return tx("pinball.plungerAria"); }, get symbol() { return tx("pinball.plunger"); }, style: { width: 120, fontSize: 15 } },
  { action: "FLIP_RIGHT_PRESS", releaseAction: "FLIP_RIGHT_RELEASE", get label() { return tx("pinball.rightFlipper"); }, symbol: "▶", style: { width: 104 } },
] as const;
const inputTones = { PLUNGER_RELEASE: "tap", FLIP_LEFT_PRESS: "tap", FLIP_RIGHT_PRESS: "tap" } as const;
const hudLabel = (s: Readonly<PinballStateV14>) => tx("pinball.hud", { secs: Math.max(0, Math.ceil((s.endTick - s.tick) / R.tickRate)), mult: s.multiplier });
const scoreCells = (s: Readonly<PinballStateV14>): ScoreCell[] => {
  const secs = Math.max(0, Math.ceil((s.endTick - s.tick) / R.tickRate));
  return [
    { label: tx("hud.points"), value: formatNumber(s.score), main: true },
    { label: tx("hud.time"), value: `${secs} s`, alert: secs <= 10 },
    { label: tx("hud.mult"), value: pinballFrenzyV14(s) ? `×${s.multiplier} ×2` : `×${s.multiplier}` },
  ];
};

export default function PinballVerified(props: GameRuntimeProps) {
  useI18n();
  return (
    <div className="pinballVerified">
      <CoreCanvasGame
        {...props}
        core={PINBALL_CORE_V14}
        name="Pinball"
        render={renderPinball}
        pointAction={pointAction}
        keys={keys}
        keyReleases={keyReleases}
        controls={controls}
        inputTones={inputTones}
        hudLabel={hudLabel}
        scoreCells={scoreCells}
        hideHudLabel
        hideHudScore
        topInset={SCORE_INSET}
        instruction=""
      />
    </div>
  );
}
