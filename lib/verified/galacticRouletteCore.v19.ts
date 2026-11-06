/**
 * V19 (owner request, 6-nov-2026: "slower, bouncing more, so it is harder for it to end in a position"). V18's lob
 * (a true 3D parabola from the cradle to the aimed point, bounces off the real bowl's surface normals, then a roll into
 * a pocket), in slow motion and livelier:
 *  - the wheel's gravity is half of V15–V18's, and the lob stays longer in the air (0.44–0.69 s), so the same
 *    arcs and hops unfold more slowly and every bounce lasts longer;
 *  - bounces keep more energy (restitution 0.72 on the wood, 0.68 on the rotor, 0.6 on the pocket floor, 88 % of the
 *    surface-parallel speed kept) and only end below a 0.16 mm hop, so the ball rattles around the bowl several times
 *    more;
 *  - once rolling, frets and diamonds throw it back harder and higher, and it must lie still almost twice as long before
 *    it counts as settled: it hops from pocket to pocket before staying.
 * Bets, payouts and the rest are V15's; V1–V18 stay as they were.
 */
import { integerSqrt, roundDiv, sinPhaseMilli } from "../deterministic/integerMath";
import { createRng } from "../deterministic/seeded";
import {
  ROULETTE_CORE_V17, ROULETTE_RULES_V17, ROULETTE_THROWS_V16, ROULETTE_WHEEL, ROULETTE_RED,
  rouletteSurfaceV17, rouletteChipReturn, rouletteStake, rouletteBetStake, roulettePocketAt, type RouletteStateV17,
} from "./galacticRouletteCore.v17";
import { rouletteSettleV15, rotorAngle } from "./galacticRouletteCore.v15";
import type { GameCore } from "./coreRuntime.v1";
export { ROULETTE_WHEEL, ROULETTE_RED, ROULETTE_THROWS_V16, rouletteChipReturn, rouletteStake, rouletteBetStake, roulettePocketAt };

/** V19 adds the lob's exact plane position (nm) and plane velocity (nm per substep). */
export type RouletteStateV19 = RouletteStateV17 & { ballPx: number; ballPy: number; ballVx: number; ballVy: number };

