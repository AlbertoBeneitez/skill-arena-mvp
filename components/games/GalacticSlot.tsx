"use client";
import type { GameRuntimeProps } from "@/lib/games";
import type { SlotState } from "@/lib/verified/galacticSlotCore.v1";
import { SLOT_CORE_V4, SLOT_RULES_V4, SLOT_SYMBOLS_V4 } from "@/lib/verified/galacticSlotCore.v4";
import { drawSpaceBackdrop } from "@/lib/spaceBackdrop";
import { slotVisibleSteps, slotReelPosition } from "@/lib/slotPresentation.v2";
import CoreCanvasGame from "./CoreCanvasGame";
import type { ScoreCell } from "../GameScoreboard";

import { t, formatNumber, useI18n } from "@/lib/i18n";
/*
 * Presentation only: a lit arcade cabinet. Reads the authoritative state (strips, positions, steps, payouts) and
 * never writes it; every animation is a pure function of the tick.
 */
// v153: seven symbols (lemon, cherry, bell, star, BAR, gem, seven; id 1, the orange, is retired in V4).
const colors = ["#ffe62e", "#ff8a12", "#ff1f4f", "#ffc94a", "#ffd21a", "#8f7bff", "#2ee8ff", "#ff2440"];
const GOLD = "#ffd36a";
const BULB_COLORS = ["#ffd36a", "#ff4fb8", "#3ff0ff", "#9dff5a"];
const hash01 = (n: number) => { const q = Math.sin(n * 12.9898) * 43758.5453; return q - Math.floor(q); };

/** A leaf with a centre vein, pointing along `angle`. */
function leaf(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, angle: number) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  const g = ctx.createLinearGradient(0, -len * 0.3, 0, len * 0.3);
  g.addColorStop(0, "#9df08a"); g.addColorStop(1, "#1f7a34");
  ctx.fillStyle = g; ctx.strokeStyle = "#0d3a18"; ctx.lineWidth = Math.max(0.8, len * 0.07);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(len * 0.5, -len * 0.42, len, 0); ctx.quadraticCurveTo(len * 0.5, len * 0.42, 0, 0); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = "rgba(13,58,24,.7)"; ctx.lineWidth = Math.max(0.6, len * 0.05);
  ctx.beginPath(); ctx.moveTo(len * 0.1, 0); ctx.lineTo(len * 0.85, 0); ctx.stroke();
  ctx.restore();
}
/** Soft white gloss spot. */
function gloss(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot = -0.5, alpha = 0.7) {
  ctx.fillStyle = `rgba(255,255,255,${alpha})`;
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); ctx.fill();
}

