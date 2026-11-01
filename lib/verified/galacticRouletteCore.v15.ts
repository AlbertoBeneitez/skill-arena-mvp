/**
 * V15 (owner request, 1-nov-2026): the ball's motion rebuilt from scratch to behave like a real wheel. V1–V14 stay
 * untouched (V14 replays exactly as before).
 *
 * One continuous model in polar coordinates around the wheel centre, integrated in four substeps per tick (480 Hz),
 * with integers only (nanometres, nm per substep, 1e-7 rad):
 *  - the hand throw puts the ball on the ball track with a speed set by the swipe's power and its tangential part;
 *  - on the track the ball is pressed against the outer wall by its centripetal force; the wall's friction is
 *    proportional to that force, plus rolling resistance and air drag, so it slows fast at first and gently later;
 *  - it leaves the wall by itself when its speed can no longer hold it on the banked track, and spirals down the
 *    stator keeping its angular momentum (it speeds up as it falls); the eight diamonds knock it and make it hop;
 *  - on the rotor, turning the other way, friction drags it towards the rotor's speed; the frets knock it back and
 *    throw it up, so it clatters across several pockets; it bounces, rolls and finally rides in one pocket;
 *  - the number is the pocket the ball rests in. Nothing is scripted and no random number decides the outcome: the
 *    seed only sets the wheel's starting angle and speed.
 * Gravity is scaled to the drawn wheel's size, so its timings match a full-size wheel (about 0.38 m track radius).
 * Bets, chips, payouts and inputs are those of V14.
 */
import { createRng } from "../deterministic/seeded";
import { integerSqrt, roundDiv, sinPhaseMilli } from "../deterministic/integerMath";
import { ROULETTE_WHEEL, ROULETTE_RED } from "./galacticRouletteCore.v1";
import { ROULETTE_RULES_V14, rouletteChipReturn, rouletteStake, rouletteBetStake } from "./galacticRouletteCore.v14";
import { ROULETTE_ACTIONS_V8 } from "./galacticRouletteProtocol.v8";
import type { CoreState, GameCore } from "./coreRuntime.v1";
export { ROULETTE_WHEEL, ROULETTE_RED, rouletteChipReturn, rouletteStake, rouletteBetStake };

const TAU = 62831853; // one turn in 1e-7 rad
const SUB = 4;
const MM = 1_000_000; // nm per mm
export const ROULETTE_RULES_V15 = {
  ...ROULETTE_RULES_V14,
  wheelSpeedMin: 150, // rotor, 1/65536 turn per tick (2.5–3.6 s per turn)
  wheelSpeedRange: 71,
  gravity: 15540, // nm per substep², g scaled by the wheel size (0.146 / 0.38)
  ballRadiusNm: 5_400_000,
  wallR: 142_600_000, // ball centre against the outer wall
  trackInner: 134_000_000, // banked ball track between here and the wall
  rotorEdge: 121_000_000,
  lipTop: 101_000_000,
  floorOut: 98_000_000,
  floorIn: 88_000_000,
  turretR: 87_500_000,
  fretInner: 85_000_000,
  fretOuter: 102_000_000,
  fretHeight: 2_500_000,
  fretHalf: 700_000,
  slopeTrack: 700, // milli, height rising outwards
  // Steeper than the track: a ball that leaves the wall cannot find an orbit on the stator and spirals down to the rotor.
  slopeStator: 1200,
  slopeRotor: 400, // steep enough that a ball turning with the rotor still slides down to the pockets
  slopeLip: 1333,
  slopeCone: -1000,
  wallMuPpm: 33_000, // friction per unit of the force pressing the ball on the wall
  airDen: 2_000_000_000_000,
  rollStator: 80, // nm per substep² (rolling resistance on the wooden track)
  rotorGripPpm: 2_600, // slip lost per substep on the rotor
  pocketGripPpm: 6_500,
  radialDampPpm: 1_600,
  wallRestMilli: 300,
  floorRestMilli: { stator: 300, rotor: 420, pocket: 360 },
  diamondR: 130_000_000,
  diamondReach: 9_600_000,
  diamondTop: 3_200_000,
  diamondRestMilli: 560,
  diamondHopMilli: 700,
  diamondHopMax: 400_000,
  fretRestMilli: 450,
  fretHopMilli: 600,
  fretHopMax: 320_000,
  fretRestingSpeed: 20_000, // slower than this against a fret is resting contact, not a knock
  turretRestMilli: 300,
  bounceMin: 30_000,
  stillSpeed: 2_500,
  stillSubsteps: 60,
  launchTicks: 18,
  throwMin: 2_200_000, // nm per substep at power 0 (≈ 1.2 turns per second; 2.7 at power 15)
  throwStep: 187_000,
  throwTangentMin: 450, // milli of the throw's power kept along the track whatever the aim
  maximumFlightTicks: 3600,
  // Where the launcher's ball enters the wheel (the point of the wall nearest the launcher).
  entryTheta: 23_828_042,
  entryUx: 688,
  entryUy: 726,
} as const;
const R = ROULETTE_RULES_V15;

