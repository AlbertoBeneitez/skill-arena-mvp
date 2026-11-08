/**
 * Pinball V11 (owner request, 8-nov-2026: "every bumper scores something different; a far busier table with more
 * things to play"). V10's rules, modes and multiball, plus:
 *  - every round thing the ball bounces off scores its own value: six pop bumpers 100…500 (a sixth, smaller one by the
 *    saucer), eight rubber posts 15…70, slings 35 and 55 (bumper storm: four times each bumper's value);
 *  - an upper flipper on the right (moves with the right button) that sends the ball back up into the bumpers, the
 *    wormhole and the targets;
 *  - a second spinner at the mouth of the left habitrail (75 a spin);
 *  - two inlane rollovers on the guides: light both for 2500 and a fresh ball save;
 *  - three more rubber posts (one each side of the lanes, one between the upper bumpers and one beside the wormhole).
 * Every element keeps at least one ball diameter of clearance. Same inputs as V10. V1–V10 stay frozen.
 */
import { integerSqrt, roundDiv, sinPhaseMilli } from "../deterministic/integerMath";
import type { CoreState, GameCore } from "./coreRuntime.v1";
import { PINBALL_ACTIONS_V3 } from "./pinballProtocol.v3";

export const PINBALL_RULES_V11 = {
  tickRate: 120,
  /** The clock starts at 100 s; extra time can extend it to 130 s. */
  startTicks: 120 * 100,
  extraTimeTicks: 120 * 10,
  maxExtraTimes: 3,
  maxFinalTick: 120 * 130,
  missionPoints: 10000,
  hurryStart: 12000,
  hurryFloor: 3000,
  hurryStepPerTick: 20,
  ballSaveTicks: 600,
  frenzyTicks: 120 * 10,
  maxInputs: 6000,
  substeps: 2,
  radiusMilli: 9000,
  gravityMilli: 600000,
  maxSpeedMilli: 1000000,
  laneX: 359000,
  laneRestY: 576000,
  chargeStepTicks: 8,
  maxChargeLevel: 8,
  launchBaseMilli: 500000,
  launchStepMilli: 60000,
  waitTicks: 90,
  drainY: 616000,
  flipRest: 300,
  flipUp: -330,
  flipStep: 79,
  flipLengthMilli: 69000,
  flipHalfThickMilli: 7000,
  leftPivot: { x: 114000, y: 552000 },
  rightPivot: { x: 276000, y: 552000 },
  stuckTicks: 240,
  /** A ball that stays within ±stuckBox of where it settled counts as stuck. */
  stuckBox: 12000,
  /** Side release (left / right): a ball trapped low on a side is put here and rolled to that side's flipper. */
  sideRelease: [{ x: 70000, y: 470000 }, { x: 294000, y: 470000 }],
  sideNudgeVx: 120000,
  sideNudgeVy: 100000,
  /** Passage ride speed (milli-px per tick) and the cool-down before a passage can catch the ball again. */
  tubeSpeedMinMilli: 3600,
  tubeSpeedMaxMilli: 6400,
  /** Distance (milli-px) over which the ride blends from the capture point into the passage path. */
  tubeBlendMilli: 36000,
  tubeCooldownTicks: 90,
  railPoints: 1000,
  wormholePoints: 3000,
  nudgeVx: 260000,
  nudgeVy: -320000,
  maxMultiplier: 5,
  skillWindowTicks: 600,
  comboWindowTicks: 480,
  saucerHoldTicks: 100,
  saucerCooldownTicks: 90,
  bonusPerFeature: 1000,
  locksForMultiball: 2,
  multiballSaveTicks: 960,
  jackpotBase: 10000,
  jackpotStep: 5000,
  jackpotsForSuper: 3,
  superFactor: 3,
  multiballStart: 5000,
  modeTicks: 120 * 20,
  modeBumper: 1000,
  modeSpinner: 1000,
  modeRush: 5000,
  extraStuckTicks: 240,
  /** V11: spinner by the left habitrail, inlane pair, bumper storm factor. */
  leftSpinnerPoints: 75,
  inlanePoints: 500,
  inlanesPoints: 2500,
  stormFactor: 4,
  upperFlipLengthMilli: 40000,
  upperPivot: { x: 334000, y: 350000 },
} as const;
const R = PINBALL_RULES_V11;

export type PinballSegmentV11 = { ax: number; ay: number; bx: number; by: number; e: number };
const seg = (ax: number, ay: number, bx: number, by: number, e = 450): PinballSegmentV11 => ({
  ax: ax * 1000, ay: ay * 1000, bx: bx * 1000, by: by * 1000, e,
});
export const PINBALL_WALLS_V11: readonly PinballSegmentV11[] = Object.freeze([
  seg(18, 640, 18, 140), seg(18, 140, 46, 70), seg(46, 70, 110, 42), seg(110, 42, 290, 42),
  seg(290, 42, 372, 124), seg(372, 124, 372, 640),
  seg(346, 150, 346, 585), seg(346, 585, 372, 585, 100),
  // Closed sides: the guides start on the outer walls and feed the flippers (no outlanes).
  seg(18, 468, 114, 552, 300), seg(346, 468, 276, 552, 300),
]);
/** Left-wall stand-up targets. */
export const PINBALL_TARGETS_V11: readonly PinballSegmentV11[] = Object.freeze(
  [0, 1, 2, 3].map((i) => seg(25, 250 + i * 34, 25, 274 + i * 34, 300)),
);
/** Right-wall stand-up targets: all three light the saucer. */
export const PINBALL_RTARGETS_V11: readonly PinballSegmentV11[] = Object.freeze(
  [0, 1, 2].map((i) => seg(339, 235 + i * 34, 339, 259 + i * 34, 300)),
);
/** Drop-target bank (slightly tilted so a ball never rests on a target). */
export const PINBALL_DROPS_V11: readonly PinballSegmentV11[] = Object.freeze([
  seg(137, 385, 167, 381, 300), seg(180, 381, 210, 385, 300), seg(223, 385, 253, 381, 300),
]);
export const PINBALL_LANES_V11 = Object.freeze([
  { x: 120000, y: 118000 }, { x: 170000, y: 118000 }, { x: 220000, y: 118000 },
]);
/** Rubber posts and lane separators, each with its own value (V11: all different; three more than V10). */
export const PINBALL_POSTS_V11: readonly { x: number; y: number; r: number; points: number }[] = Object.freeze([
  { x: 205000, y: 252000, r: 6000, points: 60 },
  { x: 95000, y: 395000, r: 6000, points: 70 },
  { x: 145000, y: 104000, r: 4000, points: 15 },
  { x: 195000, y: 104000, r: 4000, points: 20 },
  { x: 95000, y: 104000, r: 4000, points: 25 },
  { x: 172000, y: 255000, r: 6000, points: 30 },
  { x: 150000, y: 205000, r: 6000, points: 40 },
  { x: 262000, y: 262000, r: 6000, points: 45 },
]);
export const PINBALL_POST_KICK_V11 = 300000;
export const PINBALL_SLING_KICK_V11 = 420000;
export const PINBALL_SLINGS_V11 = Object.freeze([
  { x: 86000, y: 440000, r: 10000, points: 35 }, { x: 282000, y: 440000, r: 10000, points: 55 },
]);
/** V11: spinner at the mouth of the left habitrail (the ball crosses it on its way up to the ramp). */
export const PINBALL_LSPINNER_V11 = Object.freeze({ x0: 24000, x1: 64000, y0: 205000, y1: 235000 });
/** V11: inlane rollovers on the two guides (where a ball rolling down a guide passes). */
export const PINBALL_INLANES_V11 = Object.freeze([{ x: 57000, y: 490000 }, { x: 314000, y: 491000 }]);
export const PINBALL_SAUCER_V11 = Object.freeze({ x: 312000, y: 130000, r: 13000 });
export const PINBALL_SPINNER_V11 = Object.freeze({ x0: 230000, x1: 290000, y0: 52000, y1: 92000 });
export const PINBALL_RAMP_ZONE_V11 = Object.freeze({ x0: 24000, x1: 64000, y0: 160000, y1: 200000 });
export const PINBALL_ORBIT_ZONE_V11 = Object.freeze({ x0: 300000, x1: 340000, y0: 160000, y1: 200000 });
export const PINBALL_WORMHOLE_V11 = Object.freeze({ x: 275000, y: 300000, r: 13000 });
const P = (pts: number[][]) => Object.freeze(pts.map(([x, y]) => Object.freeze({ x: x * 1000, y: y * 1000 })));
/** Passages: fixed paths (logical px) and exit speeds (milli-px/s). 0 = left habitrail, 1 = right habitrail, 2 = wormhole.
 * The exit direction is the direction of the last path segment. */
