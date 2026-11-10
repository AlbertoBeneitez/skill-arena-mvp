/*
 * Bowling V3 celebrations — presentation only (v163, "professional pictures"). After the short instant replay, a
 * 10-second studio sequence drawn in a small 3D projection (lateral x, height y, depth z) with lit, glossy pins:
 *  - strike «Gala» (gold) and «Arena» (neon): the ball rolls into a full rack under the lights, the pins burst out in
 *    bullet time, the metallic title lands, the pins fall onto the mirror floor and then fly back into a perfect rack
 *    that is lit like a trophy, with fireworks behind;
 *  - spare «Órbita» (cosmic): the pins that were left standing are swept away in slow motion in front of a ringed
 *    planet, then the whole rack assembles in the same way.
 * Pins are shaded maple (lacquer gradient, specular streak, two red neck stripes, coloured rim light) with contact
 * shadows and reflections on the floor. Which look plays is a hash of the seed, the frame and the roll count (looks
 * random, identical on replay). Everything is a pure function of the state and the ticks since the celebration
 * started; the core decides how long the celebration lasts and records the SKIP.
 */
import { t as tx } from "@/lib/i18n";
import { bowlingScore, type BowlingStateV3 } from "@/lib/verified/bowlingCore.v3";

export const CARTOON_TICKS = 1200;
export const hash01 = (n: number) => { const q = Math.sin(n * 12.9898) * 43758.5453; return q - Math.floor(q); };
export function seedHash(seed: string) {
  let h = 7;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 1000003;
  return h;
}
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const seg = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const easeOut = (k: number) => 1 - Math.pow(1 - k, 3);
const easeInOut = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
/** Spring that overshoots and settles at 1. */
const spring = (k: number) => (k <= 0 ? 0 : k >= 1 ? 1 : 1 - Math.exp(-6 * k) * Math.cos(k * 11));

export type Cartoon = "gala" | "arena" | "orbit";
export type Theme = "gold" | "neon" | "cosmic" | "steel";
export function cartoonFor(s: Pick<BowlingStateV3, "seed" | "rolls" | "lastResult">): Cartoon {
  if (s.lastResult?.kind !== "strike") return "orbit";
  const k = hash01(seedHash(s.seed) * 0.001 + (s.lastResult?.frame ?? 0) * 7.13 + s.rolls.length * 3.7);
  return k < 0.5 ? "gala" : "arena";
}
const THEME: Record<Cartoon, Theme> = { gala: "gold", arena: "neon", orbit: "cosmic" };

export const PALETTE: Record<Theme, { face: string[]; edge: string; glow: string; spark: string[]; beam: string }> = {
  gold: { face: ["#fffbe0", "#ffe27a", "#f5b52e", "#b86a00", "#ffd76a"], edge: "#5a2c00", glow: "#ffcf4a", spark: ["#fff3c4", "#ffd23f", "#ff9a3d"], beam: "255,205,90" },
  neon: { face: ["#ffffff", "#bff6ff", "#7fe3ee", "#ff6fd8", "#ffd6f5"], edge: "#2a0a4a", glow: "#ff6fd8", spark: ["#7fe3ee", "#ff6fd8", "#ffffff"], beam: "255,111,216" },
  cosmic: { face: ["#ffffff", "#e6ecff", "#a9b8ff", "#6a4dff", "#d9c8ff"], edge: "#120a3a", glow: "#9f8bff", spark: ["#ffffff", "#b9a8ff", "#7fe3ee"], beam: "160,140,255" },
  steel: { face: ["#ffffff", "#e8eef6", "#aab8c8", "#5a6a7e", "#dfe8f2"], edge: "#1a2230", glow: "#9fe8ff", spark: ["#ffffff", "#9fe8ff", "#dfe8f2"], beam: "160,230,255" },
};

/* ------------------------------------------------------------------ title kit (from the V2 broadcast) */

