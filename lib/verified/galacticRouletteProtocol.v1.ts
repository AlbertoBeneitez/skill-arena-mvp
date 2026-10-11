/** Every launch and bet is a bounded, versioned token, never a client result. */
export const ROULETTE_BETS = [
  "RED",
  "BLACK",
  "EVEN",
  "ODD",
  "LOW",
  "HIGH",
  "DOZEN_1",
  "DOZEN_2",
  "DOZEN_3",
  ...Array.from(
    { length: 37 },
    (_, n) => `NUMBER_${String(n).padStart(2, "0")}`,
  ),
] as const;
export function rouletteLaunchAction(power: number, direction: 1 | -1) {
  return `LAUNCH_${direction === 1 ? "CW" : "CCW"}_${String(power).padStart(2, "0")}`;
}
export const ROULETTE_ACTIONS = [
  ...ROULETTE_BETS.map((b) => `BET_${b}`),
  ...Array.from({ length: 64 }, (_, p) => rouletteLaunchAction(p, 1)),
  ...Array.from({ length: 64 }, (_, p) => rouletteLaunchAction(p, -1)),
] as const;
