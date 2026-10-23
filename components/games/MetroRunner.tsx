"use client";
import type { GameRuntimeProps } from "@/lib/games";
import { drawSpaceBackdrop } from "@/lib/spaceBackdrop";
import {
  METRO_CORE_V2,
  METRO_V2,
  METRO_V2_LANES,
  metroMeters,
  metroSpeedV2,
  type MetroObstacle,
  type MetroStateV2,
} from "@/lib/verified/metroShiftCore.v2";
import CoreCanvasGame from "./CoreCanvasGame";

// Presentation only: a camera looking down a three-lane viaduct. The core owns
// every collision and score; nothing below feeds back into it.
const HORIZON = 150,
  GROUND = 520,
  FOCAL = 270000,
  LANE_PX = 108,
  MAX_DEPTH = 2_900_000;

const proj = (dz: number) => 1 / (1 + Math.max(dz, -55000) / FOCAL);
const sx = (wx: number, k: number) => 195 + (wx - 195000) * (LANE_PX / 100000) * k;
const sy = (k: number) => HORIZON + (GROUND - HORIZON) * k;
const hash = (n: number) => {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const TRAINS = [
  { body: "#d4663f", roof: "#f19a6c", side: "#a84a2c", stripe: "#ffd9a0" },
  { body: "#4aa3b8", roof: "#7fd2e3", side: "#307f92", stripe: "#d9fbff" },
  { body: "#8d6bd0", roof: "#b9a0f0", side: "#6a4aa8", stripe: "#eadfff" },
];

function poly(ctx: CanvasRenderingContext2D, pts: number[][], fill: string, stroke?: string) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function drawWorld(ctx: CanvasRenderingContext2D, s: MetroStateV2, tier: number) {
  const accent = ["#5fc3df", "#a38be6", "#6fe0b5", "#f1b46b", "#ff8aa3"][tier];
  // Distant skyline and the glow of the next stretch.
  const glow = ctx.createLinearGradient(0, HORIZON - 70, 0, HORIZON + 10);
  glow.addColorStop(0, "rgba(40,70,120,0)");
  glow.addColorStop(1, `${accent}55`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, HORIZON - 70, 390, 80);
  for (let i = 0; i < 26; i++) {
    const w = 18 + hash(i) * 22,
      h = 14 + hash(i + 40) * 52,
      x = ((i * 31 - s.distance / 9000) % 440 + 440) % 440 - 25;
    ctx.fillStyle = `rgba(16,28,52,${0.55 + hash(i + 9) * 0.25})`;
    ctx.fillRect(x, HORIZON - h, w, h + 2);
  }
  // Ground and the two side embankments.
  const ground = ctx.createLinearGradient(0, HORIZON, 0, 620);
  ground.addColorStop(0, "#0d1727");
  ground.addColorStop(1, "#142238");
  ctx.fillStyle = ground;
  ctx.fillRect(0, HORIZON, 390, 470);
  // Side buildings in perspective, scrolling with the distance travelled.
  const SPAN = 300000,
    first = Math.floor(s.distance / SPAN);
  for (let i = first + Math.floor(MAX_DEPTH / SPAN) + 1; i >= first; i--) {
    const dz = i * SPAN - s.distance;
    const k = proj(dz),
      k2 = proj(dz + SPAN * 0.8);
    for (const side of [-1, 1]) {
      const r = hash(i * 2 + (side > 0 ? 1 : 0)),
        height = (40 + r * 150) * k,
        x1 = sx(195000 + side * 235000, k),
        x2 = sx(195000 + side * 235000, k2),
        wall = sx(195000 + side * (400000 + r * 260000), k);
      const y1 = sy(k),
        y2 = sy(k2);
      // Facing wall (towards the track) and front face.
      poly(ctx, [[x1, y1], [x2, y2], [x2, y2 - height * (k2 / k)], [x1, y1 - height]], side < 0 ? "#18304d" : "#142a46", "rgba(120,180,220,.12)");
      poly(ctx, [[x1, y1], [wall, y1], [wall, y1 - height], [x1, y1 - height]], "#1b3858", "rgba(120,180,220,.14)");
      // Lit windows.
      const rows = Math.max(1, Math.floor(height / (16 * Math.max(0.3, k)))),
        winH = 5 * k + 1;
      for (let row = 0; row < Math.min(rows, 12); row++) {
        if (hash(i * 97 + row * 13 + (side > 0 ? 7 : 3)) < 0.45) continue;
        ctx.fillStyle = hash(row + i) < 0.5 ? "rgba(255,226,150,.8)" : "rgba(150,224,255,.75)";
        const wy = y1 - height + 8 * k + row * (height / rows);
        const wx = x1 + (side < 0 ? -1 : 1) * 6 * k;
        ctx.fillRect(Math.min(wx, wx + (side < 0 ? -1 : 1) * 12 * k), wy, 12 * k, winH);
      }
      ctx.fillStyle = `${accent}99`;
      ctx.fillRect(Math.min(x1, wall), y1 - height, Math.abs(wall - x1), Math.max(1, 3 * k));
    }
  }
  // Track bed and rails.
  const nearHalf = (3 * 100000) / 2 + 22000;
  poly(ctx, [
    [sx(195000 - nearHalf, 0), HORIZON],
    [sx(195000 + nearHalf, 0), HORIZON],
    [sx(195000 + nearHalf, 1.45), sy(1.45)],
    [sx(195000 - nearHalf, 1.45), sy(1.45)],
  ], "#1c2c43");
  for (let lane = 0; lane < 3; lane++) {
    const cx = METRO_V2_LANES[lane];
    poly(ctx, [
      [sx(cx - 46000, 0), HORIZON],
      [sx(cx + 46000, 0), HORIZON],
      [sx(cx + 46000, 1.45), sy(1.45)],
      [sx(cx - 46000, 1.45), sy(1.45)],
    ], "#233a58");
    ctx.strokeStyle = "rgba(190,225,245,.55)";
    ctx.lineWidth = 2;
    for (const off of [-30000, 30000]) {
      ctx.beginPath();
      ctx.moveTo(sx(cx + off, 0), HORIZON);
      ctx.lineTo(sx(cx + off, 1.45), sy(1.45));
      ctx.stroke();
    }
  }
  // Sleepers flow towards the camera at exactly the run speed.
  const TIE = 90000;
  for (let i = Math.floor(s.distance / TIE); i < Math.floor(s.distance / TIE) + 32; i++) {
    const k = proj(i * TIE - s.distance);
    if (k > 1.45 || k < 0.04) continue;
    ctx.strokeStyle = `rgba(120,160,190,${Math.min(0.5, 0.12 + k * 0.4)})`;
    ctx.lineWidth = Math.max(1, 3 * k);
    for (let lane = 0; lane < 3; lane++) {
      ctx.beginPath();
      ctx.moveTo(sx(METRO_V2_LANES[lane] - 42000, k), sy(k));
      ctx.lineTo(sx(METRO_V2_LANES[lane] + 42000, k), sy(k));
      ctx.stroke();
    }
  }
  ctx.strokeStyle = `${accent}`;
  ctx.lineWidth = 2;
  for (const edge of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(sx(195000 + edge * nearHalf, 0), HORIZON);
    ctx.lineTo(sx(195000 + edge * nearHalf, 1.45), sy(1.45));
    ctx.stroke();
  }
}

function drawTrain(ctx: CanvasRenderingContext2D, o: MetroObstacle, index: number, d: number, tick: number) {
  const pal = TRAINS[index % TRAINS.length],
    near = o.z - d,
    far = Math.min(o.z + o.len - d, MAX_DEPTH),
    kN = proj(Math.max(near, -55000)),
    kF = proj(far),
    cx = METRO_V2_LANES[o.lane],
    half = 46000,
    H = 128;
  const nl = sx(cx - half, kN),
    nr = sx(cx + half, kN),
    fl = sx(cx - half, kF),
    fr = sx(cx + half, kF),
    yN = sy(kN),
    yF = sy(kF);
  // Visible side wall (towards the centre line) and roof.
  if (o.lane === 0) poly(ctx, [[nr, yN], [fr, yF], [fr, yF - H * kF], [nr, yN - H * kN]], pal.side, "rgba(0,0,0,.35)");
  if (o.lane === 2) poly(ctx, [[nl, yN], [fl, yF], [fl, yF - H * kF], [nl, yN - H * kN]], pal.side, "rgba(0,0,0,.35)");
  if (o.lane !== 1) {
    // Window band along the side.
    const x1 = o.lane === 0 ? nr : nl,
      x2 = o.lane === 0 ? fr : fl;
    poly(ctx, [[x1, yN - 78 * kN], [x2, yF - 78 * kF], [x2, yF - 100 * kF], [x1, yN - 100 * kN]], "rgba(190,240,255,.55)");
  }
  poly(ctx, [[nl, yN - H * kN], [nr, yN - H * kN], [fr, yF - H * kF], [fl, yF - H * kF]], pal.roof, "rgba(0,0,0,.3)");
  if (near > -50000) {
    // Front face: body, windscreen, stripe and lamps.
    const w = nr - nl;
    ctx.fillStyle = pal.body;
    ctx.fillRect(nl, yN - H * kN, w, H * kN);
    ctx.strokeStyle = "rgba(0,0,0,.4)";
    ctx.lineWidth = 1;
    ctx.strokeRect(nl, yN - H * kN, w, H * kN);
    ctx.fillStyle = "#14263a";
    ctx.fillRect(nl + w * 0.1, yN - 112 * kN, w * 0.8, 46 * kN);
    ctx.fillStyle = "rgba(160,225,255,.25)";
    ctx.fillRect(nl + w * 0.1, yN - 112 * kN, w * 0.8, 10 * kN);
    ctx.fillStyle = pal.stripe;
    ctx.fillRect(nl, yN - 40 * kN, w, 7 * kN);
    const pulse = 0.7 + 0.3 * Math.sin(tick * 0.2);
    ctx.fillStyle = `rgba(255,244,190,${pulse})`;
    ctx.shadowColor = "#fff2b0";
    ctx.shadowBlur = 10 * kN;
    for (const lx of [nl + w * 0.16, nr - w * 0.16]) {
      ctx.beginPath();
      ctx.arc(lx, yN - 22 * kN, 5 * kN, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }
}

function drawLow(ctx: CanvasRenderingContext2D, o: MetroObstacle, d: number) {
  const k = proj(o.z - d),
    cx = METRO_V2_LANES[o.lane],
    l = sx(cx - 46000, k),
    r = sx(cx + 46000, k),
    y = sy(k),
    h = 38 * k;
  ctx.fillStyle = "rgba(0,0,0,.35)";
  ctx.fillRect(l, y - 2 * k, r - l, 5 * k);
  ctx.fillStyle = "#59606e";
  ctx.fillRect(l, y - h, 7 * k, h);
  ctx.fillRect(r - 7 * k, y - h, 7 * k, h);
  const top = y - h,
    bar = 17 * k,
    stripe = 14 * k;
  ctx.save();
  ctx.beginPath();
  ctx.rect(l, top, r - l, bar);
  ctx.clip();
  ctx.fillStyle = "#f4f1e6";
  ctx.fillRect(l, top, r - l, bar);
  ctx.fillStyle = "#f0603a";
  for (let x = l - stripe; x < r; x += stripe * 2) {
    ctx.beginPath();
    ctx.moveTo(x, top + bar);
    ctx.lineTo(x + stripe, top + bar);
    ctx.lineTo(x + stripe * 2, top);
    ctx.lineTo(x + stripe, top);
    ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = "rgba(0,0,0,.4)";
  ctx.strokeRect(l, top, r - l, bar);
}

function drawHigh(ctx: CanvasRenderingContext2D, o: MetroObstacle, d: number, tick: number) {
  const k = proj(o.z - d),
    cx = METRO_V2_LANES[o.lane],
    l = sx(cx - 49000, k),
    r = sx(cx + 49000, k),
    y = sy(k);
  ctx.fillStyle = "rgba(0,0,0,.3)";
  ctx.fillRect(l, y - 2 * k, r - l, 4 * k);
  ctx.fillStyle = "#4a5568";
  ctx.fillRect(l, y - 112 * k, 8 * k, 112 * k);
  ctx.fillRect(r - 8 * k, y - 112 * k, 8 * k, 112 * k);
  // Gantry beam at head height: sliding goes under it, jumping does not.
  const top = y - 72 * k,
    bar = 26 * k,
    stripe = 16 * k;
  ctx.save();
  ctx.beginPath();
  ctx.rect(l, top, r - l, bar);
  ctx.clip();
  ctx.fillStyle = "#1e2a38";
  ctx.fillRect(l, top, r - l, bar);
  ctx.fillStyle = "#ffc94a";
  for (let x = l - stripe; x < r; x += stripe * 2) {
    ctx.beginPath();
    ctx.moveTo(x, top + bar);
    ctx.lineTo(x + stripe, top + bar);
    ctx.lineTo(x + stripe * 2, top);
    ctx.lineTo(x + stripe, top);
    ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = tick % 40 < 20 ? "#ff5a5a" : "#7a2a2a";
  ctx.beginPath();
  ctx.arc((l + r) / 2, top - 4 * k, 3.5 * k, 0, Math.PI * 2);
  ctx.fill();
}

function drawCoin(ctx: CanvasRenderingContext2D, wx: number, dz: number, air: boolean, spin: number, jet: boolean) {
  const k = proj(dz),
    x = sx(wx, k),
    y = sy(k) - (air ? 82 : 32) * k - (jet && air ? 0 : 0),
    rx = Math.max(1.5, 9 * k * Math.abs(Math.cos(spin))),
    ry = 9 * k;
  ctx.fillStyle = "rgba(0,0,0,.25)";
  ctx.beginPath();
  ctx.ellipse(x, sy(k) - 1, 8 * k, 3 * k, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = "#ffd75a";
  ctx.shadowBlur = 8 * k;
  ctx.fillStyle = "#ffcf3f";
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#b07a10";
  ctx.lineWidth = Math.max(1, 1.4 * k);
  ctx.stroke();
  ctx.fillStyle = "#fff0a8";
  ctx.beginPath();
  ctx.ellipse(x - rx * 0.25, y - ry * 0.25, rx * 0.35, ry * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawPickup(ctx: CanvasRenderingContext2D, kind: "jet" | "life", wx: number, dz: number, tick: number) {
  const k = proj(dz),
    x = sx(wx, k),
    bob = Math.sin(tick * 0.08) * 4 * k,
    y = sy(k) - 56 * k + bob,
    r = 17 * k;
  const aura = ctx.createRadialGradient(x, y, 1, x, y, r * 1.9);
  aura.addColorStop(0, kind === "jet" ? "rgba(255,170,80,.85)" : "rgba(255,110,150,.85)");
  aura.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(x, y, r * 1.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#10243b";
  ctx.strokeStyle = kind === "jet" ? "#ffb55a" : "#ff7fa5";
  ctx.lineWidth = Math.max(1, 2 * k);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = kind === "jet" ? "#ffd17a" : "#ff7fa5";
  if (kind === "jet") {
    ctx.beginPath();
    ctx.moveTo(x, y - 10 * k);
    ctx.lineTo(x + 5 * k, y + 5 * k);
    ctx.lineTo(x, y + 2 * k);
    ctx.lineTo(x - 5 * k, y + 5 * k);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ff6a3a";
    ctx.beginPath();
    ctx.moveTo(x - 2 * k, y + 6 * k);
    ctx.lineTo(x, y + 12 * k);
    ctx.lineTo(x + 2 * k, y + 6 * k);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(x - 3.5 * k, y - 2 * k, 4 * k, 0, Math.PI * 2);
    ctx.arc(x + 3.5 * k, y - 2 * k, 4 * k, 0, Math.PI * 2);
    ctx.moveTo(x - 7.5 * k, y - 0.5 * k);
    ctx.lineTo(x, y + 8 * k);
    ctx.lineTo(x + 7.5 * k, y - 0.5 * k);
    ctx.fill();
  }
}

function drawRunner(ctx: CanvasRenderingContext2D, s: MetroStateV2) {
  const x = s.x / 1000 + (195 - 195) + 0,
    px = 195 + (s.x - 195000) * (LANE_PX / 100000),
    jetting = s.tick < s.jetUntil,
    sliding = s.tick < s.slideUntil,
    air = s.jumpY < -2000,
    lift = s.jumpY / 1000,
    phase = s.distance / 70000,
    swing = air || jetting ? 0.5 : Math.sin(phase * Math.PI * 2),
    lean = Math.max(-0.35, Math.min(0.35, (s.x - METRO_V2_LANES[s.lane]) / -140000));
  void x;
  // Ground shadow shrinks with height.
  const shadow = Math.max(0.35, 1 + lift / 160);
  ctx.fillStyle = "rgba(0,0,0,.4)";
  ctx.beginPath();
  ctx.ellipse(px, GROUND + 4, 24 * shadow, 7 * shadow, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(px, GROUND + lift);
  const flicker = s.tick < s.shieldUntil && !jetting && s.tick % 12 < 6;
  if (flicker) ctx.globalAlpha = 0.45;
  if (jetting) {
    // Flying pose, flames beneath.
    ctx.rotate(0.12 * Math.sin(s.tick * 0.05));
    const flame = 20 + (s.tick % 6) * 3;
    const g = ctx.createLinearGradient(0, 4, 0, 4 + flame * 2);
    g.addColorStop(0, "#fff2b0");
    g.addColorStop(0.4, "#ff9a3c");
    g.addColorStop(1, "rgba(255,80,40,0)");
    ctx.fillStyle = g;
    for (const ox of [-8, 8]) {
      ctx.beginPath();
      ctx.moveTo(ox - 5, 0);
      ctx.lineTo(ox + 5, 0);
      ctx.lineTo(ox, flame * 1.7);
      ctx.fill();
    }
  } else ctx.rotate(lean);
  const suit = "#2fc6b8",
    suitDark = "#1c8f88",
    accent = "#ffb347";
  if (sliding && !air) {
    // Slide: low, leaning back, feet first.
    ctx.translate(0, -16);
    ctx.rotate(-1.45);
    ctx.fillStyle = suitDark;
    ctx.fillRect(-4, 6, 9, 36);
    ctx.fillStyle = suit;
    ctx.beginPath();
    ctx.roundRect(-11, -26, 22, 36, 8);
    ctx.fill();
    ctx.fillStyle = "#eaf4ff";
    ctx.beginPath();
    ctx.arc(0, -34, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#16314c";
    ctx.beginPath();
    ctx.roundRect(-7, -38, 15, 8, 4);
    ctx.fill();
  } else {
    const legA = air || jetting ? -0.5 : swing * 0.9,
      legB = air || jetting ? 0.35 : -swing * 0.9,
      armA = air || jetting ? -2.4 : -swing * 0.9,
      armB = air || jetting ? -2.0 : swing * 0.9,
      bob = air || jetting ? 0 : Math.abs(swing) * -3;
    ctx.translate(0, bob);
    const leg = (a: number, shade: string) => {
      ctx.save();
      ctx.translate(0, -26);
      ctx.rotate(a);
      ctx.fillStyle = shade;
      ctx.beginPath();
      ctx.roundRect(-4, 0, 9, 26, 4);
      ctx.fill();
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.roundRect(-5, 22, 12, 6, 3);
      ctx.fill();
      ctx.restore();
    };
    leg(legA, suitDark);
    // Backpack and torso.
    ctx.fillStyle = "#245a73";
    ctx.beginPath();
    ctx.roundRect(-16, -62, 10, 28, 4);
    ctx.fill();
    ctx.fillStyle = suit;
    ctx.beginPath();
    ctx.roundRect(-12, -66, 24, 42, 9);
    ctx.fill();
    ctx.fillStyle = accent;
    ctx.fillRect(-12, -42, 24, 5);
    leg(legB, suit);
    const arm = (a: number, shade: string) => {
      ctx.save();
      ctx.translate(0, -60);
      ctx.rotate(a);
      ctx.fillStyle = shade;
      ctx.beginPath();
      ctx.roundRect(-3.5, 0, 8, 26, 4);
      ctx.fill();
      ctx.restore();
    };
    arm(armA, suitDark);
    arm(armB, suit);
    // Helmet with visor.
    ctx.fillStyle = "#eaf4ff";
    ctx.beginPath();
    ctx.arc(1, -76, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#16314c";
    ctx.beginPath();
    ctx.roundRect(1, -81, 14, 10, 5);
    ctx.fill();
    ctx.fillStyle = "rgba(120,220,255,.6)";
    ctx.fillRect(5, -79, 7, 2);
  }
  ctx.restore();
}

function render(ctx: CanvasRenderingContext2D, s: MetroStateV2) {
  const meters = metroMeters(s),
    tier = Math.min(4, Math.floor(meters / 450)),
    sinceHit = s.tick - s.lastDamageTick,
    jet = s.tick < s.jetUntil;
  drawSpaceBackdrop(ctx, 390, 620, s.distance / 20000, s.tick);
  ctx.save();
  if (sinceHit >= 0 && sinceHit < 24) {
    // Short camera shake after a crash.
    const amp = (1 - sinceHit / 24) * 6;
    ctx.translate(Math.sin(sinceHit * 2.7) * amp, Math.cos(sinceHit * 3.1) * amp * 0.6);
  }
  drawWorld(ctx, s, tier);
  // Everything ahead, far to near (so nearer objects overlap farther ones).
  const d = s.distance,
    items: { dz: number; draw: () => void }[] = [];
  for (let i = Math.max(0, s.obstacleCursor - 2); i < s.obstacles.length; i++) {
    const o = s.obstacles[i];
    if (o.z - d > MAX_DEPTH) break;
    if (o.z + o.len - d < -60000) continue;
    items.push({
      dz: o.z - d,
      draw: () =>
        o.kind === "train" ? drawTrain(ctx, o, i, d, s.tick) : o.kind === "low" ? drawLow(ctx, o, d) : drawHigh(ctx, o, d, s.tick),
    });
  }
  for (let i = s.coinCursor; i < s.coins.length; i++) {
    const c = s.coins[i];
    if (c.z - d > MAX_DEPTH) break;
    if (c.state === 1) continue;
    items.push({ dz: c.z - d, draw: () => drawCoin(ctx, METRO_V2_LANES[c.lane], c.z - d, c.air, s.tick * 0.09 + i, jet) });
  }
  for (let i = s.pickupCursor; i < s.pickups.length; i++) {
    const p = s.pickups[i];
    if (p.z - d > MAX_DEPTH) break;
    if (p.state === 1) continue;
    items.push({ dz: p.z - d, draw: () => drawPickup(ctx, p.kind, METRO_V2_LANES[p.lane], p.z - d, s.tick) });
  }
  items.sort((a, b) => b.dz - a.dz);
  // Anything behind the runner is drawn after it; the rest before.
  const behind = items.filter((it) => it.dz < 0),
    ahead = items.filter((it) => it.dz >= 0);
  for (const it of ahead) it.draw();
  drawRunner(ctx, s);
  for (const it of behind) it.draw();
  // Speed streaks: faster at higher speed and while flying.
  const speed = metroSpeedV2(s);
  const streaks = jet ? 14 : speed > 2400 ? 8 : speed > 1900 ? 4 : 0;
  ctx.strokeStyle = jet ? "rgba(255,210,150,.5)" : "rgba(190,230,255,.28)";
  ctx.lineWidth = 1.5;
  for (let i = 0; i < streaks; i++) {
    const side = i % 2 ? 1 : -1,
      t = ((s.tick * 0.025 + hash(i + 3) * 7) % 1),
      x = 195 + side * (150 + hash(i) * 40) * (0.4 + t),
      y = HORIZON + 40 + t * 420;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + side * 4 * t, y + 26 * t);
    ctx.stroke();
  }
  ctx.restore();
  // Damage vignette and pickup flashes.
  if (sinceHit >= 0 && sinceHit < 40) {
    ctx.fillStyle = `rgba(230,70,100,${0.28 * (1 - sinceHit / 40)})`;
    ctx.fillRect(0, 0, 390, 620);
  }
  const coinAge = s.tick - s.lastCoinTick;
  if (coinAge >= 0 && coinAge < 20) {
    ctx.fillStyle = `rgba(255,214,90,${1 - coinAge / 20})`;
    ctx.font = "bold 16px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("+10", 195 + (s.x - 195000) * (LANE_PX / 100000), GROUND - 100 - coinAge * 1.5 + s.jumpY / 1000);
  }
  const pickAge = s.tick - s.lastPickupTick;
  if (pickAge >= 0 && pickAge < 40) {
    ctx.strokeStyle = `rgba(255,230,160,${1 - pickAge / 40})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(195 + (s.x - 195000) * (LANE_PX / 100000), GROUND - 40 + s.jumpY / 1000, 22 + pickAge * 1.4, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Lives (hearts), jet timer and the coin counter.
  ctx.fillStyle = "#ffd75a";
  ctx.beginPath();
  ctx.arc(26, 100, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e9f6ff";
  ctx.font = "bold 14px system-ui";
  ctx.textAlign = "left";
  ctx.fillText(String(s.coinCount), 38, 105);
  if (jet) {
    const left = (s.jetUntil - s.tick) / METRO_V2.jetTicks;
    ctx.fillStyle = "rgba(10,20,36,.6)";
    ctx.fillRect(110, 96, 170, 8);
    ctx.fillStyle = "#ffae4d";
    ctx.fillRect(110, 96, 170 * left, 8);
  }
}

const keys = {
  ArrowLeft: "LEFT",
  ArrowRight: "RIGHT",
  ArrowUp: "JUMP",
  ArrowDown: "SLIDE",
  a: "LEFT",
  d: "RIGHT",
  w: "JUMP",
  s: "SLIDE",
  " ": "JUMP",
} as const;
const inputTones = { LEFT: "tap", RIGHT: "tap", JUMP: "tap", SLIDE: "tap" } as const;
const hudLabel = (s: Readonly<MetroStateV2>) => `${metroMeters(s)} m`;
const gestureAction = (from: { x: number; y: number }, to: { x: number; y: number }) => {
  const dx = to.x - from.x,
    dy = to.y - from.y,
    ax = Math.abs(dx),
    ay = Math.abs(dy);
  if (Math.max(ax, ay) < 24) return null;
  if (ax >= ay) return dx < 0 ? "LEFT" : "RIGHT";
  return dy < 0 ? "JUMP" : "SLIDE";
};

export default function MetroRunner(props: GameRuntimeProps) {
  return (
    <div className="metroShiftVerified">
      <CoreCanvasGame
        {...props}
        core={METRO_CORE_V2}
        name="Metro Shift"
        render={render}
        hudLabel={hudLabel}
        keys={keys}
        gestureAction={gestureAction}
        inputTones={inputTones}
        instruction="Desliza: ← → cambia de vía · ↑ salta · ↓ te desliza"
      />
    </div>
  );
}
