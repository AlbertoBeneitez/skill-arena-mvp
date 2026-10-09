import type { LogicalCanvasViewport } from "@/lib/gameCanvas";

/** A camera, never a larger competitive field of view or another simulation. */
export type AlienCamera = {
  scale: number;
  left: number;
  top: number;
  minY: number;
  maxY: number;
  horizontal: boolean;
};

export function alienCamera(
  viewport: LogicalCanvasViewport,
  cssScale: number,
): AlienCamera {
  if (viewport.width <= viewport.height)
    return { scale: 1, left: (viewport.width - 390) / 2, top: 0, minY: 0, maxY: 620, horizontal: false };
  // The existing two 90px controls have right:18px. Keep 12px clearance from
  // their entire column, plus a readable 40px HUD strip and 8px bottom margin.
  const leftMargin = 12 / cssScale;
  const rightMargin = 120 / cssScale;
  const topMargin = 40 / cssScale;
  const bottomMargin = 8 / cssScale;
  const availableWidth = Math.max(1, viewport.width - leftMargin - rightMargin);
  const availableHeight = Math.max(
    1,
    viewport.height - topMargin - bottomMargin,
  );
  const scale = Math.min(availableWidth / 390, availableHeight / 275);
  return {
    scale,
    left: leftMargin + (availableWidth - 390 * scale) / 2,
    top: topMargin + (availableHeight - 275 * scale) / 2,
    minY: 300,
    maxY: 575,
    horizontal: true,
  };
}

/** Shared canvas DPR is capped at 2; this reads drawing state, not DOM layout. */
export function alienCssScale(ctx: CanvasRenderingContext2D): number {
  const dpr = Math.min(
    2,
    Math.max(1, typeof window === "undefined" ? 1 : window.devicePixelRatio || 1),
  );
  return ctx.getTransform().a / dpr;
}

/** Recover the common frame after render's save/restore for the death finale. */
export function alienCanvasViewport(
  ctx: CanvasRenderingContext2D,
): LogicalCanvasViewport {
  const matrix = ctx.getTransform();
  return {
    width: (ctx.canvas.width - matrix.e * 2) / matrix.a,
    height: (ctx.canvas.height - matrix.f * 2) / matrix.d,
  };
}

export function withAlienCamera(
  ctx: CanvasRenderingContext2D,
  viewport: LogicalCanvasViewport,
  draw: () => void,
): AlienCamera {
  const camera = alienCamera(viewport, alienCssScale(ctx));
  ctx.save();
  try {
    ctx.translate(camera.left, camera.top);
    ctx.scale(camera.scale, camera.scale);
    ctx.translate(0, -camera.minY);
    ctx.beginPath();
    // Exactly the same X field of view on every orientation/device.
    ctx.rect(0, camera.minY, 390, camera.maxY - camera.minY);
    ctx.clip();
    draw();
  } finally {
    ctx.restore();
  }
  return camera;
}
