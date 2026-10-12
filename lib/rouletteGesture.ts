import { rouletteLaunchAction } from "./verified/galacticRouletteProtocol.v1";
export const ROULETTE_BALL_DOCK = Object.freeze({ x: 323, y: 330 });
type Point = Readonly<{ x: number; y: number }>;
export function rouletteBallCanGrab(p: Point) {
  return (
    Math.abs(p.x - ROULETTE_BALL_DOCK.x) <= 70 &&
    Math.abs(p.y - ROULETTE_BALL_DOCK.y) <= 70
  );
}
/** Gesture emits the same pinned power/direction protocol, never a client result. */
export function rouletteDragLaunch(from: Point, to: Point) {
  if (
    ![from.x, from.y, to.x, to.y].every(Number.isFinite) ||
    !rouletteBallCanGrab(from)
  )
    return null;
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  if (distance < 28 || Math.hypot(to.x - 195, to.y - 195) > 145) return null;
  const power = Math.max(
    0,
    Math.min(63, Math.round(((distance - 28) * 63) / 220)),
  );
  const cross = (from.x - 195) * (to.y - 195) - (from.y - 195) * (to.x - 195);
  return rouletteLaunchAction(power, cross >= 0 ? 1 : -1);
}
