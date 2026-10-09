/** One original continuous arena; compose the immutable V1 integer physics. */
import { createRng } from "../deterministic/seeded";
import {
  BILLIARDS_CORE,
  BILLIARDS_RULES,
  createBilliardsState,
  stepBilliards,
  applyBilliards,
  canApplyBilliards,
  type BilliardsState,
  type PoolBall,
  type PoolBumper,
} from "./billiardsCore.v1";
import type { GameCore } from "./coreRuntime.v1";
import { BILLIARDS_AIM_COUNT } from "./billiardsProtocol.v1";

export const BILLIARDS_V2_RULES = {
  targets: 10,
  shots: 18,
  scorePerTarget: 1000,
  generator: "billiards2-one-arena-v1",
} as const;

// This is only V1's terminal branch marker, never a level or a rebuilt field.
const FIXED_ARENA_MARKER = BILLIARDS_RULES.levels - 1;
export type BilliardsV2State = BilliardsState & {
  height: number;
  lastAdvanceTick: number;
};

function stationaryBall(id: number, x: number, y: number): PoolBall {
  return { id, x, y, vx: 0, vy: 0, potted: false };
}

export function buildBilliardsArenaV2(seed: string) {
  const rng = createRng(`${seed}:billiards2:arena`);
  const mirror = rng.nextInt(2) === 1;
  const shift = (rng.nextInt(7) - 3) * 1000;
  const projectX = (x: number) => (mirror ? 390000 - x : x);
  const jitter = () => (rng.nextInt(17) - 8) * 1000;
  // The cue/first target retain V1's proven easy near-pocket opening geometry.
  // Remaining targets vary distance and contact angles on the same fixed table.
  const spots = [
    { x: 100000 + shift, y: 166000 + shift },
    { x: 300000 + jitter(), y: 169000 + jitter() },
    { x: 96000 + jitter(), y: 432000 + jitter() },
    { x: 303000 + jitter(), y: 425000 + jitter() },
    { x: 86000 + jitter(), y: 285000 + jitter() },
    { x: 307000 + jitter(), y: 322000 + jitter() },
    { x: 245000 + jitter(), y: 205000 + jitter() },
    { x: 145000 + jitter(), y: 386000 + jitter() },
    { x: 157000 + jitter(), y: 132000 + jitter() },
    { x: 241000 + jitter(), y: 461000 + jitter() },
  ];
  const pattern = rng.nextInt(3);
  const bumpers: PoolBumper[] = [];
  if (pattern !== 0)
    bumpers.push({
      x: projectX(195000 + jitter()),
      y: 220000 + jitter(),
      radius: 17000,
    });
  if (pattern !== 1)
    bumpers.push({
      x: projectX(195000 + jitter()),
      y: 405000 + jitter(),
      radius: 15000,
    });
  return {
    balls: [
      stationaryBall(0, projectX(216000 + shift), 314000 + shift),
      ...spots.map((spot, index) =>
        stationaryBall(index + 1, projectX(spot.x), spot.y),
      ),
    ],
    bumpers,
    aim: mirror ? 154 : 116,
  };
}

export function createBilliardsStateV2(seed: string): BilliardsV2State {
  const arena = buildBilliardsArenaV2(seed);
  return {
    ...createBilliardsState(seed),
    stage: FIXED_ARENA_MARKER,
    balls: arena.balls,
    bumpers: arena.bumpers,
    aim: arena.aim,
    power: 1,
    shotsLeft: BILLIARDS_V2_RULES.shots,
    height: 0,
    lastAdvanceTick: -1,
  };
}

function synchronizeReach(state: BilliardsV2State) {
  const potted = state.balls.reduce(
    (count, ball) => count + (ball.id !== 0 && ball.potted ? 1 : 0),
    0,
  );
  if (potted > state.height) state.lastAdvanceTick = state.tick;
  state.height = potted;
  // V1 physics never reads score; remove its scratch/streak/table rewards before
  // the common V2 driver can apply a signed target. Pots can never be repeated.
  state.score = state.height * BILLIARDS_V2_RULES.scorePerTarget;
}

export function stepBilliardsV2(state: BilliardsV2State) {
  stepBilliards(state);
  synchronizeReach(state);
}

export function applyBilliardsV2(state: BilliardsV2State, action: string) {
  applyBilliards(state, action);
  synchronizeReach(state);
}

/** Read-only prediction of this same V2 core, not a second physics integrator. */
export function forecastBilliardsV2(
  state: BilliardsV2State,
  aim = state.aim,
  power = state.power,
  maxTicks = BILLIARDS_RULES.maxFlightTicks,
) {
  if (
    state.status !== "running" ||
    state.phase !== "aim" ||
    state.shotsLeft <= 0
  )
    throw new Error("BILLIARDS_V2_FORECAST_ACTION_UNAVAILABLE");
  if (
    !Number.isInteger(aim) ||
    aim < 0 ||
    aim >= BILLIARDS_AIM_COUNT ||
    !Number.isInteger(power) ||
    power < 0 ||
    power >= BILLIARDS_RULES.powers.length ||
    !Number.isInteger(maxTicks) ||
    maxTicks < 0 ||
    maxTicks > BILLIARDS_RULES.maxFlightTicks
  )
    throw new Error("BILLIARDS_V2_FORECAST_ARGUMENTS_INVALID");
  const copy: BilliardsV2State = {
    ...state,
    balls: state.balls.map((ball) => ({ ...ball })),
    bumpers: state.bumpers.map((bumper) => ({ ...bumper })),
  };
  copy.aim = aim;
  copy.power = power;
  applyBilliardsV2(copy, "SHOOT");
  const path: { x: number; y: number }[] = [];
  let firstContact = false;
  while (
    copy.status === "running" &&
    copy.phase === "moving" &&
    copy.phaseTicks < maxTicks
  ) {
    stepBilliardsV2(copy);
    if (copy.lastContactTick === copy.tick) firstContact = true;
    if (!firstContact && !copy.balls[0].potted && copy.phaseTicks % 4 === 0)
      path.push({ x: copy.balls[0].x, y: copy.balls[0].y });
  }
  return { state: copy, path };
}

export const BILLIARDS_CORE_V2: GameCore<BilliardsV2State> = {
  ...BILLIARDS_CORE,
  gameVersion: "2.0.0",
  content: {
    inheritedPhysics: BILLIARDS_CORE.content,
    rules: BILLIARDS_V2_RULES,
    fixedArenaCompatibility:
      "v1-terminal-marker;no-stage-advance-no-layout-no-shot-refill",
    scoring:
      "1000-per-real-target-pot;monotonic-reach;no-scratch-streak-or-clear-bonus",
    progression:
      "same-visible-arena;near-pocket-opening-to-longer-or-obstructed-contact-lines;remaining-positions-preserved",
  },
  create: createBilliardsStateV2,
  step: stepBilliardsV2,
  canApply: canApplyBilliards,
  apply: applyBilliardsV2,
};
