/**
 * V17 (owner request, 5-nov-2026: "simulate realistically how the ball would move; earlier versions were more
 * precise"). V16 let the swipe's full velocity into the wheel, so most aims (radial to the centre) crossed the track in
 * two ticks, and a ball running fast into a diamond could rebound backwards: spins of about 3 s, very few riding the
 * track. V17 keeps the player's throw and makes its motion physical in three dimensions:
 *  - the flight from the cradle is a real ballistic arc: released 13 mm above the track (the cradle sits on the rim),
 *    tossed up just enough to clear the rim, under the wheel's gravity; it comes over the rim still in the air;
 *  - the ball drops into the track's groove (the channel between the wall and the banked track) like a croupier's
 *    spin: the swipe's part along the track gives the speed and the sense (V15's range: 1.2–2.7 turns per second,
 *    at least 45 % of the power along the track), and only an eighth of its inward part survives the groove;
 *  - while airborne the ball's height follows the real bowl: when it moves inwards over a surface that falls away it
 *    is higher above it, when the surface rises (the cone) it lands sooner;
 *  - a diamond knocks the ball (slows it, throws it up and sideways) but never sends it back along the track.
 * Bets, payouts, the rotor, the frets, the pocket floor and the rest of the in-wheel physics are V15's; V1–V16 stay as
 * they were.
 */
import { createRng } from "../deterministic/seeded";
import { integerSqrt, roundDiv } from "../deterministic/integerMath";
import {
  ROULETTE_CORE_V15, type RouletteRulesV15, ROULETTE_WHEEL, ROULETTE_RED, rotorAngle, rouletteSettleV15,
  rouletteChipReturn, rouletteStake, rouletteBetStake, roulettePocketAt, type RouletteStateV15,
} from "./galacticRouletteCore.v15";
import { ROULETTE_RULES_V16, ROULETTE_THROWS_V16 } from "./galacticRouletteCore.v16";
import type { GameCore } from "./coreRuntime.v1";
export { ROULETTE_WHEEL, ROULETTE_RED, ROULETTE_THROWS_V16, rouletteChipReturn, rouletteStake, rouletteBetStake, roulettePocketAt };
export type RouletteStateV17 = RouletteStateV15;

const TAU = 62831853;
const SUB = 4;
const MM = 1_000_000;
export const ROULETTE_RULES_V17 = {
  ...ROULETTE_RULES_V16,
  throwSpeedMin: 2_200_000, // nm per substep at power 0 along the track (V15's croupier range)
  throwSpeedStep: 187_000,
  throwTangentMin: 450, // milli of the power kept along the track whatever the aim
  grooveKeepDiv: 8, // the inward part of the throw that survives the groove (1/8)
  releaseHeight: 13 * MM, // ball bottom above the track at the wall, in the cradle on the rim
  rimHeight: 9_200_000, // the rim's top above the track at the wall
  tossLift: 40_000, // nm per substep up, on top of what clears the rim on a symmetric arc
  diamondKeepMilli: 300, // a ball knocked head-on by a diamond keeps this much of its run, never reversed
};
const R = ROULETTE_RULES_V17;
const throwOf = (a: string) => ({ direction: Number(a.slice(6, 8)), power: Number(a.slice(10, 12)) });
const speedOf = (power: number) => R.throwSpeedMin + power * R.throwSpeedStep;
/** Cradle → rim flight in µm per tick (four substeps) and its length in ticks. */
const flightStep = (power: number) => roundDiv(speedOf(power) * SUB, 1000);
const flightTicks = (direction: number, power: number) => Math.ceil(ROULETTE_THROWS_V16[direction][0] / flightStep(power));
/** 0…1 along the cradle flight; 1 once it is in the wheel. */
export const rouletteFlightProgressV17 = (s: RouletteStateV17) => {
  const entry = ROULETTE_THROWS_V16[s.launchDirection];
  return s.ballPhase !== 0 || !entry ? 1 : Math.min(1, ((s.tick - s.flightStart) * flightStep(s.launchImpulse)) / entry[0]);
};
export const rouletteAimReachesV17 = (direction: number) => ROULETTE_THROWS_V16[direction] !== undefined;

