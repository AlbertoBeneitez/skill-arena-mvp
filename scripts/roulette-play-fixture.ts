import {
  ROULETTE_CORE as core,
  type RouletteState,
} from "../lib/verified/galacticRouletteCore.v1";
import { applyCoreInput, stepCore } from "../lib/verified/coreRuntime.v1";
import type { ReplayInput } from "../lib/verified/inputValidation";
export function playRoulette(seed: string, lose = false) {
  const s = core.create(seed),
    inputs: ReplayInput[] = [];
  function action(a: string) {
    inputs.push({ seq: inputs.length, tick: s.tick, action: a });
    if (!applyCoreInput(core, s, a, 1e9))
      throw new Error(`INPUT ${a} ${s.tick}`);
  }
  while (s.status === "running") {
    if (s.tick + 603 > 21600) {
      stepCore(core, s, 1e9);
      continue;
    }
    const predicted: RouletteState = JSON.parse(JSON.stringify(s));
    applyCoreInput(core, predicted, "BET_RED", 1e9);
    for (let t = 0; t < 3; t++) stepCore(core, predicted, 1e9);
    applyCoreInput(core, predicted, "LAUNCH_CW_00", 1e9);
    for (let t = 0; t < 600; t++) stepCore(core, predicted, 1e9);
    const n = lose ? (predicted.lastNumber! + 1) % 37 : predicted.lastNumber!;
    action(`BET_NUMBER_${String(n).padStart(2, "0")}`);
    for (let t = 0; t < 3; t++) stepCore(core, s, 1e9);
    action("LAUNCH_CW_00");
    for (let t = 0; t < 600 && s.status === "running"; t++)
      stepCore(core, s, 1e9);
  }
  return { s, inputs };
}
