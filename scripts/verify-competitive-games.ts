import { createHash } from "node:crypto";
import { canonicalJson } from "../lib/verified/canonical";
import {
  createPrecisionStackState,
  dropPrecisionStack,
  PRECISION_STACK_V1,
  replayPrecisionStack,
  stepPrecisionStack,
  type PrecisionStackInput,
  type PrecisionStackState,
} from "../lib/verified/precisionStackCore.v1";
import {
  createPrecisionStackState as createPrecisionStackStateV2,
  dropPrecisionStack as dropPrecisionStackV2,
  precisionStackPerfectToleranceForLevel,
  precisionStackSpeedForLevel,
  PRECISION_STACK_V2,
  replayPrecisionStack as replayPrecisionStackV2,
  stepPrecisionStack as stepPrecisionStackV2,
  type PrecisionStackInput as PrecisionStackInputV2,
  type PrecisionStackState as PrecisionStackStateV2,
} from "../lib/verified/precisionStackCore.v2";
import {
  createPianoRushState,
  PIANO_RUSH_V1,
  replayPianoRush,
  stepPianoRush,
  tapPianoRush,
  type PianoRushInput,
  type PianoRushState,
} from "../lib/verified/pianoRushCore.v1";
import {
  createJetStreamState,
  flapJetStream,
  JET_STREAM_V1,
  replayJetStream,
  stepJetStream,
  type JetStreamInput,
  type JetStreamState,
} from "../lib/verified/jetStreamCore.v1";
import {
  applyDinoDashInput,
  createDinoDashState,
  DINO_DASH_V1,
  replayDinoDash,
  stepDinoDash,
  type DinoDashInput,
  type DinoDashState,
} from "../lib/verified/dinoDashCore.v1";
import {
  applyPulseRunnerInput,
  createPulseRunnerState,
  isPulseRunnerGrounded,
  PULSE_RUNNER_V1,
  replayPulseRunner,
  stepPulseRunner,
  type PulseRunnerInput,
  type PulseRunnerState,
} from "../lib/verified/pulseRunnerCore.v1";
import { validateInputSequence } from "../lib/verified/inputValidation";
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
// Use a narrow left-side support so a physically valid in-bounds falling
// block can have zero overlap even with wall collision enabled.
noSupport.blocks = [{ xMilli: 8_000, wMilli: 82_000 }];
noSupport.phase = "falling";
noSupport.fallXMilli =
  TOWER_DROP_V2.widthMilli -
  TOWER_DROP_V2.edgePaddingMilli -
  noSupport.movingWMilli;
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

const towerReplayFixture = {
  manifestHash: "sha256:tower-drop-golden-manifest",
  attemptId: "tower-drop-golden-attempt",
  inputs: golden.inputs,
  finalTick: golden.finalTick,
  result: {
    score: first.score,
    timeMs: first.timeMs,
    won: first.state.status === "won",
    height: first.height,
    failure: first.failure,
  },
};
const towerReplayHash =
  "sha256:" +
  createHash("sha256")
    .update(canonicalJson(towerReplayFixture))
    .digest("hex");

console.log(
  [
    "Tower Drop v2 deterministic replay OK",
    `score=${first.score}`,
    `height=${first.height}`,
    `finalTick=${golden.finalTick}`,
    "mechanics=pendulum+momentum+gravity+support+tip",
    `replayHash=${towerReplayHash}`,
    `inputs=${JSON.stringify(golden.inputs)}`,
  ].join(" · ")
);


function precisionStatus(
  state: PrecisionStackState
): PrecisionStackState["status"] {
  return state.status;
}

const precisionGolden = {
  seed: "precision-stack-golden-v1",
  targetScore: 6_000,
  inputs: [
    { seq: 0, tick: 59, action: "DROP" },
    { seq: 1, tick: 144, action: "DROP" },
    { seq: 2, tick: 224, action: "DROP" },
    { seq: 3, tick: 301, action: "DROP" },
  ] satisfies PrecisionStackInput[],
  finalTick: 301,
  expected: {
    score: 7_029,
    height: 4,
    failure: null,
    timeMs: 2_508,
    status: "won" as const,
    replayHash:
      "sha256:829fb3340aed7dd8b5b00f7b47f5096bd319988527833edb895fc19734126e3d",
  },
};

const precisionFirst = replayPrecisionStack(
  precisionGolden.inputs,
  precisionGolden.finalTick,
  precisionGolden.seed,
  precisionGolden.targetScore
);
const precisionSecond = replayPrecisionStack(
  precisionGolden.inputs,
  precisionGolden.finalTick,
  precisionGolden.seed,
  precisionGolden.targetScore
);

assert(
  precisionFirst.valid && precisionSecond.valid,
  "precision golden replay rejected"
);
assert(
  JSON.stringify(precisionFirst.state) ===
    JSON.stringify(precisionSecond.state),
  "precision replay diverged across identical runs"
);


// Precision Stack placement invariants protect the competitive feel from
// accidental UI-driven rule changes.
const perfectPlacement = createPrecisionStackState("precision-perfect-v1");
const perfectTop =
  perfectPlacement.blocks[perfectPlacement.blocks.length - 1];
perfectPlacement.movingXMilli = perfectTop.xMilli;
perfectPlacement.movingWMilli = perfectTop.wMilli;
dropPrecisionStack(perfectPlacement, "precision-perfect-v1");
assert(
  perfectPlacement.lastPlacement?.perfect === true,
  "centred stack placement was not classified as perfect"
);
assert(
  perfectPlacement.blocks[perfectPlacement.blocks.length - 1]?.wMilli === perfectTop.wMilli,
  "perfect placement unexpectedly reduced module width"
);
assert(
  perfectPlacement.lastPlacement?.scoreDelta === 1_700,
  "first perfect placement scoring changed"
);