const mod = (a: number, m: number) => ((a % m) + m) % m;
const wrap = (a: number) => { const x = mod(a, TAU); return x > TAU / 2 ? x - TAU : x; };
const rotorSpeed = (s: RouletteStateV17, r: number) => roundDiv(roundDiv(s.wheelSpeed * TAU, 65536 * SUB) * r, 10_000_000);
const slopeAt = (Q: RouletteRulesV15, r: number) =>
  r >= Q.trackInner ? Q.slopeTrack : r >= Q.rotorEdge ? Q.slopeStator : r >= Q.lipTop ? Q.slopeRotor
    : r >= Q.floorOut ? Q.slopeLip : r >= Q.floorIn ? roundDiv((r - (Q.floorIn + Q.floorOut) / 2) * 800, Q.floorOut - Q.floorIn) : Q.slopeCone;
/** Height of the bowl's surface (nm) at radius r, 0 at the pocket floor's outer edge: the integral of slopeAt. */
export function rouletteSurfaceV17(r: number, Q: RouletteRulesV15 = R) {
  const lin = (from: number, to: number, slope: number) => roundDiv((to - from) * slope, 1000);
  const lip = lin(Q.floorOut, Q.lipTop, Q.slopeLip), rot = lin(Q.lipTop, Q.rotorEdge, Q.slopeRotor), sta = lin(Q.rotorEdge, Q.trackInner, Q.slopeStator);
  if (r >= Q.trackInner) return lip + rot + sta + lin(Q.trackInner, r, Q.slopeTrack);
  if (r >= Q.rotorEdge) return lip + rot + lin(Q.rotorEdge, r, Q.slopeStator);
  if (r >= Q.lipTop) return lip + lin(Q.lipTop, r, Q.slopeRotor);
  if (r >= Q.floorOut) return lin(Q.floorOut, r, Q.slopeLip);
  const mid = (Q.floorIn + Q.floorOut) / 2, half = (Q.floorOut - Q.floorIn) / 2;
  // The dished floor: slope 0.8·(r−mid)/(2·half) per mm → height 0.4·((r−mid)² − half²)/(2·half).
  if (r >= Q.floorIn) return roundDiv(roundDiv((r - mid) ** 2 - half ** 2, 2 * half) * 400, 1000);
  return lin(r, Q.floorIn, -Q.slopeCone);
}

/** Moves the ball by its radial velocity, keeping its angular momentum (r × v_t). */
function moveRadially(s: RouletteStateV17, r: number) {
  const next = Math.max(R.fretInner, Math.min(R.wallR, r + s.ballVr));
  if (next !== r) s.ballVt = roundDiv(s.ballVt * r, next);
  s.ballR = next;
}
function land(s: RouletteStateV17, rotor: boolean, pocket: boolean) {
  s.ballZ = 0;
  const rest = pocket ? R.floorRestMilli.pocket : rotor ? R.floorRestMilli.rotor : R.floorRestMilli.stator;
  s.ballVz = -s.ballVz > R.bounceMin ? roundDiv(-s.ballVz * rest, 1000) : 0;
  s.contacts++;
}

/** One 480 Hz substep: V15's in-wheel model, with the airborne height kept over the real bowl and diamonds that knock
 * the ball without reversing it. */
