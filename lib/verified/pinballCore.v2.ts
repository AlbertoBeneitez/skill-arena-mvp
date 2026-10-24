/**
 * Pinball V2 — one ball, one minute (7200 ticks at 120 Hz). Integer/fixed-point physics
 * (1 px = 1000 milli, speeds in milli-px/s). Table inspired by classic machines: skill-shot lane,
 * A-B-C rollovers, pop bumpers, slingshots, a spinner, a drop-target bank, stand-up banks on both walls,
 * a left ramp and a right orbit with combo chaining, a hold-and-eject saucer and an end-of-ball bonus.
 * The ball starts only from the spring: launch speed is the quantised charge level. The centre between
 * the flippers is closed, so the ball drains only through the outlanes or by a clear player error.
 * A single short ball save exists in the first seconds after the first launch; the drain after that ends the game.
 */
import { createRng } from "../deterministic/seeded";
import { integerSqrt, roundDiv, sinPhaseMilli } from "../deterministic/integerMath";
import type { CoreState, GameCore } from "./coreRuntime.v1";
import { PINBALL_ACTIONS_V2 } from "./pinballProtocol.v2";

export const PINBALL_RULES_V2 = {
  tickRate: 120,
  maxFinalTick: 120 * 60,
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
  saverTicks: 360,
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
  skillWindowTicks: 600,
  comboWindowTicks: 480,
  saucerHoldTicks: 100,
  saucerCooldownTicks: 90,
  bonusPerFeature: 1000,
} as const;
const R = PINBALL_RULES_V2;

export type PinballSegmentV2 = { ax: number; ay: number; bx: number; by: number; e: number };
const seg = (ax: number, ay: number, bx: number, by: number, e = 450): PinballSegmentV2 => ({
  ax: ax * 1000, ay: ay * 1000, bx: bx * 1000, by: by * 1000, e,
});
export const PINBALL_WALLS_V2: readonly PinballSegmentV2[] = Object.freeze([
  seg(18, 640, 18, 140), seg(18, 140, 46, 70), seg(46, 70, 110, 42), seg(110, 42, 290, 42),
  seg(290, 42, 372, 124), seg(372, 124, 372, 640),
  seg(346, 150, 346, 585), seg(346, 585, 372, 585, 100),
  seg(46, 478, 132, 552, 300), seg(322, 478, 258, 552, 300),
]);
/** Left-wall stand-up targets. */
export const PINBALL_TARGETS_V2: readonly PinballSegmentV2[] = Object.freeze(
  [0, 1, 2, 3].map((i) => seg(25, 250 + i * 34, 25, 274 + i * 34, 300)),
);
/** Right-wall stand-up targets: all three light the saucer. */
export const PINBALL_RTARGETS_V2: readonly PinballSegmentV2[] = Object.freeze(
  [0, 1, 2].map((i) => seg(339, 235 + i * 34, 339, 259 + i * 34, 300)),
);
/** Drop-target bank (slightly tilted so a ball never rests on a target). */
export const PINBALL_DROPS_V2: readonly PinballSegmentV2[] = Object.freeze([
  seg(137, 385, 167, 381, 300), seg(180, 381, 210, 385, 300), seg(223, 385, 253, 381, 300),
]);
export const PINBALL_LANES_V2 = Object.freeze([
  { x: 120000, y: 118000 }, { x: 170000, y: 118000 }, { x: 220000, y: 118000 },
]);
export const PINBALL_POSTS_V2 = Object.freeze([
  { x: 46000, y: 478000, r: 5000 }, { x: 322000, y: 478000, r: 5000 },
]);
export const PINBALL_SLINGS_V2 = Object.freeze([
  { x: 86000, y: 440000, r: 10000 }, { x: 282000, y: 440000, r: 10000 },
]);
export const PINBALL_SAUCER_V2 = Object.freeze({ x: 312000, y: 130000, r: 13000 });
export const PINBALL_SPINNER_V2 = Object.freeze({ x0: 230000, x1: 290000, y0: 52000, y1: 92000 });
export const PINBALL_RAMP_ZONE_V2 = Object.freeze({ x0: 24000, x1: 64000, y0: 160000, y1: 200000 });
export const PINBALL_ORBIT_ZONE_V2 = Object.freeze({ x0: 300000, x1: 340000, y0: 160000, y1: 200000 });
const EJECT = Object.freeze([
  { vx: -260000, vy: 160000 }, { vx: -150000, vy: 220000 }, { vx: -340000, vy: 90000 },
]);
const LAYOUTS = Object.freeze([
  [{ x: 150000, y: 150000 }, { x: 235000, y: 205000 }, { x: 120000, y: 250000 }, { x: 190000, y: 310000 }],
  [{ x: 130000, y: 165000 }, { x: 225000, y: 150000 }, { x: 105000, y: 270000 }, { x: 250000, y: 280000 }],
  [{ x: 170000, y: 145000 }, { x: 255000, y: 190000 }, { x: 135000, y: 235000 }, { x: 215000, y: 295000 }],
  [{ x: 115000, y: 170000 }, { x: 200000, y: 200000 }, { x: 270000, y: 165000 }, { x: 160000, y: 290000 }],
]);
export const PINBALL_BUMPER_RADIUS_V2 = 20000;
export const pinballBumpersV2 = (layout: number) => LAYOUTS[layout % LAYOUTS.length];

