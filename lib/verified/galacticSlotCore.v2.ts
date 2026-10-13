/** Signed short reel movements; all-zero wagers are unavailable. V1 stays frozen. */
import { SLOT_CORE, SLOT_RULES, type SlotState } from "./galacticSlotCore.v1";
import type { GameCore } from "./coreRuntime.v1";
export const SLOT_CORE_V2: GameCore<SlotState> = {
  ...SLOT_CORE,
  gameVersion: "2.0.0",
  inputVersion: 2,
  content: {base: SLOT_CORE.content, steps: [-3,-2,-1,0,1,2,3], zeroWager: "FORBIDDEN", spinTicks: 180},
  canApply(s, a) {
    if (s.status !== "running" || s.settlingAt !== -1 || s.tick - s.lastInputTick < SLOT_RULES.inputCooldown || !SLOT_CORE.actions.includes(a)) return false;
    if (a === "SPIN") return s.steps.some(step => step !== 0) && s.balanceMinor >= 500 && s.tick + 180 <= SLOT_RULES.maxFinalTick;
    const reel = Number(a[5]);
    return a.endsWith("MORE") ? s.steps[reel] < 3 : s.steps[reel] > -3;
  },
  apply(s, a) {
    if (a === "SPIN") {
      SLOT_CORE.apply(s, a);
      s.destinations = s.positions.map((p, i) => (p + s.steps[i] + 8) % 8);
      s.settlingAt = s.tick + 180;
    } else {
      s.lastInputTick = s.tick;
      s.steps[Number(a[5])] += a.endsWith("MORE") ? 1 : -1;
    }
  },
};
