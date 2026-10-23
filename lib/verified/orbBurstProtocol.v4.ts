/** V4 vocabulary: V3 plus the three stored powers the player chooses between. */
import { ORB_ACTIONS_V3 } from "./orbBurstProtocol.v3";
export { ORB_AIM_COUNT, orbAimAction } from "./orbBurstProtocol.v1";
export const ORB_ACTIONS_V4 = Object.freeze([
  ...ORB_ACTIONS_V3,
  "POWER_BOMB",
  "POWER_LIGHTNING",
  "POWER_RAINBOW",
]);
