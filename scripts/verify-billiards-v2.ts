import assert from "node:assert/strict";
import {
  BILLIARDS_CORE_V2 as core,
  BILLIARDS_V2_RULES,
  forecastBilliardsV2,
  type BilliardsV2State,
} from "../lib/verified/billiardsCore.v2";
import {
  BILLIARDS_RULES,
  BILLIARDS_POCKETS,
  stepBilliards,
  applyBilliards,
  type BilliardsState,
} from "../lib/verified/billiardsCore.v1";
import { billiardsAimAction } from "../lib/verified/billiardsProtocol.v1";
import {
  advanceCoreToTick,
  applyCoreInput,
  replayCore,
  stepCore,
} from "../lib/verified/coreRuntime.v1";
import { canonicalJson } from "../lib/verified/canonical";
import { generateScenario } from "../lib/server/scenarios";
import { sha256 } from "../lib/server/matchIntegrity";
import { verifyCoreFixture } from "./core-test-utils";
import fixture from "./fixtures/billiards-v2.json" with { type: "json" };
import courseFixtures from "./fixtures/billiards-v2-courses.json" with { type: "json" };

const target = 1e9;
verifyCoreFixture(
  core,
  fixture.seed,
  fixture.inputs,
  fixture.finalTick,
  target,
  {
    score: fixture.score,
    status: "won",
    failure: null,
    hash: fixture.hash,
  },
);
const golden = replayCore(
  core,
  fixture.inputs,
  fixture.finalTick,
  fixture.seed,
  target,
);
assert.equal(golden.height, fixture.height);
assert.equal(golden.state.totalShots, fixture.totalShots);
assert.equal(golden.state.stage, 4);
assert.equal(golden.state.shotsLeft, 18 - golden.state.totalShots);

const geometries = new Set<string>();
const bumperKinds = new Set<number>();
for (let index = 0; index < 1000; index++) {
  const seed = generateScenario(
    { game_id: "billiards", game_version: "2.0.0" },
    index,
  ).seed;
  const state = core.create(seed);
  assert.deepEqual(core.create(seed), state, `seed${index} reproducible`);
  assert.equal(state.balls.length, 11);
  assert.deepEqual(
    state.balls.map((ball) => ball.id),
    Array.from({ length: 11 }, (_, i) => i),
  );
  assert.equal(state.shotsLeft, 18);
  assert.equal(state.totalShots, 0);
  assert.equal(state.stage, 4);
  assert.equal(state.height, 0);
  assert.equal(state.score, 0);
  assert.equal(state.phase, "aim");
  bumperKinds.add(state.bumpers.length);
  // Actual positions and obstacles, excluding seed/IDs/metrics, prove variety.
  geometries.add(
    canonicalJson({
      balls: state.balls.map((ball) => [ball.x, ball.y]),
      bumpers: state.bumpers,
    }),
  );
  for (let a = 0; a < state.balls.length; a++) {
    const ball = state.balls[a];
    assert.ok(
      ball.x >= 52000 &&
        ball.x <= 338000 &&
        ball.y >= 104000 &&
        ball.y <= 494000,
      "inside bands",
    );
    assert.equal(ball.vx, 0);
    assert.equal(ball.vy, 0);
    assert.equal(ball.potted, false);
    assert.ok(
      BILLIARDS_POCKETS.every(
        (pocket) =>
          (ball.x - pocket.x) ** 2 + (ball.y - pocket.y) ** 2 > 21000 ** 2,
      ),
      "nothing begins potted",
    );
    assert.ok(
      state.bumpers.every(
        (bumper) =>
          (ball.x - bumper.x) ** 2 + (ball.y - bumper.y) ** 2 >
          (bumper.radius + 10000) ** 2,
      ),
      "nothing begins inside bumper",
    );
    for (let b = a + 1; b < state.balls.length; b++)
      assert.ok(
        (ball.x - state.balls[b].x) ** 2 + (ball.y - state.balls[b].y) ** 2 >
          20000 ** 2,
        "initial balls do not overlap",
      );
  }
  if (index < 128) {
    const before = canonicalJson(state);
    const opening = forecastBilliardsV2(state).state;
    assert.ok(opening.height >= 1, `guided near-pocket opening${index}`);
    assert.equal(opening.scratch, false);
    assert.equal(
      canonicalJson(state),
      before,
      "prediction cannot mutate current arena",
    );
    assert.equal(opening.stage, 4);
    assert.equal(opening.shotsLeft, 17);
  }
}
assert.equal(geometries.size, 1000);
assert.deepEqual([...bumperKinds].sort(), [1, 2]);

