import {
  ALIEN_DASH_CORE_V3 as core,
  type AlienStateV3,
} from "../lib/verified/alienDashCore.v3";
import { applyCoreInput, stepCore } from "../lib/verified/coreRuntime.v1";
import { chooseAlienAction } from "./alien-play-fixture";
/** Test steering uses the real core for predictions, never another integrator. */
function nearDamage(state: AlienStateV3, action: string | null) {
  const next = structuredClone(state);
  if (action && core.canApply(next, action))
    applyCoreInput(core, next, action, 1e9);
  for (let tick = 0; tick < 30 && next.status === "running"; tick++)
    stepCore(core, next, 1e9);
  return state.lives - next.lives;
}
export function chooseAlienActionV3(s: AlienStateV3): string | null {
  let action = chooseAlienAction(s);
  if (!action && s.supportId !== null && core.canApply(s, "JUMP")) {
    const support = s.actors.find((a) => a.id === s.supportId)!;
    const next = s.actors.find(
      (a) =>
        a.kind === "platform" &&
        a.x >= support.x + support.width &&
        a.x - support.x - support.width <= 140000,
    );
    const untilEdge =
      (support.x - s.scroll + support.width - 78000) / (s.speed / 120);
    if (next && untilEdge <= 20 && untilEdge >= 0) action = "JUMP";
  }
  if (
    action &&
    core.canApply(s, action) &&
    nearDamage(s, action) > nearDamage(s, null)
  )
    return null;
  return action;
}
