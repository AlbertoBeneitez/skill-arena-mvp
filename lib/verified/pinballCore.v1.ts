/**
 * Pinball V1 — original table, integer/fixed-point physics (1 px = 1000 milli, speeds in milli-px/s).
 * The ball starts only from the spring: launch speed is the quantised charge level. The centre between
 * the flippers is closed (the tips overlap even when raised), so a ball is lost only through the outlanes,
 * or by a clear player error. Layout of the bumpers depends on the seed; the launch never does.
 */
import { createRng } from "../deterministic/seeded";
import { integerSqrt, roundDiv, sinPhaseMilli } from "../deterministic/integerMath";
import type { CoreState, GameCore } from "./coreRuntime.v1";
import { PINBALL_ACTIONS } from "./pinballProtocol.v1";

export const PINBALL_RULES = {
  tickRate: 120,
  maxFinalTick: 120 * 180,
  maxInputs: 8000,
  balls: 3,
  radiusMilli: 9000,
  gravityMilli: 600000,
  maxSpeedMilli: 1000000,
  laneX: 359000,
  laneRestY: 576000,
  chargeStepTicks: 8,
  maxChargeLevel: 8,
  launchBaseMilli: 500000,
  launchStepMilli: 60000,
  saverTicks: 720,
  waitTicks: 90,
  drainY: 616000,
  flipRest: 300,
  flipUp: -330,
  flipStep: 79,
  flipLengthMilli: 66000,
  flipHalfThickMilli: 7000,
  leftPivot: { x: 132000, y: 552000 },
  rightPivot: { x: 258000, y: 552000 },
  stuckTicks: 480,
  maxMultiplier: 5,
} as const;

export type PinballSegment = { ax: number; ay: number; bx: number; by: number; e: number };
const seg = (ax: number, ay: number, bx: number, by: number, e = 450): PinballSegment => ({
  ax: ax * 1000, ay: ay * 1000, bx: bx * 1000, by: by * 1000, e,
});
/** Walls, lane and inlane guides. Everything is frozen: the table never changes between versions. */
export const PINBALL_WALLS: readonly PinballSegment[] = Object.freeze([
  seg(18, 640, 18, 140), seg(18, 140, 46, 70), seg(46, 70, 110, 42), seg(110, 42, 290, 42),
  seg(290, 42, 372, 124), seg(372, 124, 372, 640),
  seg(346, 150, 346, 585), seg(346, 585, 372, 585, 100),
  seg(46, 478, 132, 552, 300), seg(322, 478, 258, 552, 300),
]);
/** Left-wall stand-up targets (hit to light them). */
export const PINBALL_TARGETS: readonly PinballSegment[] = Object.freeze(
  [0, 1, 2, 3].map((i) => seg(25, 250 + i * 34, 25, 274 + i * 34, 300)),
);
export const PINBALL_LANES = Object.freeze([
  { x: 120000, y: 118000 }, { x: 170000, y: 118000 }, { x: 220000, y: 118000 },
]);
export const PINBALL_POSTS = Object.freeze([
  { x: 46000, y: 478000, r: 5000 }, { x: 322000, y: 478000, r: 5000 },
]);
/** Kicking posts near the inlanes ("slingshots"). */
export const PINBALL_SLINGS = Object.freeze([
  { x: 86000, y: 440000, r: 10000 }, { x: 282000, y: 440000, r: 10000 },
]);
const LAYOUTS = Object.freeze([
  [{ x: 150000, y: 150000 }, { x: 235000, y: 205000 }, { x: 120000, y: 250000 }, { x: 190000, y: 310000 }],
  [{ x: 130000, y: 165000 }, { x: 225000, y: 150000 }, { x: 105000, y: 270000 }, { x: 250000, y: 280000 }],
  [{ x: 170000, y: 145000 }, { x: 255000, y: 190000 }, { x: 135000, y: 235000 }, { x: 215000, y: 295000 }],
  [{ x: 115000, y: 170000 }, { x: 200000, y: 200000 }, { x: 280000, y: 160000 }, { x: 160000, y: 290000 }],
]);
export const PINBALL_BUMPER_RADIUS = 20000;
export const pinballBumpers = (layout: number) => LAYOUTS[layout % LAYOUTS.length];