const fullRuns: { shots: number; tick: number }[] = [];
// These traces were planned through real V2 physics once. CI validates every
// complete course without repeating an expensive 180-angle shot search.
const courses = [...courseFixtures, { ...fixture, scenarioIndex: 7 }].sort(
  (a, b) => a.scenarioIndex - b.scenarioIndex,
);
assert.deepEqual(
  courses.map((course) => course.scenarioIndex),
  Array.from({ length: 16 }, (_, i) => i),
);
for (const course of courses) {
  const index = course.scenarioIndex;
  const seed = generateScenario(
    { game_id: "billiards", game_version: "2.0.0" },
    index,
  ).seed;
  assert.equal(course.seed, seed, "frozen course binds generator and version");
  let ballArray: BilliardsV2State["balls"] | undefined;
  let bumperArray: BilliardsV2State["bumpers"] | undefined;
  let objects: BilliardsV2State["balls"] | undefined;
  let potted = new Set<number>();
  let lastHeight = 0;
  let lastShots = 0;
  let movingToAim = 0;
  let lastPhase: BilliardsV2State["phase"] = "aim";
  const state = core.create(seed);
  function observe() {
    ballArray ??= state.balls;
    bumperArray ??= state.bumpers;
    objects ??= [...state.balls];
    assert.strictEqual(
      state.balls,
      ballArray,
      "zero arena rebuilds across movement/aim/settle",
    );
    assert.strictEqual(state.bumpers, bumperArray);
    state.balls.forEach((ball, i) =>
      assert.strictEqual(
        ball,
        objects![i],
        "ball identity stays stable; only scratch respots cue position",
      ),
    );
    assert.equal(state.balls.length, 11);
    assert.equal(state.stage, 4, "terminal marker never advances");
    assert.equal(
      state.shotsLeft,
      18 - state.totalShots,
      "single budget, no refill",
    );
    assert.ok(state.totalShots >= lastShots && state.totalShots <= 18);
    assert.ok(state.height >= lastHeight && state.height <= 10);
    assert.equal(
      state.height,
      state.balls.filter((ball) => ball.id > 0 && ball.potted).length,
    );
    assert.equal(
      state.score,
      state.height * 1000,
      "no old scratch/streak/clear reward escapes wrapper",
    );
    for (const id of potted)
      assert.equal(
        state.balls[id].potted,
        true,
        "potted targets never regenerate",
      );
    potted = new Set(
      state.balls
        .filter((ball) => ball.id > 0 && ball.potted)
        .map((ball) => ball.id),
    );
    if (lastPhase === "moving" && state.phase === "aim") movingToAim++;
    lastPhase = state.phase;
    lastHeight = state.height;
    lastShots = state.totalShots;
  }
  observe();
  for (const input of course.inputs) {
    advanceCoreToTick(core, state, input.tick, target, observe);
    assert.equal(state.tick, input.tick);
    observe();
    assert.equal(
      applyCoreInput(core, state, input.action, target),
      true,
      "prepared trace action remains legal",
    );
    observe();
  }
  advanceCoreToTick(core, state, course.finalTick, target, observe);
  observe();
  const played = { state, inputs: course.inputs };
  assert.equal(
    played.state.status,
    "won",
    `natural complete course${index}:height${played.state.height},shots${played.state.totalShots}`,
  );
  assert.equal(played.state.height, 10);
  assert.equal(played.state.score, 10000);
  assert.equal(played.state.phase, "settle");
  assert.equal(played.state.phaseTicks, 72);
  assert.equal(
    played.state.lastStageTick,
    -100,
    "historical stage transition was never executed",
  );
  assert.ok(movingToAim > 0);
  const replay = replayCore(
    core,
    played.inputs,
    played.state.tick,
    seed,
    target,
  );
  assert.equal(
    replay.valid,
    true,
    replay.error ?? "Invalid full course replay",
  );
  assert.deepEqual(replay.state, played.state);
  assert.equal(played.state.tick, course.finalTick);
  assert.equal(played.state.totalShots, course.totalShots);
  assert.equal(
    sha256(canonicalJson(played.state)),
    course.hash,
    "complete-course state is frozen",
  );
  fullRuns.push({ shots: played.state.totalShots, tick: played.state.tick });
  console.log(
    `Billar V2 course${index} won ${played.state.totalShots}/18 shots · tick${played.state.tick}`,
  );
}

