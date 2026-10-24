import {
  prepareSpaceCanvasBackdrop,
  type SpaceBackdropViewport,
} from "./spaceBackdrop";

export type CanvasViewportPolicy = "contain" | "expand-horizontal" | "expand-vertical";
/** `top` is the logical y of the canvas top edge (≤ 0 when a letterboxed canvas has free rows above the play area). */
export type LogicalCanvasViewport = { width: number; height: number; top?: number };

export type CanvasViewportMetrics = {
  dpr: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  cssWidth: number;
  cssHeight: number;
  logicalWidth: number;
  logicalHeight: number;
  /** Cached visual mapping only; competitive/input coordinates stay unchanged. */
  backdropViewport: SpaceBackdropViewport;
};

/**
 * Configure a responsive canvas while preserving a game's logical aspect ratio.
 *
 * CSS may stretch the canvas element to fill the available game surface; this
 * helper keeps competitive/presentation coordinates in a stable logical space
 * and letterboxes inside the physical canvas when the aspect ratios differ.
 */
export function configureLogicalCanvas(
  canvas: HTMLCanvasElement,
  logicalWidth: number,
  logicalHeight: number,
  maxDevicePixelRatio = 2,
  policy: CanvasViewportPolicy = "contain",
): CanvasViewportMetrics {
  const rect = canvas.getBoundingClientRect();
  const cssWidth = Math.max(1, rect.width || logicalWidth);
  const cssHeight = Math.max(1, rect.height || logicalHeight);
  const dpr = Math.min(
    maxDevicePixelRatio,
    Math.max(1, window.devicePixelRatio || 1),
  );

  const pixelWidth = Math.max(1, Math.round(cssWidth * dpr));
  const pixelHeight = Math.max(1, Math.round(cssHeight * dpr));

  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }

  // Opt-in visual space only: signed core dimensions and simulation stay fixed.
  // Wider canvases keep the same vertical scale instead of adding side bars.
  const renderWidth =
    policy === "expand-horizontal"
      ? Math.max(logicalWidth, (cssWidth / cssHeight) * logicalHeight)
      : logicalWidth;
  // "expand-vertical": taller screens get extra logical rows at the bottom
  // (content stays top-anchored) so the play surface reaches the screen edge.
  const tall = policy === "expand-vertical" && cssHeight / cssWidth > logicalHeight / logicalWidth;
  const renderHeight = tall ? (cssHeight / cssWidth) * logicalWidth : logicalHeight;
  const scale = Math.min(cssWidth / renderWidth, cssHeight / renderHeight);

  return {
    dpr,
    scale,
    offsetX: (cssWidth - renderWidth * scale) / 2,
    offsetY: tall ? 0 : (cssHeight - logicalHeight * scale) / 2,
    cssWidth,
    cssHeight,
    logicalWidth: renderWidth,
    logicalHeight: renderHeight,
    backdropViewport: {
      left: rect.left ?? 0,
      top: rect.top ?? 0,
      cssWidth,
      cssHeight,
      viewportWidth: Math.max(1, window.innerWidth ?? cssWidth),
      viewportHeight: Math.max(1, window.innerHeight ?? cssHeight),
    },
  };
}

export function beginLogicalCanvasFrame(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  metrics: CanvasViewportMetrics,
) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  prepareSpaceCanvasBackdrop(ctx, metrics.backdropViewport);
  ctx.setTransform(
    metrics.dpr * metrics.scale,
    0,
    0,
    metrics.dpr * metrics.scale,
    metrics.dpr * metrics.offsetX,
    metrics.dpr * metrics.offsetY,
  );
}
