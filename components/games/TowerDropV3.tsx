"use client";
import type { GameRuntimeProps } from "@/lib/games";
import { drawSpaceBackdrop } from "@/lib/spaceBackdrop";
import {
  TOWER_DROP_CORE_V5,
  TOWER_DROP_V3,
  type TowerDropV5State as TowerDropV3State,
} from "@/lib/verified/towerDropCore.v5";
import CoreCanvasGame from "./CoreCanvasGame";
import { t, formatNumber, useI18n } from "@/lib/i18n";
// Presentation-only smoothing. Never read by the core; a new run (tick going
// backwards) resets it, so replays and previews stay deterministic.
const motion = { tick: -1, offsetY: Number.NaN, jaw: 1 };
/**
 * v123 · Realistic loss: the core discards a failed block the moment it tips past 78° or drops past the landing line.
 * The renderer keeps the last pose and lets it go on as a rigid body — it keeps the spin it had while toppling over
 * the edge, scrapes the side of the tower and falls away under the same gravity (820 px/s²), with a puff of dust.
 * Presentation only: never read by the core; a new run (tick going backwards) clears it.
 */
type Pose = { kind: "tip" | "fall"; tick: number; cx: number; cy: number; angle: number; omega: number; vx: number; vy: number; w: number; level: number };
type Debris = Pose & { born: number; edge: number; dir: number; scraped: boolean };
const GRAVITY_PX_TICK2 = 820 / (120 * 120);
const fall = { lastPose: null as Pose | null, lastLoss: -1, items: [] as Debris[], dust: [] as { x: number; y: number; vx: number; vy: number; born: number }[] };
function ease(state: TowerDropV3State, offsetY: number, gripping: boolean) {
  // Backwards or repeated ticks (new run, resize redraw, test) snap in place.
  if (state.tick < motion.tick) { fall.lastPose = null; fall.lastLoss = state.lastLossTick; fall.items = []; fall.dust = []; }
  if (state.tick <= motion.tick || Number.isNaN(motion.offsetY)) {
    motion.offsetY = offsetY;
    motion.jaw = gripping ? 0 : 1;
  } else if (state.tick !== motion.tick) {
    const steps = Math.min(8, state.tick - motion.tick);
    for (let n = 0; n < steps; n++) {
      // The tower glides down instead of jumping when a layer is added.
      motion.offsetY += (offsetY - motion.offsetY) * 0.07;
      motion.jaw += ((gripping ? 0 : 1) - motion.jaw) * 0.22;
    }
    if (Math.abs(offsetY - motion.offsetY) < 0.05) motion.offsetY = offsetY;
  }
  motion.tick = state.tick;
  return motion.offsetY;
}
const CONTAINER = [
  ["#e8742c", "#b9551b"], ["#1f8fa6", "#156a7c"], ["#d2343f", "#9c222b"], ["#e9b730", "#b58a1c"],
  ["#3e5fbf", "#2c4590"], ["#d9dee6", "#a9b1bd"], ["#4caf6e", "#357d4e"], ["#8a55d6", "#6439a6"],
] as const;
/** A space cargo container: corrugated walls, corner castings, a hazard band, ID plate and status lights. */
function container(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, level: number, h: number, tick: number) {
  const [face, shade] = CONTAINER[level % CONTAINER.length];
  if (w <= 0.5) return;
  const top = Math.min(5, h / 5);
  // Body with vertical shading.
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, face); g.addColorStop(0.55, face); g.addColorStop(1, shade);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  if (h >= 10 && w >= 14) {
    // Corrugation ribs.
    for (let n = x + 7; n < x + w - 5; n += 7) {
      ctx.fillStyle = "rgba(0,0,0,.16)"; ctx.fillRect(n, y + top + 2, 2, h - top - 6);
      ctx.fillStyle = "rgba(255,255,255,.12)"; ctx.fillRect(n + 2, y + top + 2, 1, h - top - 6);
    }
    // Hazard band.
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y + h - 7, w, 4); ctx.clip();
    ctx.fillStyle = "#1a1d24"; ctx.fillRect(x, y + h - 7, w, 4);
    ctx.fillStyle = "#ffd23f";
    for (let n = x - 8; n < x + w + 8; n += 8) { ctx.beginPath(); ctx.moveTo(n, y + h - 3); ctx.lineTo(n + 4, y + h - 7); ctx.lineTo(n + 8, y + h - 7); ctx.lineTo(n + 4, y + h - 3); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    // ID plate and status light.
    if (w >= 46) {
      ctx.fillStyle = "rgba(8,14,26,.78)";
      ctx.fillRect(x + w / 2 - 15, y + top + 3, 30, 10);
      ctx.fillStyle = "#e9f4ff";
      ctx.font = "bold 7px ui-monospace, Menlo, monospace";
      ctx.textAlign = "center";
      ctx.fillText(`GX-${String(level + 1).padStart(2, "0")}`, x + w / 2, y + top + 10.5);
      ctx.textAlign = "left";
    }
    const blink = Math.floor((tick + level * 17) / 40) % 2 === 0;
    ctx.fillStyle = blink ? "#5cffb0" : "rgba(92,255,176,.25)";
    ctx.beginPath(); ctx.arc(x + w - 6, y + top + 6, 2, 0, Math.PI * 2); ctx.fill();
  }
  // Roof edge and corner castings.
  ctx.fillStyle = "rgba(255,255,255,.32)"; ctx.fillRect(x, y, w, top);
  ctx.fillStyle = "rgba(0,0,0,.22)"; ctx.fillRect(x, y + top, w, 1);
  if (h >= 10) {
    ctx.fillStyle = "#2a2f3a";
    for (const cx of [x, x + w - 5]) { ctx.fillRect(cx, y, 5, 5); ctx.fillRect(cx, y + h - 5, 5, 5); }
  }
  ctx.strokeStyle = "rgba(0,0,0,.35)"; ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