// Compare every physics field against the unmodified V1 kernel on V2 geometry.
const physics = core.create(fixture.seed);
const historical: BilliardsState = structuredClone(physics);
function withoutMetrics(state: BilliardsState) {
  const result = { ...state } as Record<string, unknown>;
  delete result.score;
  delete result.height;
  delete result.lastAdvanceTick;
  return result;
}
let physicsShots = 0;
for (const input of fixture.inputs) {
  while (physics.tick < input.tick) {
    stepCore(core, physics, target);
    stepBilliards(historical);
    assert.deepEqual(
      withoutMetrics(physics),
      withoutMetrics(historical),
      "exact position/velocity/collision/phase parity",
    );
  }
  assert.equal(applyCoreInput(core, physics, input.action, target), true);
  applyBilliards(historical, input.action);
  assert.deepEqual(withoutMetrics(physics), withoutMetrics(historical));
  if (input.action === "SHOOT") {
    assert.equal(
      core.canApply(physics, "SHOOT"),
      false,
      "double shot unavailable during flight",
    );
    assert.equal(core.canApply(physics, "AIM_002"), false);
    physicsShots++;
    if (physicsShots === 4) break;
  }
}
while (physics.status === "running" && physics.phase === "moving") {
  stepCore(core, physics, target);
  stepBilliards(historical);
  assert.deepEqual(
    withoutMetrics(physics),
    withoutMetrics(historical),
    "exact position/velocity/collision/phase parity",
  );
}

// Synthetic unit vectors isolate collision physics, not complete-course proof.
const collision = core.create("frontal-collision");
collision.balls.slice(2).forEach((ball) => {
  ball.potted = true;
});
Object.assign(collision.balls[0], { x: 195000, y: 350000, vx: 0, vy: -2400 });
Object.assign(collision.balls[1], { x: 195000, y: 310000, vx: 0, vy: 0 });
collision.bumpers = [];
collision.phase = "moving";
collision.shotsLeft = 17;
collision.totalShots = 1;
for (let tick = 0; tick < 25; tick++) stepCore(core, collision, target);
assert.ok(collision.balls[1].vy < 0);
assert.ok(Math.abs(collision.balls[0].vy) < 100);
const band = core.create("band-reflection");
Object.assign(band.balls[0], { x: 337000, y: 200000, vx: 2400, vy: 0 });
band.phase = "moving";
stepCore(core, band, target);
assert.ok(band.balls[0].vx < 0);
const friction = core.create("friction");
Object.assign(friction.balls[0], { x: 195000, y: 350000, vx: 2400, vy: 0 });
friction.phase = "moving";
friction.balls.slice(1).forEach((ball) => {
  ball.potted = true;
});
friction.bumpers = [];
stepCore(core, friction, target);
assert.equal(friction.balls[0].vx, 2385);

const scratch = core.create("scratch-keeps-reach");
scratch.balls.slice(2).forEach((ball) => {
  ball.potted = true;
});
Object.assign(scratch.balls[0], { x: 44000, y: 97000 });
scratch.height = 9;
scratch.score = 9000;
scratch.phase = "moving";
scratch.shotsLeft = 17;
scratch.totalShots = 1;
const scratchTargets = scratch.balls.slice(1).map((ball) => ({ ...ball }));
stepCore(core, scratch, target);
assert.equal(scratch.scratch, true);
assert.equal(
  scratch.balls[0].potted,
  false,
  "safe cue respot happens once at rest",
);
assert.equal(scratch.height, 9);
assert.equal(scratch.score, 9000, "scratch cannot erase already achieved pots");
assert.equal(scratch.shotsLeft, 17);
assert.deepEqual(scratch.balls.slice(1), scratchTargets);
assert.ok(
  scratch.bumpers.every(
    (bumper) =>
      (scratch.balls[0].x - bumper.x) ** 2 +
        (scratch.balls[0].y - bumper.y) ** 2 >=
      (bumper.radius + 12000) ** 2,
  ),
);

const last = core.create("last-target-last-shot");
last.balls.slice(1, 10).forEach((ball) => {
  ball.potted = true;
});
Object.assign(last.balls[10], { x: 44000, y: 299000 });
last.height = 9;
last.score = 9000;
last.shotsLeft = 0;
last.totalShots = 18;
last.phase = "moving";
const lastBallArray = last.balls;
stepCore(core, last, target);
assert.equal(last.phase, "settle", "last target wins over exhausted budget");
assert.equal(last.status, "running");
assert.equal(last.score, 10000, "no legacy clear bonus");
assert.equal(last.height, 10);
assert.equal(last.phaseTicks, 0);
for (let tick = 0; tick < 71; tick++) stepCore(core, last, target);
assert.equal(last.status, "running");
assert.equal(core.canApply(last, "SHOOT"), false);
stepCore(core, last, target);
assert.equal(last.status, "won");
assert.equal(last.stage, 4);
assert.strictEqual(last.balls, lastBallArray);
assert.equal(last.score, 10000);
assert.equal(last.shotsLeft, 0);

