/** One eighth-turn per step; full animation turns cannot change an outcome. */
export const SLOT_ACTIONS = [
  "REEL_0_MORE",
  "REEL_0_LESS",
  "REEL_1_MORE",
  "REEL_1_LESS",
  "REEL_2_MORE",
  "REEL_2_LESS",
  "SPIN",
] as const;
