/**
 * Billiards V5 slingshot input (client translation only; the core receives AIM_xxx / POWER_xx / SHOOT as before).
 * The pull can start ANYWHERE on the screen, not only on the cue: the shot goes in the direction from the finger back
 * to where it touched down, and the pull length sets the power. A ball against a cushion or in a corner no longer
 * needs room behind it — start the pull wherever there is space. World coordinates (table px).
 */
import { billiardsAimAction } from "./verified/billiardsProtocol.v1";
import { billiardsPowerActionV3 } from "./verified/billiardsCore.v3";
type Point = Readonly<{ x: number; y: number }>;
export const BILLIARDS_SLING = Object.freeze({ deadZone: 14, pxPerPower: 8, maxPower: 12 });
export function pullBilliardsSling(from: Point, to: Point) {
  if (![from.x, from.y, to.x, to.y].every(Number.isFinite)) return null;
  const dx = from.x - to.x, dy = from.y - to.y, pull = Math.hypot(dx, dy);
  if (pull < BILLIARDS_SLING.deadZone) return null;
  const angle = (Math.atan2(dy, dx) + Math.PI * 2) % (Math.PI * 2);
  const aim = Math.round((angle * 180) / (Math.PI * 2)) % 180;
  const power = Math.max(0, Math.min(BILLIARDS_SLING.maxPower, Math.round((pull - BILLIARDS_SLING.deadZone) / BILLIARDS_SLING.pxPerPower)));
  return [billiardsAimAction(aim), billiardsPowerActionV3(power)] as const;
}
