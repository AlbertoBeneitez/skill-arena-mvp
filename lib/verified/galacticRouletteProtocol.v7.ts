/** V7 protocol: V6 plus chip denominations (1, 5, 25) chosen before placing chips. */
import { ROULETTE_ACTIONS_V6 } from "./galacticRouletteProtocol.v6";
export const ROULETTE_DENOMINATIONS = [1, 5, 25] as const;
export const ROULETTE_ACTIONS_V7 = [
  ...ROULETTE_ACTIONS_V6,
  ...ROULETTE_DENOMINATIONS.map((d) => `CHIP_${d}`),
] as const;
