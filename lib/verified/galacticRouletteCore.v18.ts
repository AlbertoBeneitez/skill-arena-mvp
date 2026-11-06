/**
 * V18 (owner request, 6-nov-2026: "I don't want the circular run of a real wheel; simulate what would happen if the
 * player throws the ball, following a parabolic path in height too"). The ball is lobbed, not spun:
 *  - from the cradle it flies a true 3D parabola (x, y and height under the wheel's gravity) and lands in the bowl
 *    where the throw sends it: the swipe's direction is the line of the throw, its power how far along that line
 *    (from just inside the near rim to near the far wall) and how high and long the lob (0.31–0.5 s in the air);
 *  - it bounces on the real bowl (track, stator, rotor, pocket floor and cone, each with the height and slope the core
 *    has always used) off the surface's true normal, losing energy each time and picking up the turning rotor's
 *    motion when it lands on it; the outer wall sends it back in, the diamonds knock it;
 *  - once its bounces die out it rolls on the surface with V17's in-wheel physics (no reversal off a diamond), down
 *    into the pockets, rattles off the frets and settles.
 * Bets, payouts and the rest are V15's; V1–V17 stay as they were.
 */
import { integerSqrt, roundDiv, sinPhaseMilli } from "../deterministic/integerMath";
import { createRng } from "../deterministic/seeded";
import {
  ROULETTE_CORE_V17, ROULETTE_RULES_V17, ROULETTE_THROWS_V16, ROULETTE_WHEEL, ROULETTE_RED, rouletteSubstepV17,
  rouletteSurfaceV17, rouletteChipReturn, rouletteStake, rouletteBetStake, roulettePocketAt, type RouletteStateV17,
} from "./galacticRouletteCore.v17";
import { rouletteSettleV15, rotorAngle } from "./galacticRouletteCore.v15";
import type { GameCore } from "./coreRuntime.v1";
export { ROULETTE_WHEEL, ROULETTE_RED, ROULETTE_THROWS_V16, rouletteChipReturn, rouletteStake, rouletteBetStake, roulettePocketAt, rouletteSurfaceV17 };

/** V18 adds the lob's exact plane position (nm) and plane velocity (nm per substep). */
export type RouletteStateV18 = RouletteStateV17 & { ballPx: number; ballPy: number; ballVx: number; ballVy: number };

const TAU = 62831853;
const SUB = 4;
const MM = 1_000_000;
const R17 = ROULETTE_RULES_V17;
export const ROULETTE_RULES_V18 = {
  ...R17,
  /** Rim top above the pocket floor (nm): the table the cradle stands on. */
  rimTop: rouletteSurfaceV17(R17.wallR) + R17.rimHeight,
  releaseLift: 4 * MM, // the ball sits this high in the cradle
  lobSubsteps: 150, // time in the air at power 0 (480 Hz substeps): 0.31 s, up to 0.5 s at power 15
  lobSubstepsPerPower: 6,
  /** Bounce restitution of the lob on each surface (a hard ball on lacquered wood and on the pocket floor). */
  lobRestMilli: { stator: 560, rotor: 520, pocket: 420 },
  reachMinMilli: 80, // landing point along the throw's chord through the wheel: 8 % … 92 %
  reachSpanMilli: 840,
  impactKeepMilli: 850, // surface-parallel speed kept through an impact
  rollHandover: 120_000, // a bounce weaker than this (≈ 0.5 mm hop) becomes rolling
  wallRestMilli: 450,
};
const R = ROULETTE_RULES_V18;
const CX = R.centerX * 1000, CY = R.centerY * 1000; // nm
const throwOf = (a: string) => ({ direction: Number(a.slice(6, 8)), power: Number(a.slice(10, 12)) });

/** Where each throw's line enters and leaves the wheel (µm from the cradle), for the 9 aims that cross it. */
const CHORDS: Readonly<Record<number, readonly [number, number]>> = Object.freeze(Object.fromEntries(
  Object.entries(ROULETTE_THROWS_V16).map(([d, e]) => {
    const ux = e[4], uy = e[5], dx = R.releaseX - R.centerX, dy = R.releaseY - R.centerY, wall = roundDiv(R.wallR, 1000);
    const b = roundDiv(ux * dx + uy * dy, 1_000_000), c = dx * dx + dy * dy - wall * wall, root = integerSqrt(Math.max(0, b * b - c));
    return [Number(d), [-b - root, -b + root] as const];
  }),
));
/** The lob of a throw: landing point (µm, screen plane), time in the air (substeps) and launch velocity (nm/substep). */
export function rouletteLobV18(direction: number, power: number) {
  const e = ROULETTE_THROWS_V16[direction], chord = CHORDS[direction];
  if (!e || !chord) return null;
  const reach = chord[0] + roundDiv((chord[1] - chord[0]) * (R.reachMinMilli + roundDiv(R.reachSpanMilli * power, 15)), 1000);
  const x = R.releaseX + roundDiv(e[4] * reach, 1_000_000), y = R.releaseY + roundDiv(e[5] * reach, 1_000_000);
  const n = R.lobSubsteps + power * R.lobSubstepsPerPower;
  const rx = (x - R.centerX) * 1000, ry = (y - R.centerY) * 1000;
  const landR = integerSqrt(roundDiv(rx, 1000) ** 2 + roundDiv(ry, 1000) ** 2) * 1000;
  const h0 = R.rimTop + R.releaseLift, h1 = rouletteSurfaceV17(Math.min(landR, R.wallR));
  return {
    x, y, substeps: n,
    vx: roundDiv(e[4] * reach, 1000 * n), vy: roundDiv(e[5] * reach, 1000 * n),
    vz: roundDiv(h1 - h0 + roundDiv(R.gravity * n * (n + 1), 2), n),
  };
}
export const rouletteAimReachesV18 = (direction: number) => CHORDS[direction] !== undefined;