export type PinballBall = { x: number; y: number; vx: number; vy: number; xr: number; yr: number };
export type PinballEvent = { tick: number; kind: string; x: number; y: number; points: number };
export type PinballState = CoreState & {
  seed: string;
  layout: number;
  phase: "lane" | "play" | "waiting";
  waitUntil: number;
  ball: PinballBall;
  lives: number;
  ballNo: number;
  ballsLost: number;
  lastDrainX: number;
  charge: number;
  left: number;
  right: number;
  leftHeld: boolean;
  rightHeld: boolean;
  dLeft: number;
  dRight: number;
  multiplier: number;
  targets: number[];
  lanes: number[];
  ramps: number;
  lastRampTick: number;
  saver: number;
  stuck: number;
  nudges: number;
  bumperFlash: number[];
  slingFlash: number[];
  lastEvent: PinballEvent | null;
  chargeHeld: boolean;
};

export function pinballChargeLevel(charge: number) {
  return Math.min(
    PINBALL_RULES.maxChargeLevel,
    Math.floor(charge / PINBALL_RULES.chargeStepTicks),
  );
}
const cosP = (p: number) => sinPhaseMilli(p + 1024);
/** Flipper tip for a side and an angle (phase units, 4096 per turn). Right is the mirror image. */
export function pinballFlipperTip(side: "left" | "right", angle: number) {
  const pivot = side === "left" ? PINBALL_RULES.leftPivot : PINBALL_RULES.rightPivot,
    L = PINBALL_RULES.flipLengthMilli,
    dx = roundDiv(L * cosP(angle), 1000),
    dy = roundDiv(L * sinPhaseMilli(angle), 1000);
  return { x: pivot.x + (side === "left" ? dx : -dx), y: pivot.y + dy, pivot };
}

function restBall(): PinballBall {
  return { x: PINBALL_RULES.laneX, y: PINBALL_RULES.laneRestY, vx: 0, vy: 0, xr: 0, yr: 0 };
}
export function createPinballState(seed: string): PinballState {
  return {
    tick: 0, status: "running", score: 0, failure: null, seed,
    layout: createRng(`${seed}:pinball:layout`).nextInt(LAYOUTS.length),
    phase: "lane", waitUntil: 0, ball: restBall(),
    lives: PINBALL_RULES.balls, ballNo: 1, ballsLost: 0, lastDrainX: 0,
    charge: 0, chargeHeld: false,
    left: PINBALL_RULES.flipRest, right: PINBALL_RULES.flipRest,
    leftHeld: false, rightHeld: false, dLeft: 0, dRight: 0,
    multiplier: 1, targets: [0, 0, 0, 0], lanes: [0, 0, 0], ramps: 0, lastRampTick: -1000,
    saver: 0, stuck: 0, nudges: 0, bumperFlash: [-1000, -1000, -1000, -1000], slingFlash: [-1000, -1000],
    lastEvent: null,
  };
}
export function copyPinballState(s: PinballState): PinballState {
  return {
    ...s, ball: { ...s.ball }, targets: [...s.targets], lanes: [...s.lanes],
    bumperFlash: [...s.bumperFlash], slingFlash: [...s.slingFlash],
    lastEvent: s.lastEvent ? { ...s.lastEvent } : null,
  };
}

