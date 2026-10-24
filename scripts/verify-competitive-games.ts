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
