/**
 * Galactic Bowling V1 — ten-pin bowling, ten frames, standard scoring (strike/spare bonuses, 10th-frame bonus
 * balls). Deterministic integer physics on a regulation lane (µm, 120 Hz, 4 sub-steps): the ball skids straight
 * on the oiled front part and hooks on the dry back end by its spin; ball–pin and pin–pin collisions are
 * impulse-based discs, so pins scatter and carry. A pin is down once it has been knocked (strong impulse or
 * displaced) and is swept after the roll; standing pins stay where they are. Gutter balls cannot touch pins.
 * After a strike the core holds a celebration that SKIP ends early (spares have a shorter one).
 */
import { integerSqrt, roundDiv } from "../deterministic/integerMath";
import type { CoreState, GameCore } from "./coreRuntime.v1";
import { BOWLING_ACTIONS_V1 } from "./bowlingProtocol.v1";

const MM = 1000; // µm per mm
export const BOWLING_RULES_V1 = Object.freeze({
  tickRate: 120,
  substeps: 4,
  maxFinalTick: 120 * 60 * 8,
  maxInputs: 1200,
  laneWidth: 1054 * MM,
  headPinY: 18288 * MM,
  pinSpacing: 305 * MM,
  pitY: 19700 * MM,
  oilEndY: 11000 * MM,
  ballRadius: 109 * MM,
  pinRadius: 61 * MM,
  /** A toppling pin sweeps a wider area than its standing belly. */
  fallenRadius: 128 * MM,
  ballMass: 70,
  pinMass: 15,
  ballPinRestitution: 650, // /1000
  pinPinRestitution: 550,
  /** Start positions: 21 steps across the approach. */
  aimX0: 157 * MM,
  aimStep: 37 * MM,
  /** Lateral slope per angle step (µm per µm × 1e6). */
  angleStep: 2400, // ±12 steps → ±2.88 % (≈ ±1.65°)
  powerMin: 6600 * MM, // mm/s
  powerStep: 500 * MM,
  /** Hook: lateral acceleration per spin step on the dry back end (µm/s²). */
  hookStep: 250 * MM,
  pinFriction: 2600 * MM, // µm/s² deceleration of sliding pins
  ballDrag: 120 * MM,
  knockSpeed: 260 * MM, // µm/s: a pin moving faster than this is down
  knockDisplacement: 32 * MM,
  rollTimeoutTicks: 120 * 7,
  settleTicks: 60,
  strikeTicks: 360,
  spareTicks: 150,
  sweepTicks: 70,
});
const R = BOWLING_RULES_V1;
const TICK = R.tickRate * R.substeps; // velocity units are µm/s; one sub-step moves v / TICK

/** Pin spots, head pin first (1..10 numbering): rows of 1, 2, 3, 4 behind the head pin. */
export const BOWLING_PIN_SPOTS = Object.freeze(
  [[0, 0], [-1, 1], [1, 1], [-2, 2], [0, 2], [2, 2], [-3, 3], [-1, 3], [1, 3], [3, 3]].map(([c, r]) => ({
    x: R.laneWidth / 2 + c * (R.pinSpacing / 2),
    y: R.headPinY + r * roundDiv(R.pinSpacing * 866, 1000),
  })),
);

export type BowlingBody = { x: number; y: number; vx: number; vy: number; rx: number; ry: number };
export type BowlingPin = BowlingBody & { standing: boolean; down: boolean; present: boolean; homeX: number; homeY: number; hitTick: number };
export type BowlingPhase = "aim" | "rolling" | "celebrate" | "sweep" | "done";
export type BowlingStateV1 = CoreState & {
  seed: string;
  phase: BowlingPhase;
  phaseTick: number;
  frame: number;
  rollInFrame: number;
  rolls: number[];
  /** Pins knocked per roll, grouped by frame (for the score sheet). */
  frames: number[][];
  aim: number;
  angle: number;
  spin: number;
  power: number;
  ball: BowlingBody & { gutter: boolean; spin: number; active: boolean };
  pins: BowlingPin[];
  rollStartTick: number;
  standingAtStart: number;
  lastResult: { kind: "strike" | "spare" | "open" | "gutter"; knocked: number; tick: number; frame: number } | null;
  strikes: number;
  streak: number;
};