export const PINBALL_TUBES_V11 = Object.freeze([
  { kind: "RAIL", path: P([[44, 175], [38, 120], [60, 80], [110, 60], [200, 54], [280, 62], [330, 96], [350, 140], [340, 210], [332, 300], [326, 400], [322, 430], [306, 462]]), exitSpeed: 234000 },
  { kind: "RAIL", path: P([[320, 175], [332, 120], [300, 72], [220, 54], [140, 56], [72, 78], [40, 128], [34, 220], [38, 330], [48, 400], [62, 432], [82, 462]]), exitSpeed: 234000 },
  { kind: "WORMHOLE", path: P([[275, 300], [240, 268], [180, 230], [120, 190], [84, 150], [72, 118], [82, 100], [104, 104]]), exitSpeed: 184000 },
]);
const TUBE_LENGTHS = PINBALL_TUBES_V11.map((t) => t.path.slice(1).map((q, i) => integerSqrt((q.x - t.path[i].x) ** 2 + (q.y - t.path[i].y) ** 2)));
const TUBE_TOTAL = TUBE_LENGTHS.map((ls) => ls.reduce((a, b) => a + b, 0));
/** Exit velocity: last segment direction times the exit speed (integer, fixed per passage). */
export const PINBALL_TUBE_EXITS_V11 = Object.freeze(PINBALL_TUBES_V11.map((t, i) => {
  const a = t.path[t.path.length - 2], b = t.path[t.path.length - 1], len = TUBE_LENGTHS[i][TUBE_LENGTHS[i].length - 1];
  return Object.freeze({ vx: roundDiv((b.x - a.x) * t.exitSpeed, len), vy: roundDiv((b.y - a.y) * t.exitSpeed, len) });
}));
/** Ball position after `d` milli-px along passage `tube` (integer interpolation). */
export function pinballTubePointV11(tube: number, d: number) {
  const path = PINBALL_TUBES_V11[tube].path, ls = TUBE_LENGTHS[tube];
  let rest = Math.max(0, Math.min(TUBE_TOTAL[tube], d));
  for (let i = 0; i < ls.length; i++) {
    if (rest <= ls[i] || i === ls.length - 1) {
      const a = path[i], b = path[i + 1], f = ls[i] ? Math.min(1000, roundDiv(rest * 1000, ls[i])) : 1000;
      return { x: a.x + roundDiv((b.x - a.x) * f, 1000), y: a.y + roundDiv((b.y - a.y) * f, 1000) };
    }
    rest -= ls[i];
  }
  return { ...path[path.length - 1] };
}
export const pinballTubeLengthV11 = (tube: number) => TUBE_TOTAL[tube];
/** Catch the ball into a passage without stopping it: keep its position (as a blend offset) and its speed. */
function enterTube(s: { ball: PinballBallV11; tube: number; tubeD: number; tubeOx: number; tubeOy: number; tubeV0: number }, tube: number) {
  const b = s.ball, start = PINBALL_TUBES_V11[tube].path[0];
  const speed = roundDiv(integerSqrt(b.vx * b.vx + b.vy * b.vy), R.tickRate);
  s.tube = tube; s.tubeD = 0;
  s.tubeOx = b.x - start.x; s.tubeOy = b.y - start.y;
  s.tubeV0 = Math.max(R.tubeSpeedMinMilli, Math.min(R.tubeSpeedMaxMilli, speed));
}
const EJECT = Object.freeze([
  { vx: -260000, vy: 160000 }, { vx: -150000, vy: 220000 }, { vx: -340000, vy: 90000 },
]);
/** V11: one fixed table of six bumpers, each with its own radius and value. */
export type PinballBumperV11 = { x: number; y: number; r: number; points: number };
const LAYOUTS: readonly (readonly PinballBumperV11[])[] = Object.freeze([
  Object.freeze([
    { x: 150000, y: 150000, r: 20000, points: 300 },
    { x: 235000, y: 205000, r: 20000, points: 500 },
    { x: 120000, y: 250000, r: 20000, points: 200 },
    { x: 190000, y: 310000, r: 20000, points: 400 },
    { x: 80000, y: 335000, r: 20000, points: 100 },
    { x: 262000, y: 140000, r: 14000, points: 250 },
  ]),
]);
export const PINBALL_BUMPER_RADIUS_V11 = 20000;
export const pinballBumpersV11 = (layout: number) => LAYOUTS[layout % LAYOUTS.length];

