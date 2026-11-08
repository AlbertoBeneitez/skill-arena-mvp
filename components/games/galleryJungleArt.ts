/**
 * Shot Gallery V13 art (presentation only, drawn by code once and cached): the night jungle of Xeno — an alien moon
 * seen through a canopy of giant ferns, buttressed trunks, lianas and bioluminescent fungi — and the three forms of
 * beings (hunter, horned brute, serpent) in the ornate obsidian-and-gold style of the player avatars, each lit from
 * inside by its aura (green, blue, red, purple).
 *
 * World units are the core's (390 wide); the painted world spans y −160…780 so tall phones (the scene is centred)
 * still see sky above and leaves below.
 */
import { GALLERY_V13, type GallerySpotV13 } from "@/lib/verified/shotGalleryCore.v13";

export const WORLD_Y0 = -160, WORLD_H = 940, WORLD_W = 390;
export type Aura = { core: string; glow: string; mid: string; deep: string };
/** Aura colours, in core order: green, blue, red, purple. */
export const AURAS: readonly Aura[] = [
  { core: "#f0fff2", glow: "#4dff86", mid: "#1fcf5a", deep: "#06451e" },
  { core: "#eef9ff", glow: "#45c2ff", mid: "#1d86e0", deep: "#06305e" },
  { core: "#fff1ee", glow: "#ff4256", mid: "#d91a34", deep: "#5a0610" },
  { core: "#f8efff", glow: "#be66ff", mid: "#8c34e6", deep: "#33085e" },
];
const GOLD = { hi: "#fff1bf", mid: "#e2b453", lo: "#8a5f17", dk: "#3e2706" };

/* ------------------------------------------------------------------ small utilities */
export function rgba(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
type G = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
function poly(g: G, pts: readonly (readonly [number, number])[], close = true) {
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  if (close) g.closePath();
}
function lin(g: G, x0: number, y0: number, x1: number, y1: number, stops: readonly (readonly [number, string])[]) {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  for (const [o, c] of stops) gr.addColorStop(o, c);
  return gr;
}
function rad(g: G, x: number, y: number, r0: number, r1: number, stops: readonly (readonly [number, string])[], cx = x, cy = y) {
  const gr = g.createRadialGradient(cx, cy, r0, x, y, r1);
  for (const [o, c] of stops) gr.addColorStop(o, c);
  return gr;
}
function glow(g: G, x: number, y: number, r: number, color: string, a = 1) {
  g.fillStyle = rad(g, x, y, 0, r, [[0, rgba(color, a)], [0.35, rgba(color, a * 0.45)], [1, rgba(color, 0)]]);
  g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
}

/* ------------------------------------------------------------------ the beings */
/** Dark obsidian armour plate with a lit upper edge. */
function plate(g: G, pts: readonly (readonly [number, number])[], top = -40, bottom = 40, edge = true) {
  g.fillStyle = lin(g, 0, top, 0, bottom, [[0, "#4a4033"], [0.35, "#231d16"], [1, "#0b0907"]]);
  poly(g, pts); g.fill();
  if (edge) { g.strokeStyle = "rgba(0,0,0,.65)"; g.lineWidth = 1.2; g.stroke(); }
}
/** Gold filigree stroke (dark base, bright top line). */
function gold(g: G, draw: () => void, w = 2) {
  g.lineCap = "round"; g.lineJoin = "round";
  g.strokeStyle = GOLD.dk; g.lineWidth = w + 1.4; g.beginPath(); draw(); g.stroke();
  g.strokeStyle = GOLD.mid; g.lineWidth = w; g.beginPath(); draw(); g.stroke();
  g.strokeStyle = rgba(GOLD.hi, 0.8); g.lineWidth = Math.max(0.6, w * 0.35); g.beginPath(); draw(); g.stroke();
}
function scroll(g: G, x: number, y: number, r: number, dir = 1) {
  gold(g, () => { for (let k = 0; k <= 18; k++) { const a = (k / 18) * TAU * 1.1 * dir, rr = r * (1 - k / 22); const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr; if (k) g.lineTo(px, py); else g.moveTo(px, py); } }, 1.1);
}
function eye(g: G, x: number, y: number, w: number, h: number, tilt: number, a: Aura) {
  glow(g, x, y, w * 2.4, a.glow, 0.7);
  g.save(); g.translate(x, y); g.rotate(tilt);
  g.fillStyle = a.core; g.beginPath(); g.ellipse(0, 0, w, h, 0, 0, TAU); g.fill();
  g.fillStyle = a.glow; g.beginPath(); g.ellipse(0, 0, w * 0.7, h * 0.6, 0, 0, TAU); g.fill();
  g.fillStyle = rgba("#000000", 0.55); g.beginPath(); g.ellipse(0, 0, w * 0.18, h * 0.7, 0, 0, TAU); g.fill();
  g.restore();
}
/** Aura gem set in gold. */
function gem(g: G, x: number, y: number, r: number, a: Aura) {
  glow(g, x, y, r * 3.2, a.glow, 0.8);
  g.fillStyle = lin(g, x, y - r * 1.4, x, y + r * 1.4, [[0, GOLD.hi], [0.5, GOLD.mid], [1, GOLD.lo]]);
  poly(g, [[x, y - r * 1.55], [x + r * 1.2, y], [x, y + r * 1.55], [x - r * 1.2, y]]); g.fill();
  g.fillStyle = rad(g, x, y, 0, r, [[0, a.core], [0.45, a.glow], [1, a.mid]], x - r * 0.3, y - r * 0.4);
  poly(g, [[x, y - r * 1.1], [x + r * 0.8, y], [x, y + r * 1.1], [x - r * 0.8, y]]); g.fill();
  g.fillStyle = "rgba(255,255,255,.85)"; g.beginPath(); g.arc(x - r * 0.25, y - r * 0.4, r * 0.22, 0, TAU); g.fill();
}
/** Glowing energy veins (the aura showing through cracks). */
function veins(g: G, lines: readonly (readonly (readonly [number, number])[])[], a: Aura, w = 1.6) {
  g.save(); g.lineCap = "round"; g.lineJoin = "round";
  g.shadowColor = a.glow; g.shadowBlur = 7;
  g.strokeStyle = a.glow; g.lineWidth = w;
  for (const l of lines) { poly(g, l, false); g.stroke(); }
  g.shadowBlur = 0; g.strokeStyle = rgba(a.core, 0.9); g.lineWidth = w * 0.4;
  for (const l of lines) { poly(g, l, false); g.stroke(); }
  g.restore();
}
/** Smooth tapered body part through `pts` (Catmull-Rom), width w0 → w1, shaded across with moonlight on the left. */
function taper(g: G, pts: readonly (readonly [number, number])[], w0: number, w1: number, base: string, light: string, dark = "#050403", rim: string | null = null) {
  const P = [pts[0], ...pts, pts[pts.length - 1]], out: [number, number, number][] = [];
  for (let i = 1; i < P.length - 2; i++) for (let k = 0; k < 8; k++) {
    const t = k / 8, t2 = t * t, t3 = t2 * t, [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]];
    const x = 0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
    const y = 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
    out.push([x, y, 0]);
  }
  out.push([pts[pts.length - 1][0], pts[pts.length - 1][1], 0]);
  const n = out.length, L: [number, number][] = [], Rr: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = out[Math.max(0, i - 1)], b = out[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
    const w = (w0 + (w1 - w0) * (i / (n - 1))) / 2, nx = -dy / len, ny = dx / len;
    L.push([out[i][0] + nx * w, out[i][1] + ny * w]); Rr.push([out[i][0] - nx * w, out[i][1] - ny * w]);
  }
  const shape = () => {
    g.beginPath(); L.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    const e = out[n - 1]; g.arc(e[0], e[1], w1 / 2, Math.atan2(L[n - 1][1] - e[1], L[n - 1][0] - e[0]), Math.atan2(Rr[n - 1][1] - e[1], Rr[n - 1][0] - e[0]));
    for (let i = n - 1; i >= 0; i--) g.lineTo(Rr[i][0], Rr[i][1]);
    const s0 = out[0]; g.arc(s0[0], s0[1], w0 / 2, Math.atan2(Rr[0][1] - s0[1], Rr[0][0] - s0[0]), Math.atan2(L[0][1] - s0[1], L[0][0] - s0[0]));
    g.closePath();
  };
  const xs = out.map((p) => p[0]), x0 = Math.min(...xs) - w0, x1 = Math.max(...xs) + w0;
  g.fillStyle = lin(g, x0, 0, x1, 0, [[0, light], [0.35, base], [1, dark]]); shape(); g.fill();
  g.strokeStyle = "rgba(0,0,0,.55)"; g.lineWidth = 0.9; shape(); g.stroke();
  if (rim) { g.strokeStyle = rim; g.lineWidth = 1; g.beginPath(); L.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); }
  return shape;
}
/** Reptilian skin texture (small scale arcs) clipped to the current path. */
function scales(g: G, x0: number, y0: number, x1: number, y1: number, step: number, color: string) {
  g.strokeStyle = color; g.lineWidth = 0.6;
  for (let y = y0, r = 0; y < y1; y += step * 0.7, r++) for (let x = x0 + (r % 2) * step * 0.5; x < x1; x += step) { g.beginPath(); g.arc(x, y, step * 0.45, 0.1 * Math.PI, 0.9 * Math.PI); g.stroke(); }
}
const SKIN = { base: "#2b2a1f", light: "#5d5a44", dark: "#0b0a06" };

