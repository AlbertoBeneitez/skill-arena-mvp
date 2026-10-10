import type { LogicalCanvasViewport } from "./gameCanvas";
import {
  applyCanvasCamera,
  projectCanvasPoint,
  unprojectCanvasPoint,
  type CanvasCamera,
} from "./canvasCamera";

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
const sharedCamera = (camera: BilliardsCamera): CanvasCamera => ({
  ...camera,
  worldCenterX,
  worldCenterY,
  rotation: camera.rotated ? -Math.PI / 2 : 0,
});

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
  return projectCanvasPoint(sharedCamera(camera), point);
}

export function unprojectBilliardsPoint(
  camera: BilliardsCamera,
  point: BilliardsViewPoint,
): BilliardsViewPoint {
  return unprojectCanvasPoint(sharedCamera(camera), point);
}

export function applyBilliardsCamera(
  ctx: CanvasRenderingContext2D,
  camera: BilliardsCamera,
) {
  applyCanvasCamera(ctx, sharedCamera(camera));
}
