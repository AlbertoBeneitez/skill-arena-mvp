/**
 * V7: V6 plus chip denominations (1, 5 and 25 chips), cloth chips cleared after
 * every spin, placed chips that expire after 10 s without a throw, and a
 * history of the last 12 results. V1–V6 stay untouched for historical replays.
 */
import { createRng } from "../deterministic/seeded";
import {
  integerSqrt,
  roundDiv,
  sinPhaseMilli,
} from "../deterministic/integerMath";
import {
  ROULETTE_WHEEL,
  ROULETTE_RED,
  rouletteReturn,
} from "./galacticRouletteCore.v1";
import { ROULETTE_ACTIONS_V7 } from "./galacticRouletteProtocol.v7";
import type { CoreState, GameCore } from "./coreRuntime.v1";
export { ROULETTE_WHEEL, ROULETTE_RED };
export const ROULETTE_RULES_V7 = {
  startMinor: 10000,
  chipMinor: 100,
  maxChipsPerBet: 10,
  maxTableChips: 30,
  centerX: 195000,
  centerY: 195000,
  releaseX: 323000,
  releaseY: 330000,
  releaseZ: 24000,
  ballRadius: 6000,
  gravity: 30,
  frictionNumerator: 988,
  frictionDenominator: 1000,
  bowlRadius: 151000,
  innerBossRadius: 90000,
  rimRadius: 146000,
  rimHeight: 18000,
  rollingSlopeForce: 10,
  minimumFlightTicks: 300,
  maximumFlightTicks: 960,
  captureSpeed: 70,
  wallRadius: 148000,
  wallRestitutionMilli: 780,
  restitutionMilli: 720,
  rollingFrictionMilli: 994,
  wheelCarryDivisor: 6,
  fretForce: 9,
  radialSlopeMilli: 350,
  tossVerticalBase: 450,
  tossVerticalPerImpulse: 70,
  inputCooldown: 0,
  maxFinalTick: 72000,
  // Unthrown chips no longer expire; the cloth is cleared when the spin ends (presentation).
  chipExpiryTicks: 1_000_000_000,
  maxStakePerBet: 50,
  historyLength: 12,
} as const;
const R = ROULETTE_RULES_V7;
export type RouletteStateV7 = CoreState & {
  wheelPhase: number;
  wheelSpeed: number;
  ballX: number;
  ballY: number;
  ballZ: number;
  ballVx: number;
  ballVy: number;
  ballVz: number;
  flightStart: number;
  landingTick: number;
  inBowl: boolean;
  contacts: number;
  launchDirection: number;
  launchImpulse: number;
  /** Chips on the cloth, in placement order; they stay on it between spins. */
  chips: string[];
  /** Value (1, 5 or 25 chips) of each cloth chip, parallel to `chips`. */
  chipValues: number[];
  /** Tick at which each cloth chip was placed; it vanishes after chipExpiryTicks. */
  chipTicks: number[];
  /** Denomination of the next chip to place. */
  denomination: number;
  /** Results of the last spins, oldest first. */
  history: number[];
  /** The chips that were riding on the spin in flight / last resolved. */
  lockedChips: string[];
  lockedValues: number[];
  balanceMinor: number;
  spins: number;
  lastNumber: number | null;
  lastPayout: number;
  lastInputTick: number;
  lastLandingTick: number;
  lastMiss: boolean;
};
const signedFriction = (v: number, n: number) =>
  Math.sign(v) * Math.floor((Math.abs(v) * n) / 1000);
export function rouletteTossVelocity(direction: number, impulse: number) {
  const phase = direction * 128,
    speed = 700 + impulse * 95;
  return {
    vx: roundDiv(sinPhaseMilli(phase + 1024) * speed, 1000),
    vy: roundDiv(sinPhaseMilli(phase) * speed, 1000),
    vz: ROULETTE_RULES_V7.tossVerticalBase + impulse * ROULETTE_RULES_V7.tossVerticalPerImpulse,
  };
}
/** Return for ONE chip (stake included): the V1 table pays on a 5-chip stake. */
export function rouletteChipReturn(bet: string, n: number) {
  return Math.floor(rouletteReturn(bet, n) / 5);
}
export const rouletteChipCount = (chips: readonly string[], bet: string) => chips.filter((c) => c === bet).length;
const sum = (values: readonly number[]) => values.reduce((a, b) => a + b, 0);
/** Chips staked on the cloth (denominations added up). */
export const rouletteStake = (s: Pick<RouletteStateV7, "chipValues">) => sum(s.chipValues);
export const rouletteBetStake = (s: Pick<RouletteStateV7, "chips" | "chipValues">, bet: string) =>
  s.chips.reduce((total, c, i) => total + (c === bet ? s.chipValues[i] : 0), 0);
