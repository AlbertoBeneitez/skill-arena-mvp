/**
 * Billiards V5 — solo eight-ball. A real 15-ball rack (1–7 solids, 9–15 stripes, the black 8 in the middle) on the
 * same table and integer physics as V1–V4 (equal-mass discs, two sub-steps, cushions at 0.985, cloth 0.994).
 *  - The first ball potted decides your group (solids or stripes). Until then the table is open.
 *  - Each ball of your group: +1000. A ball of the other group: −300. Cue ball in a pocket: −250 and it goes back to
 *    the head spot. The score never goes below zero.
 *  - The 8 goes last, and into the pocket OPPOSITE to the one your seventh ball dropped into (corner ↔ diagonally
 *    opposite corner, middle ↔ the other middle). That wins: +3000 plus 100 per shot left.
 *  - Potting the 8 before your seven, in another pocket, or together with the cue ball ends the game (no bonus).
 *    An 8 that drops on the break is put back on the foot spot.
 *  - 24 shots. Input protocol unchanged since V3 (AIM_000–179, POWER_00–12, SHOOT).
 * V1–V4 stay frozen.
 */
import { createRng } from "../deterministic/seeded";
import { integerSqrt, roundDiv } from "../deterministic/integerMath";
import { BILLIARDS_POCKETS, BILLIARDS_RULES, billiardsDirection, type PoolBall } from "./billiardsCore.v1";
import { BILLIARDS_ACTIONS_V3 } from "./billiardsCore.v3";
import type { CoreState, GameCore } from "./coreRuntime.v1";

export const BILLIARDS_V5_RULES = {
  shots: 24,
  ownPoints: 1000,
  otherPenalty: 300,
  scratchPenalty: 250,
  eightBonus: 3000,
  shotLeftBonus: 100,
  /** Foot spot (apex of the rack) and head spot (cue ball), on the long axis of the portrait table. */
  footSpot: { x: 195000, y: 196000 },
  headSpot: { x: 195000, y: 401000 },
  /** Rack spacing: a hair over one diameter so the balls start touching-but-not-overlapping. */
  rackGap: 20200,
  speedBase: 1500,
  speedPerPower: 150,
  maxFinalTick: 120 * 60 * 12,
} as const;
const R = BILLIARDS_RULES, V = BILLIARDS_V5_RULES;
export type BilliardsGroup = "open" | "solids" | "stripes";
export const isSolid = (id: number) => id >= 1 && id <= 7;
export const isStripe = (id: number) => id >= 9 && id <= 15;
/** Pocket opposite each pocket: corners diagonally, middles across (TL0↔BR5, TR1↔BL4, ML2↔MR3). */
export const oppositePocket = (pocket: number) => 5 - pocket;

export type BilliardsV5Event =
  | { kind: "group"; tick: number; group: Exclude<BilliardsGroup, "open"> }
  | { kind: "eightTarget"; tick: number; pocket: number }
  | { kind: "foul"; tick: number; reason: "scratch" | "other" }
  | { kind: "respotEight"; tick: number }
  | { kind: "win"; tick: number; pocket: number }
  | { kind: "lose"; tick: number; reason: "EIGHT_EARLY" | "EIGHT_WRONG_POCKET" | "EIGHT_SCRATCH" };

export type BilliardsV5State = CoreState & {
  seed: string;
  balls: PoolBall[];
  aim: number;
  power: number;
  shotsLeft: number;
  totalShots: number;
  phase: "aim" | "moving";
  phaseTicks: number;
  group: BilliardsGroup;
  /** Pocket the 8 must go into (-1 until your seventh ball is down). */
  eightPocket: number;
  /** Balls potted during the current shot, in order, with their pocket. */
  shotPots: { id: number; pocket: number }[];
  ownDown: number;
  height: number;
  scratch: boolean;
  lastPotTick: number;
  lastPotX: number;
  lastPotY: number;
  lastPotId: number;
  lastContactTick: number;
  events: BilliardsV5Event[];
};

const ball = (id: number, x: number, y: number): PoolBall => ({ id, x, y, vx: 0, vy: 0, potted: false });

