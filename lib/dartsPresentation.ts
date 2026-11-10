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
/** Player look for the darts (v164): the avatar image printed across the four flights and its overall colour. */
export type DartLook = Readonly<{ image: CanvasImageSource | null; color: string }>;
const DEFAULT_LOOK: DartLook = { image: null, color: "#6bdde2" };

/**
 * A realistic steel-tip dart (v162; v164 flights): a polished needle point, a knurled tungsten barrel with a ring in
 * the player's colour, a ringed aluminium shaft and four flights seen from behind in an X — the player's avatar
 * circle is printed across them, one quarter per flight, edged in the avatar's overall colour. The tip is at (0, 0)
 * and the tail runs towards +y. Without an image the flights are filled with the colour.
 */
export function drawDart(
  ctx: CanvasRenderingContext2D,
  pose: DartPose,
  tint: string | DartLook = DEFAULT_LOOK,
) {
  const look: DartLook = typeof tint === "string" ? { image: null, color: tint } : tint;
  const col = look.color;
  ctx.save();
  ctx.translate(pose.x, pose.y);
  ctx.rotate(pose.angle);
  ctx.scale(pose.scale, pose.scale);
  // Soft contact shadow.
  ctx.fillStyle = "rgba(0,8,21,.42)";
  ctx.beginPath();
  ctx.ellipse(4, 30, 9, 21, 0, 0, Math.PI * 2);
  ctx.fill();
  // Four flights in an X around the tail, seen from behind (squashed along the dart): the avatar is clipped to them.
  const fx = 0, fy = 41, R = 16, squash = 0.62;
  const wings = () => {
    ctx.beginPath();
    for (let q = 0; q < 4; q++) {
      const a = Math.PI / 4 + (q * Math.PI) / 2, w = 0.6;
      const p = (ang: number, r: number) => [fx + Math.cos(ang) * r, fy + Math.sin(ang) * r * squash] as const;
      const [x0, y0] = p(a, 1.6), [x1, y1] = p(a - w, R * 0.62), [x2, y2] = p(a - w * 0.55, R), [x3, y3] = p(a + w * 0.55, R), [x4, y4] = p(a + w, R * 0.62);
      ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.quadraticCurveTo(...p(a - w * 0.85, R * 0.92), x2, y2);
      ctx.lineTo(x3, y3); ctx.quadraticCurveTo(...p(a + w * 0.85, R * 0.92), x4, y4); ctx.closePath();
    }
  };
  ctx.save();
  wings();
  ctx.fillStyle = col;
  ctx.fill();
  if (look.image) {
    ctx.clip();
    ctx.save();
    ctx.translate(fx, fy); ctx.scale(1, squash);
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.clip();
    ctx.drawImage(look.image, -R, -R, R * 2, R * 2);
    ctx.restore();
  }
  // Film sheen across the flights.
  const sheen = ctx.createLinearGradient(fx - R, fy - R * squash, fx + R, fy + R * squash);
  sheen.addColorStop(0, "rgba(255,255,255,.28)"); sheen.addColorStop(0.45, "rgba(255,255,255,0)"); sheen.addColorStop(1, "rgba(0,0,0,.25)");
  ctx.fillStyle = sheen;
  ctx.fillRect(fx - R, fy - R, R * 2, R * 2);
  ctx.restore();
  ctx.strokeStyle = col;
  ctx.lineWidth = 1.1;
  wings();
  ctx.stroke();
  ctx.strokeStyle = "rgba(6,10,18,.75)";
  ctx.lineWidth = 0.5;
  wings();
  ctx.stroke();
  // Shaft: ringed aluminium, into the flights' centre.
  const sh = ctx.createLinearGradient(-2, 0, 2, 0);
  sh.addColorStop(0, "#4b5563"); sh.addColorStop(0.35, "#e9eef5"); sh.addColorStop(0.65, "#aab4c2"); sh.addColorStop(1, "#3b4350");
  ctx.fillStyle = sh;
  ctx.beginPath();
  ctx.roundRect(-1.9, 24.5, 3.8, 15, 0.8);
  ctx.fill();
  ctx.fillStyle = "rgba(20,28,40,.65)";
  for (const y of [27, 30, 33]) ctx.fillRect(-1.9, y, 3.8, 0.7);
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.arc(fx, fy, 2.1, 0, Math.PI * 2); ctx.fill();
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
  for (let y = 13.2; y <= 21.8; y += 1.25) {
    ctx.fillStyle = "rgba(10,12,16,.62)";
    ctx.fillRect(-4, y, 8, 0.55);
    ctx.fillStyle = "rgba(255,255,255,.28)";
    ctx.fillRect(-4, y + 0.55, 8, 0.3);
  }
  // Rings in the player's colour at both ends of the grip.
  ctx.fillStyle = col;
  ctx.fillRect(-4, 11.6, 8, 0.9);
  ctx.fillRect(-4, 23.2, 8, 0.8);
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
