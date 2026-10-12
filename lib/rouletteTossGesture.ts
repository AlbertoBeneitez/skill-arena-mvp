import { rouletteTossAction } from "./verified/galacticRouletteProtocol.v2";
import { ROULETTE_BALL_DOCK } from "./rouletteGesture";
export { ROULETTE_BALL_DOCK };
type Point = Readonly<{ x: number; y: number }>;
export const rouletteTossCanGrab = (p: Point) =>
  Math.hypot(p.x - 323, p.y - 330) <= 44;
export function rouletteHandToss(from: Point, to: Point) {
  if (
    ![from.x, from.y, to.x, to.y].every(Number.isFinite) ||
    !rouletteTossCanGrab(from)
  )
    return null;
  const dx = to.x - from.x,
    dy = to.y - from.y,
    distance = Math.hypot(dx, dy);
  if (distance < 28 || to.x < 0 || to.x > 390 || to.y < 0 || to.y > 400)
    return null;
  const direction =
    Math.round(
      (((Math.atan2(dy, dx) + Math.PI * 2) % (Math.PI * 2)) * 32) /
        (Math.PI * 2),
    ) % 32;
  const impulse = Math.max(0, Math.min(15, Math.round((distance - 24) / 12)));
  return [
    `RELEASE_X_${String(Math.min(39, Math.round(to.x / 10))).padStart(2, "0")}`,
    `RELEASE_Y_${String(Math.min(40, Math.round(to.y / 10))).padStart(2, "0")}`,
    rouletteTossAction(direction, impulse),
  ] as const;
}