/** Extruded metallic title with entrance slam, chromatic split, motion ghosts and a specular sweep. */
export function proTitle(ctx: CanvasRenderingContext2D, label: string, t: number, cy: number, size: number, theme: Theme) {
  if (t < 0) return;
  const pal = PALETTE[theme];
  const enter = clamp01(t / 16), ease = easeOut(enter);
  const settle = t > 16 ? 1 + 0.06 * Math.exp(-(t - 16) / 6) * Math.cos((t - 16) * 0.9) : 1;
  const scale = (2.4 - 1.4 * ease) * settle;
  ctx.save();
  ctx.font = `900 ${size}px system-ui, sans-serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const w = ctx.measureText(label).width, fit = Math.min(1, 350 / Math.max(1, w));
  ctx.translate(195, cy);
  if (t < 16) {
    for (let g = 3; g > 0; g--) {
      const sc = (scale + g * 0.18) * fit;
      ctx.save(); ctx.scale(sc, sc); ctx.globalAlpha = 0.12 * g * (1 - enter); ctx.fillStyle = pal.glow; ctx.fillText(label, 0, 0); ctx.restore();
    }
  }
  ctx.scale(scale * fit, scale * fit);
  ctx.globalAlpha = Math.min(1, t / 6);
  for (let k = 9; k > 0; k--) { ctx.fillStyle = k > 6 ? "rgba(0,0,0,.55)" : pal.edge; ctx.fillText(label, k * 0.35, k * 0.9); }
  const split = t < 30 ? (1 - t / 30) * 6 : 0;
  if (split > 0.3) {
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = "rgba(255,40,80,.55)"; ctx.fillText(label, -split, 0);
    ctx.fillStyle = "rgba(40,220,255,.55)"; ctx.fillText(label, split, 0);
    ctx.globalCompositeOperation = "source-over";
  }
  const face = ctx.createLinearGradient(0, -size / 2, 0, size / 2);
  face.addColorStop(0, pal.face[0]); face.addColorStop(0.42, pal.face[1]); face.addColorStop(0.5, pal.face[2]);
  face.addColorStop(0.78, pal.face[3]); face.addColorStop(1, pal.face[4]);
  ctx.shadowColor = pal.glow; ctx.shadowBlur = 22; ctx.fillStyle = face; ctx.fillText(label, 0, 0); ctx.shadowBlur = 0;
  ctx.lineWidth = 1.6; ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.strokeText(label, 0, -0.6);
  ctx.lineWidth = 1; ctx.strokeStyle = "rgba(0,0,0,.35)"; ctx.strokeText(label, 0, 1.2);
  if (theme === "neon") {
    ctx.globalAlpha = t % 47 < 2 ? 0.4 : 1; ctx.lineWidth = 3; ctx.strokeStyle = "#7fe3ee"; ctx.shadowColor = "#7fe3ee"; ctx.shadowBlur = 16;
    ctx.strokeText(label, 0, 0); ctx.shadowBlur = 0; ctx.globalAlpha = 1;
  }
  const half = w / 2 + 40, band = ((t * 7) % 520) - 260, pos = (x: number) => clamp01((x + half) / (2 * half));
  const sh = ctx.createLinearGradient(-half, -size / 2, half, size / 2);
  sh.addColorStop(0, "rgba(255,255,255,0)"); sh.addColorStop(pos(band - 30), "rgba(255,255,255,0)");
  sh.addColorStop(pos(band), "rgba(255,255,255,.85)"); sh.addColorStop(pos(band + 30), "rgba(255,255,255,0)"); sh.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sh; ctx.fillText(label, 0, 0);
  ctx.restore();
}
function lensFlare(ctx: CanvasRenderingContext2D, t: number, cy: number, color: string) {
  if (t < 0) return;
  const k = Math.min(1, t / 40), x = -60 + 510 * k, a = Math.sin(Math.min(Math.PI, k * Math.PI));
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  const g = ctx.createLinearGradient(0, cy, 390, cy);
  g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(clamp01(x / 390), `rgba(255,255,255,${0.95 * a})`); g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g; ctx.fillRect(0, cy - 3, 390, 6);
  const core = ctx.createRadialGradient(x, cy, 0, x, cy, 64);
  core.addColorStop(0, `rgba(255,255,255,${0.9 * a})`); core.addColorStop(0.3, `rgba(${color},${0.4 * a})`); core.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = core; ctx.beginPath(); ctx.arc(x, cy, 64, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
/** Deterministic spark shower (hash per particle, no RNG). */
function sparks(ctx: CanvasRenderingContext2D, t: number, x0: number, y0: number, n: number, colors: string[], seed: number, H: number) {
  if (t <= 0) return;
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.lineCap = "round";
  for (let i = 0; i < n; i++) {
    const h = (k: number) => hash01((i + 1) * 12.9898 + seed * 78.233 + k * 37.719);
    const a = h(1) * Math.PI * 2, sp = 2.5 + h(2) * 6.5, u = t - h(3) * 10;
    if (u <= 0 || u > 120) continue;
    const vx = Math.cos(a) * sp, vy = Math.sin(a) * sp * 0.75 - 2.5, g = 0.09;
    const x = x0 + vx * u, y = y0 + vy * u + 0.5 * g * u * u;
    if (y > H + 20) continue;
    ctx.strokeStyle = colors[i % colors.length]; ctx.globalAlpha = Math.max(0, 1 - u / 120); ctx.lineWidth = 1.2 + h(4) * 2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - vx * 2.2, y - (vy + g * u) * 2.2); ctx.stroke();
  }
  ctx.restore();
}
/** Confetti: paper squares that tumble and flutter down (deterministic). */
function confetti(ctx: CanvasRenderingContext2D, t: number, H: number, n: number, seed: number) {
  if (t <= 0) return;
  const colors = ["#ff6fd8", "#7fe3ee", "#ffd23f", "#5cffb0", "#ffffff", "#9f8bff"];
  ctx.save();
  for (let i = 0; i < n; i++) {
    const h = (k: number) => hash01((i + 1) * 7.31 + seed * 3.17 + k * 19.3);
    const u = t - h(1) * 60;
    if (u <= 0) continue;
    const x = h(2) * 390 + Math.sin(u * 0.05 + h(3) * 6) * 18, y = -20 + u * (1.2 + h(4) * 1.4);
    if (y > H + 10) continue;
    ctx.save(); ctx.translate(x, y); ctx.rotate(u * (0.05 + h(5) * 0.1));
    ctx.scale(1, Math.cos(u * (0.1 + h(6) * 0.12)));
    ctx.fillStyle = colors[i % colors.length]; ctx.fillRect(-3, -2, 6, 4);
    ctx.restore();
  }
  ctx.restore();
}
function lowerThird(ctx: CanvasRenderingContext2D, s: BowlingStateV3, t: number, H: number, theme: Theme, label: string) {
  if (t < 0) return;
  const k = clamp01(t / 18), ease = easeOut(k), pal = PALETTE[theme];
  const y = H - 150, w = 326, x = -w + (w + 32) * ease;
  ctx.save();
  ctx.globalAlpha = k;
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, "rgba(8,12,30,.96)"); g.addColorStop(1, "rgba(18,24,52,.9)");
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x, y, w, 58, 10); ctx.fill();
  ctx.fillStyle = pal.glow; ctx.fillRect(x, y, 6, 58);
  ctx.fillStyle = "rgba(255,255,255,.08)"; ctx.fillRect(x + 6, y + 28, w - 6, 1);
  ctx.textBaseline = "middle"; ctx.textAlign = "left";
  ctx.fillStyle = pal.face[1]; ctx.font = "900 15px system-ui"; ctx.fillText(label, x + 18, y + 15);
  ctx.fillStyle = "#c7d4ea"; ctx.font = "700 12px system-ui"; ctx.fillText(tx("bowling.frameN", { n: (s.lastResult?.frame ?? 0) + 1 }), x + 18, y + 43);
  if (s.lastResult?.kind === "strike" && s.streak >= 2) {
    ctx.fillStyle = "#7fe3ee"; ctx.fillText(s.streak >= 3 ? tx("bowling.turkey", { n: s.streak }) : tx("bowling.double"), x + 108, y + 43);
  }
  const total = bowlingScore(s.rolls).total;
  ctx.textAlign = "right";
  if (total > 0) {
    ctx.fillStyle = "#ffffff"; ctx.font = "900 26px system-ui"; ctx.fillText(String(total), x + w - 16, y + 32);
    ctx.font = "700 10px system-ui"; ctx.fillStyle = "#93a6c4"; ctx.fillText(tx("bowling.total"), x + w - 16, y + 11);
  } else {
    ctx.fillStyle = pal.glow; ctx.beginPath(); ctx.roundRect(x + w - 54, y + 11, 38, 36, 8); ctx.fill();
    ctx.fillStyle = "#0b1022"; ctx.font = "900 24px system-ui"; ctx.textAlign = "center";
    ctx.fillText(s.lastResult?.kind === "strike" ? "X" : "/", x + w - 35, y + 30);
  }
  ctx.restore();
}

/** v162 · Finale fireworks: deterministic shells that rise, burst into rings of stars and fall away. */
function fireworks(ctx: CanvasRenderingContext2D, t: number, H: number, n: number, seed: number, colors: string[]) {
  if (t <= 0) return;
  ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.lineCap = "round";
  for (let i = 0; i < n; i++) {
    const h = (k: number) => hash01((i + 1) * 3.71 + seed * 1.93 + k * 11.7);
    const at = i * 26 + h(1) * 18, u = t - at;
    if (u <= 0 || u > 150) continue;
    const x = 50 + h(2) * 290, top = H * (0.12 + h(3) * 0.28), rise = 36, col = colors[i % colors.length];
    if (u < rise) {
      const k = u / rise, y = H - (H - top) * easeOut(k);
      ctx.strokeStyle = col; ctx.globalAlpha = 0.9; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 26); ctx.stroke();
      continue;
    }
    const v = u - rise, count = 40, fade = Math.max(0, 1 - v / 114);
    if (v < 8) { ctx.globalAlpha = 1 - v / 8; ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(x, top, 30 - v * 2, 0, Math.PI * 2); ctx.fill(); }
    for (let q = 0; q < count; q++) {
      const a = (q / count) * Math.PI * 2 + h(4), sp = 3.6 + (q % 3) * 0.9;
      const px = x + Math.cos(a) * sp * v * 0.9, py = top + Math.sin(a) * sp * v * 0.9 + 0.012 * v * v;
      ctx.globalAlpha = fade; ctx.strokeStyle = col; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - Math.cos(a) * 12, py - Math.sin(a) * 12 - 1); ctx.stroke();
      if ((q + Math.floor(v / 5)) % 3 === 0) { ctx.fillStyle = "#ffffff"; ctx.fillRect(px - 1, py - 1, 2, 2); }
    }
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ studio: projection, pin, ball */

type Cam = { H: number; horizon: number; floor: number; zoom: number; sx: number; sy: number };
const FOCAL = 520;
/** Screen point and scale of a world point (x lateral, y height, z depth; z = 0 is the focal plane). */
function proj(c: Cam, x: number, y: number, z: number) {
  const s = FOCAL / (FOCAL + z);
  const px = 195 + x * s, py = c.horizon + (c.floor - c.horizon) * s - y * s;
  return { x: 195 + (px - 195) * c.zoom + c.sx, y: c.H * 0.5 + (py - c.H * 0.5) * c.zoom + c.sy, s: s * c.zoom };
}
const PIN_H = 124;
/** Pin outline (feet at 0,0; height h; width w), drawn in local coordinates. */
function pinPath(ctx: CanvasRenderingContext2D, h: number) {
  const w = h * 0.34;
  ctx.beginPath();
  ctx.moveTo(0, -h);
  ctx.bezierCurveTo(w * 0.3, -h, w * 0.33, -h * 0.84, w * 0.22, -h * 0.7);
  ctx.bezierCurveTo(w * 0.15, -h * 0.62, w * 0.56, -h * 0.43, w * 0.5, -h * 0.17);
  ctx.bezierCurveTo(w * 0.47, -h * 0.03, w * 0.3, 0, 0, 0);
  ctx.bezierCurveTo(-w * 0.3, 0, -w * 0.47, -h * 0.03, -w * 0.5, -h * 0.17);
  ctx.bezierCurveTo(-w * 0.56, -h * 0.43, -w * 0.15, -h * 0.62, -w * 0.22, -h * 0.7);
  ctx.bezierCurveTo(-w * 0.33, -h * 0.84, -w * 0.3, -h, 0, -h);
  ctx.closePath();
}
/**
 * A lit maple pin: lacquer gradient across the body, a long specular streak, two red neck stripes with their own
 * sheen, a coloured rim light on the shadow side and a thin dark edge. (x, y) is the centre of the pin; `rot` turns
 * it about that centre.
 */
function proPin(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, rot: number, rim: string, alpha = 1) {
  if (h < 2) return;
  const w = h * 0.34;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y); ctx.rotate(rot); ctx.translate(0, h / 2);
  const body = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  body.addColorStop(0, "#5d6574"); body.addColorStop(0.16, "#b9c0cb"); body.addColorStop(0.36, "#fbfcfd");
  body.addColorStop(0.5, "#eef1f5"); body.addColorStop(0.76, "#aab2bf"); body.addColorStop(1, "#4b5260");
  pinPath(ctx, h); ctx.fillStyle = body; ctx.fill();
  ctx.save(); pinPath(ctx, h); ctx.clip();
  // Neck stripes: curved bands with a red lacquer gradient.
  const red = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  red.addColorStop(0, "#5c0712"); red.addColorStop(0.35, "#ff4255"); red.addColorStop(0.55, "#e01f33"); red.addColorStop(1, "#4a0610");
  ctx.fillStyle = red;
  for (const yy of [-h * 0.735, -h * 0.675]) {
    ctx.beginPath(); ctx.ellipse(0, yy, w * 0.6, h * 0.035, 0, 0, Math.PI * 2); ctx.fill();
  }
  // Vertical shading (darker toward the foot, light on the head) and the specular streak.
  const v = ctx.createLinearGradient(0, -h, 0, 0);
  v.addColorStop(0, "rgba(255,255,255,.18)"); v.addColorStop(0.55, "rgba(255,255,255,0)"); v.addColorStop(1, "rgba(0,0,10,.28)");
  ctx.fillStyle = v; ctx.fillRect(-w, -h, w * 2, h);
  ctx.fillStyle = "rgba(255,255,255,.85)";
  ctx.beginPath(); ctx.ellipse(-w * 0.16, -h * 0.4, w * 0.045, h * 0.2, 0.03, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-w * 0.06, -h * 0.88, w * 0.035, h * 0.06, 0, 0, Math.PI * 2); ctx.fill();
  // Rim light on the right edge.
  ctx.strokeStyle = rim; ctx.lineWidth = Math.max(1, w * 0.12); ctx.globalAlpha *= 0.75;
  ctx.translate(w * 0.07, 0); pinPath(ctx, h); ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = "rgba(10,14,24,.55)"; ctx.lineWidth = Math.max(0.6, h * 0.008);
  pinPath(ctx, h); ctx.stroke();
  ctx.restore();
}
/** A glossy reactive-resin ball with its swirl, finger holes, specular highlight and rim light. */
function proBall(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, roll: number, theme: Theme) {
  const base = theme === "gold" ? ["#fff1c4", "#e0a12a", "#5a2a00"] : theme === "neon" ? ["#e8d8ff", "#7a4dff", "#14063f"] : ["#d8f6ff", "#2f8fd8", "#06173a"];
  ctx.save();
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.08, x, y, r);
  g.addColorStop(0, base[0]); g.addColorStop(0.35, base[1]); g.addColorStop(1, base[2]);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
  ctx.strokeStyle = "rgba(255,255,255,.22)"; ctx.lineWidth = r * 0.16;
  for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.ellipse(x, y, r * (0.95 - k * 0.25), r * 0.32, roll * 0.6 + k * 1.1, 0, Math.PI * 2); ctx.stroke(); }
  const hy = y + Math.cos(roll) * r * 0.45;
  if (Math.sin(roll) < 0.55) { ctx.fillStyle = "rgba(4,4,12,.9)"; for (const [dx, dy] of [[-0.22, -0.12], [0.2, -0.16], [0, 0.18]]) { ctx.beginPath(); ctx.arc(x + dx * r, hy + dy * r, r * 0.1, 0, Math.PI * 2); ctx.fill(); } }
  ctx.restore();
  ctx.fillStyle = "rgba(255,255,255,.75)"; ctx.beginPath(); ctx.ellipse(x - r * 0.38, y - r * 0.45, r * 0.26, r * 0.13, -0.6, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = `rgba(${PALETTE[theme].beam},.8)`; ctx.lineWidth = Math.max(1, r * 0.08);
  ctx.beginPath(); ctx.arc(x, y, r * 0.96, -0.3, 1.4); ctx.stroke();
  ctx.restore();
}

/* ------------------------------------------------------------------ studio sets */

function setGala(ctx: CanvasRenderingContext2D, c: Cam, t: number) {
  const H = c.H;
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#060404"); bg.addColorStop(0.42, "#1a1008"); bg.addColorStop(1, "#040303");
  ctx.fillStyle = bg; ctx.fillRect(-20, -20, 430, H + 40);
  // Back wall: warm light bars, out of focus.
  for (let i = 0; i < 9; i++) {
    const x = 20 + i * 44, a = 0.1 + 0.08 * Math.sin(t * 0.03 + i);
    const g = ctx.createLinearGradient(x, 0, x, c.horizon);
    g.addColorStop(0, "rgba(255,190,90,0)"); g.addColorStop(0.6, `rgba(255,190,90,${a})`); g.addColorStop(1, "rgba(255,190,90,0)");
    ctx.fillStyle = g; ctx.fillRect(x - 3, c.horizon * 0.15, 6, c.horizon * 0.85);
  }
  const glow = ctx.createRadialGradient(195, c.horizon, 10, 195, c.horizon, 260);
  glow.addColorStop(0, "rgba(255,200,110,.38)"); glow.addColorStop(1, "rgba(255,200,110,0)");
  ctx.fillStyle = glow; ctx.fillRect(-20, -20, 430, H + 40);
  spotCones(ctx, c, t, "255,214,140");
  mirrorFloor(ctx, c, ["#120c06", "#050403"]);
}
function setArena(ctx: CanvasRenderingContext2D, c: Cam, t: number) {
  const H = c.H;
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#03030c"); bg.addColorStop(0.45, "#120a2c"); bg.addColorStop(1, "#02020a");
  ctx.fillStyle = bg; ctx.fillRect(-20, -20, 430, H + 40);
  const glow = ctx.createRadialGradient(195, c.horizon, 10, 195, c.horizon, 300);
  glow.addColorStop(0, "rgba(255,80,200,.35)"); glow.addColorStop(0.5, "rgba(80,120,255,.12)"); glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow; ctx.fillRect(-20, -20, 430, H + 40);
  // Laser beams sweeping from the back.
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 6; i++) {
    const a = Math.sin(t * 0.012 + i * 1.3) * 0.9, col = i % 2 ? "127,227,238" : "255,111,216";
    ctx.save(); ctx.translate(195 + (i - 2.5) * 50, c.horizon - 6); ctx.rotate(a - Math.PI / 2 - 0.0);
    const g = ctx.createLinearGradient(0, 0, 420, 0);
    g.addColorStop(0, `rgba(${col},.55)`); g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -1); ctx.lineTo(420, -10); ctx.lineTo(420, 10); ctx.lineTo(0, 1); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  mirrorFloor(ctx, c, ["#0a0620", "#020108"]);
  // Neon grid on the floor.
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  for (let k = -8; k <= 8; k++) {
    const a = proj(c, k * 60, 0, -120), b = proj(c, k * 60, 0, 1400);
    ctx.strokeStyle = `rgba(255,111,216,${0.32 - Math.abs(k) * 0.025})`; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  for (let z = -120 + ((t * 2) % 80); z < 1400; z += 80) {
    const a = proj(c, -600, 0, z), b = proj(c, 600, 0, z);
    ctx.strokeStyle = `rgba(127,227,238,${0.35 * (1 - z / 1400)})`; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  ctx.restore();
}
function setOrbit(ctx: CanvasRenderingContext2D, c: Cam, t: number) {
  const H = c.H;
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#02030a"); bg.addColorStop(0.5, "#0b0b26"); bg.addColorStop(1, "#020208");
  ctx.fillStyle = bg; ctx.fillRect(-20, -20, 430, H + 40);
  for (const [x, y, r, col] of [[90, 0.2, 170, "120,60,255"], [320, 0.28, 150, "0,170,255"], [210, 0.12, 120, "255,80,170"]] as const) {
    const g = ctx.createRadialGradient(x, H * y, 0, x, H * y, r);
    g.addColorStop(0, `rgba(${col},.22)`); g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g; ctx.fillRect(-20, -20, 430, H + 40);
  }
  for (let i = 0; i < 120; i++) {
    const x = hash01(i * 3.1) * 390, y = hash01(i * 7.7) * c.horizon, tw = 0.5 + 0.5 * Math.sin(t * 0.05 + i);
    ctx.fillStyle = `rgba(230,240,255,${0.25 + 0.55 * tw * hash01(i)})`; ctx.fillRect(x, y, i % 9 ? 1 : 2, i % 9 ? 1 : 2);
  }
  // A ringed planet rising behind the stage.
  const px = 300, py = c.horizon + 4, pr = 74; // rising behind the stage, its lower half under the floor
  ctx.save(); ctx.translate(px, py); ctx.rotate(-0.32);
  ctx.strokeStyle = "rgba(230,200,150,.35)"; ctx.lineWidth = 7; ctx.beginPath(); ctx.ellipse(0, 0, pr * 1.9, pr * 0.42, 0, Math.PI, Math.PI * 2); ctx.stroke();
  ctx.restore();
  const pg = ctx.createRadialGradient(px - 26, py - 30, 6, px, py, pr);
  pg.addColorStop(0, "#f6dcab"); pg.addColorStop(0.55, "#c08850"); pg.addColorStop(1, "#2a160c");
  ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.clip(); ctx.translate(px, py); ctx.rotate(-0.32);
  for (let k = -4; k <= 4; k++) { ctx.fillStyle = k % 2 ? "rgba(120,60,20,.22)" : "rgba(255,235,200,.14)"; ctx.fillRect(-pr * 1.2, k * 15, pr * 2.4, 7); }
  ctx.restore();
  ctx.save(); ctx.translate(px, py); ctx.rotate(-0.32);
  ctx.strokeStyle = "rgba(240,214,170,.7)"; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(0, 0, pr * 1.9, pr * 0.42, 0, 0, Math.PI); ctx.stroke();
  ctx.strokeStyle = "rgba(160,120,80,.6)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 0, pr * 1.6, pr * 0.35, 0, 0, Math.PI); ctx.stroke();
  ctx.restore();
  mirrorFloor(ctx, c, ["#08081c", "#020208"]);
}
/** Volumetric spot cones from above onto the rack. */
function spotCones(ctx: CanvasRenderingContext2D, c: Cam, t: number, col: string) {
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  for (const [x0, sway] of [[60, 1], [330, -1], [195, 0]] as const) {
    const target = proj(c, sway * 40 * Math.sin(t * 0.01), 0, 120);
    const g = ctx.createLinearGradient(x0, -20, target.x, target.y);
    g.addColorStop(0, `rgba(${col},.32)`); g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(x0 - 8, -20); ctx.lineTo(x0 + 8, -20); ctx.lineTo(target.x + 110, target.y); ctx.lineTo(target.x - 110, target.y); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
/** Glossy floor from the horizon down (the reflections are drawn afterwards with a fading mask). */
function mirrorFloor(ctx: CanvasRenderingContext2D, c: Cam, cols: [string, string]) {
  const top = proj(c, 0, 0, 1400).y;
  const g = ctx.createLinearGradient(0, top, 0, c.H);
  g.addColorStop(0, cols[0]); g.addColorStop(1, cols[1]);
  ctx.fillStyle = g; ctx.fillRect(-20, top, 430, c.H - top + 20);
  const sheen = ctx.createLinearGradient(0, top, 0, top + 30);
  sheen.addColorStop(0, "rgba(255,255,255,.12)"); sheen.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sheen; ctx.fillRect(-20, top, 430, 30);
}

/* ------------------------------------------------------------------ choreography */

/** Rack spots (head pin nearest the camera) and the spare's standing pins. */
const RACK = [0, 1, 2, 3].flatMap((r) => Array.from({ length: r + 1 }, (_, k) => ({ x: (k - r / 2) * 50, z: 60 + r * 44 })));
const SPARE_LEFT = [9, 5, 8, 2, 4, 7, 1, 3, 6];
type PinPose3 = { x: number; y: number; z: number; rot: number };
const IMPACT = 64, SLOW_END = 400, FALL_END = 600, BUILD = 700;
/** Where pin i is at tick t: standing, bursting out in bullet time, falling to the floor, flying back to the rack. */
function pinAt(i: number, t: number, active: boolean): PinPose3 | null {
  const home = RACK[i];
  if (!active && t < BUILD) return null;
  const h = (k: number) => hash01(i * 17.3 + k * 5.1);
  // Burst: velocity from the hit, bigger behind, a spin each.
  const vx = (home.x / 50) * 110 + (h(1) - 0.5) * 170, vy = 300 + h(2) * 260, vz = 40 + h(3) * 260 + (home.z - 60) * 0.8, w = (h(4) - 0.5) * 9;
  const g = 900;
  const delay = (home.z - 60) / 44 * 0.03 + Math.abs(home.x) / 50 * 0.015;
  // Effective seconds after the impact: slow motion (×0.2) until SLOW_END, then real time ×0.9.
  const tau = t < IMPACT ? 0 : t < SLOW_END ? ((t - IMPACT) / 120) * 0.2 : ((SLOW_END - IMPACT) / 120) * 0.2 + ((Math.min(t, FALL_END) - SLOW_END) / 120) * 0.9;
  const u = Math.max(0, tau - delay);
  let flying: PinPose3;
  if (!active) flying = { x: home.x, y: 640, z: home.z, rot: (h(5) - 0.5) * 2 }; // on a spare the rest drop in from above
  else if (u <= 0) flying = { x: home.x, y: 0, z: home.z, rot: 0 };
  else {
    const land = (2 * vy) / g;
    if (u < land) flying = { x: home.x + vx * u, y: vy * u - 0.5 * g * u * u, z: home.z + vz * u, rot: w * u };
    else {
      const k = Math.min(1, (u - land) / 0.5), ease = 1 - Math.pow(1 - k, 3);
      const rest = (w >= 0 ? 1 : -1) * Math.PI / 2;
      flying = { x: home.x + vx * land + vx * 0.25 * ease, y: Math.max(0, 40 * Math.sin(Math.min(1, k * 2) * Math.PI) * (1 - k)), z: home.z + vz * land + vz * 0.2 * ease, rot: w * land + (rest - w * land) * ease };
    }
  }
  if (t < BUILD) return flying;
  // Back into the rack, one after the other, along an arc.
  const d = BUILD + i * 13, k = seg(t, d, d + 110), e = easeInOut(k);
  return { x: flying.x + (home.x - flying.x) * e, y: flying.y + (0 - flying.y) * e + Math.sin(k * Math.PI) * (active ? 150 : 0), z: flying.z + (home.z - flying.z) * e, rot: flying.rot * (1 - e) + Math.sin(k * Math.PI) * 0.4 * (i % 2 ? 1 : -1) };
}

function drawStage(ctx: CanvasRenderingContext2D, c: Cam, t: number, theme: Theme, standing: boolean[], rim: string, aim: { x: number; z: number }) {
  // Ball: rolls in, strikes the head pin, carries on into the pit.
  const ballZ = t < IMPACT ? -300 + (aim.z + 300) * (t / IMPACT) : aim.z + (t - IMPACT) * 3.2;
  const ballX = t < IMPACT ? -20 + (aim.x + 20) * (t / IMPACT) : aim.x + (aim.x - -20) / (aim.z + 300) * (t - IMPACT) * 3.2;
  const items: { z: number; draw: (mirror: boolean) => void }[] = [];
  if (ballZ < 900) {
    items.push({ z: ballZ, draw: (mirror) => {
      const r = 27, p = proj(c, ballX, r, ballZ), pr = r * p.s;
      if (mirror) { const f = proj(c, ballX, 0, ballZ); proBall(ctx, p.x, f.y + (f.y - p.y), pr, ballZ * 0.04, theme); return; }
      const f = proj(c, ballX, 0, ballZ);
      ctx.fillStyle = "rgba(0,0,0,.5)"; ctx.beginPath(); ctx.ellipse(f.x, f.y, pr * 1.05, pr * 0.22, 0, 0, Math.PI * 2); ctx.fill();
      if (t < IMPACT) for (let k = 1; k < 6; k++) { const q = proj(c, ballX, r, ballZ - k * 20); ctx.globalAlpha = 0.12 * (1 - k / 6); proBall(ctx, q.x, q.y, r * q.s, 0, theme); ctx.globalAlpha = 1; }
      proBall(ctx, p.x, p.y, pr, ballZ * 0.04, theme);
    } });
  }
  for (let i = 0; i < 10; i++) {
    const pose = pinAt(i, t, standing[i]);
    if (!pose) continue;
    items.push({ z: pose.z, draw: (mirror) => {
      const centre = proj(c, pose.x, pose.y + (PIN_H / 2) * Math.abs(Math.cos(pose.rot)) + 14 * Math.abs(Math.sin(pose.rot)), pose.z);
      const hh = PIN_H * centre.s;
      if (mirror) {
        if (pose.y > 90) return;
        const f = proj(c, pose.x, 0, pose.z);
        proPin(ctx, centre.x, f.y + (f.y - centre.y), hh, Math.PI - pose.rot, rim, 1 - pose.y / 90);
        return;
      }
      const f = proj(c, pose.x, 0, pose.z), lift = Math.max(0, pose.y) / 200;
      ctx.fillStyle = `rgba(0,0,0,${0.45 * (1 - Math.min(1, lift))})`;
      ctx.beginPath(); ctx.ellipse(f.x, f.y, hh * 0.26 * (1 + lift), hh * 0.06, 0, 0, Math.PI * 2); ctx.fill();
      // Motion trail in bullet time.
      if (t > IMPACT && t < FALL_END && standing[i]) {
        const back = pinAt(i, t - 10, true);
        if (back) { const q = proj(c, back.x, back.y + PIN_H / 2, back.z); proPin(ctx, q.x, q.y, PIN_H * q.s, back.rot, rim, 0.18); }
      }
      proPin(ctx, centre.x, centre.y, hh, pose.rot, rim);
    } });
  }
  items.sort((a, b) => b.z - a.z);
  // Reflections first (faded toward the viewer), then the scene.
  ctx.save();
  ctx.globalAlpha = 0.16;
  for (const it of items) it.draw(true);
  ctx.restore();
  const top = proj(c, 0, 0, 1400).y, fade = ctx.createLinearGradient(0, top, 0, c.H);
  fade.addColorStop(0, "rgba(0,0,0,0)"); fade.addColorStop(1, "rgba(0,0,0,.35)");
  ctx.fillStyle = fade; ctx.fillRect(-20, top, 430, c.H - top + 20);
  for (const it of items) it.draw(false);
}

/** The rack, rebuilt, lit like a trophy: a ring of light on the floor and a sheen sweeping across the pins. */
function trophyLight(ctx: CanvasRenderingContext2D, c: Cam, t: number, theme: Theme) {
  const k = seg(t, BUILD + 240, BUILD + 300);
  if (k <= 0) return;
  const p = proj(c, 0, 0, 125);
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  for (let r = 0; r < 2; r++) {
    const u = ((t - BUILD - 240 + r * 60) % 120) / 120;
    ctx.strokeStyle = `rgba(${PALETTE[theme].beam},${0.6 * k * (1 - u)})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(p.x, p.y, (90 + u * 160) * p.s, (22 + u * 40) * p.s, 0, 0, Math.PI * 2); ctx.stroke();
  }
  const halo = ctx.createRadialGradient(p.x, p.y - 70 * p.s, 0, p.x, p.y - 70 * p.s, 190 * p.s);
  halo.addColorStop(0, `rgba(${PALETTE[theme].beam},${0.32 * k})`); halo.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = halo; ctx.fillRect(p.x - 220, p.y - 280, 440, 400);
  ctx.restore();
}

