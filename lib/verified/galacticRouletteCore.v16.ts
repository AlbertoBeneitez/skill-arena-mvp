/**
 * V16 (owner request, 1-nov-2026): the throw is a real throw. V15 put the ball on the track already circling, with
 * a minimum speed. In V16 the ball leaves the launcher in a straight line with the swipe's direction and power and
 * enters the wheel over the rim with exactly that velocity. Nothing turns it but the physics: the outer wall it hits
 * (impact, bounce, loss), the banked track, the stator, the diamonds, the counter-rotating rotor and the frets, until
 * friction leaves it in a pocket. A throw aimed straight at the centre makes a short, chaotic spin; one along the
 * track rides the wall for many turns. Only aims that reach the wheel are throws (9 of the 32 directions from the
 * launcher). The in-wheel physics, bets and payouts are V15's, unchanged; V1–V15 stay as they were.
 */
import { createRng } from "../deterministic/seeded";
import { roundDiv } from "../deterministic/integerMath";
import {
  ROULETTE_RULES_V15, ROULETTE_CORE_V15, type RouletteRulesV15, ROULETTE_WHEEL, ROULETTE_RED, rotorAngle, rouletteSettleV15, rouletteSubstepV15,
  rouletteChipReturn, rouletteStake, rouletteBetStake, roulettePocketAt, type RouletteStateV15,
} from "./galacticRouletteCore.v15";
import { ROULETTE_ACTIONS_V8 } from "./galacticRouletteProtocol.v8";
import type { GameCore } from "./coreRuntime.v1";
export { ROULETTE_WHEEL, ROULETTE_RED, rouletteChipReturn, rouletteStake, rouletteBetStake, roulettePocketAt };
export type RouletteStateV16 = RouletteStateV15;

/**
 * Where each aim that reaches the wheel crosses the rim (ball centre at the wall radius): distance from the launcher
 * (µm), angle (1e-7 rad clockwise from 12 o'clock), the throw's radial and clockwise-tangential parts there, and the
 * aim's screen direction (ppm).
 * Computed once from the launcher position and the protocol's 32 directions (scripts/verify-roulette-v16.ts checks it).
 */
export const ROULETTE_THROWS_V16: Readonly<Record<number, readonly [number, number, number, number, number, number]>> = {
  16: [82068, 28136409, -322105, 946704, -1000000, 0],
  17: [57988, 26192282, -659794, 751447, -980427, -196885],
  18: [49048, 25228079, -848443, 529286, -923284, -384118],
  19: [44887, 24523577, -957621, 288031, -831279, -555855],
  20: [43455, 23909122, -999397, 34711, -707107, -707107],
  21: [44264, 23304495, -975514, -219939, -555855, -831279],
  22: [47573, 22635836, -885254, -465108, -384118, -923284],
  23: [54843, 21768626, -720308, -693655, -196885, -980427],
  24: [72145, 20272626, -440779, -897616, 0, -1000000],
};
export const ROULETTE_RULES_V16: RouletteRulesV15 & { throwSpeedMin: number; throwSpeedStep: number; entryHeight: number; entryFall: number } = {
  ...ROULETTE_RULES_V15,
  throwSpeedMin: 2_600_000, // nm per substep at power 0 (≈ 1.4 turns per second along the wall)
  throwSpeedStep: 230_000, // per power step, up to ≈ 3.3 turns per second at power 15
  entryHeight: 1_500_000, // the ball clears the rim and drops straight onto the banked track
  entryFall: 40_000,
  // Small deflectors on the lower stator (a real diamond is about 6 mm on this scale): the ball rolling on the track
  // passes outside them and meets them as it comes down; a glancing knock rather than a wall.
  diamondReach: 7_600_000,
  diamondRestMilli: 450,
};
const R = ROULETTE_RULES_V16;
const SUB = 4;
const throwOf = (a: string) => ({ direction: Number(a.slice(6, 8)), power: Number(a.slice(10, 12)) });
const speedOf = (power: number) => R.throwSpeedMin + power * R.throwSpeedStep;
/** Launcher flight in µm per tick (four substeps). */
const flightStep = (power: number) => roundDiv(speedOf(power) * SUB, 1000);
/** 0…1 along the launcher flight (for drawing the ball's hop); 1 once it is in the wheel. */
export const rouletteFlightProgressV16 = (s: RouletteStateV16) => {
  const entry = ROULETTE_THROWS_V16[s.launchDirection];
  return s.ballPhase !== 0 || !entry ? 1 : Math.min(1, ((s.tick - s.flightStart) * flightStep(s.launchImpulse)) / entry[0]);
};
/** Whether an aim (0–31) reaches the wheel from the launcher. */
export const rouletteAimReachesV16 = (direction: number) => ROULETTE_THROWS_V16[direction] !== undefined;

