export const PHALANX_ACTIONS = [
  "FIRE_DOWN",
  "FIRE_UP",
  ...Array.from({ length: 36 }, (_, i) => `AIM_${String(i).padStart(3, "0")}`),
] as const;
