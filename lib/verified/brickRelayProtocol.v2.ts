import { BRICK_ACTIONS } from "./brickRelayProtocol.v1";
export const BRICK_V2_ACTIONS = [
  ...BRICK_ACTIONS,
  "BOOST_DOWN",
  "BOOST_UP",
] as const;