/** Closest rotating pocket from integer dot products; no random outcome/atan2. */
export function rouletteCartesianPocket(
  wheelPhase: number,
  x: number,
  y: number,
) {
  let index = 0,
    best = -Infinity;
  for (let i = 0; i < 37; i++) {
    const phase = roundDiv(wheelPhase, 16) + roundDiv(i * 4096, 37);
    const dot = x * sinPhaseMilli(phase) + y * -sinPhaseMilli(phase + 1024);
    if (dot > best) {
      best = dot;
      index = i;
    }
  }
  return index;
}
function finish(s: RouletteStateV7) {
  s.score = s.balanceMinor;
  s.height = s.balanceMinor;
  s.status = s.balanceMinor === 0 ? "failed" : "won";
  s.failure = s.balanceMinor === 0 ? "EMPTY_BALANCE" : null;
}
function settle(s: RouletteStateV7, miss: boolean) {
  s.lastMiss = miss;
  s.lastNumber = miss
    ? null
    : ROULETTE_WHEEL[
        rouletteCartesianPocket(
          s.wheelPhase,
          s.ballX - 195000,
          s.ballY - 195000,
        )
      ];
  const landed = s.lastNumber;
  s.lastPayout =
    landed === null ? 0 : s.lockedChips.reduce((sum, bet, i) => sum + rouletteChipReturn(bet, landed) * s.lockedValues[i], 0);
  s.balanceMinor += s.lastPayout;
  s.height = s.balanceMinor;
  if (landed !== null) s.history = [...s.history, landed].slice(-R.historyLength);
  s.ballVx = s.ballVy = s.ballVz = 0;
  s.lastLandingTick = s.tick;
  s.landingTick = -1;
  if (s.balanceMinor === 0) finish(s);
}
function moveBall(s: RouletteStateV7) {
  s.ballX += s.ballVx;
  s.ballY += s.ballVy;
  s.ballVz -= R.gravity;
  s.ballZ += s.ballVz;
  let dx = s.ballX - R.centerX,
    dy = s.ballY - R.centerY,
    r = Math.max(1, integerSqrt(dx * dx + dy * dy));
  if (r <= R.bowlRadius) s.inBowl = true;
  const surface =
    s.inBowl && r <= R.bowlRadius
      ? r < R.innerBossRadius
        ? roundDiv((R.innerBossRadius - r) * 35, 100)
        : Math.max(0, roundDiv((r - 115000) * 35, 100))
      : 0;
  let grounded = false;
  if (s.ballZ <= surface + R.ballRadius && s.ballVz < 0) {
    grounded = true;
    s.ballZ = surface + R.ballRadius;
    const slope =
      s.inBowl && r <= R.bowlRadius
        ? r < R.innerBossRadius
          ? -350
          : r > 115000
            ? 350
            : 0
        : 0;
    const nx = -roundDiv(dx * slope, r),
      ny = -roundDiv(dy * slope, r),
      nz = 1000;
    const normalSq = nx * nx + ny * ny + nz * nz;
    const dot = s.ballVx * nx + s.ballVy * ny + s.ballVz * nz;
    const coefficient = 1000 + R.restitutionMilli;
    if (dot < 0) {
      // Reflect the 3D velocity about the actual inclined surface normal.
      s.ballVx -= roundDiv(dot * nx * coefficient, normalSq * 1000);
      s.ballVy -= roundDiv(dot * ny * coefficient, normalSq * 1000);
      s.ballVz -= roundDiv(dot * nz * coefficient, normalSq * 1000);
    }
    if (Math.abs(s.ballVz) < 45) s.ballVz = 0;
    s.ballVx = signedFriction(s.ballVx, R.rollingFrictionMilli);
    s.ballVy = signedFriction(s.ballVy, R.rollingFrictionMilli);
    if (s.inBowl && r <= R.bowlRadius && s.ballVz === 0) {
      const downhill = r < R.innerBossRadius ? -10 : r > 115000 ? 10 : 0;
      s.ballVx -= roundDiv(dx * downhill, r);
      s.ballVy -= roundDiv(dy * downhill, r);
    }
    s.contacts++;
  }
  // Solid outer wall: once inside the bowl the ball always rebounds off it.
  if (s.inBowl && r > R.wallRadius) {
    const normal = roundDiv(s.ballVx * dx + s.ballVy * dy, r);
    if (normal > 0) {
      const push = roundDiv(normal * (1000 + R.wallRestitutionMilli), 1000);
      s.ballVx -= roundDiv(push * dx, r);
      s.ballVy -= roundDiv(push * dy, r);
      s.contacts++;
    }
    s.ballX = R.centerX + roundDiv(dx * R.wallRadius, r);
    s.ballY = R.centerY + roundDiv(dy * R.wallRadius, r);
    dx = s.ballX - R.centerX;
    dy = s.ballY - R.centerY;
    r = R.wallRadius;
  }
  const age = s.tick - s.flightStart;
  const onPocketRing =
    s.inBowl &&
    grounded &&
    s.ballVz === 0 &&
    r >= R.innerBossRadius + 2000 &&
    r <= 114000;
  let relativeSpeed = Infinity;
  if (onPocketRing && age >= 150) {
    // The spinning wheel drags the ball along; the frets pull it to a pocket.
    const wvx = roundDiv(-dy * s.wheelSpeed * 6283, 65536000),
      wvy = roundDiv(dx * s.wheelSpeed * 6283, 65536000);
    s.ballVx += roundDiv(wvx - s.ballVx, R.wheelCarryDivisor);
    s.ballVy += roundDiv(wvy - s.ballVy, R.wheelCarryDivisor);
    const index = rouletteCartesianPocket(s.wheelPhase, dx, dy);
    const phase = roundDiv(s.wheelPhase, 16) + roundDiv(index * 4096, 37);
    const px = sinPhaseMilli(phase),
      py = -sinPhaseMilli(phase + 1024);
    const offset = roundDiv(dx * py - dy * px, r);
    s.ballVx += roundDiv(-py * offset * R.fretForce, 1000000);
    s.ballVy += roundDiv(px * offset * R.fretForce, 1000000);
    relativeSpeed = integerSqrt(
      (s.ballVx - wvx) * (s.ballVx - wvx) + (s.ballVy - wvy) * (s.ballVy - wvy),
    );
  }
  if (
    age >= R.minimumFlightTicks &&
    onPocketRing &&
    relativeSpeed <= R.captureSpeed
  )
    settle(s, false);
  else if (s.tick === s.landingTick) settle(s, !s.inBowl || r > R.bowlRadius);
}
export const ROULETTE_CORE_V7: GameCore<RouletteStateV7> = {
  gameId: "galactic-roulette",
  gameVersion: "7.0.0",
  width: 390,
  height: 400,
  tickRate: 120,
  maxFinalTick: 72000,
  maxInputs: 2400,
  inputVersion: 4,
  actions: ROULETTE_ACTIONS_V7,
  content: {
    rules: ROULETTE_RULES_V7,
    wheel: ROULETTE_WHEEL,
    red: ROULETTE_RED,
    scope: "FICTITIOUS_ONLY",
    bets: "EUROPEAN_SINGLE_ZERO_DENOMINATIONS_1_5_25_CLOTH_CLEARED_EACH_SPIN_10S_CHIP_EXPIRY",
    launch: "FIXED_LAUNCHER_OUTSIDE_THE_WHEEL_SWIPE_DIRECTION_AND_POWER",
    outcome:
      "INTEGER_3D_BOWL_OUTER_WALL_BOUNCE_WHEEL_CARRY_FRET_POCKET",
    target: "TERMINAL_BALANCE_ONLY_STOP_OR_BROKE",
  },
  create(seed) {
    const rng = createRng(`${seed}:roulette-v7`);
    return {
      tick: 0,
      status: "running",
      score: 0,
      failure: null,
      height: 10000,
      wheelPhase: rng.nextInt(65536),
      wheelSpeed: 45 + rng.nextInt(21),
      ballX: 323000,
      ballY: 330000,
      ballZ: 24000,
      ballVx: 0,
      ballVy: 0,
      ballVz: 0,
      flightStart: -1,
      landingTick: -1,
      inBowl: false,
      contacts: 0,
      launchDirection: 20,
      launchImpulse: 8,
      chips: [],
      chipValues: [],
      chipTicks: [],
      denomination: 1,
      history: [],
      lockedChips: [],
      lockedValues: [],
      balanceMinor: 10000,
      spins: 0,
      lastNumber: null,
      lastPayout: 0,
      lastInputTick: -3,
      lastLandingTick: -1000,
      lastMiss: false,
    };
  },
  canApply(s, a) {
    if (s.status !== "running" || s.landingTick !== -1 || !ROULETTE_ACTIONS_V7.includes(a)) return false;
    if (a.startsWith("TOSS_"))
      return (
        s.chips.length > 0 &&
        s.balanceMinor >= rouletteStake(s) * R.chipMinor &&
        s.tick + R.maximumFlightTicks <= R.maxFinalTick
      );
    if (a === "CASH_OUT") return true;
    if (a.startsWith("CHIP_")) return true;
    if (a === "BETS_UNDO" || a === "BETS_CLEAR") return s.chips.length > 0;
    const bet = a.slice(4);
    return (
      s.chips.length < R.maxTableChips &&
      (rouletteStake(s) + s.denomination) * R.chipMinor <= s.balanceMinor &&
      rouletteBetStake(s, bet) + s.denomination <= R.maxStakePerBet
    );
  },
  apply(s, a) {
    s.lastInputTick = s.tick;
    if (a === "CASH_OUT") {
      // The player stops: the terminal result is the balance in chips.
      finish(s);
      return;
    }
    if (a.startsWith("CHIP_")) {
      s.denomination = Number(a.slice(5));
      return;
    }
    if (a.startsWith("BET_")) {
      s.chips.push(a.slice(4));
      s.chipValues.push(s.denomination);
      s.chipTicks.push(s.tick);
      return;
    }
    if (a === "BETS_UNDO") {
      s.chips.pop();
      s.chipValues.pop();
      s.chipTicks.pop();
      return;
    }
    if (a === "BETS_CLEAR") {
      s.chips = [];
      s.chipValues = [];
      s.chipTicks = [];
      return;
    }
    const d = Number(a.slice(6, 8)),
      p = Number(a.slice(10, 12)),
      v = rouletteTossVelocity(d, p);
    s.launchDirection = d;
    s.launchImpulse = p;
    // Always thrown from the launcher outside the wheel, never from above the bowl.
    s.ballX = R.releaseX;
    s.ballY = R.releaseY + 24000;
    s.ballZ = 24000;
    s.ballVx = v.vx;
    s.ballVy = v.vy;
    s.ballVz = v.vz;
    s.inBowl = false;
    s.contacts = 0;
    s.flightStart = s.tick;
    s.landingTick = s.tick + R.maximumFlightTicks;
    s.lockedChips = s.chips;
    s.lockedValues = s.chipValues;
    s.balanceMinor -= rouletteStake(s) * R.chipMinor;
    // The cloth is empty again after every spin.
    s.chips = [];
    s.chipValues = [];
    s.chipTicks = [];
    s.height = s.balanceMinor;
    s.spins++;
    s.lastPayout = 0;
    s.lastMiss = false;
  },
  step(s) {
    s.tick++;
    s.wheelPhase = (s.wheelPhase + s.wheelSpeed) % 65536;
    if (s.landingTick !== -1) moveBall(s);
    else if (s.chips.length && s.tick - s.chipTicks[0] >= R.chipExpiryTicks) {
      // Chips left unthrown for 10 s vanish (nothing was charged yet).
      const keep = s.chipTicks.map((t) => s.tick - t < R.chipExpiryTicks);
      s.chips = s.chips.filter((_, i) => keep[i]);
      s.chipValues = s.chipValues.filter((_, i) => keep[i]);
      s.chipTicks = s.chipTicks.filter((_, i) => keep[i]);
    }
    if (s.tick === R.maxFinalTick && s.status === "running") finish(s);
  },
};
