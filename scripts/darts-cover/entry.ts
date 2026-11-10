// Browser entry for scripts/render-darts-cover.mjs (v166): the game's own tournament board (sisal, spider, number
// ring) under a stage spotlight, with three steel-tip darts grouped in the treble 20, drawn in perspective with their
// shadows on the board. Presentation only; nothing here touches the darts cores.
import { boardSprite } from "@/components/games/Darts";

type V = { x: number; y: number };
const TAU = Math.PI * 2;

/** One steel-tip dart seen from the lower left: tip in the board at `tip`, the body rising toward the viewer along `dir`. */
function drawDart(g: CanvasRenderingContext2D, tip: V, dir: V, len: number, w: number, hue: { a: string; b: string }, shadow: boolean) {
  const ang = Math.atan2(dir.y, dir.x);
  const grow = (t: number) => 1 + t * 0.42; // perspective: the tail is nearer the camera
  g.save();
  g.translate(tip.x, tip.y);
  g.rotate(ang);
  if (shadow) {
    // The shadow falls on the board from a key light above left: it leaves the tip and drifts down and right.
    g.restore(); g.save();
    g.translate(tip.x, tip.y);
    g.rotate(ang + 0.5);
    g.filter = "blur(6px)";
    g.fillStyle = "rgba(0,0,0,.62)";
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(len * 0.62, -w * 0.5); g.lineTo(len * 0.7, -w * 1.6); g.lineTo(len * 0.98, -w * 1.9); g.lineTo(len * 1.02, w * 1.2);
    g.lineTo(len * 0.7, w * 1.1); g.lineTo(len * 0.62, w * 0.5);
    g.closePath(); g.fill();
    g.restore();
    return;
  }
  const at = (t: number) => t * len;
  const band = (t0: number, t1: number, r0: number, r1: number, fill: (x0: number, x1: number, h: number) => CanvasGradient | string) => {
    const x0 = at(t0), x1 = at(t1), h0 = r0 * w * grow(t0), h1 = r1 * w * grow(t1);
    g.fillStyle = fill(x0, x1, Math.max(h0, h1));
    g.beginPath(); g.moveTo(x0, -h0); g.lineTo(x1, -h1); g.lineTo(x1, h1); g.lineTo(x0, h0); g.closePath(); g.fill();
  };
  const metal = (stops: [number, string][]) => (_x0: number, _x1: number, h: number) => {
    const q = g.createLinearGradient(0, -h, 0, h);
    for (const [o, c] of stops) q.addColorStop(o, c);
    return q;
  };
  // Steel point (a short stub shows; the rest is in the sisal), with a dark entry ring.
  g.fillStyle = "rgba(0,0,0,.6)"; g.beginPath(); g.ellipse(0, 0, w * 0.55, w * 0.9, 0, 0, TAU); g.fill();
  band(0, 0.08, 0.16, 0.2, metal([[0, "#5e6570"], [0.35, "#ffffff"], [0.6, "#b9c0ca"], [1, "#3a4048"]]));
  // Tungsten barrel: tapered torpedo, knurled.
  const tung: [number, string][] = [[0, "#16191e"], [0.2, "#5b636f"], [0.38, "#eef2f7"], [0.52, "#a3acb8"], [0.8, "#3b414b"], [1, "#0e1014"]];
  band(0.08, 0.14, 0.36, 0.7, metal(tung));
  band(0.14, 0.37, 0.7, 0.74, metal(tung));
  band(0.37, 0.42, 0.74, 0.44, metal(tung));
  for (let t = 0.17; t < 0.355; t += 0.0115) {
    const x = at(t), h = 0.72 * w * grow(t);
    g.fillStyle = "rgba(8,10,14,.6)"; g.fillRect(x, -h, len * 0.0045, h * 2);
    g.fillStyle = "rgba(255,255,255,.22)"; g.fillRect(x + len * 0.0045, -h, len * 0.0025, h * 2);
  }
  // Coloured grip rings at both ends of the knurl.
  for (const t of [0.155, 0.36]) { const h = 0.74 * w * grow(t); g.fillStyle = hue.b; g.fillRect(at(t), -h, len * 0.008, h * 2); }
  // Aluminium shaft with grooves.
  band(0.42, 0.66, 0.3, 0.3, metal([[0, "#2c323b"], [0.3, "#d7dde6"], [0.5, "#ffffff"], [0.7, "#8e98a6"], [1, "#22272e"]]));
  for (const t of [0.47, 0.51, 0.55]) { const h = 0.3 * w * grow(t); g.fillStyle = "rgba(10,14,20,.6)"; g.fillRect(at(t), -h, len * 0.006, h * 2); }
  // Flights (standard shape: a swept leading edge, a straight top, a square tail): the near one fully open and lit,
  // the far one foreshortened in shade, the third edge-on along the axis.
  const flight = (side: number, k: number, shade: number) => {
    const xa = at(0.56), xb = at(0.86), xc = at(1.0), H = w * 3.3 * grow(0.95) * k;
    g.beginPath();
    g.moveTo(xa, 0);
    g.bezierCurveTo(at(0.66), -side * H * 0.12, at(0.78), -side * H * 0.62, xb, -side * H);
    g.lineTo(xc, -side * H * 0.9);
    g.quadraticCurveTo(xc + w * 0.25, -side * H * 0.45, xc, 0);
    g.closePath();
    const q = g.createLinearGradient(xa, 0, xc, -side * H);
    q.addColorStop(0, "#050608"); q.addColorStop(0.5, hue.a); q.addColorStop(0.92, hue.b); q.addColorStop(1, "#d9fbff");
    g.fillStyle = q; g.fill();
    g.save(); g.clip();
    // Printed design: a dark band and a bright chevron, then the film's sheen and the shade on the far flight.
    g.fillStyle = "rgba(4,6,10,.55)"; g.fillRect(at(0.9), -H * 2, at(0.035), H * 4);
    g.strokeStyle = "rgba(230,252,255,.55)"; g.lineWidth = w * 0.22;
    g.beginPath(); g.moveTo(at(0.74), 0); g.lineTo(at(0.86), -side * H * 0.55); g.lineTo(at(0.98), 0); g.stroke();
    const film = g.createLinearGradient(0, -side * H, 0, 0);
    film.addColorStop(0, "rgba(255,255,255,.22)"); film.addColorStop(0.4, "rgba(255,255,255,0)"); film.addColorStop(1, "rgba(0,0,0,.25)");
    g.fillStyle = film; g.fillRect(xa, -H * 2, xc - xa + w, H * 4);
    if (shade > 0) { g.fillStyle = `rgba(0,0,0,${shade})`; g.fillRect(xa, -H * 2, xc - xa + w, H * 4); }
    g.restore();
    g.strokeStyle = shade > 0 ? "rgba(127,227,238,.35)" : "rgba(220,250,255,.85)"; g.lineWidth = Math.max(1.2, w * 0.1);
    g.beginPath(); g.moveTo(xa, 0); g.bezierCurveTo(at(0.66), -side * H * 0.12, at(0.78), -side * H * 0.62, xb, -side * H); g.lineTo(xc, -side * H * 0.9); g.stroke();
  };
  flight(1, 0.62, 0.45);
  flight(-1, 1, 0);
  // Edge-on flight and the flight's spine.
  g.fillStyle = "#0a0c10"; g.beginPath(); g.moveTo(at(0.58), -w * 0.12); g.lineTo(at(1.0), -w * 0.22); g.lineTo(at(1.0), w * 0.22); g.lineTo(at(0.58), w * 0.12); g.closePath(); g.fill();
  g.fillStyle = hue.b; g.fillRect(at(0.6), -w * 0.05, at(0.4), w * 0.1);
  g.restore();
}

