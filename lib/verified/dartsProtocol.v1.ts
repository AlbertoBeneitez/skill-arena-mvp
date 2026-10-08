/** Two independently quantized axes, 5 px steps, versioned and replayable. */
export function dartsAimAction(axis: "X" | "Y", index: number) {
  return `AIM_${axis}_${String(index).padStart(2, "0")}`;
}
export const DARTS_ACTIONS = [
  ...Array.from({ length: 61 }, (_, i) => dartsAimAction("X", i)),
  ...Array.from({ length: 61 }, (_, i) => dartsAimAction("Y", i)),
  "THROW",
] as const;
