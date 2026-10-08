import {
  JET_STREAM_CORE_V3 as core,
  type JetStreamV3State,
} from "../lib/verified/jetStreamCore.v3";
import { JET_STREAM_V1 } from "../lib/verified/jetStreamCore.v1";
export function shouldFlapJet(s: JetStreamV3State): boolean {
  if (!core.canApply(s, "FLAP")) return false;
  if (s.launchedAtTick === null) return s.tick >= 240;
  const gate = s.gates.find(
    (g) =>
      g.worldXMilli - s.scrollMilli + JET_STREAM_V1.gateWidth >=
      JET_STREAM_V1.playerX - JET_STREAM_V1.playerRadius,
  );
  const desired = gate?.centerYMilli ?? 305000;
  return s.yMilli > desired + 25000 && s.vyMilliPerSecond > 0;
}
