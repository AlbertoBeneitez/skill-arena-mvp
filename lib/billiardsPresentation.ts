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
    // v123: the table fills the width (up to 1.1×) and the table + its strip below are centred in the free height
    // under the HUD line; the logical viewport grows with tall phones (expand-vertical).
    const w = BILLIARDS_TABLE_VIEW_BOUNDS.right - BILLIARDS_TABLE_VIEW_BOUNDS.left;
    const h = BILLIARDS_TABLE_VIEW_BOUNDS.bottom - BILLIARDS_TABLE_VIEW_BOUNDS.top;
    const hud = 48, strip = 78;
    const scale = Math.min((viewport.width - 12) / w, (viewport.height - hud - strip - 8) / h, 1.1);
    const top = hud + Math.max(0, (viewport.height - hud - strip - h * scale) / 2);
    return {
      centerX: viewport.width / 2,
      centerY: top + (worldCenterY - BILLIARDS_TABLE_VIEW_BOUNDS.top) * scale,
      scale,
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

/** Screen y just below the drawn table frame (portrait), where the power bar and the level strip go. */
export function billiardsTableBottom(camera: BilliardsCamera) {
  return camera.centerY + (BILLIARDS_TABLE_VIEW_BOUNDS.bottom - worldCenterY) * camera.scale;
}
