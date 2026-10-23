import {
  advanceCoreToTick,
  applyCoreInput,
  stepCore,
} from "../lib/verified/coreRuntime.v1";
import {
  RIVER_DASH_V1,
} from "../lib/verified/riverDashCore.v1";
import {
  RIVER_DASH_CORE_V5 as core,
  RIVER_DASH_V5,
  type RiverV5State,
  riverRectsV5,
} from "../lib/verified/riverDashCore.v5";
import type { ReplayInput } from "../lib/verified/inputValidation";

/** Test/QA route search only. Never imported by the client or server core. */
export const RIVER_V5_PRACTICE_TARGET = 1_000_000_000;

type Route = { state: RiverV5State; inputs: ReplayInput[] };

export function cloneRiverV5State(state: RiverV5State): RiverV5State {
  return { ...state, lanes: state.lanes.map((lane) => ({ ...lane })) };
}

function hasMargin(state: RiverV5State, padding: number) {
  if (state.status === "failed") return false;
  const left = state.xMilli - RIVER_DASH_V1.radiusMilli - padding;
  const right = state.xMilli + RIVER_DASH_V1.radiusMilli + padding;
  if (left < 0 || right > RIVER_DASH_V1.widthMilli) return false;
  const lane = state.lanes[state.row];
  if (lane.kind === "safe") return true;
  const rects = riverRectsV5(state, state.row);
  return lane.kind === "river"
    ? rects.some((rect) => left >= rect.xMilli && right <= rect.xMilli + rect.wMilli)
    : !rects.some((rect) => right > rect.xMilli && left < rect.xMilli + rect.wMilli);
}

/** Safe rows are search checkpoints within the same field, not resets/levels. */
function routeToSafeRow(initial: RiverV5State, destination: number, padding: number): Route {
  const start = cloneRiverV5State(initial);
  // A previous checkpoint can be reached on an input tick. Keep its cooldown.
  advanceCoreToTick(
    core,
    start,
    Math.max(start.tick, start.lastMoveTick + RIVER_DASH_V5.inputCooldownTicks),
    RIVER_V5_PRACTICE_TARGET,
  );
  let frontier: Route[] = [{ state: start, inputs: [] }];
  const rank = (node: Route) =>
    -node.state.row * 1_000_000 + Math.abs(node.state.xMilli - 180000);

  for (let depth = 0; depth < 120; depth++) {
    const next: Route[] = [];
    const arrived: Route[] = [];
    const seen = new Set<string>();
    for (const node of frontier) {
      for (const action of ["UP", "LEFT", "RIGHT", "DOWN", null] as const) {
        const state = cloneRiverV5State(node.state);
        let inputs = node.inputs;
        if (action) {
          if (!core.canApply(state, action)) continue;
          if (!applyCoreInput(core, state, action, RIVER_V5_PRACTICE_TARGET)) continue;
          inputs = [...inputs, { seq: inputs.length, tick: state.tick, action }];
        }
        if (!hasMargin(state, padding)) continue;
        if (state.row === destination) {
          arrived.push({ state, inputs });
          continue;
        }
        if (state.status !== "running") continue;
        for (let step = 0; step < RIVER_DASH_V5.inputCooldownTicks && state.status === "running"; step++)
          stepCore(core, state, RIVER_V5_PRACTICE_TARGET);
        if (state.status !== "running" || !hasMargin(state, padding)) continue;
        const key = `${state.row}:${Math.round(state.xMilli / 750)}:${state.height}`;
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
  throw new Error(`No continuous River V5 route ${initial.row}->${destination} at tick ${initial.tick}`);
}

/** Replan a bounded next safe landing from the last actually observed QA tick. */
export function planRiverV5NextSafe(initial: RiverV5State, padding = 10000): Route {
  if (initial.status !== "running") return { state: cloneRiverV5State(initial), inputs: [] };
  let destination = initial.row + 1;
  while (initial.lanes[destination].kind !== "safe") destination++;
  
  return routeToSafeRow(initial, destination, padding);
}

/** Bounded test pilot, not a game endpoint or a client solver. */
export function planRiverV5Run(initial: RiverV5State, reach = 120, padding = 1500): Route {
  let state = cloneRiverV5State(initial);
  const inputs: ReplayInput[] = [];
  while (state.status === "running" && state.height < reach) {
    const leg = planRiverV5NextSafe(state, padding);
    inputs.push(...leg.inputs.map((input, index) => ({ ...input, seq: inputs.length + index })));
    state = leg.state;
    if (inputs.length > core.maxInputs) throw new Error("River V5 fixture exceeds input limit");
  }
  if (state.status !== "running") throw new Error(`River V5 pilot stopped early: ${state.failure}`);
  return { state, inputs };
}
