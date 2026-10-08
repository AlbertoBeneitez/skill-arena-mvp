/** Original arcade billiards: fixed-point, ordered equal-mass collisions, common replay. */
import { createRng } from "../deterministic/seeded";
import {
  integerSqrt,
  roundDiv,
  sinPhaseMilli,
} from "../deterministic/integerMath";
import { BILLIARDS_ACTIONS, BILLIARDS_AIM_COUNT } from "./billiardsProtocol.v1";
import type { CoreState, GameCore } from "./coreRuntime.v1";
export const BILLIARDS_RULES = {
  left: 42000,
  right: 348000,
  top: 94000,
  bottom: 504000,
  radius: 10000,
  pocketRadius: 21000,
  frictionNumerator: 994,
  frictionDenominator: 1000,
  restitutionNumerator: 985,
  powers: [1500, 2400, 3300],
  levels: 5,
  shotsPerLevel: 7,
  settleTicks: 72,
  aimIdleTicks: 120 * 90,
  maxFlightTicks: 120 * 10,
} as const;
export type PoolBall = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  potted: boolean;
};
export type PoolBumper = { x: number; y: number; radius: number };
export type BilliardsState = CoreState & {
  seed: string;
  stage: number;
  balls: PoolBall[];
  bumpers: PoolBumper[];
  aim: number;
  power: number;
  shotsLeft: number;
  totalShots: number;
  phase: "aim" | "moving" | "settle";
  phaseTicks: number;
  lastPotTick: number;
  lastPotX: number;
  lastPotY: number;
  lastContactTick: number;
  lastStageTick: number;
  scratch: boolean;
  shotPots: number;
  streak: number;
};
export const BILLIARDS_POCKETS = [
  { x: 44000, y: 96000 },
  { x: 346000, y: 96000 },
  { x: 44000, y: 299000 },
  { x: 346000, y: 299000 },
  { x: 44000, y: 502000 },
  { x: 346000, y: 502000 },
] as const;
const trunc = Math.trunc;
export function billiardsDirection(aim: number) {
  const phase = Math.floor((aim * 4096) / BILLIARDS_AIM_COUNT),
    x = sinPhaseMilli(phase + 1024),
    y = sinPhaseMilli(phase);
  return { x, y, length: integerSqrt(x * x + y * y) };
}
function ball(id: number, x: number, y: number): PoolBall {
  return { id, x, y, vx: 0, vy: 0, potted: false };
}
function layout(state: BilliardsState) {
  const rng = createRng(`${state.seed}:billiards1:layout:${state.stage}`),
    mirror = rng.nextInt(2) === 1,
    shift = rng.nextInt(7) * 1000 - 3000;
  const x = (value: number) => (mirror ? 390000 - value : value);
  // Near-pocket targets teach clean contact before combinations and orbital bumpers.
  const spots = [
    { x: 100000 + shift, y: 166000 + shift },
    { x: 300000 - shift, y: 169000 + shift },
    { x: 96000, y: 432000 - shift },
    { x: 303000, y: 425000 + shift },
  ];
  const count = [1, 2, 3, 3, 4][state.stage];
  state.balls = [
    ball(0, x(216000 + shift), 314000 + shift),
    ...spots.slice(0, count).map((p, i) => ball(i + 1, x(p.x), p.y)),
  ];
  state.bumpers =
    state.stage >= 3 ? [{ x: 195000, y: 220000, radius: 18000 }] : [];
  if (state.stage === 4)
    state.bumpers.push({ x: 195000, y: 405000, radius: 16000 });
  state.shotsLeft = BILLIARDS_RULES.shotsPerLevel;
  state.phase = "aim";
  state.phaseTicks = 0;
  state.scratch = false;
  state.shotPots = 0;
  state.aim = mirror ? 154 : 116;
  state.power = 1;
}
export function createBilliardsState(seed: string): BilliardsState {
  const state: BilliardsState = {
    tick: 0,
    status: "running",
    score: 0,
    failure: null,
    seed,
    stage: 0,
    balls: [],
    bumpers: [],
    aim: 0,
    power: 1,
    shotsLeft: 7,
    totalShots: 0,
    phase: "aim",
    phaseTicks: 0,
    lastPotTick: -100,
    lastPotX: 0,
    lastPotY: 0,
    lastContactTick: -100,
    lastStageTick: -100,
    scratch: false,
    shotPots: 0,
    streak: 0,
  };
  layout(state);
  return state;
}
function pocket(state: BilliardsState, b: PoolBall) {
  if (b.potted) return;
  for (const p of BILLIARDS_POCKETS)
    if (
      (b.x - p.x) ** 2 + (b.y - p.y) ** 2 <=
      BILLIARDS_RULES.pocketRadius ** 2
    ) {
      b.potted = true;
      b.vx = b.vy = 0;
      if (b.id === 0) {
        state.scratch = true;
        state.score = Math.max(0, state.score - 250);
        state.streak = 0;
      } else {
        state.shotPots++;
        state.score += 1000 + state.stage * 100;
        state.lastPotTick = state.tick;
        state.lastPotX = p.x;
        state.lastPotY = p.y;
      }
      return;
    }
}
function bands(b: PoolBall) {
  const r = BILLIARDS_RULES.radius;
  if (b.x < BILLIARDS_RULES.left + r) {
    b.x = BILLIARDS_RULES.left + r;
    b.vx = Math.abs(trunc((b.vx * 985) / 1000));
  }
  if (b.x > BILLIARDS_RULES.right - r) {
    b.x = BILLIARDS_RULES.right - r;
    b.vx = -Math.abs(trunc((b.vx * 985) / 1000));
  }
  if (b.y < BILLIARDS_RULES.top + r) {
    b.y = BILLIARDS_RULES.top + r;
    b.vy = Math.abs(trunc((b.vy * 985) / 1000));
  }
  if (b.y > BILLIARDS_RULES.bottom - r) {
    b.y = BILLIARDS_RULES.bottom - r;
    b.vy = -Math.abs(trunc((b.vy * 985) / 1000));
  }
}
function collide(state: BilliardsState, a: PoolBall, b: PoolBall) {
  if (a.potted || b.potted) return;
  let dx = b.x - a.x,
    dy = b.y - a.y,
    d2 = dx * dx + dy * dy;
  const diameter = 2 * BILLIARDS_RULES.radius;
  if (d2 >= diameter * diameter) return;
  if (!d2) {
    dx = 1;
    dy = 0;
    d2 = 1;
  }
  const distance = Math.max(1, integerSqrt(d2)),
    separation = Math.ceil((diameter - distance) / 2) + 1;
  const sx = roundDiv(dx * separation, distance),
    sy = roundDiv(dy * separation, distance);
  a.x -= sx;
  a.y -= sy;
  b.x += sx;
  b.y += sy;
  const approach = (a.vx - b.vx) * dx + (a.vy - b.vy) * dy;
  if (approach <= 0) return;
  // Equal-mass normal impulse, coefficient 0.985. Tangential velocity is preserved.
  const ix = roundDiv(roundDiv(approach * dx, d2) * 1985, 2000),
    iy = roundDiv(roundDiv(approach * dy, d2) * 1985, 2000);
  a.vx -= ix;
  a.vy -= iy;
  b.vx += ix;
  b.vy += iy;
  state.lastContactTick = state.tick;
}
function bumper(state: BilliardsState, b: PoolBall, p: PoolBumper) {
  const dx = b.x - p.x,
    dy = b.y - p.y,
    d2 = dx * dx + dy * dy,
    r = p.radius + BILLIARDS_RULES.radius;
  if (d2 >= r * r) return;
  const distance = Math.max(1, integerSqrt(d2)),
    nx = d2 ? dx : 1,
    ny = d2 ? dy : 0;
  b.x = p.x + roundDiv(nx * (r + 1), distance);
  b.y = p.y + roundDiv(ny * (r + 1), distance);
  const dot = b.vx * nx + b.vy * ny;
  if (dot < 0) {
    const divisor = Math.max(1, d2);
    b.vx -= roundDiv(roundDiv(dot * nx, divisor) * 1985, 1000);
    b.vy -= roundDiv(roundDiv(dot * ny, divisor) * 1985, 1000);
    state.lastContactTick = state.tick;
  }
}
function respotCue(state: BilliardsState) {
  const cue = state.balls[0];
  for (const y of [360000, 400000, 320000, 460000, 280000, 180000])
    for (const x of [195000, 145000, 245000, 95000, 295000]) {
      const clear =
        state.balls.every(
          (b) =>
            b.id === 0 ||
            b.potted ||
            (b.x - x) ** 2 + (b.y - y) ** 2 >= 440000000,
        ) &&
        state.bumpers.every(
          (b) => (b.x - x) ** 2 + (b.y - y) ** 2 >= (b.radius + 12000) ** 2,
        );
      if (clear) {
        cue.x = x;
        cue.y = y;
        cue.vx = cue.vy = 0;
        cue.potted = false;
        return;
      }
    }
  throw new Error("BILLIARDS_RESPOT_CAPACITY");
}
export function stepBilliards(state: BilliardsState) {
  state.tick++;
  state.phaseTicks++;
  if (state.phase === "settle") {
    if (state.phaseTicks < BILLIARDS_RULES.settleTicks) return;
    if (state.stage === BILLIARDS_RULES.levels - 1) {
      state.status = "won";
      return;
    }
    state.stage++;
    layout(state);
    state.lastStageTick = state.tick;
    return;
  }
  if (state.phase === "aim") {
    if (state.phaseTicks >= BILLIARDS_RULES.aimIdleTicks) {
      state.status = "failed";
      state.failure = "AIM_TIMEOUT";
    }
    return;
  }
  // Two fixed substeps; maximum movement is less than one fifth of a ball diameter.
  for (let sub = 0; sub < 2; sub++) {
    for (const b of state.balls)
      if (!b.potted) {
        b.x += trunc(b.vx / 2);
        b.y += trunc(b.vy / 2);
        pocket(state, b);
        if (!b.potted) {
          bands(b);
          for (const p of state.bumpers) bumper(state, b, p);
        }
      }
    for (let pass = 0; pass < 2; pass++)
      for (let a = 0; a < state.balls.length; a++)
        for (let b = a + 1; b < state.balls.length; b++)
          collide(state, state.balls[a], state.balls[b]);
    for (const b of state.balls) if (!b.potted) pocket(state, b);
  }
  let moving = false;
  for (const b of state.balls)
    if (!b.potted) {
      b.vx = trunc((b.vx * 994) / 1000);
      b.vy = trunc((b.vy * 994) / 1000);
      if (b.vx * b.vx + b.vy * b.vy < 256) {
        b.vx = b.vy = 0;
      } else moving = true;
    }
  if (moving && state.phaseTicks < BILLIARDS_RULES.maxFlightTicks) return;
  for (const b of state.balls) b.vx = b.vy = 0;
  if (state.scratch) respotCue(state);
  if (state.shotPots && !state.scratch) {
    state.streak++;
    state.score += Math.min(3, state.streak) * 100;
  } else state.streak = 0;
  if (state.balls.slice(1).every((b) => b.potted)) {
    state.score += 300 + state.shotsLeft * 30;
    state.phase = "settle";
    state.phaseTicks = 0;
    return;
  }
  if (state.shotsLeft === 0) {
    state.status = "failed";
    state.failure = "SHOTS_EXHAUSTED";
    return;
  }
  state.phase = "aim";
  state.phaseTicks = 0;
}
export function canApplyBilliards(state: BilliardsState, action: string) {
  if (
    state.status !== "running" ||
    state.phase !== "aim" ||
    !BILLIARDS_ACTIONS.includes(action)
  )
    return false;
  if (action.startsWith("AIM_")) return state.aim !== Number(action.slice(4));
  if (action.startsWith("POWER_"))
    return (
      state.power !==
      ["POWER_LOW", "POWER_MEDIUM", "POWER_HIGH"].indexOf(action)
    );
  return action === "SHOOT" && state.shotsLeft > 0;
}
export function applyBilliards(state: BilliardsState, action: string) {
  if (action.startsWith("AIM_")) {
    state.aim = Number(action.slice(4));
    return;
  }
  if (action.startsWith("POWER_")) {
    state.power = ["POWER_LOW", "POWER_MEDIUM", "POWER_HIGH"].indexOf(action);
    return;
  }
  const d = billiardsDirection(state.aim),
    cue = state.balls[0],
    speed = BILLIARDS_RULES.powers[state.power];
  cue.vx = roundDiv(d.x * speed, d.length);
  cue.vy = roundDiv(d.y * speed, d.length);
  state.shotsLeft--;
  state.totalShots++;
  state.phase = "moving";
  state.phaseTicks = 0;
  state.scratch = false;
  state.shotPots = 0;
}
/** Read-only forecast uses precisely the same step function, never another physics engine. */
export function forecastBilliards(
  state: BilliardsState,
  aim = state.aim,
  power = state.power,
  maxTicks = 1200,
) {
  const copy: BilliardsState = JSON.parse(JSON.stringify(state));
  copy.aim = aim;
  copy.power = power;
  applyBilliards(copy, "SHOOT");
  const path: { x: number; y: number }[] = [];
  let firstContact = false;
  while (copy.phase === "moving" && copy.phaseTicks < maxTicks) {
    stepBilliards(copy);
    if (copy.lastContactTick === copy.tick) firstContact = true;
    if (!firstContact && !copy.balls[0].potted && copy.phaseTicks % 4 === 0)
      path.push({ x: copy.balls[0].x, y: copy.balls[0].y });
  }
  return { state: copy, path };
}
export const BILLIARDS_CORE: GameCore<BilliardsState> = {
  gameId: "billiards",
  gameVersion: "1.0.0",
  width: 390,
  height: 620,
  tickRate: 120,
  maxFinalTick: 120 * 60 * 8,
  maxInputs: 6000,
  inputVersion: 1,
  actions: BILLIARDS_ACTIONS,
  content: {
    rules: BILLIARDS_RULES,
    physics: "integer-equal-mass-substep2-v1",
    scenario: "billiards1-layout-v1",
    pockets: BILLIARDS_POCKETS,
  },
  create: createBilliardsState,
  step: stepBilliards,
  canApply: canApplyBilliards,
  apply: applyBilliards,
};
