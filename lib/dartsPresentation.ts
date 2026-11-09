/** Read-only flight geometry; impact/timing/score always come from the archived core. */
import {
  DARTS_RULES,
  dartsReticle,
  type DartsState,
} from "./verified/dartsCore.v1";
export type DartPose = Readonly<{
  x: number;
  y: number;
  angle: number;
  scale: number;
}>;
const launch = { x: 195, y: 550 };
function heading(x: number, y: number) {
  return Math.atan2(y - launch.y, x - launch.x) + Math.PI / 2;
}
export function dartFlightPose(x: number, y: number, age: number): DartPose {
  const p = Math.max(0, Math.min(1, age / DARTS_RULES.impactTicks));
  return {
    x: launch.x + (x - launch.x) * p,
    y: launch.y + (y - launch.y) * p - Math.sin(p * Math.PI) * 12,
    angle: heading(x, y),
    scale: 1.35 - (1.35 - 0.48) * p,
  };
}
export function dartPresentationPose(
  state: Readonly<DartsState>,
): DartPose | null {
  if (state.phase === "aim") {
    const target = dartsReticle(state);
    return {
      x: launch.x,
      y: launch.y,
      angle: heading(195 + target.x / 1000, 285 + target.y / 1000),
      scale: 1.35,
    };
  }
  const last = state.impacts.at(-1);
  return last && !last.timeout
    ? dartFlightPose(195 + last.x / 1000, 285 + last.y / 1000, state.phaseTicks)
    : null;
}
/**
 * v162 · A realistic steel-tip dart (one bounded vector sprite, no image): a polished needle point, a knurled
 * tungsten barrel with its grip rings and a moving highlight, a ringed aluminium shaft and two standard flights in
 * perspective (the third seen edge-on) with a printed stripe. The tip is at (0, 0) and the tail runs towards +y.
 */
export function drawDart(
  ctx: CanvasRenderingContext2D,
  pose: DartPose,
  tint = "#6bdde2",
) {
  ctx.save();
  ctx.translate(pose.x, pose.y);
  ctx.rotate(pose.angle);
  ctx.scale(pose.scale, pose.scale);
  // Soft contact shadow.
  ctx.fillStyle = "rgba(0,8,21,.42)";
  ctx.beginPath();
  ctx.ellipse(4, 28, 8, 20, 0, 0, Math.PI * 2);
  ctx.fill();
  // Flights: two wings spread left/right, the third edge-on behind the shaft.
  const wing = (side: number) => {
    ctx.beginPath();
    ctx.moveTo(side * 1.2, 31);
    ctx.lineTo(side * 7, 34);
    ctx.quadraticCurveTo(side * 14.5, 40, side * 13.5, 46.5);
    ctx.lineTo(side * 9, 48.5);
    ctx.lineTo(side * 1.2, 46);
    ctx.closePath();
  };
  for (const side of [-1, 1]) {
    const g = ctx.createLinearGradient(side * 1, 32, side * 14, 47);
    g.addColorStop(0, tint);
    g.addColorStop(0.55, tint);
    g.addColorStop(1, "#0d1a2a");
    ctx.fillStyle = g;
    wing(side);
    ctx.fill();
    // Printed stripe and a light sheen on the film.
    ctx.save();
    wing(side);
    ctx.clip();
    ctx.fillStyle = "rgba(255,255,255,.75)";
    ctx.beginPath();
    ctx.moveTo(side * 3, 33.5); ctx.lineTo(side * 15, 41); ctx.lineTo(side * 15, 43.5); ctx.lineTo(side * 3, 36.5); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(8,14,26,.55)";
    ctx.beginPath();
    ctx.moveTo(side * 3, 38.5); ctx.lineTo(side * 15, 46); ctx.lineTo(side * 15, 49); ctx.lineTo(side * 3, 41.5); ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = "rgba(6,12,22,.85)";
    ctx.lineWidth = 0.8;
    wing(side);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(10,18,30,.9)";
  ctx.fillRect(-0.9, 31, 1.8, 17);
  // Shaft: ringed aluminium.
  const sh = ctx.createLinearGradient(-2, 0, 2, 0);
  sh.addColorStop(0, "#4b5563"); sh.addColorStop(0.35, "#e9eef5"); sh.addColorStop(0.65, "#aab4c2"); sh.addColorStop(1, "#3b4350");
  ctx.fillStyle = sh;
  ctx.beginPath();
  ctx.roundRect(-1.9, 24.5, 3.8, 9.5, 0.8);
  ctx.fill();
  ctx.fillStyle = "rgba(20,28,40,.65)";
  for (const y of [26.5, 29, 31.5]) ctx.fillRect(-1.9, y, 3.8, 0.7);
  // Tungsten barrel: tapered torpedo with knurled grip rings.
  const barrel = () => {
    ctx.beginPath();
    ctx.moveTo(-1.6, 9.5);
    ctx.bezierCurveTo(-3.6, 11.5, -3.9, 13.5, -3.9, 16);
    ctx.lineTo(-3.6, 22.5);
    ctx.quadraticCurveTo(-3.2, 24.6, -2.1, 25);
    ctx.lineTo(2.1, 25);
    ctx.quadraticCurveTo(3.2, 24.6, 3.6, 22.5);
    ctx.lineTo(3.9, 16);
    ctx.bezierCurveTo(3.9, 13.5, 3.6, 11.5, 1.6, 9.5);
    ctx.closePath();
  };
  const tg = ctx.createLinearGradient(-4, 0, 4, 0);
  tg.addColorStop(0, "#23272e"); tg.addColorStop(0.28, "#7d8592"); tg.addColorStop(0.42, "#f3f6fa"); tg.addColorStop(0.58, "#9aa3b0"); tg.addColorStop(1, "#1d2127");
  ctx.fillStyle = tg;
  barrel();
  ctx.fill();
  ctx.save();
  barrel();
  ctx.clip();
  // Knurling: fine dark grooves with a lit lip under each.
  for (let y = 13.2; y <= 21.8; y += 1.25) {
    ctx.fillStyle = "rgba(10,12,16,.62)";
    ctx.fillRect(-4, y, 8, 0.55);
    ctx.fillStyle = "rgba(255,255,255,.28)";
    ctx.fillRect(-4, y + 0.55, 8, 0.3);
  }
  // Coloured ring at the front of the grip.
  ctx.fillStyle = tint;
  ctx.fillRect(-4, 11.6, 8, 0.9);
  ctx.restore();
  ctx.strokeStyle = "rgba(4,6,10,.7)";
  ctx.lineWidth = 0.5;
  barrel();
  ctx.stroke();
  // Steel point: tapered needle with a bright edge.
  const pg = ctx.createLinearGradient(-1, 0, 1, 0);
  pg.addColorStop(0, "#6b7280"); pg.addColorStop(0.5, "#ffffff"); pg.addColorStop(1, "#5b626e");
  ctx.fillStyle = pg;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-0.95, 3);
  ctx.lineTo(-1.1, 9.8);
  ctx.lineTo(1.1, 9.8);
  ctx.lineTo(0.95, 3);
  ctx.closePath();
  ctx.fill();
  // Glint along the point's lit edge (also the sprite's marker in scripts/verify-darts-presentation.cjs).
  ctx.fillStyle = "#dff7ff";
  ctx.beginPath();
  ctx.moveTo(0, 0.6);
  ctx.lineTo(-0.35, 9.4);
  ctx.lineTo(0.15, 9.4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
