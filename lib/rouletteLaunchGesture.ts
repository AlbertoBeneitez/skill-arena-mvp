/** Launcher swipe: quantized direction and power only. The ball always starts at the launcher. */
import { rouletteTossAction } from "./verified/galacticRouletteProtocol.v3";
import { ROULETTE_BALL_DOCK } from "./rouletteGesture";
export { ROULETTE_BALL_DOCK };
type Point = Readonly<{ x: number; y: number }>;
export const rouletteLauncherCanGrab = (p: Point) =>
  Math.hypot(p.x - ROULETTE_BALL_DOCK.x, p.y - ROULETTE_BALL_DOCK.y) <= 48;
export function rouletteLauncherToss(from: Point, to: Point) {
  if (![from.x, from.y, to.x, to.y].every(Number.isFinite) || !rouletteLauncherCanGrab(from)) return null;
  const dx = to.x - from.x,
    dy = to.y - from.y,
    distance = Math.hypot(dx, dy);
  if (distance < 28) return null;
  const direction = Math.round((((Math.atan2(dy, dx) + Math.PI * 2) % (Math.PI * 2)) * 32) / (Math.PI * 2)) % 32;
  const impulse = Math.max(0, Math.min(15, Math.round((distance - 24) / 12)));
  return [rouletteTossAction(direction, impulse)] as const;
}
