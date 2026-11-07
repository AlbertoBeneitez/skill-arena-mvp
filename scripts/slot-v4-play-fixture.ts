/** Test-only Slot V4 player: "greedy" reads the visible strips and aims for the best payout; "plain" spins +1/+1/+1. */
import { applyCoreInput, stepCore } from "../lib/verified/coreRuntime.v1";
import type { ReplayInput } from "../lib/verified/inputValidation";
import { SLOT_CORE_V4 as core, SLOT_MAX_STEP_V4, SLOT_STOPS_V4, slotPayoutV4 } from "../lib/verified/galacticSlotCore.v4";
export function playSlotV4(seed: string, mode: "greedy" | "plain", spins = 40) {
  const s = core.create(seed), inputs: ReplayInput[] = [];
  const send = (a: string) => {
    for (let guard = 0; !core.canApply(s, a) && guard < 400 && s.status === "running"; guard++) stepCore(core, s, 1e9);
    if (!core.canApply(s, a)) return false;
    inputs.push({ seq: inputs.length, tick: s.tick, action: a });
    applyCoreInput(core, s, a, 1e9);
    return true;
  };
  for (let n = 0; n < spins && s.status === "running"; n++) {
    let target = [1, 1, 1];
    if (mode === "greedy") {
      let best = -1;
      const range = [-3, -2, -1, 0, 1, 2, 3];
      for (const a of range) for (const b of range) for (const c of range) {
        if (!a && !b && !c) continue;
        const pay = slotPayoutV4([a, b, c].map((d, i) => s.strips[i][(s.positions[i] + d + SLOT_STOPS_V4) % SLOT_STOPS_V4]));
        if (pay > best) { best = pay; target = [a, b, c]; }
      }
    }
    for (let i = 0; i < 3; i++) {
      while (s.steps[i] < target[i] && s.steps[i] < SLOT_MAX_STEP_V4) if (!send(`REEL_${i}_MORE`)) break;
      while (s.steps[i] > target[i]) if (!send(`REEL_${i}_LESS`)) break;
    }
    if (!send("SPIN")) break;
  }
  while (s.status === "running" && s.tick < core.maxFinalTick) stepCore(core, s, 1e9);
  return { s, inputs };
}
