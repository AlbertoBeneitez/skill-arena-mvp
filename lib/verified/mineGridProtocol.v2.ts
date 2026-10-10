import type { MinePublicView } from "./mineGridProtocol.v1";
/** Same OPEN/FLAG actions; private projection removes product levels. */
export type MinePublicViewV2 = Omit<MinePublicView, "stage" | "levels"> &
  Readonly<{ reach: number }>;
