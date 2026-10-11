/** Quantized sling direction/power; physics never receives screen coordinates. */
export function birdsAimAction(n: number) {
  return `AIM_${String(n).padStart(2, "0")}`;
}
export function birdsPowerAction(n: number) {
  return `POWER_${String(n).padStart(2, "0")}`;
}
export const BIRDS_ACTIONS = [
  ...Array.from({ length: 61 }, (_, n) => birdsAimAction(n)),
  ...Array.from({ length: 13 }, (_, n) => birdsPowerAction(n)),
  "ANGLE_UP",
  "ANGLE_DOWN",
  "POWER_UP",
  "POWER_DOWN",
  "SHOOT",
] as const;
