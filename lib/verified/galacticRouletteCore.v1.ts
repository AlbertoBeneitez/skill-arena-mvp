/** Original fixed-point European wheel. No outcome RNG after a launch. */
import { createRng } from "../deterministic/seeded";
import { roundDiv } from "../deterministic/integerMath";
import { ROULETTE_ACTIONS } from "./galacticRouletteProtocol.v1";
import type { GameCore, CoreState } from "./coreRuntime.v1";
export const ROULETTE_WHEEL = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24,
  16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
] as const;
export const ROULETTE_RED = [
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
] as const;
export const ROULETTE_RULES = {
  startMinor: 10000,
  costMinor: 500,
  turn: 65536,
  maxFinalTick: 21600,
  frictionNumerator: 997,
  frictionDenominator: 1000,
  flightBaseTicks: 600,
  powerExtraTicks: 4,
  baseSpeed: 1200,
  powerSpeed: 16,
  inputCooldown: 3,
} as const;
export type RouletteState = CoreState & {
  wheelPhase: number;
  wheelSpeed: number;
  ballPhase: number;
  ballSpeed: number;
  flightStart: number;
  landingTick: number;
  launchPower: number;
  bet: string;
  lockedBet: string;
  balanceMinor: number;
  spins: number;
  lastNumber: number | null;
  lastPayout: number;
  lastInputTick: number;
  lastLandingTick: number;
};
export function rouletteReturn(bet: string, n: number) {
  if (bet.startsWith("NUMBER_")) return Number(bet.slice(7)) === n ? 18000 : 0;
  if (n === 0) return 0;
  if (bet === "RED")
    return ROULETTE_RED.includes(n as (typeof ROULETTE_RED)[number]) ? 1000 : 0;
  if (bet === "BLACK")
    return !ROULETTE_RED.includes(n as (typeof ROULETTE_RED)[number])
      ? 1000
      : 0;
  if (bet === "EVEN") return n % 2 === 0 ? 1000 : 0;
  if (bet === "ODD") return n % 2 !== 0 ? 1000 : 0;
  if (bet === "LOW") return n <= 18 ? 1000 : 0;
  if (bet === "HIGH") return n >= 19 ? 1000 : 0;
  if (bet.startsWith("DOZEN_"))
    return Math.ceil(n / 12) === Number(bet.slice(6)) ? 1500 : 0;
  return 0;
}
export function roulettePocket(wheelPhase: number, ballPhase: number) {
  return Math.floor(
    (((ballPhase - wheelPhase + 65536 + Math.floor(65536 / 74)) % 65536) * 37) /
      65536,
  );
}
function finish(s: RouletteState) {
  s.score = s.balanceMinor;
  s.height = s.balanceMinor;
  s.status = s.balanceMinor === 0 ? "failed" : "won";
  s.failure = s.balanceMinor === 0 ? "EMPTY_BALANCE" : null;
}
export const ROULETTE_CORE: GameCore<RouletteState> = {
  gameId: "galactic-roulette",
  gameVersion: "1.0.0",
  width: 390,
  height: 400,
  tickRate: 120,
  maxFinalTick: 21600,
  maxInputs: 1000,
  inputVersion: 1,
  actions: ROULETTE_ACTIONS,
  content: {
    rules: ROULETTE_RULES,
    wheel: ROULETTE_WHEEL,
    red: ROULETTE_RED,
    scope: "FICTITIOUS_ONLY",
    bets: "EUROPEAN_SINGLE_ZERO",
    metric: "FINAL_BALANCE_MINOR",
    outcome: "LAUNCH_TICK_POWER_DIRECTION_FIXED_POINT",
    target: "TERMINAL_SCORE_ONLY",
  },
  create(seed) {
    const rng = createRng(`${seed}:roulette-v1`);
    return {
      tick: 0,
      status: "running",
      score: 0,
      failure: null,
      wheelPhase: rng.nextInt(65536),
      wheelSpeed: 45 + rng.nextInt(21),
      ballPhase: rng.nextInt(65536),
      ballSpeed: 0,
      flightStart: -1,
      landingTick: -1,
      launchPower: 0,
      bet: "RED",
      lockedBet: "RED",
      balanceMinor: 10000,
      height: 10000,
      spins: 0,
      lastNumber: null,
      lastPayout: 0,
      lastInputTick: -3,
      lastLandingTick: -1000,
    };
  },
  canApply(s, a) {
    if (
      s.status !== "running" ||
      s.landingTick !== -1 ||
      s.tick - s.lastInputTick < 3 ||
      !ROULETTE_ACTIONS.includes(a)
    )
      return false;
    if (a.startsWith("LAUNCH_")) {
      const p = Number(a.slice(-2));
      return s.balanceMinor >= 500 && s.tick + 600 + p * 4 <= 21600;
    }
    return true;
  },
  apply(s, a) {
    s.lastInputTick = s.tick;
    if (a.startsWith("BET_")) {
      s.bet = a.slice(4);
      return;
    }
    const p = Number(a.slice(-2));
    s.launchPower = p;
    s.flightStart = s.tick;
    s.landingTick = s.tick + 600 + p * 4;
    s.ballSpeed = (1200 + p * 16) * (a.startsWith("LAUNCH_CW_") ? 1 : -1);
    s.lockedBet = s.bet;
    s.balanceMinor -= 500;
    s.height = s.balanceMinor;
    s.spins++;
    s.lastPayout = 0;
  },
  step(s) {
    s.tick++;
    s.wheelPhase = (s.wheelPhase + s.wheelSpeed) % 65536;
    if (s.landingTick !== -1) {
      s.ballPhase = (((s.ballPhase + s.ballSpeed) % 65536) + 65536) % 65536;
      s.ballSpeed =
        (s.ballSpeed < 0 ? -1 : 1) *
        Math.floor((Math.abs(s.ballSpeed) * 997) / 1000);
      if (s.tick === s.landingTick) {
        const pocket = roulettePocket(s.wheelPhase, s.ballPhase);
        s.lastNumber = ROULETTE_WHEEL[pocket];
        s.lastPayout = rouletteReturn(s.lockedBet, s.lastNumber);
        s.balanceMinor += s.lastPayout;
        s.height = s.balanceMinor;
        s.ballPhase = (s.wheelPhase + roundDiv(pocket * 65536, 37)) % 65536;
        s.ballSpeed = 0;
        s.lastLandingTick = s.tick;
        s.landingTick = -1;
        if (s.balanceMinor === 0) finish(s);
      }
    } else if (s.lastNumber !== null)
      s.ballPhase = (s.ballPhase + s.wheelSpeed) % 65536;
    if (s.tick === 21600 && s.status === "running") finish(s);
  },
};
