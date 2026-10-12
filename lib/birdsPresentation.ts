/** Original porcine astronauts; no commercial character assets or shapes reused. */
export const BIRDS_SCENE_LIFT = 80;
export function drawSpacePig(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
) {
  ctx.fillStyle = "#374762";
  ctx.strokeStyle = "#9da8d1";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x - 17, y - 16, 34, 32, 10);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#b58a9f";
  ctx.beginPath();
  ctx.moveTo(x - 12, y - 6);
  ctx.lineTo(x - 11, y - 13);
  ctx.lineTo(x - 5, y - 7);
  ctx.moveTo(x + 12, y - 6);
  ctx.lineTo(x + 11, y - 13);
  ctx.lineTo(x + 5, y - 7);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x, y, 12, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#d6afbd";
  ctx.beginPath();
  ctx.ellipse(x, y + 4, 8, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#352b43";
  for (const dx of [-3, 3]) {
    ctx.beginPath();
    ctx.ellipse(x + dx, y + 4, 1.4, 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const dx of [-6, 6]) {
    ctx.fillStyle = "#f3ece9";
    ctx.beginPath();
    ctx.arc(x + dx, y - 4, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#282b42";
    ctx.beginPath();
    ctx.arc(x + dx + 0.5, y - 4, 1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = "#90c9d5";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, 15, -Math.PI * 0.88, -Math.PI * 0.15);
  ctx.stroke();
  ctx.fillStyle = "#657994";
  ctx.fillRect(x - 9, y + 12, 18, 3);
}