/* ------------------------------------------------------------------ entry point */

/** Draws studio frame t (0 … CARTOON_TICKS) plus its title, sparks and lower third. */
export function drawCartoon(ctx: CanvasRenderingContext2D, s: BowlingStateV3, H: number, t: number) {
  const kind = s.lastResult?.kind;
  if (kind !== "strike" && kind !== "spare") return;
  const look = cartoonFor(s), theme = THEME[look], pal = PALETTE[theme];
  const label = kind === "strike" ? tx("bowling.strike") : tx("bowling.spare");
  const tt = Math.max(0, Math.min(CARTOON_TICKS - 1, t));
  // Camera: a slow push-in, a jolt at the impact, a gentle drift while the rack is rebuilt.
  const shake = tt > IMPACT && tt < IMPACT + 24 ? (IMPACT + 24 - tt) / 24 : 0;
  const c: Cam = {
    H, horizon: H * 0.36, floor: H * 0.75,
    zoom: 1 + 0.12 * easeOut(seg(tt, 0, SLOW_END)) - 0.06 * easeInOut(seg(tt, SLOW_END, BUILD)),
    sx: Math.sin(tt * 2.1) * 6 * shake + Math.sin(tt * 0.006) * 8 * seg(tt, BUILD, CARTOON_TICKS),
    sy: Math.cos(tt * 2.9) * 5 * shake,
  };
  // Pins standing before the ball: the whole rack on a strike, the pins left over on a spare.
  const standing = Array.from({ length: 10 }, () => kind === "strike");
  if (kind === "spare") for (const i of SPARE_LEFT.slice(0, Math.max(1, Math.min(9, s.lastResult?.knocked ?? 2)))) standing[i] = true;
  const rim = `rgba(${pal.beam},1)`;
  const up = RACK.filter((_, i) => standing[i]), aim = { x: up.reduce((a, p) => a + p.x, 0) / up.length, z: Math.min(...up.map((p) => p.z)) };
  ctx.save();
  if (look === "gala") setGala(ctx, c, tt); else if (look === "arena") setArena(ctx, c, tt); else setOrbit(ctx, c, tt);
  const seed = (s.lastResult?.frame ?? 0) * 5 + s.rolls.length;
  if (tt > BUILD + 260) fireworks(ctx, tt - BUILD - 260, H * 0.62, 10, seed, [...pal.spark, "#5cffb0", "#ff6fd8"]);
  trophyLight(ctx, c, tt, theme);
  drawStage(ctx, c, tt, theme, standing, rim, aim);
  // Impact: flash, sparks and a shockwave on the floor.
  const hit = proj(c, aim.x, 50, aim.z);
  if (tt >= IMPACT && tt < IMPACT + 14) { ctx.fillStyle = `rgba(255,255,255,${0.7 * (1 - (tt - IMPACT) / 14)})`; ctx.fillRect(-20, -20, 430, H + 40); }
  sparks(ctx, (tt - IMPACT) * 0.5, hit.x, hit.y, kind === "strike" ? 90 : 50, pal.spark, seed, H);
  if (tt > IMPACT && tt < IMPACT + 90) {
    const u = (tt - IMPACT) / 90, f = proj(c, aim.x, 0, aim.z);
    ctx.strokeStyle = `rgba(${pal.beam},${0.8 * (1 - u)})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(f.x, f.y, 30 + u * 260, 8 + u * 60, 0, 0, Math.PI * 2); ctx.stroke();
  }
  // Title act: lands in bullet time, stays up; lower third once the pins are down.
  const u = tt - 150, cy = H * 0.2;
  if (u >= 0) {
    if (u < 10) { ctx.fillStyle = `rgba(255,255,255,${0.5 * (1 - u / 10)})`; ctx.fillRect(-20, -20, 430, H + 40); }
    proTitle(ctx, label, u, cy, kind === "strike" ? 78 : 54, theme);
    lensFlare(ctx, u - 8, cy - 4, pal.beam);
    lowerThird(ctx, s, tt - 560, H, theme, label);
  }
  confetti(ctx, tt - BUILD - 220, H, 80, s.rolls.length);
  // Cinematic letterbox and vignette.
  const bar = 26 * easeOut(seg(tt, 0, 20));
  ctx.fillStyle = "#000"; ctx.fillRect(-20, -20, 430, bar + 20); ctx.fillRect(-20, H - bar, 430, bar + 20);
  const vig = ctx.createRadialGradient(195, H / 2, H * 0.3, 195, H / 2, H * 0.8);
  vig.addColorStop(0, "rgba(0,0,0,0)"); vig.addColorStop(1, "rgba(0,0,0,.5)");
  ctx.fillStyle = vig; ctx.fillRect(-20, -20, 430, H + 40);
  if (tt < 18) { ctx.fillStyle = `rgba(255,255,255,${0.8 * (1 - tt / 18)})`; ctx.fillRect(-20, -20, 430, H + 40); }
  ctx.restore();
}
