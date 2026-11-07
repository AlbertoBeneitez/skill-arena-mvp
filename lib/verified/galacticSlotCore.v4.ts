/**
 * Slot V4 — seven symbols (the orange is gone), so every strip has seven stops and a reel moves −3…+3 (each value
 * reaches a different stop). Pairs pay by symbol on a ladder that follows the triples; a seven alone pays nothing.
 * Same budget, cost, timing and visible-information rules as V3. V1–V3 stay frozen.
 */
import { createRng, seededShuffle } from "../deterministic/seeded";
import { SLOT_ACTIONS } from "./galacticSlotProtocol.v1";
import type { GameCore } from "./coreRuntime.v1";
import type { SlotState } from "./galacticSlotCore.v1";

/** Symbol ids keep V1's numbering (0 lemon, 2 cherry, 3 bell, 4 star, 5 BAR, 6 gem, 7 seven); id 1 (orange) is retired. */
export const SLOT_SYMBOLS_V4 = [0, 2, 3, 4, 5, 6, 7] as const;
export const SLOT_STOPS_V4 = SLOT_SYMBOLS_V4.length;
export const SLOT_MAX_STEP_V4 = 3;
export const SLOT_RULES_V4 = {
  startMinor: 10000,
  costMinor: 500,
  spinTicks: 180,
  maxFinalTick: 21600,
  inputCooldown: 3,
  /** Multiples of the 5-chip cost, by symbol id: a triple pays four pairs (the seven, five). */
  triple: { 0: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 40 } as Record<number, number>,
  pair: { 0: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 8 } as Record<number, number>,
} as const;
const R = SLOT_RULES_V4;

export function slotPayoutV4(symbols: readonly number[]) {
  const [a, b, c] = symbols;
  if (a === b && b === c) return (R.triple[a] ?? 0) * R.costMinor;
  const pair = a === b || a === c ? a : b === c ? b : -1;
  return pair === -1 ? 0 : (R.pair[pair] ?? 0) * R.costMinor;
}
function finish(s: SlotState) {
  s.score = s.balanceMinor;
  s.height = s.balanceMinor;
  s.status = s.balanceMinor === 0 ? "failed" : "won";
  s.failure = s.balanceMinor === 0 ? "EMPTY_BALANCE" : null;
}
export const SLOT_CORE_V4: GameCore<SlotState> = {
  gameId: "galactic-slot",
  gameVersion: "4.0.0",
  width: 390,
  height: 520,
  tickRate: 120,
  maxFinalTick: R.maxFinalTick,
  maxInputs: 2400,
  inputVersion: 4,
  actions: SLOT_ACTIONS,
  content: {
    rules: R,
    symbols: SLOT_SYMBOLS_V4,
    steps: [-3, -2, -1, 0, 1, 2, 3],
    zeroWager: "FORBIDDEN",
    scope: "FICTITIOUS_ONLY",
    order: "FIXED_PER_SCENARIO",
    outcome: "REEL_POSITIONS_NOT_RNG",
    metric: "FINAL_BALANCE_MINOR",
  },
  create(seed) {
    const rng = createRng(`${seed}:slot-initial-v4`),
      positions = Array.from({ length: 3 }, () => rng.nextInt(SLOT_STOPS_V4));
    return {
      tick: 0,
      status: "running",
      score: 0,
      failure: null,
      strips: Array.from({ length: 3 }, (_, i) => seededShuffle([...SLOT_SYMBOLS_V4], `${seed}:slot-strip-v4:${i}`)),
      positions,
      steps: [1, 1, 1],
      from: [...positions],
      destinations: [...positions],
      spinStart: -1,
      settlingAt: -1,
      balanceMinor: R.startMinor,
      height: R.startMinor,
      spins: 0,
      lastPayout: 0,
      lastInputTick: -R.inputCooldown,
      lastSettledTick: -1000,
    };
  },
  canApply(s, a) {
    if (s.status !== "running" || s.settlingAt !== -1 || s.tick - s.lastInputTick < R.inputCooldown || !SLOT_ACTIONS.includes(a as (typeof SLOT_ACTIONS)[number])) return false;
    if (a === "SPIN") return s.steps.some((step) => step !== 0) && s.balanceMinor >= R.costMinor && s.tick + R.spinTicks <= R.maxFinalTick;
    const reel = Number(a[5]);
    return a.endsWith("MORE") ? s.steps[reel] < SLOT_MAX_STEP_V4 : s.steps[reel] > -SLOT_MAX_STEP_V4;
  },
  apply(s, a) {
    s.lastInputTick = s.tick;
    if (a === "SPIN") {
      s.balanceMinor -= R.costMinor;
      s.height = s.balanceMinor;
      s.spins++;
      s.lastPayout = 0;
      s.from = [...s.positions];
      s.destinations = s.positions.map((p, i) => (p + s.steps[i] + SLOT_STOPS_V4) % SLOT_STOPS_V4);
      s.spinStart = s.tick;
      s.settlingAt = s.tick + R.spinTicks;
    } else s.steps[Number(a[5])] += a.endsWith("MORE") ? 1 : -1;
  },
  step(s) {
    s.tick++;
    if (s.settlingAt !== -1 && s.tick >= s.settlingAt) {
      s.positions = [...s.destinations];
      s.lastPayout = slotPayoutV4(s.positions.map((p, i) => s.strips[i][p]));
      s.balanceMinor += s.lastPayout;
      s.height = s.balanceMinor;
      s.lastSettledTick = s.tick;
      s.settlingAt = -1;
      if (s.balanceMinor === 0) finish(s);
    }
    if (s.tick === R.maxFinalTick && s.status === "running") finish(s);
  },
};
