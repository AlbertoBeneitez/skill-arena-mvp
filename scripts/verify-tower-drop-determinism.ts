import {
  createTowerDropState,
  dropTowerBlock,
  replayTowerDrop,
  stepTowerDrop,
  TOWER_DROP_V2,
  type TowerDropInput,
  type TowerDropState,
} from "../lib/verified/towerDropCore.v2";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function centre(block: { xMilli: number; wMilli: number }) {
  return block.xMilli + Math.floor(block.wMilli / 2);
}

// Read through helpers so TypeScript does not incorrectly retain a literal
// property narrowing across mutating simulation calls.
function statePhase(state: TowerDropState): TowerDropState["phase"] {
  return state.phase;
}

function stateStatus(state: TowerDropState): TowerDropState["status"] {
  return state.status;
}

function stateFailure(state: TowerDropState): TowerDropState["failure"] {
  return state.failure;
}

/**
 * Build a deterministic "skilled" input stream by releasing only when the
 * hanging block is almost centred over the current support. After four
 * successful floors, stop interacting and let the five-minute idle timeout
 * resolve the run.
 */
function buildGoldenRun() {
  const state = createTowerDropState();
  const inputs: TowerDropInput[] = [];
  const targetHeight = 4;
  let guard = 0;

  while (
    stateStatus(state) === "running" &&
    state.blocks.length - 1 < targetHeight &&
    guard < 100_000
  ) {
    if (statePhase(state) === "swing") {
      const top = state.blocks[state.blocks.length - 1];
      const moving = {
        xMilli: state.movingXMilli,
        wMilli: state.movingWMilli,
      };

      if (Math.abs(centre(moving) - centre(top)) <= 2_500) {
        inputs.push({
          seq: inputs.length,
          tick: state.tick,
          action: "DROP",
        });
        dropTowerBlock(state);
      }
    }

    if (stateStatus(state) === "running") {
      stepTowerDrop(state);
    }
    guard += 1;
  }

  assert(
    state.blocks.length - 1 === targetHeight,
    "golden builder did not stack four floors"
  );

  while (stateStatus(state) === "running" && guard < 200_000) {
    stepTowerDrop(state);
    guard += 1;
  }

  assert(stateStatus(state) === "failed", "golden run did not resolve");
  assert(
    stateFailure(state) === "TIMEOUT_IDLE",
    `golden run failed unexpectedly: ${state.failure}`
  );

  return {
    inputs,
    finalTick: state.tick,
    expected: {
      score: state.score,
      height: state.blocks.length - 1,
      failure: state.failure,
      timeMs: Math.round(
        (state.tick * 1000) / TOWER_DROP_V2.tickRate
      ),
    },
  };
}

const golden = buildGoldenRun();

const first = replayTowerDrop(
  golden.inputs,
  golden.finalTick
);
const second = replayTowerDrop(
  golden.inputs,
  golden.finalTick
);

assert(first.valid, `golden replay rejected: ${first.error ?? "unknown"}`);
assert(second.valid, `second replay rejected: ${second.error ?? "unknown"}`);
assert(first.score === golden.expected.score, "golden score changed during replay");
assert(first.height === golden.expected.height, "golden height changed during replay");
assert(first.failure === golden.expected.failure, "golden failure changed during replay");
assert(first.timeMs === golden.expected.timeMs, "golden time changed during replay");

assert(
  JSON.stringify(first.state) === JSON.stringify(second.state),
  "same v2 tick inputs did not produce identical state"
);

// Mechanical invariant: DROP releases into an accelerated fall.
const falling = createTowerDropState();
dropTowerBlock(falling);
assert(statePhase(falling) === "falling", "DROP did not release the pendulum load");
stepTowerDrop(falling);
const firstY = falling.fallYMilli;
const firstVelocity = falling.fallVYMilliPerSecond;

for (let index = 0; index < 20; index += 1) {
  stepTowerDrop(falling);
}

assert(
  falling.fallYMilli > firstY &&
    falling.fallVYMilliPerSecond > firstVelocity,
  "falling block did not accelerate under gravity"
);