export function rouletteSubstepV17(s: RouletteStateV17, k: number) {
  const g = R.gravity;
  let r = s.ballR;
  const rotor = r < R.rotorEdge, pocket = r < R.lipTop && r >= R.floorIn;
  const grounded = s.ballZ === 0 && s.ballVz <= 0;
  const centripetal = roundDiv(s.ballVt * s.ballVt, r);
  const slopePull = grounded ? roundDiv(g * slopeAt(R, r) * 5, 7000) : 0;
  s.ballVr += centripetal - slopePull;
  const drag = roundDiv(s.ballVt * s.ballVt, R.airDen);
  s.ballVt -= Math.sign(s.ballVt) * drag;
  if (grounded) {
    if (rotor) {
      const v = rotorSpeed(s, r), slip = s.ballVt - v;
      s.ballVt = v + slip - roundDiv(slip * (pocket ? R.pocketGripPpm : R.rotorGripPpm), 1_000_000);
    } else if (Math.abs(s.ballVt) > R.rollStator) s.ballVt -= Math.sign(s.ballVt) * R.rollStator;
    s.ballVr -= roundDiv(s.ballVr * (pocket ? R.pocketGripPpm : R.radialDampPpm), 1_000_000);
  }
  const before = r;
  moveRadially(s, r);
  r = s.ballR;
  // In the air the ball keeps its absolute height: over a surface that falls away it is higher above it.
  if (!grounded && r !== before) {
    s.ballZ += rouletteSurfaceV17(before) - rouletteSurfaceV17(r);
    if (s.ballZ <= 0 && s.ballVz <= 0) land(s, r < R.rotorEdge, r < R.lipTop && r >= R.floorIn);
    else if (s.ballZ <= 0) s.ballZ = 1;
  }
  if (r >= R.wallR && s.ballVr >= 0) {
    const press = centripetal - slopePull;
    if (press > 0) s.ballVt -= Math.sign(s.ballVt) * Math.min(Math.abs(s.ballVt), roundDiv(press * R.wallMuPpm, 1_000_000));
    s.ballVr = s.ballVr > 3 * Math.max(press, 0) + 60_000 ? -roundDiv(s.ballVr * R.wallRestMilli, 1000) : 0;
  }
  if (r <= R.turretR && s.ballZ < 4 * MM && s.ballVr < 0) {
    s.ballVr = -roundDiv(s.ballVr * R.turretRestMilli, 1000);
    s.ballR = R.turretR;
    s.contacts++;
  }
  s.ballTheta = mod(s.ballTheta + roundDiv(s.ballVt * 10_000_000, r), TAU);
  if (s.ballZ > 0 || s.ballVz > 0) {
    s.ballVz -= g;
    s.ballZ += s.ballVz;
    if (s.ballZ <= 0) land(s, r < R.rotorEdge, r < R.lipTop && r >= R.floorIn);
  }
  if (Math.abs(r - R.diamondR) < R.diamondReach && s.ballZ < R.diamondTop) {
    const i = mod(roundDiv(s.ballTheta * 8, TAU), 8);
    const dr = r - R.diamondR, dt = roundDiv(wrap(s.ballTheta - roundDiv(i * TAU, 8)) * r, 10_000_000);
    const dist = integerSqrt(dr * dr + dt * dt);
    if (dist > 0 && dist < R.diamondReach) {
      const vn = roundDiv(s.ballVr * dr + s.ballVt * dt, dist);
      if (vn < 0) {
        const run = s.ballVt;
        const change = vn + roundDiv(vn * R.diamondRestMilli, 1000);
        s.ballVr -= roundDiv(change * dr, dist);
        s.ballVt -= roundDiv(change * dt, dist);
        // A head-on knock slows the run and throws the ball up; it never turns it back along the track.
        if (Math.sign(s.ballVt) !== Math.sign(run) && run !== 0) s.ballVt = roundDiv(run * R.diamondKeepMilli, 1000);
        s.ballVz = Math.max(s.ballVz, Math.min(R.diamondHopMax, roundDiv(-vn * R.diamondHopMilli, 1000)));
        if (s.ballVz > 0 && s.ballZ === 0) s.ballZ = 1;
        s.diamonds++;
        s.contacts++;
        s.lastDiamond = i;
        s.lastDiamondTick = s.tick;
      }
      s.ballR = R.diamondR + roundDiv(dr * R.diamondReach, dist);
      s.ballTheta = mod(roundDiv(i * TAU, 8) + roundDiv(roundDiv(dt * R.diamondReach, dist) * 10_000_000, s.ballR), TAU);
      r = s.ballR;
    }
  }
  const phi = s.ballTheta - rotorAngle(s, k + 1);
  const pocketIndex = roulettePocketAt(phi);
  s.ringPocket = pocketIndex;
  if (r >= R.fretInner && r <= R.fretOuter && s.ballZ < R.fretHeight) {
    const offset = wrap(phi - roundDiv(pocketIndex * TAU, 37));
    const limit = roundDiv(TAU, 74) - roundDiv((R.ballRadiusNm + R.fretHalf) * 10_000_000, r);
    if (Math.abs(offset) > limit) {
      const side = Math.sign(offset), v = rotorSpeed(s, r), rel = s.ballVt - v;
      if (Math.sign(rel) === side && Math.abs(rel) > R.fretRestingSpeed) {
        s.ballVt = v - roundDiv(rel * R.fretRestMilli, 1000);
        s.ballVz = Math.max(s.ballVz, Math.min(R.fretHopMax, roundDiv(Math.abs(rel) * R.fretHopMilli, 1000)));
        if (s.ballVz > 0 && s.ballZ === 0) s.ballZ = 1;
        s.frets++;
        s.contacts++;
      } else if (Math.sign(rel) === side) s.ballVt = v;
      s.ballTheta = mod(s.ballTheta + (side * limit - offset), TAU);
    }
  }
  const still = s.ballZ === 0 && s.ballVz === 0 && r <= R.floorOut + MM && r >= R.floorIn - MM
    && Math.abs(s.ballVt - rotorSpeed(s, r)) <= R.stillSpeed && Math.abs(s.ballVr) <= R.stillSpeed;
  s.stillSubs = still ? s.stillSubs + 1 : 0;
  if (s.stillSubs >= R.stillSubsteps) rouletteSettleV15(s, s.ballTheta - rotorAngle(s, k + 1));
}

