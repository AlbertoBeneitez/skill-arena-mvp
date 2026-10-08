export const BRICK_ACTIONS = [
  ...Array.from({ length: 79 }, (_, i) => `AIM_${String(i).padStart(3, "0")}`),
  "LEFT",
  "RIGHT",
] as const;
