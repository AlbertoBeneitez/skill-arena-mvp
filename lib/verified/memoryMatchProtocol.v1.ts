/** Stable card identities: visual layout and viewport never enter the protocol. */
export const MEMORY_ACTIONS = [
  "FLIP_0",
  "FLIP_1",
  "FLIP_2",
  "FLIP_3",
  "FLIP_4",
  "FLIP_5",
  "FLIP_6",
  "FLIP_7",
  "FLIP_8",
  "FLIP_9",
  "FLIP_10",
  "FLIP_11",
  "FLIP_12",
  "FLIP_13",
  "FLIP_14",
  "FLIP_15",
  "FLIP_16",
  "FLIP_17",
  "FLIP_18",
  "FLIP_19",
  "FLIP_20",
  "FLIP_21",
  "FLIP_22",
  "FLIP_23",
] as const;

export type MemoryAction = (typeof MEMORY_ACTIONS)[number];

export function memoryFlipAction(index: number): MemoryAction | null {
  return Number.isInteger(index) && index >= 0 && index < MEMORY_ACTIONS.length
    ? MEMORY_ACTIONS[index]
    : null;
}