function rack(): BowlingPin[] {
  return BOWLING_PIN_SPOTS.map((p) => ({ x: p.x, y: p.y, vx: 0, vy: 0, rx: 0, ry: 0, standing: true, down: false, present: true, homeX: p.x, homeY: p.y, hitTick: -1 }));
}
function restBall(state: Pick<BowlingStateV1, "aim">) {
  return { x: R.aimX0 + state.aim * R.aimStep, y: 0, vx: 0, vy: 0, rx: 0, ry: 0, gutter: false, spin: 0, active: false };
}

/** Standard ten-pin score from the list of rolls (works on partial games). */
export function bowlingScore(rolls: readonly number[]) {
  let score = 0, i = 0;
  const frames: (number | null)[] = [];
  for (let f = 0; f < 10; f++) {
    if (i >= rolls.length) { frames.push(null); continue; }
    if (rolls[i] === 10) {
      if (i + 2 < rolls.length) { score += 10 + rolls[i + 1] + rolls[i + 2]; frames.push(score); } else frames.push(null);
      i += 1;
    } else if (i + 1 < rolls.length) {
      if (rolls[i] + rolls[i + 1] === 10) {
        if (i + 2 < rolls.length) { score += 10 + rolls[i + 2]; frames.push(score); } else frames.push(null);
      } else { score += rolls[i] + rolls[i + 1]; frames.push(score); }
      i += 2;
    } else { frames.push(null); i += 1; }
  }
  return { total: score, frames };
}

export function createBowlingV1(seed: string): BowlingStateV1 {
  const s: BowlingStateV1 = {
    tick: 0, status: "running", score: 0, failure: null, seed, phase: "aim", phaseTick: 0, frame: 0, rollInFrame: 0,
    rolls: [], frames: [[]], aim: 10, angle: 12, spin: 4, power: 4,
    ball: { x: 0, y: 0, vx: 0, vy: 0, rx: 0, ry: 0, gutter: false, spin: 0, active: false },
    pins: rack(), rollStartTick: -1, standingAtStart: 10, lastResult: null, strikes: 0, streak: 0,
  };
  s.ball = restBall(s);
  return s;
}

function move(b: BowlingBody) {
  b.rx += b.vx; b.ry += b.vy;
  const dx = Math.trunc(b.rx / TICK), dy = Math.trunc(b.ry / TICK);
  b.rx -= dx * TICK; b.ry -= dy * TICK;
  b.x += dx; b.y += dy;
}
function decelerate(b: BowlingBody, amount: number) {
  const sp = integerSqrt(b.vx * b.vx + b.vy * b.vy);
  if (sp === 0) return;
  const next = Math.max(0, sp - Math.trunc(amount / TICK));
  b.vx = roundDiv(b.vx * next, sp); b.vy = roundDiv(b.vy * next, sp);
}
/** Impulse collision between two discs; returns the normal impulse magnitude (µm/s units × mass). */
function collide(a: BowlingBody, ma: number, b: BowlingBody, mb: number, radius: number, e: number) {
  const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
  if (d2 >= radius * radius || d2 === 0) return 0;
  const d = integerSqrt(d2), nx = roundDiv(dx * 1000, d), ny = roundDiv(dy * 1000, d);
  // Separate along the normal, by inverse mass.
  const overlap = radius - d;
  a.x -= roundDiv(roundDiv(nx * overlap, 1000) * mb, ma + mb); a.y -= roundDiv(roundDiv(ny * overlap, 1000) * mb, ma + mb);
  b.x += roundDiv(roundDiv(nx * overlap, 1000) * ma, ma + mb); b.y += roundDiv(roundDiv(ny * overlap, 1000) * ma, ma + mb);
  const vn = roundDiv((b.vx - a.vx) * nx + (b.vy - a.vy) * ny, 1000);
  if (vn >= 0) return 0;
  const j = roundDiv((1000 + e) * -vn * ma * mb, 1000 * (ma + mb));
  a.vx -= roundDiv(roundDiv(j * nx, 1000), ma); a.vy -= roundDiv(roundDiv(j * ny, 1000), ma);
  b.vx += roundDiv(roundDiv(j * nx, 1000), mb); b.vy += roundDiv(roundDiv(j * ny, 1000), mb);
  return j;
}