(window as unknown as { renderCover(): Promise<string> }).renderCover = async () => {
  const W = 1600, H = 1100;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d")!;
  // Stage: a dark hall, warm key light from above left onto the board, cool fill from the right, crowd lights.
  g.fillStyle = "#07070a"; g.fillRect(0, 0, W, H);
  const bx = 800, by = 455, scale = 2.86; // board centre and px per logical unit (board radius 160 → 419 px)
  const spot = g.createRadialGradient(bx - 120, by - 260, 40, bx, by, 900);
  spot.addColorStop(0, "rgba(255,226,180,.32)"); spot.addColorStop(0.45, "rgba(120,96,70,.12)"); spot.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = spot; g.fillRect(0, 0, W, H);
  const fill = g.createRadialGradient(W + 100, by + 100, 50, W, by, 800);
  fill.addColorStop(0, "rgba(127,227,238,.16)"); fill.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = fill; g.fillRect(0, 0, W, H);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  g.filter = "blur(14px)";
  for (let k = 0; k < 26; k++) {
    const x = rnd() * W, y = 700 + rnd() * 420, r = 10 + rnd() * 26;
    if (Math.abs(x - bx) < 520 && y < 950) continue;
    g.fillStyle = ["rgba(255,190,110,.35)", "rgba(127,227,238,.3)", "rgba(255,110,160,.28)", "rgba(200,210,255,.28)"][k % 4];
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  }
  // Light beams crossing on the board, with dust.
  g.filter = "blur(18px)";
  for (const [x0, col] of [[160, "rgba(255,226,180,.10)"], [1440, "rgba(170,230,255,.08)"]] as const) {
    g.fillStyle = col; g.beginPath(); g.moveTo(x0 - 40, -40); g.lineTo(x0 + 40, -40); g.lineTo(bx + 330, by + 420); g.lineTo(bx - 330, by + 420); g.closePath(); g.fill();
  }
  g.filter = "none";
  for (let k = 0; k < 220; k++) {
    const x = rnd() * W, y = rnd() * H * 0.8;
    g.fillStyle = `rgba(255,236,210,${0.05 + rnd() * 0.18})`;
    g.beginPath(); g.arc(x, y, 0.6 + rnd() * 1.6, 0, TAU); g.fill();
  }
  // The board hangs off the wall: a deep soft shadow down and right, then the board itself.
  g.filter = "blur(36px)"; g.fillStyle = "rgba(0,0,0,.8)";
  g.beginPath(); g.ellipse(bx + 40, by + 52, 160 * scale, 160 * scale * 0.98, 0, 0, TAU); g.fill();
  g.filter = "none";
  const board = boardSprite()!;
  g.save();
  g.translate(bx, by);
  g.transform(0.965, -0.035, 0.03, 1, 0, 0); // a slight turn toward the light
  g.drawImage(board, -160 * scale, -160 * scale, 320 * scale, 320 * scale);
  // Stage light on the lacquer: brighter top left, falling off.
  const sheen = g.createRadialGradient(-150, -200, 40, 0, 0, 160 * scale);
  sheen.addColorStop(0, "rgba(255,240,215,.16)"); sheen.addColorStop(0.6, "rgba(0,0,0,0)"); sheen.addColorStop(1, "rgba(0,0,0,.35)");
  g.fillStyle = sheen; g.beginPath(); g.arc(0, 0, 160 * scale, 0, TAU); g.fill();
  g.restore();
  // Three darts in the treble 20 (logical board coordinates, y up is negative).
  const P = (x: number, y: number): V => ({ x: bx + (0.965 * x + 0.03 * y) * scale, y: by + (-0.035 * x + y) * scale });
  const tips = [P(-9, -82.5), P(9.5, -84.5), P(1, -80)];
  const dirs: V[] = [{ x: 0.3, y: 0.95 }, { x: 0.72, y: 0.69 }, { x: 0.52, y: 0.85 }];
  const lens = [375, 395, 360];
  const hues = { a: "#0e3b44", b: "#7fe3ee" };
  tips.forEach((t, i) => drawDart(g, t, dirs[i], lens[i], 15.5, hues, true));
  // Back to front: the dart whose tail is highest is furthest away.
  [0, 1, 2].forEach((i) => drawDart(g, tips[i], dirs[i], lens[i], 15.5, hues, false));
  return c.toDataURL("image/png");
};