// Mechanical invariant: release inherits horizontal pendulum momentum.
const momentum = createTowerDropState();
for (let index = 0; index < 24; index += 1) {
  stepTowerDrop(momentum);
}
const releaseX = momentum.movingXMilli;
const releaseVX = momentum.movingVXMilliPerSecond;
assert(
  Math.abs(releaseVX) > 0,
  "pendulum did not develop horizontal velocity"
);
dropTowerBlock(momentum);
const inheritedVX = momentum.fallVXMilliPerSecond;
assert(
  Math.abs(inheritedVX) > 0,
  "released block did not inherit pendulum momentum"
);
for (let index = 0; index < 12; index += 1) {
  stepTowerDrop(momentum);
}
assert(
  momentum.fallXMilli !== releaseX,
  "released block did not travel horizontally during fall"
);

// Mechanical invariant: partial support with centre of mass outside the
// support polygon must tip around the edge before failing.
const tipping = createTowerDropState();
tipping.phase = "falling";
tipping.fallXMilli = 1_000;
tipping.fallYMilli = TOWER_DROP_V2.dropDistanceMilli - 1;
tipping.fallVYMilliPerSecond = 200_000;
stepTowerDrop(tipping);

assert(
  statePhase(tipping) === "tipping-left",
  `expected left tip, got ${tipping.phase}`
);
assert(
  stateFailure(tipping) === "CENTER_OF_MASS",
  "tip did not mark centre-of-mass instability"
);

let tipGuard = 0;
while (stateStatus(tipping) === "running" && tipGuard < 1_000) {
  stepTowerDrop(tipping);
  tipGuard += 1;
}
assert(
  stateStatus(tipping) === "failed" &&
    stateFailure(tipping) === "CENTER_OF_MASS",
  "tipping block did not rotate to failure"
);

// Mechanical invariant: zero support falls away instead of snapping to tower.
const noSupport = createTowerDropState();
noSupport.phase = "falling";
noSupport.fallXMilli = 330_000;
noSupport.fallYMilli = TOWER_DROP_V2.dropDistanceMilli - 1;
noSupport.fallVYMilliPerSecond = 200_000;
stepTowerDrop(noSupport);

assert(
  statePhase(noSupport) === "falling-out",
  `expected falling-out, got ${noSupport.phase}`
);

let fallOutGuard = 0;
while (stateStatus(noSupport) === "running" && fallOutGuard < 1_000) {
  stepTowerDrop(noSupport);
  fallOutGuard += 1;
}
assert(
  stateStatus(noSupport) === "failed" &&
    stateFailure(noSupport) === "NO_SUPPORT",
  "unsupported block did not fall out"
);

function simulateRenderRate(frameHz: number) {
  const state = createTowerDropState();
  let inputIndex = 0;
  let accumulator = 0;
  const frameSeconds = 1 / frameHz;
  const tickSeconds = 1 / TOWER_DROP_V2.tickRate;
  let guard = 0;

  while (
    stateStatus(state) === "running" &&
    guard < 2_000_000
  ) {
    accumulator += frameSeconds;

    while (
      accumulator + 1e-12 >= tickSeconds &&
      stateStatus(state) === "running"
    ) {
      while (
        inputIndex < golden.inputs.length &&
        golden.inputs[inputIndex].tick === state.tick &&
        stateStatus(state) === "running"
      ) {
        assert(
          statePhase(state) === "swing",
          "render-rate simulation attempted DROP outside swing"
        );
        dropTowerBlock(state);
        inputIndex += 1;
      }

      if (state.status !== "running") break;
      stepTowerDrop(state);
      accumulator -= tickSeconds;
    }

    guard += 1;
  }

  return {
    tick: state.tick,
    score: state.score,
    height: state.blocks.length - 1,
    failure: state.failure,
    phase: state.phase,
  };
}

const render60 = simulateRenderRate(60);
const render120 = simulateRenderRate(120);
const render144 = simulateRenderRate(144);

assert(
  JSON.stringify(render60) === JSON.stringify(render120) &&
    JSON.stringify(render120) === JSON.stringify(render144),
  `render-rate equivalence failed: 60=${JSON.stringify(render60)} 120=${JSON.stringify(render120)} 144=${JSON.stringify(render144)}`
);

console.log(
  [
    "Tower Drop v2 deterministic replay OK",
    `score=${first.score}`,
    `height=${first.height}`,
    `finalTick=${golden.finalTick}`,
    "mechanics=pendulum+momentum+gravity+support+tip",
  ].join(" · ")
);