/** Hunter: crested bio-mask with angled lenses over four exposed mandibles, gold-ringed dreadlocks falling over the
 * shoulders, a mesh-netted muscular torso with an aura gem, a shoulder cannon with three aura dots and wrist blades. */
function hunter(g: G, a: Aura) {
  // dreadlocks behind the shoulders
  for (const [sx, dx] of [[-1, -22], [-1, -15], [1, 15], [1, 22]] as const)
    taper(g, [[dx * 0.8, -74], [dx * 1.2, -56], [dx * 1.3 + sx * 6, -30], [dx * 1.3 + sx * 9, -2]], 6, 4, "#2a2216", "#5a4a30", "#070503");
  // arms behind the torso: left hangs with claws, right is raised with the wrist blades
  taper(g, [[-34, -18], [-48, 6], [-50, 30]], 16, 11, SKIN.base, SKIN.light, SKIN.dark);
  taper(g, [[-50, 28], [-52, 44]], 11, 9, "#2a241a", "#6a5a3c", "#0a0805");
  g.fillStyle = lin(g, 0, 44, 0, 60, [[0, "#e8dcc0"], [1, "#2a2014"]]);
  for (const x of [-57, -52, -47]) { poly(g, [[x - 2, 46], [x + 2, 46], [x - 1, 60]]); g.fill(); }
  taper(g, [[34, -18], [52, -6], [54, -28]], 16, 12, SKIN.base, SKIN.light, SKIN.dark);
  plate(g, [[46, -40], [62, -40], [62, -20], [46, -18]], -40, -18);
  gold(g, () => { g.moveTo(46, -34); g.lineTo(62, -34); }, 1.1); gold(g, () => { g.moveTo(46, -26); g.lineTo(62, -26); }, 0.9);
  g.fillStyle = lin(g, 50, -86, 62, -40, [[0, "#ffffff"], [0.4, "#b8c4d2"], [1, "#3b4452"]]);
  for (const o of [0, 6]) { poly(g, [[49 + o, -40], [52 + o, -84], [55 + o, -82], [55 + o, -40]]); g.fill(); }
  // torso: broad, muscular, netted
  const torso = () => { g.beginPath(); g.moveTo(-14, -34); g.lineTo(-40, -24); g.bezierCurveTo(-48, -14, -42, 8, -30, 24); g.bezierCurveTo(-24, 36, -22, 52, -20, 66); g.lineTo(20, 66); g.bezierCurveTo(22, 52, 24, 36, 30, 24); g.bezierCurveTo(42, 8, 48, -14, 40, -24); g.lineTo(14, -34); g.closePath(); };
  g.fillStyle = lin(g, -40, 0, 40, 0, [[0, SKIN.light], [0.3, SKIN.base], [1, SKIN.dark]]); torso(); g.fill();
  g.save(); torso(); g.clip();
  scales(g, -46, -24, 46, 66, 5, "rgba(0,0,0,.35)");
  // pecs and abs
  g.fillStyle = "rgba(255,240,200,.08)";
  for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(sx * 15, -6, 15, 10, sx * 0.2, 0, TAU); g.fill(); }
  g.strokeStyle = "rgba(0,0,0,.45)"; g.lineWidth = 1.2;
  for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(sx * 15, -6, 15, 10, sx * 0.2, 0.15 * Math.PI, 0.95 * Math.PI); g.stroke(); }
  for (let r = 0; r < 3; r++) for (const sx of [-1, 1]) { g.beginPath(); g.roundRect(sx > 0 ? 2 : -12, 12 + r * 12, 10, 10, 4); g.stroke(); }
  // mesh net
  g.strokeStyle = "rgba(10,8,4,.75)"; g.lineWidth = 0.8;
  for (let k = -90; k < 90; k += 8) { g.beginPath(); g.moveTo(k, -26); g.lineTo(k + 90, 68); g.stroke(); g.beginPath(); g.moveTo(k, -26); g.lineTo(k - 90, 68); g.stroke(); }
  g.restore();
  g.strokeStyle = "rgba(0,0,0,.7)"; g.lineWidth = 1; torso(); g.stroke();
  // chest sash and aura gem
  gold(g, () => { g.moveTo(-34, -16); g.quadraticCurveTo(-6, 6, 18, 40); }, 2.4);
  gem(g, -6, 4, 5.5, a);
  scroll(g, 6, 18, 4, 1);
  veins(g, [[[-6, 12], [-10, 24], [-6, 36], [-9, 50]], [[0, 0], [12, -8], [22, -2]], [[-14, 0], [-26, -2]]], a, 1.3);
  // rounded pauldrons, the left one carrying a small cannon with the three aura dots
  for (const sx of [-1, 1]) {
    g.save(); g.translate(sx * 38, -24); g.scale(sx, 1);
    const pd = () => { g.beginPath(); g.moveTo(-12, 6); g.bezierCurveTo(-14, -8, -2, -16, 10, -14); g.bezierCurveTo(20, -12, 24, -2, 20, 10); g.bezierCurveTo(12, 14, -4, 14, -12, 6); g.closePath(); };
    g.fillStyle = lin(g, 0, -16, 0, 14, [[0, "#5a4c38"], [0.45, "#241d15"], [1, "#0a0806"]]); pd(); g.fill();
    g.strokeStyle = "rgba(0,0,0,.7)"; g.lineWidth = 1; pd(); g.stroke();
    gold(g, () => { g.moveTo(-12, 6); g.bezierCurveTo(-14, -8, -2, -16, 10, -14); g.bezierCurveTo(20, -12, 24, -2, 20, 10); }, 1.3);
    scroll(g, 5, -2, 4, 1);
    g.restore();
  }
  g.save(); g.translate(-40, -40);
  plate(g, [[-12, -4], [8, -6], [10, 4], [-10, 6]], -6, 6);
  gold(g, () => { g.moveTo(-12, -4); g.lineTo(8, -6); }, 1);
  plate(g, [[-20, -3], [-12, -4], [-10, 5], [-18, 4]], -4, 5, false);
  for (const [x, y] of [[-23, 0], [-21, -4], [-21, 4]]) glow(g, x, y, 3, a.glow, 1);
  g.restore();
  // mandibles and the glowing throat
  glow(g, 0, -30, 12, a.glow, 0.9);
  for (const sx of [-1, 1]) for (const k of [0, 1]) {
    const bx = sx * (5 + k * 7), by = -38 + k * 4;
    g.fillStyle = lin(g, bx, by, bx + sx * 10, by + 16, [[0, "#f3e8cf"], [0.6, "#a8916a"], [1, "#1c140a"]]);
    g.beginPath(); g.moveTo(bx - sx * 2, by); g.quadraticCurveTo(bx + sx * 12, by + 2, bx + sx * 9, by + 18); g.quadraticCurveTo(bx + sx * 4, by + 10, bx, by + 6); g.closePath(); g.fill();
  }
  // bio-mask
  const mask = () => { g.beginPath(); g.moveTo(0, -88); g.bezierCurveTo(14, -88, 24, -76, 24, -62); g.bezierCurveTo(24, -50, 20, -44, 14, -40); g.lineTo(6, -36); g.lineTo(-6, -36); g.lineTo(-14, -40); g.bezierCurveTo(-20, -44, -24, -50, -24, -62); g.bezierCurveTo(-24, -76, -14, -88, 0, -88); g.closePath(); };
  g.fillStyle = lin(g, -24, -88, 24, -36, [[0, "#6a5c44"], [0.35, "#2a2419"], [1, "#0a0805"]]); mask(); g.fill();
  g.strokeStyle = "rgba(0,0,0,.75)"; g.lineWidth = 1.1; mask(); g.stroke();
  gold(g, () => { g.moveTo(0, -90); g.lineTo(0, -62); }, 1.8);
  gold(g, () => { g.moveTo(-22, -70); g.quadraticCurveTo(-12, -80, 0, -82); g.quadraticCurveTo(12, -80, 22, -70); }, 1.2);
  gold(g, () => { g.moveTo(-14, -40); g.lineTo(-6, -36); g.lineTo(6, -36); g.lineTo(14, -40); }, 1.1);
  scroll(g, -14, -72, 3.4, -1); scroll(g, 14, -72, 3.4, 1);
  // angled lenses
  for (const sx of [-1, 1]) {
    g.save(); g.translate(sx * 10, -56); g.rotate(sx * -0.35);
    glow(g, 0, 0, 14, a.glow, 0.6);
    g.fillStyle = lin(g, 0, -4, 0, 4, [[0, a.core], [0.5, a.glow], [1, a.mid]]);
    poly(g, [[-7, -2.6], [7, -3.4], [6, 2.6], [-6, 2.2]]); g.fill();
    g.restore();
  }
  veins(g, [[[-18, -50], [-12, -46], [-6, -46]], [[18, -50], [12, -46], [6, -46]]], a, 0.9);
  for (const x of [-5, -2, 1, 4]) { g.fillStyle = "rgba(0,0,0,.75)"; g.fillRect(x, -43, 1.3, 4.5); }
  // dreadlocks in front, over the shoulders, with gold rings
  for (const [sx, dx] of [[-1, -20], [-1, -25], [1, 20], [1, 25]] as const) {
    taper(g, [[sx * 20, -70], [dx * 1.05, -56], [dx * 1.15 + sx * 3, -36], [dx * 1.2 + sx * 5, -16]], 5.5, 3.6, "#2c2418", "#6b5838", "#080604");
    for (const t of [0.35, 0.7]) {
      const x = sx * 20 + (dx * 1.2 + sx * 5 - sx * 20) * t, y = -70 + 54 * t;
      g.fillStyle = lin(g, x - 3, y, x + 3, y, [[0, GOLD.lo], [0.5, GOLD.hi], [1, GOLD.lo]]); g.beginPath(); g.ellipse(x, y, 3.4, 1.6, sx * 0.3, 0, TAU); g.fill();
    }
  }
}