export type PinballBallV11 = { x: number; y: number; vx: number; vy: number; xr: number; yr: number };
export type PinballEventV11 = { tick: number; kind: string; x: number; y: number; points: number };
export type PinballStateV11 = CoreState & {
  seed: string;
  layout: number;
  phase: "lane" | "play" | "waiting";
  waitUntil: number;
  ball: PinballBallV11;
  launches: number;
  lastDrainX: number;
  charge: number;
  chargeHeld: boolean;
  left: number;
  right: number;
  leftHeld: boolean;
  rightHeld: boolean;
  dLeft: number;
  dRight: number;
  multiplier: number;
  targets: number[];
  rTargets: number[];
  drops: number[];
  lanes: number[];
  saucerLit: number;
  saucerHold: number;
  saucerUntil: number;
  saucerHits: number;
  spinAcc: number;
  spins: number;
  ramps: number;
  orbits: number;
  lastRampTick: number;
  lastOrbitTick: number;
  lastShotTick: number;
  lastShotKind: string;
  combo: number;
  skillLane: number;
  skillDone: number;
  launchTick: number;
  bonusCount: number;
  endBonus: number;
  lastFlickTick: number;
  /** Centre drains so far: each one re-serves the ball (multiplier and combo reset), the clock keeps running. */
  drains: number;
  /** Tick at which the match ends (grows with extra time). */
  endTick: number;
  /** Mission progress: lanes, left targets, drop bank (1 = done since the last mission). */
  mission: number[];
  missions: number;
  /** Hurry-up jackpot value (0 = not lit). */
  hurry: number;
  hurryCollected: number;
  saveUntil: number;
  saves: number;
  frenzyAnnounced: number;
  /** Passage being ridden (-1 = none), distance travelled along it, and cool-down end. */
  tube: number;
  tubeD: number;
  tubeUntil: number;
  /** Capture offset from the path start (blended out over tubeBlendMilli) and ride speed at capture (milli-px/tick). */
  tubeOx: number;
  tubeOy: number;
  tubeV0: number;
  rails: number;
  wormholes: number;
  stuck: number;
  /** Where the current stuck count started (the 12-px box is centred here). */
  stuckX: number;
  stuckY: number;
  nudges: number;
  bumperFlash: number[];
  slingFlash: number[];
  dropFlash: number[];
  /** V11: last hit tick of each rubber post (and lane separator), and how many post hits so far. */
  postFlash: number[];
  posts: number;
  /** V11: left spinner accumulator and spins, inlane rollovers (lit), their last pass, and upper-flipper flicks. */
  lSpinAcc: number;
  lSpins: number;
  inlanes: number[];
  inlaneFlash: number[];
  inlaneSets: number;
  lastEvent: PinballEventV11 | null;
  feed: PinballEventV11[];
  /** Balls in play besides the main one (multiball), with their own stuck count. */
  extra: (PinballBallV11 & { stuck: number; sx: number; sy: number })[];
  lockLit: number;
  locks: number;
  multiball: number;
  multiballs: number;
  mbSaveUntil: number;
  jackpots: number;
  jackpotValue: number;
  superLit: number;
  supers: number;
  /** Timed mode: -1 none, 0 bumper storm, 1 spinner fever, 2 ramp rush. */
  mode: number;
  modeUntil: number;
  nextMode: number;
};

export function pinballChargeLevelV11(charge: number) {
  return Math.min(R.maxChargeLevel, Math.floor(charge / R.chargeStepTicks));
}
const cosP = (p: number) => sinPhaseMilli(p + 1024);
export function pinballFlipperTipV11(side: "left" | "right", angle: number) {
  const pivot = side === "left" ? R.leftPivot : R.rightPivot,
    L = R.flipLengthMilli,
    dx = roundDiv(L * cosP(angle), 1000),
    dy = roundDiv(L * sinPhaseMilli(angle), 1000);
  return { x: pivot.x + (side === "left" ? dx : -dx), y: pivot.y + dy, pivot };
}

/** V11: the upper flipper on the right (pivot by the right wall, pointing left); it follows the right button. */
export function pinballUpperTipV11(angle: number) {
  const pivot = R.upperPivot, L = R.upperFlipLengthMilli;
  return { x: pivot.x - roundDiv(L * cosP(angle), 1000), y: pivot.y + roundDiv(L * sinPhaseMilli(angle), 1000), pivot };
}
function restBall(): PinballBallV11 {
  return { x: R.laneX, y: R.laneRestY, vx: 0, vy: 0, xr: 0, yr: 0 };
}
export function createPinballStateV11(seed: string): PinballStateV11 {
  return {
    tick: 0, status: "running", score: 0, failure: null, seed,
    // Fixed table: the same layout in every match.
    layout: 0,
    phase: "lane", waitUntil: 0, ball: restBall(), launches: 0, lastDrainX: 0,
    charge: 0, chargeHeld: false,
    left: R.flipRest, right: R.flipRest, leftHeld: false, rightHeld: false, dLeft: 0, dRight: 0,
    multiplier: 1, targets: [0, 0, 0, 0], rTargets: [0, 0, 0], drops: [0, 0, 0], lanes: [0, 0, 0],
    saucerLit: 0, saucerHold: 0, saucerUntil: 0, saucerHits: 0, spinAcc: 0, spins: 0,
    ramps: 0, orbits: 0, lastRampTick: -1000, lastOrbitTick: -1000,
    lastShotTick: -10000, lastShotKind: "", combo: 0,
    skillLane: 0, skillDone: 0, launchTick: -1,
    bonusCount: 0, endBonus: 0, lastFlickTick: -1000,
    drains: 0, stuck: 0, stuckX: 0, stuckY: 0, nudges: 0,
    endTick: R.startTicks, mission: [0, 0, 0], missions: 0, hurry: 0, hurryCollected: 0, saveUntil: -1, saves: 0, frenzyAnnounced: 0, tube: -1, tubeD: 0, tubeUntil: 0, tubeOx: 0, tubeOy: 0, tubeV0: 0, rails: 0, wormholes: 0,
    bumperFlash: pinballBumpersV11(0).map(() => -1000), slingFlash: [-1000, -1000], dropFlash: [-1000, -1000, -1000],
    postFlash: PINBALL_POSTS_V11.map(() => -1000), posts: 0,
    lSpinAcc: 0, lSpins: 0, inlanes: [0, 0], inlaneFlash: [-1000, -1000], inlaneSets: 0,
    lastEvent: null, feed: [],
    extra: [], lockLit: 0, locks: 0, multiball: 0, multiballs: 0, mbSaveUntil: -1, jackpots: 0, jackpotValue: R.jackpotBase,
    superLit: 0, supers: 0, mode: -1, modeUntil: 0, nextMode: 0,
  };
}
export function copyPinballStateV11(s: PinballStateV11): PinballStateV11 {
  return {
    ...s, ball: { ...s.ball }, targets: [...s.targets], rTargets: [...s.rTargets], drops: [...s.drops],
    lanes: [...s.lanes], mission: [...s.mission], bumperFlash: [...s.bumperFlash], slingFlash: [...s.slingFlash], dropFlash: [...s.dropFlash], postFlash: [...s.postFlash], inlanes: [...s.inlanes], inlaneFlash: [...s.inlaneFlash],
    lastEvent: s.lastEvent ? { ...s.lastEvent } : null, feed: s.feed.map((e) => ({ ...e })), extra: s.extra.map((e) => ({ ...e })),
  };
}

