"use client";
import { useRef, useCallback, useEffect } from "react";
import type { GameRuntimeProps } from "@/lib/games";
import {
  ROULETTE_CORE_V16,
  ROULETTE_RULES_V16,
  ROULETTE_WHEEL,
  ROULETTE_RED,
  ROULETTE_THROWS_V16,
  rouletteAimReachesV16,
  rouletteFlightProgressV16,
  type RouletteStateV16 as RouletteStateV2,
} from "@/lib/verified/galacticRouletteCore.v16";
import { ROULETTE_BETS } from "@/lib/verified/galacticRouletteProtocol.v3";
import { ROULETTE_DENOMINATIONS } from "@/lib/verified/galacticRouletteProtocol.v8";
import {
  ROULETTE_BALL_DOCK,
  rouletteLauncherCanGrab,
  rouletteLauncherToss,
} from "@/lib/rouletteLaunchGesture";
import { drawSpaceBackdrop } from "@/lib/spaceBackdrop";
import CoreCanvasGame, { type CorePoint } from "./CoreCanvasGame";
import { t, formatNumber, useI18n } from "@/lib/i18n";
const cx = 195,
  cy = 195;
/**
 * v143 · The wheel in three dimensions. The physics have always been three-dimensional (V15/V16: a banked track,
 * a steeper stator, a sloped rotor, a dished pocket floor, gravity, bounces off the diamonds and frets); until now
 * they were drawn from straight above. The wheel is now seen from a camera tilted 49° from vertical (an orthographic
 * view: every ring of the bowl is an ellipse, every height lifts it on screen), each surface drawn at the height the
 * core gives it, and the ball at its real (r, θ, z) with its shadow on the surface under it: it is thrown from the
 * cradle in an arc over the rim, lands on the track, rides the wall, drops down the stator, hops on the diamonds and
 * frets and settles in a pocket. Physics coordinates never change: the drawing maps them through project() and touches
 * come back through toWheel() onto the plane of the table (the cradle's height). The arc of the short flight from the
 * cradle to the rim is drawn (the core flies it straight, at the same speed and timing).
 */
const S = 1.15, TILT = 0.66, HZ = 0.535, CY_SCREEN = 240;
const MM = 1e6;
const R16 = ROULETTE_RULES_V16;
const WALL_R = R16.wallR / MM + R16.ballRadiusNm / MM; // the wall itself (the ball's centre rides 5.4 mm inside it)
const BALL_RADIUS = R16.ballRadiusNm / MM;
/** Surface height (mm) at plane radius r, integrated from the core's slopes (rouletteSlopeV15). */
function surfaceH(r: number) {
  const k = (n: number) => n / MM;
  if (r >= k(R16.trackInner)) return 27.6 + (Math.min(r, WALL_R) - k(R16.trackInner)) * 0.7;
  if (r >= k(R16.rotorEdge)) return 12 + (r - k(R16.rotorEdge)) * 1.2;
  if (r >= k(R16.lipTop)) return 4 + (r - k(R16.lipTop)) * 0.4;
  if (r >= k(R16.floorOut)) return (r - k(R16.floorOut)) * 1.333;
  if (r >= k(R16.floorIn)) return 0.04 * ((r - 93) ** 2 - 25);
  return Math.min(22, (k(R16.floorIn) - r) * 0.34); // presentation dome (the ball never climbs it)
}
const RIM_H = surfaceH(WALL_R) + 9.2, CAB_R = WALL_R + 10, CAB_BOTTOM = -12;
const sx = (x: number) => cx + (x - cx) * S;
const sy = (y: number, h: number) => CY_SCREEN + (y - cy) * S * TILT - h * HZ;
/** Plane point (wheel space) and height (mm) → screen. */
const project = (x: number, y: number, h: number) => ({ x: sx(x), y: sy(y, h) });
const polar = (r: number, a: number, h: number) => project(cx + Math.cos(a) * r, cy + Math.sin(a) * r, h);
/** Screen → plane of the table (the cradle's height), for the throw gesture. */
export const toWheel = (p: CorePoint): CorePoint => ({ x: cx + (p.x - cx) / S, y: cy + (p.y - CY_SCREEN + RIM_H * HZ) / (S * TILT) });
const ring = (ctx: CanvasRenderingContext2D, r: number, h: number, a0 = 0, a1 = Math.PI * 2, ccw = false) => {
  const c = project(cx, cy, h);
  ctx.ellipse(c.x, c.y, r * S, r * S * TILT, 0, a0, a1, ccw);
};
/** Closed conical band between (r1,h1) inside and (r2,h2) outside, from angle a0 to a1. */
function band(ctx: CanvasRenderingContext2D, r1: number, h1: number, r2: number, h2: number, a0 = 0, a1 = Math.PI * 2) {
  ctx.beginPath();
  ring(ctx, r2, h2, a0, a1);
  if (a1 - a0 >= Math.PI * 2 - 1e-6) { ctx.moveTo(polar(r1, a0, h1).x, polar(r1, a0, h1).y); ring(ctx, r1, h1, a0, a1); return; }
  ring(ctx, r1, h1, a1, a0, true);
  ctx.closePath();
}
const NUMBER_OUTER = 121,
  NUMBER_INNER = 104,
  POCKET_OUTER = 101,
  POCKET_INNER = 85;