function stepBall(s: RouletteStateV17) {
  if (s.ballPhase === 0) {
    const [distance, theta, radial, tangent, ux, uy] = ROULETTE_THROWS_V16[s.launchDirection];
    const travelled = Math.min(distance, (s.tick - s.flightStart) * flightStep(s.launchImpulse));
    s.ballX = R.releaseX + roundDiv(ux * travelled, 1_000_000);
    s.ballY = R.releaseY + roundDiv(uy * travelled, 1_000_000);
    // Ballistic height (ball bottom above the track at the wall).
    for (let k = 0; k < SUB; k++) { s.ballVz -= R.gravity; s.ballZ += s.ballVz; }
    if (travelled < distance) return;
    // Over the rim and into the groove: the run along the track carries the throw (croupier-like), a little of its
    // inward part survives; the ball is still in the air and drops onto the track.
    const v = speedOf(s.launchImpulse);
    const along = Math.max(R.throwTangentMin * 1000, Math.abs(tangent));
    const sense = tangent > 0 ? 1 : tangent < 0 ? -1 : s.wheelSpeed > 0 ? -1 : 1;
    s.ballPhase = 1;
    s.inBowl = true;
    s.ballTheta = theta;
    s.ballR = R.wallR;
    s.ballVt = sense * roundDiv(v * along, 1_000_000);
    s.ballVr = radial < 0 ? roundDiv(roundDiv(v * radial, 1_000_000), R.grooveKeepDiv) : 0;
    s.ballZ = Math.max(1, s.ballZ);
    return;
  }
  for (let k = 0; k < SUB && s.ballPhase === 1; k++) rouletteSubstepV17(s, k);
  if (s.ballPhase === 1 && s.tick >= s.landingTick) rouletteSettleV15(s, s.ballTheta - rotorAngle(s, SUB));
}

export const ROULETTE_CORE_V17: GameCore<RouletteStateV17> = {
  ...ROULETTE_CORE_V15,
  gameVersion: "17.0.0",
  content: {
    ...(ROULETTE_CORE_V15.content as Record<string, unknown>),
    rules: ROULETTE_RULES_V17,
    launch: "SWIPE_FROM_THE_CRADLE_BALLISTIC_ARC_OVER_THE_RIM_INTO_THE_TRACK_GROOVE_RUN_ALONG_THE_TRACK",
    outcome: "V15_POLAR_PHYSICS_AIRBORNE_HEIGHT_OVER_THE_REAL_BOWL_DIAMONDS_KNOCK_WITHOUT_REVERSING_REST_IN_POCKET",
  },
  create(seed) {
    const s = ROULETTE_CORE_V15.create(seed);
    const rng = createRng(`${seed}:roulette-v17`);
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
    // V15's apply has charged the stake, locked the chips and started the flight (ballPhase 0); V17 flies it: from
    // the cradle, tossed so that a symmetric arc lands back at the release height on reaching the wall, plus a lift.
    const { direction, power } = throwOf(a), n = flightTicks(direction, power) * SUB;
    s.ballZ = R.releaseHeight;
    s.ballVz = roundDiv(R.gravity * (n + 1), 2) + R.tossLift;
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
