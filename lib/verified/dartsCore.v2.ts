import { DARTS_CORE } from "./dartsCore.v1";
export { dartsDrift } from "./dartsCore.v1";
/** V2 versions the swipe input contract; V1 physics/replay stays immutable. */
export const DARTS_CORE_V2 = {
  ...DARTS_CORE,
  gameVersion: "2.0.0",
  content: {
    base: DARTS_CORE.content,
    control:
      "aim-during-drag;upward-release-from-lower-area;minimum48-logical-pixels;no-throw-button",
  },
};
