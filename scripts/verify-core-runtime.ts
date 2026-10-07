import assert from "node:assert/strict";
import { advanceCoreToTick, applyCoreInput, replayCore, type GameCore, type CoreState } from "../lib/verified/coreRuntime.v1";

// Test-only fixture, never a production registry entry or an alternative engine.
const fixture: GameCore<CoreState> = {
  gameId: "precision-stack", gameVersion: "test", width: 390, height: 620,
  tickRate: 120, maxFinalTick: 240, maxInputs: 3, inputVersion: 1,
  actions: ["POINT"], content: {},
  create: () => ({ tick: 0, score: 0, status: "running", failure: null }),
  step: state => { state.tick += 1; },
  canApply: state => state.tick >= 1,
  apply: state => { state.score += 10; },
};
const inputs = [{ seq: 0, tick: 17, action: "POINT" }, { seq: 1, tick: 91, action: "POINT" }];
const replay = replayCore(fixture, inputs, 91, "fixture", 20);
assert.equal(replay.valid, true);
assert.equal(replay.score, 20);
assert.equal(replay.timeMs, 758);
for (const hz of [60, 120, 144]) {
  const state = fixture.create("fixture");
  let index = 0;
  for (let frame = 0; state.status === "running"; frame += 1) {
    const targetTick = Math.floor(frame * fixture.tickRate / hz);
    while (index < inputs.length && inputs[index].tick <= targetTick && state.status === "running") {
      advanceCoreToTick(fixture, state, inputs[index].tick, 20);
      assert.equal(applyCoreInput(fixture, state, inputs[index++].action, 20), true);
    }
    advanceCoreToTick(fixture, state, targetTick, 20);
  }
  assert.deepEqual(state, replay.state);
}
const lateFrame = fixture.create("fixture");
advanceCoreToTick(fixture, lateFrame, 9999, 999);
assert.equal(lateFrame.tick, 240);
assert.equal(lateFrame.failure, "TIME_LIMIT");
assert.equal(replayCore(fixture, [], 240, "fixture").valid, true);
assert.equal(replayCore(fixture, [{seq:0,tick:0,action:"POINT"}], 1, "fixture").error, "ACTION_NOT_AVAILABLE");
assert.equal(replayCore(fixture, [inputs[0], {...inputs[1],tick:17}], 91, "fixture").error, "INVALID_INPUT_SEQUENCE");
assert.equal(replayCore(fixture, [inputs[0], {...inputs[1],tick:10}], 91, "fixture").error, "INVALID_INPUT_SEQUENCE");
assert.equal(replayCore(fixture, [{...inputs[0],action:"UNKNOWN"}], 91, "fixture").error, "INVALID_INPUT");
assert.equal(replayCore(fixture, Array.from({length:4},(_,seq)=>({seq,tick:seq+1,action:"POINT"})), 91, "fixture").error, "PAYLOAD_TOO_LARGE");
assert.equal(replayCore(fixture, inputs, 92, "fixture", 20).error, "FINAL_TICK_AFTER_RESOLUTION");
assert.equal(replayCore(fixture, [], 1, "fixture").error, "CLIENT_ENDED_BEFORE_RESOLUTION");
console.log("Shared core driver OK · semantic inputs · target/timeout · replay · 60/120/144 Hz · late-frame catch-up");
