import assert from "node:assert/strict";
import { SLOT_CORE_V3 as core } from "../lib/verified/galacticSlotCore.v3";
import { applyCoreInput, replayCore, stepCore } from "../lib/verified/coreRuntime.v1";
assert.equal(core.gameVersion, "3.0.0");
const s = core.create("slot3");
const inputs: { seq: number; tick: number; action: string }[] = [];
for (let i = 0; i < 30; i++) stepCore(core, s, 1e9);
const send = (a: string) => { assert.equal(applyCoreInput(core, s, a, 1e9), true, a); inputs.push({ seq: inputs.length, tick: s.tick, action: a }); for (let i = 0; i < 30; i++) stepCore(core, s, 1e9); };
while (s.steps[0] < 4) send("REEL_0_MORE");
assert.equal(s.steps[0], 4);
assert.equal(core.canApply(s, "REEL_0_MORE"), false, "+5 is not available");
while (s.steps[1] > -4) send("REEL_1_LESS");
assert.equal(s.steps[1], -4);
assert.equal(core.canApply(s, "REEL_1_LESS"), false, "-5 is not available");
const before = s.positions.slice();
send("SPIN");
while (s.settlingAt !== -1) stepCore(core, s, 1e9);
assert.equal(s.positions[0], (before[0] + 4) % 8);
assert.equal(s.positions[1], (before[1] - 4 + 8) % 8);
const t = core.create("slot3");
let k = 0;
while (t.tick < s.tick) {
  while (k < inputs.length && inputs[k].tick === t.tick) applyCoreInput(core, t, inputs[k++].action, 1e9);
  stepCore(core, t, 1e9);
}
assert.deepEqual(t, s);
const full = replayCore(core, [], core.maxFinalTick, "slot3", 1e9);
assert.equal(full.valid, true);
console.log("Slot V3 OK: ±4 steps, deterministic replay");
