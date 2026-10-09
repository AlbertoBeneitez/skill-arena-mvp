import {
  advanceCoreToTick,
  applyCoreInput,
  stepCore,
} from "../lib/verified/coreRuntime.v1";
import {
  RIVER_DASH_V1,
  riverLaneRects,
} from "../lib/verified/riverDashCore.v1";
import {
  RIVER_DASH_CORE_V3 as core,
  RIVER_DASH_V3,
  type RiverV3State,
} from "../lib/verified/riverDashCore.v3";
import type { ReplayInput } from "../lib/verified/inputValidation";

/** Test/QA route search only. Never imported by the client or server core. */
export const RIVER_V3_PRACTICE_TARGET = 1_000_000_000;

type Route = { state: RiverV3State; inputs: ReplayInput[] };

export function cloneRiverV3State(state: RiverV3State): RiverV3State {
  return { ...state, lanes: state.lanes.map((lane) => ({ ...lane })) };
}

function hasMargin(state: RiverV3State, padding: number) {
  if (state.status === "failed") return false;
  const left = state.xMilli - RIVER_DASH_V1.radiusMilli - padding;
  const right = state.xMilli + RIVER_DASH_V1.radiusMilli + padding;
  if (left < 0 || right > RIVER_DASH_V1.widthMilli) return false;
  const lane = state.lanes[state.row];
  if (lane.kind === "safe") return true;
  const rects = riverLaneRects(state, state.row);
  return lane.kind === "river"
    ? rects.some((rect) => left >= rect.xMilli && right <= rect.xMilli + rect.wMilli)
    : !rects.some((rect) => right > rect.xMilli && left < rect.xMilli + rect.wMilli);
}

/** Safe rows are search checkpoints within the same field, not resets/levels. */
function routeToSafeRow(initial: RiverV3State, destination: number, padding: number): Route {
  const start = cloneRiverV3State(initial);
  // A previous checkpoint can be reached on an input tick. Keep its cooldown.
  advanceCoreToTick(
    core,
    start,
    Math.max(start.tick, start.lastMoveTick + RIVER_DASH_V3.inputCooldownTicks),
    RIVER_V3_PRACTICE_TARGET,
  );
  let frontier: Route[] = [{ state: start, inputs: [] }];
  const rank = (node: Route) =>
    node.state.row * 1_000_000 + Math.abs(node.state.xMilli - 180000);

  for (let depth = 0; depth < 120; depth++) {
    const next: Route[] = [];
    const arrived: Route[] = [];
    const seen = new Set<string>();
    for (const node of frontier) {
      for (const action of ["UP", "LEFT", "RIGHT", "DOWN", null] as const) {
        const state = cloneRiverV3State(node.state);
        let inputs = node.inputs;
        if (action) {
          if (!core.canApply(state, action)) continue;
          if (!applyCoreInput(core, state, action, RIVER_V3_PRACTICE_TARGET)) continue;
          inputs = [...inputs, { seq: inputs.length, tick: state.tick, action }];
        }
        if (!hasMargin(state, padding)) continue;
        if (state.row === destination) {
          arrived.push({ state, inputs });
          continue;
        }
        if (state.status !== "running") continue;
        for (let step = 0; step < RIVER_DASH_V3.inputCooldownTicks && state.status === "running"; step++)
          stepCore(core, state, RIVER_V3_PRACTICE_TARGET);
        if (state.status !== "running" || !hasMargin(state, padding)) continue;
        const key = `${state.row}:${Math.round(state.xMilli / 750)}:${state.bestRow}`;
        if (seen.has(key)) continue;
        seen.add(key);
        next.push({ state, inputs });
      }
    }
    if (arrived.length) {
      arrived.sort((a, b) => rank(a) - rank(b) || a.inputs.length - b.inputs.length);
      return arrived[0];
    }
    next.sort((a, b) => rank(a) - rank(b) || a.inputs.length - b.inputs.length);
    frontier = next.slice(0, 64);
    if (!frontier.length) break;
  }
  throw new Error(`No continuous River V3 route ${initial.row}->${destination} at tick ${initial.tick}`);
}

/** Replan a bounded next safe landing from the last actually observed QA tick. */
export function planRiverV3NextSafe(initial: RiverV3State, padding = 10000): Route {
  if (initial.status !== "running") return { state: cloneRiverV3State(initial), inputs: [] };
  let destination = initial.row - 1;
  while (destination > 0 && initial.lanes[destination].kind !== "safe") destination--;
  if (destination < 0) throw new Error("River V3 has no terminal safe row");
  return routeToSafeRow(initial, destination, padding);
}

/** Returns one ordered input record and the complete, unreset terminal state. */
export function planRiverV3Run(initial: RiverV3State, padding = 1500): Route {
  let state = cloneRiverV3State(initial);
  const inputs: ReplayInput[] = [];
  while (state.status === "running") {
    const leg = planRiverV3NextSafe(state, padding);
    inputs.push(...leg.inputs.map((input, index) => ({ ...input, seq: inputs.length + index })));
    state = leg.state;
    if (inputs.length > core.maxInputs) throw new Error("River V3 fixture exceeds input limit");
  }
  if (state.status !== "won" || state.row !== 0)
    throw new Error(`River V3 fixture did not complete the field: ${state.failure}`);
  return { state, inputs };
}
