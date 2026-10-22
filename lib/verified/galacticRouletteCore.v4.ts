/**
 * V4: the bowl has a solid outer wall the ball bounces off, livelier restitution
 * and low rolling drag, and the ball is carried by the spinning wheel and pulled
 * into a pocket by the frets instead of being snapped to the nearest pocket.
 * V3 stays untouched for historical replays.
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
import { ROULETTE_ACTIONS_V2 } from "./galacticRouletteProtocol.v2";
import type { CoreState, GameCore } from "./coreRuntime.v1";
export { ROULETTE_WHEEL, ROULETTE_RED };
export const ROULETTE_RULES_V4 = {
  startMinor: 10000,
  costMinor: 500,
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
  maxFinalTick: 21600,
} as const;
const R = ROULETTE_RULES_V4;
export type RouletteStateV2 = CoreState & {
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
  releaseX: number;
  releaseY: number;
  launchDirection: number;
  launchImpulse: number;
  bet: string;
  lockedBet: string;
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
    vz: ROULETTE_RULES_V4.tossVerticalBase + impulse * ROULETTE_RULES_V4.tossVerticalPerImpulse,
  };
}
export function rouletteReturnV2(bet: string, n: number) {
  if (bet.startsWith("COLUMN_"))
    return n > 0 && ((n - 1) % 3) + 1 === Number(bet.slice(7)) ? 1500 : 0;
  return rouletteReturn(bet, n);
}
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
function finish(s: RouletteStateV2) {
  s.score = s.balanceMinor;
  s.height = s.balanceMinor;
  s.status = s.balanceMinor === 0 ? "failed" : "won";
  s.failure = s.balanceMinor === 0 ? "EMPTY_BALANCE" : null;
}
function settle(s: RouletteStateV2, miss: boolean) {
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
  s.lastPayout =
    s.lastNumber === null ? 0 : rouletteReturnV2(s.lockedBet, s.lastNumber);
  s.balanceMinor += s.lastPayout;
  s.height = s.balanceMinor;
  s.ballVx = s.ballVy = s.ballVz = 0;
  s.lastLandingTick = s.tick;
  s.landingTick = -1;
  if (s.balanceMinor === 0) finish(s);
}
function moveBall(s: RouletteStateV2) {
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
export const ROULETTE_CORE_V4: GameCore<RouletteStateV2> = {
  gameId: "galactic-roulette",
  gameVersion: "4.0.0",
  width: 390,
  height: 400,
  tickRate: 120,
  maxFinalTick: 21600,
  maxInputs: 1200,
  inputVersion: 2,
  actions: ROULETTE_ACTIONS_V2,
  content: {
    rules: ROULETTE_RULES_V4,
    wheel: ROULETTE_WHEEL,
    red: ROULETTE_RED,
    scope: "FICTITIOUS_ONLY",
    bets: "EUROPEAN_SINGLE_ZERO_WITH_THREE_COLUMNS",
    outcome:
      "INTEGER_3D_BOWL_OUTER_WALL_BOUNCE_WHEEL_CARRY_FRET_POCKET",
    target: "TERMINAL_BALANCE_ONLY",
  },
  create(seed) {
    const rng = createRng(`${seed}:roulette-v4`);
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
      releaseX: 323000,
      releaseY: 330000,
      launchDirection: 20,
      launchImpulse: 8,
      bet: "RED",
      lockedBet: "RED",
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
    if (
      s.status !== "running" ||
      s.landingTick !== -1 ||
      !ROULETTE_ACTIONS_V2.includes(a)
    )
      return false;
    return (
      !a.startsWith("TOSS_") || (s.balanceMinor >= 500 && s.tick + R.maximumFlightTicks <= 21600)
    );
  },
  apply(s, a) {
    s.lastInputTick = s.tick;
    if (a.startsWith("BET_")) {
      s.bet = a.slice(4);
      return;
    }
    if (a.startsWith("RELEASE_X_")) {
      s.releaseX = Number(a.slice(10)) * 10000;
      return;
    }
    if (a.startsWith("RELEASE_Y_")) {
      s.releaseY = Number(a.slice(10)) * 10000;
      return;
    }
    const d = Number(a.slice(6, 8)),
      p = Number(a.slice(10, 12)),
      v = rouletteTossVelocity(d, p);
    s.launchDirection = d;
    s.launchImpulse = p;
    s.ballX = s.releaseX;
    s.ballY = s.releaseY + 24000;
    s.ballZ = 24000;
    s.ballVx = v.vx;
    s.ballVy = v.vy;
    s.ballVz = v.vz;
    s.inBowl = false;
    s.contacts = 0;
    s.flightStart = s.tick;
    s.landingTick = s.tick + R.maximumFlightTicks;
    s.lockedBet = s.bet;
    s.balanceMinor -= 500;
    s.height = s.balanceMinor;
    s.spins++;
    s.lastPayout = 0;
    s.lastMiss = false;
  },
  step(s) {
    s.tick++;
    s.wheelPhase = (s.wheelPhase + s.wheelSpeed) % 65536;
    if (s.landingTick !== -1) moveBall(s);
    if (s.tick === 21600 && s.status === "running") finish(s);
  },
};