/** Horned brute: ram horns ringed in gold, an armoured brow plate over burning eyes, a snarling maw with tusks,
 * hunched spiked shoulders, a cracked chest leaking aura and spiked gauntlets. */
function horned(g: G, a: Aura) {
  // horns sweep back and up from the temples, then curl outward
  for (const sx of [-1, 1]) {
    g.save(); g.scale(sx, 1);
    const shape = taper(g, [[14, -70], [32, -82], [50, -84], [62, -96], [58, -110]], 16, 4, "#7a6447", "#d9c49a", "#2a1e12");
    g.save(); shape(); g.clip();
    g.strokeStyle = "rgba(40,26,10,.55)"; g.lineWidth = 1.1;
    for (let k = 0; k < 12; k++) { const x = 16 + k * 4.2, y = -72 - k * 2.6 - (k > 7 ? (k - 7) * 3 : 0); g.beginPath(); g.moveTo(x - 4, y - 7); g.quadraticCurveTo(x, y, x - 2, y + 7); g.stroke(); }
    g.restore();
    for (const [x, y, r] of [[30, -81, -0.2], [48, -85, -0.4]] as const) {
      g.save(); g.translate(x, y); g.rotate(r);
      g.fillStyle = lin(g, 0, -6, 0, 6, [[0, GOLD.hi], [0.5, GOLD.mid], [1, GOLD.dk]]); g.beginPath(); g.roundRect(-3, -7, 6, 14, 2); g.fill();
      g.restore();
    }
    g.restore();
  }
  // arms with spiked gauntlets
  for (const sx of [-1, 1]) {
    g.save(); g.scale(sx, 1);
    taper(g, [[38, -14], [56, 4], [58, 26]], 20, 15, "#3a2a1c", "#7a5e40", "#0a0604");
    plate(g, [[48, 16], [70, 14], [72, 36], [50, 40]], 14, 40);
    gold(g, () => { g.moveTo(48, 20); g.lineTo(70, 18); }, 1.3);
    g.fillStyle = lin(g, 0, 2, 0, 16, [[0, "#f6ecd2"], [1, "#4a3a24"]]);
    for (const x of [52, 60, 68]) { poly(g, [[x - 2.5, 16], [x + 1, 2], [x + 2.5, 16]]); g.fill(); }
    g.fillStyle = lin(g, 0, 36, 0, 52, [[0, "#f0e4cc"], [1, "#3a2c1a"]]);
    for (const x of [52, 58, 64, 70]) { poly(g, [[x, 38], [x + 4, 38], [x + 1, 52]]); g.fill(); }
    veins(g, [[[52, 26], [60, 32], [68, 28]]], a, 1);
    g.restore();
  }
  // hunched torso with heavy pecs
  const torso = () => { g.beginPath(); g.moveTo(-44, -22); g.bezierCurveTo(-56, -4, -46, 26, -30, 40); g.lineTo(-24, 66); g.lineTo(24, 66); g.lineTo(30, 40); g.bezierCurveTo(46, 26, 56, -4, 44, -22); g.closePath(); };
  g.fillStyle = lin(g, -50, 0, 50, 0, [[0, "#6b4f36"], [0.3, "#3a2a1c"], [1, "#0b0705"]]); torso(); g.fill();
  g.save(); torso(); g.clip();
  scales(g, -56, -24, 56, 66, 6, "rgba(0,0,0,.3)");
  plate(g, [[-30, -18], [30, -18], [26, 16], [0, 30], [-26, 16]], -18, 30);
  g.restore();
  gold(g, () => { g.moveTo(-30, -18); g.lineTo(-26, 16); g.lineTo(0, 30); g.lineTo(26, 16); g.lineTo(30, -18); }, 1.6);
  scroll(g, -16, -4, 4.5, -1); scroll(g, 16, -4, 4.5, 1);
  veins(g, [[[0, -14], [-4, -4], [3, 4], [-2, 14], [2, 26]], [[-4, -4], [-14, 0], [-20, 8]], [[3, 4], [14, 2], [20, 10]], [[-2, 14], [-10, 20]], [[0, 34], [-6, 46], [-2, 60]], [[10, 38], [14, 52]]], a, 1.8);
  glow(g, 0, 6, 18, a.glow, 0.4);
  // spiked pauldrons
  for (const sx of [-1, 1]) {
    g.save(); g.translate(sx * 42, -22); g.scale(sx, 1);
    plate(g, [[-16, 4], [-8, -12], [12, -16], [26, -2], [20, 12], [-6, 14]], -16, 14);
    gold(g, () => { g.moveTo(-16, 4); g.lineTo(-8, -12); g.lineTo(12, -16); g.lineTo(26, -2); }, 1.5);
    g.fillStyle = lin(g, 0, -36, 0, -10, [[0, "#f6ecd2"], [1, "#4a3a24"]]);
    for (const [x, h] of [[-3, 15], [7, 22], [17, 15]]) { poly(g, [[x - 3.4, -12], [x + 1, -12 - h], [x + 4, -12]]); g.fill(); }
    scroll(g, 5, -2, 4.5, 1);
    g.restore();
  }
  // head: a brutish skull, wide jaw
  const head = () => { g.beginPath(); g.moveTo(-18, -74); g.bezierCurveTo(-6, -80, 6, -80, 18, -74); g.bezierCurveTo(28, -66, 30, -50, 26, -38); g.bezierCurveTo(22, -26, 12, -20, 0, -19); g.bezierCurveTo(-12, -20, -22, -26, -26, -38); g.bezierCurveTo(-30, -50, -28, -66, -18, -74); g.closePath(); };
  g.fillStyle = lin(g, -28, -78, 28, -20, [[0, "#7a5a3e"], [0.35, "#3e2c1d"], [1, "#0c0805"]]); head(); g.fill();
  g.save(); head(); g.clip(); scales(g, -30, -80, 30, -18, 4, "rgba(0,0,0,.3)"); g.restore();
  g.strokeStyle = "rgba(0,0,0,.7)"; g.lineWidth = 1.1; head(); g.stroke();
  // armoured brow plate with crest gem
  g.fillStyle = lin(g, 0, -78, 0, -54, [[0, "#6a5a44"], [1, "#16110c"]]);
  poly(g, [[-26, -58], [-16, -74], [0, -80], [16, -74], [26, -58], [16, -52], [0, -56], [-16, -52]]); g.fill();
  gold(g, () => { g.moveTo(-26, -58); g.lineTo(-16, -74); g.lineTo(0, -80); g.lineTo(16, -74); g.lineTo(26, -58); }, 1.5);
  gold(g, () => { g.moveTo(-16, -52); g.lineTo(0, -56); g.lineTo(16, -52); }, 1.1);
  gem(g, 0, -68, 4, a);
  eye(g, -11, -48, 5, 2.3, 0.25, a); eye(g, 11, -48, 5, 2.3, -0.25, a);
  // snout ridges and maw
  g.strokeStyle = "rgba(0,0,0,.5)"; g.lineWidth = 1; for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(sx * 4, -44); g.quadraticCurveTo(sx * 6, -38, sx * 3, -34); g.stroke(); }
  g.fillStyle = "#050302"; g.beginPath(); g.moveTo(-15, -33); g.quadraticCurveTo(0, -30, 15, -33); g.lineTo(11, -23); g.quadraticCurveTo(0, -20, -11, -23); g.closePath(); g.fill();
  glow(g, 0, -28, 13, a.glow, 0.9);
  g.fillStyle = "#f4e8ce";
  for (const x of [-10, -5, 0, 5, 10]) { poly(g, [[x - 2, -33], [x + 2, -33], [x, -28.5]]); g.fill(); }
  for (const x of [-7, 0, 7]) { poly(g, [[x - 2, -22.5], [x + 2, -22.5], [x, -26.5]]); g.fill(); }
  g.fillStyle = lin(g, 0, -46, 0, -22, [[0, "#fff6e0"], [1, "#8a7552"]]);
  for (const sx of [-1, 1]) { poly(g, [[sx * 14, -23], [sx * 19, -25], [sx * 22, -46], [sx * 17, -32]]); g.fill(); }
}

