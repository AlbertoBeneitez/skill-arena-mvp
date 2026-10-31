/**
 * Galactic Bowling input protocol V2 (Bowling V3): finer and wider throw controls. A throw is still AIM (start
 * position) + ANGLE + SPIN + POWER, then ROLL; ANGLE has 49 steps (centre 24) and SPIN 17 steps (centre 8), so a
 * small difference in the gesture now changes the throw. V1 stays frozen for Bowling V1/V2.
 */
export const BOWLING_V2_AIM_STEPS = 21;
export const BOWLING_V2_ANGLE_STEPS = 49;
export const BOWLING_V2_SPIN_STEPS = 17;
export const BOWLING_V2_POWER_STEPS = 9;
export const BOWLING_V2_ANGLE_CENTRE = 24;
export const BOWLING_V2_SPIN_CENTRE = 8;
const pad = (n: number) => String(n).padStart(2, "0");
export const BOWLING_ACTIONS_V2 = Object.freeze([
  ...Array.from({ length: BOWLING_V2_AIM_STEPS }, (_, i) => `AIM_${pad(i)}`),
  ...Array.from({ length: BOWLING_V2_ANGLE_STEPS }, (_, i) => `ANGLE_${pad(i)}`),
  ...Array.from({ length: BOWLING_V2_SPIN_STEPS }, (_, i) => `SPIN_${pad(i)}`),
  ...Array.from({ length: BOWLING_V2_POWER_STEPS }, (_, i) => `POWER_${i}`),
  "ROLL",
  "SKIP",
]) as readonly string[];
export const bowlingActionV2 = (kind: "AIM" | "ANGLE" | "SPIN" | "POWER", value: number) =>
  kind === "POWER" ? `${kind}_${value}` : `${kind}_${pad(value)}`;
