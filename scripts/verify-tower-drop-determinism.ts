import {
  replayTowerDrop,
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
