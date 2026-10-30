/**
 * V13 (owner request, 30-oct-2026): a natural end to every spin. Measured on V12: after dropping off the track the
 * ball could roll up the central cone (down to r ≈ 73 px) and back, and once in a pocket it slid in and out between
 * the cone wall and the lip for over a second (r 89 ↔ 98 px) before the capture snapped it into place. V13:
 *  - the inner edge of the pocket ring is a real wall (the turret base): a low ball bounces off it softly instead of
 *    climbing the cone;
 *  - inside a pocket the floor and the lip brake the ball against the rotor (slip × 0.955 per tick) and, once the
 *    slip is small, static friction holds it: it rides with the pocket wherever it stopped (V12 kept a slow outward
 *    slide of ≈ 60 µm/tick because the rolling friction alone could not supply the centripetal force);
 *  - presentation keeps the resting ball exactly where physics left it, turning with the wheel (no scripted glide).
 * Diamonds, frets and everything else are V12. V1–V12 stay untouched.
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
import { ROULETTE_ACTIONS_V8 } from "./galacticRouletteProtocol.v8";
import type { CoreState, GameCore } from "./coreRuntime.v1";
export { ROULETTE_WHEEL, ROULETTE_RED };
export const ROULETTE_RULES_V13 = {
  startMinor: 10000,
  chipMinor: 100,
  maxChipsPerBet: 10,
  maxTableChips: 30,
  centerX: 195000,
  centerY: 195000,
  releaseX: 323000,
  releaseY: 330000,
  releaseZ: 24000,
  ballRadius: 5400,
  gravity: 30,
  frictionNumerator: 988,
  frictionDenominator: 1000,
  bowlRadius: 151000,
  innerBossRadius: 90000,
  rimRadius: 146000,
  rimHeight: 18000,
  rollingSlopeForce: 10,
  minimumFlightTicks: 480,
  maximumFlightTicks: 2400,
  captureSpeed: 40,
  wallRadius: 148000,
  wallRestitutionMilli: 860,
  restitutionMilli: 560,
  rollingFrictionMilli: 9992, // per 10000 on the static ball track
  trackSpeedBase: 1500,
  trackSpeedPerImpulse: 120,
  /** Rotor surface (µm): pocket floor z=0, inner wall up to the cone, lip up to the numbered band, ball track. */
  pocketFloorIn: 88000,
  pocketFloorOut: 98000,
  coneEdge: 85000,
  coneEdgeHeight: 3000,
  lipTop: 101000,
  lipHeight: 4000,
  numberOuter: 121000,
  numberSlopeMilli: 120,
  trackSlopeMilli: 350,
  /** Frets: radial walls between pockets, turning with the wheel. */
  fretInner: 85000,
  fretOuter: 102000,
  fretHeight: 2500,
  fretHalfThickness: 700,
  /** sin(π/37) in milli: half the angular width of a pocket. */
  pocketHalfSinMilli: 85,
  fretRestitutionMilli: 470,
  fretHopMilli: 650,
  /** Cap on the hop a fret can give (µm/tick): at most ≈ 9.6 px of rise. */
  fretHopMax: 760,
  /** Bounce on the pocket floor / lip (inside lipTop): softer than the ball track. */
  pocketRestitutionMilli: 450,
  /** Inner wall at the turret base: lowest radius of a low ball's centre, and its bounce. */
  innerWallRadius: 87500,
  innerWallRestitutionMilli: 300,
  /** Extra braking of the ball against the rotor while it rolls on a pocket floor or lip (per tick, milli). */
  pocketBrakeMilli: 955,
  /** Below this slip (µm/tick) the ball sticks to the pocket floor (static friction). */
  pocketStickSpeed: 140,
  /** Diamonds: 8 fixed deflectors on the static ball track. */
  diamondCount: 8,
  diamondRadius: 130000,
  diamondSize: 4200,
  diamondHeight: 3200,
  diamondRestitutionMilli: 620,
  diamondHopMilli: 900,
  /** Cap on the jump a diamond can give (µm/tick): at most ≈ 20 px of rise. */
  diamondHopMax: 1100,
  rotorFrictionMilli: 993,
  downhillMax: 26,
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
const R = ROULETTE_RULES_V13;
/** Diamond centres (µm), every 45° from the +x axis, matching the drawn ones. */
export const ROULETTE_DIAMONDS_V13: readonly { x: number; y: number }[] = Array.from({ length: 8 }, (_, i) => ({
  x: 195000 + roundDiv(sinPhaseMilli(i * 512 + 1024) * 130000, 1000),
  y: 195000 + roundDiv(sinPhaseMilli(i * 512) * 130000, 1000),
}));
export type RouletteStateV13 = CoreState & {
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
  /** Pocket under the ball on the previous rolling tick (-1 off the pocket ring). */
  ringPocket: number;
  frets: number;
  /** Diamond hits in the current spin. */
  diamonds: number;
};
const signedFriction = (v: number, n: number) =>
  Math.sign(v) * Math.floor((Math.abs(v) * n) / 1000);