type Hit = { nx: number; ny: number; t: number };
function collide(
  s: PinballStateV11, ax: number, ay: number, bx: number, by: number,
  r: number, e: number, svx = 0, svy = 0,
): Hit | null {
  const b = s.ball,
    abx = bx - ax, aby = by - ay,
    len2 = abx * abx + aby * aby;
  let t = 0;
  if (len2 > 0)
    t = Math.max(0, Math.min(1000, roundDiv(((b.x - ax) * abx + (b.y - ay) * aby) * 1000, len2)));
  const cx = ax + roundDiv(abx * t, 1000), cy = ay + roundDiv(aby * t, 1000),
    dx = b.x - cx, dy = b.y - cy, d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return null;
  const d = integerSqrt(d2);
  let nx = 0, ny = -1000;
  if (d > 0) { nx = roundDiv(dx * 1000, d); ny = roundDiv(dy * 1000, d); }
  const push = r - d;
  b.x += roundDiv(nx * push, 1000);
  b.y += roundDiv(ny * push, 1000);
  let rvx = b.vx - svx, rvy = b.vy - svy;
  const vn = roundDiv(rvx * nx + rvy * ny, 1000);
  if (vn < 0) {
    const impulse = roundDiv((1000 + e) * -vn, 1000);
    rvx += roundDiv(impulse * nx, 1000);
    rvy += roundDiv(impulse * ny, 1000);
  }
  b.vx = rvx + svx; b.vy = rvy + svy;
  return { nx, ny, t };
}
function emit(s: PinballStateV11, kind: string, x: number, y: number, points: number) {
  const ev = { tick: s.tick, kind, x, y, points };
  s.lastEvent = ev;
  s.feed.push(ev);
  if (s.feed.length > 8) s.feed.shift();
}
export const pinballFrenzyV11 = (s: Pick<PinballStateV11, "tick" | "endTick">) => s.tick >= s.endTick - R.frenzyTicks;
function add(s: PinballStateV11, base: number, kind: string, x: number, y: number) {
  const points = base * s.multiplier * (pinballFrenzyV11(s) ? 2 : 1);
  s.score += points;
  emit(s, kind, x, y, points);
}
function raiseMultiplier(s: PinballStateV11) {
  if (s.multiplier < R.maxMultiplier) s.multiplier++;
}
/** Marks one mission step; all three → MISSION award and extra time. */
function missionStep(s: PinballStateV11, step: number, x: number, y: number) {
  s.mission[step] = 1;
  if (!s.mission.every(Boolean)) return;
  s.mission = [0, 0, 0];
  s.missions++;
  add(s, R.missionPoints, "MISSION", x, y);
  s.mode = s.nextMode; s.nextMode = (s.nextMode + 1) % 3; s.modeUntil = s.tick + R.modeTicks;
  emit(s, `MODE${s.mode}`, 195000, 300000, 0);
  if (s.missions <= R.maxExtraTimes) {
    s.endTick = Math.min(R.maxFinalTick, s.endTick + R.extraTimeTicks);
    emit(s, "EXTRATIME", 195000, 280000, 0);
  }
}
/** Ramp/orbit shots collect a lit hurry-up. */
function collectHurry(s: PinballStateV11, x: number, y: number) {
  if (!s.hurry) return;
  const value = s.hurry;
  s.hurry = 0;
  s.hurryCollected++;
  add(s, value, "HURRYGO", x, y);
}
/** A feature shot: counts toward the end bonus and chains into a combo with a different shot inside 4 s. */
function shot(s: PinballStateV11, kind: string, x: number, y: number) {
  s.bonusCount++;
  if (kind !== s.lastShotKind && s.tick - s.lastShotTick <= R.comboWindowTicks) {
    s.combo++;
    add(s, 500 * Math.min(5, s.combo), "COMBO", x, y - 20000);
  } else s.combo = 0;
  s.lastShotTick = s.tick;
  s.lastShotKind = kind;
}
function flipperVelocity(side: "left" | "right" | "upper", angle: number, delta: number, t: number) {
  const tipOf = (a: number) => (side === "upper" ? pinballUpperTipV11(a) : pinballFlipperTipV11(side, a));
  const now = tipOf(angle), before = tipOf(angle - delta);
  return {
    x: roundDiv(roundDiv((now.x - before.x) * t, 1000) * R.tickRate, 1),
    y: roundDiv(roundDiv((now.y - before.y) * t, 1000) * R.tickRate, 1),
  };
}
function finish(s: PinballStateV11, failure: string) {
  s.endBonus = s.bonusCount * R.bonusPerFeature * s.multiplier;
  if (s.endBonus > 0) { s.score += s.endBonus; emit(s, "BONUS", 195000, 300000, s.endBonus); }
  s.status = "failed";
  s.failure = failure;
}
function loseBall(s: PinballStateV11) {
  // Multiball: the main ball drains, another ball in play takes over (nothing else is lost).
  if (s.extra.length) {
    const e = s.extra.shift()!;
    emit(s, "DRAIN", s.ball.x, 590000, 0);
    s.ball = { x: e.x, y: e.y, vx: e.vx, vy: e.vy, xr: e.xr, yr: e.yr };
    s.stuck = 0; s.stuckX = e.x; s.stuckY = e.y;
    endMultiballIfDone(s);
    return;
  }
  // Only the centre gap between the flippers drains. The ball returns to the spring; the clock keeps running.
  s.lastDrainX = s.ball.x;
  s.drains++;
  if (s.tick <= s.saveUntil) {
    // Ball save: the multiplier and the combo survive.
    s.saves++;
    s.saveUntil = -1;
    s.phase = "waiting";
    s.waitUntil = s.tick + R.waitTicks;
    emit(s, "SAVED", s.ball.x, 590000, 0);
    return;
  }
  s.multiplier = 1;
  s.combo = 0;
  s.hurry = 0;
  s.lastShotTick = -10000;
  s.lastShotKind = "";
  s.phase = "waiting";
  s.waitUntil = s.tick + R.waitTicks;
  emit(s, "DRAIN", s.ball.x, 590000, 0);
}

