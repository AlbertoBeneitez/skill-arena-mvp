/** V6 protocol: V3 plus CASH_OUT (the player stops the game and keeps the balance). */
import { ROULETTE_ACTIONS_V3 } from "./galacticRouletteProtocol.v3";
export const ROULETTE_ACTIONS_V6 = [...ROULETTE_ACTIONS_V3, "CASH_OUT"] as const;
