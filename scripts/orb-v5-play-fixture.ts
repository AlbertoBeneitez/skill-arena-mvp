/** Test-only bot: visible cells + the official forecast; it may SWAP when the other orb scores better. */
import { applyCoreInput, stepCore } from "../lib/verified/coreRuntime.v1";
import type { ReplayInput } from "../lib/verified/inputValidation";
import {
  ORB_BURST_CORE_V5 as core,
  applyOrbV5,
  copyOrbV5State,
  forecastOrbV5,
  type OrbV5State,
} from "../lib/verified/orbBurstCore.v5";
function value(state: OrbV5State, aim: number) {
  const f = forecastOrbV5(state, aim).state;
  if (f.status === "failed") return -1e12;
  return (f.height - state.height) * 100000 - (f.lastLanding?.row ?? 0) * 10 - f.pressureRows * 1000 + f.bubbles.length * -1;
}
export function bestOrbChoiceV5(state: OrbV5State, allowSwap = true) {
  let best: { aim: number; swap: boolean; power: string | null; v: number } = { aim: state.aimIndex, swap: false, power: null, v: -Infinity };
  for (let aim = 0; aim < 89; aim += 2) {
    const v = value(state, aim);
    if (v > best.v) best = { aim, swap: false, power: null, v };
  }
  if (allowSwap && core.canApply(state, "SWAP")) {
    const swapped = copyOrbV5State(state);
    applyOrbV5(swapped, "SWAP");
    for (let aim = 0; aim < 89; aim += 2) {
      const v = value(swapped, aim) - 500;
      if (v > best.v) best = { aim, swap: true, power: null, v };
    }
  }
  if (allowSwap)
    for (const power of ["POWER_RAINBOW", "POWER_BOMB", "POWER_LIGHTNING"]) {
      if (!core.canApply(state, power)) continue;
      const boosted = copyOrbV5State(state);
      applyOrbV5(boosted, power);
      for (let aim = 0; aim < 89; aim += 2) {
        const v = value(boosted, aim) - 800;
        if (v > best.v) best = { aim, swap: false, power, v };
      }
    }
  return best;
}
export function playOrbV5(seed: string, maxShots = 60, allowSwap = true, target = 108) {
  const s = core.create(seed),
    inputs: ReplayInput[] = [];
  const push = (action: string) => {
    if (!core.canApply(s, action)) return;
    inputs.push({ seq: inputs.length, tick: s.tick, action });
    applyCoreInput(core, s, action, target);
  };
  let shots = 0;
  const queue: string[] = [];
  while (s.status === "running" && s.tick < core.maxFinalTick - 400) {
    if (!queue.length && !s.shot) {
      if (shots >= maxShots) break;
      const c = bestOrbChoiceV5(s, allowSwap);
      if (c.swap) queue.push("SWAP");
      if (c.power) queue.push(c.power);
      queue.push(`AIM_${String(c.aim).padStart(3, "0")}`, "SHOOT");
      shots++;
    }
    // One input per tick: the replay contract rejects two inputs in the same tick.
    if (queue.length && !s.shot && inputs.at(-1)?.tick !== s.tick) {
      const action = queue[0];
      if (core.canApply(s, action)) {
        push(action);
      } else if (action.startsWith("AIM_") && s.aimIndex === Number(action.slice(4))) {
        // already aimed there
      }
      queue.shift();
    }
    stepCore(core, s, target);
  }
  return { s, inputs, shots };
}
