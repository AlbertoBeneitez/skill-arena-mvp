/** Presentation only: never changes gameplay or consumes a simulation RNG. */
export function drawSpaceBackdrop(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  scroll = 0,
  tick = 0
) {
  ctx.save();
  const sky = ctx.createLinearGradient(0, 0, width * 0.7, height);
  sky.addColorStop(0, "#050d21");
  sky.addColorStop(0.55, "#182443");
  sky.addColorStop(1, "#071827");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);
  const nebula = ctx.createRadialGradient(width * 0.2, height * 0.35, 0, width * 0.2, height * 0.35, width * 0.8);
  nebula.addColorStop(0, "rgba(125,65,209,.22)");
  nebula.addColorStop(1, "rgba(125,65,209,0)");
  ctx.fillStyle = nebula;
  ctx.fillRect(0, 0, width, height);
  for (let index = 0; index < 65; index += 1) {
    const depth = index % 3 + 1;
    const x = ((index * 97 - scroll * depth * 0.018) % width + width) % width;
    const y = 20 + (index * 53 % Math.max(1, height * 0.67));
    ctx.globalAlpha = 0.32 + depth * 0.16 + Math.sin(tick * 0.008 + index) * 0.08;
    ctx.fillStyle = index % 4 ? "#dceaff" : "#7fddff";
    ctx.fillRect(x, y, depth === 3 ? 2 : 1, depth === 3 ? 2 : 1);
  }
  ctx.globalAlpha = 1;
  const x = width * 0.79, y = height * 0.23, radius = width * 0.115;
  const planet = ctx.createLinearGradient(x - radius, y - radius, x + radius, y + radius);
  planet.addColorStop(0, "#3c6887");
  planet.addColorStop(1, "#142744");
  ctx.fillStyle = planet;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(120,221,245,.34)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(x, y, radius * 1.65, radius * 0.35, -0.3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