const nearPlacement = createPrecisionStackState("precision-near-v1");
const nearTop = nearPlacement.blocks[nearPlacement.blocks.length - 1];
nearPlacement.movingXMilli =
  nearTop.xMilli + PRECISION_STACK_V1.perfectToleranceMilli + 1_000;
nearPlacement.movingWMilli = nearTop.wMilli;
dropPrecisionStack(nearPlacement, "precision-near-v1");
assert(
  nearPlacement.lastPlacement?.perfect === false,
  "outside-tolerance placement incorrectly snapped to perfect"
);
assert(
  (nearPlacement.blocks[nearPlacement.blocks.length - 1]?.wMilli ?? nearTop.wMilli) <
    nearTop.wMilli,
  "imperfect placement did not clip the overlapping module"
);

const missedPlacement = createPrecisionStackState("precision-miss-v1");
missedPlacement.blocks = [{ xMilli: 170_000, wMilli: 40_000 }];
missedPlacement.movingXMilli = 10_000;
missedPlacement.movingWMilli = 60_000;
missedPlacement.phase = "moving";
dropPrecisionStack(missedPlacement, "precision-miss-v1");
assert(
  precisionStatus(missedPlacement) === "failed" &&
    missedPlacement.failure === "NO_OVERLAP",
  "zero-overlap placement did not terminate as a clear miss"
);
assert(
  precisionFirst.score === precisionGolden.expected.score &&
    precisionFirst.height === precisionGolden.expected.height &&
    precisionFirst.failure === precisionGolden.expected.failure &&
    precisionFirst.timeMs === precisionGolden.expected.timeMs,
  "precision golden result changed during replay"
);

function simulatePrecisionRenderRate(frameHz: number) {
  const state = createPrecisionStackState(
    precisionGolden.seed
  );
  let inputIndex = 0;
  let accumulator = 0;
  const frameSeconds = 1 / frameHz;
  const tickSeconds = 1 / PRECISION_STACK_V1.tickRate;
  let guard = 0;

  while (
    precisionStatus(state) === "running" &&
    guard < 1_000_000
  ) {
    accumulator += frameSeconds;

    while (
      accumulator + 1e-12 >= tickSeconds &&
      precisionStatus(state) === "running"
    ) {
      while (
        inputIndex < precisionGolden.inputs.length &&
        precisionGolden.inputs[inputIndex].tick === state.tick
      ) {
        assert(
          state.phase === "moving",
          "precision render-rate replay dropped while settling"
        );
        dropPrecisionStack(
          state,
          precisionGolden.seed,
          precisionGolden.targetScore
        );
        inputIndex += 1;
      }

      if (precisionStatus(state) !== "running") break;
      stepPrecisionStack(
        state,
        precisionGolden.seed,
        precisionGolden.targetScore
      );
      accumulator -= tickSeconds;
    }

    guard += 1;
  }

  return {
    tick: state.tick,
    score: state.score,
    height: state.blocks.length - 1,
    failure: state.failure,
    status: state.status,
  };
}

const precision60 = simulatePrecisionRenderRate(60);
const precision120 = simulatePrecisionRenderRate(120);
const precision144 = simulatePrecisionRenderRate(144);

assert(
  JSON.stringify(precision60) === JSON.stringify(precision120) &&
    JSON.stringify(precision120) === JSON.stringify(precision144),
  "precision render-rate equivalence failed"
);

// Shared input protocol regression cases.
const protocol = {
  version: 1,
  allowedActions: ["DROP"] as const,
  maxInputs: 3,
  maxFinalTick: 100,
};

assert(
  validateInputSequence(
    [{ seq: 1, tick: 2, action: "DROP" }],
    10,
    protocol
  ) === "INVALID_INPUT",
  "invalid seq was accepted"
);
assert(
  validateInputSequence(
    [
      { seq: 0, tick: 2, action: "DROP" },
      { seq: 1, tick: 2, action: "DROP" },
    ],
    10,
    protocol
  ) === "INVALID_INPUT_SEQUENCE",
  "repeated tick was accepted"
);
assert(
  validateInputSequence(
    [{ seq: 0, tick: 11, action: "DROP" }],
    10,
    protocol
  ) === "INPUT_AFTER_FINAL",
  "input after final tick was accepted"
);
assert(
  validateInputSequence(
    [{ seq: 0, tick: 2, action: "JUMP" }],
    10,
    protocol
  ) === "INVALID_INPUT",
  "invalid action was accepted"
);
assert(
  validateInputSequence(
    [
      { seq: 0, tick: 1, action: "DROP" },
      { seq: 1, tick: 2, action: "DROP" },
      { seq: 2, tick: 3, action: "DROP" },
      { seq: 3, tick: 4, action: "DROP" },
    ],
    10,
    protocol
  ) === "PAYLOAD_TOO_LARGE",
  "oversized input stream was accepted"
);

const precisionReplayFixture = {
  manifestHash: "sha256:precision-stack-golden-manifest",
  attemptId: "precision-stack-golden-attempt",
  inputs: precisionGolden.inputs,
  finalTick: precisionGolden.finalTick,
  result: {
    score: precisionFirst.score,
    timeMs: precisionFirst.timeMs,
    won: precisionFirst.state.status === "won",
    height: precisionFirst.height,
    failure: precisionFirst.failure,
  },
};
const precisionReplayHash =
  "sha256:" +
  createHash("sha256")
    .update(canonicalJson(precisionReplayFixture))
    .digest("hex");

assert(
  precisionReplayHash === precisionGolden.expected.replayHash,
  "precision golden replay hash changed"
);

console.log(
  [
    "Precision Stack v1 deterministic replay OK",
    `score=${precisionFirst.score}`,
    `height=${precisionFirst.height}`,
    `finalTick=${precisionGolden.finalTick}`,
    `replayHash=${precisionReplayHash}`,
  ].join(" · ")
);



function precisionV2Status(
  state: PrecisionStackStateV2
): PrecisionStackStateV2["status"] {
  return state.status;
}