const TAU = 62831853;
const SUB = 4;
const MM = 1_000_000;
const R17 = ROULETTE_RULES_V17;
export const ROULETTE_RULES_V19 = {
  ...R17,
  gravity: roundDiv(R17.gravity * 50, 100), // slow motion: half of V15–V18's
  // With the lighter gravity the rotor must be steeper (V15's 0.4 → 0.84) so that a ball carried round by the rotor
  // still slides down into the pockets instead of riding its outer edge (same margin as V15).
  slopeRotor: 840,
  // …and the pocket floor's dish deeper (slope 0.8 → 1.6 across it), so a ball turning with the rotor rests inside
  // the pocket rather than chattering on the edge of its outer lip.
  dishSlopeMilli: 1600,
  /** Rim top above the pocket floor (nm): the table the cradle stands on (set below, from V19's own bowl). */
  rimTop: 0,
  releaseLift: 4 * MM, // the ball sits this high in the cradle
  lobSubsteps: 210, // time in the air at power 0 (480 Hz substeps): 0.44 s, up to 0.69 s at power 15
  lobSubstepsPerPower: 8,
  reachMinMilli: 80, // landing point along the throw's chord through the wheel: 8 % … 92 %
  reachSpanMilli: 840,
  /** Bounce restitution of the lob on each surface. */
  lobRestMilli: { stator: 720, rotor: 680, pocket: 600 },
  impactKeepMilli: 880, // surface-parallel speed kept through an impact
  rollHandover: 50_000, // a bounce weaker than this (≈ 0.16 mm hop at this gravity) becomes rolling
  wallRestMilli: 520,
  // The roll (V17's model): livelier frets and diamonds, a pocket floor that grips less, a longer stillness to settle.
  floorRestMilli: { stator: 420, rotor: 520, pocket: 480 },
  diamondRestMilli: 720,
  fretRestMilli: 760,
  fretHopMilli: 900,
  fretHopMax: 480_000,
  rotorGripPpm: 1_500, // the ball slips more on the rotor, so it meets more frets
  pocketGripPpm: 4_500,
  bounceMin: 20_000,
  // At this gravity a ball turning with the rotor rests pressed on the pocket's outer lip, trembling a little: still
  // means within 4 µm per substep of the rotor (V15: 2.5) for 110 substeps (V15: 60).
  stillSpeed: 4_000,
  stillSubsteps: 110,
};
/** V19's bowl: the integral of V19's slopes (V17's construction, with V19's rotor and dish). */
export function rouletteSurfaceV19(r: number, Q: typeof ROULETTE_RULES_V19 = ROULETTE_RULES_V19) {
  const lin = (from: number, to: number, slope: number) => roundDiv((to - from) * slope, 1000);
  const lip = lin(Q.floorOut, Q.lipTop, Q.slopeLip), rot = lin(Q.lipTop, Q.rotorEdge, Q.slopeRotor), sta = lin(Q.rotorEdge, Q.trackInner, Q.slopeStator);
  if (r >= Q.trackInner) return lip + rot + sta + lin(Q.trackInner, r, Q.slopeTrack);
  if (r >= Q.rotorEdge) return lip + rot + lin(Q.rotorEdge, r, Q.slopeStator);
  if (r >= Q.lipTop) return lip + lin(Q.lipTop, r, Q.slopeRotor);
  if (r >= Q.floorOut) return lin(Q.floorOut, r, Q.slopeLip);
  const mid = (Q.floorIn + Q.floorOut) / 2, half = (Q.floorOut - Q.floorIn) / 2;
  if (r >= Q.floorIn) return roundDiv(roundDiv((r - mid) ** 2 - half ** 2, 2 * half) * roundDiv(Q.dishSlopeMilli, 2), 1000);
  return lin(r, Q.floorIn, -Q.slopeCone);
}
ROULETTE_RULES_V19.rimTop = rouletteSurfaceV19(R17.wallR) + R17.rimHeight;
const R = ROULETTE_RULES_V19;
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
export function rouletteLobV19(direction: number, power: number) {
  const e = ROULETTE_THROWS_V16[direction], chord = CHORDS[direction];
  if (!e || !chord) return null;
  const reach = chord[0] + roundDiv((chord[1] - chord[0]) * (R.reachMinMilli + roundDiv(R.reachSpanMilli * power, 15)), 1000);
  const x = R.releaseX + roundDiv(e[4] * reach, 1_000_000), y = R.releaseY + roundDiv(e[5] * reach, 1_000_000);
  const n = R.lobSubsteps + power * R.lobSubstepsPerPower;
  const rx = (x - R.centerX) * 1000, ry = (y - R.centerY) * 1000;
  const landR = integerSqrt(roundDiv(rx, 1000) ** 2 + roundDiv(ry, 1000) ** 2) * 1000;
  const h0 = R.rimTop + R.releaseLift, h1 = rouletteSurfaceV19(Math.min(landR, R.wallR));
  return {
    x, y, substeps: n,
    vx: roundDiv(e[4] * reach, 1000 * n), vy: roundDiv(e[5] * reach, 1000 * n),
    vz: roundDiv(h1 - h0 + roundDiv(R.gravity * n * (n + 1), 2), n),
  };
}
export const rouletteAimReachesV19 = (direction: number) => CHORDS[direction] !== undefined;

const slopeAt = (r: number) =>
  r >= R.trackInner ? R.slopeTrack : r >= R.rotorEdge ? R.slopeStator : r >= R.lipTop ? R.slopeRotor
    : r >= R.floorOut ? R.slopeLip : r >= R.floorIn ? roundDiv((r - (R.floorIn + R.floorOut) / 2) * R.dishSlopeMilli, R.floorOut - R.floorIn) : R.slopeCone;
const rotorSpeed = (s: RouletteStateV19, r: number) => roundDiv(roundDiv(s.wheelSpeed * 62831853, 65536 * SUB) * r, 10_000_000);
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