/** Serpent: a cobra hood with radiating ribs, a gold "spectacle" mark and two aura eye-spots, a crowned head with
 * slit eyes and fangs, and a smooth scaled coil rising from below. */
function serpent(g: G, a: Aura) {
  // coil first (the hood sits on it)
  const coil = taper(g, [[-16, 66], [14, 52], [16, 34], [-6, 20], [-8, 4], [0, -10]], 26, 16, "#2e2a1e", "#6a6046", "#060504");
  g.save(); coil(); g.clip();
  g.fillStyle = "rgba(226,190,120,.22)";
  for (let k = 0; k < 9; k++) { const y = 62 - k * 8.5, x = [-12, 6, 14, 10, -2, -7, -6, -3, 0][k]; g.beginPath(); g.ellipse(x, y, 9, 3, 0.15, 0, TAU); g.fill(); }
  scales(g, -40, -14, 40, 70, 4.5, "rgba(0,0,0,.35)");
  g.restore();
  veins(g, [[[6, 46], [10, 36], [4, 26]], [[-6, 16], [-2, 4]]], a, 1.2);
  // hood: wide in the middle, narrowing to the neck
  const hood = () => { g.beginPath(); g.moveTo(0, -74); g.bezierCurveTo(16, -76, 34, -70, 46, -56); g.bezierCurveTo(60, -40, 56, -20, 40, -8); g.bezierCurveTo(28, 0, 16, 2, 10, 12); g.lineTo(-10, 12); g.bezierCurveTo(-16, 2, -28, 0, -40, -8); g.bezierCurveTo(-56, -20, -60, -40, -46, -56); g.bezierCurveTo(-34, -70, -16, -76, 0, -74); g.closePath(); };
  g.fillStyle = lin(g, -50, -90, 50, 10, [[0, "#5a5038"], [0.35, "#262016"], [1, "#070504"]]); hood(); g.fill();
  g.save(); hood(); g.clip();
  g.fillStyle = rad(g, 0, -40, 4, 52, [[0, rgba(a.glow, 0.5)], [0.55, rgba(a.mid, 0.2)], [1, rgba(a.deep, 0)]]); g.fillRect(-60, -96, 120, 112);
  scales(g, -56, -94, 56, 14, 5.5, "rgba(0,0,0,.4)");
  g.strokeStyle = "rgba(0,0,0,.5)"; g.lineWidth = 1.6;
  for (let k = 0; k < 7; k++) { const ang = Math.PI * (0.62 + k * 0.29); g.beginPath(); g.moveTo(0, -30); g.quadraticCurveTo(Math.cos(ang) * 30, -30 + Math.sin(ang) * 30, Math.cos(ang) * 62, -30 + Math.sin(ang) * 62); g.stroke(); }
  g.restore();
  g.strokeStyle = "rgba(0,0,0,.75)"; g.lineWidth = 1.2; hood(); g.stroke();
  gold(g, () => { g.moveTo(-40, -8); g.bezierCurveTo(-56, -20, -60, -40, -46, -56); g.bezierCurveTo(-34, -70, -16, -76, 0, -74); g.bezierCurveTo(16, -76, 34, -70, 46, -56); g.bezierCurveTo(60, -40, 56, -20, 40, -8); }, 1.3);
  // spectacle mark and eye-spots
  gold(g, () => { g.moveTo(-48, -42); g.bezierCurveTo(-38, -58, -18, -58, -8, -46); }, 1.5);
  gold(g, () => { g.moveTo(48, -42); g.bezierCurveTo(38, -58, 18, -58, 8, -46); }, 1.5);
  gold(g, () => { g.moveTo(-38, -16); g.bezierCurveTo(-22, -6, 22, -6, 38, -16); }, 1.2);
  scroll(g, -20, -24, 4.5, -1); scroll(g, 20, -24, 4.5, 1);
  for (const sx of [-1, 1]) {
    const x = sx * 32, y = -36;
    g.fillStyle = lin(g, x, y - 10, x, y + 10, [[0, GOLD.hi], [1, GOLD.lo]]); g.beginPath(); g.ellipse(x, y, 8.5, 11, sx * 0.25, 0, TAU); g.fill();
    glow(g, x, y, 20, a.glow, 0.85);
    g.fillStyle = rad(g, x, y, 0, 8, [[0, a.core], [0.45, a.glow], [1, a.mid]]); g.beginPath(); g.ellipse(x, y, 6, 8.5, sx * 0.25, 0, TAU); g.fill();
    g.fillStyle = "rgba(0,0,0,.6)"; g.beginPath(); g.ellipse(x, y, 1.5, 6, sx * 0.25, 0, TAU); g.fill();
  }
  // head
  g.save(); g.translate(0, -8);
  const head = () => { g.beginPath(); g.moveTo(-12, -76); g.bezierCurveTo(-4, -80, 4, -80, 12, -76); g.bezierCurveTo(20, -70, 20, -56, 15, -46); g.bezierCurveTo(10, -36, 5, -30, 0, -28); g.bezierCurveTo(-5, -30, -10, -36, -15, -46); g.bezierCurveTo(-20, -56, -20, -70, -12, -76); g.closePath(); };
  g.fillStyle = lin(g, -20, -80, 20, -28, [[0, "#7a6c50"], [0.4, "#2f281c"], [1, "#0b0907"]]); head(); g.fill();
  g.save(); head(); g.clip(); scales(g, -22, -82, 22, -26, 3.6, "rgba(0,0,0,.35)"); g.restore();
  g.strokeStyle = "rgba(0,0,0,.75)"; g.lineWidth = 1; head(); g.stroke();
  gold(g, () => { g.moveTo(-14, -58); g.bezierCurveTo(-6, -64, 6, -64, 14, -58); }, 1.1);
  g.fillStyle = lin(g, 0, -100, 0, -76, [[0, GOLD.hi], [1, GOLD.lo]]);
  for (const [x, h] of [[-10, 10], [-5, 16], [0, 22], [5, 16], [10, 10]]) { poly(g, [[x - 2.6, -76], [x, -76 - h], [x + 2.6, -76]]); g.fill(); }
  gem(g, 0, -79, 2.8, a);
  eye(g, -9, -56, 4.4, 1.8, 0.4, a); eye(g, 9, -56, 4.4, 1.8, -0.4, a);
  for (const sx of [-1, 1]) { g.fillStyle = "rgba(0,0,0,.8)"; g.beginPath(); g.ellipse(sx * 3, -40, 1, 0.7, 0, 0, TAU); g.fill(); }
  g.fillStyle = "#050302"; g.beginPath(); g.moveTo(-8, -36); g.quadraticCurveTo(0, -31, 8, -36); g.quadraticCurveTo(0, -28, -8, -36); g.fill();
  g.fillStyle = "#f4ead6";
  for (const sx of [-1, 1]) { poly(g, [[sx * 4.5, -35], [sx * 7, -35.5], [sx * 5, -26]]); g.fill(); }
  g.strokeStyle = "#ff5a7a"; g.lineWidth = 1.4; g.lineCap = "round";
  g.beginPath(); g.moveTo(0, -31); g.lineTo(0, -22); g.lineTo(-3, -18); g.moveTo(0, -22); g.lineTo(3, -18); g.stroke();
  g.restore();
}