function buildPrecisionV2Golden() {
  const seed = "precision-stack-golden-v2";
  const targetScore = 7_000;
  const state = createPrecisionStackStateV2(seed);
  const inputs: PrecisionStackInputV2[] = [];
  let guard = 0;

  while (
    precisionV2Status(state) === "running" &&
    guard < 100_000
  ) {
    if (state.phase === "moving") {
      const top = state.blocks[state.blocks.length - 1];
      if (
        Math.abs(centre({
          xMilli: state.movingXMilli,
          wMilli: state.movingWMilli,
        }) - centre(top)) <= 1_000
      ) {
        inputs.push({
          seq: inputs.length,
          tick: state.tick,
          action: "DROP",
        });
        dropPrecisionStackV2(state, seed, targetScore);
      }
    }

    if (precisionV2Status(state) === "running") {
      stepPrecisionStackV2(state, seed, targetScore);
    }
    guard += 1;
  }

  assert(
    precisionV2Status(state) === "won",
    `precision v2 golden did not win: status=${state.status} failure=${state.failure}`
  );

  return {
    seed,
    targetScore,
    inputs,
    finalTick: state.tick,
    expected: {
      score: 8_742,
      height: 5,
      failure: null,
      timeMs: 2_750,
      finalTick: 330,
      inputCount: 5,
      replayHash:
        "sha256:296213a185ec8e6de17ae4305913dbe94d070d4f37851f6be48d54c85f2bf472",
    },
  };
}

const precisionV2Golden = buildPrecisionV2Golden();
const precisionV2First = replayPrecisionStackV2(
  precisionV2Golden.inputs,
  precisionV2Golden.finalTick,
  precisionV2Golden.seed,
  precisionV2Golden.targetScore
);
const precisionV2Second = replayPrecisionStackV2(
  precisionV2Golden.inputs,
  precisionV2Golden.finalTick,
  precisionV2Golden.seed,
  precisionV2Golden.targetScore
);

assert(
  precisionV2First.valid && precisionV2Second.valid,
  "precision v2 golden replay rejected"
);
assert(
  JSON.stringify(precisionV2First.state) ===
    JSON.stringify(precisionV2Second.state),
  "precision v2 replay diverged across identical runs"
);
assert(
  precisionV2First.score === precisionV2Golden.expected.score &&
    precisionV2First.height === precisionV2Golden.expected.height &&
    precisionV2First.failure === precisionV2Golden.expected.failure &&
    precisionV2First.timeMs === precisionV2Golden.expected.timeMs &&
    precisionV2Golden.finalTick === precisionV2Golden.expected.finalTick &&
    precisionV2Golden.inputs.length ===
      precisionV2Golden.expected.inputCount,
  "precision v2 golden result changed during replay"
);

assert(
  precisionStackSpeedForLevel(1) ===
    PRECISION_STACK_V2.initialSpeedMilliPerSecond,
  "precision v2 opening speed drifted"
);
assert(
  precisionStackSpeedForLevel(40) ===
    PRECISION_STACK_V2.maxSpeedMilliPerSecond,
  "precision v2 speed cap drifted"
);
assert(
  precisionStackPerfectToleranceForLevel(1) ===
    PRECISION_STACK_V2.initialPerfectToleranceMilli &&
    precisionStackPerfectToleranceForLevel(100) ===
      PRECISION_STACK_V2.minimumPerfectToleranceMilli,
  "precision v2 adaptive perfect window drifted"
);

const precisionV2Perfect =
  createPrecisionStackStateV2("precision-perfect-v2");
const precisionV2PerfectTop =
  precisionV2Perfect.blocks[precisionV2Perfect.blocks.length - 1];
precisionV2Perfect.movingXMilli = precisionV2PerfectTop.xMilli;
precisionV2Perfect.movingWMilli = precisionV2PerfectTop.wMilli;
dropPrecisionStackV2(
  precisionV2Perfect,
  "precision-perfect-v2"
);
assert(
  precisionV2Perfect.lastPlacement?.perfect === true &&
    precisionV2Perfect.blocks[
      precisionV2Perfect.blocks.length - 1
    ]?.wMilli === precisionV2PerfectTop.wMilli,
  "precision v2 perfect placement did not preserve width"
);

const precisionV2Sliver =
  createPrecisionStackStateV2("precision-sliver-v2");
precisionV2Sliver.blocks = [
  { xMilli: 170_000, wMilli: 80_000 },
];
precisionV2Sliver.movingXMilli =
  170_000 + 80_000 -
  (PRECISION_STACK_V2.minimumStableOverlapMilli - 1_000);
precisionV2Sliver.movingWMilli = 80_000;
precisionV2Sliver.phase = "moving";
dropPrecisionStackV2(
  precisionV2Sliver,
  "precision-sliver-v2"
);
assert(
  precisionV2Status(precisionV2Sliver) === "failed" &&
    precisionV2Sliver.failure === "UNSTABLE_OVERLAP",
  "precision v2 accepted an ambiguous sliver landing"
);

const precisionV2IdleTimeout =
  createPrecisionStackStateV2("precision-idle-timeout-v2");
for (
  let index = 0;
  index < PRECISION_STACK_V2.maxIdleTicksPerBlock;
  index += 1
) {
  stepPrecisionStackV2(
    precisionV2IdleTimeout,
    "precision-idle-timeout-v2"
  );
}
assert(
  precisionV2Status(precisionV2IdleTimeout) === "failed" &&
    precisionV2IdleTimeout.failure === "TIMEOUT_IDLE",
  "precision v2 idle timeout did not resolve after the configured tick budget"
);

