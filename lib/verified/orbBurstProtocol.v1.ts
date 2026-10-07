/** Frozen closed input vocabulary; registry and core share this light metadata. */
export const ORB_AIM_COUNT = 89;
export const ORB_ACTIONS = Object.freeze([
  ...Array.from(
    { length: ORB_AIM_COUNT },
    (_, i) => `AIM_${String(i).padStart(3, "0")}`,
  ),
  "AIM_LEFT",
  "AIM_RIGHT",
  "SHOOT",
]);
export function orbAimAction(index: number) {
  if (!Number.isInteger(index) || index < 0 || index >= ORB_AIM_COUNT)
    throw new Error("INVALID_ORB_AIM");
  return ORB_ACTIONS[index];
}
