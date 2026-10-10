/** Presentation input quantization, never competitive simulation. */
export type StickDirection = "UP" | "DOWN" | "LEFT" | "RIGHT" | "STOP";
export function stickDirection(
  x: number,
  y: number,
  previous: StickDirection,
): StickDirection {
  if (Math.hypot(x, y) < 0.2) return "STOP";
  // Axis hysteresis keeps diagonal finger jitter from alternating turns.
  if (
    (previous === "LEFT" || previous === "RIGHT") &&
    Math.abs(x) * 1.25 >= Math.abs(y)
  )
    return x < 0 ? "LEFT" : "RIGHT";
  if (
    (previous === "UP" || previous === "DOWN") &&
    Math.abs(y) * 1.25 >= Math.abs(x)
  )
    return y < 0 ? "UP" : "DOWN";
  return Math.abs(x) > Math.abs(y)
    ? x < 0
      ? "LEFT"
      : "RIGHT"
    : y < 0
      ? "UP"
      : "DOWN";
}