const exhausted = core.create("shot-budget-loss");
const exhaustedInputs = [];
while (exhausted.status === "running") {
  if (exhausted.phase === "aim") {
    const nextAim = exhausted.aim === 0 ? "AIM_090" : "AIM_000";
    for (const action of [nextAim, "POWER_LOW", "SHOOT"])
      if (core.canApply(exhausted, action)) {
        exhaustedInputs.push({
          seq: exhaustedInputs.length,
          tick: exhausted.tick,
          action,
        });
        assert.equal(applyCoreInput(core, exhausted, action, target), true);
        stepCore(core, exhausted, target);
      }
  } else stepCore(core, exhausted, target);
}
assert.equal(exhausted.failure, "SHOTS_EXHAUSTED");
assert.equal(exhausted.totalShots, 18);
assert.equal(exhausted.shotsLeft, 0);
assert.equal(
  replayCore(core, exhaustedInputs, exhausted.tick, "shot-budget-loss", target)
    .valid,
  true,
);
const idle = core.create("aim-idle-loss");
for (let tick = 0; tick < BILLIARDS_RULES.aimIdleTicks; tick++)
  stepCore(core, idle, target);
assert.equal(idle.failure, "AIM_TIMEOUT");
assert.equal(idle.height, 0);
assert.equal(
  replayCore(core, [], idle.tick, "aim-idle-loss", target).valid,
  true,
);

for (const action of ["AIM_180", "AIM_-01", "AIM_1", "POWER_SUPER"])
  assert.equal(
    replayCore(
      core,
      [{ seq: 0, tick: 0, action }],
      0,
      "invalid-protocol",
      target,
    ).error,
    "INVALID_INPUT",
  );
assert.equal(
  replayCore(
    core,
    [
      { seq: 0, tick: 0, action: "SHOOT" },
      { seq: 1, tick: 1, action: "SHOOT" },
    ],
    1,
    "double-shot",
    target,
  ).error,
  "ACTION_NOT_AVAILABLE",
);
const unchangedAim = core.create("same-aim").aim;
assert.equal(
  replayCore(
    core,
    [{ seq: 0, tick: 0, action: billiardsAimAction(unchangedAim) }],
    0,
    "same-aim",
    target,
  ).error,
  "ACTION_NOT_AVAILABLE",
);
assert.equal(
  replayCore(core, [], 0, "prefix", target).error,
  "CLIENT_ENDED_BEFORE_RESOLUTION",
);

const signed = core.create("signed-target-preserved");
const signedInputs = [{ seq: 0, tick: 0, action: "SHOOT" }];
assert.equal(applyCoreInput(core, signed, "SHOOT", 500), true);
while (signed.status === "running") stepCore(core, signed, 500);
assert.equal(
  signed.status,
  "won",
  "signed target still belongs to shared driver",
);
assert.ok(signed.height >= 1);
assert.equal(signed.score, signed.height * 1000);
assert.equal(
  replayCore(core, signedInputs, signed.tick, "signed-target-preserved", 500)
    .valid,
  true,
);
assert.equal(BILLIARDS_V2_RULES.shots, 18);
const forecastInput = core.create("prediction-bounds");
for (const [aim, power, ticks] of [
  [-1, 1, 1200],
  [180, 1, 1200],
  [0, -1, 1200],
  [0, 3, 1200],
  [0, 1, 1201],
  [0, 1, 0.5],
])
  assert.throws(
    () => forecastBilliardsV2(forecastInput, aim, power, ticks),
    /FORECAST_ARGUMENTS_INVALID/,
  );
applyCoreInput(core, forecastInput, "SHOOT", target);
assert.throws(
  () => forecastBilliardsV2(forecastInput),
  /FORECAST_ACTION_UNAVAILABLE/,
  "prediction cannot invent a double shot",
);

console.log(
  `Billar V2: 1000 actual geometries, 128 protected opening shots, 16 natural ten-ball clears within18shots, single arena/budget, immutable forecast, exact V1 physics parity, monotonic reach/no old rewards, collision/bands/friction/scratch/final-budget/loss/idle/input/replay; shots ${fullRuns.map((run) => run.shots).join(",")}`,
);