function simulatePrecisionV2RenderRate(frameHz: number) {
  const state = createPrecisionStackStateV2(
    precisionV2Golden.seed
  );
  let inputIndex = 0;
  let accumulator = 0;
  const frameSeconds = 1 / frameHz;
  const tickSeconds = 1 / PRECISION_STACK_V2.tickRate;
  let guard = 0;

  while (
    precisionV2Status(state) === "running" &&
    guard < 1_000_000
  ) {
    accumulator += frameSeconds;

    while (
      accumulator + 1e-12 >= tickSeconds &&
      precisionV2Status(state) === "running"
    ) {
      while (
        inputIndex < precisionV2Golden.inputs.length &&
        precisionV2Golden.inputs[inputIndex].tick === state.tick
      ) {
        assert(
          state.phase === "moving",
          "precision v2 render-rate replay dropped while settling"
        );
        dropPrecisionStackV2(
          state,
          precisionV2Golden.seed,
          precisionV2Golden.targetScore
        );
        inputIndex += 1;
      }

      if (precisionV2Status(state) !== "running") break;
      stepPrecisionStackV2(
        state,
        precisionV2Golden.seed,
        precisionV2Golden.targetScore
      );
      accumulator -= tickSeconds;
    }

    guard += 1;
  }

  return {
    tick: state.tick,
    score: state.score,
    height: state.blocks.length - 1,
    failure: state.failure,
    status: state.status,
  };
}

const precisionV2Render60 = simulatePrecisionV2RenderRate(60);
const precisionV2Render120 = simulatePrecisionV2RenderRate(120);
const precisionV2Render144 = simulatePrecisionV2RenderRate(144);
assert(
  JSON.stringify(precisionV2Render60) ===
      JSON.stringify(precisionV2Render120) &&
    JSON.stringify(precisionV2Render120) ===
      JSON.stringify(precisionV2Render144),
  "precision v2 render-rate equivalence failed"
);

const precisionV2ReplayFixture = {
  manifestHash: "sha256:precision-stack-v2-golden-manifest",
  attemptId: "precision-stack-v2-golden-attempt",
  inputs: precisionV2Golden.inputs,
  finalTick: precisionV2Golden.finalTick,
  result: {
    score: precisionV2First.score,
    timeMs: precisionV2First.timeMs,
    won: precisionV2First.state.status === "won",
    height: precisionV2First.height,
    failure: precisionV2First.failure,
  },
};
const precisionV2ReplayHash =
  "sha256:" +
  createHash("sha256")
    .update(canonicalJson(precisionV2ReplayFixture))
    .digest("hex");

assert(
  precisionV2ReplayHash ===
    precisionV2Golden.expected.replayHash,
  "precision v2 golden replay hash changed"
);

console.log(
  [
    "Precision Stack v2 deterministic replay OK",
    `score=${precisionV2First.score}`,
    `height=${precisionV2First.height}`,
    `finalTick=${precisionV2Golden.finalTick}`,
    `inputs=${precisionV2Golden.inputs.length}`,
    `replayHash=${precisionV2ReplayHash}`,
  ].join(" · ")
);


function pianoStatus(
  state: PianoRushState
): PianoRushState["status"] {
  return state.status;
}

const pianoGoldenSeed = "piano-rush-golden-v1";
const pianoGoldenTarget = 8_800;
const pianoGoldenExpected = {
  score: 9_592,
  notes: 11,
  finalTick: 910,
  replayHash:
    "sha256:ba11f9f7d9f0bc5b01643df40e194fdc6d7c95a9e14fc2439a49c570e93651f8",
} as const;
const pianoBuilder = createPianoRushState(pianoGoldenSeed);
const pianoInputs: PianoRushInput[] = [];

while (
  pianoStatus(pianoBuilder) === "running" &&
  pianoBuilder.score < pianoGoldenTarget
) {
  const note =
    pianoBuilder.schedule[pianoBuilder.nextNoteIndex];
  assert(!!note, "piano golden schedule exhausted");

  while (
    pianoStatus(pianoBuilder) === "running" &&
    pianoBuilder.tick < note.targetTick
  ) {
    stepPianoRush(
      pianoBuilder,
      pianoGoldenTarget
    );
  }

  assert(
    pianoBuilder.tick === note.targetTick,
    "piano golden builder missed target tick"
  );

  const action = (`LANE_${note.lane}`) as PianoRushInput["action"];
  pianoInputs.push({
    seq: pianoInputs.length,
    tick: pianoBuilder.tick,
    action,
  });
  tapPianoRush(
    pianoBuilder,
    action,
    pianoGoldenTarget
  );
}

assert(
  pianoStatus(pianoBuilder) === "won",
  "piano golden builder did not reach target"
);

const pianoFinalTick = pianoBuilder.tick;
const pianoFirst = replayPianoRush(
  pianoInputs,
  pianoFinalTick,
  pianoGoldenSeed,
  pianoGoldenTarget
);
const pianoSecond = replayPianoRush(
  pianoInputs,
  pianoFinalTick,
  pianoGoldenSeed,
  pianoGoldenTarget
);

assert(
  pianoFirst.valid && pianoSecond.valid,
  "piano golden replay rejected"
);
assert(
  JSON.stringify(pianoFirst.state) ===
    JSON.stringify(pianoSecond.state),
  "piano replay diverged across identical runs"
);
assert(
  pianoFirst.score === pianoBuilder.score &&
    pianoFirst.score === pianoGoldenExpected.score &&
    pianoInputs.length === pianoGoldenExpected.notes &&
    pianoFinalTick === pianoGoldenExpected.finalTick &&
    pianoFirst.timeMs ===
      Math.round(
        (pianoFinalTick * 1000) /
          PIANO_RUSH_V1.tickRate
      ),
  "piano golden result changed during replay"
);

