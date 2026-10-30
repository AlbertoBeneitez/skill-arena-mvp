/**
 * Billiards V7 (owner request, 30 Oct 2026): the V6 gymkhana with a stronger cue — every power step adds 250 µm/tick
 * (V6: 150), so the hardest shot is 4500 instead of 3300 (+36 %). Layouts, rules and scoring are V6's.
 *
 * Billiards V6 — "Gymkana": five levels in a row, a new random layout every match (owner request, 29 Oct 2026;
 * an owner-approved exception to the one-continuous-run rule, like Galactic Birds V5).
 *
 * Same table and integer physics as V1–V5 (equal-mass discs, two sub-steps, cushions 0.985, cloth 0.994).
 * Every level is laid out from the match seed, so the same match is identical for every player and every replay:
 *   1. Calentamiento — two balls near two pockets (4 shots).
 *   2. Por la banda — three balls pinned to three different cushions (5 shots).
 *   3. Combinación — two balls lined up on a pocket plus one more (5 shots).
 *   4. Eslalon — three balls behind a wall of three striped blockers (6 shots).
 *   5. Final — four balls, two blockers and the black 8, which goes last (7 shots).
 * Scoring: solid (target) +1000 · striped blocker −400 · cue ball in a pocket −250 (it comes back) · the 8 last +2000,
 * the 8 early −500 (it is put back). A cleared level adds 500 + 150 per shot left in that level. A level whose shots
 * run out ends without bonus and the next one starts. The match ends after level 5; the score never goes below zero.
 * Input protocol unchanged since V3 (AIM_000–179, POWER_00–12, SHOOT). V1–V5 stay frozen.
 */
import { createRng } from "../deterministic/seeded";
import { integerSqrt, roundDiv, sinPhaseMilli } from "../deterministic/integerMath";
import { BILLIARDS_POCKETS, BILLIARDS_RULES, billiardsDirection, type PoolBall } from "./billiardsCore.v1";
import { BILLIARDS_ACTIONS_V3 } from "./billiardsCore.v3";
import type { CoreState, GameCore } from "./coreRuntime.v1";

export const BILLIARDS_V7_RULES = {
  levels: 5,
  levelShots: [4, 5, 5, 6, 7] as readonly number[],
  targetPoints: 1000,
  blockerPenalty: 400,
  scratchPenalty: 250,
  eightBonus: 2000,
  eightEarlyPenalty: 500,
  clearBonus: 500,
  shotLeftBonus: 150,
  speedBase: 1500,
  speedPerPower: 250,
  maxFinalTick: 120 * 60 * 20,
} as const;
const R = BILLIARDS_RULES, V = BILLIARDS_V7_RULES;
export type BilliardsLevelKind = "warmup" | "rails" | "combo" | "slalom" | "final";
export const BILLIARDS_LEVEL_KINDS: readonly BilliardsLevelKind[] = ["warmup", "rails", "combo", "slalom", "final"];
export const isTarget = (id: number) => id >= 1 && id <= 7;
export const isBlocker = (id: number) => id >= 9 && id <= 15;

export type BilliardsV7Event =
  | { kind: "level"; tick: number; level: number }
  | { kind: "levelClear"; tick: number; level: number; bonus: number }
  | { kind: "levelOver"; tick: number; level: number }
  | { kind: "foul"; tick: number; reason: "scratch" | "blocker" }
  | { kind: "eightEarly"; tick: number }
  | { kind: "eightWin"; tick: number };

export type BilliardsV7State = CoreState & {
  seed: string;
  balls: PoolBall[];
  aim: number;
  power: number;
  /** 1–5 */
  level: number;
  levelShotsLeft: number;
  levelsCleared: number;
  totalShots: number;
  phase: "aim" | "moving";
  phaseTicks: number;
  shotPots: { id: number; pocket: number }[];
  height: number;
  scratch: boolean;
  lastPotTick: number;
  lastPotX: number;
  lastPotY: number;
  lastPotId: number;
  lastContactTick: number;
  events: BilliardsV7Event[];
  /** Cue ball start of the current level (respot after a scratch searches around it). */
  cueSpotX: number;
  cueSpotY: number;
};