/** Rack layout (rows from the apex): apex 1, the 8 in the middle of row 3, one solid and one stripe in the back corners. */
export function billiardsRackV5(seed: string) {
  const rng = createRng(`${seed}:billiards5:rack`);
  const others = [2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15];
  for (let i = others.length - 1; i > 0; i--) { const j = rng.nextInt(i + 1); [others[i], others[j]] = [others[j], others[i]]; }
  // Slots: row-major from the apex; slot 0 = apex (ball 1), slot 4 = centre of row 3 (the 8).
  const slots: { row: number; col: number }[] = [];
  for (let row = 0; row < 5; row++) for (let col = 0; col <= row; col++) slots.push({ row, col });
  const ids: number[] = new Array(15).fill(0);
  ids[0] = 1; ids[4] = 8;
  let k = 0;
  for (let s = 0; s < 15; s++) if (s !== 0 && s !== 4) ids[s] = others[k++];
  // Back corners (slots 10 and 14): one solid and one stripe.
  if (isSolid(ids[10]) === isSolid(ids[14])) {
    const want = isSolid(ids[10]) ? isStripe : isSolid;
    const swap = ids.findIndex((id, s) => s !== 10 && s !== 14 && s !== 0 && s !== 4 && want(id));
    [ids[14], ids[swap]] = [ids[swap], ids[14]];
  }
  const rowStep = roundDiv(V.rackGap * 866, 1000);
  return slots.map((p, s) => ball(ids[s], V.footSpot.x + (2 * p.col - p.row) * roundDiv(V.rackGap, 2), V.footSpot.y - p.row * rowStep));
}

export function createBilliardsV5(seed: string): BilliardsV5State {
  const rack = billiardsRackV5(seed);
  return {
    tick: 0, status: "running", score: 0, failure: null, seed,
    balls: [ball(0, V.headSpot.x, V.headSpot.y), ...rack.sort((a, b) => a.id - b.id)],
    aim: 135, power: 9, shotsLeft: V.shots, totalShots: 0, phase: "aim", phaseTicks: 0,
    group: "open", eightPocket: -1, shotPots: [], ownDown: 0, height: 0, scratch: false,
    lastPotTick: -100, lastPotX: 0, lastPotY: 0, lastPotId: -1, lastContactTick: -100, events: [],
  };
}