function paintSymbol(ctx: CanvasRenderingContext2D, id: number, x: number, y: number, size: number, glow = false) {
  const u = size, line = Math.max(1, u * 0.045);
  ctx.save();
  ctx.translate(x, y);
  ctx.lineJoin = "round"; ctx.lineCap = "round";
  const lit = () => { if (glow) { ctx.shadowColor = colors[id]; ctx.shadowBlur = u * 0.5; } };
  const unlit = () => { ctx.shadowBlur = 0; };
  if (id === 0 || id === 1) {
    // Lemon: pointed ends, peel dimples, a gloss and a leaf.
    ctx.save(); ctx.rotate(-0.38);
    const g = ctx.createRadialGradient(-u * 0.12, -u * 0.1, u * 0.03, 0, 0, u * 0.4);
    g.addColorStop(0, "#fffbd6"); g.addColorStop(0.4, "#ffe62e"); g.addColorStop(1, "#c08a00");
    ctx.fillStyle = g; ctx.strokeStyle = "#5c3f00"; ctx.lineWidth = line;
    lit();
    ctx.beginPath();
    ctx.moveTo(-u * 0.42, 0);
    ctx.bezierCurveTo(-u * 0.36, -u * 0.32, u * 0.36, -u * 0.32, u * 0.42, 0);
    ctx.bezierCurveTo(u * 0.36, u * 0.32, -u * 0.36, u * 0.32, -u * 0.42, 0);
    ctx.closePath(); ctx.fill(); unlit(); ctx.stroke();
    ctx.fillStyle = "rgba(150,100,0,.35)";
    for (let k = 0; k < 7; k++) { ctx.beginPath(); ctx.arc((hash01(k + 3) - 0.5) * u * 0.5, (hash01(k + 11) - 0.5) * u * 0.3, u * 0.018, 0, Math.PI * 2); ctx.fill(); }
    gloss(ctx, -u * 0.13, -u * 0.1, u * 0.13, u * 0.055, -0.2, 0.75);
    ctx.restore();
    leaf(ctx, u * 0.16, -u * 0.2, u * 0.3, -0.9);
  } else if (id === 2) {
    // Cherries: two glossy drupes on stems joined under a leaf.
    ctx.strokeStyle = "#2f6a2a"; ctx.lineWidth = Math.max(1, u * 0.055);
    ctx.beginPath(); ctx.moveTo(-u * 0.19, u * 0.0); ctx.quadraticCurveTo(-u * 0.12, -u * 0.3, u * 0.06, -u * 0.4);
    ctx.moveTo(u * 0.2, u * 0.04); ctx.quadraticCurveTo(u * 0.2, -u * 0.22, u * 0.06, -u * 0.4); ctx.stroke();
    leaf(ctx, u * 0.06, -u * 0.4, u * 0.28, -0.25);
    for (const [cx, cy] of [[-u * 0.19, u * 0.14], [u * 0.2, u * 0.18]] as const) {
      const g = ctx.createRadialGradient(cx - u * 0.07, cy - u * 0.07, u * 0.02, cx, cy, u * 0.22);
      g.addColorStop(0, "#ffd8de"); g.addColorStop(0.35, "#ff1f4f"); g.addColorStop(1, "#6a0018");
      ctx.fillStyle = g; ctx.strokeStyle = "#3a000c"; ctx.lineWidth = line;
      lit(); ctx.beginPath(); ctx.arc(cx, cy, u * 0.2, 0, Math.PI * 2); ctx.fill(); unlit(); ctx.stroke();
      gloss(ctx, cx - u * 0.07, cy - u * 0.07, u * 0.06, u * 0.035, -0.7, 0.85);
    }
  } else if (id === 3) {
    // Bell: polished gold with a rim band, a knob and a clapper.
    const g = ctx.createLinearGradient(-u * 0.34, 0, u * 0.34, 0);
    g.addColorStop(0, "#9a6a1c"); g.addColorStop(0.3, "#ffe6a0"); g.addColorStop(0.55, "#ffc94a"); g.addColorStop(1, "#7d5210");
    ctx.fillStyle = "#c08a2a"; ctx.strokeStyle = "#4a2c00"; ctx.lineWidth = line;
    ctx.beginPath(); ctx.arc(0, -u * 0.36, u * 0.06, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = g; lit();
    ctx.beginPath();
    ctx.moveTo(-u * 0.38, u * 0.2);
    ctx.quadraticCurveTo(-u * 0.26, u * 0.1, -u * 0.24, -u * 0.1);
    ctx.quadraticCurveTo(-u * 0.22, -u * 0.34, 0, -u * 0.34);
    ctx.quadraticCurveTo(u * 0.22, -u * 0.34, u * 0.24, -u * 0.1);
    ctx.quadraticCurveTo(u * 0.26, u * 0.1, u * 0.38, u * 0.2);
    ctx.closePath(); ctx.fill(); unlit(); ctx.stroke();
    const band = ctx.createLinearGradient(-u * 0.4, 0, u * 0.4, 0);
    band.addColorStop(0, "#7d5210"); band.addColorStop(0.35, "#ffe9b0"); band.addColorStop(1, "#6a420a");
    ctx.fillStyle = band; ctx.beginPath(); ctx.roundRect(-u * 0.41, u * 0.17, u * 0.82, u * 0.1, u * 0.05); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#6a420a"; ctx.beginPath(); ctx.arc(0, u * 0.34, u * 0.07, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,.65)"; ctx.lineWidth = Math.max(1, u * 0.05);
    ctx.beginPath(); ctx.moveTo(-u * 0.13, -u * 0.22); ctx.quadraticCurveTo(-u * 0.17, -u * 0.02, -u * 0.2, u * 0.1); ctx.stroke();
  } else if (id === 4) {
    // Star: five bevelled points (a light and a dark facet each).
    const R1 = u * 0.44, R2 = u * 0.19, pts: [number, number][] = [];
    for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, r = k % 2 ? R2 : R1; pts.push([Math.cos(a) * r, Math.sin(a) * r + u * 0.03]); }
    ctx.fillStyle = "#ffd21a"; ctx.strokeStyle = "#6b3d00"; ctx.lineWidth = line * 1.2;
    lit(); ctx.beginPath(); pts.forEach(([px, py], k) => (k ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.closePath(); ctx.fill(); unlit();
    for (let k = 0; k < 10; k += 2) {
      const tip = pts[k], prev = pts[(k + 9) % 10], next = pts[k + 1];
      ctx.fillStyle = "#fff3b0"; ctx.beginPath(); ctx.moveTo(0, u * 0.03); ctx.lineTo(prev[0], prev[1]); ctx.lineTo(tip[0], tip[1]); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#e09a00"; ctx.beginPath(); ctx.moveTo(0, u * 0.03); ctx.lineTo(tip[0], tip[1]); ctx.lineTo(next[0], next[1]); ctx.closePath(); ctx.fill();
    }
    ctx.beginPath(); pts.forEach(([px, py], k) => (k ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.closePath(); ctx.stroke();
    gloss(ctx, -u * 0.05, -u * 0.08, u * 0.05, u * 0.03, 0, 0.8);
  } else if (id === 5) {
    // BAR: an enamelled plate with a double gold border, rivets and embossed letters.
    const plate = ctx.createLinearGradient(0, -u * 0.22, 0, u * 0.22);
    plate.addColorStop(0, "#7a5cff"); plate.addColorStop(0.5, "#2a0f9e"); plate.addColorStop(1, "#12054a");
    ctx.fillStyle = plate; ctx.strokeStyle = "#ffd36a"; ctx.lineWidth = Math.max(1.2, u * 0.06);
    lit(); ctx.beginPath(); ctx.roundRect(-u * 0.45, -u * 0.22, u * 0.9, u * 0.44, u * 0.09); ctx.fill(); unlit(); ctx.stroke();
    ctx.strokeStyle = "rgba(255,211,106,.55)"; ctx.lineWidth = Math.max(0.7, u * 0.025);
    ctx.beginPath(); ctx.roundRect(-u * 0.38, -u * 0.155, u * 0.76, u * 0.31, u * 0.06); ctx.stroke();
    ctx.fillStyle = "#ffd36a";
    for (const [rx, ry] of [[-0.41, -0.18], [0.41, -0.18], [-0.41, 0.18], [0.41, 0.18]]) { ctx.beginPath(); ctx.arc(rx * u, ry * u, u * 0.022, 0, Math.PI * 2); ctx.fill(); }
    ctx.font = `900 ${u * 0.27}px system-ui`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.lineWidth = Math.max(1, u * 0.05); ctx.strokeStyle = "#0c0336"; ctx.strokeText("BAR", 0, u * 0.015);
    const tg = ctx.createLinearGradient(0, -u * 0.12, 0, u * 0.12); tg.addColorStop(0, "#ffffff"); tg.addColorStop(1, "#c9c2ff");
    ctx.fillStyle = tg; ctx.fillText("BAR", 0, u * 0.015);
    ctx.fillStyle = "rgba(255,255,255,.22)"; ctx.beginPath(); ctx.roundRect(-u * 0.4, -u * 0.19, u * 0.8, u * 0.08, u * 0.04); ctx.fill();
  } else if (id === 6) {
    // Gem: a brilliant cut with a table, crown and pavilion facets, and a sparkle.
    const r = u * 0.4, top = -r * 0.62, girdle = -r * 0.18, tip = r * 0.95;
    const crown: [number, number][] = [[-r, girdle], [-r * 0.55, top], [r * 0.55, top], [r, girdle]];
    ctx.fillStyle = "#1fb6d6"; ctx.strokeStyle = "#063a48"; ctx.lineWidth = line;
    lit(); ctx.beginPath(); ctx.moveTo(-r, girdle); ctx.lineTo(-r * 0.55, top); ctx.lineTo(r * 0.55, top); ctx.lineTo(r, girdle); ctx.lineTo(0, tip); ctx.closePath(); ctx.fill(); unlit();
    const facet = (c: string, p: [number, number][]) => { ctx.fillStyle = c; ctx.beginPath(); p.forEach(([px, py], k) => (k ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.closePath(); ctx.fill(); };
    facet("#b8faff", [[-r * 0.55, top], [r * 0.55, top], [r * 0.3, girdle], [-r * 0.3, girdle]]);
    facet("#5fe3f7", [crown[0], crown[1], [-r * 0.3, girdle]]);
    facet("#0f8eb0", [crown[3], crown[2], [r * 0.3, girdle]]);
    facet("#7cecff", [[-r, girdle], [-r * 0.3, girdle], [0, tip]]);
    facet("#2ac4e0", [[-r * 0.3, girdle], [r * 0.3, girdle], [0, tip]]);
    facet("#0a6f8c", [[r * 0.3, girdle], [r, girdle], [0, tip]]);
    ctx.beginPath(); ctx.moveTo(-r, girdle); ctx.lineTo(-r * 0.55, top); ctx.lineTo(r * 0.55, top); ctx.lineTo(r, girdle); ctx.lineTo(0, tip); ctx.closePath(); ctx.stroke();
    ctx.strokeStyle = "rgba(6,58,72,.55)"; ctx.lineWidth = Math.max(0.6, u * 0.02);
    ctx.beginPath(); ctx.moveTo(-r, girdle); ctx.lineTo(r, girdle); ctx.stroke();
    ctx.fillStyle = "#ffffff";
    const sx = -r * 0.42, sy = top + r * 0.05, k = u * 0.1;
    ctx.beginPath(); ctx.moveTo(sx, sy - k); ctx.lineTo(sx + k * 0.22, sy - k * 0.22); ctx.lineTo(sx + k, sy); ctx.lineTo(sx + k * 0.22, sy + k * 0.22); ctx.lineTo(sx, sy + k); ctx.lineTo(sx - k * 0.22, sy + k * 0.22); ctx.lineTo(sx - k, sy); ctx.lineTo(sx - k * 0.22, sy - k * 0.22); ctx.closePath(); ctx.fill();
  } else {
    // Lucky seven: a drawn 7 (no font dependency) in red with a dark outline, a gold inline and a gloss.
    const seven = () => {
      ctx.beginPath();
      ctx.moveTo(-u * 0.3, -u * 0.4); ctx.lineTo(u * 0.32, -u * 0.4); ctx.lineTo(u * 0.32, -u * 0.27);
      ctx.quadraticCurveTo(u * 0.04, u * 0.02, u * 0.0, u * 0.42); ctx.lineTo(-u * 0.19, u * 0.42);
      ctx.quadraticCurveTo(-u * 0.14, u * 0.02, u * 0.11, -u * 0.24); ctx.lineTo(-u * 0.3, -u * 0.24); ctx.closePath();
    };
    seven(); ctx.strokeStyle = "#2a0008"; ctx.lineWidth = Math.max(2, u * 0.13); ctx.stroke();
    seven(); ctx.strokeStyle = "#ffd36a"; ctx.lineWidth = Math.max(1, u * 0.055); ctx.stroke();
    const g = ctx.createLinearGradient(0, -u * 0.4, 0, u * 0.42);
    g.addColorStop(0, "#ffb0bb"); g.addColorStop(0.35, "#ff2440"); g.addColorStop(1, "#7a0014");
    seven(); ctx.fillStyle = g; lit(); ctx.fill(); unlit();
    ctx.fillStyle = "rgba(255,255,255,.55)"; ctx.beginPath(); ctx.roundRect(-u * 0.25, -u * 0.37, u * 0.5, u * 0.045, u * 0.02); ctx.fill();
  }
  ctx.restore();
}

// Presentation only: each symbol is painted once per (id, size, glow, backing scale) into a sprite and then blitted.
// Before, every frame repainted ~30 vector symbols with their gradients and glows.
const symbolSprites = new Map<string, { c: HTMLCanvasElement; half: number }>();
function backingScale(ctx: CanvasRenderingContext2D) {
  const m = ctx.getTransform();
  return Math.min(4, Math.max(1, Math.ceil(Math.hypot(m.a, m.b) * 2) / 2));
}
function symbol(ctx: CanvasRenderingContext2D, id: number, x: number, y: number, size: number, glow = false) {
  if (typeof document === "undefined" || typeof ctx.getTransform !== "function") { paintSymbol(ctx, id, x, y, size, glow); return; }
  const k = backingScale(ctx), u = Math.round(size * 2) / 2;
  const key = `${id}:${u}:${glow ? 1 : 0}:${k}`;
  let sprite = symbolSprites.get(key);
  if (!sprite) {
    if (symbolSprites.size > 160) symbolSprites.clear();
    const half = u * (glow ? 1.25 : 0.7), c = document.createElement("canvas");
    c.width = c.height = Math.ceil(half * 2 * k);
    const g = c.getContext("2d")!;
    g.scale(k, k); paintSymbol(g, id, half, half, u, glow);
    sprite = { c, half };
    symbolSprites.set(key, sprite);
  }
  ctx.drawImage(sprite.c, x - sprite.half, y - sprite.half, sprite.half * 2, sprite.half * 2);
}

const bulbSprites = new Map<string, HTMLCanvasElement>();
/** A lit bulb with its glow, painted once (shadow blur is the costliest canvas operation on phones). */
function bulbSprite(ctx: CanvasRenderingContext2D, fill: string, glow: string) {
  const k = backingScale(ctx), key = `${fill}:${glow}:${k}`;
  let c = bulbSprites.get(key);
  if (!c) {
    c = document.createElement("canvas"); c.width = c.height = Math.ceil(24 * k);
    const g = c.getContext("2d")!; g.scale(k, k);
    g.fillStyle = fill; g.shadowColor = glow; g.shadowBlur = 9;
    g.beginPath(); g.arc(12, 12, 3, 0, Math.PI * 2); g.fill();
    bulbSprites.set(key, c);
  }
  return c;
}
/** Ring of marquee bulbs around a rectangle; chase pattern, or all flashing on a win. */
function bulbs(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, gap: number, tick: number, win: boolean) {
  const pts: [number, number][] = [];
  for (let k = 0; k <= w; k += gap) { pts.push([x + k, y]); }
  for (let k = gap; k <= h; k += gap) { pts.push([x + w, y + k]); }
  for (let k = w - gap; k >= 0; k -= gap) { pts.push([x + k, y + h]); }
  for (let k = h - gap; k > 0; k -= gap) { pts.push([x, y + k]); }
  const chase = Math.floor(tick / 6);
  pts.forEach(([px, py], i) => {
    const on = win ? Math.floor(tick / 8) % 2 === i % 2 : (i + chase) % 4 === 0;
    const hue = BULB_COLORS[i % BULB_COLORS.length];
    if (on && typeof document !== "undefined" && typeof ctx.getTransform === "function") { ctx.drawImage(bulbSprite(ctx, win ? "#fff3b0" : hue, win ? GOLD : hue), px - 12, py - 12, 24, 24); return; }
    if (on) {
      ctx.fillStyle = win ? "#fff3b0" : hue; ctx.shadowColor = win ? GOLD : hue; ctx.shadowBlur = 9;
      ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; return;
    }
    ctx.fillStyle = "rgba(255,211,106,.22)";
    ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill();
  });
}

/** Step colour: hue from blue (−3) through indigo (0) to violet (+3). */
function stepTone(step: number) {
  const f = Math.max(0, Math.min(1, (step + 3) / 6));
  return { h: Math.round(212 + f * 66), l: Math.round(70 - 4 * Math.sin(f * Math.PI)) };
}

function render(ctx: CanvasRenderingContext2D, s: SlotState, view?: { width: number; height: number }, poster = false) {
  // v126: the canvas takes the full height; the reel window grows down to use it.
  // v143: the layout follows the real logical height (520 at least, the core's): before, it assumed 620 and on short
  // phones the cabinet's lower edge, the step counters and the pair line were drawn under the buttons or the frame.
  const H = Math.max(520, view?.height ?? 620);
  drawSpaceBackdrop(ctx, 390, H, 2, s.tick);
  const since = s.tick - s.lastSettledTick, win = since < 150 && s.lastPayout > 0, spinning = s.settlingAt !== -1;
  const big = win && s.lastPayout >= 8 * SLOT_RULES_V4.costMinor;
  const compact = H < 600;
  // No marquee: the screen header already names the game and the HUD pill sits in that band.
  // The three reel tables (seeded per match): seven stops each, no captions. The highlighted row is where each reel
  // sits right now. v153: taller rows and bigger symbols (the reel captions are gone).
  const stops = s.strips[0].length;
  const tableTop = 56, rowPitch = compact ? 17 : 22, tableH = 10 + stops * rowPitch;
  const panel = ctx.createLinearGradient(0, tableTop, 0, tableTop + tableH);
  panel.addColorStop(0, "rgba(58,16,104,.92)"); panel.addColorStop(1, "rgba(18,6,48,.92)");
  ctx.fillStyle = panel;
  ctx.beginPath(); ctx.roundRect(20, tableTop, 350, tableH, 14); ctx.fill();
  ctx.strokeStyle = "rgba(200,140,255,.6)"; ctx.lineWidth = 1.2; ctx.stroke();
  // Each reel column on its own lit lane, tinted pink, cyan and gold.
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = ["rgba(255,79,184,.10)", "rgba(63,240,255,.09)", "rgba(255,211,106,.10)"][i];
    ctx.beginPath(); ctx.roundRect(85 + i * 110 - 52, tableTop + 4, 104, tableH - 8, 10); ctx.fill();
  }
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (let i = 0; i < 3; i++) {
    const x = 85 + i * 110;
    for (let j = 0; j < stops; j++) {
      const y = tableTop + 5 + j * rowPitch + rowPitch / 2;
      if (s.positions[i] === j) {
        ctx.fillStyle = "rgba(255,211,106,.24)"; ctx.strokeStyle = "rgba(255,211,106,.85)"; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.roundRect(x - 48, y - rowPitch / 2 + 1, 96, rowPitch - 2, (rowPitch - 2) / 2); ctx.fill(); ctx.stroke();
      }
      symbol(ctx, s.strips[i][j], x, y, compact ? 19 : 25);
    }
  }
  // Pay table: one card per symbol with its triple and its pair (a triple pays four pairs; three sevens, five).
  // v156: taller cards so each prize reads at a glance (amounts 15 px, was 11).
  const payTop = tableTop + tableH + 6, cardW = 47, cardH = compact ? 62 : 74, gap = 3.5;
  SLOT_SYMBOLS_V4.forEach((id, k) => {
    const x = 20 + k * (cardW + gap), y = payTop;
    const card = ctx.createLinearGradient(0, y, 0, y + cardH);
    card.addColorStop(0, `${colors[id]}4a`); card.addColorStop(0.42, "rgba(26,8,58,.94)"); card.addColorStop(1, "rgba(14,4,36,.96)");
    ctx.fillStyle = card; ctx.beginPath(); ctx.roundRect(x, y, cardW, cardH, 10); ctx.fill();
    ctx.strokeStyle = `${colors[id]}c0`; ctx.lineWidth = 1.2; ctx.stroke();
    symbol(ctx, id, x + cardW / 2, y + (compact ? 14 : 16), compact ? 22 : 26);
    ctx.textBaseline = "middle";
    for (const [row, mult, amount] of [[0, "×3", SLOT_RULES_V4.triple[id] * 5], [1, "×2", SLOT_RULES_V4.pair[id] * 5]] as const) {
      const ly = y + cardH - (compact ? 23 : 27) + row * (compact ? 14 : 16);
      ctx.font = `700 ${compact ? 8.5 : 9}px system-ui`; ctx.fillStyle = "rgba(230,222,250,.72)"; ctx.textAlign = "left"; ctx.fillText(mult, x + 3, ly + 0.5);
      const text = String(amount);
      ctx.font = `900 ${compact ? 13 : 15}px system-ui`;
      // Three-digit prizes shrink just enough to fit beside their multiplier.
      const room = cardW - 6 - 13, w = ctx.measureText(text).width;
      if (w > room) ctx.font = `900 ${Math.floor((compact ? 13 : 15) * room / w * 2) / 2}px system-ui`;
      ctx.fillStyle = row === 0 ? GOLD : "#ffe9c4"; ctx.textAlign = "right"; ctx.fillText(text, x + cardW - 3, ly);
    }
  });
  ctx.textAlign = "center";
  // Cabinet with chrome-gold frame and a ring of bulbs.
  // Below the cabinet: the step counters (26 high) and a margin, all above the buttons (the canvas ends where they start).
  const top = payTop + cardH + 18, height = Math.max(150, H - top - 12 - 42), center = top + height / 2;
  const pitch = Math.min(74, Math.max(56, height * 0.4)), size = pitch * 0.81;
  const reach = Math.ceil(height / 2 / pitch) + 1;
  const frame = ctx.createLinearGradient(0, top - 12, 0, top + height + 12);
  frame.addColorStop(0, "#fff6c8"); frame.addColorStop(0.22, "#ffb42a"); frame.addColorStop(0.5, "#ffe77a"); frame.addColorStop(0.78, "#c25a10"); frame.addColorStop(1, "#ffcf5a");
  ctx.fillStyle = frame; ctx.beginPath(); ctx.roundRect(12, top - 12, 366, height + 24, 26); ctx.fill();
  const inner = ctx.createLinearGradient(0, top - 4, 0, top + height + 4);
  inner.addColorStop(0, "#5a0f7a"); inner.addColorStop(0.5, "#2c0a52"); inner.addColorStop(1, "#5a0f5e");
  ctx.fillStyle = inner; ctx.beginPath(); ctx.roundRect(20, top - 4, 350, height + 8, 20); ctx.fill();
  bulbs(ctx, 28, top + 2, 334, height - 4, 23, s.tick + 3, win);
  for (let i = 0; i < 3; i++) {
    const x = 85 + i * 110, rx = x - 46, ry = top + 14, rw = 92, rh = height - 28;
    ctx.save();
    ctx.beginPath(); ctx.roundRect(rx, ry, rw, rh, 12); ctx.clip();
    // Drum: bright in the middle, dark at the top and bottom edges.
    const drum = ctx.createLinearGradient(0, ry, 0, ry + rh);
    drum.addColorStop(0, "#5a3f7a"); drum.addColorStop(0.22, "#f1e9fb"); drum.addColorStop(0.5, "#ffffff"); drum.addColorStop(0.78, "#f1e9fb"); drum.addColorStop(1, "#5a3f7a");
    ctx.fillStyle = drum; ctx.fillRect(rx, ry, rw, rh);
    const p = slotReelPosition(s, i), index = Math.floor(p), fraction = p - index;
    const moving = spinning && Math.abs(p - Math.round(p)) > 0.02;
    for (let k = -reach; k <= reach + 1; k++) {
      const yy = center + (k - fraction) * pitch, id = s.strips[i][(((index + k) % stops) + stops) % stops];
      const onLine = Math.abs(yy - center) < 6 && !spinning;
      ctx.save();
      // Motion blur: squash vertically and ghost while spinning fast.
      if (moving) { ctx.globalAlpha = 0.75; ctx.translate(x, yy); ctx.scale(1, 1.18); ctx.translate(-x, -yy); }
      symbol(ctx, id, x, yy, size, onLine && win);
      ctx.restore();
    }
    const shade = ctx.createLinearGradient(0, ry, 0, ry + rh);
    shade.addColorStop(0, "rgba(10,4,30,.65)"); shade.addColorStop(0.28, "rgba(10,4,30,0)"); shade.addColorStop(0.72, "rgba(10,4,30,0)"); shade.addColorStop(1, "rgba(10,4,30,.65)");
    ctx.fillStyle = shade; ctx.fillRect(rx, ry, rw, rh);
    ctx.fillStyle = "rgba(255,255,255,.18)"; ctx.fillRect(rx + 6, ry, 8, rh);
    ctx.restore();
    ctx.strokeStyle = "#c9902e"; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(rx, ry, rw, rh, 12); ctx.stroke();
    // Step counter as an LED pill.
    const label = String(slotVisibleSteps(s.steps[i]));
    // v156: the step's colour runs along a gradient, blue at −3 to violet at +3.
    if (poster) continue;
    const tone = stepTone(s.steps[i]);
    ctx.fillStyle = "#08051a"; ctx.beginPath(); ctx.roundRect(x - 26, top + height + 18, 52, 26, 13); ctx.fill();
    ctx.strokeStyle = `hsla(${tone.h},100%,66%,.75)`; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = `hsl(${tone.h},100%,${tone.l}%)`; ctx.shadowColor = `hsl(${tone.h},100%,60%)`; ctx.shadowBlur = 8;
    ctx.font = "900 16px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(label, x, top + height + 31.5);
    ctx.shadowBlur = 0;
  }
  // Payline: a laser across the middle with arrow tips.
  ctx.save();
  ctx.strokeStyle = win ? "#fff3b0" : "rgba(255,59,82,.85)"; ctx.lineWidth = win ? 3 : 2;
  ctx.shadowColor = win ? GOLD : "#ff3b52"; ctx.shadowBlur = win ? 16 : 8;
  ctx.beginPath(); ctx.moveTo(36, center); ctx.lineTo(354, center); ctx.stroke();
  ctx.fillStyle = ctx.strokeStyle;
  for (const [xx, d] of [[30, 1], [360, -1]] as const) { ctx.beginPath(); ctx.moveTo(xx, center - 8); ctx.lineTo(xx + 10 * d, center); ctx.lineTo(xx, center + 8); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  // Win: coin shower from the cabinet and a big glowing amount.
  if (win) {
    const n = big ? 60 : 26;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (hash01(i + s.spins * 7) - 0.5) * 2.4, sp = 2.4 + hash01(i * 3 + 1) * 3.2;
      const cx = 195 + Math.cos(a) * sp * since, cy = center + Math.sin(a) * sp * since + 0.05 * since * since;
      if (cy > H + 20) continue;
      const spin = Math.abs(Math.cos(since * 0.2 + i));
      ctx.fillStyle = "#ffd23f"; ctx.strokeStyle = "#a8680a"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(cx, cy, 6 * spin + 1, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    const pop = since < 20 ? 0.6 + 0.4 * Math.sin((since / 20) * Math.PI * 0.5) + 0.15 * Math.sin((since / 20) * Math.PI) : 1 + 0.03 * Math.sin(since * 0.15);
    if (!poster) {
      ctx.save();
      // Straddles the cabinet's top frame (decoration only), so no pay chip or symbol is ever covered.
      ctx.translate(195, top - 6); ctx.scale(pop, pop);
      ctx.font = `900 ${big ? 26 : 22}px system-ui`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const label = t("slot.won", { n: formatNumber(s.lastPayout / 100) });
      ctx.fillStyle = "rgba(20,6,42,.85)"; const w = ctx.measureText(label).width + 36;
      ctx.beginPath(); ctx.roundRect(-w / 2, -18, w, 36, 18); ctx.fill();
      ctx.strokeStyle = GOLD; ctx.lineWidth = 2; ctx.stroke();
      const g = ctx.createLinearGradient(0, -12, 0, 12);
      g.addColorStop(0, "#fff6c2"); g.addColorStop(0.5, "#ffd23f"); g.addColorStop(1, "#ff7a3d");
      ctx.fillStyle = g; ctx.shadowColor = "#ffb000"; ctx.shadowBlur = 14;
      ctx.fillText(label, 0, 1);
      ctx.restore();
    }
  }
}
const hudLabel = (s: Readonly<SlotState>) =>
  `${t("slot.hud", { chips: formatNumber(s.balanceMinor / 100, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), secs: formatNumber(Math.max(0, 21600 - s.tick) / 120, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) })}${s.steps.every(step => step === 0) ? ` · ${t("slot.hudNoZero")}` : ""}`;
const feedbackScore = (s: Readonly<SlotState>) => s.balanceMinor;
const scoreCells = (s: Readonly<SlotState>): ScoreCell[] => [
  { label: t("hud.chips"), value: formatNumber(s.balanceMinor / 100, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), main: true },
  { label: t("hud.time"), value: `${Math.ceil(Math.max(0, 21600 - s.tick) / 120)} s` },
  s.steps.every((step) => step === 0) ? { label: t("hud.shots"), value: t("slot.hudNoZero"), alert: true } : { label: t("hud.shots"), value: formatNumber(s.spins) },
];
/** The game's own renderer, for the catalogue cover script (scripts/render-slot-cover.mjs). */
export { render as renderSlot };

export default function GalacticSlot(props: GameRuntimeProps) {
  useI18n();
  return (
    <div className="slotVerified">
      <CoreCanvasGame
        {...props}
        core={SLOT_CORE_V4}
        name="Slot"
        instruction=""
        render={render}
        expandVerticalViewport
        hideHudScore
        hudLabel={hudLabel}
        scoreCells={scoreCells}
        feedbackScore={feedbackScore}
        keys={{ " ": "SPIN" }}
        controls={[
          {
            action: "REEL_0_LESS",
            label: t("slot.less", { n: 1 }),
            symbol: "−",
          },
          {
            action: "REEL_0_MORE",
            label: t("slot.more", { n: 1 }),
            symbol: "+",
          },
          {
            action: "REEL_1_LESS",
            label: t("slot.less", { n: 2 }),
            symbol: "−",
          },
          {
            action: "REEL_1_MORE",
            label: t("slot.more", { n: 2 }),
            symbol: "+",
          },
          {
            action: "REEL_2_LESS",
            label: t("slot.less", { n: 3 }),
            symbol: "−",
          },
          {
            action: "REEL_2_MORE",
            label: t("slot.more", { n: 3 }),
            symbol: "+",
          },
          {
            action: "SPIN",
            label: t("slot.spinAria"),
            symbol: t("slot.spin"),
          },
        ]}
      />
    </div>
  );
}
