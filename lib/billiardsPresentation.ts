import type { LogicalCanvasViewport } from "./gameCanvas";

export type BilliardsViewPoint = { x: number; y: number };
export type BilliardsCamera = {
  centerX: number;
  centerY: number;
  scale: number;
  rotated: boolean;
};

// Includes the existing table frame's stroke, not competitive collision bounds.
export const BILLIARDS_TABLE_VIEW_BOUNDS = {
  left: 22,
  right: 368,
  top: 74,
  bottom: 525,
} as const;
const worldCenterX = 195;
const worldCenterY = 299.5;

/** Pure visual framing; physical coordinates, core and input tokens stay intact. */
export function getBilliardsCamera(
  viewport: LogicalCanvasViewport,
  cssScale = 1,
): BilliardsCamera {
  if (viewport.width <= viewport.height) {
    return {
      centerX: viewport.width / 2,
      centerY: worldCenterY,
      scale: 1,
      rotated: false,
    };
  }
  // The existing 90px controls need their 20px right inset and a clear gap.
  // cssScale is supplied from the cached logical frame transform, never a DOM
  // read. Inputs use this same camera; DPR cannot change the physical core.
  const controlPane = Math.max(viewport.width * 0.25, 120 / cssScale);
  const playWidth = viewport.width - controlPane;
  const top = 72;
  const bottom = viewport.height - 50;
  return {
    centerX: playWidth / 2,
    centerY: (top + bottom) / 2,
    scale: Math.min(
      (playWidth - 48) /
        (BILLIARDS_TABLE_VIEW_BOUNDS.bottom - BILLIARDS_TABLE_VIEW_BOUNDS.top),
      (bottom - top) /
        (BILLIARDS_TABLE_VIEW_BOUNDS.right - BILLIARDS_TABLE_VIEW_BOUNDS.left),
    ),
    rotated: true,
  };
}

export function projectBilliardsPoint(
  camera: BilliardsCamera,
  point: BilliardsViewPoint,
): BilliardsViewPoint {
  const x = point.x - worldCenterX;
  const y = point.y - worldCenterY;
  return camera.rotated
    ? {
        x: camera.centerX + y * camera.scale,
        y: camera.centerY - x * camera.scale,
      }
    : {
        x: camera.centerX + x * camera.scale,
        y: camera.centerY + y * camera.scale,
      };
}

export function unprojectBilliardsPoint(
  camera: BilliardsCamera,
  point: BilliardsViewPoint,
): BilliardsViewPoint {
  const x = (point.x - camera.centerX) / camera.scale;
  const y = (point.y - camera.centerY) / camera.scale;
  return camera.rotated
    ? { x: worldCenterX - y, y: worldCenterY + x }
    : { x: worldCenterX + x, y: worldCenterY + y };
}

export function applyBilliardsCamera(
  ctx: CanvasRenderingContext2D,
  camera: BilliardsCamera,
) {
  ctx.translate(camera.centerX, camera.centerY);
  if (camera.rotated) ctx.rotate(-Math.PI / 2);
  ctx.scale(camera.scale, camera.scale);
  ctx.translate(-worldCenterX, -worldCenterY);
}