export type RouletteStateV15 = CoreState & {
  wheelPhase: number;
  wheelSpeed: number;
  /** -1 idle, 0 flying from the launcher, 1 in the wheel. */
  ballPhase: number;
  ballTheta: number; // 1e-7 rad, clockwise from 12 o'clock
  ballR: number; // nm
  ballVr: number; // nm per substep, outwards positive
  ballVt: number; // nm per substep, clockwise positive
  ballZ: number; // nm above the surface under the ball
  ballVz: number;
  /** Launcher flight: screen position in µm (only while ballPhase is 0). */
  ballX: number;
  ballY: number;
  stillSubs: number;
  /** Angle of the resting ball relative to the rotor (1e-7 rad). */
  restOffset: number;
  flightStart: number;
  landingTick: number;
  inBowl: boolean;
  contacts: number;
  launchDirection: number;
  launchImpulse: number;
  chips: string[];
  chipValues: number[];
  chipTicks: number[];
  denomination: number;
  history: number[];
  lockedChips: string[];
  lockedValues: number[];
  balanceMinor: number;
  spins: number;
  lastNumber: number | null;
  lastPayout: number;
  lastInputTick: number;
  lastLandingTick: number;
  lastMiss: boolean;
  ringPocket: number;
  frets: number;
  diamonds: number;
  lastDiamond: number;
  lastDiamondTick: number;
};

const mod = (a: number, m: number) => ((a % m) + m) % m;
/** Signed angle in (−TAU/2, TAU/2]. */
const wrap = (a: number) => { const x = mod(a, TAU); return x > TAU / 2 ? x - TAU : x; };
/** Rotor angle (1e-7 rad) at substep `k` (0…SUB) of the current tick. */
const rotorAngle = (s: RouletteStateV15, k: number) =>
  roundDiv(mod((s.wheelPhase - s.wheelSpeed) * SUB + k * s.wheelSpeed, 65536 * SUB) * TAU, 65536 * SUB);
/** Rotor surface speed (nm per substep) at radius r. */
const rotorSpeed = (s: RouletteStateV15, r: number) => roundDiv(roundDiv(s.wheelSpeed * TAU, 65536 * SUB) * r, 10_000_000);
/** Radial slope (milli, height rising outwards) under the ball. The pocket floor is gently dished, so a ball riding
 * in a pocket finds a resting radius instead of chattering against the lip. */
export const rouletteSlopeV15 = (r: number) =>
  r >= R.trackInner ? R.slopeTrack : r >= R.rotorEdge ? R.slopeStator : r >= R.lipTop ? R.slopeRotor
    : r >= R.floorOut ? R.slopeLip : r >= R.floorIn ? roundDiv((r - (R.floorIn + R.floorOut) / 2) * 800, R.floorOut - R.floorIn) : R.slopeCone;
/** Index (0–36, in ROULETTE_WHEEL order) of the pocket at relative angle φ = ball − rotor. */
export const roulettePocketAt = (phi: number) => mod(roundDiv(mod(phi, TAU) * 37, TAU), 37);

function finish(s: RouletteStateV15) {
  s.score = s.balanceMinor;
  s.height = s.balanceMinor;
  s.status = s.balanceMinor === 0 ? "failed" : "won";
  s.failure = s.balanceMinor === 0 ? "EMPTY_BALANCE" : null;
}
function settle(s: RouletteStateV15, phi: number) {
  const landed = ROULETTE_WHEEL[roulettePocketAt(phi)];
  s.lastMiss = false;
  s.lastNumber = landed;
  s.restOffset = mod(phi, TAU);
  s.lastPayout = s.lockedChips.reduce((sum, bet, i) => sum + rouletteChipReturn(bet, landed) * s.lockedValues[i], 0);
  s.balanceMinor += s.lastPayout;
  s.height = s.balanceMinor;
  s.history = [...s.history, landed].slice(-R.historyLength);
  s.ballVr = s.ballVt = s.ballVz = s.ballZ = 0;
  s.lastLandingTick = s.tick;
  s.landingTick = -1;
  s.ballPhase = -1;
  if (s.balanceMinor === 0) finish(s);
}