function simulatePianoRenderRate(frameHz: number) {
  const state = createPianoRushState(pianoGoldenSeed);
  let inputIndex = 0;
  let accumulator = 0;
  const frameSeconds = 1 / frameHz;
  const tickSeconds = 1 / PIANO_RUSH_V1.tickRate;
  let guard = 0;

  while (
    pianoStatus(state) === "running" &&
    guard < 1_000_000
  ) {
    accumulator += frameSeconds;

    while (
      accumulator + 1e-12 >= tickSeconds &&
      pianoStatus(state) === "running"
    ) {
      while (
        inputIndex < pianoInputs.length &&
        pianoInputs[inputIndex].tick === state.tick
      ) {
        tapPianoRush(
          state,
          pianoInputs[inputIndex].action,
          pianoGoldenTarget
        );
        inputIndex += 1;
      }

      if (pianoStatus(state) !== "running") break;
      stepPianoRush(state, pianoGoldenTarget);
      accumulator -= tickSeconds;
    }

    guard += 1;
  }

  return {
    tick: state.tick,
    score: state.score,
    combo: state.combo,
    nextNoteIndex: state.nextNoteIndex,
    failure: state.failure,
    status: state.status,
  };
}

const piano60 = simulatePianoRenderRate(60);
const piano120 = simulatePianoRenderRate(120);
const piano144 = simulatePianoRenderRate(144);

assert(
  JSON.stringify(piano60) === JSON.stringify(piano120) &&
    JSON.stringify(piano120) === JSON.stringify(piano144),
  "piano render-rate equivalence failed"
);

const pianoWrongLane = createPianoRushState("piano-wrong-lane-v1");
const wrongFirst = pianoWrongLane.schedule[0];
while (pianoWrongLane.tick < wrongFirst.targetTick) {
  stepPianoRush(pianoWrongLane);
}
tapPianoRush(
  pianoWrongLane,
  (`LANE_${(wrongFirst.lane + 1) % 4}`) as PianoRushInput["action"]
);
assert(
  pianoStatus(pianoWrongLane) === "failed" &&
    pianoWrongLane.failure === "WRONG_LANE",
  "piano wrong-lane input was not rejected"
);

const pianoEarly = createPianoRushState("piano-early-v1");
tapPianoRush(
  pianoEarly,
  (`LANE_${pianoEarly.schedule[0].lane}`) as PianoRushInput["action"]
);
assert(
  pianoStatus(pianoEarly) === "failed" &&
    pianoEarly.failure === "EARLY_TAP",
  "piano early tap was not rejected"
);

const pianoMiss = createPianoRushState("piano-miss-v1");
const missTick =
  pianoMiss.schedule[0].targetTick +
  PIANO_RUSH_V1.maxTimingErrorTicks +
  1;
while (
  pianoStatus(pianoMiss) === "running" &&
  pianoMiss.tick < missTick
) {
  stepPianoRush(pianoMiss);
}
assert(
  pianoStatus(pianoMiss) === "failed" &&
    pianoMiss.failure === "MISSED_NOTE",
  "piano missed note did not terminate"
);

const pianoReplayFixture = {
  manifestHash: "sha256:piano-rush-golden-manifest",
  attemptId: "piano-rush-golden-attempt",
  inputs: pianoInputs,
  finalTick: pianoFinalTick,
  result: {
    score: pianoFirst.score,
    timeMs: pianoFirst.timeMs,
    won: pianoFirst.state.status === "won",
    failure: pianoFirst.failure,
  },
};
const pianoReplayHash =
  "sha256:" +
  createHash("sha256")
    .update(canonicalJson(pianoReplayFixture))
    .digest("hex");

assert(
  pianoReplayHash === pianoGoldenExpected.replayHash,
  "piano golden replay hash changed"
);

console.log(
  [
    "Piano Rush v1 deterministic replay OK",
    `score=${pianoFirst.score}`,
    `notes=${pianoInputs.length}`,
    `finalTick=${pianoFinalTick}`,
    `replayHash=${pianoReplayHash}`,
  ].join(" · ")
);


function jetStatus(
  state: JetStreamState
): JetStreamState["status"] {
  return state.status;
}

function nextJetGate(state: JetStreamState) {
  return state.gates.find((gate) => !gate.passed);
}

const jetGoldenSeed = "jet-stream-golden-v1";
const jetGoldenTarget = 2_400;
const jetGoldenExpected = {
  score: 2_760,
  passed: 7,
  finalTick: 1_390,
  replayHash:
    "sha256:c253e737f32e51506b66d2a7bc78e93d8b281a03d29ae3c88a93b8bfddc7a648",
} as const;
const jetBuilder = createJetStreamState(jetGoldenSeed);
const jetInputs: JetStreamInput[] = [];
let jetGuard = 0;

while (
  jetStatus(jetBuilder) === "running" &&
  jetGuard < 200_000
) {
  const gate = nextJetGate(jetBuilder);
  if (!gate) {
    throw new Error("jet golden builder has no upcoming gate");
  }

  const desiredY = gate.centerYMilli;
  const shouldFlap =
    jetBuilder.yMilli > desiredY + 8_000 &&
    jetBuilder.vyMilliPerSecond > -120_000;

  if (shouldFlap) {
    jetInputs.push({
      seq: jetInputs.length,
      tick: jetBuilder.tick,
      action: "FLAP",
    });
    flapJetStream(jetBuilder);
  }

  if (jetStatus(jetBuilder) === "running") {
    stepJetStream(
      jetBuilder,
      jetGoldenSeed,
      jetGoldenTarget
    );
  }

  jetGuard += 1;
}

assert(
  jetStatus(jetBuilder) === "won",
  `jet golden builder failed: status=${jetBuilder.status} failure=${jetBuilder.failure} score=${jetBuilder.score} passed=${jetBuilder.passed}`
);

const jetFinalTick = jetBuilder.tick;
const jetFirst = replayJetStream(
  jetInputs,
  jetFinalTick,
  jetGoldenSeed,
  jetGoldenTarget
);
const jetSecond = replayJetStream(
  jetInputs,
  jetFinalTick,
  jetGoldenSeed,
  jetGoldenTarget
);

