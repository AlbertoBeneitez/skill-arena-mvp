/** Longer physical bowl run with repeated outer-rim rebounds; V1-V3 frozen. */
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

export const ROULETTE_RULES_V4 = Object.freeze({
  startMinor: 10_000,
  costMinor: 500,
  centerX: 195_000,
  centerY: 195_000,
  releaseX: 323_000,
  releaseY: 330_000,
  releaseZ: 24_000,
  ballRadius: 6_000,
  gravity: 30,
  surfaceFrictionPerMille: 992,
  bowlRadius: 151_000,
  innerBossRadius: 90_000,
  rimRadius: 146_000,
  rimHeight: 80_000,
  rimRestitutionPerMille: 780,
  rimTangentialFrictionPerMille: 997,
  rollingSlopeForce: 14,
  minimumFlightTicks: 420,
  maximumFlightTicks: 960,
  captureSpeed: 125,
  minimumRimRebounds: 1,
  restitutionMilli: 620,
  radialSlopeMilli: 350,
  tossVerticalBase: 450,
  tossVerticalPerImpulse: 70,
  maxFinalTick: 21_600,
});

export type RouletteStateV4 = CoreState & {
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
  rimRebounds: number;
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
const signedFriction = (value: number, perMille: number) =>
  Math.sign(value) * Math.floor((Math.abs(value) * perMille) / 1000);

export function rouletteTossVelocityV4(direction: number, impulse: number) {
  const phase = direction * 128,
    speed = 700 + impulse * 95;
  return {
    vx: roundDiv(sinPhaseMilli(phase + 1024) * speed, 1000),
    vy: roundDiv(sinPhaseMilli(phase) * speed, 1000),
    vz:
      ROULETTE_RULES_V4.tossVerticalBase +
      impulse * ROULETTE_RULES_V4.tossVerticalPerImpulse,
  };
}

export function rouletteReturnV4(bet: string, number: number) {
  if (bet.startsWith("COLUMN_"))
    return number > 0 && ((number - 1) % 3) + 1 === Number(bet.slice(7))
      ? 1500
      : 0;
  return rouletteReturn(bet, number);
}

/** Closest rotating pocket by integer dot products; no random outcome. */
export function rouletteCartesianPocketV4(
  wheelPhase: number,
  x: number,
  y: number,
) {
  let index = 0,
    best = -Infinity;
  for (let candidate = 0; candidate < 37; candidate++) {
    const phase =
        roundDiv(wheelPhase, 16) + roundDiv(candidate * 4096, 37),
      dot =
        x * sinPhaseMilli(phase) +
        y * -sinPhaseMilli(phase + 1024);
    if (dot > best) {
      best = dot;
      index = candidate;
    }
  }
  return index;
}

function finish(state: RouletteStateV4) {
  state.score = state.balanceMinor;
  state.height = state.balanceMinor;
  state.status = state.balanceMinor === 0 ? "failed" : "won";
  state.failure = state.balanceMinor === 0 ? "EMPTY_BALANCE" : null;
}

function settle(state: RouletteStateV4, miss: boolean) {
  state.lastMiss = miss;
  state.lastNumber = miss
    ? null
    : ROULETTE_WHEEL[
        rouletteCartesianPocketV4(
          state.wheelPhase,
          state.ballX - ROULETTE_RULES_V4.centerX,
          state.ballY - ROULETTE_RULES_V4.centerY,
        )
      ];
  state.lastPayout =
    state.lastNumber === null
      ? 0
      : rouletteReturnV4(state.lockedBet, state.lastNumber);
  state.balanceMinor += state.lastPayout;
  state.height = state.balanceMinor;
  state.ballVx = state.ballVy = state.ballVz = 0;
  state.lastLandingTick = state.tick;
  state.landingTick = -1;
  if (state.balanceMinor === 0) finish(state);
}

function surfaceAt(radius: number) {
  if (radius > ROULETTE_RULES_V4.bowlRadius) return 0;
  if (radius < ROULETTE_RULES_V4.innerBossRadius)
    return roundDiv(
      (ROULETTE_RULES_V4.innerBossRadius - radius) * 35,
      100,
    );
  return Math.max(0, roundDiv((radius - 115_000) * 35, 100));
}

function moveBall(state: RouletteStateV4) {
  state.ballX += state.ballVx;
  state.ballY += state.ballVy;
  state.ballVz -= ROULETTE_RULES_V4.gravity;
  state.ballZ += state.ballVz;

  let dx = state.ballX - ROULETTE_RULES_V4.centerX,
    dy = state.ballY - ROULETTE_RULES_V4.centerY,
    radius = Math.max(1, integerSqrt(dx * dx + dy * dy));
  if (radius <= ROULETTE_RULES_V4.bowlRadius) state.inBowl = true;
  let surface = state.inBowl ? surfaceAt(radius) : 0;

  if (
    state.ballZ <= surface + ROULETTE_RULES_V4.ballRadius &&
    state.ballVz < 0
  ) {
    state.ballZ = surface + ROULETTE_RULES_V4.ballRadius;
    const slope =
        state.inBowl && radius <= ROULETTE_RULES_V4.bowlRadius
          ? radius < ROULETTE_RULES_V4.innerBossRadius
            ? -ROULETTE_RULES_V4.radialSlopeMilli
            : radius > 112_000
              ? ROULETTE_RULES_V4.radialSlopeMilli
              : 0
          : 0,
      nx = -roundDiv(dx * slope, radius),
      ny = -roundDiv(dy * slope, radius),
      nz = 1000,
      normalSq = nx * nx + ny * ny + nz * nz,
      dot = state.ballVx * nx + state.ballVy * ny + state.ballVz * nz;
    if (dot < 0) {
      state.ballVx -= roundDiv(dot * nx * 1620, normalSq * 1000);
      state.ballVy -= roundDiv(dot * ny * 1620, normalSq * 1000);
      state.ballVz -= roundDiv(dot * nz * 1620, normalSq * 1000);
    }
    if (Math.abs(state.ballVz) < 45) state.ballVz = 0;
    state.ballVx = signedFriction(
      state.ballVx,
      ROULETTE_RULES_V4.surfaceFrictionPerMille,
    );
    state.ballVy = signedFriction(
      state.ballVy,
      ROULETTE_RULES_V4.surfaceFrictionPerMille,
    );
    if (
      state.inBowl &&
      radius <= ROULETTE_RULES_V4.bowlRadius &&
      state.ballVz === 0
    ) {
      const downhill =
        radius < ROULETTE_RULES_V4.innerBossRadius
          ? -ROULETTE_RULES_V4.rollingSlopeForce
          : radius > 112_000
            ? ROULETTE_RULES_V4.rollingSlopeForce
            : 0;
      state.ballVx -= roundDiv(dx * downhill, radius);
      state.ballVy -= roundDiv(dy * downhill, radius);
    }
    state.contacts++;
  }

  // A taller, elastic outer rail makes the ball visibly rebound around the
  // circumference instead of crossing or sticking to it after first contact.
  if (
    state.inBowl &&
    state.ballZ <=
      ROULETTE_RULES_V4.rimHeight + ROULETTE_RULES_V4.ballRadius &&
    radius > ROULETTE_RULES_V4.rimRadius
  ) {
    const normalSpeed = roundDiv(
      state.ballVx * dx + state.ballVy * dy,
      radius,
    );
    if (normalSpeed > 0) {
      const reflectedNormal = roundDiv(
        normalSpeed * (1000 + ROULETTE_RULES_V4.rimRestitutionPerMille),
        1000,
      );
      state.ballVx -= roundDiv(reflectedNormal * dx, radius);
      state.ballVy -= roundDiv(reflectedNormal * dy, radius);
      state.ballVx = signedFriction(
        state.ballVx,
        ROULETTE_RULES_V4.rimTangentialFrictionPerMille,
      );
      state.ballVy = signedFriction(
        state.ballVy,
        ROULETTE_RULES_V4.rimTangentialFrictionPerMille,
      );
      state.contacts++;
      state.rimRebounds++;
    }
    state.ballX =
      ROULETTE_RULES_V4.centerX +
      roundDiv(dx * ROULETTE_RULES_V4.rimRadius, radius);
    state.ballY =
      ROULETTE_RULES_V4.centerY +
      roundDiv(dy * ROULETTE_RULES_V4.rimRadius, radius);
    dx = state.ballX - ROULETTE_RULES_V4.centerX;
    dy = state.ballY - ROULETTE_RULES_V4.centerY;
    radius = ROULETTE_RULES_V4.rimRadius;
    surface = surfaceAt(radius);
  }

  const age = state.tick - state.flightStart,
    speed = integerSqrt(
      state.ballVx * state.ballVx + state.ballVy * state.ballVy,
    );
  if (
    age >= ROULETTE_RULES_V4.minimumFlightTicks &&
    state.inBowl &&
    radius >= ROULETTE_RULES_V4.innerBossRadius &&
    radius <= ROULETTE_RULES_V4.bowlRadius &&
    state.ballZ <= surface + ROULETTE_RULES_V4.ballRadius + 500 &&
    speed <= ROULETTE_RULES_V4.captureSpeed &&
    state.rimRebounds >= ROULETTE_RULES_V4.minimumRimRebounds
  )
    settle(state, false);
  else if (state.tick === state.landingTick)
    settle(
      state,
      !state.inBowl || radius > ROULETTE_RULES_V4.bowlRadius,
    );
}

export const ROULETTE_CORE_V4: GameCore<RouletteStateV4> = {
  gameId: "galactic-roulette",
  gameVersion: "4.0.0",
  width: 390,
  height: 400,
  tickRate: 120,
  maxFinalTick: ROULETTE_RULES_V4.maxFinalTick,
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
      "INTEGER_3D_NORMAL_REFLECTION_TALL_ELASTIC_OUTER_RIM_LONG_ROLL_CLOSEST_POCKET",
    target: "TERMINAL_BALANCE_ONLY",
  },
  create(seed) {
    const rng = createRng(`${seed}:roulette-v4`);
    return {
      tick: 0,
      status: "running",
      score: 0,
      failure: null,
      height: ROULETTE_RULES_V4.startMinor,
      wheelPhase: rng.nextInt(65_536),
      wheelSpeed: 45 + rng.nextInt(21),
      ballX: ROULETTE_RULES_V4.releaseX,
      ballY: ROULETTE_RULES_V4.releaseY,
      ballZ: ROULETTE_RULES_V4.releaseZ,
      ballVx: 0,
      ballVy: 0,
      ballVz: 0,
      flightStart: -1,
      landingTick: -1,
      inBowl: false,
      contacts: 0,
      rimRebounds: 0,
      releaseX: ROULETTE_RULES_V4.releaseX,
      releaseY: ROULETTE_RULES_V4.releaseY,
      launchDirection: 20,
      launchImpulse: 8,
      bet: "RED",
      lockedBet: "RED",
      balanceMinor: ROULETTE_RULES_V4.startMinor,
      spins: 0,
      lastNumber: null,
      lastPayout: 0,
      lastInputTick: -3,
      lastLandingTick: -1000,
      lastMiss: false,
    };
  },
  canApply(state, action) {
    if (
      state.status !== "running" ||
      state.landingTick !== -1 ||
      !ROULETTE_ACTIONS_V2.includes(action)
    )
      return false;
    return (
      !action.startsWith("TOSS_") ||
      (state.balanceMinor >= ROULETTE_RULES_V4.costMinor &&
        state.tick + ROULETTE_RULES_V4.maximumFlightTicks <=
          ROULETTE_RULES_V4.maxFinalTick)
    );
  },
  apply(state, action) {
    state.lastInputTick = state.tick;
    if (action.startsWith("BET_")) {
      state.bet = action.slice(4);
      return;
    }
    if (action.startsWith("RELEASE_X_")) {
      state.releaseX = Number(action.slice(10)) * 10_000;
      return;
    }
    if (action.startsWith("RELEASE_Y_")) {
      state.releaseY = Number(action.slice(10)) * 10_000;
      return;
    }
    const direction = Number(action.slice(6, 8)),
      impulse = Number(action.slice(10, 12)),
      velocity = rouletteTossVelocityV4(direction, impulse);
    state.launchDirection = direction;
    state.launchImpulse = impulse;
    state.ballX = state.releaseX;
    state.ballY = state.releaseY;
    state.ballZ = ROULETTE_RULES_V4.releaseZ;
    state.ballVx = velocity.vx;
    state.ballVy = velocity.vy;
    state.ballVz = velocity.vz;
    state.inBowl = false;
    state.contacts = 0;
    state.rimRebounds = 0;
    state.flightStart = state.tick;
    state.landingTick = state.tick + ROULETTE_RULES_V4.maximumFlightTicks;
    state.lockedBet = state.bet;
    state.balanceMinor -= ROULETTE_RULES_V4.costMinor;
    state.height = state.balanceMinor;
    state.spins++;
    state.lastPayout = 0;
    state.lastMiss = false;
  },
  step(state) {
    state.tick++;
    state.wheelPhase =
      (state.wheelPhase + state.wheelSpeed) % 65_536;
    if (state.landingTick !== -1) moveBall(state);
    if (
      state.tick === ROULETTE_RULES_V4.maxFinalTick &&
      state.status === "running"
    )
      finish(state);
  },
};
