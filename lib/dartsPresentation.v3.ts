/** Read-only 10m flight: fixed one-second travel, perspective and gravity arc. */
import {
  DARTS_RULES_V3,
  dartsReticleV3,
  type DartsStateV3,
} from "./verified/dartsCore.v3";
import type { DartPose } from "./dartsPresentation";
const launch = { x: 195, y: 550 };
export function dartFlightPoseV3(x: number, y: number, age: number): DartPose {
  const p = Math.max(0, Math.min(1, age / DARTS_RULES_V3.impactTicks)),
    q = (2 * p) / (1 + p),
    dq = 2 / (1 + p) ** 2;
  const arc = 75;
  const vx = (x - launch.x) * dq,
    vy = (y - launch.y) * dq - 4 * arc * (1 - 2 * p);
  return {
    x: launch.x + (x - launch.x) * q,
    y: launch.y + (y - launch.y) * q - 4 * arc * p * (1 - p),
    angle: Math.atan2(vy, vx) + Math.PI / 2,
    scale: 1.35 / (1 + 1.7 * p),
  };
}
export function dartPresentationPoseV3(
  s: Readonly<DartsStateV3>,
): DartPose | null {
  if (s.phase === "aim") {
    const r = dartsReticleV3(s);
    return {
      x: 195,
      y: 550,
      angle: Math.atan2(285 + r.y / 1000 - 550, r.x / 1000) + Math.PI / 2,
      scale: 1.35,
    };
  }
  const hit = s.impacts.at(-1);
  return hit && !hit.timeout && s.phaseTicks < 132
    ? dartFlightPoseV3(195 + hit.x / 1000, 285 + hit.y / 1000, s.phaseTicks)
    : null;
}
