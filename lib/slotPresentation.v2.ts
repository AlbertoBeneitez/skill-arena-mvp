import type { SlotState } from "./verified/galacticSlotCore.v1";
export {SLOT_ORDER_PREVIEW_TICKS, slotMachineLayout} from "./slotPresentation";
export const slotVisibleSteps = (steps: number) => steps > 0 ? `+${steps}` : String(steps);
export function slotReelPosition(s: Readonly<SlotState>, reel: number) {
  if (s.settlingAt === -1) return s.positions[reel];
  const t = Math.max(0, Math.min(1, (s.tick - s.spinStart) / (120 + reel * 30)));
  return s.from[reel] + s.steps[reel] * (1 - (1 - t) ** 3);
}