function render(ctx: CanvasRenderingContext2D, state: TowerDropV3State, view?: { width: number; height: number }) {
  const viewH = Math.max(620, view?.height ?? 620);
  drawSpaceBackdrop(ctx, 390, viewH, 1, state.tick);
  const floor = 540,
    blockH = 30,
    // The base starts at the bottom edge of the screen, whatever its height.
    groundScreenY = viewH - 34,
    pivotY = floor - blockH - 320 - TOWER_DROP_V3.ropeLengthMilli / 1000,
    craneTop = pivotY - 52;
  // Constant zoom, like Stack: the camera follows the newest layer; once the tower reaches the working height
  // the whole tower — base included — slides down and off the bottom of the screen.
  const scale = 0.72,
    landingScreenY = Math.max(
      86 + (floor - craneTop) * scale,
      groundScreenY - state.blocks.length * blockH * scale,
    ),
    offsetY = landingScreenY - floor * scale,
    groundY = floor + state.blocks.length * blockH,
    olderBlockH = blockH;
  const easedOffsetY = ease(state, offsetY, state.phase === "swing");
  ctx.save();
  ctx.translate(195 * (1 - scale), easedOffsetY);
  ctx.scale(scale, scale);
  const block = (
    x: number,
    y: number,
    w: number,
    level: number,
    h = blockH,
  ) => container(ctx, x, y, w, level, h, state.tick);
  {
    // Launch pad: a deck with landing lights, standing on a pylon that runs off the bottom of the screen.
    const deck = ctx.createLinearGradient(0, groundY, 0, groundY + 18);
    deck.addColorStop(0, "#5f7d93"); deck.addColorStop(1, "#22384a");
    ctx.fillStyle = "#101c2a";
    ctx.fillRect(120, groundY + 16, 150, 900);
    ctx.fillStyle = "rgba(127,227,238,.12)";
    for (let yy = groundY + 30; yy < groundY + 900; yy += 26) ctx.fillRect(126, yy, 138, 3);
    ctx.fillStyle = deck;
    ctx.fillRect(35, groundY, 320, 18);
    ctx.fillStyle = "#9fe7ee";
    ctx.fillRect(35, groundY, 320, 2);
    for (let x = 48; x < 345; x += 30) {
      const on = Math.floor(state.tick / 18 + x / 30) % 4 === 0;
      ctx.fillStyle = on ? "#ffd23f" : "rgba(255,210,63,.3)";
      ctx.fillRect(x, groundY + 8, 10, 3);
    }
  }
  state.blocks.forEach((b, index) => {
    const fromTop = state.blocks.length - 1 - index,
      h = fromTop === 0 ? blockH : olderBlockH,
      y = fromTop === 0 ? floor : floor + blockH + (fromTop - 1) * olderBlockH;
    block(b.xMilli / 1000, y, b.wMilli / 1000, index, h);
  });
  // Planetary elevator: a tether ribbon running up out of the sky, with a lift module the hook hangs from.
  {
    const mx = 195, my = pivotY - 12, glow = 0.5 + 0.5 * Math.sin(state.tick * 0.08);
    const tether = ctx.createLinearGradient(mx - 6, 0, mx + 6, 0);
    tether.addColorStop(0, "#2b3d55"); tether.addColorStop(0.5, "#9fd6ee"); tether.addColorStop(1, "#2b3d55");
    ctx.fillStyle = tether;
    ctx.fillRect(mx - 5, my - 1600, 10, 1600);
    // Climber lights running up the ribbon.
    for (let k = 0; k < 14; k++) {
      const yy = my - 40 - ((k * 120 + state.tick * 2.2) % 1600);
      ctx.fillStyle = k % 3 === 0 ? "rgba(255,210,63,.9)" : "rgba(127,227,238,.55)";
      ctx.fillRect(mx - 2, yy, 4, 10);
    }
    // Solar wings.
    for (const side of [-1, 1]) {
      ctx.fillStyle = "#1c3354";
      ctx.fillRect(mx + side * 34 - (side < 0 ? 52 : 0), my - 20, 52, 18);
      ctx.strokeStyle = "rgba(127,227,238,.6)"; ctx.lineWidth = 1.5;
      ctx.strokeRect(mx + side * 34 - (side < 0 ? 52 : 0), my - 20, 52, 18);
      for (let c = 1; c < 4; c++) { const gx = mx + side * 34 - (side < 0 ? 52 : 0) + c * 13; ctx.beginPath(); ctx.moveTo(gx, my - 20); ctx.lineTo(gx, my - 2); ctx.stroke(); }
      ctx.fillStyle = "#7d8aa0"; ctx.fillRect(mx + side * 22 - (side < 0 ? 12 : 0), my - 13, 12, 4);
    }
    // Module body (capsule) with a window band and status lamps.
    const body = ctx.createLinearGradient(0, my - 34, 0, my + 12);
    body.addColorStop(0, "#e9f4ff"); body.addColorStop(0.5, "#9fb4c8"); body.addColorStop(1, "#5d6f84");
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.roundRect(mx - 24, my - 34, 48, 46, 14); ctx.fill();
    ctx.fillStyle = "#c4eff8";
    ctx.fillRect(mx - 14, my - 22, 28, 9);
    ctx.fillStyle = "#0b1a2e"; ctx.fillRect(mx - 12, my - 20, 24, 5);
    ctx.fillStyle = `rgba(92,255,176,${0.4 + 0.6 * glow})`;
    ctx.beginPath(); ctx.arc(mx - 15, my + 2, 3, 0, Math.PI * 2); ctx.arc(mx + 15, my + 2, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#2a2f3a"; ctx.fillRect(mx - 6, my + 8, 12, 6);
  }
  const hookX = (state.movingXMilli + state.movingWMilli / 2) / 1000,
    hookY = floor - blockH - 320 - state.hookRiseMilli / 1000;
  ctx.strokeStyle = "#d2effb";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(195, pivotY);
  ctx.lineTo(hookX, hookY);
  ctx.stroke();
  if (state.phase === "swing") {
    block(
      state.movingXMilli / 1000,
      hookY,
      state.movingWMilli / 1000,
      state.height + 1,
    );
  } else {
    const x = state.fallXMilli / 1000,
      y = floor - blockH - 320 + state.fallYMilli / 1000;
    if (state.phase === "tipping-left" || state.phase === "tipping-right") {
      const pivot = state.tipPivotXMilli / 1000;
      {
        // Remember the pose (centre, angle, spin) so the block can carry on after the core lets it go.
        const ang = (((state.tipDirection * state.tipAngleMilliDeg) / 1000) * Math.PI) / 180;
        const lx = x - pivot + state.movingWMilli / 2000, ly = -blockH / 2;
        const omega = (state.tipDirection * state.tipAngularVelocityMilliDegPerSecond / 1000) * Math.PI / 180 / 120;
        const rx = lx * Math.cos(ang) - ly * Math.sin(ang), ry = lx * Math.sin(ang) + ly * Math.cos(ang);
        fall.lastPose = { kind: "tip", tick: state.tick, cx: pivot + rx, cy: floor + ry, angle: ang, omega, vx: -omega * ry, vy: omega * rx, w: state.movingWMilli / 1000, level: state.height + 1 };
      }
      ctx.save();
      ctx.translate(pivot, floor);
      ctx.rotate(
        (((state.tipDirection * state.tipAngleMilliDeg) / 1000) * Math.PI) /
          180,
      );
      block(x - pivot, -blockH, state.movingWMilli / 1000, state.height + 1);
      ctx.restore();
    } else {
      block(x, y, state.movingWMilli / 1000, state.height + 1);
      if (state.phase === "falling-out") {
        const w = state.movingWMilli / 1000;
        fall.lastPose = { kind: "fall", tick: state.tick, cx: x + w / 2, cy: y + blockH / 2, angle: 0, omega: (state.fallVXMilliPerSecond / 1000 / 120) / 70, vx: state.fallVXMilliPerSecond / 1000 / 120, vy: state.fallVYMilliPerSecond / 1000 / 120, w, level: state.height + 1 };
      }
    }
  }
  // A life was just lost: the block that the core discarded carries on as a falling rigid body.
  if (state.lastLossTick >= 0 && state.lastLossTick !== fall.lastLoss) {
    fall.lastLoss = state.lastLossTick;
    const p = fall.lastPose;
    if (p && state.lastLossTick - p.tick < 12) {
      const top = state.blocks[state.blocks.length - 1];
      const dir = p.kind === "tip" ? Math.sign(p.omega) || 1 : Math.sign(p.vx) || (p.cx < 195 ? -1 : 1);
      const edge = top ? (dir > 0 ? top.xMilli / 1000 + top.wMilli / 1000 : top.xMilli / 1000) : 195;
      fall.items.push({ ...p, born: state.lastLossTick, edge, dir, scraped: false });
      if (p.kind === "tip") for (let k = 0; k < 10; k++) fall.dust.push({ x: edge, y: floor, vx: dir * (0.3 + (k % 5) * 0.25), vy: -0.4 - (k % 3) * 0.3, born: state.lastLossTick });
    }
    fall.lastPose = null;
  }
  for (const d of fall.items) {
    const t = state.tick - d.born;
    if (t < 0) continue;
    // Free flight from the release pose; a small air drag on the spin; it scrapes the tower edge once if it would cut into it.
    let cx = d.cx + d.vx * t, cy = d.cy + d.vy * t + 0.5 * GRAVITY_PX_TICK2 * t * t;
    const reach = Math.hypot(d.w / 2, blockH / 2) * 0.6;
    // It cannot pass through the tower: find the outermost face of every layer (and the deck, then the pylon) it
    // overlaps vertically, and keep it outside that face — it scrapes down the side and drops past the wider steps.
    const yTop = cy - reach, yBot = cy + reach;
    let face = d.dir > 0 ? -Infinity : Infinity;
    state.blocks.forEach((b, index) => {
      const fromTop = state.blocks.length - 1 - index, by = fromTop === 0 ? floor : floor + blockH + (fromTop - 1) * olderBlockH;
      if (yBot > by && yTop < by + blockH) face = d.dir > 0 ? Math.max(face, (b.xMilli + b.wMilli) / 1000) : Math.min(face, b.xMilli / 1000);
    });
    if (yBot > groundY && yTop < groundY + 18) face = d.dir > 0 ? Math.max(face, 355) : Math.min(face, 35);
    if (yBot > groundY + 18) face = d.dir > 0 ? Math.max(face, 270) : Math.min(face, 120);
    if (Number.isFinite(face) && ((d.dir > 0 && cx - reach < face) || (d.dir < 0 && cx + reach > face))) cx = face + d.dir * reach;
    const angle = d.angle + d.omega * t * (1 - Math.min(0.35, t / 600));
    if (cy > floor + 1400) continue;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    block(-d.w / 2, -blockH / 2, d.w, d.level);
    ctx.restore();
  }
  fall.items = fall.items.filter((d) => state.tick - d.born < 900);
  for (const p of fall.dust) {
    const t = state.tick - p.born;
    if (t < 0 || t > 70) continue;
    ctx.fillStyle = `rgba(210,225,240,${0.5 * (1 - t / 70)})`;
    ctx.beginPath(); ctx.arc(p.x + p.vx * t, p.y + p.vy * t + 0.012 * t * t, 2 + t * 0.06, 0, Math.PI * 2); ctx.fill();
  }
  fall.dust = fall.dust.filter((p) => state.tick - p.born <= 70);
  // Hinged claw: the arms clamp the block's top corners while it swings and
  // swing upward and outward after DROP, so the release is visible. Presentation only.
  const open = motion.jaw,
    reach = Math.max(24, state.movingWMilli / 1000 / 2),
    tilt = open * 0.95;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const side of [-1, 1]) {
    const local: [number, number][] = [
      [0, 0],
      [reach * 0.5, -4],
      [reach, 2],
      [reach - 1, 24],
    ];
    const tip = local.map(([lx, ly]) => [
      hookX + side * (lx * Math.cos(tilt) + ly * Math.sin(tilt)),
      hookY - 2 + (-lx * Math.sin(tilt) + ly * Math.cos(tilt)),
    ]);
    for (const [color, width] of [["#0a2b3e", 8], ["#a4f9ed", 4.5]] as const) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(tip[0][0], tip[0][1]);
      for (const point of tip.slice(1)) ctx.lineTo(point[0], point[1]);
      ctx.stroke();
    }
    ctx.fillStyle = "#fff3c4";
    ctx.beginPath();
    ctx.arc(tip[3][0], tip[3][1], 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#88fff2";
  ctx.strokeStyle = "#0a2b3e";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(hookX, hookY - 2, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.lineCap = "butt";
  ctx.font = "bold 13px system-ui";
  ctx.textAlign = "center";
  ctx.fillStyle = "#c4f1fa";
  if (state.combo > 1) ctx.fillText(t("play.perfect", { n: state.combo }), 195, 112);
  ctx.textAlign = "left";
  ctx.restore();
  // Lives: three hearts, the lost ones dim; a red pulse right after a loss.
  const sinceLoss = state.lastLossTick >= 0 ? state.tick - state.lastLossTick : Infinity;
  for (let n = 0; n < 3; n++) {
    const cx = 330 + n * 20,
      cy = 26,
      alive = n < state.lives,
      pulse = !alive && sinceLoss < 90 ? 1 - sinceLoss / 90 : 0;
    ctx.fillStyle = alive ? "#ff6f8e" : `rgba(120,140,160,${0.28 + pulse * 0.5})`;
    ctx.beginPath();
    ctx.arc(cx - 3.2, cy - 1.5, 4.2, 0, Math.PI * 2);
    ctx.arc(cx + 3.2, cy - 1.5, 4.2, 0, Math.PI * 2);
    ctx.moveTo(cx - 7.2, cy - 0.2);
    ctx.lineTo(cx, cy + 8);
    ctx.lineTo(cx + 7.2, cy - 0.2);
    ctx.closePath();
    ctx.fill();
  }
}
const keys = { " ": "DROP", Enter: "DROP" } as const;
export default function TowerDropV3(props: GameRuntimeProps) {
  useI18n();
  return (
    <CoreCanvasGame
      {...props}
      core={TOWER_DROP_CORE_V5}
      name="Tower Drop"
      hideHudScore
      render={render}
      expandVerticalViewport
      primaryAction="DROP"
      keys={keys}
      instruction={t("tower.instruction")}
    />
  );
}