function standingCount(s: BowlingStateV1) {
  return s.pins.filter((p) => p.present && p.standing).length;
}
function knock(s: BowlingStateV1, p: BowlingPin) {
  if (!p.standing) return;
  p.standing = false;
  p.down = true;
  p.hitTick = s.tick;
}

function physicsStep(s: BowlingStateV1) {
  const ball = s.ball;
  for (let sub = 0; sub < R.substeps; sub++) {
    if (ball.active) {
      if (!ball.gutter && ball.y > R.oilEndY) ball.vx += Math.trunc((ball.spin * R.hookStep) / TICK);
      decelerate(ball, R.ballDrag);
      move(ball);
      if (!ball.gutter && (ball.x < 0 || ball.x > R.laneWidth)) {
        ball.gutter = true;
        ball.vx = 0;
        ball.x = ball.x < 0 ? -95 * MM : R.laneWidth + 95 * MM;
      }
      if (ball.y > R.pitY) ball.active = false;
    }
    if (ball.active && !ball.gutter) {
      for (const p of s.pins) {
        if (!p.present) continue;
        const j = collide(ball, R.ballMass, p, R.pinMass, R.ballRadius + (p.standing ? R.pinRadius : R.fallenRadius), R.ballPinRestitution);
        if (j > 0) knock(s, p);
      }
    }
    for (let i = 0; i < s.pins.length; i++) {
      const a = s.pins[i];
      if (!a.present) continue;
      for (let k = i + 1; k < s.pins.length; k++) {
        const b = s.pins[k];
        if (!b.present) continue;
        const moving = a.vx || a.vy || b.vx || b.vy;
        if (!moving) continue;
        const j = collide(a, R.pinMass, b, R.pinMass, (a.standing ? R.pinRadius : R.fallenRadius) + (b.standing ? R.pinRadius : R.fallenRadius), R.pinPinRestitution);
        if (j > 0) {
          if (integerSqrt(a.vx * a.vx + a.vy * a.vy) > R.knockSpeed) knock(s, a);
          if (integerSqrt(b.vx * b.vx + b.vy * b.vy) > R.knockSpeed) knock(s, b);
        }
      }
    }
    for (const p of s.pins) {
      if (!p.present || (!p.vx && !p.vy)) continue;
      decelerate(p, R.pinFriction);
      move(p);
      if (p.standing && ((p.x - p.homeX) ** 2 + (p.y - p.homeY) ** 2 > R.knockDisplacement ** 2 || integerSqrt(p.vx * p.vx + p.vy * p.vy) > R.knockSpeed)) knock(s, p);
      if (p.x < -60 * MM || p.x > R.laneWidth + 60 * MM || p.y > R.pitY + 200 * MM) { p.present = false; knock(s, p); p.vx = 0; p.vy = 0; }
    }
  }
}

function settled(s: BowlingStateV1) {
  return !s.ball.active && s.pins.every((p) => !p.present || (!p.vx && !p.vy));
}

