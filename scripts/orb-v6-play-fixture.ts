/** Test-only bots for Orb Burst V6. "smart" tries every aim on a copy and keeps the best landing. */
import { applyCoreInput, stepCore } from "../lib/verified/coreRuntime.v1";
import type { ReplayInput } from "../lib/verified/inputValidation";
import { ORB_BURST_CORE_V6 as core, copyOrbV6State, type OrbV6State } from "../lib/verified/orbBurstCore.v6";
import { orbAimAction } from "../lib/verified/orbBurstProtocol.v1";

function outcome(state: OrbV6State, aim: number) {
  const s = copyOrbV6State(state);
  s.aimIndex = aim;
  applyCoreInput(core, s, "SHOOT", 1e9);
  let guard = 0;
  while (s.shot && s.status === "running" && guard++ < 2000) stepCore(core, s, 1e9);
  return s.points - state.points + (s.misses === 0 && s.rowsAdded > state.rowsAdded ? -50 : 0) - (s.misses > state.misses ? 5 : 0);
}
export function playOrbV6(seed: string, mode: "smart" | "random" | "idle" = "smart", maxShots = 400, target = 1e9) {
  const s = core.create(seed), inputs: ReplayInput[] = [];
  let shots = 0, step = 0;
  const send = (a: string) => {
    if (!core.canApply(s, a)) return false;
    inputs.push({ seq: inputs.length, tick: s.tick, action: a });
    applyCoreInput(core, s, a, target);
    return true;
  };
  while (s.status === "running") {
    if (mode !== "idle" && !s.shot && s.settleRemaining === 0 && shots < maxShots && step++ % 3 === 0) {
      let aim = (shots * 37) % 89;
      if (mode === "smart") {
        let best = -1e9;
        for (let a = 0; a < 89; a += 2) { const v = outcome(s, a); if (v > best) { best = v; aim = a; } }
      }
      if (s.aimIndex !== aim) send(orbAimAction(aim));
      else if (send("SHOOT")) shots++;
    }
    stepCore(core, s, target);
  }
  return { s, inputs };
}
