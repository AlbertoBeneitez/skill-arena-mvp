/** V1 aim/power/shoot actions plus an explicit, replayable choice of bird type. */
import { BIRDS_ACTIONS } from "./galacticBirdsProtocol.v1";
export const BIRDS_SELECT_ACTIONS = ["BIRD_SCOUT", "BIRD_DART", "BIRD_METEOR"] as const;
export const BIRDS_ACTIONS_V2 = [...BIRDS_ACTIONS, ...BIRDS_SELECT_ACTIONS] as const;