/** Gravity, motion and every collision for the ball in s.ball (the main ball or, in turn, each extra ball). */
function movePhysics(s: PinballStateV11) {
  const b = s.ball;
  b.vy += roundDiv(R.gravityMilli, R.tickRate);
  const rr = R.radiusMilli, div = R.tickRate * R.substeps;
  for (let sub = 0; sub < R.substeps; sub++) {
    b.xr += b.vx; b.yr += b.vy;
    const dx = Math.trunc(b.xr / div), dy = Math.trunc(b.yr / div);
    b.xr -= dx * div; b.yr -= dy * div;
    b.x += dx; b.y += dy;
    for (let pass = 0; pass < 3; pass++) {
      for (const w of PINBALL_WALLS_V11) collide(s, w.ax, w.ay, w.bx, w.by, rr, w.e);
      PINBALL_POSTS_V11.forEach((p, i) => {
        if (!collide(s, p.x, p.y, p.x, p.y, rr + p.r, 750)) return;
        // Rubber: a slow ball is kicked away from the post's centre at the post speed.
        const sp = integerSqrt(b.vx * b.vx + b.vy * b.vy);
        if (sp < PINBALL_POST_KICK_V11) {
          const dxp = b.x - p.x, dyp = b.y - p.y, d = Math.max(1, integerSqrt(dxp * dxp + dyp * dyp));
          b.vx = roundDiv(dxp * PINBALL_POST_KICK_V11, d); b.vy = roundDiv(dyp * PINBALL_POST_KICK_V11, d);
        }
        // One award per contact (a ball pressed against a post scores once every 12 ticks at most).
        if (s.tick - s.postFlash[i] > 12) { s.posts++; add(s, p.points, "POST", p.x, p.y); }
        s.postFlash[i] = s.tick;
      });
      PINBALL_TARGETS_V11.forEach((w, i) => {
        if (collide(s, w.ax, w.ay, w.bx, w.by, rr, w.e) && !s.targets[i]) {
          s.targets[i] = 1;
          add(s, 500, "TARGET", w.ax, (w.ay + w.by) >> 1);
          if (s.targets.every(Boolean)) {
            add(s, 3000, "TARGETS", w.ax, w.ay); raiseMultiplier(s); shot(s, "TARGETS", w.ax, w.ay);
            s.targets = [0, 0, 0, 0];
            missionStep(s, 1, w.ax, w.ay);
          }
        }
      });
      PINBALL_RTARGETS_V11.forEach((w, i) => {
        if (collide(s, w.ax, w.ay, w.bx, w.by, rr, w.e) && !s.rTargets[i]) {
          s.rTargets[i] = 1;
          add(s, 500, "RTARGET", w.ax, (w.ay + w.by) >> 1);
          if (s.rTargets.every(Boolean)) {
            s.rTargets = [0, 0, 0];
            if (s.multiball) { s.saucerLit = 1; emit(s, "SAUCERLIT", w.ax, w.ay, 0); }
            else if (!s.lockLit) { s.lockLit = 1; emit(s, "LOCKLIT", w.ax, w.ay, 0); }
          }
        }
      });
      PINBALL_DROPS_V11.forEach((w, i) => {
        if (s.drops[i]) return;
        if (collide(s, w.ax, w.ay, w.bx, w.by, rr, w.e)) {
          s.drops[i] = 1; s.dropFlash[i] = s.tick;
          add(s, 300, "DROP", (w.ax + w.bx) >> 1, w.ay);
          if (s.drops.every(Boolean)) {
            add(s, 4000, "DROPS", 195000, w.ay); raiseMultiplier(s); shot(s, "DROPS", 195000, w.ay);
            s.drops = [0, 0, 0];
            if (!s.hurry) { s.hurry = R.hurryStart; emit(s, "HURRY", 195000, w.ay, 0); }
            missionStep(s, 2, 195000, w.ay);
          }
        }
      });
      pinballBumpersV11(s.layout).forEach((p, i) => {
        if (collide(s, p.x, p.y, p.x, p.y, rr + p.r, 600)) {
          const sp = integerSqrt(b.vx * b.vx + b.vy * b.vy);
          if (sp < 460000) {
            const dxp = b.x - p.x, dyp = b.y - p.y, d = Math.max(1, integerSqrt(dxp * dxp + dyp * dyp));
            b.vx = roundDiv(dxp * 460000, d); b.vy = roundDiv(dyp * 460000, d);
          }
          s.bumperFlash[i] = s.tick;
          add(s, s.mode === 0 ? p.points * R.stormFactor : p.points, "BUMPER", p.x, p.y);
        }
      });
      PINBALL_SLINGS_V11.forEach((p, i) => {
        if (collide(s, p.x, p.y, p.x, p.y, rr + p.r, 500)) {
          const sp = integerSqrt(b.vx * b.vx + b.vy * b.vy);
          if (sp < PINBALL_SLING_KICK_V11) {
            const dxp = b.x - p.x, dyp = b.y - p.y, d = Math.max(1, integerSqrt(dxp * dxp + dyp * dyp));
            b.vx = roundDiv(dxp * PINBALL_SLING_KICK_V11, d); b.vy = roundDiv(dyp * PINBALL_SLING_KICK_V11, d);
          }
          s.slingFlash[i] = s.tick;
          add(s, p.points, "SLING", p.x, p.y);
        }
      });
      for (const side of ["left", "right", "upper"] as const) {
        const angle = side === "left" ? s.left : s.right, delta = side === "left" ? s.dLeft : s.dRight,
          tip = side === "upper" ? pinballUpperTipV11(angle) : pinballFlipperTipV11(side, angle), pivot = tip.pivot;
        const abx = tip.x - pivot.x, aby = tip.y - pivot.y, len2 = abx * abx + aby * aby;
        const t = Math.max(0, Math.min(1000, roundDiv(((b.x - pivot.x) * abx + (b.y - pivot.y) * aby) * 1000, len2)));
        const v = delta ? flipperVelocity(side, angle, delta, t) : { x: 0, y: 0 };
        const hit = collide(s, pivot.x, pivot.y, tip.x, tip.y, rr + R.flipHalfThickMilli, 300, v.x, v.y);
        // Timing reward: catching the ball with the tip of a swinging flipper.
        if (hit && delta !== 0 && hit.t >= 700 && s.tick - s.lastFlickTick > 24) {
          s.lastFlickTick = s.tick;
          add(s, 150, "FLICK", b.x, b.y);
        }
      }
    }
    const sp2 = b.vx * b.vx + b.vy * b.vy;
    if (sp2 > R.maxSpeedMilli * R.maxSpeedMilli) {
      const sp = integerSqrt(sp2);
      b.vx = roundDiv(b.vx * R.maxSpeedMilli, sp); b.vy = roundDiv(b.vy * R.maxSpeedMilli, sp);
    }
  }
}
/** Rollover lanes (with the skill shot) and the spinner, for the ball in s.ball. */
function rollovers(s: PinballStateV11) {
  const b = s.ball;
  PINBALL_LANES_V11.forEach((l, i) => {
    if (!s.lanes[i] && (b.x - l.x) ** 2 + (b.y - l.y) ** 2 < 18000 ** 2) {
      s.lanes[i] = 1;
      add(s, 300, "LANE", l.x, l.y);
      if (!s.skillDone && s.launchTick >= 0 && s.tick - s.launchTick <= R.skillWindowTicks) {
        s.skillDone = 1;
        if (i === s.skillLane) { add(s, 5000, "SKILL", l.x, l.y); raiseMultiplier(s); shot(s, "SKILL", l.x, l.y); }
      }
      if (s.lanes.every(Boolean)) {
        add(s, 2000, "LANES", l.x, l.y); raiseMultiplier(s); shot(s, "LANES", l.x, l.y);
        s.lanes = [0, 0, 0];
        missionStep(s, 0, l.x, l.y);
      }
    }
  });
  const sp = PINBALL_SPINNER_V11;
  if (b.x > sp.x0 && b.x < sp.x1 && b.y > sp.y0 && b.y < sp.y1) {
    s.spinAcc += integerSqrt(b.vx * b.vx + b.vy * b.vy);
    if (s.spinAcc >= 1600000) {
      s.spinAcc -= 1600000; s.spins++;
      add(s, s.mode === 1 ? R.modeSpinner : 50, "SPINNER", b.x, b.y);
    }
  }
  const ls = PINBALL_LSPINNER_V11;
  if (b.x > ls.x0 && b.x < ls.x1 && b.y > ls.y0 && b.y < ls.y1) {
    s.lSpinAcc += integerSqrt(b.vx * b.vx + b.vy * b.vy);
    if (s.lSpinAcc >= 1600000) {
      s.lSpinAcc -= 1600000; s.lSpins++;
      add(s, s.mode === 1 ? R.modeSpinner : R.leftSpinnerPoints, "LSPINNER", b.x, b.y);
    }
  }
  PINBALL_INLANES_V11.forEach((l, i) => {
    if ((b.x - l.x) ** 2 + (b.y - l.y) ** 2 >= 14000 ** 2 || s.tick - s.inlaneFlash[i] < 60) return;
    s.inlaneFlash[i] = s.tick;
    if (s.inlanes[i]) return;
    s.inlanes[i] = 1;
    add(s, R.inlanePoints, "INLANE", l.x, l.y);
    if (s.inlanes.every(Boolean)) {
      s.inlanes = [0, 0]; s.inlaneSets++;
      add(s, R.inlanesPoints, "INLANES", 195000, 470000);
      s.saveUntil = Math.max(s.saveUntil, s.tick + R.ballSaveTicks);
    }
  });
}
/** Multiball scoring for a ramp or orbit shot: a growing jackpot; every third lights the super jackpot. */
function multiballShot(s: PinballStateV11, x: number, y: number) {
  if (!s.multiball) return;
  add(s, s.jackpotValue, "JACKPOT", x, y);
  s.jackpotValue += R.jackpotStep;
  s.jackpots++;
  if (s.jackpots % R.jackpotsForSuper === 0 && !s.superLit) { s.superLit = 1; emit(s, "SUPERLIT", PINBALL_WORMHOLE_V11.x, PINBALL_WORMHOLE_V11.y, 0); }
}
function startMultiball(s: PinballStateV11) {
  s.multiball = 1; s.multiballs++; s.locks = 0; s.jackpots = 0; s.jackpotValue = R.jackpotBase; s.superLit = 0;
  s.mbSaveUntil = s.tick + R.multiballSaveTicks;
  const sc = PINBALL_SAUCER_V11;
  for (const k of [EJECT[1], EJECT[2]]) s.extra.push({ x: sc.x, y: sc.y + 16000, vx: k.vx, vy: k.vy, xr: 0, yr: 0, stuck: 0, sx: sc.x, sy: sc.y });
  add(s, R.multiballStart, "MULTIBALL", sc.x, sc.y);
}
function endMultiballIfDone(s: PinballStateV11) {
  if (!s.multiball || s.extra.length) return;
  s.multiball = 0; s.superLit = 0; s.saucerLit = 0;
  emit(s, "MBEND", 195000, 300000, s.jackpots);
}
/** Extra balls: the whole table except the passages and the saucer; a drained one is saved early in multiball. */
function stepExtras(s: PinballStateV11) {
  const main = s.ball;
  for (let i = 0; i < s.extra.length; i++) {
    const e = s.extra[i];
    s.ball = e;
    movePhysics(s);
    rollovers(s);
    const rz = PINBALL_RAMP_ZONE_V11, oz = PINBALL_ORBIT_ZONE_V11;
    const inRamp = e.x > rz.x0 && e.x < rz.x1 && e.y > rz.y0 && e.y < rz.y1, inOrbit = e.x > oz.x0 && e.x < oz.x1 && e.y > oz.y0 && e.y < oz.y1;
    if ((inRamp || inOrbit) && e.vy < -100000) {
      add(s, 1500, inRamp ? "RAMP" : "ORBIT", e.x, e.y);
      multiballShot(s, e.x, e.y);
      // Sent round the top like the habitrail would, without riding it.
      e.y = (inRamp ? rz : oz).y1 + 1000; e.vy = -e.vy; e.vx = inRamp ? 160000 : -160000;
    }
    if (Math.abs(e.x - e.sx) < R.stuckBox && Math.abs(e.y - e.sy) < R.stuckBox) e.stuck++;
    else { e.stuck = 0; e.sx = e.x; e.sy = e.y; }
    if (e.stuck >= R.extraStuckTicks) { e.stuck = 0; e.vx = e.x < 195000 ? R.nudgeVx : -R.nudgeVx; e.vy = R.nudgeVy; emit(s, "NUDGE", e.x, e.y, 0); }
    if (e.y > R.drainY) {
      if (s.tick <= s.mbSaveUntil) {
        const sc = PINBALL_SAUCER_V11;
        Object.assign(e, { x: sc.x, y: sc.y + 16000, vx: EJECT[0].vx, vy: EJECT[0].vy, xr: 0, yr: 0, stuck: 0 });
        emit(s, "SAVED", e.x, 590000, 0);
      } else { s.extra.splice(i, 1); i--; emit(s, "DRAIN", e.x, 590000, 0); }
    }
  }
  s.ball = main;
  endMultiballIfDone(s);
}

