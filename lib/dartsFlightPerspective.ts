/** Read-only camera projection; the frozen V3 core owns impact, timing and scoring. */
import {
  DARTS_RULES_V3,
  dartsReticleV3,
  type DartsStateV3,
} from "./verified/dartsCore.v3";
import type { DartPose } from "./dartsPresentation";
const camera = {
  x: 195,
  y: 285,
  focal: 640,
  near: 1.2,
  distance: 10,
  duration: 1,
  gravity: 9.81,
};
const releaseY = ((camera.y - 550) * camera.near) / camera.focal;
/** Solve one ballistic arc between release and authoritative impact, then project 3D. */
export function dartPerspectiveFlight(
  x: number,
  y: number,
  age: number,
): DartPose {
  const p = Math.max(0, Math.min(1, age / DARTS_RULES_V3.impactTicks));
  const depth = camera.near + (camera.distance - camera.near) * p;
  const endX = ((x - camera.x) * camera.distance) / camera.focal;
  const endY = ((camera.y - y) * camera.distance) / camera.focal;
  const worldX = endX * p;
  const worldY =
    releaseY +
    (endY - releaseY) * p +
    (camera.gravity * camera.duration ** 2 * p * (1 - p)) / 2;
  const dz = camera.distance - camera.near;
  const dy =
    endY - releaseY + (camera.gravity * camera.duration ** 2 * (1 - 2 * p)) / 2;
  const sx = (camera.focal * (endX * depth - worldX * dz)) / depth ** 2;
  const sy = (-camera.focal * (dy * depth - worldY * dz)) / depth ** 2;
  return {
    x: p === 1 ? x : camera.x + (camera.focal * worldX) / depth,
    y: p === 1 ? y : camera.y - (camera.focal * worldY) / depth,
    angle: Math.atan2(sy, sx) + Math.PI / 2,
    // Minimum silhouette is an accessibility choice, never a hitbox or trajectory change.
    scale: Math.max(0.22, (1.35 * camera.near) / depth),
  };
}
export function dartPerspectivePose(
  s: Readonly<DartsStateV3>,
): DartPose | null {
  if (s.phase === "aim") {
    const r = dartsReticleV3(s);
    return dartPerspectiveFlight(195 + r.x / 1000, 285 + r.y / 1000, 0);
  }
  const hit = s.impacts.at(-1);
  return hit && !hit.timeout && s.phaseTicks < 132
    ? dartPerspectiveFlight(
        195 + hit.x / 1000,
        285 + hit.y / 1000,
        s.phaseTicks,
      )
    : null;
}
