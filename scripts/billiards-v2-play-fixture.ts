/** Test-only legal shot planning; every candidate executes the actual V2 core. */
import {
  BILLIARDS_POCKETS,
  BILLIARDS_RULES,
} from "../lib/verified/billiardsCore.v1";
import {
  BILLIARDS_CORE_V2 as core,
  forecastBilliardsV2,
  type BilliardsV2State,
} from "../lib/verified/billiardsCore.v2";
import { billiardsAimAction } from "../lib/verified/billiardsProtocol.v1";
import { applyCoreInput, stepCore } from "../lib/verified/coreRuntime.v1";
import type { ReplayInput } from "../lib/verified/inputValidation";

type Point = { x: number; y: number };
function segmentDistanceSquared(from: Point, to: Point, point: Point) {
  const dx = to.x - from.x,
    dy = to.y - from.y;
  const length = dx * dx + dy * dy;
  const t = length
    ? Math.max(
        0,
        Math.min(
          1,
          ((point.x - from.x) * dx + (point.y - from.y) * dy) / length,
        ),
      )
    : 0;
  return (point.x - from.x - t * dx) ** 2 + (point.y - from.y - t * dy) ** 2;
}

function directShotAngles(state: BilliardsV2State) {
  const cue = state.balls[0],
    candidates = new Set<number>();
  for (const target of state.balls.slice(1).filter((ball) => !ball.potted)) {
    for (const pocket of BILLIARDS_POCKETS) {
      const dx = pocket.x - target.x,
        dy = pocket.y - target.y;
      const length = Math.hypot(dx, dy);
      const ghost = {
        x: target.x - (20000 * dx) / length,
        y: target.y - (20000 * dy) / length,
      };
      if (
        ghost.x < 52000 ||
        ghost.x > 338000 ||
        ghost.y < 104000 ||
        ghost.y > 494000
      )
        continue;
      const pathClear = state.balls.every(
        (ball) =>
          ball.potted ||
          ball.id === 0 ||
          ball.id === target.id ||
          (segmentDistanceSquared(cue, ghost, ball) > 410000000 &&
            segmentDistanceSquared(target, pocket, ball) > 410000000),
      );
      if (
        !pathClear ||
        state.bumpers.some(
          (bumper) =>
            segmentDistanceSquared(cue, ghost, bumper) <=
              (bumper.radius + 10000) ** 2 ||
            segmentDistanceSquared(target, pocket, bumper) <=
              (bumper.radius + 10000) ** 2,
        )
      )
        continue;
      const angle =
        (Math.atan2(ghost.y - cue.y, ghost.x - cue.x) + Math.PI * 2) %
        (Math.PI * 2);
      const center = Math.round((angle * 180) / (Math.PI * 2));
      for (let offset = -2; offset <= 2; offset++)
        candidates.add((center + offset + 180) % 180);
    }
  }
  candidates.add(state.aim);
  return candidates;
}

export function chooseBilliardsShotV2(state: BilliardsV2State) {
  let best = { aim: state.aim, power: state.power, value: -Infinity, pots: 0 };
  const evaluated = new Set<string>();
  function evaluate(aim: number, power: number) {
    const key = `${aim}:${power}`;
    if (evaluated.has(key)) return;
    evaluated.add(key);
    const next = forecastBilliardsV2(state, aim, power).state;
    const pots = next.height - state.height;
    let value = pots * 1e9 - (next.scratch ? 3e7 : 0);
    for (const ball of next.balls.slice(1).filter((ball) => !ball.potted)) {
      const nearest = Math.min(
        ...BILLIARDS_POCKETS.map(
          (pocket) => (ball.x - pocket.x) ** 2 + (ball.y - pocket.y) ** 2,
        ),
      );
      value -= Math.floor(nearest / 100000);
    }
    if (next.lastContactTick < state.tick) value -= 1e6;
    const cue = next.balls[0];
    value += Math.min(
      10000,
      Math.floor(
        Math.min(cue.x - 42000, 348000 - cue.x, cue.y - 94000, 504000 - cue.y) /
          10,
      ),
    );
    if (value > best.value) best = { aim, power, value, pots };
  }
  for (const aim of directShotAngles(state))
    for (let power = 0; power < 3; power++) evaluate(aim, power);
  // A direct shot can be blocked: the actual core evaluates banks/combinations.
  if (best.pots === 0)
    for (let aim = 0; aim < 180; aim++)
      for (let power = 0; power < 3; power++) evaluate(aim, power);
  return { ...best, candidates: evaluated.size };
}

export function playBilliardsFixtureV2(
  seed: string,
  options: {
    idleTicks?: number;
    onShot?(
      state: BilliardsV2State,
      shot: ReturnType<typeof chooseBilliardsShotV2>,
    ): void;
    onTick?(state: BilliardsV2State): void;
  } = {},
) {
  const state = core.create(seed),
    inputs: ReplayInput[] = [];
  const target = 1e9;
  function step() {
    stepCore(core, state, target);
    options.onTick?.(state);
  }
  function send(action: string) {
    if (!core.canApply(state, action)) return;
    inputs.push({ seq: inputs.length, tick: state.tick, action });
    if (!applyCoreInput(core, state, action, target))
      throw new Error("BILLIARDS_FIXTURE_ACTION_REJECTED");
    options.onTick?.(state);
    step();
  }
  while (state.status === "running") {
    if (state.phase === "aim") {
      const shot = chooseBilliardsShotV2(state);
      options.onShot?.(state, shot);
      for (let idle = 0; idle < (options.idleTicks ?? 0); idle++) step();
      send(billiardsAimAction(shot.aim));
      send(["POWER_LOW", "POWER_MEDIUM", "POWER_HIGH"][shot.power]);
      send("SHOOT");
    } else step();
  }
  return { state, inputs };
}
