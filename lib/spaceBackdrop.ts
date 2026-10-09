const SPACE_IMAGE_SRC = "/art/galactic-background.webp";
let spaceImage: HTMLImageElement | null = null;
// Only the first backdrop renderer in a logical frame consumes this marker.
// It reuses the image already drawn across the physical canvas, not a second
// cropped planet inside the gameplay rectangle.
const preparedFrames = new WeakMap<CanvasRenderingContext2D, boolean>();

function readySpaceImage(): HTMLImageElement | null {
  if (typeof window === "undefined") return null;
  if (!spaceImage) {
    spaceImage = new window.Image();
    spaceImage.decoding = "async";
    spaceImage.src = SPACE_IMAGE_SRC;
  }
  return spaceImage.complete && spaceImage.naturalWidth > 0 ? spaceImage : null;
}

export type SpaceBackdropViewport = {
  left: number;
  top: number;
  cssWidth: number;
  cssHeight: number;
  viewportWidth: number;
  viewportHeight: number;
};
const canvasViewports = new WeakMap<HTMLCanvasElement, SpaceBackdropViewport>();

function standaloneViewport(canvas: HTMLCanvasElement): SpaceBackdropViewport {
  const cached = canvasViewports.get(canvas);
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  // Normal shared frames pass configureLogicalCanvas's cached geometry. This
  // fallback reads layout once for a standalone renderer, then only on resize.
  if (
    cached &&
    cached.viewportWidth === viewportWidth &&
    cached.viewportHeight === viewportHeight
  )
    return cached;
  const rect = canvas.getBoundingClientRect();
  const frame = {
    left: rect.left,
    top: rect.top,
    cssWidth: Math.max(1, rect.width),
    cssHeight: Math.max(1, rect.height),
    viewportWidth,
    viewportHeight,
  };
  canvasViewports.set(canvas, frame);
  return frame;
}

function paintCanvasSpace(
  ctx: CanvasRenderingContext2D,
  frame?: SpaceBackdropViewport,
): boolean {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  ctx.fillStyle = "#050d21";
  ctx.fillRect(0, 0, width, height);
  const image = readySpaceImage();
  if (!image) return false;
  const viewport = frame ?? standaloneViewport(ctx.canvas);
  const scale = Math.max(
    viewport.viewportWidth / image.naturalWidth,
    viewport.viewportHeight / image.naturalHeight,
  );
  const imageWidth = image.naturalWidth * scale;
  const imageHeight = image.naturalHeight * scale;
  const pixelX = width / viewport.cssWidth;
  const pixelY = height / viewport.cssHeight;
  // Match CSS's fixed viewport cover. A narrow game canvas reveals its slice
  // of one planet instead of starting a second image inside the game column.
  ctx.drawImage(
    image,
    ((viewport.viewportWidth - imageWidth) / 2 - viewport.left) * pixelX,
    -viewport.top * pixelY,
    imageWidth * pixelX,
    imageHeight * pixelY,
  );
  const wash = ctx.createLinearGradient(
    0,
    -viewport.top * pixelY,
    0,
    (viewport.viewportHeight - viewport.top) * pixelY,
  );
  wash.addColorStop(0, "rgba(3,9,21,.66)");
  wash.addColorStop(0.45, "rgba(3,9,21,.48)");
  wash.addColorStop(1, "rgba(3,9,21,.72)");
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, width, height);
  return true;
}

/** Called in physical pixels before the logical transform: no empty bars. */
export function prepareSpaceCanvasBackdrop(
  ctx: CanvasRenderingContext2D,
  frame?: SpaceBackdropViewport,
) {
  if (frame) canvasViewports.set(ctx.canvas, frame);
  preparedFrames.set(ctx, paintCanvasSpace(ctx, frame));
}

