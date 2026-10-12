import assert from "node:assert/strict";
import { SLOT_CORE as core } from "../lib/verified/galacticSlotCore.v1";
import {
  applyCoreInput,
  advanceCoreToTick,
} from "../lib/verified/coreRuntime.v1";
import {
  slotVisibleSteps,
  slotReelPosition,
  slotMachineLayout,
  SLOT_ORDER_PREVIEW_TICKS,
} from "../lib/slotPresentation";
for (let reel = 0; reel < 3; reel++) {
  const s = core.create(`slot-zero-${reel}`);
  applyCoreInput(core, s, `REEL_${reel}_LESS`, 1e9);
  assert.equal(s.steps[reel], 8);
  assert.equal(slotVisibleSteps(s.steps[reel]), 0);
  advanceCoreToTick(core, s, 3, 1e9);
  const before = [...s.positions];
  applyCoreInput(core, s, "SPIN", 1e9);
  for (let tick = 0; tick < 360; tick += 17) {
    advanceCoreToTick(core, s, 3 + tick, 1e9);
    const copy = structuredClone(s);
    assert.equal(
      slotReelPosition(s, reel),
      before[reel],
      "zero stays visually still while other reels spin",
    );
    assert.deepEqual(s, copy);
  }
  advanceCoreToTick(core, s, 363, 1e9);
  assert.equal(
    s.positions[reel],
    before[reel],
    "zero returns to its authoritative original symbol",
  );
}
assert.equal(SLOT_ORDER_PREVIEW_TICKS, 10 * core.tickRate);
assert.equal(slotMachineLayout(1199).top, 350);
assert.equal(slotMachineLayout(1242).top, 146);
assert.equal(slotMachineLayout(1242).height, 276);
console.log(
  "Slot presentation: 10-second tick boundary, unchanged authoritative zero-wrap, stationary reel, read-only layout and motion",
);