/** Moves the ball by its radial velocity, keeping its angular momentum (r × v_t). */
function moveRadially(s: RouletteStateV15, r: number) {
  const next = Math.max(R.fretInner, Math.min(R.wallR, r + s.ballVr));
  if (next !== r) s.ballVt = roundDiv(s.ballVt * r, next);
  s.ballR = next;
}

function substep(s: RouletteStateV15, k: number) {
  const g = R.gravity;
  let r = s.ballR;
  const rotor = r < R.rotorEdge, pocket = r < R.lipTop && r >= R.floorIn;
  const grounded = s.ballZ === 0 && s.ballVz <= 0;
  const centripetal = roundDiv(s.ballVt * s.ballVt, r);
  // Radial: centripetal push out against the slope's pull in (a rolling ball feels 5/7 of it); nothing while airborne.
  const slopePull = grounded ? roundDiv(g * rouletteSlopeV15(r) * 5, 7000) : 0;
  s.ballVr += centripetal - slopePull;
  // Tangential losses: air drag always; on the ground, wall friction (∝ the force on the wall) or rolling/grip.
  const drag = roundDiv(s.ballVt * s.ballVt, R.airDen);
  s.ballVt -= Math.sign(s.ballVt) * drag;
  if (grounded) {
    if (rotor) {
      const v = rotorSpeed(s, r), slip = s.ballVt - v;
      s.ballVt = v + slip - roundDiv(slip * (pocket ? R.pocketGripPpm : R.rotorGripPpm), 1_000_000);
    } else if (Math.abs(s.ballVt) > R.rollStator) s.ballVt -= Math.sign(s.ballVt) * R.rollStator;
    s.ballVr -= roundDiv(s.ballVr * (pocket ? R.pocketGripPpm : R.radialDampPpm), 1_000_000);
  }
  moveRadially(s, r);
  r = s.ballR;
  // Outer wall: the ball rebounds; while pressed on it, friction grows with the pressing force.
  if (r >= R.wallR && s.ballVr >= 0) {
    const press = centripetal - slopePull;
    if (press > 0) s.ballVt -= Math.sign(s.ballVt) * Math.min(Math.abs(s.ballVt), roundDiv(press * R.wallMuPpm, 1_000_000));
    // A hard knock rebounds; a ball merely pressed on the wall rolls along it.
    s.ballVr = s.ballVr > 3 * Math.max(press, 0) + 60_000 ? -roundDiv(s.ballVr * R.wallRestMilli, 1000) : 0;
  }
  // Turret wall at the centre of the rotor.
  if (r <= R.turretR && s.ballZ < 4 * MM && s.ballVr < 0) {
    s.ballVr = -roundDiv(s.ballVr * R.turretRestMilli, 1000);
    s.ballR = R.turretR;
    s.contacts++;
  }
  s.ballTheta = mod(s.ballTheta + roundDiv(s.ballVt * 10_000_000, r), TAU);
  // Height: free flight under gravity, bounces on landing.
  if (!grounded || s.ballZ > 0) {
    s.ballVz -= g;
    s.ballZ += s.ballVz;
    if (s.ballZ <= 0) {
      s.ballZ = 0;
      const rest = pocket ? R.floorRestMilli.pocket : rotor ? R.floorRestMilli.rotor : R.floorRestMilli.stator;
      s.ballVz = -s.ballVz > R.bounceMin ? roundDiv(-s.ballVz * rest, 1000) : 0;
      s.contacts++;
    }
  }
  // Diamonds: round deflectors on the stator, one every 45°.
  if (Math.abs(r - R.diamondR) < R.diamondReach && s.ballZ < R.diamondTop) {
    const i = mod(roundDiv(s.ballTheta * 8, TAU), 8);
    const dr = r - R.diamondR, dt = roundDiv(wrap(s.ballTheta - roundDiv(i * TAU, 8)) * r, 10_000_000);
    const dist = integerSqrt(dr * dr + dt * dt);
    if (dist > 0 && dist < R.diamondReach) {
      const vn = roundDiv(s.ballVr * dr + s.ballVt * dt, dist);
      if (vn < 0) {
        const change = vn + roundDiv(vn * R.diamondRestMilli, 1000);
        s.ballVr -= roundDiv(change * dr, dist);
        s.ballVt -= roundDiv(change * dt, dist);
        s.ballVz = Math.max(s.ballVz, Math.min(R.diamondHopMax, roundDiv(-vn * R.diamondHopMilli, 1000)));
        if (s.ballVz > 0 && s.ballZ === 0) s.ballZ = 1;
        s.diamonds++;
        s.contacts++;
        s.lastDiamond = i;
        s.lastDiamondTick = s.tick;
      }
      // Out of the diamond along the contact normal.
      s.ballR = R.diamondR + roundDiv(dr * R.diamondReach, dist);
      s.ballTheta = mod(roundDiv(i * TAU, 8) + roundDiv(roundDiv(dt * R.diamondReach, dist) * 10_000_000, s.ballR), TAU);
      r = s.ballR;
    }
  }
  // Frets: radial walls between pockets, turning with the rotor; a low ball knocks them and is thrown up.
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
      } else if (Math.sign(rel) === side) s.ballVt = v; // leaning on the fret: it simply turns with it
      s.ballTheta = mod(s.ballTheta + (side * limit - offset), TAU);
    }
  }
  // At rest: on a pocket floor, on the ground, riding with the rotor, for a moment.
  const still = s.ballZ === 0 && s.ballVz === 0 && r <= R.floorOut + MM && r >= R.floorIn - MM
    && Math.abs(s.ballVt - rotorSpeed(s, r)) <= R.stillSpeed && Math.abs(s.ballVr) <= R.stillSpeed;
  s.stillSubs = still ? s.stillSubs + 1 : 0;
  if (s.stillSubs >= R.stillSubsteps) settle(s, s.ballTheta - rotorAngle(s, k + 1));
}

