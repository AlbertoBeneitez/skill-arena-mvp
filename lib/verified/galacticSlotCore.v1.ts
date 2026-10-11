/** Original visible-information puzzle; all amounts are fictitious integer cents. */
import { createRng, seededShuffle } from "../deterministic/seeded";
import { SLOT_ACTIONS } from "./galacticSlotProtocol.v1";
import type { CoreState, GameCore } from "./coreRuntime.v1";
export const SLOT_RULES = {
  startMinor: 10000,
  costMinor: 500,
  spinTicks: 360,
  maxFinalTick: 21600,
  inputCooldown: 3,
  tripleMultipliers: [4, 5, 6, 8, 12, 16, 24, 40],
  pairMultiplier: 2,
  sevenRefund: 1,
} as const;
export type SlotState = CoreState & {
  strips: number[][];
  positions: number[];
  steps: number[];
  from: number[];
  destinations: number[];
  spinStart: number;
  settlingAt: number;
  balanceMinor: number;
  spins: number;
  lastPayout: number;
  lastInputTick: number;
  lastSettledTick: number;
};
export function slotPayout(symbols: readonly number[]) {
  const [a, b, c] = symbols;
  const multiplier =
    a === b && b === c
      ? SLOT_RULES.tripleMultipliers[a]
      : a === b || b === c || a === c
        ? SLOT_RULES.pairMultiplier
        : symbols.includes(7)
          ? SLOT_RULES.sevenRefund
          : 0;
  return multiplier * SLOT_RULES.costMinor;
}
function finish(s: SlotState) {
  s.score = s.balanceMinor;
  s.height = s.balanceMinor;
  s.status = s.balanceMinor === 0 ? "failed" : "won";
  s.failure = s.balanceMinor === 0 ? "EMPTY_BALANCE" : null;
}
export const SLOT_CORE: GameCore<SlotState> = {
  gameId: "galactic-slot",
  gameVersion: "1.0.0",
  width: 390,
  height: 520,
  tickRate: 120,
  maxFinalTick: SLOT_RULES.maxFinalTick,
  maxInputs: 2400,
  inputVersion: 1,
  actions: SLOT_ACTIONS,
  content: {
    rules: SLOT_RULES,
    scope: "FICTITIOUS_ONLY",
    order: "FIXED_PER_SCENARIO",
    outcome: "REEL_POSITIONS_NOT_RNG",
    metric: "FINAL_BALANCE_MINOR",
    target: "TERMINAL_SCORE_ONLY",
  },
  create(seed) {
    const rng = createRng(`${seed}:slot-initial-v1`),
      positions = Array.from({ length: 3 }, () => rng.nextInt(8));
    return {
      tick: 0,
      status: "running",
      score: 0,
      failure: null,
      strips: Array.from({ length: 3 }, (_, i) =>
        seededShuffle([0, 1, 2, 3, 4, 5, 6, 7], `${seed}:slot-strip-v1:${i}`),
      ),
      positions,
      steps: [1, 1, 1],
      from: [...positions],
      destinations: [...positions],
      spinStart: -1,
      settlingAt: -1,
      balanceMinor: 10000,
      height: 10000,
      spins: 0,
      lastPayout: 0,
      lastInputTick: -3,
      lastSettledTick: -1000,
    };
  },
  canApply(s, a) {
    return (
      s.status === "running" &&
      s.settlingAt === -1 &&
      s.tick - s.lastInputTick >= 3 &&
      SLOT_ACTIONS.includes(a as (typeof SLOT_ACTIONS)[number]) &&
      (a !== "SPIN" || (s.balanceMinor >= 500 && s.tick <= 21600 - 360))
    );
  },
  apply(s, a) {
    s.lastInputTick = s.tick;
    if (a === "SPIN") {
      s.balanceMinor -= 500;
      s.height = s.balanceMinor;
      s.spins++;
      s.lastPayout = 0;
      s.from = [...s.positions];
      s.destinations = s.positions.map((p, i) => (p + s.steps[i]) % 8);
      s.spinStart = s.tick;
      s.settlingAt = s.tick + 360;
    } else {
      const i = Number(a[5]),
        delta = a.endsWith("MORE") ? 1 : -1;
      s.steps[i] = ((s.steps[i] - 1 + delta + 8) % 8) + 1;
    }
  },
  step(s) {
    s.tick++;
    if (s.settlingAt !== -1 && s.tick >= s.settlingAt) {
      s.positions = [...s.destinations];
      s.lastPayout = slotPayout(s.positions.map((p, i) => s.strips[i][p]));
      s.balanceMinor += s.lastPayout;
      s.height = s.balanceMinor;
      s.lastSettledTick = s.tick;
      s.settlingAt = -1;
      if (s.balanceMinor === 0) finish(s);
    }
    if (s.tick === 21600 && s.status === "running") finish(s);
  },
};