const ball = (id: number, x: number, y: number): PoolBall => ({ id, x, y, vx: 0, vy: 0, potted: false });
const MIN_X = R.left + R.radius + 6000, MAX_X = R.right - R.radius - 6000;
const MIN_Y = R.top + R.radius + 6000, MAX_Y = R.bottom - R.radius - 6000;
const POCKET_CLEAR = R.pocketRadius + R.radius + 8000;
const BALL_CLEAR = 2 * R.radius + 8000;
const CENTER = { x: 195000, y: 299000 };

type Spot = { x: number; y: number };
type Rng = ReturnType<typeof createRng>;
const between = (rng: Rng, lo: number, hi: number) => lo + rng.nextInt(hi - lo + 1);
function clearOf(p: Spot, placed: readonly Spot[], gap = BALL_CLEAR) {
  if (p.x < MIN_X || p.x > MAX_X || p.y < MIN_Y || p.y > MAX_Y) return false;
  if (BILLIARDS_POCKETS.some((q) => (q.x - p.x) ** 2 + (q.y - p.y) ** 2 < POCKET_CLEAR ** 2)) return false;
  return placed.every((q) => (q.x - p.x) ** 2 + (q.y - p.y) ** 2 >= gap ** 2);
}
/** Random free spot inside a box; deterministic fallback scan if the dice keep failing. */
function spotIn(rng: Rng, placed: Spot[], box: { x0: number; x1: number; y0: number; y1: number }): Spot {
  for (let i = 0; i < 200; i++) {
    const p = { x: between(rng, box.x0, box.x1), y: between(rng, box.y0, box.y1) };
    if (clearOf(p, placed)) return p;
  }
  for (let y = box.y0; y <= box.y1; y += 7000) for (let x = box.x0; x <= box.x1; x += 7000) if (clearOf({ x, y }, placed)) return { x, y };
  return { x: CENTER.x, y: CENTER.y };
}
/** Point `distance` µm from pocket `i` towards the table centre. */
function fromPocket(i: number, distance: number): Spot {
  const p = BILLIARDS_POCKETS[i], dx = CENTER.x - p.x, dy = CENTER.y - p.y, len = Math.max(1, integerSqrt(dx * dx + dy * dy));
  return { x: p.x + roundDiv(dx * distance, len), y: p.y + roundDiv(dy * distance, len) };
}
function pickDistinct(rng: Rng, n: number, count: number) {
  const pool = Array.from({ length: n }, (_, i) => i);
  for (let i = pool.length - 1; i > 0; i--) { const j = rng.nextInt(i + 1); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, count);
}

export type BilliardsLayout = { cue: Spot; balls: PoolBall[] };
const LOWER = { x0: 110000, x1: 280000, y0: 400000, y1: 470000 };