function throwBall(s: RouletteStateV15) {
  // Swipe direction (screen angle) against the track's radial and clockwise tangent at the entry point.
  const phase = s.launchDirection * 128, cx = sinPhaseMilli(phase + 1024), cy = sinPhaseMilli(phase);
  const tangent = roundDiv(-R.entryUy * cx + R.entryUx * cy, 1000), radial = roundDiv(R.entryUx * cx + R.entryUy * cy, 1000);
  const speed = R.throwMin + s.launchImpulse * R.throwStep;
  const sense = tangent > 0 ? 1 : tangent < 0 ? -1 : s.wheelSpeed > 0 ? -1 : 1;
  const along = Math.max(R.throwTangentMin, Math.abs(tangent));
  s.ballPhase = 1;
  s.inBowl = true;
  s.ballTheta = R.entryTheta;
  s.ballR = R.wallR - 2 * MM;
  // Even a clumsy aim gets the ball going like a croupier's minimal throw; aim and power add to it.
  s.ballVt = sense * Math.max(R.throwMin, roundDiv(speed * along, 1000));
  s.ballVr = radial < 0 ? roundDiv(speed * radial, 8000) : 0;
  s.ballZ = 3 * MM;
  s.ballVz = 0;
}

function stepBall(s: RouletteStateV15) {
  if (s.ballPhase === 0) {
    const k = s.tick - s.flightStart, n = R.launchTicks;
    const ex = R.centerX + roundDiv(R.entryUx * R.wallR, 1_000_000), ey = R.centerY + roundDiv(R.entryUy * R.wallR, 1_000_000);
    s.ballX = R.releaseX + roundDiv((ex - R.releaseX) * k, n);
    s.ballY = R.releaseY + roundDiv((ey - R.releaseY) * k, n);
    if (k >= n) throwBall(s);
    return;
  }
  for (let k = 0; k < SUB && s.ballPhase === 1; k++) substep(s, k);
  if (s.ballPhase === 1 && s.tick >= s.landingTick) settle(s, s.ballTheta - rotorAngle(s, SUB));
}

