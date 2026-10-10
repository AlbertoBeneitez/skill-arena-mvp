/** Shared presentation transform. It never changes competitive coordinates. */
export type CanvasViewPoint = { x: number; y: number };
export type CanvasCamera = {
  centerX: number;
  centerY: number;
  worldCenterX: number;
  worldCenterY: number;
  scale: number;
  rotation: number;
};

export function projectCanvasPoint(
  camera: CanvasCamera,
  point: CanvasViewPoint,
): CanvasViewPoint {
  const x = point.x - camera.worldCenterX;
  const y = point.y - camera.worldCenterY;
  // Keep the existing zero/quarter-turn arithmetic exact for archived UI inputs.
  if (camera.rotation === -Math.PI / 2)
    return {
      x: camera.centerX + y * camera.scale,
      y: camera.centerY - x * camera.scale,
    };
  if (camera.rotation === 0)
    return {
      x: camera.centerX + x * camera.scale,
      y: camera.centerY + y * camera.scale,
    };
  const cos = Math.cos(camera.rotation),
    sin = Math.sin(camera.rotation);
  return {
    x: camera.centerX + (x * cos - y * sin) * camera.scale,
    y: camera.centerY + (x * sin + y * cos) * camera.scale,
  };
}

export function unprojectCanvasPoint(
  camera: CanvasCamera,
  point: CanvasViewPoint,
): CanvasViewPoint {
  const x = (point.x - camera.centerX) / camera.scale;
  const y = (point.y - camera.centerY) / camera.scale;
  if (camera.rotation === -Math.PI / 2)
    return { x: camera.worldCenterX - y, y: camera.worldCenterY + x };
  if (camera.rotation === 0)
    return { x: camera.worldCenterX + x, y: camera.worldCenterY + y };
  const cos = Math.cos(camera.rotation),
    sin = Math.sin(camera.rotation);
  return {
    x: camera.worldCenterX + x * cos + y * sin,
    y: camera.worldCenterY - x * sin + y * cos,
  };
}

export function applyCanvasCamera(
  ctx: CanvasRenderingContext2D,
  camera: CanvasCamera,
) {
  ctx.translate(camera.centerX, camera.centerY);
  if (camera.rotation !== 0) ctx.rotate(camera.rotation);
  ctx.scale(camera.scale, camera.scale);
  ctx.translate(-camera.worldCenterX, -camera.worldCenterY);
}
