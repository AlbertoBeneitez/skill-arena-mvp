import {
  createTowerDropState,
  dropTowerBlock,
  replayTowerDrop,
  stepTowerDrop,
  type TowerDropInput,
} from "../lib/verified/towerDropCore.v1";

const GOLDEN_INPUTS: TowerDropInput[] = [
  66, 510, 571, 629, 685, 847, 1003, 1153,
].map((tick, seq) => ({ seq, tick, action: "DROP" as const }));

const FINAL_TICK = 1638;
const EXPECTED = {
  score: 8941,
  height: 8,
  failure: "TIMEOUT_BOUNCES",
  timeMs: 13650,
};

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const first = replayTowerDrop(GOLDEN_INPUTS, FINAL_TICK);
const second = replayTowerDrop(GOLDEN_INPUTS, FINAL_TICK);

assert(first.valid, `golden replay rejected: ${first.error ?? "unknown"}`);
assert(second.valid, `second replay rejected: ${second.error ?? "unknown"}`);
assert(first.score === EXPECTED.score, `score changed: ${first.score}`);
assert(first.height === EXPECTED.height, `height changed: ${first.height}`);
assert(first.failure === EXPECTED.failure, `failure changed: ${first.failure}`);
assert(first.timeMs === EXPECTED.timeMs, `time changed: ${first.timeMs}`);

assert(
  JSON.stringify({
    score: first.score,
    height: first.height,
    failure: first.failure,
    timeMs: first.timeMs,
    state: first.state,
  }) ===
    JSON.stringify({
      score: second.score,
      height: second.height,
      failure: second.failure,
      timeMs: second.timeMs,
      state: second.state,
    }),
  "same manifest + same tick inputs did not produce an identical replay"
);

const earlyEnd = replayTowerDrop(GOLDEN_INPUTS, FINAL_TICK - 1);
assert(!earlyEnd.valid, "an attempt ending before the failure tick was accepted");

const badSequence = GOLDEN_INPUTS.map((input) => ({ ...input }));
badSequence[3].seq = 99;
const malformed = replayTowerDrop(badSequence, FINAL_TICK);
assert(!malformed.valid, "malformed input sequence was accepted");

console.log(
  `Tower Drop v1 deterministic replay OK: score=${first.score}, height=${first.height}, finalTick=${FINAL_TICK}`
);


function simulateRenderRate(frameHz: number) {
  const state = createTowerDropState();
  let inputIndex = 0;
  let accumulator = 0;
  const frameSeconds = 1 / frameHz;
  const tickSeconds = 1 / 120;
  let guard = 0;

  while (state.status === "running" && guard < 200_000) {
    accumulator += frameSeconds;

    while (accumulator + 1e-12 >= tickSeconds && state.status === "running") {
      while (
        inputIndex < GOLDEN_INPUTS.length &&
        GOLDEN_INPUTS[inputIndex].tick === state.tick &&
        state.status === "running"
      ) {
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
  };
}

const render60 = simulateRenderRate(60);
const render120 = simulateRenderRate(120);
const render144 = simulateRenderRate(144);

assert(
  JSON.stringify(render60) === JSON.stringify(render120) &&
    JSON.stringify(render120) === JSON.stringify(render144),
  `device/render-rate equivalence failed: 60=${JSON.stringify(render60)} 120=${JSON.stringify(render120)} 144=${JSON.stringify(render144)}`
);

console.log(
  `Render-rate equivalence OK: 60/120/144 Hz -> score=${render60.score}, finalTick=${render60.tick}`
);