/** Layout of level `level` (1–5) for `seed`: pure function of both. */
export function billiardsLevelLayoutV7(seed: string, level: number): BilliardsLayout {
  const rng = createRng(`${seed}:billiards6:L${level}`);
  const placed: Spot[] = [], out: PoolBall[] = [];
  const add = (id: number, p: Spot) => { placed.push(p); out.push(ball(id, p.x, p.y)); };
  const kind = BILLIARDS_LEVEL_KINDS[level - 1];
  if (kind === "warmup") {
    for (const [k, pocket] of pickDistinct(rng, 6, 2).entries()) {
      let p = fromPocket(pocket, between(rng, 56000, 92000));
      if (!clearOf(p, placed)) p = spotIn(rng, placed, { x0: MIN_X, x1: MAX_X, y0: 120000, y1: 360000 });
      add(k + 1, p);
    }
  } else if (kind === "rails") {
    const rails = pickDistinct(rng, 4, 3);
    rails.forEach((rail, k) => {
      let p: Spot = { x: 0, y: 0 };
      for (let tries = 0; tries < 60; tries++) {
        if (rail === 0) p = { x: R.left + R.radius + 2000, y: between(rng, 140000, 460000) };
        else if (rail === 1) p = { x: R.right - R.radius - 2000, y: between(rng, 140000, 460000) };
        else if (rail === 2) p = { x: between(rng, 100000, 290000), y: R.top + R.radius + 2000 };
        else p = { x: between(rng, 100000, 290000), y: R.bottom - R.radius - 2000 };
        if (Math.abs(p.y - 299000) > 46000 && placed.every((q) => (q.x - p.x) ** 2 + (q.y - p.y) ** 2 >= BALL_CLEAR ** 2)
          && BILLIARDS_POCKETS.every((q) => (q.x - p.x) ** 2 + (q.y - p.y) ** 2 >= POCKET_CLEAR ** 2)) break;
      }
      add(k + 1, p);
    });
  } else if (kind === "combo") {
    // Two balls on one line to a pocket (the far one pushes the near one in), plus a loose one.
    for (let tries = 0; tries < 40; tries++) {
      const pocket = rng.nextInt(6), d = between(rng, 60000, 92000);
      const near = fromPocket(pocket, d), far = fromPocket(pocket, d + 2 * R.radius + 1500);
      if (clearOf(near, placed) && clearOf(far, placed)) { add(1, near); placed.push(far); out.push(ball(2, far.x, far.y)); break; }
    }
    if (out.length < 2) { add(1, spotIn(rng, placed, { x0: MIN_X, x1: MAX_X, y0: 120000, y1: 340000 })); add(2, spotIn(rng, placed, { x0: MIN_X, x1: MAX_X, y0: 120000, y1: 340000 })); }
    add(3, spotIn(rng, placed, { x0: MIN_X, x1: MAX_X, y0: 120000, y1: 360000 }));
  } else if (kind === "slalom") {
    for (let k = 1; k <= 3; k++) add(k, spotIn(rng, placed, { x0: MIN_X, x1: MAX_X, y0: 116000, y1: 250000 }));
    for (let k = 0; k < 3; k++) add(9 + k, spotIn(rng, placed, { x0: 80000, x1: 310000, y0: 280000, y1: 370000 }));
  } else {
    for (let k = 1; k <= 4; k++) add(k, spotIn(rng, placed, { x0: MIN_X, x1: MAX_X, y0: 116000, y1: 380000 }));
    add(8, spotIn(rng, placed, { x0: 90000, x1: 300000, y0: 150000, y1: 330000 }));
    for (let k = 0; k < 2; k++) add(9 + k, spotIn(rng, placed, { x0: 80000, x1: 310000, y0: 200000, y1: 380000 }));
  }
  const cue = kind === "rails" ? spotIn(rng, placed, { x0: 150000, x1: 240000, y0: 360000, y1: 420000 }) : spotIn(rng, placed, LOWER);
  return { cue, balls: out };
}

function setupLevel(s: BilliardsV7State, level: number) {
  const layout = billiardsLevelLayoutV7(s.seed, level);
  s.level = level;
  s.levelShotsLeft = V.levelShots[level - 1];
  s.balls = [ball(0, layout.cue.x, layout.cue.y), ...layout.balls.sort((a, b) => a.id - b.id)];
  s.cueSpotX = layout.cue.x; s.cueSpotY = layout.cue.y;
  s.phase = "aim"; s.phaseTicks = 0; s.scratch = false; s.shotPots = [];
  s.height = level;
  s.events.push({ kind: "level", tick: s.tick, level });
}

export function createBilliardsV7(seed: string): BilliardsV7State {
  const s: BilliardsV7State = {
    tick: 0, status: "running", score: 0, failure: null, seed,
    balls: [], aim: 135, power: 9, level: 1, levelShotsLeft: 0, levelsCleared: 0, totalShots: 0,
    phase: "aim", phaseTicks: 0, shotPots: [], height: 1, scratch: false,
    lastPotTick: -100, lastPotX: 0, lastPotY: 0, lastPotId: -1, lastContactTick: -100, events: [], cueSpotX: 0, cueSpotY: 0,
  };
  setupLevel(s, 1);
  return s;
}