export type PinballBallV2 = { x: number; y: number; vx: number; vy: number; xr: number; yr: number };
export type PinballEventV2 = { tick: number; kind: string; x: number; y: number; points: number };
export type PinballStateV2 = CoreState & {
  seed: string;
  layout: number;
  phase: "lane" | "play" | "waiting";
  waitUntil: number;
  ball: PinballBallV2;
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
  saver: number;
  stuck: number;
  nudges: number;
  bumperFlash: number[];
  slingFlash: number[];
  dropFlash: number[];
  lastEvent: PinballEventV2 | null;
  feed: PinballEventV2[];
};

export function pinballChargeLevelV2(charge: number) {
  return Math.min(R.maxChargeLevel, Math.floor(charge / R.chargeStepTicks));
}
const cosP = (p: number) => sinPhaseMilli(p + 1024);
export function pinballFlipperTipV2(side: "left" | "right", angle: number) {
  const pivot = side === "left" ? R.leftPivot : R.rightPivot,
    L = R.flipLengthMilli,
    dx = roundDiv(L * cosP(angle), 1000),
    dy = roundDiv(L * sinPhaseMilli(angle), 1000);
  return { x: pivot.x + (side === "left" ? dx : -dx), y: pivot.y + dy, pivot };
}

function restBall(): PinballBallV2 {
  return { x: R.laneX, y: R.laneRestY, vx: 0, vy: 0, xr: 0, yr: 0 };
}
export function createPinballStateV2(seed: string): PinballStateV2 {
  return {
    tick: 0, status: "running", score: 0, failure: null, seed,
    layout: createRng(`${seed}:pinball2:layout`).nextInt(LAYOUTS.length),
    phase: "lane", waitUntil: 0, ball: restBall(), launches: 0, lastDrainX: 0,
    charge: 0, chargeHeld: false,
    left: R.flipRest, right: R.flipRest, leftHeld: false, rightHeld: false, dLeft: 0, dRight: 0,
    multiplier: 1, targets: [0, 0, 0, 0], rTargets: [0, 0, 0], drops: [0, 0, 0], lanes: [0, 0, 0],
    saucerLit: 0, saucerHold: 0, saucerUntil: 0, saucerHits: 0, spinAcc: 0, spins: 0,
    ramps: 0, orbits: 0, lastRampTick: -1000, lastOrbitTick: -1000,
    lastShotTick: -10000, lastShotKind: "", combo: 0,
    skillLane: createRng(`${seed}:pinball2:skill`).nextInt(3), skillDone: 0, launchTick: -1,
    bonusCount: 0, endBonus: 0, lastFlickTick: -1000,
    saver: 0, stuck: 0, nudges: 0,
    bumperFlash: [-1000, -1000, -1000, -1000], slingFlash: [-1000, -1000], dropFlash: [-1000, -1000, -1000],
    lastEvent: null, feed: [],
  };
}
export function copyPinballStateV2(s: PinballStateV2): PinballStateV2 {
  return {
    ...s, ball: { ...s.ball }, targets: [...s.targets], rTargets: [...s.rTargets], drops: [...s.drops],
    lanes: [...s.lanes], bumperFlash: [...s.bumperFlash], slingFlash: [...s.slingFlash], dropFlash: [...s.dropFlash],
    lastEvent: s.lastEvent ? { ...s.lastEvent } : null, feed: s.feed.map((e) => ({ ...e })),
  };
}

