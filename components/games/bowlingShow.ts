/*
 * Bowling V3 celebrations (v125) — presentation only. After a short instant replay, a 10-second cartoon with the
 * pins as characters (eyes, arms, legs, sneakers):
 *  - strike «Despegue»: the knocked-down pins come round, put on space helmets, march into a rocket and blast off;
 *  - strike «Disco orbital»: under a mirror-ball planet the pins dance a kick line and finish in the rack pyramid;
 *  - spare «Abducción»: a flying saucer beams the pins up and drops them back with parachutes.
 * Which cartoon plays is a hash of the seed, the frame and the roll count (looks random, identical on replay).
 * Everything is a pure function of the state and the ticks since the celebration started; the core decides how
 * long the celebration lasts and records the SKIP.
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

export type Cartoon = "launch" | "disco" | "ufo";
export type Theme = "gold" | "neon" | "cosmic" | "steel";
export function cartoonFor(s: Pick<BowlingStateV3, "seed" | "rolls" | "lastResult">): Cartoon {
  if (s.lastResult?.kind !== "strike") return "ufo";
  const k = hash01(seedHash(s.seed) * 0.001 + (s.lastResult?.frame ?? 0) * 7.13 + s.rolls.length * 3.7);
  return k < 0.5 ? "launch" : "disco";
}
const THEME: Record<Cartoon, Theme> = { launch: "gold", disco: "neon", ufo: "cosmic" };

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

/* ------------------------------------------------------------------ the pin character */