function startRolling(s: RouletteStateV19, dx: number, dy: number, r: number) {
  s.ballPhase = 1;
  s.ballR = Math.max(R.fretInner, Math.min(R.wallR, r));
  s.ballTheta = clockAngle(dx, dy);
  s.ballVr = roundDiv(s.ballVx * dx + s.ballVy * dy, r);
  s.ballVt = roundDiv(-s.ballVx * dy + s.ballVy * dx, r);
  s.ballZ = 0; s.ballVz = 0; s.stillSubs = 0;
}
/** One 480 Hz substep of the lob and its bounces. */
export function rouletteLobSubstepV19(s: RouletteStateV19) {
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
  const floor = rouletteSurfaceV19(r);
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

const wrap = (a: number) => { const x = mod(a, TAU); return x > TAU / 2 ? x - TAU : x; };
const slopeAtQ = (Q: typeof R, r: number) =>
  r >= Q.trackInner ? Q.slopeTrack : r >= Q.rotorEdge ? Q.slopeStator : r >= Q.lipTop ? Q.slopeRotor
    : r >= Q.floorOut ? Q.slopeLip : r >= Q.floorIn ? roundDiv((r - (Q.floorIn + Q.floorOut) / 2) * Q.dishSlopeMilli, Q.floorOut - Q.floorIn) : Q.slopeCone;
/** Moves the ball by its radial velocity, keeping its angular momentum (r × v_t). */
function moveRadially(s: RouletteStateV19, r: number) {
  const next = Math.max(R.fretInner, Math.min(R.wallR, r + s.ballVr));
  if (next !== r) s.ballVt = roundDiv(s.ballVt * r, next);
  s.ballR = next;
}
function land(s: RouletteStateV19, rotor: boolean, pocket: boolean) {
  s.ballZ = 0;
  const rest = pocket ? R.floorRestMilli.pocket : rotor ? R.floorRestMilli.rotor : R.floorRestMilli.stator;
  s.ballVz = -s.ballVz > R.bounceMin ? roundDiv(-s.ballVz * rest, 1000) : 0;
  s.contacts++;
}

/** One 480 Hz substep of the roll: V17's in-wheel model (airborne height over the real bowl, diamonds that knock
 * without reversing), with V19's slower gravity, livelier frets and a pocket that holds the ball less readily. */
export function rouletteRollSubstepV19(s: RouletteStateV19, k: number) {
  const g = R.gravity;
  let r = s.ballR;
  const rotor = r < R.rotorEdge, pocket = r < R.lipTop && r >= R.floorIn;
  const grounded = s.ballZ === 0 && s.ballVz <= 0;
  const centripetal = roundDiv(s.ballVt * s.ballVt, r);
  const slopePull = grounded ? roundDiv(g * slopeAtQ(R, r) * 5, 7000) : 0;
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
    s.ballZ += rouletteSurfaceV19(before) - rouletteSurfaceV19(r);
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


function stepBall(s: RouletteStateV19) {
  if (s.ballPhase === 0) {
    for (let k = 0; k < SUB && s.ballPhase === 0; k++) rouletteLobSubstepV19(s);
    if (s.ballPhase === 0) return;
  }
  for (let k = 0; k < SUB && s.ballPhase === 1; k++) rouletteRollSubstepV19(s, k);
  if (s.ballPhase === 1 && s.tick >= s.landingTick) rouletteSettleV15(s, s.ballTheta - rotorAngle(s, SUB));
}

export const ROULETTE_CORE_V19: GameCore<RouletteStateV19> = {
  ...(ROULETTE_CORE_V17 as unknown as GameCore<RouletteStateV19>),
  gameVersion: "19.0.0",
  content: {
    ...(ROULETTE_CORE_V17.content as Record<string, unknown>),
    rules: ROULETTE_RULES_V19,
    launch: "SWIPE_FROM_THE_CRADLE_3D_PARABOLIC_LOB_LANDING_ALONG_THE_LINE_BY_POWER_SLOW_GRAVITY",
    outcome: "BOUNCES_OFF_THE_REAL_BOWL_NORMAL_ROTOR_PICKUP_WALL_DIAMONDS_THEN_V17_ROLLING_FRETS_REST_IN_POCKET",
  },
  create(seed) {
    const s = ROULETTE_CORE_V17.create(seed) as RouletteStateV19;
    const rng = createRng(`${seed}:roulette-v19`);
    s.wheelPhase = rng.nextInt(65536);
    s.wheelSpeed = R.wheelSpeedMin + rng.nextInt(R.wheelSpeedRange);
    s.ballPx = R.releaseX * 1000; s.ballPy = R.releaseY * 1000; s.ballVx = 0; s.ballVy = 0;
    return s;
  },
  canApply: (s, a) => ROULETTE_CORE_V17.canApply(s, a),
  apply(s, a) {
    ROULETTE_CORE_V17.apply(s, a);
    if (!a.startsWith("TOSS_")) return;
    const { direction, power } = throwOf(a), lob = rouletteLobV19(direction, power);
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