function finishRoll(s: BowlingStateV1) {
  const knocked = s.standingAtStart - standingCount(s);
  s.rolls.push(knocked);
  s.frames[s.frame].push(knocked);
  const tenth = s.frame === 9, inFrame = s.frames[s.frame];
  let kind: "strike" | "spare" | "open" | "gutter" = knocked === 0 && s.ball.gutter ? "gutter" : "open";
  let resetRack = false, frameOver = false;
  if (!tenth) {
    if (s.rollInFrame === 0 && knocked === 10) { kind = "strike"; frameOver = true; }
    else if (s.rollInFrame === 1) { frameOver = true; if (inFrame[0] + inFrame[1] === 10) kind = "spare"; }
  } else {
    // Tenth frame: a full rack knocked down is a strike, clearing a partial rack is a spare.
    const cleared = standingCount(s) === 0;
    if (cleared) kind = s.standingAtStart === 10 ? "strike" : "spare";
    if (s.rollInFrame === 0) resetRack = cleared;
    else if (s.rollInFrame === 1) {
      if (inFrame[0] === 10 || cleared) resetRack = cleared;
      if (inFrame[0] !== 10 && !cleared) frameOver = true;
    } else frameOver = true;
  }
  if (kind === "strike") { s.strikes++; s.streak++; } else s.streak = 0;
  s.lastResult = { kind, knocked, tick: s.tick, frame: s.frame };
  s.score = bowlingScore(s.rolls).total;
  const nextFrame = () => {
    if (s.frame === 9) { s.phase = "done"; s.status = "won"; s.failure = null; return; }
    s.frame++; s.rollInFrame = 0; s.frames.push([]); s.pins = rack();
  };
  s.ball = restBall(s);
  if (frameOver) nextFrame();
  else {
    s.rollInFrame++;
    if (resetRack) s.pins = rack();
    else s.pins = s.pins.map((p) => (p.standing && p.present ? p : { ...p, present: false }));
  }
  if (s.status !== "running") return;
  s.phase = kind === "strike" || kind === "spare" ? "celebrate" : "sweep";
  s.phaseTick = s.tick;
  s.standingAtStart = standingCount(s);
}

export function stepBowlingV1(s: BowlingStateV1) {
  s.tick++;
  if (s.phase === "rolling") {
    physicsStep(s);
    const elapsed = s.tick - s.rollStartTick;
    if ((settled(s) && elapsed > R.settleTicks) || elapsed > R.rollTimeoutTicks) {
      for (const p of s.pins) { p.vx = 0; p.vy = 0; }
      finishRoll(s);
    }
    return;
  }
  if (s.phase === "celebrate") {
    const kind = s.lastResult?.kind;
    if (s.tick - s.phaseTick >= (kind === "strike" ? R.strikeTicks : R.spareTicks)) { s.phase = "aim"; s.phaseTick = s.tick; }
    return;
  }
  if (s.phase === "sweep" && s.tick - s.phaseTick >= R.sweepTicks) { s.phase = "aim"; s.phaseTick = s.tick; }
}

export function canApplyBowlingV1(s: BowlingStateV1, a: string) {
  if (s.status !== "running" || !BOWLING_ACTIONS_V1.includes(a)) return false;
  if (a === "SKIP") return s.phase === "celebrate";
  return s.phase === "aim";
}
export function applyBowlingV1(s: BowlingStateV1, a: string) {
  if (a === "SKIP") { s.phase = "aim"; s.phaseTick = s.tick; return; }
  if (a === "ROLL") {
    const speed = R.powerMin + s.power * R.powerStep;
    s.ball = { ...restBall(s), vy: speed, vx: roundDiv(speed * (s.angle - 12) * R.angleStep, 1_000_000), spin: s.spin - 4, active: true };
    s.phase = "rolling";
    s.phaseTick = s.tick;
    s.rollStartTick = s.tick;
    s.standingAtStart = standingCount(s);
    return;
  }
  const [kind, value] = a.split("_");
  const n = Number(value);
  if (kind === "AIM") { s.aim = n; s.ball = restBall(s); }
  else if (kind === "ANGLE") s.angle = n;
  else if (kind === "SPIN") s.spin = n;
  else if (kind === "POWER") s.power = n;
}

export const BOWLING_CORE_V1: GameCore<BowlingStateV1> = {
  gameId: "bowling",
  gameVersion: "1.0.0",
  width: 390,
  height: 620,
  tickRate: R.tickRate,
  maxFinalTick: R.maxFinalTick,
  maxInputs: R.maxInputs,
  inputVersion: 1,
  actions: BOWLING_ACTIONS_V1,
  content: {
    rules: R,
    lane: "regulation-60ft-um-integer-discs;oil-to-11m-then-hook;gutters",
    scoring: "ten-pin-standard;10-frames;10th-frame-bonus-balls",
    celebration: "strike-360-ticks/spare-150-ticks;SKIP-ends-early",
  },
  create: createBowlingV1,
  step: stepBowlingV1,
  canApply: canApplyBowlingV1,
  apply: applyBowlingV1,
};