const pocketColor = (n: number) =>
  n === 0 ? "#f1f5ee" : ROULETTE_RED.includes(n as (typeof ROULETTE_RED)[number]) ? "#17956f" : "#2160b0";
const pocketFloor = (n: number) =>
  n === 0 ? "#aeb9b2" : ROULETTE_RED.includes(n as (typeof ROULETTE_RED)[number]) ? "#0b5e46" : "#13386f";
/** Height of the arc drawn for the flight from the cradle (presentation; the core's flight is a straight line). */
function flightArc(t: number, power: number, cross: number) {
  const h0 = RIM_H + 12, h1 = surfaceH(R16.wallR / MM) + 1.5 + BALL_RADIUS;
  const base = (1 - cross) * h0 + cross * h1, need = (RIM_H + BALL_RADIUS + 3 - base) / Math.max(0.05, 4 * cross * (1 - cross));
  const A = Math.max(need, 20 + power * 1.6);
  return (1 - t) * h0 + t * h1 + 4 * A * t * (1 - t);
}
/** Fraction of the cradle→rim flight at which the ball crosses the cabinet's outer edge. */
function crossAt(direction: number) {
  const e = ROULETTE_THROWS_V16[direction];
  if (!e) return 0.8;
  const d = e[0] / 1000, ux = e[4] / 1e6, uy = e[5] / 1e6;
  for (let k = 0; k <= 40; k++) {
    const t = k / 40, x = ROULETTE_BALL_DOCK.x + ux * d * t - cx, y = ROULETTE_BALL_DOCK.y + uy * d * t - cy;
    if (Math.hypot(x, y) <= CAB_R) return Math.min(0.95, Math.max(0.3, t));
  }
  return 0.8;
}
function drawSphere(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, alpha = 1) {
  ctx.save(); ctx.globalAlpha = alpha;
  const g = ctx.createRadialGradient(x - r * 0.38, y - r * 0.42, r * 0.08, x, y, r * 1.05);
  g.addColorStop(0, "#ffffff"); g.addColorStop(0.35, "#eef3f8"); g.addColorStop(0.78, "#a9b6c4"); g.addColorStop(1, "#5d6c7c");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(127,227,238,.35)"; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.arc(x, y, r - 0.5, Math.PI * 0.2, Math.PI * 0.8); ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,.95)"; ctx.beginPath(); ctx.ellipse(x - r * 0.35, y - r * 0.4, r * 0.28, r * 0.18, -0.6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
function shadowAt(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, lift: number, alpha = 0.5) {
  const p = project(x, y, h), spread = 1 + lift * 0.035;
  ctx.fillStyle = `rgba(0,4,14,${Math.max(0.08, alpha - lift * 0.006)})`;
  ctx.beginPath(); ctx.ellipse(p.x + lift * 0.18, p.y + 1, BALL_RADIUS * S * spread, BALL_RADIUS * S * TILT * spread, 0, 0, Math.PI * 2); ctx.fill();
}
function render(
  ctx: CanvasRenderingContext2D,
  s: RouletteStateV2,
  drag: CorePoint | null = null,
) {
  drawSpaceBackdrop(ctx, 390, 440, 1, s.tick);
  const rotation = (s.wheelPhase / 65536) * Math.PI * 2 - Math.PI / 2;
  // ---- cabinet: the wooden drum seen from the camera (outer side, then the bowl inside it)
  ctx.save();
  const cTop = project(cx, cy, RIM_H), cBot = project(cx, cy, CAB_BOTTOM);
  const glow = ctx.createRadialGradient(cBot.x, cBot.y + 20, 20, cBot.x, cBot.y + 20, 230);
  glow.addColorStop(0, "rgba(255,214,150,.12)"); glow.addColorStop(1, "rgba(255,214,150,0)");
  ctx.fillStyle = glow; ctx.beginPath(); ctx.ellipse(cBot.x, cBot.y + 24, 220, 90, 0, 0, Math.PI * 2); ctx.fill();
  const side = ctx.createLinearGradient(sx(cx - CAB_R), 0, sx(cx + CAB_R), 0);
  side.addColorStop(0, "#2a160a"); side.addColorStop(0.3, "#6b3f1f"); side.addColorStop(0.55, "#8a5a30"); side.addColorStop(0.8, "#4a2a14"); side.addColorStop(1, "#1e0f06");
  ctx.fillStyle = side;
  ctx.beginPath();
  ctx.ellipse(cTop.x, cTop.y, CAB_R * S, CAB_R * S * TILT, 0, 0, Math.PI);
  ctx.ellipse(cBot.x, cBot.y, CAB_R * S, CAB_R * S * TILT, 0, Math.PI, 0, true);
  ctx.closePath(); ctx.fill();
  // brass band round the drum
  ctx.strokeStyle = "rgba(233,194,122,.55)"; ctx.lineWidth = 1.4;
  for (const h of [RIM_H - 8, CAB_BOTTOM + 6]) { ctx.beginPath(); ring(ctx, CAB_R, h, 0, Math.PI); ctx.stroke(); }
  // ---- inside the bowl, from the wall inwards
  // wall (its inner face shows on the far side)
  const wall = ctx.createLinearGradient(0, sy(cy - WALL_R, RIM_H), 0, sy(cy - WALL_R, surfaceH(WALL_R)));
  wall.addColorStop(0, "#3a2414"); wall.addColorStop(1, "#1a0e06");
  ctx.fillStyle = wall; band(ctx, WALL_R, surfaceH(WALL_R), WALL_R, RIM_H); ctx.fill("evenodd");
  // ball track (polished wood), lit from the far side
  const track = ctx.createLinearGradient(0, sy(cy - WALL_R, 37), 0, sy(cy + WALL_R, 37));
  track.addColorStop(0, "#9a6a3a"); track.addColorStop(0.5, "#5e3a1c"); track.addColorStop(1, "#7a4c26");
  ctx.fillStyle = track; band(ctx, R16.trackInner / MM, surfaceH(R16.trackInner / MM), WALL_R, surfaceH(WALL_R)); ctx.fill("evenodd");
  ctx.strokeStyle = "rgba(255,226,170,.22)"; ctx.lineWidth = 1; ctx.beginPath(); ring(ctx, 141, surfaceH(141), Math.PI, Math.PI * 2); ctx.stroke();
  // stator (dark lacquer) down to the rotor edge
  const stator = ctx.createLinearGradient(0, sy(cy - 134, 27), 0, sy(cy + 134, 12));
  stator.addColorStop(0, "#1d3a48"); stator.addColorStop(0.5, "#0c1d27"); stator.addColorStop(1, "#173040");
  ctx.fillStyle = stator; band(ctx, NUMBER_OUTER, surfaceH(NUMBER_OUTER), R16.trackInner / MM, surfaceH(R16.trackInner / MM)); ctx.fill("evenodd");
  ctx.strokeStyle = "#dcc28a"; ctx.lineWidth = 1.6; ctx.beginPath(); ring(ctx, R16.trackInner / MM, surfaceH(R16.trackInner / MM)); ctx.stroke();
  // diamonds on the stator: small raised deflectors (V15 diamond k sits at k × 45° clockwise from 12 o'clock, i.e.
  // this drawing's i + 2); the one being struck lights up
  const diamonds: [number, number, boolean][] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4, struck = s.landingTick !== -1 && s.lastDiamond === (i + 2) % 8 && s.tick - s.lastDiamondTick < 14;
    diamonds.push([a, Math.sin(a), struck]);
  }
  const drawDiamond = ([a, , struck]: [number, number, boolean]) => {
    const r = R16.diamondR / MM, h = surfaceH(r), top = polar(r, a, h + 4), tip = (dr: number, da: number) => polar(r + dr, a + da, h);
    const L = tip(5.5, 0), Rr = tip(-5.5, 0), A = tip(0, 0.045), B = tip(0, -0.045);
    if (struck) {
      const g = ctx.createRadialGradient(top.x, top.y, 1, top.x, top.y, 16);
      g.addColorStop(0, "rgba(255,240,200,.95)"); g.addColorStop(1, "rgba(255,210,122,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(top.x, top.y, 16, 0, Math.PI * 2); ctx.fill();
    }
    for (const [p1, p2, c] of [[L, A, "#f3dca8"], [A, Rr, "#b8975a"], [Rr, B, "#8a6a38"], [B, L, "#dcc28a"]] as const) {
      ctx.fillStyle = struck ? "#fff1c8" : c; ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(top.x, top.y); ctx.closePath(); ctx.fill();
    }
  };
  diamonds.filter((d) => d[1] < 0.2).forEach(drawDiamond);
  // ---- rotor: numbered band, then pockets with frets, then the dome and turret (all turning together)
  for (let i = 0; i < 37; i++) {
    const a = rotation + ((i - 0.5) * Math.PI * 2) / 37, b = rotation + ((i + 0.5) * Math.PI * 2) / 37, mid = (a + b) / 2, n = ROULETTE_WHEEL[i];
    ctx.fillStyle = pocketColor(n);
    band(ctx, NUMBER_INNER, surfaceH(NUMBER_INNER), NUMBER_OUTER, surfaceH(NUMBER_OUTER), a, b); ctx.fill();
    const shade = 0.5 - 0.5 * Math.sin(mid); // far side brighter (lit), near side darker
    ctx.fillStyle = `rgba(0,0,0,${0.08 + shade * 0.22})`; ctx.fill();
    ctx.strokeStyle = "rgba(245,232,200,.5)"; ctx.lineWidth = 0.8;
    const e0 = polar(NUMBER_INNER, a, surfaceH(NUMBER_INNER)), e1 = polar(NUMBER_OUTER, a, surfaceH(NUMBER_OUTER));
    ctx.beginPath(); ctx.moveTo(e0.x, e0.y); ctx.lineTo(e1.x, e1.y); ctx.stroke();
    // number, laid on the band (squashed by the tilt like the band itself)
    const tp = polar((NUMBER_OUTER + NUMBER_INNER) / 2, mid, surfaceH(112.5));
    ctx.save(); ctx.translate(tp.x, tp.y); ctx.scale(S, S * TILT); ctx.rotate(mid + Math.PI / 2);
    ctx.fillStyle = n === 0 ? "#102d50" : "#fbf2e2"; ctx.textAlign = "center"; ctx.font = "800 9.5px system-ui"; ctx.fillText(String(n), 0, 3.4);
    ctx.restore();
    // pocket floor (dished) and its rising lip
    const floor = ctx.createLinearGradient(polar(POCKET_INNER, mid, 0).x, polar(POCKET_INNER, mid, 0).y, polar(POCKET_OUTER, mid, 4).x, polar(POCKET_OUTER, mid, 4).y);
    floor.addColorStop(0, pocketFloor(n)); floor.addColorStop(0.6, pocketColor(n)); floor.addColorStop(1, pocketFloor(n));
    ctx.fillStyle = floor; band(ctx, POCKET_INNER, 0, POCKET_OUTER, 4, a + 0.01, b - 0.01); ctx.fill();
  }
  // frets: low metal walls between pockets, with a lit top edge
  for (let i = 0; i < 37; i++) {
    const a = rotation + ((i - 0.5) * Math.PI * 2) / 37, fh = R16.fretHeight / MM;
    const b0 = polar(POCKET_INNER, a, 0), b1 = polar(POCKET_OUTER + 1, a, 4), t0 = polar(POCKET_INNER, a, fh), t1 = polar(POCKET_OUTER + 1, a, 4 + fh);
    ctx.fillStyle = "#8f7444"; ctx.beginPath(); ctx.moveTo(b0.x, b0.y); ctx.lineTo(b1.x, b1.y); ctx.lineTo(t1.x, t1.y); ctx.lineTo(t0.x, t0.y); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#fff1c8"; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(t0.x, t0.y); ctx.lineTo(t1.x, t1.y); ctx.stroke();
  }
  ctx.strokeStyle = "#dcc28a";
  for (const [r, w] of [[NUMBER_OUTER, 1.8], [NUMBER_INNER, 1.2], [POCKET_INNER, 1.8]] as const) { ctx.lineWidth = w; ctx.beginPath(); ring(ctx, r, surfaceH(r) + (r === POCKET_INNER ? 0.5 : 0)); ctx.stroke(); }
  // the dome: stacked rings rising to the turret, lit from the far left
  const steps = [[POCKET_INNER - 1, 0], [70, 5], [55, 10], [40, 15], [26, 19], [14, 22]] as const;
  steps.forEach(([r, h], k) => {
    const c = project(cx, cy, h);
    const g = ctx.createLinearGradient(c.x - r * S, c.y - r * S * TILT, c.x + r * S * 0.6, c.y + r * S * TILT);
    g.addColorStop(0, ["#2c5460", "#3a6a72", "#4f8084", "#6f9a94", "#a9b89a", "#d9cfa2"][k]); g.addColorStop(1, ["#06141d", "#0b202b", "#123039", "#1c4048", "#34585a", "#7a8a70"][k]);
    ctx.fillStyle = g; ctx.beginPath(); ring(ctx, r, h); ctx.fill();
  });
  for (let i = 0; i < 12; i++) {
    const a = rotation + (i * Math.PI) / 6, p0 = polar(16, a, 21.5), p1 = polar(POCKET_INNER - 3, a, 0.5);
    ctx.strokeStyle = i % 2 ? "rgba(231,217,174,.16)" : "rgba(0,8,18,.22)"; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
  }
  // turret: a short brass spindle with the cross on top
  const spinBase = project(cx, cy, 22), spinTop = project(cx, cy, 34);
  ctx.fillStyle = "rgba(0,5,14,.35)"; ctx.beginPath(); ctx.ellipse(spinBase.x + 5, spinBase.y + 3, 16, 10, 0, 0, Math.PI * 2); ctx.fill();
  const brass = ctx.createLinearGradient(spinBase.x - 9, 0, spinBase.x + 9, 0);
  brass.addColorStop(0, "#8a6a38"); brass.addColorStop(0.4, "#fff1c8"); brass.addColorStop(1, "#7a5a28");
  ctx.fillStyle = brass; ctx.fillRect(spinTop.x - 7, spinTop.y, 14, spinBase.y - spinTop.y);
  ctx.beginPath(); ctx.ellipse(spinBase.x, spinBase.y, 7, 7 * TILT, 0, 0, Math.PI); ctx.fill();
  ctx.lineCap = "round";
  for (const off of [0, Math.PI / 2]) {
    const a = polar(26, rotation + off, 34), b = polar(26, rotation + off + Math.PI, 34);
    ctx.strokeStyle = "rgba(0,0,0,.35)"; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(a.x + 2, a.y + 3); ctx.lineTo(b.x + 2, b.y + 3); ctx.stroke();
    ctx.strokeStyle = "#d9bd86"; ctx.lineWidth = 4.5; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    for (const q of [a, b]) { ctx.fillStyle = "#fff1c8"; ctx.beginPath(); ctx.arc(q.x, q.y, 3.4, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.fillStyle = "#f3e2b4"; ctx.beginPath(); ctx.ellipse(spinTop.x, spinTop.y, 7, 7 * TILT, 0, 0, Math.PI * 2); ctx.fill();
  ctx.lineCap = "butt";
  // ---- the ball
  const idle = s.landingTick === -1;
  const settled = idle && s.lastNumber !== null && !s.lastMiss;
  const pocketAngle = rotation + (ROULETTE_WHEEL.findIndex((n) => n === s.lastNumber) * Math.PI * 2) / 37;
  const settleT = settled ? Math.min(1, Math.max(0, (s.tick - s.lastLandingTick) / 40)) : 1;
  if (settled && settleT >= 1) {
    const half = Math.PI / 37;
    ctx.save(); ctx.strokeStyle = "#ffe9a4"; ctx.shadowColor = "#ffd36a"; ctx.shadowBlur = 12; ctx.lineWidth = 2.2;
    band(ctx, POCKET_INNER, 0, NUMBER_OUTER, surfaceH(NUMBER_OUTER), pocketAngle - half, pocketAngle + half); ctx.stroke(); ctx.restore();
  }
  const flying = s.ballPhase === 0;
  const ballA = s.ballTheta / 1e7 - Math.PI / 2, ballR = s.ballR / MM, restAngle = rotation + s.restOffset / 1e7;
  // position on the plane and height of the ball's centre
  let bx: number, by: number, bh: number, ground: number;
  if (settled) { bx = cx + Math.cos(restAngle) * ballR; by = cy + Math.sin(restAngle) * ballR; ground = surfaceH(ballR); bh = ground + BALL_RADIUS; }
  else if (idle) { bx = ROULETTE_BALL_DOCK.x; by = ROULETTE_BALL_DOCK.y; ground = RIM_H; bh = RIM_H + 12; }
  else if (flying) {
    bx = s.ballX / 1000; by = s.ballY / 1000;
    const t = rouletteFlightProgressV16(s), rr = Math.hypot(bx - cx, by - cy);
    bh = flightArc(t, s.launchImpulse, crossAt(s.launchDirection));
    ground = rr <= WALL_R ? surfaceH(rr) : rr <= CAB_R ? RIM_H : -999;
  } else { bx = cx + Math.cos(ballA) * ballR; by = cy + Math.sin(ballA) * ballR; ground = surfaceH(ballR); bh = ground + s.ballZ / MM + BALL_RADIUS; }
  // the cradle lifts the ball as the throw is charged
  let charge = 0;
  if (idle && drag) charge = Math.max(0, Math.min(1, (Math.hypot(drag.x - ROULETTE_BALL_DOCK.x, drag.y - ROULETTE_BALL_DOCK.y) - 24) / 180));
  const r2 = Math.hypot(bx - cx, by - cy);
  const inFront = r2 > WALL_R - 2 || bh - BALL_RADIUS > RIM_H; // drawn over the rim (in flight, or outside the wheel)
  const drawBallNow = (alphaGhosts: boolean) => {
    if (ground > -999 && !(idle && !settled)) shadowAt(ctx, bx, by, ground, bh - BALL_RADIUS - ground);
    // a fast ball leaves a faint smear along the track
    if (alphaGhosts && !idle && !flying && Math.abs(s.ballVt) > 600_000) {
      const dir = Math.sign(s.ballVt), speed = Math.min(1, Math.abs(s.ballVt) / 3_000_000);
      for (let k = 3; k >= 1; k--) {
        const a = ballA - dir * k * 0.045 * (0.5 + speed), q = polar(ballR, a, bh);
        drawSphere(ctx, q.x, q.y, BALL_RADIUS * S * 1.05, 0.1 + 0.06 * (3 - k));
      }
    }
    const q = project(bx, by, bh + (idle && !settled ? charge * 9 + Math.sin(s.tick * 0.08) * 1.2 : 0));
    drawSphere(ctx, q.x, q.y, BALL_RADIUS * S * (1 + Math.max(0, bh - RIM_H) * 0.004));
  };
  // the previous ball stays in its pocket while the next one waits on the cradle
  if (idle && settled) {
    const q = project(bx, by, bh);
    shadowAt(ctx, bx, by, ground, 0);
    drawSphere(ctx, q.x, q.y, BALL_RADIUS * S);
  } else if (!inFront) drawBallNow(true);
  // ---- rim (cabinet top) over the near side of the bowl, diamonds on the near half
  diamonds.filter((d) => d[1] >= 0.2).forEach(drawDiamond);
  const rim = ctx.createLinearGradient(0, sy(cy - CAB_R, RIM_H), 0, sy(cy + CAB_R, RIM_H));
  rim.addColorStop(0, "#f2d9a2"); rim.addColorStop(0.5, "#b8915a"); rim.addColorStop(1, "#e6c58a");
  ctx.fillStyle = rim; band(ctx, WALL_R, RIM_H, CAB_R, RIM_H); ctx.fill("evenodd");
  ctx.strokeStyle = "#fff3d0"; ctx.lineWidth = 1.2; ctx.beginPath(); ring(ctx, CAB_R, RIM_H, Math.PI, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = "rgba(60,36,14,.8)"; ctx.lineWidth = 1.2; ctx.beginPath(); ring(ctx, WALL_R, RIM_H); ctx.stroke();
  // ---- the cradle on the table (bottom right), laid on the table plane
  const dockS = project(ROULETTE_BALL_DOCK.x, ROULETTE_BALL_DOCK.y, RIM_H);
  if (idle || s.tick - s.flightStart < 40) {
    const t = s.tick;
    ctx.save(); ctx.translate(dockS.x, dockS.y); ctx.scale(S, S * TILT);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + (i * Math.PI) / 3; i ? ctx.lineTo(Math.cos(a) * 34, Math.sin(a) * 34) : ctx.moveTo(Math.cos(a) * 34, Math.sin(a) * 34); }
    ctx.closePath();
    const pad = ctx.createRadialGradient(-8, -10, 4, 0, 0, 40);
    pad.addColorStop(0, "#2a4a63"); pad.addColorStop(1, "#0a1826");
    ctx.fillStyle = pad; ctx.fill();
    ctx.strokeStyle = `rgba(${charge > 0 ? "255,214,120" : "127,227,238"},${0.55 + 0.35 * charge})`; ctx.lineWidth = 2; ctx.stroke();
    const fg = ctx.createRadialGradient(0, 0, 2, 0, 0, 26);
    fg.addColorStop(0, `rgba(${charge > 0 ? "255,220,140" : "140,235,255"},${0.35 + 0.4 * charge})`); fg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.fill();
    const spin = 0.03 + 0.2 * charge;
    for (const [r, dir, col] of [[16, 1, "127,227,238"], [22, -1, "199,155,255"], [28, 1, "255,210,122"]] as const) {
      ctx.save(); ctx.rotate(dir * t * spin);
      ctx.strokeStyle = `rgba(${col},${0.5 + 0.4 * charge})`; ctx.lineWidth = 1.6; ctx.setLineDash([r * 0.9, r * 0.5]);
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    ctx.setLineDash([]);
    ctx.restore();
    // three upright prongs holding the ball, sparking while charging
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / 3 + t * 0.004;
      const foot = { x: dockS.x + Math.cos(a) * 26 * S, y: dockS.y + Math.sin(a) * 26 * S * TILT }, tip = { x: dockS.x + Math.cos(a) * 11 * S, y: dockS.y + Math.sin(a) * 11 * S * TILT - 10 * HZ * S };
      ctx.strokeStyle = "#c9d6e3"; ctx.lineWidth = 2.6; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(foot.x, foot.y); ctx.lineTo(tip.x, tip.y); ctx.stroke();
      ctx.fillStyle = charge > 0 ? "#ffd27a" : "#7fe3ee"; ctx.beginPath(); ctx.arc(tip.x, tip.y, 2, 0, Math.PI * 2); ctx.fill();
      if (charge > 0.05 && (t + i * 3) % 6 < 3) {
        const b = a + (Math.PI * 2) / 3, tip2 = { x: dockS.x + Math.cos(b) * 11 * S, y: dockS.y + Math.sin(b) * 11 * S * TILT - 10 * HZ * S };
        ctx.strokeStyle = `rgba(255,240,190,${0.4 + 0.6 * charge})`; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(tip.x, tip.y); ctx.lineTo((tip.x + tip2.x) / 2 + (i - 1) * 2, (tip.y + tip2.y) / 2 - 3); ctx.lineTo(tip2.x, tip2.y); ctx.stroke();
      }
    }
    ctx.lineCap = "butt";
  }
  // ---- aim: the arc the ball will fly, landing on the track where this aim enters the wheel
  if (idle && drag) {
    const dx = drag.x - ROULETTE_BALL_DOCK.x, dy = drag.y - ROULETTE_BALL_DOCK.y, length = Math.hypot(dx, dy);
    if (length >= 28) {
      const power = Math.max(0, Math.min(15, Math.round((length - 24) / 12)));
      const aim = Math.round((((Math.atan2(dy, dx) + Math.PI * 2) % (Math.PI * 2)) * 32) / (Math.PI * 2)) % 32;
      const entry = ROULETTE_THROWS_V16[aim];
      ctx.save();
      if (entry && rouletteAimReachesV16(aim)) {
        const d = entry[0] / 1000, ux = entry[4] / 1e6, uy = entry[5] / 1e6, cross = crossAt(aim);
        ctx.shadowColor = "#ffd36a"; ctx.shadowBlur = 8;
        for (let k = 1; k <= 18; k++) {
          const t = k / 18, q = project(ROULETTE_BALL_DOCK.x + ux * d * t, ROULETTE_BALL_DOCK.y + uy * d * t, flightArc(t, power, cross));
          ctx.fillStyle = `rgba(255,233,164,${0.45 + 0.55 * t})`; ctx.beginPath(); ctx.arc(q.x, q.y, 2 + t * 1.8, 0, Math.PI * 2); ctx.fill();
        }
        // landing mark on the track and the way the ball will run (clockwise or counter-clockwise, longer with power)
        const land = project(ROULETTE_BALL_DOCK.x + ux * d, ROULETTE_BALL_DOCK.y + uy * d, surfaceH(R16.wallR / MM));
        ctx.strokeStyle = "rgba(255,233,164,.95)"; ctx.lineWidth = 2;
        for (const r of [7, 12]) { ctx.beginPath(); ctx.ellipse(land.x, land.y, r * S, r * S * TILT, 0, 0, Math.PI * 2); ctx.stroke(); }
        const theta = entry[1] / 1e7 - Math.PI / 2, run = Math.sign(entry[3]) * (0.25 + power * 0.05);
        const pathAt = (k: number) => polar(R16.wallR / MM, theta + (run * k) / 16, surfaceH(R16.wallR / MM) + 1);
        ctx.lineWidth = 2.6; ctx.setLineDash([6, 5]); ctx.beginPath();
        for (let k = 0; k <= 16; k++) { const q = pathAt(k); k ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); }
        ctx.stroke(); ctx.setLineDash([]);
        const e = pathAt(16), e0 = pathAt(15), ang = Math.atan2(e.y - e0.y, e.x - e0.x);
        ctx.fillStyle = "rgba(255,233,164,.95)"; ctx.beginPath();
        ctx.moveTo(e.x + Math.cos(ang) * 7, e.y + Math.sin(ang) * 7); ctx.lineTo(e.x + Math.cos(ang + 2.4) * 7, e.y + Math.sin(ang + 2.4) * 7); ctx.lineTo(e.x + Math.cos(ang - 2.4) * 7, e.y + Math.sin(ang - 2.4) * 7);
        ctx.closePath(); ctx.fill();
        // power: a gold arc filling round the cradle
        ctx.save(); ctx.translate(dockS.x, dockS.y); ctx.scale(S, S * TILT);
        ctx.strokeStyle = "rgba(255,211,106,.25)"; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(0, 0, 40, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = "#ffd36a"; ctx.beginPath(); ctx.arc(0, 0, 40, -Math.PI / 2, -Math.PI / 2 + ((power + 1) / 16) * Math.PI * 2); ctx.stroke();
        ctx.restore();
      } else {
        // aims that miss the wheel throw nothing: a short red line on the table
        const ux = dx / length, uy = dy / length;
        ctx.strokeStyle = "rgba(255,92,104,.85)"; ctx.lineWidth = 2.6; ctx.setLineDash([6, 5]);
        const a = project(ROULETTE_BALL_DOCK.x + ux * 14, ROULETTE_BALL_DOCK.y + uy * 14, RIM_H), b = project(ROULETTE_BALL_DOCK.x + ux * 60, ROULETTE_BALL_DOCK.y + uy * 60, RIM_H);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.setLineDash([]);
      }
      ctx.restore();
    }
  }
  if (idle) {
    const q = project(ROULETTE_BALL_DOCK.x, ROULETTE_BALL_DOCK.y, RIM_H + 12 + charge * 9 + Math.sin(s.tick * 0.08) * 1.2);
    drawSphere(ctx, q.x, q.y, BALL_RADIUS * S);
  } else if (inFront) drawBallNow(true);
  if (idle && s.chips.length === 0) {
    // V12 · no chips on the cloth: the cradle is locked, the ball cannot be picked up until a bet is placed.
    ctx.save(); ctx.translate(dockS.x, dockS.y - 12);
    ctx.fillStyle = "rgba(5,10,26,.66)"; ctx.beginPath(); ctx.arc(0, 0, 24, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#ffcf6a"; ctx.lineWidth = 2.4; ctx.lineCap = "round";
    ctx.beginPath(); ctx.arc(0, -4, 6.5, Math.PI, 0); ctx.stroke();
    ctx.fillStyle = "#ffcf6a"; ctx.beginPath(); ctx.roundRect(-9, -4, 18, 14, 3); ctx.fill();
    ctx.fillStyle = "#3a2a08"; ctx.beginPath(); ctx.arc(0, 2, 2.2, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(-1, 2, 2, 5);
    ctx.restore();
  }
  ctx.restore();
  // last number, floating over the turret
  if (s.lastNumber !== null) {
    const q = project(cx, cy, 34);
    ctx.save(); ctx.fillStyle = "#edf1e4"; ctx.font = "900 26px system-ui"; ctx.textAlign = "center";
    ctx.shadowColor = "rgba(0,0,0,.8)"; ctx.shadowBlur = 8; ctx.fillText(String(s.lastNumber), q.x, q.y - 16); ctx.restore();
  }
  // History of the last six results, top right (v127: the chips / spins pill owns the top left), newest at the edge.
  const SHOWN = 6, shown = s.history.slice(-SHOWN);
  const slot = 22, left = 382 - SHOWN * slot;
  ctx.textAlign = "center";
  for (let i = 0; i < SHOWN; i++) {
    const n = shown[i - (SHOWN - shown.length)];
    const hx = left + i * slot + slot / 2;
    if (n === undefined) {
      ctx.strokeStyle = "rgba(168,198,213,.28)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(hx, 22, 9, 0, Math.PI * 2); ctx.stroke();
      continue;
    }
    const latest = i === SHOWN - 1;
    ctx.fillStyle = pocketColor(n);
    ctx.beginPath(); ctx.arc(hx, 22, latest ? 11 : 9, 0, Math.PI * 2); ctx.fill();
    if (latest) { ctx.strokeStyle = "#ffe9a4"; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.fillStyle = n === 0 ? "#102d50" : "#f9edda"; ctx.font = "bold 10px system-ui";
    ctx.fillText(String(n), hx, 25.5);
  }
  if (s.lastPayout > 0 && s.tick - s.lastLandingTick < 120) {
    ctx.fillStyle = "#ffe9a4"; ctx.font = "bold 19px system-ui";
    ctx.fillText(t("roulette.won", { n: formatNumber(s.lastPayout / 100) }), cx, 70);
  }
}
const hudLabel = (s: Readonly<RouletteStateV2>) =>
  t("roulette.hud", { chips: formatNumber(s.balanceMinor / 100), spins: s.spins });
const feedbackScore = (s: Readonly<RouletteStateV2>) => s.balanceMinor;
const betLabels: Record<string, string> = {
  get RED() { return t("roulette.green"); },
  get BLACK() { return t("roulette.blue"); },
  get EVEN() { return t("roulette.even"); },
  get ODD() { return t("roulette.odd"); },
  LOW: "1–18",
  HIGH: "19–36",
  DOZEN_1: "1–12",
  DOZEN_2: "13–24",
  DOZEN_3: "25–36",
};
// Casino cloth shown permanently under the wheel: zero spans the three number
// rows, then dozens and outside bets. Every tap stacks one chip on that cell.
const choiceControl = {
  get label() { return t("roulette.cloth"); },
  presentation: "table" as const,
  columns: 13,
  options: [
    ...ROULETTE_BETS.map((bet) => {
      if (bet.startsWith("NUMBER_")) {
        const n = Number(bet.slice(7));
        return {
          action: `BET_${bet}`,
          label: String(n),
          tone:
            n === 0
              ? "#e9eeed"
              : ROULETTE_RED.includes(n as (typeof ROULETTE_RED)[number])
                ? "#1f8a6b"
                : "#1f4f8f",
          placement:
            n === 0
              ? { row: 1, column: 1, rowSpan: 3 }
              : { row: 3 - ((n - 1) % 3), column: 2 + Math.floor((n - 1) / 3) },
        };
      }
      if (bet.startsWith("DOZEN_")) {
        const n = Number(bet.slice(6));
        return {
          action: `BET_${bet}`,
          get label() { return betLabels[bet]; },
          tone: "#173e42",
          placement: { row: 4, column: 2 + (n - 1) * 4, columnSpan: 4 },
        };
      }
      const i = ["LOW", "EVEN", "RED", "BLACK", "ODD", "HIGH"].indexOf(bet);
      return {
        action: `BET_${bet}`,
        get label() { return betLabels[bet]; },
        tone: bet === "RED" ? "#1f8a6b" : bet === "BLACK" ? "#1f4f8f" : "#173e42",
        placement: { row: 5, column: 2 + i * 2, columnSpan: 2 },
      };
    }),
    ...ROULETTE_DENOMINATIONS.map((d, i) => ({
      action: `CHIP_${d}`,
      label: `${d}`,
      placement: { row: 6, column: 1 + i * 2, columnSpan: 2 },
    })),
    { action: "BETS_UNDO", get label() { return t("roulette.undo"); }, tone: "#3b3f2f", placement: { row: 6, column: 7, columnSpan: 3 } },
    { action: "BETS_CLEAR", get label() { return t("roulette.clear"); }, tone: "#4a2f35", placement: { row: 6, column: 10, columnSpan: 4 } },
    { action: "CASH_OUT", get label() { return t("roulette.cashOut"); }, tone: "#5a3a1e", placement: { row: 7, column: 1, columnSpan: 13 } },
  ],
  value: (s: RouletteStateV2) => (s.chips.length ? `BET_${s.chips[s.chips.length - 1]}` : ""),
  badges: (s: RouletteStateV2) => {
    const counts: Record<string, number> = {};
    // Chips stay visible while the ball is in play and leave the cloth when the spin ends.
    const shown = s.landingTick !== -1 ? s.lockedChips : s.chips, values = s.landingTick !== -1 ? s.lockedValues : s.chipValues;
    shown.forEach((bet, i) => { counts[`BET_${bet}`] = (counts[`BET_${bet}`] ?? 0) + values[i]; });
    // Dominant denomination per cell drives the badge colour (highest value placed there).
    shown.forEach((bet, i) => { counts[`~BET_${bet}`] = Math.max(counts[`~BET_${bet}`] ?? 0, values[i]); });
    counts[`CHIP_${s.denomination}`] = 1;
    return counts;
  },
  disabled: (s: RouletteStateV2) =>
    s.landingTick !== -1 ||
    s.status !== "running" ||
    false,
};
export default function GalacticRoulette(props: GameRuntimeProps) {
  useI18n();
  const origin = useRef<CorePoint | null>(null),
    drag = useRef<CorePoint | null>(null);
  const canvasRender = useCallback(
    (ctx: CanvasRenderingContext2D, s: RouletteStateV2) => {
      if (s.landingTick !== -1) drag.current = null;
      render(ctx, s, drag.current);
    },
    [],
  );
  useEffect(() => {
    const clear = () => {
      origin.current = null;
      drag.current = null;
    };
    window.addEventListener("blur", clear);
    window.addEventListener("resize", clear);
    return () => {
      window.removeEventListener("blur", clear);
      window.removeEventListener("resize", clear);
      clear();
    };
  }, []);
  return (
    <div
      className="rouletteVerified rouletteMobile"
      onPointerCancel={() => {
        origin.current = null;
        drag.current = null;
      }}
      onLostPointerCapture={() => {
        if (origin.current) {
          origin.current = null;
          drag.current = null;
        }
      }}
    >
      <CoreCanvasGame
        {...props}
        core={ROULETTE_CORE_V16}
        name="Roulette"
        instruction=""
        render={canvasRender}
        hideHudScore
        hudLabel={hudLabel}
        feedbackScore={feedbackScore}
        choiceControl={choiceControl}
        pointAction={(screen, phase, s) => {
          const p = toWheel(screen);
          if (phase === "down") {
            origin.current =
              ROULETTE_CORE_V16.canApply(s, "TOSS_D20_P00") &&
              rouletteLauncherCanGrab(p)
                ? p
                : null;
            drag.current = origin.current ? p : null;
            return null;
          }
          if (!origin.current) return null;
          if (phase === "move") {
            drag.current = p;
            return null;
          }
          const from = origin.current;
          origin.current = null;
          drag.current = null;
          return rouletteLauncherToss(from, p);
        }}
      />
    </div>
  );
}
