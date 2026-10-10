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
/** Original metal shaft and orbital fins; one bounded sprite, no image/dependency. */
export function drawDart(
  ctx: CanvasRenderingContext2D,
  pose: DartPose,
  tint = "#6bdde2",
) {
  ctx.save();
  ctx.translate(pose.x, pose.y);
  ctx.rotate(pose.angle);
  ctx.scale(pose.scale, pose.scale);
  ctx.fillStyle = "rgba(0,8,21,.45)";
  ctx.beginPath();
  ctx.ellipse(3, 27, 7, 19, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = tint;
  ctx.beginPath();
  ctx.moveTo(-2, 24);
  ctx.lineTo(-12, 36);
  ctx.lineTo(-3, 42);
  ctx.lineTo(3, 42);
  ctx.lineTo(12, 36);
  ctx.lineTo(2, 24);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#193c50";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = "#dff7ff";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-3, 14);
  ctx.lineTo(-3, 34);
  ctx.lineTo(3, 34);
  ctx.lineTo(3, 14);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#7096ad";
  ctx.fillRect(0, 15, 3, 19);
  ctx.strokeStyle = "#8fbdc9";
  ctx.lineWidth = 1;
  for (let grip = 16; grip <= 28; grip += 4) {
    ctx.beginPath();
    ctx.moveTo(-3, grip);
    ctx.lineTo(3, grip);
    ctx.stroke();
  }
  ctx.strokeStyle = "#f0ffff";
  ctx.beginPath();
  ctx.moveTo(-1, 13);
  ctx.lineTo(-1, 31);
  ctx.stroke();
  ctx.restore();
}
