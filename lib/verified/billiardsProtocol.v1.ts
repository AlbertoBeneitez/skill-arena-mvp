/** Versioned integer aim and power tokens; no arbitrary client vector/score. */
export const BILLIARDS_AIM_COUNT = 180;
export function billiardsAimAction(index: number) {
  return `AIM_${String(index).padStart(3, "0")}`;
}
export const BILLIARDS_ACTIONS = [
  ...Array.from({ length: BILLIARDS_AIM_COUNT }, (_, i) =>
    billiardsAimAction(i),
  ),
  "POWER_LOW",
  "POWER_MEDIUM",
  "POWER_HIGH",
  "SHOOT",
] as const;
