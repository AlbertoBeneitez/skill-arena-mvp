import type { LogicalCanvasViewport } from "./gameCanvas";
import {
  applyCanvasCamera,
  projectCanvasPoint,
  unprojectCanvasPoint,
  type CanvasCamera,
} from "./canvasCamera";

// The complete existing competitive field, including the launcher and next orb.
export const ORB_VIEW_BOUNDS = {
  left: 0,
  right: 390,
  top: 0,
  bottom: 620,
} as const;
export type OrbCamera = CanvasCamera;

export function getOrbCamera(
  viewport: LogicalCanvasViewport,
  cssScale = 1,
): OrbCamera {
  if (viewport.width <= viewport.height)
    return {
      centerX: viewport.width / 2,
      centerY: 310,
      worldCenterX: 195,
      worldCenterY: 310,
      scale: 1,
      rotation: 0,
    };
  // Touch release launches directly. Use the full field without a button pane.
  const playWidth = viewport.width;
  const top = Math.max(52, 44 / cssScale);
  const bottom = viewport.height - Math.max(28, 20 / cssScale);
  return {
    centerX: playWidth / 2,
    centerY: (top + bottom) / 2,
    worldCenterX: 195,
    worldCenterY: 310,
    scale: Math.min((playWidth - 40) / 620, (bottom - top) / 390),
    rotation: -Math.PI / 2,
  };
}

export const projectOrbPoint = projectCanvasPoint;
export const unprojectOrbPoint = unprojectCanvasPoint;
export const applyOrbCamera = applyCanvasCamera;