assert(
  jetFirst.valid && jetSecond.valid,
  "jet golden replay rejected"
);
assert(
  JSON.stringify(jetFirst.state) ===
    JSON.stringify(jetSecond.state),
  "jet replay diverged across identical runs"
);
assert(
  jetFirst.score === jetBuilder.score &&
    jetFirst.timeMs ===
      Math.round(
        (jetFinalTick * 1000) /
          JET_STREAM_V1.tickRate
      ),
  "jet golden result changed during replay"
);
assert(
  jetFirst.score === jetGoldenExpected.score &&
    jetFirst.state.passed === jetGoldenExpected.passed &&
    jetFinalTick === jetGoldenExpected.finalTick,
  "jet frozen golden result changed"
);

function simulateJetRenderRate(frameHz: number) {
  const state = createJetStreamState(jetGoldenSeed);
  let inputIndex = 0;
  let accumulator = 0;
  const frameSeconds = 1 / frameHz;
  const tickSeconds = 1 / JET_STREAM_V1.tickRate;
  let guard = 0;

  while (
    jetStatus(state) === "running" &&
    guard < 1_000_000
  ) {
    accumulator += frameSeconds;

    while (
      accumulator + 1e-12 >= tickSeconds &&
      jetStatus(state) === "running"
    ) {
      while (
        inputIndex < jetInputs.length &&
        jetInputs[inputIndex].tick === state.tick
      ) {
        flapJetStream(state);
        inputIndex += 1;
      }

      if (jetStatus(state) !== "running") break;
      stepJetStream(
        state,
        jetGoldenSeed,
        jetGoldenTarget
      );
      accumulator -= tickSeconds;
    }

    guard += 1;
  }

  return {
    tick: state.tick,
    yMilli: state.yMilli,
    vyMilliPerSecond: state.vyMilliPerSecond,
    scrollMilli: state.scrollMilli,
    score: state.score,
    passed: state.passed,
    failure: state.failure,
    status: state.status,
  };
}

const jet60 = simulateJetRenderRate(60);
const jet120 = simulateJetRenderRate(120);
const jet144 = simulateJetRenderRate(144);

assert(
  JSON.stringify(jet60) === JSON.stringify(jet120) &&
    JSON.stringify(jet120) === JSON.stringify(jet144),
  "jet render-rate equivalence failed"
);

const jetFall = createJetStreamState("jet-fall-v1");
let jetFallGuard = 0;
while (
  jetStatus(jetFall) === "running" &&
  jetFallGuard < 5_000
) {
  stepJetStream(jetFall, "jet-fall-v1");
  jetFallGuard += 1;
}
assert(
  jetStatus(jetFall) === "failed" &&
    jetFall.failure === "OUT_OF_BOUNDS",
  "jet no-input fall did not resolve out of bounds"
);

const jetReplayFixture = {
  manifestHash: "sha256:jet-stream-golden-manifest",
  attemptId: "jet-stream-golden-attempt",
  inputs: jetInputs,
  finalTick: jetFinalTick,
  result: {
    score: jetFirst.score,
    timeMs: jetFirst.timeMs,
    won: jetFirst.state.status === "won",
    failure: jetFirst.failure,
  },
};
const jetReplayHash =
  "sha256:" +
  createHash("sha256")
    .update(canonicalJson(jetReplayFixture))
    .digest("hex");

assert(
  jetReplayHash === jetGoldenExpected.replayHash,
  "jet golden replay hash changed"
);

console.log(
  [
    "Jet Stream v1 deterministic replay OK",
    `score=${jetFirst.score}`,
    `passed=${jetFirst.state.passed}`,
    `finalTick=${jetFinalTick}`,
    `inputs=${jetInputs.length}`,
    `replayHash=${jetReplayHash}`,
  ].join(" · ")
);


function dinoStatus(
  state: DinoDashState
): DinoDashState["status"] {
  return state.status;
}

function nextDinoObstacle(state: DinoDashState) {
  return state.obstacles.find(
    (obstacle) =>
      obstacle.worldXMilli -
        state.scrollMilli +
        obstacle.wMilli >
      DINO_DASH_V1.playerXMilli - 8_000
  );
}

function dinoGrounded(state: DinoDashState) {
  return (
    state.yMilli >=
    DINO_DASH_V1.groundYMilli -
      DINO_DASH_V1.playerStandingHeightMilli -
      100
  );
}

function pushDinoInput(
  state: DinoDashState,
  inputs: DinoDashInput[],
  action: DinoDashInput["action"]
) {
  if (
    inputs.length > 0 &&
    inputs[inputs.length - 1].tick === state.tick
  ) {
    return false;
  }

  inputs.push({
    seq: inputs.length,
    tick: state.tick,
    action,
  });
  applyDinoDashInput(state, action);
  return true;
}

const dinoGoldenSeed = "dino-dash-golden-v1";
const dinoGoldenTarget = 7_200;
const dinoGoldenExpected = {
  score: 7_200,
  passed: 18,
  finalTick: 3_585,
  inputCount: 19,
  replayHash:
    "sha256:9766270a6ecc55faf50222372ea6b6dc46784d7a0661c823a86cf56fad0e49bb",
} as const;

const dinoBuilder = createDinoDashState(dinoGoldenSeed);
const dinoInputs: DinoDashInput[] = [];
let dinoGuard = 0;

while (
  dinoStatus(dinoBuilder) === "running" &&
  dinoGuard < 300_000
) {
  const obstacle = nextDinoObstacle(dinoBuilder);

  if (obstacle) {
    const x = obstacle.worldXMilli - dinoBuilder.scrollMilli;

    if (obstacle.kind === "flyer") {
      if (
        x < 122_000 &&
        x > 18_000 &&
        !dinoBuilder.ducking
      ) {
        pushDinoInput(
          dinoBuilder,
          dinoInputs,
          "DUCK_DOWN"
        );
      }

      if (
        dinoBuilder.ducking &&
        x + obstacle.wMilli <
          DINO_DASH_V1.playerXMilli - 5_000
      ) {
        pushDinoInput(
          dinoBuilder,
          dinoInputs,
          "DUCK_UP"
        );
      }
    } else {
      if (dinoBuilder.ducking && x > 143_000) {
        pushDinoInput(
          dinoBuilder,
          dinoInputs,
          "DUCK_UP"
        );
      }

      if (
        dinoGrounded(dinoBuilder) &&
        x < 140_000 &&
        x > 56_000
      ) {
        pushDinoInput(
          dinoBuilder,
          dinoInputs,
          "JUMP"
        );
      }
    }
  } else if (dinoBuilder.ducking) {
    pushDinoInput(dinoBuilder, dinoInputs, "DUCK_UP");
  }

  if (dinoStatus(dinoBuilder) === "running") {
    stepDinoDash(
      dinoBuilder,
      dinoGoldenSeed,
      dinoGoldenTarget
    );
  }

  dinoGuard += 1;
}