function stepInner(s: PinballStateV11) {
  s.tick++;
  for (const side of ["left", "right"] as const) {
    const held = side === "left" ? s.leftHeld : s.rightHeld,
      cur = side === "left" ? s.left : s.right,
      goal = held ? R.flipUp : R.flipRest;
    const next = cur < goal ? Math.min(goal, cur + R.flipStep) : Math.max(goal, cur - R.flipStep);
    if (side === "left") { s.dLeft = next - cur; s.left = next; } else { s.dRight = next - cur; s.right = next; }
  }
  if (s.extra.length) stepExtras(s);
  if (s.phase === "waiting") {
    if (s.tick >= s.waitUntil) { s.phase = "lane"; s.ball = restBall(); s.charge = 0; s.chargeHeld = false; s.stuck = 0; }
    return;
  }
  if (s.phase === "lane") {
    if (s.chargeHeld && s.charge < R.maxChargeLevel * R.chargeStepTicks) s.charge++;
    return;
  }
  const b = s.ball;
  // Saucer: the ball is held, then ejected along a fixed rotating pattern.
  if (s.saucerHold > 0) {
    s.saucerHold--;
    b.x = PINBALL_SAUCER_V11.x; b.y = PINBALL_SAUCER_V11.y; b.vx = 0; b.vy = 0; b.xr = 0; b.yr = 0;
    if (s.saucerHold === 0) {
      const k = EJECT[s.saucerHits % EJECT.length];
      b.vx = k.vx; b.vy = k.vy;
      s.saucerUntil = s.tick + R.saucerCooldownTicks;
      emit(s, "EJECT", b.x, b.y, 0);
    }
    return;
  }
  // Passage ride: the ball blends from where it was caught into the fixed path, easing to the exit speed.
  if (s.tube >= 0) {
    const total = TUBE_TOTAL[s.tube], exit = PINBALL_TUBE_EXITS_V11[s.tube];
    const vEnd = roundDiv(PINBALL_TUBES_V11[s.tube].exitSpeed, R.tickRate);
    const v = Math.max(1000, s.tubeV0 + roundDiv((vEnd - s.tubeV0) * s.tubeD, total));
    const over = Math.max(0, s.tubeD + v - total);
    s.tubeD = Math.min(total, s.tubeD + v);
    const p = pinballTubePointV11(s.tube, s.tubeD), left = Math.max(0, R.tubeBlendMilli - s.tubeD);
    // Past the end, the leftover distance continues along the exit direction (no short last step).
    const ex = roundDiv(exit.vx * over, PINBALL_TUBES_V11[s.tube].exitSpeed), ey = roundDiv(exit.vy * over, PINBALL_TUBES_V11[s.tube].exitSpeed);
    const nx = p.x + ex + roundDiv(s.tubeOx * left, R.tubeBlendMilli), ny = p.y + ey + roundDiv(s.tubeOy * left, R.tubeBlendMilli);
    // Velocity mirrors the actual motion (renderer trail); physics ignores it while riding.
    b.vx = (nx - b.x) * R.tickRate; b.vy = (ny - b.y) * R.tickRate;
    b.x = nx; b.y = ny; b.xr = 0; b.yr = 0;
    if (s.tubeD >= total) {
      const tube = PINBALL_TUBES_V11[s.tube];
      b.vx = exit.vx; b.vy = exit.vy;
      if (tube.kind === "RAIL") { s.rails++; add(s, R.railPoints, "RAIL", b.x, b.y); }
      else emit(s, "WORMHOLEOUT", b.x, b.y, 0);
      s.tube = -1; s.tubeD = 0; s.tubeOx = 0; s.tubeOy = 0; s.tubeV0 = 0; s.tubeUntil = s.tick + R.tubeCooldownTicks;
    }
    return;
  }
  movePhysics(s);
  rollovers(s);
  const rz = PINBALL_RAMP_ZONE_V11, oz = PINBALL_ORBIT_ZONE_V11;
  if (b.x > rz.x0 && b.x < rz.x1 && b.y > rz.y0 && b.y < rz.y1 && b.vy < -100000 && s.tick - s.lastRampTick > 120) {
    s.lastRampTick = s.tick; s.ramps++;
    add(s, 1500, "RAMP", b.x, b.y); shot(s, "RAMP", b.x, b.y); collectHurry(s, b.x, b.y);
    if (s.mode === 2) add(s, R.modeRush, "RUSH", b.x, b.y);
    multiballShot(s, b.x, b.y);
    if (s.tick >= s.tubeUntil) { enterTube(s, 0); return; }
  }
  if (b.x > oz.x0 && b.x < oz.x1 && b.y > oz.y0 && b.y < oz.y1 && b.vy < -100000 && s.tick - s.lastOrbitTick > 120) {
    s.lastOrbitTick = s.tick; s.orbits++;
    add(s, 1500, "ORBIT", b.x, b.y); shot(s, "ORBIT", b.x, b.y); collectHurry(s, b.x, b.y);
    if (s.mode === 2) add(s, R.modeRush, "RUSH", b.x, b.y);
    multiballShot(s, b.x, b.y);
    if (s.tick >= s.tubeUntil) { enterTube(s, 1); return; }
  }
  const wh = PINBALL_WORMHOLE_V11;
  if (s.tick >= s.tubeUntil && (b.x - wh.x) ** 2 + (b.y - wh.y) ** 2 < wh.r ** 2) {
    s.wormholes++;
    add(s, R.wormholePoints, "WORMHOLE", wh.x, wh.y); shot(s, "WORMHOLE", wh.x, wh.y);
    if (s.superLit) { s.superLit = 0; s.supers++; add(s, s.jackpotValue * R.superFactor, "SUPER", wh.x, wh.y); }
    enterTube(s, 2);
    return;
  }
  const sc = PINBALL_SAUCER_V11;
  if (s.tick >= s.saucerUntil && (b.x - sc.x) ** 2 + (b.y - sc.y) ** 2 < sc.r ** 2) {
    s.saucerHits++;
    s.saucerHold = R.saucerHoldTicks;
    b.vx = 0; b.vy = 0; b.xr = 0; b.yr = 0; b.x = sc.x; b.y = sc.y;
    if (s.lockLit && !s.multiball) {
      s.lockLit = 0;
      if (s.locks >= R.locksForMultiball) startMultiball(s);
      else { s.locks++; add(s, 2000, "LOCK", sc.x, sc.y); }
    } else if (s.saucerLit) { s.saucerLit = 0; add(s, 5000, "JACKPOT", sc.x, sc.y); raiseMultiplier(s); }
    else add(s, 1000, "SAUCER", sc.x, sc.y);
    shot(s, "SAUCER", sc.x, sc.y);
    return;
  }
  // Back in the lane (rolled in from the top): ready for the spring again.
  if (b.x > 347000 && b.y > 560000 && Math.abs(b.vy) < 25000 && Math.abs(b.vx) < 25000) {
    s.phase = "lane"; s.ball = restBall(); s.charge = 0; s.chargeHeld = false; return;
  }
  // Stuck: stays inside a small box (resting or jiggling). A ball cradled on a raised flipper is left alone.
  const cradled = ((s.leftHeld || s.rightHeld) && b.y > 500000 && b.x > 96000 && b.x < 294000)
    || (s.rightHeld && b.y > 300000 && b.y < 360000 && b.x > 286000);
  if (!cradled && Math.abs(b.x - s.stuckX) < R.stuckBox && Math.abs(b.y - s.stuckY) < R.stuckBox) s.stuck++;
  else { s.stuck = 0; s.stuckX = b.x; s.stuckY = b.y; }
  if (s.stuck >= R.stuckTicks) {
    s.nudges++; s.stuck = 0;
    const side = b.x < 195000 ? 1 : -1;
    // Trapped low on a side: always the same release point of that side, so the bounce out is identical.
    if (b.y > 300000 && (b.x < 90000 || b.x > 274000)) {
      const p = R.sideRelease[side > 0 ? 0 : 1];
      b.x = p.x; b.y = p.y; b.xr = 0; b.yr = 0;
      b.vx = side * R.sideNudgeVx; b.vy = R.sideNudgeVy;
    } else { b.vx = side * R.nudgeVx; b.vy = R.nudgeVy; }
    s.stuckX = b.x; s.stuckY = b.y;
    emit(s, "NUDGE", b.x, b.y, 0);
  }
  if (b.y > R.drainY) loseBall(s);
}

