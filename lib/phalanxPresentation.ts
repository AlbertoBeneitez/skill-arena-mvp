import type { PhalanxShot } from "./verified/starPhalanxCore.v1";
/** Original projectile art; the 4×16 body stays at the actual simulated center. */
export function drawPhalanxBolt(
  ctx: CanvasRenderingContext2D,
  shot: Readonly<PhalanxShot>,
) {
  const x = shot.x / 1000,
    y = shot.y / 1000,
    behind = shot.vy < 0 ? 1 : -1;
  ctx.save();
  ctx.fillStyle = shot.enemy ? "#a13b53" : "#428caa";
  ctx.globalAlpha = 0.3;
  ctx.fillRect(x - 3, y + behind * 8 - 10, 6, 20);
  ctx.globalAlpha = 0.15;
  ctx.fillRect(x - 2, y + behind * 22 - 8, 4, 16);
  ctx.globalAlpha = 1;
  ctx.fillStyle = shot.enemy ? "#ff788f" : "#bdf7ff";
  ctx.fillRect(x - 2, y - 8, 4, 16);
  ctx.fillStyle = shot.enemy ? "#ffd2d7" : "#f1ffff";
  ctx.fillRect(x - 1, y - 6, 2, 12);
  ctx.restore();
}