type Hit = { nx: number; ny: number; t: number };
/** Circle (the ball, r) against a segment (or point if a==b); resolves position and velocity. */
function collide(
  s: PinballState, ax: number, ay: number, bx: number, by: number,
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
function add(s: PinballState, base: number, kind: string, x: number, y: number) {
  const points = base * s.multiplier;
  s.score += points;
  s.lastEvent = { tick: s.tick, kind, x, y, points };
}
function raiseMultiplier(s: PinballState) {
  if (s.multiplier < PINBALL_RULES.maxMultiplier) s.multiplier++;
}
function flipperVelocity(side: "left" | "right", angle: number, delta: number, t: number) {
  const now = pinballFlipperTip(side, angle), before = pinballFlipperTip(side, angle - delta);
  return {
    x: roundDiv(roundDiv((now.x - before.x) * t, 1000) * PINBALL_RULES.tickRate, 1),
    y: roundDiv(roundDiv((now.y - before.y) * t, 1000) * PINBALL_RULES.tickRate, 1),
  };
}
function loseBall(s: PinballState) {
  s.lastDrainX = s.ball.x;
  if (s.saver > 0) {
    s.saver = 0;
    s.phase = "waiting";
    s.waitUntil = s.tick + PINBALL_RULES.waitTicks;
    s.lastEvent = { tick: s.tick, kind: "SAVE", x: s.ball.x, y: 590000, points: 0 };
    return;
  }
  s.ballsLost++;
  s.lives--;
  s.multiplier = 1;
  s.lanes = [0, 0, 0];
  if (s.lives <= 0) {
    s.status = "failed";
    s.failure = "BALLS_LOST";
    return;
  }
  s.ballNo++;
  s.phase = "waiting";
  s.waitUntil = s.tick + PINBALL_RULES.waitTicks;
  s.lastEvent = { tick: s.tick, kind: "DRAIN", x: s.ball.x, y: 590000, points: 0 };
}

export function stepPinball(s: PinballState) {
  s.tick++;
  const R = PINBALL_RULES;
  // Flipper angles move a fixed number of phase units per tick.
  for (const side of ["left", "right"] as const) {
    const held = side === "left" ? s.leftHeld : s.rightHeld,
      cur = side === "left" ? s.left : s.right,
      goal = held ? R.flipUp : R.flipRest;
    const next = cur < goal ? Math.min(goal, cur + R.flipStep) : Math.max(goal, cur - R.flipStep);
    if (side === "left") { s.dLeft = next - cur; s.left = next; } else { s.dRight = next - cur; s.right = next; }
  }
  if (s.saver > 0) s.saver--;
  if (s.phase === "waiting") {
    if (s.tick >= s.waitUntil) { s.phase = "lane"; s.ball = restBall(); s.charge = 0; s.chargeHeld = false; s.stuck = 0; }
    return;
  }
  if (s.phase === "lane") {
    if (s.chargeHeld && s.charge < R.maxChargeLevel * R.chargeStepTicks) s.charge++;
    return;
  }
  const b = s.ball;
  b.vy += roundDiv(R.gravityMilli, R.tickRate);
  b.xr += b.vx; b.yr += b.vy;
  const dx = Math.trunc(b.xr / R.tickRate), dy = Math.trunc(b.yr / R.tickRate);
  b.xr -= dx * R.tickRate; b.yr -= dy * R.tickRate;
  b.x += dx; b.y += dy;
  const rr = R.radiusMilli;
  for (let pass = 0; pass < 3; pass++) {
    for (const w of PINBALL_WALLS) collide(s, w.ax, w.ay, w.bx, w.by, rr, w.e);
    for (const p of PINBALL_POSTS) collide(s, p.x, p.y, p.x, p.y, rr + p.r, 400);
    PINBALL_TARGETS.forEach((w, i) => {
      if (collide(s, w.ax, w.ay, w.bx, w.by, rr, w.e) && !s.targets[i]) {
        s.targets[i] = 1;
        add(s, 500, "TARGET", w.ax, (w.ay + w.by) >> 1);
        if (s.targets.every(Boolean)) { add(s, 3000, "TARGETS", w.ax, w.ay); raiseMultiplier(s); s.targets = [0, 0, 0, 0]; }
      }
    });
    pinballBumpers(s.layout).forEach((p, i) => {
      if (collide(s, p.x, p.y, p.x, p.y, rr + PINBALL_BUMPER_RADIUS, 600)) {
        const sp = integerSqrt(b.vx * b.vx + b.vy * b.vy);
        if (sp < 420000) {
          const dxp = b.x - p.x, dyp = b.y - p.y, d = Math.max(1, integerSqrt(dxp * dxp + dyp * dyp));
          b.vx = roundDiv(dxp * 420000, d); b.vy = roundDiv(dyp * 420000, d);
        }
        s.bumperFlash[i] = s.tick;
        add(s, 100, "BUMPER", p.x, p.y);
      }
    });
    PINBALL_SLINGS.forEach((p, i) => {
      if (collide(s, p.x, p.y, p.x, p.y, rr + p.r, 500)) {
        const sp = integerSqrt(b.vx * b.vx + b.vy * b.vy);
        if (sp < 330000) {
          const dxp = b.x - p.x, dyp = b.y - p.y, d = Math.max(1, integerSqrt(dxp * dxp + dyp * dyp));
          b.vx = roundDiv(dxp * 330000, d); b.vy = roundDiv(dyp * 330000, d);
        }
        s.slingFlash[i] = s.tick;
        add(s, 30, "SLING", p.x, p.y);
      }
    });
    for (const side of ["left", "right"] as const) {
      const angle = side === "left" ? s.left : s.right, delta = side === "left" ? s.dLeft : s.dRight,
        tip = pinballFlipperTip(side, angle), pivot = tip.pivot;
      // Contact parameter first (segment closest point), then the surface speed at that point.
      const abx = tip.x - pivot.x, aby = tip.y - pivot.y, len2 = abx * abx + aby * aby;
      const t = Math.max(0, Math.min(1000, roundDiv(((b.x - pivot.x) * abx + (b.y - pivot.y) * aby) * 1000, len2)));
      const v = delta ? flipperVelocity(side, angle, delta, t) : { x: 0, y: 0 };
      collide(s, pivot.x, pivot.y, tip.x, tip.y, rr + R.flipHalfThickMilli, 300, v.x, v.y);
    }
  }
  const sp2 = b.vx * b.vx + b.vy * b.vy;
  if (sp2 > R.maxSpeedMilli * R.maxSpeedMilli) {
    const sp = integerSqrt(sp2);
    b.vx = roundDiv(b.vx * R.maxSpeedMilli, sp); b.vy = roundDiv(b.vy * R.maxSpeedMilli, sp);
  }
  // Rollover lanes and the left ramp.
  PINBALL_LANES.forEach((l, i) => {
    if (!s.lanes[i] && (b.x - l.x) ** 2 + (b.y - l.y) ** 2 < 18000 ** 2) {
      s.lanes[i] = 1;
      add(s, 300, "LANE", l.x, l.y);
      if (s.lanes.every(Boolean)) { add(s, 2000, "LANES", l.x, l.y); raiseMultiplier(s); s.lanes = [0, 0, 0]; }
    }
  });
  if (b.x > 24000 && b.x < 64000 && b.y > 160000 && b.y < 200000 && b.vy < -100000 && s.tick - s.lastRampTick > 120) {
    s.lastRampTick = s.tick; s.ramps++;
    add(s, 1000, "RAMP", b.x, b.y);
  }
  // Back in the lane (rolled in from the top): ready for the spring again.
  if (b.x > 347000 && b.y > 560000 && Math.abs(b.vy) < 25000 && Math.abs(b.vx) < 25000) {
    s.phase = "lane"; s.ball = restBall(); s.charge = 0; s.chargeHeld = false; return;
  }
  // A ball that has not moved for a while is kicked deterministically (the player did not act).
  if (sp2 < 20000 * 20000 && b.y > 480000) s.stuck++; else s.stuck = 0;
  if (s.stuck >= R.stuckTicks) {
    s.nudges++; s.stuck = 0;
    const side = createRng(`${s.seed}:pinball:nudge:${s.nudges}`).nextInt(2) ? 1 : -1;
    b.vx = side * 260000; b.vy = -320000;
  }
  if (b.y > R.drainY) loseBall(s);
}

export function canApplyPinball(s: PinballState, a: string) {
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
export function applyPinball(s: PinballState, a: string) {
  const R = PINBALL_RULES;
  switch (a) {
    case "PLUNGER_HOLD": s.chargeHeld = true; s.charge = 0; break;
    case "PLUNGER_RELEASE": {
      const level = pinballChargeLevel(s.charge);
      s.chargeHeld = false;
      s.phase = "play";
      s.ball = { ...restBall(), vy: -(R.launchBaseMilli + R.launchStepMilli * level) };
      s.saver = R.saverTicks;
      s.lastEvent = { tick: s.tick, kind: "LAUNCH", x: R.laneX, y: R.laneRestY, points: 0 };
      break;
    }
    case "FLIP_LEFT_PRESS": s.leftHeld = true; break;
    case "FLIP_LEFT_RELEASE": s.leftHeld = false; break;
    case "FLIP_RIGHT_PRESS": s.rightHeld = true; break;
    case "FLIP_RIGHT_RELEASE": s.rightHeld = false; break;
  }
}

export const PINBALL_CORE_V1: GameCore<PinballState> = {
  gameId: "pinball",
  gameVersion: "1.0.0",
  width: 390,
  height: 620,
  tickRate: PINBALL_RULES.tickRate,
  maxFinalTick: PINBALL_RULES.maxFinalTick,
  maxInputs: PINBALL_RULES.maxInputs,
  inputVersion: 1,
  actions: PINBALL_ACTIONS,
  content: {
    rules: PINBALL_RULES,
    table: { walls: PINBALL_WALLS, targets: PINBALL_TARGETS, lanes: PINBALL_LANES, posts: PINBALL_POSTS, slings: PINBALL_SLINGS, layouts: LAYOUTS, bumperRadius: PINBALL_BUMPER_RADIUS },
    launch: "spring-charge-level-0..8;speed=500+60*level px/s;straight-up-lane",
    scoring: "bumper100;sling30;target500;targets3000+mult;lanes300+2000+mult;ramp1000;multiplier-x1..5-reset-on-ball-loss",
    completion: "three-balls-or-180s;ball-saver-720-ticks-after-launch",
  },
  create: createPinballState,
  step: stepPinball,
  canApply: canApplyPinball,
  apply: applyPinball,
};
