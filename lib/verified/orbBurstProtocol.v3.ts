/** V3 vocabulary: the V1 aiming set plus SWAP (choose between the loaded and the next orb). */
import { ORB_ACTIONS as ORB_ACTIONS_V1 } from "./orbBurstProtocol.v1";
export { ORB_AIM_COUNT, orbAimAction } from "./orbBurstProtocol.v1";
export const ORB_ACTIONS_V3 = Object.freeze([...ORB_ACTIONS_V1, "SWAP"]);
