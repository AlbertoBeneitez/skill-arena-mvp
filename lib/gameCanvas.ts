export type CanvasViewportPolicy = "contain" | "expand-horizontal";
export type LogicalCanvasViewport = { width: number; height: number };

export type CanvasViewportMetrics = {
  dpr: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  cssWidth: number;
  cssHeight: number;
  logicalWidth: number;
  logicalHeight: number;
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
  const scale = Math.min(cssWidth / renderWidth, cssHeight / logicalHeight);

  return {
    dpr,
    scale,
    offsetX: (cssWidth - renderWidth * scale) / 2,
    offsetY: (cssHeight - logicalHeight * scale) / 2,
    cssWidth,
    cssHeight,
    logicalWidth: renderWidth,
    logicalHeight,
  };
}

export function beginLogicalCanvasFrame(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  metrics: CanvasViewportMetrics,
) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(
    metrics.dpr * metrics.scale,
    0,
    0,
    metrics.dpr * metrics.scale,
    metrics.dpr * metrics.offsetX,
    metrics.dpr * metrics.offsetY,
  );
}