export type PinPose = {
  tilt?: number; squash?: number; eyes?: "open" | "happy" | "dizzy" | "wow" | "closed"; mouth?: "smile" | "grin" | "o" | "wobble";
  /** Arm angles from hanging down (0) through sideways (π/2) to straight up (π). */
  armL?: number; armR?: number; legL?: number; legR?: number;
  helmet?: number; shades?: number; look?: number; alpha?: number; flip?: number;
};
/** A pin with a face, arms, legs and sneakers, standing with its feet at (x, y); h is the full height. */
export function pinChar(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, p: PinPose = {}) {
  const w = h * 0.34, leg = h * 0.13, bodyH = h - leg, lw = Math.max(1, h * 0.022);
  ctx.save();
  ctx.globalAlpha *= p.alpha ?? 1;
  ctx.translate(x, y);
  ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.beginPath(); ctx.ellipse(0, 0, w * 0.75, w * 0.18, 0, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(p.tilt ?? 0);
  const sq = p.squash ?? 0;
  ctx.scale((1 + sq * 0.22) * (p.flip ?? 1), 1 - sq * 0.22);
  // Legs and sneakers.
  ctx.lineCap = "round";
  for (const [side, ang] of [[-1, p.legL ?? 0], [1, p.legR ?? 0]] as const) {
    ctx.save(); ctx.translate(side * w * 0.17, -leg); ctx.rotate(-side * 0.05 + ang);
    ctx.strokeStyle = "#dfe6f2"; ctx.lineWidth = w * 0.16; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, leg * 0.8); ctx.stroke();
    ctx.fillStyle = "#ff3d9a"; ctx.beginPath(); ctx.ellipse(side * w * 0.07, leg * 0.88, w * 0.17, w * 0.1, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ffffff"; ctx.fillRect(side * w * 0.07 - w * 0.17, leg * 0.9, w * 0.34, w * 0.05);
    ctx.restore();
  }
  ctx.translate(0, -leg);
  // Arms behind the body's outline (shoulder at the belly's widest point).
  const arm = (side: number, ang: number) => {
    ctx.save(); ctx.translate(side * w * 0.42, -bodyH * 0.34); ctx.rotate(side * -ang);
    ctx.strokeStyle = "#1b2238"; ctx.lineWidth = w * 0.16 + lw * 1.6; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(side * w * 0.12, bodyH * 0.14, 0, bodyH * 0.27); ctx.stroke();
    ctx.strokeStyle = "#e8eef8"; ctx.lineWidth = w * 0.16; ctx.stroke();
    ctx.fillStyle = "#ffffff"; ctx.strokeStyle = "#1b2238"; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.arc(0, bodyH * 0.29, w * 0.13, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  };
  arm(-1, p.armL ?? 0.25); arm(1, p.armR ?? 0.25);
  // Body.
  const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  g.addColorStop(0, "#b9c3d2"); g.addColorStop(0.38, "#ffffff"); g.addColorStop(1, "#9aa6b8");
  ctx.fillStyle = g; ctx.strokeStyle = "#1b2238"; ctx.lineWidth = lw;
  const H = bodyH;
  ctx.beginPath();
  ctx.moveTo(0, -H);
  ctx.bezierCurveTo(w * 0.36, -H, w * 0.38, -H * 0.82, w * 0.25, -H * 0.68);
  ctx.bezierCurveTo(w * 0.18, -H * 0.6, w * 0.58, -H * 0.42, w * 0.52, -H * 0.13);
  ctx.bezierCurveTo(w * 0.48, 0, -w * 0.48, 0, -w * 0.52, -H * 0.13);
  ctx.bezierCurveTo(-w * 0.58, -H * 0.42, -w * 0.18, -H * 0.6, -w * 0.25, -H * 0.68);
  ctx.bezierCurveTo(-w * 0.38, -H * 0.82, -w * 0.36, -H, 0, -H);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,.75)"; ctx.beginPath(); ctx.ellipse(-w * 0.2, -H * 0.36, w * 0.06, H * 0.12, 0.1, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#e12d3f";
  ctx.fillRect(-w * 0.26, -H * 0.71, w * 0.52, H * 0.03); ctx.fillRect(-w * 0.24, -H * 0.66, w * 0.48, H * 0.03);
  // Face.
  const ey = -H * 0.86, ex = w * 0.12, er = w * 0.085, look = (p.look ?? 0) * er * 0.5, eyes = p.eyes ?? "open";
  ctx.strokeStyle = "#1b1f2e"; ctx.fillStyle = "#1b1f2e"; ctx.lineWidth = Math.max(0.9, w * 0.045);
  for (const side of [-1, 1]) {
    const cx = side * ex;
    if (eyes === "happy") { ctx.beginPath(); ctx.arc(cx, ey + er * 0.5, er, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
    else if (eyes === "closed") { ctx.beginPath(); ctx.moveTo(cx - er, ey); ctx.lineTo(cx + er, ey); ctx.stroke(); }
    else if (eyes === "dizzy") { ctx.beginPath(); ctx.moveTo(cx - er, ey - er); ctx.lineTo(cx + er, ey + er); ctx.moveTo(cx + er, ey - er); ctx.lineTo(cx - er, ey + er); ctx.stroke(); }
    else {
      const big = eyes === "wow" ? 1.35 : 1.1;
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.ellipse(cx, ey, er * big, er * big * 1.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = Math.max(0.7, w * 0.03); ctx.stroke();
      ctx.fillStyle = "#1b1f2e"; ctx.beginPath(); ctx.arc(cx + look, ey + er * 0.15, er * (eyes === "wow" ? 0.4 : 0.55), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(cx + look - er * 0.2, ey - er * 0.15, er * 0.18, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = Math.max(0.9, w * 0.045);
    }
  }
  ctx.fillStyle = "rgba(255,110,150,.5)";
  for (const side of [-1, 1]) { ctx.beginPath(); ctx.arc(side * w * 0.22, ey + H * 0.05, w * 0.055, 0, Math.PI * 2); ctx.fill(); }
  const mouth = p.mouth ?? "smile";
  ctx.strokeStyle = "#1b1f2e"; ctx.fillStyle = "#1b1f2e";
  if (mouth === "smile") { ctx.beginPath(); ctx.arc(0, ey + H * 0.03, w * 0.11, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); }
  else if (mouth === "grin") {
    ctx.beginPath(); ctx.moveTo(-w * 0.13, ey + H * 0.045); ctx.quadraticCurveTo(0, ey + H * 0.12, w * 0.13, ey + H * 0.045); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#ff6f8a"; ctx.beginPath(); ctx.ellipse(0, ey + H * 0.075, w * 0.05, H * 0.015, 0, 0, Math.PI * 2); ctx.fill();
  } else if (mouth === "o") { ctx.beginPath(); ctx.ellipse(0, ey + H * 0.07, w * 0.055, H * 0.03, 0, 0, Math.PI * 2); ctx.fill(); }
  else { ctx.beginPath(); ctx.moveTo(-w * 0.09, ey + H * 0.07); ctx.quadraticCurveTo(-w * 0.03, ey + H * 0.05, 0, ey + H * 0.07); ctx.quadraticCurveTo(w * 0.03, ey + H * 0.09, w * 0.09, ey + H * 0.065); ctx.stroke(); }
  if ((p.shades ?? 0) > 0) {
    const sy = ey - (1 - (p.shades ?? 0)) * H * 0.4;
    ctx.globalAlpha *= clamp01((p.shades ?? 0) * 2);
    ctx.fillStyle = "#0b0f1e";
    for (const side of [-1, 1]) { ctx.beginPath(); ctx.roundRect(side * ex - er * 1.5, sy - er * 1.1, er * 3, er * 2.1, er * 0.7); ctx.fill(); }
    ctx.fillRect(-ex + er, sy - er * 0.5, 2 * ex - 2 * er, er * 0.35);
    ctx.fillStyle = "rgba(127,227,238,.7)";
    for (const side of [-1, 1]) ctx.fillRect(side * ex - er * 0.9, sy - er * 0.7, er * 0.7, er * 0.3);
  }
  if ((p.helmet ?? 0) > 0) {
    const drop = (1 - (p.helmet ?? 0)) * -H * 0.9, cy = -H * 0.83 + drop, r = w * 0.48;
    ctx.globalAlpha = (p.alpha ?? 1) * clamp01((p.helmet ?? 0) * 3);
    const hg = ctx.createRadialGradient(-r * 0.35, cy - r * 0.4, r * 0.1, 0, cy, r);
    hg.addColorStop(0, "rgba(255,255,255,.55)"); hg.addColorStop(0.5, "rgba(160,220,255,.16)"); hg.addColorStop(1, "rgba(127,227,238,.35)");
    ctx.fillStyle = hg; ctx.strokeStyle = "rgba(220,245,255,.9)"; ctx.lineWidth = lw * 1.2;
    ctx.beginPath(); ctx.arc(0, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#c9d3e2"; ctx.strokeStyle = "#1b2238"; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.roundRect(-r * 0.75, cy + r * 0.78, r * 1.5, r * 0.32, r * 0.12); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#ffd23f"; ctx.beginPath(); ctx.arc(r * 0.45, cy + r * 0.94, r * 0.07, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
/** Little stars orbiting a dizzy head. */
function dizzyStars(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number) {
  ctx.save(); ctx.fillStyle = "#ffd23f";
  for (let k = 0; k < 3; k++) {
    const a = t * 0.12 + (k * Math.PI * 2) / 3, sx = x + Math.cos(a) * r, sy = y + Math.sin(a) * r * 0.35;
    star(ctx, sx, sy, 4 + Math.sin(a) * 1.2);
  }
  ctx.restore();
}
function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill();
}
function starfield(ctx: CanvasRenderingContext2D, H: number, n: number, t: number, seed: number) {
  for (let i = 0; i < n; i++) {
    const x = hash01(i * 3.7 + seed) * 390, y = hash01(i * 9.1 + seed) * H * 0.75, tw = 0.5 + 0.5 * Math.sin(t * 0.05 + i);
    ctx.fillStyle = `rgba(255,255,255,${0.25 + 0.6 * tw * hash01(i * 1.3)})`; ctx.fillRect(x, y, 1.6, 1.6);
  }
}

/* ------------------------------------------------------------------ strike: «Despegue» */

function sceneLaunch(ctx: CanvasRenderingContext2D, H: number, t: number) {
  const ground = H * 0.7, rx = 318;
  const lift = t < 860 ? 0 : 0.5 * 0.034 * (t - 860) ** 2;
  const shake = t > 790 && t < 1000 ? (hash01(t * 1.7) - 0.5) * 6 * (1 - seg(t, 940, 1000)) : 0;
  ctx.save(); ctx.translate(shake, shake * 0.4);
  // Sky and a ringed planet rising.
  const sky = ctx.createLinearGradient(0, 0, 0, ground);
  sky.addColorStop(0, "#05041a"); sky.addColorStop(0.7, "#1d1046"); sky.addColorStop(1, "#3a1d5c");
  ctx.fillStyle = sky; ctx.fillRect(-10, -10, 410, ground + 10);
  starfield(ctx, H, 90, t, 11);
  const px = 90, py = H * 0.22 - seg(t, 0, 1200) * 20;
  const pg = ctx.createRadialGradient(px - 18, py - 18, 4, px, py, 46);
  pg.addColorStop(0, "#9fe8ff"); pg.addColorStop(0.6, "#4a7bd8"); pg.addColorStop(1, "#1b2a6a");
  ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(px, py, 46, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(230,210,255,.7)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(px, py, 78, 16, -0.3, 0, Math.PI * 2); ctx.stroke();
  // Moon ground with craters.
  const gg = ctx.createLinearGradient(0, ground, 0, H);
  gg.addColorStop(0, "#8d8fa6"); gg.addColorStop(1, "#3c3e52");
  ctx.fillStyle = gg; ctx.beginPath(); ctx.moveTo(-10, ground + 6);
  for (let x = -10; x <= 400; x += 20) ctx.lineTo(x, ground + Math.sin(x * 0.03) * 4);
  ctx.lineTo(400, H + 10); ctx.lineTo(-10, H + 10); ctx.closePath(); ctx.fill();
  for (let i = 0; i < 7; i++) {
    const cx = hash01(i * 4.1) * 390, cy = ground + 18 + hash01(i * 2.3) * (H - ground - 40), r = 10 + hash01(i) * 18;
    ctx.fillStyle = "rgba(40,40,60,.35)"; ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.32, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(220,220,240,.25)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(cx, cy - 1, r, r * 0.32, 0, Math.PI, Math.PI * 2); ctx.stroke();
  }
  // Launch pad.
  ctx.fillStyle = "#2a2f45"; ctx.fillRect(rx - 52, ground - 8, 104, 12);
  ctx.fillStyle = "#ffd23f"; for (let i = 0; i < 6; i++) ctx.fillRect(rx - 50 + i * 18, ground - 8, 9, 3);
  // Tower with blinking light.
  ctx.strokeStyle = "#5b6688"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(rx + 58, ground - 4); ctx.lineTo(rx + 58, ground - 210); ctx.stroke();
  for (let k = 0; k < 9; k++) { ctx.beginPath(); ctx.moveTo(rx + 52, ground - 10 - k * 22); ctx.lineTo(rx + 64, ground - 30 - k * 22); ctx.stroke(); }
  ctx.fillStyle = Math.floor(t / 30) % 2 ? "#ff3b5c" : "#5a1020"; ctx.beginPath(); ctx.arc(rx + 58, ground - 214, 4, 0, Math.PI * 2); ctx.fill();
  // Smoke billows from ignition.
  const smoke = (from: number) => {
    for (let i = 0; i < 26; i++) {
      const u = t - from - hash01(i * 5.3) * 60;
      if (u <= 0) continue;
      const dir = hash01(i * 2.9) - 0.5, x = rx + dir * (30 + u * 1.6), y = ground - 6 - hash01(i * 7.7) * 20 - u * 0.12;
      const r = 10 + Math.min(40, u * 0.35);
      ctx.fillStyle = `rgba(230,232,245,${Math.max(0, 0.55 - u / 700)})`; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
  };
  // Rocket.
  const ry = ground - 6 - lift;
  if (ry > -260) {
    ctx.save(); ctx.translate(rx, ry); ctx.scale(1.22, 1.22);
    if (t > 800) {
      const fl = 30 + 40 * seg(t, 800, 870) + Math.sin(t * 0.9) * 8;
      const fg = ctx.createLinearGradient(0, 0, 0, fl + 40);
      fg.addColorStop(0, "#ffffff"); fg.addColorStop(0.3, "#ffd23f"); fg.addColorStop(0.7, "#ff6a3d"); fg.addColorStop(1, "rgba(255,60,80,0)");
      ctx.fillStyle = fg; ctx.beginPath(); ctx.moveTo(-16, -4); ctx.quadraticCurveTo(0, fl + 60, 16, -4); ctx.closePath(); ctx.fill();
    }
    // Fins.
    ctx.fillStyle = "#e12d3f"; ctx.strokeStyle = "#1b2238"; ctx.lineWidth = 2;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 22, -60); ctx.lineTo(s * 44, -8); ctx.lineTo(s * 22, -14); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    const bg = ctx.createLinearGradient(-24, 0, 24, 0);
    bg.addColorStop(0, "#b9c3d2"); bg.addColorStop(0.4, "#ffffff"); bg.addColorStop(1, "#8f9aab");
    ctx.fillStyle = bg; ctx.beginPath(); ctx.moveTo(-24, -10); ctx.lineTo(-24, -150); ctx.quadraticCurveTo(-22, -210, 0, -236); ctx.quadraticCurveTo(22, -210, 24, -150); ctx.lineTo(24, -10); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#e12d3f"; ctx.beginPath(); ctx.moveTo(-17, -196); ctx.quadraticCurveTo(0, -205, 17, -196); ctx.quadraticCurveTo(10, -222, 0, -236); ctx.quadraticCurveTo(-10, -222, -17, -196); ctx.fill();
    ctx.fillStyle = "#e12d3f"; ctx.fillRect(-24, -40, 48, 7);
    ctx.fillStyle = "#1b2238"; ctx.font = "900 15px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("GG", 0, -62);
    // Portholes with the passengers (once they are on board).
    for (let k = 0; k < 3; k++) {
      const py2 = -168 + k * 30;
      ctx.fillStyle = "#0b1430"; ctx.strokeStyle = "#9aa6b8"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, py2, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (t > 690) {
        ctx.save(); ctx.beginPath(); ctx.arc(0, py2, 9, 0, Math.PI * 2); ctx.clip();
        ctx.fillStyle = "#f4f7fc"; ctx.beginPath(); ctx.arc(0, py2 + 4, 8, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#1b1f2e"; ctx.lineWidth = 1.2;
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * 2.6, py2 + 2, 1.6, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
        ctx.beginPath(); ctx.arc(0, py2 + 4, 2.4, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
        ctx.restore();
        if (t > 880) { ctx.fillStyle = "#fff"; ctx.strokeStyle = "#1b2238"; ctx.lineWidth = 1; const wv = Math.sin(t * 0.3 + k) * 3; ctx.beginPath(); ctx.arc(12 + wv * 0.3, py2 - 6 + wv, 3.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      }
    }
    // Hatch: open while the crew boards.
    const open = seg(t, 420, 450) * (1 - seg(t, 690, 720));
    ctx.fillStyle = open > 0.05 ? "#0b1430" : "#c9d3e2"; ctx.strokeStyle = "#1b2238"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(-11, -36, 22, 28, 5); ctx.fill(); ctx.stroke();
    if (open > 0.05) { ctx.fillStyle = "#ffd76a"; ctx.globalAlpha = 0.5 * open; ctx.fillRect(-9, -34, 18, 24); ctx.globalAlpha = 1; }
    ctx.restore();
  }
  if (t > 790) smoke(790);
  // Countdown on a little board.
  if (t > 700 && t < 900) {
    const n = t < 740 ? 3 : t < 780 ? 2 : t < 820 ? 1 : 0, local = (t - 700) % 40;
    ctx.save(); ctx.globalAlpha = Math.min(1, (900 - t) / 20);
    ctx.fillStyle = "rgba(8,12,30,.85)"; ctx.strokeStyle = "#ffd23f"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(40, ground - 150, 92, 70, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle = n ? "#ffd23f" : "#5cffb0"; ctx.font = `900 ${n ? 44 + (40 - local) * 0.4 : 28}px system-ui`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(n ? String(n) : "GO!", 86, ground - 115);
    ctx.restore();
  }
  // The crew.
  for (let i = 0; i < 10; i++) {
    const x0 = 18 + i * 21 + hash01(i * 3.3 + 1) * 10, h = 80 + hash01(i * 1.9) * 10, row = i % 2;
    const up = spring(seg(t, 150 + i * 12, 200 + i * 12)), happy = t > 190 + i * 12;
    const helm = easeOut(seg(t, 300 + i * 8, 330 + i * 8));
    const startWalk = 430 + i * 14;
    const dist = rx - x0, walkT = Math.max(0, t - startWalk), xw = Math.min(dist, walkT * 2.2), x = x0 + xw;
    if (xw >= dist && walkT * 2.2 > dist + 20) continue; // on board
    const walking = walkT > 0 && xw < dist, step = Math.sin(walkT * 0.35 + i);
    const hop = xw >= dist ? Math.sin(Math.min(1, (walkT * 2.2 - dist) / 20) * Math.PI) * 20 : 0;
    const lying = (1 - up) * (i % 2 ? 1 : -1) * Math.PI / 2;
    const cheer = t > 330 && t < 430;
    pinChar(ctx, x, ground + 6 + row * 18 - hop - (walking ? Math.abs(step) * 3 : 0), h * (row ? 1 : 0.92), {
      tilt: lying + (walking ? step * 0.06 : 0), squash: up < 1 && up > 0.85 ? (1 - up) * 2 : 0,
      eyes: happy ? (cheer ? "happy" : "open") : "dizzy", mouth: happy ? (cheer ? "grin" : "smile") : "wobble",
      armL: cheer ? 2.6 + Math.sin(t * 0.3 + i) * 0.3 : walking ? 0.3 + step * 0.4 : 0.25, armR: cheer ? 2.6 + Math.cos(t * 0.3 + i) * 0.3 : walking ? 0.3 - step * 0.4 : 0.25,
      legL: walking ? step * 0.5 : 0, legR: walking ? -step * 0.5 : 0, helmet: helm, look: walking ? 1 : 0,
    });
    if (!happy) dizzyStars(ctx, x + (i % 2 ? 1 : -1) * h * 0.6 * (1 - up), ground + row * 18 - (h * 0.2 + (h * 0.75) * up), 16, t + i * 9);
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ strike: «Disco orbital» */

function sceneDisco(ctx: CanvasRenderingContext2D, H: number, t: number) {
  const floor = H * 0.64, beat = t / 60, pulse = Math.pow(1 - (beat % 1), 3);
  // Back wall with neon arcs.
  const wall = ctx.createLinearGradient(0, 0, 0, floor);
  wall.addColorStop(0, "#07051a"); wall.addColorStop(1, "#1a0b3a");
  ctx.fillStyle = wall; ctx.fillRect(0, 0, 390, floor);
  starfield(ctx, H, 50, t, 23);
  for (let k = 0; k < 3; k++) {
    ctx.strokeStyle = k === 1 ? `rgba(127,227,238,${0.5 + 0.4 * pulse})` : `rgba(255,111,216,${0.45 + 0.4 * pulse})`;
    ctx.lineWidth = 4; ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.arc(195, floor + 40, 150 + k * 34, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
  }
  ctx.shadowBlur = 0;
  // Disco floor in perspective: tiles light in a travelling pattern on the beat.
  const rows = 7, cols = 9;
  for (let r = 0; r < rows; r++) {
    const y0 = floor + (H - floor) * Math.pow(r / rows, 1.3), y1 = floor + (H - floor) * Math.pow((r + 1) / rows, 1.3);
    const sp0 = 0.55 + 0.45 * (r / rows), sp1 = 0.55 + 0.45 * ((r + 1) / rows);
    for (let c = 0; c < cols; c++) {
      const x0a = 195 + ((c / cols) - 0.5) * 520 * sp0, x1a = 195 + (((c + 1) / cols) - 0.5) * 520 * sp0;
      const x0b = 195 + ((c / cols) - 0.5) * 520 * sp1, x1b = 195 + (((c + 1) / cols) - 0.5) * 520 * sp1;
      const lit = (c + r + Math.floor(beat)) % 3 === 0;
      const hue = ["255,111,216", "127,227,238", "255,210,63"][(c * 7 + r * 3 + Math.floor(beat / 2)) % 3];
      ctx.fillStyle = lit ? `rgba(${hue},${0.35 + 0.45 * pulse})` : "rgba(30,20,60,.9)";
      ctx.beginPath(); ctx.moveTo(x0a + 1, y0 + 1); ctx.lineTo(x1a - 1, y0 + 1); ctx.lineTo(x1b - 1, y1 - 1); ctx.lineTo(x0b + 1, y1 - 1); ctx.closePath(); ctx.fill();
    }
  }
  // Mirror-ball planet coming down, spinning, throwing light dots.
  const by = -60 + (H * 0.16 + 60) * easeOut(seg(t, 0, 110)), br = 36;
  ctx.strokeStyle = "#8a94b0"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(195, 0); ctx.lineTo(195, by - br); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.arc(195, by, br, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = "#2a3050"; ctx.fillRect(195 - br, by - br, br * 2, br * 2);
  for (let la = -4; la < 4; la++) for (let lo = 0; lo < 12; lo++) {
    const a = (lo / 12) * Math.PI * 2 + t * 0.03, x = 195 + Math.sin(a) * br * Math.cos((la + 0.5) / 4 * Math.PI / 2);
    if (Math.cos(a) < 0) continue;
    const y = by + ((la + 0.5) / 4) * br, sh = hash01(lo * 13 + la * 7 + Math.floor(t / 6)) > 0.8;
    ctx.fillStyle = sh ? "#ffffff" : `rgba(${150 + lo * 8},${170 + la * 10},230,.9)`; ctx.fillRect(x - 3, y - 3, 5.5, 5.5);
  }
  ctx.restore();
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2 + t * 0.02, d = 80 + hash01(i) * 220;
    const x = 195 + Math.cos(a) * d, y = by + Math.sin(a) * d * 0.55 + 30;
    ctx.fillStyle = `rgba(255,255,255,${0.15 + 0.25 * hash01(i * 3 + Math.floor(t / 10))})`; ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill();
  }
  // Spotlights sweeping from the top corners.
  for (const [sx, col, ph] of [[0, "255,111,216", 0], [390, "127,227,238", 1.7]] as const) {
    const ang = Math.PI / 2 + (sx ? 0.5 : -0.5) + Math.sin(t * 0.025 + ph) * 0.35, len = H;
    const g = ctx.createLinearGradient(sx, 0, sx + Math.cos(ang) * len, Math.sin(ang) * len);
    g.addColorStop(0, `rgba(${col},.45)`); g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(sx, 0);
    ctx.lineTo(sx + Math.cos(ang - 0.13) * len, Math.sin(ang - 0.13) * len); ctx.lineTo(sx + Math.cos(ang + 0.13) * len, Math.sin(ang + 0.13) * len); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  // Dancers.
  const pyramid = [[0, 0], [1, 0], [2, 0], [3, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [0, 3]];
  const rowN = [4, 3, 2, 1], h = 74;
  const items: { x: number; y: number; i: number; pose: PinPose }[] = [];
  for (let i = 0; i < 10; i++) {
    const lineX = 26 + i * 37.5, fromLeft = i < 5;
    const enter = easeOut(seg(t, 110 + (fromLeft ? 4 - i : i - 5) * 16, 200 + (fromLeft ? 4 - i : i - 5) * 16));
    let x = fromLeft ? -40 + (lineX + 40) * enter : 430 - (430 - lineX) * enter, y = floor + 34;
    const pose: PinPose = { eyes: "happy", mouth: "grin", shades: easeOut(seg(t, 280 + i * 4, 310 + i * 4)) };
    const sliding = enter > 0 && enter < 1;
    if (sliding) { pose.tilt = (fromLeft ? 1 : -1) * 0.18; pose.legL = (fromLeft ? -1 : 1) * 0.4; pose.legR = (fromLeft ? 1 : -1) * 0.2; pose.armL = 1.3; pose.armR = 1.3; pose.eyes = "open"; }
    if (t >= 300 && t < 700) {
      // Kick line: a wave of kicks along the line on the beat.
      const ph = beat * Math.PI * 2 - i * 0.45, kick = Math.max(0, Math.sin(ph));
      const left = Math.floor((beat - i * 0.07) % 2) === 0;
      pose.legL = left ? -kick * 1.25 : 0; pose.legR = left ? 0 : kick * 1.25;
      pose.armL = 1.6 + Math.sin(ph) * 0.5; pose.armR = 1.6 - Math.sin(ph) * 0.5;
      pose.tilt = Math.sin(ph) * 0.08;
      y -= Math.abs(Math.sin(beat * Math.PI)) * 7;
      pose.squash = pulse * 0.4;
    }
    if (t >= 700) {
      const [k, r] = pyramid[i], tx2 = 195 + (k - (rowN[r] - 1) / 2) * 46, ty2 = floor + 34 - r * h * 0.82;
      const jump = seg(t, 700 + (3 - r) * 0 + r * 22, 760 + r * 22), je = easeInOut(jump);
      x = x + (tx2 - x) * je; y = y + (ty2 - y) * je - Math.sin(jump * Math.PI) * (50 + r * 20);
      pose.legL = jump > 0 && jump < 1 ? -0.5 : 0; pose.legR = jump > 0 && jump < 1 ? 0.5 : 0;
      pose.armL = r === 3 && t > 830 ? 2.8 : 1.2 + (t > 830 ? Math.sin(t * 0.2 + i) * 0.4 : 0); pose.armR = r === 3 && t > 830 ? 2.8 : 1.2 + (t > 830 ? Math.cos(t * 0.2 + i) * 0.4 : 0);
      if (r === 3 && t > 800 && t < 880) pose.flip = Math.cos((t - 800) * 0.16);
      if (t > 1080) pose.tilt = Math.sin(seg(t, 1080, 1120) * Math.PI) * 0.45;
      items.push({ x, y, i: 100 - r * 10 - k, pose });
      continue;
    }
    items.push({ x, y, i, pose });
  }
  items.sort((a, b) => b.i - a.i).forEach((it) => pinChar(ctx, it.x, it.y, h, it.pose));
}

/* ------------------------------------------------------------------ spare: «Abducción» */

function sceneUfo(ctx: CanvasRenderingContext2D, H: number, t: number, count: number) {
  const ground = H * 0.7, h = 90;
  const sky = ctx.createLinearGradient(0, 0, 0, ground);
  sky.addColorStop(0, "#030a1c"); sky.addColorStop(0.6, "#0f2a4a"); sky.addColorStop(1, "#245a6a");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, 390, ground);
  starfield(ctx, H, 80, t, 41);
  for (const [mx, my, mr, mc] of [[300, H * 0.12, 26, "#ffe7b0"], [345, H * 0.2, 12, "#c9b3ff"]] as const) {
    const mg = ctx.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, 2, mx, my, mr);
    mg.addColorStop(0, "#ffffff"); mg.addColorStop(1, mc); ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
  }
  // Dunes and alien plants.
  for (const [base, col, amp, f] of [[ground - 22, "#173a4a", 16, 0.018], [ground, "#1f4f55", 10, 0.03]] as const) {
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= 390; x += 10) ctx.lineTo(x, base + Math.sin(x * f + base) * amp);
    ctx.lineTo(390, H); ctx.closePath(); ctx.fill();
  }
  const sand = ctx.createLinearGradient(0, ground, 0, H);
  sand.addColorStop(0, "#2c6a66"); sand.addColorStop(1, "#123038");
  ctx.fillStyle = sand; ctx.fillRect(0, ground + 8, 390, H - ground);
  for (const [px, ph] of [[34, 46], [362, 60], [70, 30]] as const) {
    ctx.strokeStyle = "#5cffb0"; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(px, ground + 12); ctx.quadraticCurveTo(px - 6, ground - ph * 0.5, px + 4, ground - ph); ctx.stroke();
    ctx.fillStyle = `rgba(92,255,176,${0.5 + 0.5 * Math.sin(t * 0.08 + px)})`; ctx.beginPath(); ctx.arc(px + 4, ground - ph, 5, 0, Math.PI * 2); ctx.fill();
  }
  // Saucer path: descend, hover, loop, hover, leave.
  let ux = 195, uy = -80;
  if (t < 150) uy = -80;
  else if (t < 260) uy = -80 + (H * 0.2 + 80) * easeOut(seg(t, 150, 260));
  else if (t < 620) { uy = H * 0.2 + Math.sin(t * 0.06) * 4; ux = 195 + Math.sin(t * 0.03) * 6; }
  else if (t < 760) { const a = seg(t, 620, 760) * Math.PI * 2; ux = 195 + Math.sin(a) * 120; uy = H * 0.2 - (1 - Math.cos(a)) * 40; }
  else if (t < 1020) { uy = H * 0.14 + Math.sin(t * 0.06) * 4; }
  else { const k = seg(t, 1020, 1200); ux = 195 + k * k * 420; uy = H * 0.14 - k * 120; }
  const beamOn = (t > 270 && t < 470) ? Math.min(1, (t - 270) / 12, (470 - t) / 12) : 0;
  if (beamOn > 0) {
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    const bg = ctx.createLinearGradient(0, uy, 0, ground + 20);
    bg.addColorStop(0, `rgba(127,255,200,${0.55 * beamOn})`); bg.addColorStop(1, `rgba(127,255,200,${0.12 * beamOn})`);
    ctx.fillStyle = bg; ctx.beginPath(); ctx.moveTo(ux - 30, uy + 14); ctx.lineTo(ux + 30, uy + 14); ctx.lineTo(ux + 140, ground + 30); ctx.lineTo(ux - 140, ground + 30); ctx.closePath(); ctx.fill();
    for (let i = 0; i < 24; i++) {
      const k = ((t * 0.012 + hash01(i)) % 1), x = ux + (hash01(i * 3) - 0.5) * 2 * (22 + 88 * (1 - k)), y = ground + 10 - k * (ground - uy);
      ctx.fillStyle = `rgba(220,255,240,${0.7 * beamOn})`; ctx.fillRect(x, y, 2, 2);
    }
    ctx.restore();
  }
  // Pins: tremble, get beamed up, parachute back, cheer.
  const n = Math.max(1, Math.min(9, count));
  for (let i = 0; i < n; i++) {
    const homeX = 195 + (i - (n - 1) / 2) * Math.min(52, 330 / n);
    const up = seg(t, 290 + i * 14, 400 + i * 14), inside = up >= 1 && t < 780;
    const drop = seg(t, 780 + i * 10, 1000 + i * 6);
    let x = homeX, y = ground + 30, alpha = 1;
    const pose: PinPose = { eyes: "wow", mouth: "o", armL: 0.4, armR: 0.4, look: -0.4 };
    if (t < 290 + i * 14) { x += Math.sin(t * 1.3 + i) * (t > 150 ? 1.6 : 0.6); pose.look = t > 150 ? 0 : -1; }
    if (up > 0 && up < 1) {
      const k = easeInOut(up);
      x = homeX + (ux - homeX) * k; y = ground + 30 + (uy + 14 - ground - 30) * k;
      pose.tilt = Math.sin(t * 0.1 + i) * 0.5; pose.armL = 2.4 + Math.sin(t * 0.4) * 0.5; pose.armR = 2.4 - Math.sin(t * 0.4) * 0.5;
      pose.legL = Math.sin(t * 0.35) * 0.5; pose.legR = -Math.sin(t * 0.35) * 0.5; pose.eyes = up > 0.5 ? "happy" : "wow"; pose.mouth = up > 0.5 ? "grin" : "o";
      alpha = 1 - seg(up, 0.85, 1);
    }
    if (inside) continue;
    if (t >= 780) {
      if (drop <= 0) continue;
      const k = drop;
      x = ux + (homeX - ux) * easeOut(Math.min(1, k * 1.6)) + Math.sin(t * 0.05 + i) * 10 * (1 - k);
      y = uy + 20 + (ground + 30 - uy - 20) * k;
      pose.eyes = "happy"; pose.mouth = "smile"; pose.armL = 2.9; pose.armR = 2.9; pose.tilt = Math.sin(t * 0.05 + i) * 0.12 * (1 - k);
      if (k < 1) {
        // Parachute.
        const top = y - h - 56, cr = 32;
        ctx.strokeStyle = "rgba(230,240,255,.8)"; ctx.lineWidth = 1;
        for (const s of [-1, 0, 1]) { ctx.beginPath(); ctx.moveTo(x + s * cr * 0.9, top + 4); ctx.lineTo(x + s * 4, y - h * 0.9); ctx.stroke(); }
        const cols = ["#ff6fd8", "#ffd23f", "#7fe3ee", "#5cffb0"];
        for (let p = 0; p < 4; p++) {
          ctx.fillStyle = cols[(p + i) % 4]; ctx.beginPath();
          ctx.moveTo(x, top - cr * 0.15); ctx.arc(x, top + 4, cr, Math.PI + (p / 4) * Math.PI, Math.PI + ((p + 1) / 4) * Math.PI); ctx.closePath(); ctx.fill();
        }
      } else {
        const jump = Math.max(0, Math.sin((t - 1000 - i * 6) * 0.12)) * 14;
        y -= jump; pose.eyes = "happy"; pose.mouth = "grin"; pose.armL = 2.7 + Math.sin(t * 0.2 + i) * 0.3; pose.armR = 2.7 - Math.sin(t * 0.2 + i) * 0.3;
        pose.squash = jump < 1 ? 0.3 : 0;
      }
    }
    pinChar(ctx, x, y, h, { ...pose, alpha });
  }
  // The saucer.
  ctx.save(); ctx.translate(ux, uy); ctx.scale(1.4, 1.4); ctx.rotate(t > 480 && t < 620 ? Math.sin(t * 0.25) * 0.12 : 0);
  const dome = ctx.createRadialGradient(-8, -18, 2, 0, -10, 26);
  dome.addColorStop(0, "rgba(255,255,255,.9)"); dome.addColorStop(1, "rgba(127,227,238,.35)");
  // Pilot peeking out of the dome: a round bowling ball with one eye and an antenna.
  const peek = seg(t, 480, 520) * (1 - seg(t, 600, 630));
  if (peek > 0) {
    ctx.fillStyle = "#6a4dff"; ctx.beginPath(); ctx.arc(0, -12 - peek * 8, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(0, -14 - peek * 8, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#1b1f2e"; ctx.beginPath(); ctx.arc(Math.sin(t * 0.1) * 1.5, -14 - peek * 8, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#c9b3ff"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -24 - peek * 8); ctx.lineTo(4, -34 - peek * 8); ctx.stroke();
    ctx.fillStyle = "#5cffb0"; ctx.beginPath(); ctx.arc(4, -35 - peek * 8, 2.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = dome; ctx.beginPath(); ctx.ellipse(0, -8, 24, 22, 0, Math.PI, Math.PI * 2); ctx.fill();
  const hull = ctx.createLinearGradient(0, -8, 0, 14);
  hull.addColorStop(0, "#e8eef8"); hull.addColorStop(0.5, "#8f9aab"); hull.addColorStop(1, "#3a4258");
  ctx.fillStyle = hull; ctx.beginPath(); ctx.ellipse(0, 2, 62, 14, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#1b2238"; ctx.lineWidth = 1.5; ctx.stroke();
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + t * 0.08, lx = Math.cos(a) * 50, ly = 4 + Math.sin(a) * 6;
    if (Math.sin(a) < -0.2) continue;
    ctx.fillStyle = (k + Math.floor(t / 8)) % 2 ? (t > 480 && t < 620 ? "#5cffb0" : "#ffd23f") : "#ff6fd8";
    ctx.beginPath(); ctx.arc(lx, ly, 3.2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ entry point */

/** Draws cartoon frame t (0 … CARTOON_TICKS) plus its title, sparks and lower third. */
export function drawCartoon(ctx: CanvasRenderingContext2D, s: BowlingStateV3, H: number, t: number) {
  const kind = s.lastResult?.kind;
  if (kind !== "strike" && kind !== "spare") return;
  const cartoon = cartoonFor(s), theme = THEME[cartoon], pal = PALETTE[theme];
  const label = kind === "strike" ? tx("bowling.strike") : tx("bowling.spare");
  const tt = Math.max(0, Math.min(CARTOON_TICKS - 1, t));
  ctx.save();
  if (cartoon === "launch") sceneLaunch(ctx, H, tt);
  else if (cartoon === "disco") sceneDisco(ctx, H, tt);
  else sceneUfo(ctx, H, tt, s.lastResult?.knocked ?? 2);
  // Title act.
  const titleAt = cartoon === "launch" ? 960 : cartoon === "disco" ? 880 : 860, u = tt - titleAt, cy = H * (cartoon === "disco" ? 0.36 : 0.3);
  if (u >= 0) {
    if (u < 10) { ctx.fillStyle = `rgba(255,255,255,${0.6 * (1 - u / 10)})`; ctx.fillRect(0, 0, 390, H); }
    sparks(ctx, u - 4, 195, cy, kind === "strike" ? 120 : 70, pal.spark, (s.lastResult?.frame ?? 0) + s.rolls.length, H);
    proTitle(ctx, label, u, cy, kind === "strike" ? 78 : 54, theme);
    lensFlare(ctx, u - 8, cy - 4, pal.beam);
    lowerThird(ctx, s, u - 40, H, theme, label);
  }
  if (cartoon === "disco") confetti(ctx, tt - 800, H, 90, s.rolls.length);
  if (cartoon === "launch") confetti(ctx, tt - 1000, H, 60, s.rolls.length);
  // Opening iris from the replay.
  if (tt < 18) { ctx.fillStyle = `rgba(255,255,255,${0.8 * (1 - tt / 18)})`; ctx.fillRect(0, 0, 390, H); }
  ctx.restore();
}