const slopeAt = (r: number) =>
  r >= R.trackInner ? R.slopeTrack : r >= R.rotorEdge ? R.slopeStator : r >= R.lipTop ? R.slopeRotor
    : r >= R.floorOut ? R.slopeLip : r >= R.floorIn ? roundDiv((r - (R.floorIn + R.floorOut) / 2) * 800, R.floorOut - R.floorIn) : R.slopeCone;
const rotorSpeed = (s: RouletteStateV18, r: number) => roundDiv(roundDiv(s.wheelSpeed * 62831853, 65536 * SUB) * r, 10_000_000);
const mod = (a: number, m: number) => ((a % m) + m) % m;
/** atan2 for the plane, clockwise from 12 o'clock, in 1e-7 rad (integer; max error ≈ 1.5e-3 rad). */
function clockAngle(dx: number, dy: number) {
  // angle of (east = dx, north = −dy) measured clockwise from north = atan2(dx, −dy)
  const ax = Math.abs(dx), ay = Math.abs(dy);
  if (ax === 0 && ay === 0) return 0;
  const swap = ax > ay, z = swap ? roundDiv(ay * 1_000_000, ax) : roundDiv(ax * 1_000_000, ay); // ppm, 0…1
  // atan(z) ≈ π/4·z − z(z−1)(0.2447 + 0.0663 z)
  let a = roundDiv(7853982 * z, 1_000_000) - roundDiv(roundDiv(z * (z - 1_000_000), 1_000_000) * (2447000 + roundDiv(663000 * z, 1_000_000)), 1_000_000);
  if (swap) a = 15707963 - a; // angle from north towards east when |dx| > |dy|
  // a is the angle from the north axis in the first quadrant; place it by the signs
  if (dy > 0) a = 31415927 - a; // southern half
  return mod(dx < 0 ? -a : a, TAU);
}
const DIAMONDS: readonly [number, number][] = Object.freeze(Array.from({ length: 8 }, (_, i) => [
  CX + roundDiv(sinPhaseMilli(i * 512) * R.diamondR, 1000), CY - roundDiv(sinPhaseMilli(i * 512 + 1024) * R.diamondR, 1000),
] as [number, number]));