assert(
  dinoStatus(dinoBuilder) === "won",
  `dino golden builder failed: status=${dinoBuilder.status} failure=${dinoBuilder.failure} score=${dinoBuilder.score} passed=${dinoBuilder.passed}`
);

const dinoFinalTick = dinoBuilder.tick;
const dinoFirst = replayDinoDash(
  dinoInputs,
  dinoFinalTick,
  dinoGoldenSeed,
  dinoGoldenTarget
);
const dinoSecond = replayDinoDash(
  dinoInputs,
  dinoFinalTick,
  dinoGoldenSeed,
  dinoGoldenTarget
);

assert(
  dinoFirst.valid && dinoSecond.valid,
  "dino golden replay rejected"
);
assert(
  JSON.stringify(dinoFirst.state) ===
    JSON.stringify(dinoSecond.state),
  "dino replay diverged across identical runs"
);
assert(
  dinoFirst.score === dinoGoldenExpected.score &&
    dinoFirst.state.passed === dinoGoldenExpected.passed &&
    dinoFinalTick === dinoGoldenExpected.finalTick &&
    dinoInputs.length === dinoGoldenExpected.inputCount,
  "dino frozen golden result changed"
);

function simulateDinoRenderRate(frameHz: number) {
  const state = createDinoDashState(dinoGoldenSeed);
  let inputIndex = 0;
  let accumulator = 0;
  const frameSeconds = 1 / frameHz;
  const tickSeconds = 1 / DINO_DASH_V1.tickRate;
  let guard = 0;

  while (
    dinoStatus(state) === "running" &&
    guard < 1_000_000
  ) {
    accumulator += frameSeconds;

    while (
      accumulator + 1e-12 >= tickSeconds &&
      dinoStatus(state) === "running"
    ) {
      while (
        inputIndex < dinoInputs.length &&
        dinoInputs[inputIndex].tick === state.tick
      ) {
        applyDinoDashInput(
          state,
          dinoInputs[inputIndex].action
        );
        inputIndex += 1;
      }

      if (dinoStatus(state) !== "running") break;
      stepDinoDash(
        state,
        dinoGoldenSeed,
        dinoGoldenTarget
      );
      accumulator -= tickSeconds;
    }

    guard += 1;
  }

  return {
    tick: state.tick,
    yMilli: state.yMilli,
    vyMilliPerSecond: state.vyMilliPerSecond,
    scrollMilli: state.scrollMilli,
    score: state.score,
    passed: state.passed,
    failure: state.failure,
    status: state.status,
  };
}

const dino60 = simulateDinoRenderRate(60);
const dino120 = simulateDinoRenderRate(120);
const dino144 = simulateDinoRenderRate(144);

assert(
  JSON.stringify(dino60) === JSON.stringify(dino120) &&
    JSON.stringify(dino120) === JSON.stringify(dino144),
  "dino render-rate equivalence failed"
);

const dinoNoInput = createDinoDashState("dino-no-input-v1");
let dinoNoInputGuard = 0;
while (
  dinoStatus(dinoNoInput) === "running" &&
  dinoNoInputGuard < 20_000
) {
  stepDinoDash(dinoNoInput, "dino-no-input-v1");
  dinoNoInputGuard += 1;
}
assert(
  dinoStatus(dinoNoInput) === "failed" &&
    dinoNoInput.failure === "OBSTACLE_COLLISION",
  "dino no-input run did not collide"
);

const dinoReplayFixture = {
  manifestHash: "sha256:dino-dash-golden-manifest",
  attemptId: "dino-dash-golden-attempt",
  inputs: dinoInputs,
  finalTick: dinoFinalTick,
  result: {
    score: dinoFirst.score,
    timeMs: dinoFirst.timeMs,
    won: dinoFirst.state.status === "won",
    failure: dinoFirst.failure,
  },
};
const dinoReplayHash =
  "sha256:" +
  createHash("sha256")
    .update(canonicalJson(dinoReplayFixture))
    .digest("hex");

assert(
  dinoReplayHash === dinoGoldenExpected.replayHash,
  "dino golden replay hash changed"
);

console.log(
  [
    "Dino Dash v1 deterministic replay OK",
    `score=${dinoFirst.score}`,
    `passed=${dinoFirst.state.passed}`,
    `finalTick=${dinoFinalTick}`,
    `inputs=${dinoInputs.length}`,
    `replayHash=${dinoReplayHash}`,
  ].join(" · ")
);

function pulseStatus(
  state: PulseRunnerState
): PulseRunnerState["status"] {
  return state.status;
}

function nextPulseObstacle(state: PulseRunnerState) {
  return state.obstacles.find(
    (obstacle) =>
      obstacle.worldXMilli -
        state.scrollMilli +
        obstacle.wMilli >
      PULSE_RUNNER_V1.playerXMilli - 8_000
  );
}

function pushPulseJump(
  state: PulseRunnerState,
  inputs: PulseRunnerInput[]
) {
  if (
    inputs.length > 0 &&
    inputs[inputs.length - 1].tick === state.tick
  ) {
    return false;
  }

  inputs.push({
    seq: inputs.length,
    tick: state.tick,
    action: "JUMP",
  });
  applyPulseRunnerInput(state, "JUMP");
  return true;
}

