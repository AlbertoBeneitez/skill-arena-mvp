export type DartsGesturePoint = { x: number; y: number };
/** Client input translation only. Server still validates/replays AIM and THROW. */
export function isDartsThrowGesture(
  start: DartsGesturePoint,
  end: DartsGesturePoint,
) {
  const up = start.y - end.y;
  return start.y >= 400 && up >= 34 && up > Math.abs(end.x - start.x) * 0.9;
}