function stepBall(s: RouletteStateV16) {
  if (s.ballPhase === 0) {
    const [distance, theta, radial, tangent, ux, uy] = ROULETTE_THROWS_V16[s.launchDirection];
    const travelled = Math.min(distance, (s.tick - s.flightStart) * flightStep(s.launchImpulse));
    // Straight flight from the launcher along the aim (screen µm).
    s.ballX = R.releaseX + roundDiv(ux * travelled, 1_000_000);
    s.ballY = R.releaseY + roundDiv(uy * travelled, 1_000_000);
    if (travelled < distance) return;
    // Over the rim: the same velocity, now split into its radial and tangential parts at the entry point.
    const v = speedOf(s.launchImpulse);
    s.ballPhase = 1;
    s.inBowl = true;
    s.ballTheta = theta;
    s.ballR = R.wallR;
    s.ballVr = roundDiv(v * radial, 1_000_000);
    s.ballVt = roundDiv(v * tangent, 1_000_000);
    s.ballZ = R.entryHeight;
    s.ballVz = -R.entryFall;
    return;
  }
  for (let k = 0; k < SUB && s.ballPhase === 1; k++) rouletteSubstepV15(s, k, R);
  if (s.ballPhase === 1 && s.tick >= s.landingTick) rouletteSettleV15(s, s.ballTheta - rotorAngle(s, SUB));
}

export const ROULETTE_CORE_V16: GameCore<RouletteStateV16> = {
  ...ROULETTE_CORE_V15,
  gameVersion: "16.0.0",
  content: {
    ...(ROULETTE_CORE_V15.content as Record<string, unknown>),
    rules: ROULETTE_RULES_V16,
    launch: "STRAIGHT_THROW_FROM_THE_LAUNCHER_SWIPE_DIRECTION_AND_POWER_ONLY_AIMS_THAT_REACH_THE_WHEEL",
    outcome: "REAL_THROW_INTO_THE_WHEEL_THEN_V15_POLAR_PHYSICS_WALL_IMPACT_FRICTION_DIAMONDS_ROTOR_FRETS_REST_IN_POCKET",
  },
  create(seed) {
    const s = ROULETTE_CORE_V15.create(seed);
    const rng = createRng(`${seed}:roulette-v16`);
    s.wheelPhase = rng.nextInt(65536);
    s.wheelSpeed = R.wheelSpeedMin + rng.nextInt(R.wheelSpeedRange);
    return s;
  },
  canApply(s, a) {
    if (!ROULETTE_CORE_V15.canApply(s, a)) return false;
    return !a.startsWith("TOSS_") || ROULETTE_THROWS_V16[throwOf(a).direction] !== undefined;
  },
  apply(s, a) {
    ROULETTE_CORE_V15.apply(s, a);
    if (!a.startsWith("TOSS_")) return;
    // V15's apply has charged the stake, locked the chips and started the flight (ballPhase 0); V16 flies it.
    s.ballZ = 0;
    s.ballVz = 0;
  },
  step(s) {
    s.tick++;
    s.wheelPhase = (s.wheelPhase + s.wheelSpeed) % 65536;
    if (s.landingTick !== -1) stepBall(s);
    if (s.tick === R.maxFinalTick && s.status === "running") {
      s.score = s.balanceMinor; s.height = s.balanceMinor;
      s.status = s.balanceMinor === 0 ? "failed" : "won";
      s.failure = s.balanceMinor === 0 ? "EMPTY_BALANCE" : null;
    }
  },
};
