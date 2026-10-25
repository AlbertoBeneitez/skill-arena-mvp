/** Galactic Bowling V1 input protocol. A throw is AIM (start position) + ANGLE + SPIN + POWER, then ROLL. */
export const BOWLING_AIM_STEPS = 21;
export const BOWLING_ANGLE_STEPS = 25;
export const BOWLING_SPIN_STEPS = 9;
export const BOWLING_POWER_STEPS = 9;
const pad = (n: number) => String(n).padStart(2, "0");
export const BOWLING_ACTIONS_V1 = Object.freeze([
  ...Array.from({ length: BOWLING_AIM_STEPS }, (_, i) => `AIM_${pad(i)}`),
  ...Array.from({ length: BOWLING_ANGLE_STEPS }, (_, i) => `ANGLE_${pad(i)}`),
  ...Array.from({ length: BOWLING_SPIN_STEPS }, (_, i) => `SPIN_${i}`),
  ...Array.from({ length: BOWLING_POWER_STEPS }, (_, i) => `POWER_${i}`),
  "ROLL",
  "SKIP",
]) as readonly string[];
export const bowlingAction = (kind: "AIM" | "ANGLE" | "SPIN" | "POWER", value: number) =>
  kind === "SPIN" || kind === "POWER" ? `${kind}_${value}` : `${kind}_${pad(value)}`;