export function stepPinballV11(s: PinballStateV11) {
  stepInner(s);
  if (s.hurry) {
    s.hurry -= R.hurryStepPerTick;
    if (s.hurry <= R.hurryFloor) { s.hurry = 0; emit(s, "HURRYOUT", 195000, 230000, 0); }
  }
  if (s.mode >= 0 && s.tick >= s.modeUntil) { s.mode = -1; emit(s, "MODEEND", 195000, 300000, 0); }
  if (!s.frenzyAnnounced && s.status === "running" && pinballFrenzyV11(s)) { s.frenzyAnnounced = 1; emit(s, "FRENZY", 195000, 300000, 0); }
  if (s.status === "running" && s.tick >= s.endTick) finish(s, "TIME_LIMIT");
  if (s.feed.length && s.tick - s.feed[0].tick > 240) s.feed.shift();
}

export function canApplyPinballV11(s: PinballStateV11, a: string) {
  if (s.status !== "running") return false;
  switch (a) {
    case "PLUNGER_HOLD": return s.phase === "lane" && !s.chargeHeld;
    case "PLUNGER_RELEASE": return s.phase === "lane" && s.chargeHeld;
    case "FLIP_LEFT_PRESS": return !s.leftHeld;
    case "FLIP_LEFT_RELEASE": return s.leftHeld;
    case "FLIP_RIGHT_PRESS": return !s.rightHeld;
    case "FLIP_RIGHT_RELEASE": return s.rightHeld;
    default: return false;
  }
}
export function applyPinballV11(s: PinballStateV11, a: string) {
  switch (a) {
    case "PLUNGER_HOLD": s.chargeHeld = true; s.charge = 0; break;
    case "PLUNGER_RELEASE": {
      const level = pinballChargeLevelV11(s.charge);
      s.chargeHeld = false;
      s.phase = "play";
      s.ball = { ...restBall(), vy: -(R.launchBaseMilli + R.launchStepMilli * level) };
      if (s.launches === 0 || !s.skillDone) { s.launchTick = s.tick; }
      // The skill lane rotates A → B → C with each launch (known in advance, same in every match).
      s.skillLane = s.launches % 3;
      s.launches++;
      s.saveUntil = s.tick + R.ballSaveTicks;
      emit(s, "LAUNCH", R.laneX, R.laneRestY, 0);
      break;
    }
    case "FLIP_LEFT_PRESS": s.leftHeld = true; break;
    case "FLIP_LEFT_RELEASE": s.leftHeld = false; break;
    case "FLIP_RIGHT_PRESS": s.rightHeld = true; break;
    case "FLIP_RIGHT_RELEASE": s.rightHeld = false; break;
  }
}