export function rouletteTossVelocity(direction: number, impulse: number) {
  const phase = direction * 128,
    speed = 700 + impulse * 95;
  return {
    vx: roundDiv(sinPhaseMilli(phase + 1024) * speed, 1000),
    vy: roundDiv(sinPhaseMilli(phase) * speed, 1000),
    vz: ROULETTE_RULES_V13.tossVerticalBase + impulse * ROULETTE_RULES_V13.tossVerticalPerImpulse,
  };
}
/** Return for ONE chip (stake included): the V1 table pays on a 5-chip stake. */
export function rouletteChipReturn(bet: string, n: number) {
  return Math.floor(rouletteReturn(bet, n) / 5);
}
export const rouletteChipCount = (chips: readonly string[], bet: string) => chips.filter((c) => c === bet).length;
const sum = (values: readonly number[]) => values.reduce((a, b) => a + b, 0);
/** Chips staked on the cloth (denominations added up). */
export const rouletteStake = (s: Pick<RouletteStateV13, "chipValues">) => sum(s.chipValues);
export const rouletteBetStake = (s: Pick<RouletteStateV13, "chips" | "chipValues">, bet: string) =>
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
function finish(s: RouletteStateV13) {
  s.score = s.balanceMinor;
  s.height = s.balanceMinor;
  s.status = s.balanceMinor === 0 ? "failed" : "won";
  s.failure = s.balanceMinor === 0 ? "EMPTY_BALANCE" : null;
}
function settle(s: RouletteStateV13, miss: boolean) {
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
/** Height (µm) of the rotor/bowl surface at radius r and its radial slope in milli (positive rises outward). */
export function rouletteSurfaceV13(r: number) {
  if (r < R.coneEdge) return { z: R.coneEdgeHeight + roundDiv((R.coneEdge - r) * 350, 1000), slope: -350 };
  if (r < R.pocketFloorIn)
    return { z: roundDiv((R.pocketFloorIn - r) * R.coneEdgeHeight, R.pocketFloorIn - R.coneEdge), slope: -roundDiv(R.coneEdgeHeight * 1000, R.pocketFloorIn - R.coneEdge) };
  if (r <= R.pocketFloorOut) return { z: 0, slope: 0 };
  if (r < R.lipTop)
    return { z: roundDiv((r - R.pocketFloorOut) * R.lipHeight, R.lipTop - R.pocketFloorOut), slope: roundDiv(R.lipHeight * 1000, R.lipTop - R.pocketFloorOut) };
  const bandTop = R.lipHeight + roundDiv((R.numberOuter - R.lipTop) * R.numberSlopeMilli, 1000);
  if (r < R.numberOuter) return { z: R.lipHeight + roundDiv((r - R.lipTop) * R.numberSlopeMilli, 1000), slope: R.numberSlopeMilli };
  return { z: bandTop + roundDiv((r - R.numberOuter) * R.trackSlopeMilli, 1000), slope: R.trackSlopeMilli };
}
/** Surface velocity of the rotor at (dx, dy) (µm/tick); the ball track outside the numbered band is static. */
function rotorVelocity(s: RouletteStateV13, dx: number, dy: number, r: number) {
  if (r >= R.numberOuter) return { x: 0, y: 0 };
  return { x: roundDiv(-dy * s.wheelSpeed * 6283, 65536000), y: roundDiv(dx * s.wheelSpeed * 6283, 65536000) };
}
function moveBall(s: RouletteStateV13) {
  s.ballX += s.ballVx;
  s.ballY += s.ballVy;
  s.ballVz -= R.gravity;
  s.ballZ += s.ballVz;
  let dx = s.ballX - R.centerX,
    dy = s.ballY - R.centerY,
    r = Math.max(1, integerSqrt(dx * dx + dy * dy));
  if (r <= R.bowlRadius) s.inBowl = true;
  // Containment: a ball that touches the ground outside the bowl bounces off the outer rim back inside.
  if (!s.inBowl && s.ballZ <= R.ballRadius && s.ballVz < 0) {
    // The rim guides the ball onto the ball track: it keeps its sense of rotation and runs along the wall,
    // faster the harder it was thrown, with a slight inward drift.
    const tangential = -dy * s.ballVx + dx * s.ballVy;
    const sense = tangential > 0 ? 1 : tangential < 0 ? -1 : s.launchDirection % 2 ? 1 : -1;
    const speed = R.trackSpeedBase + s.launchImpulse * R.trackSpeedPerImpulse;
    s.ballX = R.centerX + roundDiv(dx * R.wallRadius, r);
    s.ballY = R.centerY + roundDiv(dy * R.wallRadius, r);
    s.ballVx = roundDiv(-dy * sense * speed - dx * roundDiv(speed, 25), r);
    s.ballVy = roundDiv(dx * sense * speed - dy * roundDiv(speed, 25), r);
    s.ballVz = 120;
    s.ballZ = rouletteSurfaceV13(R.wallRadius).z + R.ballRadius + 3000;
    s.inBowl = true;
    s.contacts++;
    dx = s.ballX - R.centerX;
    dy = s.ballY - R.centerY;
    r = R.wallRadius;
  }
  const ground = s.inBowl ? rouletteSurfaceV13(r) : { z: 0, slope: 0 };
  let grounded = false;
  if (s.inBowl && s.ballZ <= ground.z + R.ballRadius) {
    grounded = true;
    s.ballZ = ground.z + R.ballRadius;
    const nx = -roundDiv(dx * ground.slope, r),
      ny = -roundDiv(dy * ground.slope, r),
      nz = 1000;
    const surf = rotorVelocity(s, dx, dy, r);
    // Reflect the velocity relative to the (moving) surface about the inclined surface normal.
    const rx = s.ballVx - surf.x, ry = s.ballVy - surf.y;
    const normalSq = nx * nx + ny * ny + nz * nz;
    const dot = rx * nx + ry * ny + s.ballVz * nz;
    if (dot < 0) {
      const coefficient = 1000 + (r < R.lipTop ? R.pocketRestitutionMilli : R.restitutionMilli);
      s.ballVx -= roundDiv(dot * nx * coefficient, normalSq * 1000);
      s.ballVy -= roundDiv(dot * ny * coefficient, normalSq * 1000);
      s.ballVz -= roundDiv(dot * nz * coefficient, normalSq * 1000);
    }
    if (Math.abs(s.ballVz) < 45) s.ballVz = 0;
    // Rolling friction against the surface under the ball (rotor parts move with the wheel).
    if (r >= R.innerWallRadius - 1000 && r < R.lipTop) {
      // V13: in a pocket the ball is braked hard against the rotor and soon rides with it. The rotor velocity is
      // turned by this tick's rotation so a ball carried by the pocket follows the circle instead of sliding off it.
      const turn = roundDiv(s.wheelSpeed * 6283185, 65536); // rad per tick, micro
      const ax = surf.x - roundDiv(turn * surf.y, 1000000), ay = surf.y + roundDiv(turn * surf.x, 1000000);
      const slip = integerSqrt((s.ballVx - ax) ** 2 + (s.ballVy - ay) ** 2);
      if (slip <= R.pocketStickSpeed) {
        // Static friction: a slow ball stops slipping and rides with the pocket.
        s.ballVx = ax;
        s.ballVy = ay;
      } else {
        s.ballVx = ax + signedFriction(s.ballVx - ax, R.pocketBrakeMilli);
        s.ballVy = ay + signedFriction(s.ballVy - ay, R.pocketBrakeMilli);
      }
    } else if (r < R.numberOuter) {
      s.ballVx = surf.x + signedFriction(s.ballVx - surf.x, R.rotorFrictionMilli);
      s.ballVy = surf.y + signedFriction(s.ballVy - surf.y, R.rotorFrictionMilli);
    } else {
      s.ballVx = Math.sign(s.ballVx) * Math.floor((Math.abs(s.ballVx) * R.rollingFrictionMilli) / 10000);
      s.ballVy = Math.sign(s.ballVy) * Math.floor((Math.abs(s.ballVy) * R.rollingFrictionMilli) / 10000);
    }
    if (s.ballVz === 0 && ground.slope !== 0) {
      const downhill = Math.max(-R.downhillMax, Math.min(R.downhillMax, roundDiv(R.gravity * ground.slope, 1000)));
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
  // V13 inner wall: a low ball cannot roll up the turret; it bounces back into the pocket ring.
  if (s.inBowl && r < R.innerWallRadius && s.ballZ < R.coneEdgeHeight + R.ballRadius + 4000) {
    const surf = rotorVelocity(s, dx, dy, r);
    const vr = roundDiv((s.ballVx - surf.x) * dx + (s.ballVy - surf.y) * dy, r);
    if (vr < 0) {
      const change = vr + roundDiv(vr * R.innerWallRestitutionMilli, 1000);
      s.ballVx -= roundDiv(change * dx, r);
      s.ballVy -= roundDiv(change * dy, r);
      s.contacts++;
    }
    s.ballX = R.centerX + roundDiv(dx * R.innerWallRadius, r);
    s.ballY = R.centerY + roundDiv(dy * R.innerWallRadius, r);
    dx = s.ballX - R.centerX;
    dy = s.ballY - R.centerY;
    r = R.innerWallRadius;
  }
  // Diamonds: fixed deflectors on the ball track knock the ball sideways and make it jump.
  if (s.inBowl && r >= R.numberOuter) {
    const reach = R.diamondSize + R.ballRadius;
    if (Math.abs(r - R.diamondRadius) < reach && s.ballZ < rouletteSurfaceV13(r).z + R.diamondHeight + R.ballRadius) {
      for (const d of ROULETTE_DIAMONDS_V13) {
        const ox = s.ballX - d.x, oy = s.ballY - d.y;
        const dist = integerSqrt(ox * ox + oy * oy);
        if (dist >= reach || dist === 0) continue;
        const vn = roundDiv(s.ballVx * ox + s.ballVy * oy, dist);
        if (vn < 0) {
          const change = vn + roundDiv(vn * R.diamondRestitutionMilli, 1000);
          s.ballVx -= roundDiv(change * ox, dist);
          s.ballVy -= roundDiv(change * oy, dist);
          s.ballVz = Math.max(s.ballVz, Math.min(R.diamondHopMax, roundDiv(-vn * R.diamondHopMilli, 1000)));
          s.diamonds++;
          s.contacts++;
        }
        s.ballX = d.x + roundDiv(ox * reach, dist);
        s.ballY = d.y + roundDiv(oy * reach, dist);
        dx = s.ballX - R.centerX;
        dy = s.ballY - R.centerY;
        r = Math.max(1, integerSqrt(dx * dx + dy * dy));
        break;
      }
    }
  }
  // Frets: solid radial walls on each side of the pocket under the ball, turning with the wheel.
  const index = rouletteCartesianPocket(s.wheelPhase, dx, dy);
  if (s.inBowl && r >= R.fretInner && r <= R.fretOuter && s.ballZ < R.fretHeight + roundDiv(R.ballRadius * 6, 10)) {
    const phase = roundDiv(s.wheelPhase, 16) + roundDiv(index * 4096, 37);
    const px = sinPhaseMilli(phase), py = -sinPhaseMilli(phase + 1024);
    // Tangential unit vector (milli) of the pocket centre line, and the ball's offset along it.
    const tx = -py, ty = px;
    const offset = roundDiv(dx * tx + dy * ty, 1000);
    const limit = roundDiv(r * R.pocketHalfSinMilli, 1000) - R.ballRadius - R.fretHalfThickness;
    if (Math.abs(offset) > limit) {
      const surf = rotorVelocity(s, dx, dy, r);
      const vt = roundDiv((s.ballVx - surf.x) * tx + (s.ballVy - surf.y) * ty, 1000);
      const side = Math.sign(offset);
      if (Math.sign(vt) === side && vt !== 0) {
        const change = vt + roundDiv(vt * R.fretRestitutionMilli, 1000);
        s.ballVx -= roundDiv(change * tx, 1000);
        s.ballVy -= roundDiv(change * ty, 1000);
        // A hard knock throws the ball up: fast enough, it jumps the fret into the next pocket.
        s.ballVz = Math.max(s.ballVz, Math.min(R.fretHopMax, roundDiv(Math.abs(vt) * R.fretHopMilli, 1000)));
        s.frets++;
        s.contacts++;
      }
      const push = side * limit - offset;
      s.ballX += roundDiv(push * tx, 1000);
      s.ballY += roundDiv(push * ty, 1000);
    }
  }
  s.ringPocket = index;
  const age = s.tick - s.flightStart;
  if (age >= R.minimumFlightTicks && grounded && s.ballVz === 0 && r >= R.pocketFloorIn - 2000 && r <= R.pocketFloorOut + 2000) {
    const surf = rotorVelocity(s, dx, dy, r);
    const rel = integerSqrt((s.ballVx - surf.x) ** 2 + (s.ballVy - surf.y) ** 2);
    if (rel <= R.captureSpeed) { settle(s, false); return; }
  }
  if (s.tick === s.landingTick) settle(s, false);
}
export const ROULETTE_CORE_V13: GameCore<RouletteStateV13> = {
  gameId: "galactic-roulette",
  gameVersion: "13.0.0",
  width: 390,
  height: 440,
  tickRate: 120,
  maxFinalTick: 72000,
  maxInputs: 2400,
  inputVersion: 4,
  actions: ROULETTE_ACTIONS_V8,
  content: {
    rules: ROULETTE_RULES_V13,
    wheel: ROULETTE_WHEEL,
    red: ROULETTE_RED,
    scope: "FICTITIOUS_ONLY",
    bets: "EUROPEAN_SINGLE_ZERO_DENOMINATIONS_1_5_25_CLOTH_CLEARED_AFTER_EACH_SPIN",
    launch: "FIXED_LAUNCHER_OUTSIDE_THE_WHEEL_SWIPE_DIRECTION_AND_POWER",
    outcome:
      "INTEGER_3D_STEPPED_ROTOR_RECESSED_POCKETS_LIVELY_FRETS_EIGHT_TRACK_DIAMOND_DEFLECTORS_TURRET_WALL_POCKET_BRAKE_SETTLE_WHERE_IT_STOPS",
    target: "TERMINAL_BALANCE_ONLY_STOP_OR_BROKE",
  },
  create(seed) {
    const rng = createRng(`${seed}:roulette-v13`);
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
      ringPocket: -1,
      frets: 0,
      diamonds: 0,
    };
  },
  canApply(s, a) {
    if (s.status !== "running" || s.landingTick !== -1 || !ROULETTE_ACTIONS_V8.includes(a)) return false;
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
    s.ringPocket = -1;
    s.frets = 0;
    s.diamonds = 0;
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
