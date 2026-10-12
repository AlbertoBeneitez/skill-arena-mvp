import type { SlotState } from "./verified/galacticSlotCore.v1";
export const SLOT_ORDER_PREVIEW_TICKS = 1200;
/** Eight positions is an exact full wrap; its user-facing value is zero. */
export const slotVisibleSteps = (steps: number) => steps % 8;
export function slotReelPosition(s: Readonly<SlotState>, reel: number) {
  if (s.settlingAt === -1) return s.positions[reel];
  if (slotVisibleSteps(s.steps[reel]) === 0) return s.from[reel];
  return (
    s.from[reel] +
    (24 + reel * 8 + s.steps[reel]) *
      (1 - Math.pow(1 - Math.min(1, (s.tick - s.spinStart) / 360), 3))
  );
}
export function slotMachineLayout(tick: number) {
  const t = Math.max(0, Math.min(1, (tick - SLOT_ORDER_PREVIEW_TICKS) / 42));
  const ease = 1 - (1 - t) ** 3;
  return {
    top: 350 - 204 * ease,
    height: 108 + 168 * ease,
    center: 405 - 121 * ease,
    pitch: 65 + 55 * ease,
    symbolSize: 62 + 22 * ease,
    tableY: 286 - 222 * ease,
  };
}
