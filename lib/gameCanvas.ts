export type CanvasViewportMetrics = {
  dpr: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  cssWidth: number;
  cssHeight: number;
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
  maxDevicePixelRatio = 2
): CanvasViewportMetrics {
  const rect = canvas.getBoundingClientRect();
  const cssWidth = Math.max(1, rect.width || logicalWidth);
  const cssHeight = Math.max(1, rect.height || logicalHeight);
  const dpr = Math.min(
    maxDevicePixelRatio,
    Math.max(1, window.devicePixelRatio || 1)
  );

  const pixelWidth = Math.max(1, Math.round(cssWidth * dpr));
  const pixelHeight = Math.max(1, Math.round(cssHeight * dpr));

  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }

  const scale = Math.min(
    cssWidth / logicalWidth,
    cssHeight / logicalHeight
  );

  return {
    dpr,
    scale,
    offsetX: (cssWidth - logicalWidth * scale) / 2,
    offsetY: (cssHeight - logicalHeight * scale) / 2,
    cssWidth,
    cssHeight,
  };
}

export function beginLogicalCanvasFrame(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  metrics: CanvasViewportMetrics
) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(
    metrics.dpr * metrics.scale,
    0,
    0,
    metrics.dpr * metrics.scale,
    metrics.dpr * metrics.offsetX,
    metrics.dpr * metrics.offsetY
  );
}
