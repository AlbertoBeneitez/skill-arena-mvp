import { applyCoreInput, stepCore, type GameCore } from "../lib/verified/coreRuntime.v1";
import {
  RIVER_DASH_CORE as core,
  RIVER_ACTIONS,
  riverLaneRects,
  type RiverState,
} from "../lib/verified/riverDashCore.v1";
import type { ReplayInput } from "../lib/verified/inputValidation";
/** Test/QA beam search. No solver is shipped in the game/client core. */
export function planRiverCrossing(initial: RiverState, padding = 0, driver: GameCore<RiverState> = core) {
  const safe = (state: RiverState) => {
    if (!padding) return true;
    const left = state.xMilli - 11000 - padding, right = state.xMilli + 11000 + padding;
    if (left < 0 || right > 360000) return false;
    const lane = state.lanes[state.row], rects = riverLaneRects(state,state.row);
    return lane.kind === "safe" || (lane.kind === "river"
      ? rects.some(r => left >= r.xMilli && right <= r.xMilli+r.wMilli)
      : !rects.some(r => right > r.xMilli && left < r.xMilli+r.wMilli));
  };
  const target = initial.score + 1250 + (initial.crossings + 1) * 150;
  let frontier: { state: RiverState; inputs: ReplayInput[] }[] = [
    { state: initial, inputs: [] },
  ];
  for (let depth = 0; depth < 120; depth++) {
    const next: typeof frontier = [],
      seen = new Set<string>();
    for (const node of frontier)
      for (const action of [...RIVER_ACTIONS, null]) {
        const state: RiverState = {
          ...node.state,
          lanes: node.state.lanes.map((l) => ({ ...l })),
        };
        let inputs = node.inputs;
        if (action) {
          if (!driver.canApply(state, action)) continue;
          inputs = [
            ...inputs,
            { seq: inputs.length, tick: state.tick, action },
          ];
          applyCoreInput(driver, state, action, target);
        }
        if (state.status === "won") return { state, inputs };
        if (!safe(state)) continue;
        for (let step = 0; step < 16 && state.status === "running"; step++)
          stepCore(driver, state, target);
        if (state.status !== "running" || !safe(state)) continue;
        const key = `${state.row}:${Math.round(state.xMilli / 1000)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        next.push({ state, inputs });
      }
    next.sort(
      (a, b) =>
        a.state.row - b.state.row ||
        Math.abs(a.state.xMilli - 180000) - Math.abs(b.state.xMilli - 180000),
    );
    frontier = next.slice(0, 192);
    if (!frontier.length) break;
  }
  throw new Error("No fixture route found");
}