/** Sprite box (world units at scale 1): the being is drawn centred on (ORX, ORY). */
export const BOX_W = 150, BOX_H = 176, ORX = 75, ORY = 112;
const FORMS = [hunter, horned, serpent];
/** Draws one being (form 0..2, aura 0..3) on (0,0), body roughly x −65…65, y −110…62. */
export function drawBeing(g: G, form: number, aura: number) {
  const a = AURAS[aura] ?? AURAS[0];
  g.save();
  FORMS[form % FORMS.length](g, a);
  g.restore();
}
/** Silhouette icon of a form (for the order panel), neutral gold-on-dark. */
export function drawFormIcon(g: G, form: number) {
  const neutral: Aura = { core: "#fff6dc", glow: "#ffd98a", mid: "#c9a04a", deep: "#3e2706" };
  FORMS[form % FORMS.length](g, neutral);
}

/* ------------------------------------------------------------------ the jungle */
type Layer = 0 | 1 | 2 | 3;
/** An alien fern frond: curved rib with paired leaflets; `lit` adds a bioluminescent edge. */
function frond(g: G, x: number, y: number, len: number, ang: number, bend: number, w: number, dark: string, light: string, lit: string | null, r: () => number) {
  const n = 16, pts: [number, number, number][] = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n, a = ang + bend * t * t;
    const px = x + Math.cos(ang) * len * t + Math.cos(a + Math.PI / 2) * bend * len * 0.15 * t * t;
    const py = y + Math.sin(ang) * len * t + Math.sin(a + Math.PI / 2) * bend * len * 0.15 * t * t;
    pts.push([px, py, a]);
  }
  for (let k = 1; k < n; k++) {
    const [px, py, a] = pts[k], t = k / n, ll = w * (1 - t * 0.75) * (0.8 + r() * 0.4);
    for (const side of [-1, 1]) {
      const la = a + side * (0.95 + r() * 0.25), ex = px + Math.cos(la) * ll, ey = py + Math.sin(la) * ll;
      g.fillStyle = lin(g, px, py, ex, ey, [[0, dark], [1, light]]);
      g.beginPath(); g.moveTo(px, py);
      g.quadraticCurveTo(px + Math.cos(la - side * 0.5) * ll * 0.6, py + Math.sin(la - side * 0.5) * ll * 0.6, ex, ey);
      g.quadraticCurveTo(px + Math.cos(la + side * 0.35) * ll * 0.55, py + Math.sin(la + side * 0.35) * ll * 0.55, pts[k + 1][0], pts[k + 1][1]);
      g.closePath(); g.fill();
      if (lit && r() < 0.35) { g.strokeStyle = rgba(lit, 0.55); g.lineWidth = 0.7; g.beginPath(); g.moveTo(px, py); g.lineTo(ex, ey); g.stroke(); }
    }
  }
  g.strokeStyle = dark; g.lineWidth = Math.max(1, w * 0.12);
  g.beginPath(); pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py))); g.stroke();
}
/** A broad alien leaf with glowing veins. */
function leaf(g: G, x: number, y: number, len: number, ang: number, w: number, dark: string, light: string, vein: string, r: () => number) {
  g.save(); g.translate(x, y); g.rotate(ang);
  const shape = () => { g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(len * 0.25, -w, len * 0.75, -w * 0.8, len, 0); g.bezierCurveTo(len * 0.75, w * 0.8, len * 0.25, w, 0, 0); g.closePath(); };
  g.fillStyle = lin(g, 0, -w, len * 0.3, w, [[0, light], [0.6, dark], [1, "#020806"]]); shape(); g.fill();
  g.save(); shape(); g.clip();
  g.strokeStyle = rgba(vein, 0.55); g.lineWidth = 1.2;
  g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(len * 0.5, -w * 0.08, len, 0); g.stroke();
  g.lineWidth = 0.7;
  for (let k = 1; k < 9; k++) {
    const t = k / 9, px = len * t;
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(px, 0); g.quadraticCurveTo(px + len * 0.06, s * w * 0.4, px + len * 0.1, s * w * (0.8 - t * 0.5)); g.stroke(); }
  }
  // moonlight sheen and a few dew beads
  g.fillStyle = lin(g, 0, -w, 0, 0, [[0, "rgba(170,240,220,.14)"], [1, "rgba(170,240,220,0)"]]); g.fillRect(0, -w, len, w);
  for (let k = 0; k < 3; k++) { const px = len * (0.3 + r() * 0.5), py = (r() - 0.5) * w; g.fillStyle = "rgba(220,255,245,.55)"; g.beginPath(); g.arc(px, py, 0.9 + r(), 0, TAU); g.fill(); }
  g.restore();
  g.restore();
}
function trunkPath(g: G, x0: number, x1: number, top: number, bottom: number, flare: number, sway: number) {
  g.beginPath();
  g.moveTo(x0 + sway, top);
  g.bezierCurveTo(x0 - sway * 0.4, top + (bottom - top) * 0.4, x0 + sway * 0.3, bottom - 60, x0 - flare, bottom);
  g.lineTo(x1 + flare, bottom);
  g.bezierCurveTo(x1 + sway * 0.3, bottom - 60, x1 - sway * 0.4, top + (bottom - top) * 0.4, x1 + sway, top);
  g.closePath();
}
/** A buttressed trunk: bark gradient, vertical fissures, moss, a glowing fungus shelf or two. */
function trunk(g: G, x0: number, x1: number, top: number, bottom: number, flare: number, sway: number, tone: number, r: () => number, fungus = true) {
  const w = x1 - x0;
  const base = ["#0a1713", "#10211b", "#172c24", "#1e382d"][tone], hi = ["#1c342b", "#284a3c", "#36604d", "#447a62"][tone];
  g.fillStyle = lin(g, x0, 0, x1, 0, [[0, "#020605"], [0.3, base], [0.62, hi], [1, "#030806"]]);
  trunkPath(g, x0, x1, top, bottom, flare, sway); g.fill();
  g.save(); trunkPath(g, x0, x1, top, bottom, flare, sway); g.clip();
  g.strokeStyle = "rgba(0,0,0,.45)"; g.lineWidth = 1.2;
  for (let k = 0; k < Math.max(4, w / 5); k++) {
    const x = x0 + r() * w;
    g.beginPath(); g.moveTo(x, top); for (let y = top; y < bottom; y += 24) g.lineTo(x + (r() - 0.5) * 4 + (y - top) * 0.01 * sway / 30, y); g.stroke();
  }
  // moss patches lit by the moon on the left
  for (let k = 0; k < 10; k++) {
    const y = top + r() * (bottom - top), x = x0 + r() * w * 0.5;
    g.fillStyle = `rgba(${60 + r() * 40},${120 + r() * 60},${70 + r() * 30},.25)`;
    g.beginPath(); g.ellipse(x, y, 4 + r() * 8, 2 + r() * 4, 0, 0, TAU); g.fill();
  }
  g.restore();
  if (fungus) for (let k = 0; k < 2; k++) {
    const y = top + (bottom - top) * (0.35 + r() * 0.4), side = r() < 0.5 ? x0 : x1, dir = side === x0 ? -1 : 1;
    for (let m = 0; m < 3; m++) {
      const fx = side + dir * (2 + m * 3), fy = y + m * 7, fw = 8 + r() * 6;
      glow(g, fx + dir * fw * 0.5, fy, fw * 1.6, "#5cf0d8", 0.25);
      g.fillStyle = lin(g, 0, fy - 3, 0, fy + 3, [[0, "#c8fff2"], [1, "#2a8a78"]]);
      g.beginPath(); g.ellipse(fx + dir * fw * 0.5, fy, fw * 0.6, 2.6, 0, Math.PI, 0); g.fill();
    }
  }
}
function liana(g: G, x: number, y0: number, y1: number, sway: number, color: string, r: () => number) {
  g.strokeStyle = color; g.lineWidth = 1.6 + r() * 1.4; g.lineCap = "round";
  g.beginPath(); g.moveTo(x, y0);
  g.bezierCurveTo(x + sway, y0 + (y1 - y0) * 0.35, x - sway, y0 + (y1 - y0) * 0.7, x + sway * 0.3, y1); g.stroke();
  for (let k = 0; k < 5; k++) {
    const t = 0.2 + k * 0.16, px = x + Math.sin(t * 6) * sway * 0.4, py = y0 + (y1 - y0) * t;
    g.fillStyle = color; g.beginPath(); g.ellipse(px + 3, py, 4, 1.6, 0.6, 0, TAU); g.fill();
  }
  if (r() < 0.6) { glow(g, x + sway * 0.3, y1 + 2, 7, "#a6ff5a", 0.55); g.fillStyle = "#e8ffd0"; g.beginPath(); g.arc(x + sway * 0.3, y1 + 2, 1.6, 0, TAU); g.fill(); }
}
function rock(g: G, x: number, y: number, w: number, h: number, r: () => number) {
  const pts: [number, number][] = [];
  for (let k = 0; k <= 10; k++) { const a = Math.PI + (k / 10) * Math.PI; pts.push([x + Math.cos(a) * w * (0.85 + r() * 0.2), y + Math.sin(a) * h * (0.8 + r() * 0.3)]); }
  pts.push([x + w, y + h * 0.4], [x - w, y + h * 0.4]);
  g.fillStyle = lin(g, x - w, y - h, x + w * 0.4, y + h * 0.4, [[0, "#3a5a52"], [0.4, "#16261f"], [1, "#050a08"]]);
  poly(g, pts); g.fill();
  g.fillStyle = "rgba(90,160,110,.22)";
  for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(x - w * 0.5 + r() * w, y - h * (0.4 + r() * 0.5), 5 + r() * 5, 2, 0, 0, TAU); g.fill(); }
}
function glowBugs(g: G, n: number, x0: number, x1: number, y0: number, y1: number, r: () => number) {
  for (let k = 0; k < n; k++) {
    const x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0), c = r() < 0.6 ? "#5cf0d8" : r() < 0.7 ? "#a6ff5a" : "#ff8ae0";
    glow(g, x, y, 2.5 + r() * 3, c, 0.45); g.fillStyle = "#f4fffb"; g.beginPath(); g.arc(x, y, 0.6, 0, TAU); g.fill();
  }
}
function mushrooms(g: G, x: number, y: number, n: number, r: () => number) {
  for (let k = 0; k < n; k++) {
    const mx = x + (r() - 0.5) * 26, h = 5 + r() * 9, w = 3 + r() * 5;
    g.strokeStyle = "#cfeee0"; g.lineWidth = 1.2; g.beginPath(); g.moveTo(mx, y); g.lineTo(mx + (r() - 0.5) * 2, y - h); g.stroke();
    glow(g, mx, y - h, w * 2.2, "#5cf0d8", 0.35);
    g.fillStyle = lin(g, 0, y - h - w * 0.6, 0, y - h, [[0, "#d8fff6"], [1, "#2ab79c"]]);
    g.beginPath(); g.ellipse(mx, y - h, w, w * 0.55, 0, Math.PI, 0); g.fill();
  }
}
/** Ground strip (a mossy bank seen from the gun line) with roots. */
function bank(g: G, y: number, amp: number, tone: string, rim: string, r: () => number) {
  g.beginPath(); g.moveTo(-10, WORLD_Y0 + WORLD_H);
  // rolling, uneven ground (hummocks and dips) so the depths never read as flat rows
  for (let x = -10; x <= 400; x += 6) g.lineTo(x, y + Math.sin(x * 0.021 + amp) * 13 + Math.sin(x * 0.067 + amp * 2.3) * 6 + (r() - 0.5) * 3);
  g.lineTo(400, WORLD_Y0 + WORLD_H); g.closePath();
  g.fillStyle = lin(g, 0, y - 6, 0, y + 120, [[0, rim], [0.08, tone], [1, "#010403"]]); g.fill();
}

