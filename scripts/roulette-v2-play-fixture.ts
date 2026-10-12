import {
  ROULETTE_CORE_V2 as core,
  type RouletteStateV2,
} from "../lib/verified/galacticRouletteCore.v2";
import { rouletteTossAction } from "../lib/verified/galacticRouletteProtocol.v2";
import { stepCore, applyCoreInput } from "../lib/verified/coreRuntime.v1";
import type { ReplayInput } from "../lib/verified/inputValidation";
export function rouletteTossTrial(
  s: RouletteStateV2,
  d = 20,
  p = 8,
  delay = 0,
) {
  const trial: RouletteStateV2 = JSON.parse(JSON.stringify(s));
  for (let t = 0; t < delay; t++) stepCore(core, trial, 1e9);
  if (!applyCoreInput(core, trial, rouletteTossAction(d, p), 1e9))
    throw Error("trial toss");
  while (trial.status === "running" && trial.landingTick !== -1)
    stepCore(core, trial, 1e9);
  return trial;
}
export function playRouletteV2(seed: string, loss = false) {
  const s = core.create(seed),
    inputs: ReplayInput[] = [];
  while (s.status === "running") {
    if (s.landingTick !== -1 || s.tick + 724 > core.maxFinalTick) {
      stepCore(core, s, 1e9);
      continue;
    }
    if (loss) {
      const action = rouletteTossAction(0, 0);
      if (!core.canApply(s, action)) {
        stepCore(core, s, 1e9);
        continue;
      }
      inputs.push({ seq: inputs.length, tick: s.tick, action });
      applyCoreInput(core, s, action, 1e9);
      stepCore(core, s, 1e9);
      continue;
    }
    const n = rouletteTossTrial(s, 20, 8, 3).lastNumber;
    const action = `BET_NUMBER_${String(n ?? 0).padStart(2, "0")}`;
    if (!applyCoreInput(core, s, action, 1e9)) throw Error("bet");
    inputs.push({ seq: inputs.length, tick: s.tick, action });
    for (let t = 0; t < 3; t++) stepCore(core, s, 1e9);
    const toss = rouletteTossAction(20, 8);
    inputs.push({ seq: inputs.length, tick: s.tick, action: toss });
    if (!applyCoreInput(core, s, toss, 1e9)) throw Error("toss");
    stepCore(core, s, 1e9);
  }
  return { s, inputs };
}
