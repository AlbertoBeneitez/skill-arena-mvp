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