/** Paints one jungle layer into a world-space context (y from WORLD_Y0). Layer 0 is the backdrop; layers 1–3 are the
 * covers of the far, mid and near spots (each also carries the ground of the next depth). */
export function paintLayer(g: G, layer: Layer) {
  const r = rng(1300 + layer * 77);
  const spots = GALLERY_V13.spots as readonly GallerySpotV13[];
  if (layer === 0) {
    // sky: deep teal night with a nebula band
    g.fillStyle = lin(g, 0, WORLD_Y0, 0, 330, [[0, "#02070b"], [0.45, "#04141a"], [1, "#071d19"]]); g.fillRect(0, WORLD_Y0, WORLD_W, WORLD_H);
    g.fillStyle = rad(g, 260, -40, 10, 260, [[0, "rgba(60,140,150,.35)"], [0.5, "rgba(30,70,90,.18)"], [1, "rgba(0,0,0,0)"]]); g.fillRect(0, WORLD_Y0, WORLD_W, 520);
    for (let k = 0; k < 140; k++) { g.fillStyle = `rgba(220,245,255,${0.2 + r() * 0.6})`; g.fillRect(r() * 390, WORLD_Y0 + r() * 300, r() < 0.1 ? 1.4 : 0.8, r() < 0.1 ? 1.4 : 0.8); }
    // moons: a big pale-jade one and a small rusty one
    glow(g, 286, -20, 150, "#9fe8d0", 0.28);
    g.fillStyle = rad(g, 286, -20, 4, 64, [[0, "#f2fff8"], [0.55, "#bfe8da"], [1, "#6fa89a"]], 270, -38); g.beginPath(); g.arc(286, -20, 62, 0, TAU); g.fill();
    for (let k = 0; k < 14; k++) { const a = r() * TAU, d = r() * 50; g.fillStyle = "rgba(70,120,110,.25)"; g.beginPath(); g.arc(286 + Math.cos(a) * d, -20 + Math.sin(a) * d, 2 + r() * 8, 0, TAU); g.fill(); }
    g.fillStyle = rad(g, 74, -70, 1, 16, [[0, "#ffd7b0"], [1, "#9a4a2a"]], 70, -74); g.beginPath(); g.arc(74, -70, 15, 0, TAU); g.fill();
    // far canopy masses in layers of mist
    for (let band = 0; band < 4; band++) {
      const y = 40 + band * 46, c = ["#06221d", "#082a22", "#0a3026", "#0b3429"][band];
      g.fillStyle = c;
      g.beginPath(); g.moveTo(-10, y + 200);
      for (let x = -10; x <= 400; x += 14) g.lineTo(x, y - 30 * Math.abs(Math.sin(x * 0.021 + band * 1.7)) - r() * 18);
      g.lineTo(400, y + 200); g.closePath(); g.fill();
      g.fillStyle = lin(g, 0, y - 10, 0, y + 50, [[0, "rgba(120,200,180,0)"], [0.5, "rgba(120,200,180,.07)"], [1, "rgba(120,200,180,0)"]]); g.fillRect(0, y - 10, 390, 60);
    }
    // moon shafts
    g.save(); g.globalCompositeOperation = "lighter";
    for (const [x, w] of [[230, 40], [300, 26], [180, 18]]) {
      g.fillStyle = lin(g, x, -40, x - 60, 330, [[0, "rgba(160,240,220,.10)"], [1, "rgba(160,240,220,0)"]]);
      poly(g, [[x, -60], [x + w, -60], [x - 70 + w, 330], [x - 70, 330]]); g.fill();
    }
    g.restore();
    // distant trunks (misty)
    for (const [x, w] of [[30, 12], [98, 9], [140, 14], [205, 8], [250, 11], [318, 13], [370, 10]]) trunk(g, x, x + w, -60, 300, 6, (r() - 0.5) * 10, 0, r, false);
    g.fillStyle = "rgba(20,60,55,.35)"; g.fillRect(0, -60, 390, 360);
    for (let k = 0; k < 9; k++) liana(g, r() * 390, -60, 40 + r() * 140, (r() - 0.5) * 20, "rgba(10,40,34,.9)", r);
    glowBugs(g, 26, 0, 390, 40, 300, r);
    // far ground
    bank(g, 268, 0.4, "#0a2a22", "#2c5a4a", r);
    return;
  }
  if (layer === 1) {
    // covers of the far spots + mid ground
    for (const [i, s] of spots.entries()) {
      if (s.layer !== 0) continue;
      const sc = s.scaleMilli / 1000;
      if (s.dir === "UP") {
        rock(g, s.x + (i % 2 ? 10 : -12) * sc, s.edge + 12 * sc, 34 * sc, 18 * sc, r);
        for (let k = 0; k < 7; k++) frond(g, s.x + (r() - 0.5) * 60 * sc, s.edge + 20 * sc, (38 + r() * 26) * sc, -Math.PI / 2 + (r() - 0.5) * 1.6, (r() - 0.5) * 1.2, 9 * sc, "#05160f", "#1f5a42", "#5cf0d8", r);
        mushrooms(g, s.x + 26 * sc, s.edge + 8 * sc, 3, r);
      } else {
        const left = s.dir === "RIGHT", e = s.edge;
        trunk(g, left ? e - 26 : e, left ? e : e + 26, -160, s.y + 70 * sc, 10, (r() - 0.5) * 12, 1, r);
        for (let k = 0; k < 2; k++) liana(g, (left ? e - 14 : e + 12) + (r() - 0.5) * 10, -100, s.y - 20 + r() * 60, 10, "#0d2a22", r);
      }
    }
    bank(g, 360, 1.3, "#0c3027", "#3a7a62", r);
    for (let k = 0; k < 10; k++) frond(g, r() * 390, 372 + r() * 10, 30 + r() * 30, -Math.PI / 2 + (r() - 0.5) * 2, (r() - 0.5), 8, "#06180f", "#21603f", null, r);
    glowBugs(g, 14, 0, 390, 300, 380, r);
    return;
  }
  if (layer === 2) {
    // covers of the mid spots + near ground
    for (const s of spots) {
      if (s.layer !== 1) continue;
      const sc = s.scaleMilli / 1000;
      if (s.dir === "UP") {
        for (let k = 0; k < 9; k++) frond(g, s.x + (r() - 0.5) * 80 * sc, s.edge + 26 * sc, (44 + r() * 30) * sc, -Math.PI / 2 + (r() - 0.5) * 1.7, (r() - 0.5) * 1.4, 11 * sc, "#041209", "#2a7048", "#a6ff5a", r);
        for (let k = 0; k < 3; k++) leaf(g, s.x + (k - 1) * 30 * sc, s.edge + 18 * sc, 46 * sc, -Math.PI / 2 + (k - 1) * 0.7, 13 * sc, "#082a1c", "#3d8a62", "#7cffc8", r);
        mushrooms(g, s.x - 30 * sc, s.edge + 10 * sc, 4, r);
      } else {
        const left = s.dir === "RIGHT", e = s.edge;
        trunk(g, left ? -20 : e, left ? e : 410, -160, s.y + 90 * sc, 14, (r() - 0.5) * 16, 2, r);
        for (let k = 0; k < 3; k++) liana(g, (left ? e - 8 : e + 8) + (r() - 0.5) * 14, -140, s.y + r() * 80, 14, "#123a2c", r);
        // a bracket of leaves at the trunk's foot
        for (let k = 0; k < 3; k++) leaf(g, e + (left ? -6 : 6), s.y + 70 * sc + k * 6, 42, left ? -0.4 - k * 0.3 : Math.PI + 0.4 + k * 0.3, 12, "#082a1c", "#3d8a62", "#7cffc8", r);
      }
    }
    bank(g, 478, 2.1, "#0d3428", "#468a6c", r);
    for (let k = 0; k < 8; k++) frond(g, r() * 390, 488, 34 + r() * 30, -Math.PI / 2 + (r() - 0.5) * 2, (r() - 0.5), 9, "#05150c", "#256a44", null, r);
    glowBugs(g, 10, 0, 390, 400, 480, r);
    return;
  }
  // layer 3: near covers and the foreground
  for (const s of spots) {
    if (s.layer !== 2) continue;
    const sc = s.scaleMilli / 1000;
    if (s.x > 150 && s.x < 250) {
      // fallen log across the middle
      const y = s.edge + 14;
      g.fillStyle = lin(g, 0, y - 18, 0, y + 22, [[0, "#3c6a56"], [0.25, "#1c3a2e"], [1, "#040b08"]]);
      g.beginPath(); g.roundRect(s.x - 92, y - 18, 184, 42, 18); g.fill();
      g.strokeStyle = "rgba(0,0,0,.4)"; g.lineWidth = 1.2;
      for (let k = 0; k < 10; k++) { const x = s.x - 84 + k * 18; g.beginPath(); g.moveTo(x, y - 14); g.quadraticCurveTo(x + 6, y + 2, x + 2, y + 20); g.stroke(); }
      g.fillStyle = lin(g, s.x + 80, 0, s.x + 98, 0, [[0, "#2a4a3c"], [1, "#0a1612"]]); g.beginPath(); g.ellipse(s.x + 90, y + 3, 10, 21, 0, 0, TAU); g.fill();
      g.strokeStyle = "rgba(160,220,190,.35)"; for (let k = 1; k < 4; k++) { g.beginPath(); g.ellipse(s.x + 90, y + 3, 10 - k * 2.6, 21 - k * 5.5, 0, 0, TAU); g.stroke(); }
      mushrooms(g, s.x - 40, y - 16, 5, r); mushrooms(g, s.x + 34, y - 16, 4, r);
      for (let k = 0; k < 6; k++) frond(g, s.x - 80 + r() * 160, y - 10, 24 + r() * 20, -Math.PI / 2 + (r() - 0.5) * 1.4, (r() - 0.5), 7, "#05150c", "#2b7a4c", "#a6ff5a", r);
    } else {
      for (let k = 0; k < 5; k++) leaf(g, s.x + (k - 2) * 22 * sc, s.edge + 40 * sc, (70 + r() * 20) * sc, -Math.PI / 2 + (k - 2) * 0.42 + (r() - 0.5) * 0.2, 20 * sc, "#06241a", "#3f9268", "#8affd2", r);
      for (let k = 0; k < 6; k++) frond(g, s.x + (r() - 0.5) * 90 * sc, s.edge + 34 * sc, (50 + r() * 30) * sc, -Math.PI / 2 + (r() - 0.5) * 1.8, (r() - 0.5) * 1.2, 12 * sc, "#03100a", "#2a7a4e", "#a6ff5a", r);
    }
  }
  // foreground: huge leaves along the bottom and the edges
  bank(g, 560, 3.4, "#071d15", "#2c5c48", r);
  for (const [x, y, len, ang, w] of [[-20, 640, 170, -1.05, 44], [40, 700, 150, -1.35, 38], [410, 640, 170, -2.1, 44], [350, 700, 160, -1.8, 38], [180, 760, 150, -1.6, 40], [-30, 520, 120, -0.55, 30], [420, 520, 120, -2.6, 30]] as const)
    leaf(g, x, y, len, ang, w, "#041a12", "#2f7a56", "#8affd2", r);
  for (let k = 0; k < 10; k++) frond(g, r() * 390, 600 + r() * 120, 60 + r() * 50, -Math.PI / 2 + (r() - 0.5) * 2.2, (r() - 0.5) * 1.4, 14, "#020b07", "#1e5a3a", "#5cf0d8", r);
  glowBugs(g, 12, 0, 390, 520, 640, r);
}