/** Presentation only: cached art and subtle foreground dust, no simulation RNG. */
export function drawSpaceBackdrop(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  scroll = 0,
  tick = 0,
) {
  const alreadyPainted = preparedFrames.get(ctx);
  preparedFrames.delete(ctx);
  if (!readySpaceImage()) {
    drawProceduralSpaceBackdrop(ctx, width, height, scroll, tick);
    return;
  }
  if (!alreadyPainted) {
    // Standalone/legacy renderers get the same full-canvas cover and fallback.
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    paintCanvasSpace(ctx);
    ctx.restore();
  }
  ctx.save();
  for (let index = 0; index < 18; index += 1) {
    const depth = (index % 3) + 1;
    const x = (((index * 97 - scroll * depth * 0.018) % width) + width) % width;
    const y = 20 + ((index * 53) % Math.max(1, height * 0.67));
    ctx.globalAlpha =
      0.12 + depth * 0.07 + Math.sin(tick * 0.008 + index) * 0.04;
    ctx.fillStyle = index % 4 ? "#dceaff" : "#7fddff";
    ctx.fillRect(x, y, depth === 3 ? 2 : 1, depth === 3 ? 2 : 1);
  }
  ctx.restore();
}
/** Presentation only: never changes gameplay or consumes a simulation RNG. */
function drawProceduralSpaceBackdrop(
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
  const haze = ctx.createRadialGradient(width * .85, height * .17, 0, width * .85, height * .17, width * .65);
  haze.addColorStop(0, "rgba(76,133,165,.15)");
  haze.addColorStop(.5, "rgba(55,91,131,.06)");
  haze.addColorStop(1, "rgba(55,91,131,0)");
  ctx.fillStyle = haze;
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
  // Faint orbital depth stays behind the opaque, high-contrast playfield.
  ctx.strokeStyle = "rgba(167,186,207,.07)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(x, y, width * .49, height * .16, -.3, 0, Math.PI * 2);
  ctx.stroke();
  const halo = ctx.createRadialGradient(x, y, radius * .6, x, y, radius * 2.3);
  halo.addColorStop(0, "rgba(191,169,130,.08)");
  halo.addColorStop(1, "rgba(191,169,130,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(x - radius * 2.3, y - radius * 2.3, radius * 4.6, radius * 4.6);
  const moon = ctx.createRadialGradient(width * .117, height * .135, 0, width * .14, height * .16, width * .05);
  moon.addColorStop(0, "#46536b");
  moon.addColorStop(1, "#0a1529");
  ctx.fillStyle = moon;
  ctx.beginPath();
  ctx.arc(width * .13, height * .15, width * .029, 0, Math.PI * 2);
  ctx.fill();
  drawSaturn(ctx, x, y, radius);
  ctx.restore();
}

/** Shared foreground/background ring composition; no simulation state. */
export function drawSaturn(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  ctx.save();
  // Rings behind the globe, clipped cloud bands, then the visible front arc.
  const rings = (front: boolean) => {
    for (const [scale, color, line] of [[1.8, "rgba(187,169,132,.24)", 7], [1.58, "rgba(216,199,159,.34)", 3]] as const) {
      ctx.strokeStyle = color;
      ctx.lineWidth = line;
      ctx.beginPath();
      ctx.ellipse(x, y, radius * scale, radius * .43, -.3, 0, front ? Math.PI : Math.PI * 2);
      ctx.stroke();
    }
  };
  rings(false);
  const planet = ctx.createRadialGradient(x - radius * .4, y - radius * .4, 0, x + radius * .35, y + radius * .2, radius * 1.65);
  planet.addColorStop(0, "#a69b7e");
  planet.addColorStop(.45, "#706957");
  planet.addColorStop(1, "#12233c");
  ctx.fillStyle = planet;
  ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.clip();
  ctx.translate(x, y); ctx.rotate(-.16);
  for (let i = -3; i <= 3; i++) {
    ctx.fillStyle = i % 2 ? "rgba(207,185,139,.09)" : "rgba(18,32,48,.13)";
    ctx.fillRect(-radius, i * radius * .23, radius * 2, radius * .1);
  }
  ctx.restore();
  rings(true);
  ctx.strokeStyle = "rgba(189,204,200,.16)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(x, y, radius, Math.PI * .9, Math.PI * 1.7); ctx.stroke();
  ctx.restore();
}