type Hit = { nx: number; ny: number; t: number };
function collide(
  s: PinballStateV2, ax: number, ay: number, bx: number, by: number,
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
function emit(s: PinballStateV2, kind: string, x: number, y: number, points: number) {
  const ev = { tick: s.tick, kind, x, y, points };
  s.lastEvent = ev;
  s.feed.push(ev);
  if (s.feed.length > 8) s.feed.shift();
}
function add(s: PinballStateV2, base: number, kind: string, x: number, y: number) {
  const points = base * s.multiplier;
  s.score += points;
  emit(s, kind, x, y, points);
}
function raiseMultiplier(s: PinballStateV2) {
  if (s.multiplier < R.maxMultiplier) s.multiplier++;
}
/** A feature shot: counts toward the end bonus and chains into a combo with a different shot inside 4 s. */
function shot(s: PinballStateV2, kind: string, x: number, y: number) {
  s.bonusCount++;
  if (kind !== s.lastShotKind && s.tick - s.lastShotTick <= R.comboWindowTicks) {
    s.combo++;
    add(s, 500 * Math.min(5, s.combo), "COMBO", x, y - 20000);
  } else s.combo = 0;
  s.lastShotTick = s.tick;
  s.lastShotKind = kind;
}
function flipperVelocity(side: "left" | "right", angle: number, delta: number, t: number) {
  const now = pinballFlipperTipV2(side, angle), before = pinballFlipperTipV2(side, angle - delta);
  return {
    x: roundDiv(roundDiv((now.x - before.x) * t, 1000) * R.tickRate, 1),
    y: roundDiv(roundDiv((now.y - before.y) * t, 1000) * R.tickRate, 1),
  };
}
function finish(s: PinballStateV2, failure: string) {
  s.endBonus = s.bonusCount * R.bonusPerFeature * s.multiplier;
  if (s.endBonus > 0) { s.score += s.endBonus; emit(s, "BONUS", 195000, 300000, s.endBonus); }
  s.status = "failed";
  s.failure = failure;
}
function loseBall(s: PinballStateV2) {
  s.lastDrainX = s.ball.x;
  if (s.saver > 0) {
    s.saver = 0;
    s.phase = "waiting";
    s.waitUntil = s.tick + R.waitTicks;
    emit(s, "SAVE", s.ball.x, 590000, 0);
    return;
  }
  emit(s, "DRAIN", s.ball.x, 590000, 0);
  finish(s, "BALLS_LOST");
}

function stepInner(s: PinballStateV2) {
  s.tick++;
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
  // Saucer: the ball is held, then ejected along a fixed rotating pattern.
  if (s.saucerHold > 0) {
    s.saucerHold--;
    b.x = PINBALL_SAUCER_V2.x; b.y = PINBALL_SAUCER_V2.y; b.vx = 0; b.vy = 0; b.xr = 0; b.yr = 0;
    if (s.saucerHold === 0) {
      const k = EJECT[s.saucerHits % EJECT.length];
      b.vx = k.vx; b.vy = k.vy;
      s.saucerUntil = s.tick + R.saucerCooldownTicks;
      emit(s, "EJECT", b.x, b.y, 0);
    }
    return;
  }
  b.vy += roundDiv(R.gravityMilli, R.tickRate);
  const rr = R.radiusMilli, div = R.tickRate * R.substeps;
  for (let sub = 0; sub < R.substeps; sub++) {
    b.xr += b.vx; b.yr += b.vy;
    const dx = Math.trunc(b.xr / div), dy = Math.trunc(b.yr / div);
    b.xr -= dx * div; b.yr -= dy * div;
    b.x += dx; b.y += dy;
    for (let pass = 0; pass < 3; pass++) {
      for (const w of PINBALL_WALLS_V2) collide(s, w.ax, w.ay, w.bx, w.by, rr, w.e);
      for (const p of PINBALL_POSTS_V2) collide(s, p.x, p.y, p.x, p.y, rr + p.r, 400);
      PINBALL_TARGETS_V2.forEach((w, i) => {
        if (collide(s, w.ax, w.ay, w.bx, w.by, rr, w.e) && !s.targets[i]) {
          s.targets[i] = 1;
          add(s, 500, "TARGET", w.ax, (w.ay + w.by) >> 1);
          if (s.targets.every(Boolean)) {
            add(s, 3000, "TARGETS", w.ax, w.ay); raiseMultiplier(s); shot(s, "TARGETS", w.ax, w.ay);
            s.targets = [0, 0, 0, 0];
          }
        }
      });
      PINBALL_RTARGETS_V2.forEach((w, i) => {
        if (collide(s, w.ax, w.ay, w.bx, w.by, rr, w.e) && !s.rTargets[i]) {
          s.rTargets[i] = 1;
          add(s, 500, "RTARGET", w.ax, (w.ay + w.by) >> 1);
          if (s.rTargets.every(Boolean)) {
            s.saucerLit = 1; s.rTargets = [0, 0, 0];
            emit(s, "SAUCERLIT", w.ax, w.ay, 0);
          }
        }
      });
      PINBALL_DROPS_V2.forEach((w, i) => {
        if (s.drops[i]) return;
        if (collide(s, w.ax, w.ay, w.bx, w.by, rr, w.e)) {
          s.drops[i] = 1; s.dropFlash[i] = s.tick;
          add(s, 300, "DROP", (w.ax + w.bx) >> 1, w.ay);
          if (s.drops.every(Boolean)) {
            add(s, 4000, "DROPS", 195000, w.ay); raiseMultiplier(s); shot(s, "DROPS", 195000, w.ay);
            s.drops = [0, 0, 0];
          }
        }
      });
      pinballBumpersV2(s.layout).forEach((p, i) => {
        if (collide(s, p.x, p.y, p.x, p.y, rr + PINBALL_BUMPER_RADIUS_V2, 600)) {
          const sp = integerSqrt(b.vx * b.vx + b.vy * b.vy);
          if (sp < 460000) {
            const dxp = b.x - p.x, dyp = b.y - p.y, d = Math.max(1, integerSqrt(dxp * dxp + dyp * dyp));
            b.vx = roundDiv(dxp * 460000, d); b.vy = roundDiv(dyp * 460000, d);
          }
          s.bumperFlash[i] = s.tick;
          add(s, 100, "BUMPER", p.x, p.y);
        }
      });
      PINBALL_SLINGS_V2.forEach((p, i) => {
        if (collide(s, p.x, p.y, p.x, p.y, rr + p.r, 500)) {
          const sp = integerSqrt(b.vx * b.vx + b.vy * b.vy);
          if (sp < 360000) {
            const dxp = b.x - p.x, dyp = b.y - p.y, d = Math.max(1, integerSqrt(dxp * dxp + dyp * dyp));
            b.vx = roundDiv(dxp * 360000, d); b.vy = roundDiv(dyp * 360000, d);
          }
          s.slingFlash[i] = s.tick;
          add(s, 30, "SLING", p.x, p.y);
        }
      });
      for (const side of ["left", "right"] as const) {
        const angle = side === "left" ? s.left : s.right, delta = side === "left" ? s.dLeft : s.dRight,
          tip = pinballFlipperTipV2(side, angle), pivot = tip.pivot;
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
  // Rollover lanes (with the skill shot), spinner, ramp, orbit, saucer.
  PINBALL_LANES_V2.forEach((l, i) => {
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
      }
    }
  });
  const sp = PINBALL_SPINNER_V2;
  if (b.x > sp.x0 && b.x < sp.x1 && b.y > sp.y0 && b.y < sp.y1) {
    s.spinAcc += integerSqrt(b.vx * b.vx + b.vy * b.vy);
    if (s.spinAcc >= 1600000) {
      s.spinAcc -= 1600000; s.spins++;
      add(s, 50, "SPINNER", b.x, b.y);
    }
  }
  const rz = PINBALL_RAMP_ZONE_V2, oz = PINBALL_ORBIT_ZONE_V2;
  if (b.x > rz.x0 && b.x < rz.x1 && b.y > rz.y0 && b.y < rz.y1 && b.vy < -100000 && s.tick - s.lastRampTick > 120) {
    s.lastRampTick = s.tick; s.ramps++;
    add(s, 1500, "RAMP", b.x, b.y); shot(s, "RAMP", b.x, b.y);
  }
  if (b.x > oz.x0 && b.x < oz.x1 && b.y > oz.y0 && b.y < oz.y1 && b.vy < -100000 && s.tick - s.lastOrbitTick > 120) {
    s.lastOrbitTick = s.tick; s.orbits++;
    add(s, 1500, "ORBIT", b.x, b.y); shot(s, "ORBIT", b.x, b.y);
  }
  const sc = PINBALL_SAUCER_V2;
  if (s.tick >= s.saucerUntil && (b.x - sc.x) ** 2 + (b.y - sc.y) ** 2 < sc.r ** 2) {
    s.saucerHits++;
    s.saucerHold = R.saucerHoldTicks;
    b.vx = 0; b.vy = 0; b.xr = 0; b.yr = 0; b.x = sc.x; b.y = sc.y;
    if (s.saucerLit) { s.saucerLit = 0; add(s, 5000, "JACKPOT", sc.x, sc.y); raiseMultiplier(s); }
    else add(s, 1000, "SAUCER", sc.x, sc.y);
    shot(s, "SAUCER", sc.x, sc.y);
    return;
  }
  // Back in the lane (rolled in from the top): ready for the spring again.
  if (b.x > 347000 && b.y > 560000 && Math.abs(b.vy) < 25000 && Math.abs(b.vx) < 25000) {
    s.phase = "lane"; s.ball = restBall(); s.charge = 0; s.chargeHeld = false; return;
  }
  const sp2 = b.vx * b.vx + b.vy * b.vy;
  if (sp2 < 20000 * 20000 && b.y > 300000) s.stuck++; else s.stuck = 0;
  if (s.stuck >= R.stuckTicks) {
    s.nudges++; s.stuck = 0;
    const side = createRng(`${s.seed}:pinball2:nudge:${s.nudges}`).nextInt(2) ? 1 : -1;
    b.vx = side * 260000; b.vy = -320000;
  }
  if (b.y > R.drainY) loseBall(s);
}

export function stepPinballV2(s: PinballStateV2) {
  stepInner(s);
  if (s.status === "running" && s.tick >= R.maxFinalTick) finish(s, "TIME_LIMIT");
  if (s.feed.length && s.tick - s.feed[0].tick > 240) s.feed.shift();
}

export function canApplyPinballV2(s: PinballStateV2, a: string) {
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
export function applyPinballV2(s: PinballStateV2, a: string) {
  switch (a) {
    case "PLUNGER_HOLD": s.chargeHeld = true; s.charge = 0; break;
    case "PLUNGER_RELEASE": {
      const level = pinballChargeLevelV2(s.charge);
      s.chargeHeld = false;
      s.phase = "play";
      s.ball = { ...restBall(), vy: -(R.launchBaseMilli + R.launchStepMilli * level) };
      if (s.launches === 0) { s.saver = R.saverTicks; s.launchTick = s.tick; }
      else if (!s.skillDone) { s.launchTick = s.tick; }
      s.launches++;
      emit(s, "LAUNCH", R.laneX, R.laneRestY, 0);
      break;
    }
    case "FLIP_LEFT_PRESS": s.leftHeld = true; break;
    case "FLIP_LEFT_RELEASE": s.leftHeld = false; break;
    case "FLIP_RIGHT_PRESS": s.rightHeld = true; break;
    case "FLIP_RIGHT_RELEASE": s.rightHeld = false; break;
  }
}

export const PINBALL_CORE_V2: GameCore<PinballStateV2> = {
  gameId: "pinball",
  gameVersion: "2.0.0",
  width: 390,
  height: 620,
  tickRate: R.tickRate,
  maxFinalTick: R.maxFinalTick,
  maxInputs: R.maxInputs,
  inputVersion: 1,
  actions: PINBALL_ACTIONS_V2,
  content: {
    rules: R,
    table: {
      walls: PINBALL_WALLS_V2, targets: PINBALL_TARGETS_V2, rTargets: PINBALL_RTARGETS_V2, drops: PINBALL_DROPS_V2,
      lanes: PINBALL_LANES_V2, posts: PINBALL_POSTS_V2, slings: PINBALL_SLINGS_V2, saucer: PINBALL_SAUCER_V2,
      spinner: PINBALL_SPINNER_V2, ramp: PINBALL_RAMP_ZONE_V2, orbit: PINBALL_ORBIT_ZONE_V2, eject: EJECT,
      layouts: LAYOUTS, bumperRadius: PINBALL_BUMPER_RADIUS_V2,
    },
    launch: "spring-charge-level-0..8;speed=500+60*level px/s;straight-up-lane",
    scoring: "bumper100;sling30;target500;targets3000;rtarget500;saucer1000/jackpot5000;drop300/drops4000;lanes300+2000;skill5000;spinner50;ramp1500;orbit1500;combo500*n;flick150;multiplier-x1..5;end-bonus1000*features*mult",
    completion: "one-ball-or-60s;ball-save-360-ticks-once-after-first-launch",
  },
  create: createPinballStateV2,
  step: stepPinballV2,
  canApply: canApplyPinballV2,
  apply: applyPinballV2,
};