const pulseGoldenSeed = "pulse-runner-golden-v1";
const pulseGoldenTarget = 7_200;
const pulseGoldenExpected = {
  score: 7_867,
  passed: 7,
  finalTick: 2_048,
  inputCount: 10,
  replayHash:
    "sha256:dadda57b49bf05b8822ed47499ea8681de54ccc99b1f58f9f0c958a072fbd894",
} as const;
const pulseBuilder = createPulseRunnerState(pulseGoldenSeed);
const pulseInputs: PulseRunnerInput[] = [];
let pulseGuard = 0;

while (
  pulseStatus(pulseBuilder) === "running" &&
  pulseGuard < 300_000
) {
  const obstacle = nextPulseObstacle(pulseBuilder);
  if (obstacle) {
    const x = obstacle.worldXMilli - pulseBuilder.scrollMilli;
    const jumpAt =
      obstacle.kind === "pillar"
        ? 260_000
        : obstacle.kind === "block"
          ? 250_000
          : 120_000;

    if (
      isPulseRunnerGrounded(pulseBuilder) &&
      x < jumpAt &&
      x > 30_000
    ) {
      pushPulseJump(pulseBuilder, pulseInputs);
    }
  }

  if (pulseStatus(pulseBuilder) === "running") {
    stepPulseRunner(
      pulseBuilder,
      pulseGoldenSeed,
      pulseGoldenTarget
    );
  }

  pulseGuard += 1;
}

assert(
  pulseStatus(pulseBuilder) === "won",
  `pulse golden builder failed: status=${pulseBuilder.status} failure=${pulseBuilder.failure} score=${pulseBuilder.score} passed=${pulseBuilder.passed}`
);

const pulseFinalTick = pulseBuilder.tick;
const pulseFirst = replayPulseRunner(
  pulseInputs,
  pulseFinalTick,
  pulseGoldenSeed,
  pulseGoldenTarget
);
const pulseSecond = replayPulseRunner(
  pulseInputs,
  pulseFinalTick,
  pulseGoldenSeed,
  pulseGoldenTarget
);

assert(
  pulseFirst.valid && pulseSecond.valid,
  "pulse golden replay rejected"
);
assert(
  JSON.stringify(pulseFirst.state) ===
    JSON.stringify(pulseSecond.state),
  "pulse replay diverged across identical runs"
);
assert(
  pulseFirst.score === pulseGoldenExpected.score &&
    pulseFirst.state.passed === pulseGoldenExpected.passed &&
    pulseFinalTick === pulseGoldenExpected.finalTick &&
    pulseInputs.length === pulseGoldenExpected.inputCount,
  "pulse frozen golden result changed"
);

function simulatePulseRenderRate(frameHz: number) {
  const state = createPulseRunnerState(pulseGoldenSeed);
  let inputIndex = 0;
  let accumulator = 0;
  const frameSeconds = 1 / frameHz;
  const tickSeconds = 1 / PULSE_RUNNER_V1.tickRate;
  let guard = 0;

  while (
    pulseStatus(state) === "running" &&
    guard < 1_000_000
  ) {
    accumulator += frameSeconds;

    while (
      accumulator + 1e-12 >= tickSeconds &&
      pulseStatus(state) === "running"
    ) {
      while (
        inputIndex < pulseInputs.length &&
        pulseInputs[inputIndex].tick === state.tick
      ) {
        applyPulseRunnerInput(
          state,
          pulseInputs[inputIndex].action
        );
        inputIndex += 1;
      }

      if (pulseStatus(state) !== "running") break;
      stepPulseRunner(
        state,
        pulseGoldenSeed,
        pulseGoldenTarget
      );
      accumulator -= tickSeconds;
    }

    guard += 1;
  }

  return {
    tick: state.tick,
    yMilli: state.yMilli,
    vyMilliPerSecond: state.vyMilliPerSecond,
    scrollMilli: state.scrollMilli,
    score: state.score,
    passed: state.passed,
    failure: state.failure,
    status: state.status,
  };
}

const pulse60 = simulatePulseRenderRate(60);
const pulse120 = simulatePulseRenderRate(120);
const pulse144 = simulatePulseRenderRate(144);

assert(
  JSON.stringify(pulse60) === JSON.stringify(pulse120) &&
    JSON.stringify(pulse120) === JSON.stringify(pulse144),
  "pulse render-rate equivalence failed"
);

const pulseNoInput = createPulseRunnerState("pulse-no-input-v1");
let pulseNoInputGuard = 0;
while (
  pulseStatus(pulseNoInput) === "running" &&
  pulseNoInputGuard < 20_000
) {
  stepPulseRunner(pulseNoInput, "pulse-no-input-v1", pulseGoldenTarget);
  pulseNoInputGuard += 1;
}
assert(
  pulseStatus(pulseNoInput) === "failed" &&
    pulseNoInput.failure === "OBSTACLE_COLLISION",
  "pulse no-input run did not collide"
);

const pulseReplayFixture = {
  manifestHash: "sha256:pulse-runner-golden-manifest",
  attemptId: "pulse-runner-golden-attempt",
  inputs: pulseInputs,
  finalTick: pulseFinalTick,
  result: {
    score: pulseFirst.score,
    timeMs: pulseFirst.timeMs,
    won: pulseFirst.state.status === "won",
    failure: pulseFirst.failure,
  },
};
const pulseReplayHash =
  "sha256:" +
  createHash("sha256")
    .update(canonicalJson(pulseReplayFixture))
    .digest("hex");

assert(
  pulseReplayHash === pulseGoldenExpected.replayHash,
  "pulse golden replay hash changed"
);

console.log(
  [
    "Pulse Runner v1 deterministic replay OK",
    `score=${pulseFirst.score}`,
    `passed=${pulseFirst.state.passed}`,
    `finalTick=${pulseFinalTick}`,
    `inputs=${pulseInputs.length}`,
    `replayHash=${pulseReplayHash}`,
  ].join(" · ")
);