function startRolling(s: RouletteStateV18, dx: number, dy: number, r: number) {
  s.ballPhase = 1;
  s.ballR = Math.max(R.fretInner, Math.min(R.wallR, r));
  s.ballTheta = clockAngle(dx, dy);
  s.ballVr = roundDiv(s.ballVx * dx + s.ballVy * dy, r);
  s.ballVt = roundDiv(-s.ballVx * dy + s.ballVy * dx, r);
  s.ballZ = 0; s.ballVz = 0; s.stillSubs = 0;
}
/** One 480 Hz substep of the lob and its bounces. */
export function rouletteLobSubstepV18(s: RouletteStateV18) {
  s.ballVz -= R.gravity;
  s.ballPx += s.ballVx; s.ballPy += s.ballVy; s.ballZ += s.ballVz;
  s.ballX = roundDiv(s.ballPx, 1000); s.ballY = roundDiv(s.ballPy, 1000);
  let dx = s.ballPx - CX, dy = s.ballPy - CY;
  let r = Math.max(1000, integerSqrt(roundDiv(dx, 1000) ** 2 + roundDiv(dy, 1000) ** 2) * 1000);
  if (!s.inBowl) { if (r <= R.wallR) s.inBowl = true; else return; }
  // The outer wall sends it back in.
  if (r > R.wallR) {
    const vr = roundDiv(s.ballVx * dx + s.ballVy * dy, r);
    if (vr > 0) {
      const k = vr + roundDiv(vr * R.wallRestMilli, 1000);
      s.ballVx -= roundDiv(k * dx, r); s.ballVy -= roundDiv(k * dy, r);
      s.contacts++;
    }
    s.ballPx = CX + roundDiv(dx * R.wallR, r); s.ballPy = CY + roundDiv(dy * R.wallR, r);
    dx = s.ballPx - CX; dy = s.ballPy - CY; r = R.wallR;
  }
  const floor = rouletteSurfaceV17(r);
  // Diamonds: low deflectors on the stator, met in the plane while the ball is near the surface.
  if (s.ballZ - floor < R.diamondTop) DIAMONDS.forEach(([qx, qy], i) => {
    const ex = s.ballPx - qx, ey = s.ballPy - qy, d = integerSqrt(roundDiv(ex, 1000) ** 2 + roundDiv(ey, 1000) ** 2) * 1000;
    if (d <= 0 || d >= R.diamondReach) return;
    const vn = roundDiv(s.ballVx * ex + s.ballVy * ey, d);
    if (vn < 0) {
      const k = vn + roundDiv(vn * R.diamondRestMilli, 1000);
      s.ballVx -= roundDiv(k * ex, d); s.ballVy -= roundDiv(k * ey, d);
      s.ballVz = Math.max(s.ballVz, Math.min(R.diamondHopMax, roundDiv(-vn * R.diamondHopMilli, 1000)));
      s.diamonds++; s.contacts++; s.lastDiamond = i; s.lastDiamondTick = s.tick;
    }
    s.ballPx = qx + roundDiv(ex * R.diamondReach, d); s.ballPy = qy + roundDiv(ey * R.diamondReach, d);
  });
  if (s.ballZ > floor) return;
  // Impact on the bowl: reflect off the surface's normal (−dH/dr along the radius, 1 up).
  const slope = slopeAt(r);
  const nx = -roundDiv(slope * dx, r), ny = -roundDiv(slope * dy, r), nz = 1000, nn = integerSqrt(nx * nx + ny * ny + nz * nz);
  const vn = roundDiv(s.ballVx * nx + s.ballVy * ny + s.ballVz * nz, nn);
  s.ballZ = floor;
  if (vn >= 0) return;
  const onRotor = r < R.rotorEdge, pocket = r < R.lipTop && r >= R.floorIn;
  const w = onRotor ? rotorSpeed(s, r) : 0, wx = -roundDiv(w * dy, r), wy = roundDiv(w * dx, r);
  const vnx = roundDiv(vn * nx, nn), vny = roundDiv(vn * ny, nn), vnz = roundDiv(vn * nz, nn);
  const rest = pocket ? R.lobRestMilli.pocket : onRotor ? R.lobRestMilli.rotor : R.lobRestMilli.stator;
  const out = roundDiv(-vn * rest, 1000);
  s.ballVx = wx + roundDiv((s.ballVx - vnx - wx) * R.impactKeepMilli, 1000) + roundDiv(out * nx, nn);
  s.ballVy = wy + roundDiv((s.ballVy - vny - wy) * R.impactKeepMilli, 1000) + roundDiv(out * ny, nn);
  s.ballVz = roundDiv((s.ballVz - vnz) * R.impactKeepMilli, 1000) + roundDiv(out * nz, nn);
  s.contacts++;
  if (out < R.rollHandover) startRolling(s, dx, dy, r);
}

function stepBall(s: RouletteStateV18) {
  if (s.ballPhase === 0) {
    for (let k = 0; k < SUB && s.ballPhase === 0; k++) rouletteLobSubstepV18(s);
    if (s.ballPhase === 0) return;
  }
  for (let k = 0; k < SUB && s.ballPhase === 1; k++) rouletteSubstepV17(s, k);
  if (s.ballPhase === 1 && s.tick >= s.landingTick) rouletteSettleV15(s, s.ballTheta - rotorAngle(s, SUB));
}

export const ROULETTE_CORE_V18: GameCore<RouletteStateV18> = {
  ...(ROULETTE_CORE_V17 as unknown as GameCore<RouletteStateV18>),
  gameVersion: "18.0.0",
  content: {
    ...(ROULETTE_CORE_V17.content as Record<string, unknown>),
    rules: ROULETTE_RULES_V18,
    launch: "SWIPE_FROM_THE_CRADLE_3D_PARABOLIC_LOB_LANDING_ALONG_THE_LINE_BY_POWER",
    outcome: "BOUNCES_OFF_THE_REAL_BOWL_NORMAL_ROTOR_PICKUP_WALL_DIAMONDS_THEN_V17_ROLLING_FRETS_REST_IN_POCKET",
  },
  create(seed) {
    const s = ROULETTE_CORE_V17.create(seed) as RouletteStateV18;
    const rng = createRng(`${seed}:roulette-v18`);
    s.wheelPhase = rng.nextInt(65536);
    s.wheelSpeed = R.wheelSpeedMin + rng.nextInt(R.wheelSpeedRange);
    s.ballPx = R.releaseX * 1000; s.ballPy = R.releaseY * 1000; s.ballVx = 0; s.ballVy = 0;
    return s;
  },
  canApply: (s, a) => ROULETTE_CORE_V17.canApply(s, a),
  apply(s, a) {
    ROULETTE_CORE_V17.apply(s, a);
    if (!a.startsWith("TOSS_")) return;
    const { direction, power } = throwOf(a), lob = rouletteLobV18(direction, power);
    if (!lob) return;
    s.ballPx = R.releaseX * 1000; s.ballPy = R.releaseY * 1000;
    s.ballX = R.releaseX; s.ballY = R.releaseY;
    s.ballZ = R.rimTop + R.releaseLift;
    s.ballVx = lob.vx; s.ballVy = lob.vy; s.ballVz = lob.vz;
    s.inBowl = false;
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
