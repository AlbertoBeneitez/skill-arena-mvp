/** Pullback input revision; V1/V2 physics and historical replays stay frozen. */
import { BILLIARDS_CORE_V2, type BilliardsV2State } from "./billiardsCore.v2";
import { billiardsDirection } from "./billiardsCore.v1";
import { BILLIARDS_AIM_COUNT, billiardsAimAction } from "./billiardsProtocol.v1";
import { roundDiv } from "../deterministic/integerMath";
import type { GameCore } from "./coreRuntime.v1";
export const billiardsPowerActionV3 = (power: number) => `POWER_${String(power).padStart(2, "0")}`;
export const BILLIARDS_ACTIONS_V3 = [
  ...Array.from({length: BILLIARDS_AIM_COUNT}, (_, i) => billiardsAimAction(i)),
  ...Array.from({length: 13}, (_, i) => billiardsPowerActionV3(i)), "SHOOT",
] as const;
export const BILLIARDS_CORE_V3: GameCore<BilliardsV2State> = {
  ...BILLIARDS_CORE_V2,
  gameVersion: "3.0.0",
  actions: BILLIARDS_ACTIONS_V3,
  inputVersion: 2,
  content: {
    inheritedArena: BILLIARDS_CORE_V2.content,
    input: "CUE_OR_SHAFT_GRAB_PULL_BACK_DIRECTION_AND_RELEASE",
    speed: { minimum: 1500, increment: 150, maximumPower: 12 },
  },
  create(seed) { return {...BILLIARDS_CORE_V2.create(seed), power: 6}; },
  canApply(s, action) {
    if (s.status !== "running" || s.phase !== "aim" || !BILLIARDS_ACTIONS_V3.includes(action)) return false;
    if (action.startsWith("AIM_")) return s.aim !== Number(action.slice(4));
    if (action.startsWith("POWER_")) return s.power !== Number(action.slice(6));
    return s.shotsLeft > 0;
  },
  apply(s, action) {
    if (action.startsWith("AIM_")) { s.aim = Number(action.slice(4)); return; }
    if (action.startsWith("POWER_")) { s.power = Number(action.slice(6)); return; }
    const power = s.power;
    // Reuse the archived shot bookkeeping, then apply this version's speed.
    s.power = 1;
    BILLIARDS_CORE_V2.apply(s, "SHOOT");
    s.power = power;
    const direction = billiardsDirection(s.aim), speed = 1500 + power * 150;
    s.balls[0].vx = roundDiv(direction.x * speed, direction.length);
    s.balls[0].vy = roundDiv(direction.y * speed, direction.length);
  },
};