const trunc = Math.trunc;
function pocket(s: BilliardsV7State, b: PoolBall) {
  if (b.potted) return;
  for (let i = 0; i < BILLIARDS_POCKETS.length; i++) {
    const p = BILLIARDS_POCKETS[i];
    if ((b.x - p.x) ** 2 + (b.y - p.y) ** 2 <= R.pocketRadius ** 2) {
      b.potted = true; b.vx = b.vy = 0;
      s.shotPots.push({ id: b.id, pocket: i });
      if (b.id === 0) s.scratch = true;
      else { s.lastPotTick = s.tick; s.lastPotX = p.x; s.lastPotY = p.y; s.lastPotId = b.id; }
      return;
    }
  }
}
function bands(b: PoolBall) {
  const r = R.radius;
  if (b.x < R.left + r) { b.x = R.left + r; b.vx = Math.abs(trunc((b.vx * 985) / 1000)); }
  if (b.x > R.right - r) { b.x = R.right - r; b.vx = -Math.abs(trunc((b.vx * 985) / 1000)); }
  if (b.y < R.top + r) { b.y = R.top + r; b.vy = Math.abs(trunc((b.vy * 985) / 1000)); }
  if (b.y > R.bottom - r) { b.y = R.bottom - r; b.vy = -Math.abs(trunc((b.vy * 985) / 1000)); }
}
function collide(s: BilliardsV7State, a: PoolBall, b: PoolBall) {
  if (a.potted || b.potted) return;
  let dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
  const diameter = 2 * R.radius;
  if (d2 >= diameter * diameter) return;
  if (!d2) { dx = 1; dy = 0; d2 = 1; }
  const distance = Math.max(1, integerSqrt(d2)), separation = Math.ceil((diameter - distance) / 2) + 1;
  const sx = roundDiv(dx * separation, distance), sy = roundDiv(dy * separation, distance);
  a.x -= sx; a.y -= sy; b.x += sx; b.y += sy;
  const approach = (a.vx - b.vx) * dx + (a.vy - b.vy) * dy;
  if (approach <= 0) return;
  const ix = roundDiv(roundDiv(approach * dx, d2) * 1985, 2000), iy = roundDiv(roundDiv(approach * dy, d2) * 1985, 2000);
  a.vx -= ix; a.vy -= iy; b.vx += ix; b.vy += iy;
  s.lastContactTick = s.tick;
}
/** First free spot in a fixed spiral around `from` (deterministic). */
function freeSpotNear(s: BilliardsV7State, id: number, from: Spot): Spot {
  const others = s.balls.filter((b) => b.id !== id && !b.potted);
  for (let ring = 0; ring < 12; ring++) for (let k = 0; k < Math.max(1, ring * 6); k++) {
    const a = ring ? Math.floor((k * 4096) / (ring * 6)) : 0;
    const c = ring ? { x: from.x + roundDiv(ring * 16000 * sinPhaseMilli(a + 1024), 1000), y: from.y + roundDiv(ring * 16000 * sinPhaseMilli(a), 1000) } : from;
    if (clearOf(c, others, 2 * R.radius + 2000)) return c;
  }
  return from;
}
const remaining = (s: BilliardsV7State, pred: (id: number) => boolean) => s.balls.filter((b) => pred(b.id) && !b.potted).length;

function resolveShot(s: BilliardsV7State) {
  const pots = s.shotPots, targetsBefore = remaining(s, isTarget) + pots.filter((p) => isTarget(p.id)).length;
  let delta = 0;
  for (const p of pots) {
    if (isTarget(p.id)) delta += V.targetPoints;
    else if (isBlocker(p.id)) { delta -= V.blockerPenalty; s.events.push({ kind: "foul", tick: s.tick, reason: "blocker" }); }
  }
  if (s.scratch) { delta -= V.scratchPenalty; s.events.push({ kind: "foul", tick: s.tick, reason: "scratch" }); }
  const eight = pots.find((p) => p.id === 8);
  if (eight) {
    if (targetsBefore === 0 && !s.scratch) { delta += V.eightBonus; s.events.push({ kind: "eightWin", tick: s.tick }); }
    else {
      delta -= V.eightEarlyPenalty; s.events.push({ kind: "eightEarly", tick: s.tick });
      const b = s.balls.find((q) => q.id === 8)!, spot = freeSpotNear(s, 8, CENTER);
      b.x = spot.x; b.y = spot.y; b.vx = b.vy = 0; b.potted = false;
    }
  }
  s.score = Math.max(0, s.score + delta);
  if (s.scratch) {
    const cue = s.balls[0], spot = freeSpotNear(s, 0, { x: s.cueSpotX, y: s.cueSpotY });
    cue.x = spot.x; cue.y = spot.y; cue.vx = cue.vy = 0; cue.potted = false;
  }
  const left = remaining(s, isTarget) + remaining(s, (id) => id === 8);
  let next = false;
  if (left === 0) {
    const bonus = V.clearBonus + s.levelShotsLeft * V.shotLeftBonus;
    s.score += bonus; s.levelsCleared++;
    s.events.push({ kind: "levelClear", tick: s.tick, level: s.level, bonus });
    next = true;
  } else if (s.levelShotsLeft === 0) {
    s.events.push({ kind: "levelOver", tick: s.tick, level: s.level });
    next = true;
  }
  if (next) {
    if (s.level === V.levels) { s.status = "won"; s.failure = null; return; }
    setupLevel(s, s.level + 1);
    return;
  }
  s.phase = "aim"; s.phaseTicks = 0;
}