export const PINBALL_CORE_V11: GameCore<PinballStateV11> = {
  gameId: "pinball",
  gameVersion: "11.0.0",
  width: 390,
  height: 620,
  tickRate: R.tickRate,
  maxFinalTick: R.maxFinalTick,
  maxInputs: R.maxInputs,
  inputVersion: 1,
  actions: PINBALL_ACTIONS_V3,
  content: {
    rules: R,
    table: {
      walls: PINBALL_WALLS_V11, targets: PINBALL_TARGETS_V11, rTargets: PINBALL_RTARGETS_V11, drops: PINBALL_DROPS_V11,
      lanes: PINBALL_LANES_V11, posts: PINBALL_POSTS_V11, slings: PINBALL_SLINGS_V11, saucer: PINBALL_SAUCER_V11,
      spinner: PINBALL_SPINNER_V11, leftSpinner: PINBALL_LSPINNER_V11, inlanes: PINBALL_INLANES_V11, ramp: PINBALL_RAMP_ZONE_V11, orbit: PINBALL_ORBIT_ZONE_V11, eject: EJECT,
      layouts: LAYOUTS, bumperRadius: PINBALL_BUMPER_RADIUS_V11, wormhole: PINBALL_WORMHOLE_V11, tubes: PINBALL_TUBES_V11,
    },
    launch: "spring-charge-level-0..8;speed=500+60*level px/s;straight-up-lane",
    scoring: "v11-six-bumpers-300/500/200/400/100/250;posts15/20/25/30/40/45/60/70-kick300;sling35/55-kick420;upper-right-flipper;left-spinner75;inlanes500+2500+ball-save;storm=bumper*4;lock-lit-by-right-targets;lock2000;third-lock-multiball5000-3-balls-save8s;jackpot10000+5000-per-ramp-or-orbit-in-multiball;super-at-wormhole-after-3-jackpots-x3;modes-20s-storm/spinner1000/rush+5000;target500;targets3000;rtarget500;saucer1000/jackpot5000;drop300/drops4000;lanes300+2000;skill5000;spinner50;ramp1500;orbit1500;combo500*n;flick150;multiplier-x1..5;end-bonus1000*features*mult",
    completion: "fixed-table;passages-2-habitrails+wormhole-fixed-paths-seamless-blend36px-speed-eased;stuck-box-12px-2s;side-trap-fixed-release-point+roll-to-flipper;no-inlane-posts;rail-exits-along-guides;100s-clock+3x10s-extra-time-missions;hurry-up;ball-save-5s;frenzy-x2-last-10s",
  },
  create: createPinballStateV11,
  step: stepPinballV11,
  canApply: canApplyPinballV11,
  apply: applyPinballV11,
};