export const ROULETTE_CORE_V15: GameCore<RouletteStateV15> = {
  gameId: "galactic-roulette",
  gameVersion: "15.0.0",
  width: 390,
  height: 440,
  tickRate: 120,
  maxFinalTick: 72000,
  maxInputs: 2400,
  inputVersion: 4,
  actions: ROULETTE_ACTIONS_V8,
  content: {
    rules: ROULETTE_RULES_V15,
    wheel: ROULETTE_WHEEL,
    red: ROULETTE_RED,
    scope: "FICTITIOUS_ONLY",
    bets: "EUROPEAN_SINGLE_ZERO_DENOMINATIONS_1_5_25_CLOTH_CLEARED_AFTER_EACH_SPIN",
    launch: "FIXED_LAUNCHER_OUTSIDE_THE_WHEEL_SWIPE_DIRECTION_AND_POWER",
    outcome: "POLAR_480HZ_WALL_FRICTION_FREE_RELEASE_ANGULAR_MOMENTUM_DIAMONDS_COUNTER_ROTOR_GRIP_FRETS_REST_IN_POCKET",
    target: "TERMINAL_BALANCE_ONLY_STOP_OR_BROKE",
  },
  create(seed) {
    const rng = createRng(`${seed}:roulette-v15`);
    return {
      tick: 0, status: "running", score: 0, failure: null, height: 10000,
      wheelPhase: rng.nextInt(65536),
      wheelSpeed: R.wheelSpeedMin + rng.nextInt(R.wheelSpeedRange),
      ballPhase: -1, ballTheta: 0, ballR: 0, ballVr: 0, ballVt: 0, ballZ: 0, ballVz: 0,
      ballX: R.releaseX, ballY: R.releaseY, stillSubs: 0, restOffset: 0,
      flightStart: -1, landingTick: -1, inBowl: false, contacts: 0, launchDirection: 20, launchImpulse: 8,
      chips: [], chipValues: [], chipTicks: [], denomination: 1, history: [], lockedChips: [], lockedValues: [],
      balanceMinor: 10000, spins: 0, lastNumber: null, lastPayout: 0, lastInputTick: -3, lastLandingTick: -1000,
      lastMiss: false, ringPocket: -1, frets: 0, diamonds: 0, lastDiamond: -1, lastDiamondTick: -1000,
    };
  },
  canApply(s, a) {
    if (s.status !== "running" || s.landingTick !== -1 || !ROULETTE_ACTIONS_V8.includes(a)) return false;
    if (a.startsWith("TOSS_"))
      return s.chips.length > 0 && s.balanceMinor >= rouletteStake(s) * R.chipMinor && s.tick + R.maximumFlightTicks <= R.maxFinalTick;
    if (a === "CASH_OUT" || a.startsWith("CHIP_")) return true;
    if (a === "BETS_UNDO" || a === "BETS_CLEAR") return s.chips.length > 0;
    const bet = a.slice(4);
    return s.chips.length < R.maxTableChips && (rouletteStake(s) + s.denomination) * R.chipMinor <= s.balanceMinor
      && rouletteBetStake(s, bet) + s.denomination <= R.maxStakePerBet;
  },
  apply(s, a) {
    s.lastInputTick = s.tick;
    if (a === "CASH_OUT") { finish(s); return; }
    if (a.startsWith("CHIP_")) { s.denomination = Number(a.slice(5)); return; }
    if (a.startsWith("BET_")) { s.chips.push(a.slice(4)); s.chipValues.push(s.denomination); s.chipTicks.push(s.tick); return; }
    if (a === "BETS_UNDO") { s.chips.pop(); s.chipValues.pop(); s.chipTicks.pop(); return; }
    if (a === "BETS_CLEAR") { s.chips = []; s.chipValues = []; s.chipTicks = []; return; }
    s.launchDirection = Number(a.slice(6, 8));
    s.launchImpulse = Number(a.slice(10, 12));
    s.ballPhase = 0;
    s.ballX = R.releaseX;
    s.ballY = R.releaseY;
    s.inBowl = false;
    s.contacts = s.frets = s.diamonds = 0;
    s.stillSubs = 0;
    s.ringPocket = -1;
    s.flightStart = s.tick;
    s.landingTick = s.tick + R.maximumFlightTicks;
    s.lockedChips = s.chips;
    s.lockedValues = s.chipValues;
    s.balanceMinor -= rouletteStake(s) * R.chipMinor;
    s.chips = []; s.chipValues = []; s.chipTicks = [];
    s.height = s.balanceMinor;
    s.spins++;
    s.lastPayout = 0;
    s.lastMiss = false;
  },
  step(s) {
    s.tick++;
    s.wheelPhase = (s.wheelPhase + s.wheelSpeed) % 65536;
    if (s.landingTick !== -1) stepBall(s);
    if (s.tick === R.maxFinalTick && s.status === "running") finish(s);
  },
};