export function stepBilliardsV7(s: BilliardsV7State) {
  s.tick++;
  s.phaseTicks++;
  if (s.phase === "aim") {
    if (s.phaseTicks >= R.aimIdleTicks) { s.status = "failed"; s.failure = "AIM_TIMEOUT"; }
    return;
  }
  for (let sub = 0; sub < 2; sub++) {
    for (const b of s.balls)
      if (!b.potted) {
        b.x += trunc(b.vx / 2); b.y += trunc(b.vy / 2);
        pocket(s, b);
        if (!b.potted) bands(b);
      }
    for (let pass = 0; pass < 2; pass++)
      for (let a = 0; a < s.balls.length; a++)
        for (let b = a + 1; b < s.balls.length; b++) collide(s, s.balls[a], s.balls[b]);
    for (const b of s.balls) if (!b.potted) pocket(s, b);
  }
  let moving = false;
  for (const b of s.balls)
    if (!b.potted) {
      b.vx = trunc((b.vx * 994) / 1000); b.vy = trunc((b.vy * 994) / 1000);
      if (b.vx * b.vx + b.vy * b.vy < 256) b.vx = b.vy = 0;
      else moving = true;
    }
  if (moving && s.phaseTicks < R.maxFlightTicks) return;
  for (const b of s.balls) b.vx = b.vy = 0;
  resolveShot(s);
}

export function canApplyBilliardsV7(s: BilliardsV7State, action: string) {
  if (s.status !== "running" || s.phase !== "aim" || !BILLIARDS_ACTIONS_V3.includes(action)) return false;
  if (action.startsWith("AIM_")) return s.aim !== Number(action.slice(4));
  if (action.startsWith("POWER_")) return s.power !== Number(action.slice(6));
  return s.levelShotsLeft > 0;
}
export function applyBilliardsV7(s: BilliardsV7State, action: string) {
  if (action.startsWith("AIM_")) { s.aim = Number(action.slice(4)); return; }
  if (action.startsWith("POWER_")) { s.power = Number(action.slice(6)); return; }
  const d = billiardsDirection(s.aim), speed = V.speedBase + s.power * V.speedPerPower, cue = s.balls[0];
  cue.vx = roundDiv(d.x * speed, d.length); cue.vy = roundDiv(d.y * speed, d.length);
  s.levelShotsLeft--; s.totalShots++;
  s.phase = "moving"; s.phaseTicks = 0; s.scratch = false; s.shotPots = [];
}

export const BILLIARDS_CORE_V7: GameCore<BilliardsV7State> = {
  gameId: "billiards",
  gameVersion: "7.0.0",
  width: 390,
  height: 620,
  tickRate: 120,
  maxFinalTick: V.maxFinalTick,
  maxInputs: 6000,
  inputVersion: 2,
  actions: BILLIARDS_ACTIONS_V3,
  content: {
    rules: V,
    physics: "v1-integer-equal-mass-substep2;cushion-985;cloth-994;cue-1500+250-per-power",
    table: { pockets: BILLIARDS_POCKETS, bounds: { left: R.left, right: R.right, top: R.top, bottom: R.bottom }, ballRadius: R.radius, pocketRadius: R.pocketRadius },
    levels: "gymkhana-5:warmup-2-near-pockets/4,rails-3-cushions/5,combo-line-plus-1/5,slalom-3-behind-3-blockers/6,final-4-plus-2-blockers-eight-last/7;seeded-layout-per-level",
    scoring: "target+1000;blocker-400;scratch-250-respot;eight-last+2000;eight-early-500-respot;clear+500+150-per-level-shot-left;no-bonus-when-shots-run-out;floor-0",
  },
  create: createBilliardsV7,
  step: stepBilliardsV7,
  canApply: canApplyBilliardsV7,
  apply: applyBilliardsV7,
};
export { BILLIARDS_ACTIONS_V3 as BILLIARDS_ACTIONS_V7 };