const trunc = Math.trunc;
function pocket(s: BilliardsV5State, b: PoolBall) {
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
function collide(s: BilliardsV5State, a: PoolBall, b: PoolBall) {
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
/** Nearest free spot to `from` along a fixed search pattern (deterministic). */
function freeSpot(s: BilliardsV5State, id: number, candidates: readonly { x: number; y: number }[]) {
  for (const c of candidates) {
    const clear = s.balls.every((b) => b.id === id || b.potted || (b.x - c.x) ** 2 + (b.y - c.y) ** 2 >= 22000 ** 2);
    if (clear) return c;
  }
  return candidates[0];
}
const HEAD_SPOTS = [401000, 440000, 360000, 470000, 320000].flatMap((y) => [195000, 155000, 235000, 115000, 275000].map((x) => ({ x, y })));
const FOOT_SPOTS = [196000, 174000, 152000, 130000, 218000, 240000].flatMap((y) => [195000, 173000, 217000].map((x) => ({ x, y })));

function remainingOwn(s: BilliardsV5State, group: BilliardsGroup) {
  const own = group === "solids" ? isSolid : group === "stripes" ? isStripe : () => false;
  return s.balls.filter((b) => own(b.id) && !b.potted).length;
}

/** Score the finished shot: groups, penalties, the 8 and the cue ball. */
function resolveShot(s: BilliardsV5State) {
  const pots = s.shotPots, breakShot = s.totalShots === 1, wasOpen = s.group === "open";
  const ownBefore = s.group === "open" ? 7 : remainingOwn(s, s.group) + pots.filter((p) => (s.group === "solids" ? isSolid : isStripe)(p.id)).length;
  if (s.group === "open") {
    const first = pots.find((p) => isSolid(p.id) || isStripe(p.id));
    if (first) { s.group = isSolid(first.id) ? "solids" : "stripes"; s.events.push({ kind: "group", tick: s.tick, group: s.group }); }
  }
  const own = s.group === "solids" ? isSolid : s.group === "stripes" ? isStripe : () => false;
  const other = s.group === "solids" ? isStripe : s.group === "stripes" ? isSolid : () => false;
  // On the shot that assigns the group (open table) the other group's balls are not a foul.
  const assigningShot = wasOpen;
  let delta = 0, lastOwnPocket = -1;
  for (const p of pots) {
    if (own(p.id)) { delta += V.ownPoints; lastOwnPocket = p.pocket; }
    else if (other(p.id) && !assigningShot) { delta -= V.otherPenalty; s.events.push({ kind: "foul", tick: s.tick, reason: "other" }); }
  }
  if (s.scratch) { delta -= V.scratchPenalty; s.events.push({ kind: "foul", tick: s.tick, reason: "scratch" }); }
  s.score = Math.max(0, s.score + delta);
  s.ownDown = s.group === "open" ? 0 : 7 - remainingOwn(s, s.group);
  s.height = s.ownDown;
  if (s.eightPocket < 0 && s.group !== "open" && s.ownDown === 7 && lastOwnPocket >= 0) {
    s.eightPocket = oppositePocket(lastOwnPocket);
    s.events.push({ kind: "eightTarget", tick: s.tick, pocket: s.eightPocket });
  }
  const eight = pots.find((p) => p.id === 8);
  if (eight) {
    if (breakShot) {
      const spot = freeSpot(s, 8, FOOT_SPOTS), b = s.balls.find((q) => q.id === 8)!;
      b.x = spot.x; b.y = spot.y; b.vx = b.vy = 0; b.potted = false;
      s.events.push({ kind: "respotEight", tick: s.tick });
    } else {
      // Legal only if your seven were all down BEFORE this shot, into the opposite pocket, without the cue ball.
      const reason = ownBefore > 0 || s.group === "open" ? "EIGHT_EARLY" : s.scratch ? "EIGHT_SCRATCH" : eight.pocket !== s.eightPocket ? "EIGHT_WRONG_POCKET" : null;
      if (reason) {
        s.status = "failed"; s.failure = reason;
        s.events.push({ kind: "lose", tick: s.tick, reason });
      } else {
        s.score += V.eightBonus + s.shotsLeft * V.shotLeftBonus;
        s.status = "won"; s.failure = null;
        s.events.push({ kind: "win", tick: s.tick, pocket: eight.pocket });
      }
      return;
    }
  }
  if (s.scratch) {
    const spot = freeSpot(s, 0, HEAD_SPOTS), cue = s.balls[0];
    cue.x = spot.x; cue.y = spot.y; cue.vx = cue.vy = 0; cue.potted = false;
  }
  if (s.shotsLeft === 0) { s.status = "failed"; s.failure = "SHOTS_EXHAUSTED"; return; }
  s.phase = "aim"; s.phaseTicks = 0;
}

export function stepBilliardsV5(s: BilliardsV5State) {
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

export function canApplyBilliardsV5(s: BilliardsV5State, action: string) {
  if (s.status !== "running" || s.phase !== "aim" || !BILLIARDS_ACTIONS_V3.includes(action)) return false;
  if (action.startsWith("AIM_")) return s.aim !== Number(action.slice(4));
  if (action.startsWith("POWER_")) return s.power !== Number(action.slice(6));
  return s.shotsLeft > 0;
}
export function applyBilliardsV5(s: BilliardsV5State, action: string) {
  if (action.startsWith("AIM_")) { s.aim = Number(action.slice(4)); return; }
  if (action.startsWith("POWER_")) { s.power = Number(action.slice(6)); return; }
  const d = billiardsDirection(s.aim), speed = V.speedBase + s.power * V.speedPerPower, cue = s.balls[0];
  cue.vx = roundDiv(d.x * speed, d.length); cue.vy = roundDiv(d.y * speed, d.length);
  s.shotsLeft--; s.totalShots++;
  s.phase = "moving"; s.phaseTicks = 0; s.scratch = false; s.shotPots = [];
}

export const BILLIARDS_CORE_V5: GameCore<BilliardsV5State> = {
  gameId: "billiards",
  gameVersion: "5.0.0",
  width: 390,
  height: 620,
  tickRate: 120,
  maxFinalTick: V.maxFinalTick,
  maxInputs: 6000,
  inputVersion: 2,
  actions: BILLIARDS_ACTIONS_V3,
  content: {
    rules: V,
    physics: "v1-integer-equal-mass-substep2;cushion-985;cloth-994",
    table: { pockets: BILLIARDS_POCKETS, bounds: { left: R.left, right: R.right, top: R.top, bottom: R.bottom }, ballRadius: R.radius, pocketRadius: R.pocketRadius },
    rack: "15-balls;apex-1;eight-centre;one-solid-one-stripe-back-corners;seeded-rest",
    scoring: "own+1000;other-300;scratch-250;eight-last-in-pocket-opposite-the-seventh+3000+100-per-shot-left;early/wrong/scratch-eight-ends",
  },
  create: createBilliardsV5,
  step: stepBilliardsV5,
  canApply: canApplyBilliardsV5,
  apply: applyBilliardsV5,
};
export { BILLIARDS_ACTIONS_V3 as BILLIARDS_ACTIONS_V5 };
