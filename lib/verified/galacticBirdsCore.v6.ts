/** Selectable birds and minimum structural support; V1-V5 remain frozen. */
import { roundDiv } from "../deterministic/integerMath";
import {
  BIRDS_PROJECTILES,
  type BirdKind,
  type BirdsBody,
} from "./galacticBirdsCore.v4";
import {
  BIRDS_CORE_V5 as base,
  type BirdsV5State,
} from "./galacticBirdsCore.v5";
import {
  BIRDS_ACTIONS_V2,
  BIRDS_SELECT_ACTIONS,
} from "./galacticBirdsProtocol.v2";
import type { GameCore } from "./coreRuntime.v1";

export const BIRDS_V6_RULES = Object.freeze({
  ammunitionPerKind: 10,
  minimumSupportRatioPerMille: 180,
  minimumSupportMilli: 8_000,
  maximumRequiredSupportMilli: 32_000,
  supportVerticalToleranceMilli: 2_000,
  balanceMarginMilli: 3_000,
  unstableSlideMilliPerTick: 420,
  unstableImpulseMilliPerTick: 48,
});

export type BirdsV6State = BirdsV5State & {
  selectedKind: BirdKind;
  remaining: Record<BirdKind, number>;
  unstableContacts: number;
};

const selectedKindFor = (action: string): BirdKind | null => {
  if (action === "SELECT_SCOUT") return "scout";
  if (action === "SELECT_DART") return "dart";
  if (action === "SELECT_METEOR") return "meteor";
  return null;
};

function mergeIntervals(intervals: Array<[number, number]>) {
  intervals.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged: Array<[number, number]> = [];
  for (const interval of intervals) {
    const previous = merged.at(-1);
    if (!previous || interval[0] > previous[1]) merged.push([...interval]);
    else previous[1] = Math.max(previous[1], interval[1]);
  }
  return merged;
}

export function bodySupport(
  body: Readonly<BirdsBody>,
  bodies: readonly Readonly<BirdsBody>[],
) {
  const left = body.x - body.w / 2,
    right = body.x + body.w / 2,
    bottom = body.y + body.h / 2;
  const intervals: Array<[number, number]> = [];
  for (const candidate of bodies) {
    if (!candidate.alive || candidate.id === body.id) continue;
    const top = candidate.y - candidate.h / 2;
    if (
      Math.abs(bottom - top) >
      BIRDS_V6_RULES.supportVerticalToleranceMilli
    )
      continue;
    const overlapLeft = Math.max(left, candidate.x - candidate.w / 2),
      overlapRight = Math.min(right, candidate.x + candidate.w / 2);
    if (overlapRight > overlapLeft)
      intervals.push([overlapLeft, overlapRight]);
  }
  const merged = mergeIntervals(intervals),
    width = merged.reduce((total, [a, b]) => total + b - a, 0),
    hullLeft = merged.length ? merged[0][0] : 0,
    hullRight = merged.length ? merged.at(-1)![1] : 0,
    required = Math.max(
      BIRDS_V6_RULES.minimumSupportMilli,
      Math.min(
        BIRDS_V6_RULES.maximumRequiredSupportMilli,
        roundDiv(body.w * BIRDS_V6_RULES.minimumSupportRatioPerMille, 1000),
      ),
    );
  return { width, hullLeft, hullRight, required };
}

/** Prevent a body from remaining upright on a physically negligible edge. */
export function enforceMinimumSupport(state: BirdsV6State) {
  for (const body of state.bodies) {
    if (!body.alive || body.y + body.h / 2 >= 559_000) continue;
    const support = bodySupport(body, state.bodies);
    if (!support.width) continue;
    const balanced =
      body.x >= support.hullLeft + BIRDS_V6_RULES.balanceMarginMilli &&
      body.x <= support.hullRight - BIRDS_V6_RULES.balanceMarginMilli;
    if (support.width >= support.required && balanced) continue;
    const supportCenter = (support.hullLeft + support.hullRight) / 2,
      direction = body.x < supportCenter ? -1 : 1;
    body.x += direction * BIRDS_V6_RULES.unstableSlideMilliPerTick;
    body.vx += direction * BIRDS_V6_RULES.unstableImpulseMilliPerTick;
    body.vy = Math.max(body.vy, 48);
    state.unstableContacts++;
  }
}

function nextAvailable(state: BirdsV6State) {
  const order: BirdKind[] = ["scout", "dart", "meteor"];
  return order.find((kind) => state.remaining[kind] > 0) ?? "scout";
}

export const BIRDS_CORE_V6: GameCore<BirdsV6State> = {
  ...base,
  gameVersion: "6.0.0",
  inputVersion: 2,
  actions: BIRDS_ACTIONS_V2,
  content: {
    base: base.content,
    selection: "PLAYER_SELECTS_ANY_REMAINING_ARCHETYPE_BEFORE_RELEASE",
    support: BIRDS_V6_RULES,
    projectiles: BIRDS_PROJECTILES,
  },
  create(seed) {
    const state = base.create(seed);
    return {
      ...state,
      // V5 freezes its generated queue. V6 records the selected kind at each
      // shot index so the archived collision kernel can consume it unchanged.
      queue: Array.from({ length: 30 }, () => "scout" as BirdKind),
      selectedKind: "scout",
      remaining: {
        scout: BIRDS_V6_RULES.ammunitionPerKind,
        dart: BIRDS_V6_RULES.ammunitionPerKind,
        meteor: BIRDS_V6_RULES.ammunitionPerKind,
      },
      unstableContacts: 0,
    };
  },
  canApply(state, action) {
    const kind = selectedKindFor(action);
    if (kind)
      return (
        state.status === "running" &&
        state.phase === "aim" &&
        state.remaining[kind] > 0 &&
        state.selectedKind !== kind
      );
    return base.canApply(state, action);
  },
  apply(state, action) {
    const selected = selectedKindFor(action);
    if (selected) {
      state.selectedKind = selected;
      return;
    }
    if (action === "SHOOT") {
      if (state.remaining[state.selectedKind] <= 0) return;
      (state.queue as BirdKind[])[state.shots] = state.selectedKind;
      state.remaining[state.selectedKind]--;
    }
    base.apply(state, action);
    if (
      action === "SHOOT" &&
      state.remaining[state.selectedKind] === 0
    )
      state.selectedKind = nextAvailable(state);
  },
  step(state) {
    base.step(state);
    if (state.status === "running") enforceMinimumSupport(state);
  },
};

export { BIRDS_SELECT_ACTIONS };
