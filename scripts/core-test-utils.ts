import assert from "node:assert/strict";
import { canonicalJson } from "../lib/verified/canonical";
import { sha256 } from "../lib/server/matchIntegrity";
import { advanceCoreToTick, applyCoreInput, replayCore, type CoreState, type GameCore } from "../lib/verified/coreRuntime.v1";
import type { ReplayInput } from "../lib/verified/inputValidation";

export function verifyCoreFixture<S extends CoreState>(core: GameCore<S>, seed: string, inputs: ReplayInput[], finalTick: number, target: number, golden: { score: number; status: CoreState["status"]; hash: string; failure: string | null }) {
  const replay = replayCore(core, inputs, finalTick, seed, target);
  assert.equal(replay.valid, true, replay.error ?? "Invalid replay");
  assert.equal(replay.state.tick, finalTick);
  assert.equal(replay.score, golden.score);
  assert.equal(replay.state.status, golden.status);
  assert.equal(replay.failure, golden.failure);
  assert.equal(sha256(canonicalJson(replay.state)), golden.hash);
  assert.deepEqual(replayCore(core, inputs, finalTick, seed, target), replay);
  for (const hz of [60, 120, 144]) {
    const state = core.create(seed);
    let index = 0;
    for (let frame = 0; state.status === "running" && frame <= Math.ceil((finalTick + 2) * hz / core.tickRate); frame += 1) {
      const tick = Math.min(finalTick, Math.floor(frame * core.tickRate / hz));
      while (index < inputs.length && inputs[index].tick <= tick && state.status === "running") {
        advanceCoreToTick(core, state, inputs[index].tick, target);
        assert.equal(applyCoreInput(core, state, inputs[index++].action, target), true);
      }
      advanceCoreToTick(core, state, tick, target);
    }
    assert.deepEqual(state, replay.state, `${core.gameId} at ${hz} Hz`);
  }
  const action = core.actions[0];
  assert.equal(replayCore(core, [{seq:0,tick:1,action},{seq:1,tick:1,action}], finalTick, seed, target).error, "INVALID_INPUT_SEQUENCE");
  assert.equal(replayCore(core, [{seq:0,tick:2,action},{seq:1,tick:1,action}], finalTick, seed, target).error, "INVALID_INPUT_SEQUENCE");
  assert.equal(replayCore(core, [{seq:0,tick:0,action:"FORBIDDEN"}], finalTick, seed, target).error, "INVALID_INPUT");
  assert.equal(replayCore(core, Array.from({length:core.maxInputs+1},(_,seq)=>({seq,tick:seq,action})), finalTick, seed, target).error, "PAYLOAD_TOO_LARGE");
  assert.equal(replayCore(core, [], core.maxFinalTick + 1, seed, target).error, "INVALID_FINAL_TICK");
  const random = Math.random, now = Date.now;
  try {
    Math.random = () => { throw new Error("Uncontrolled RNG in core"); };
    Date.now = () => { throw new Error("Wall clock in core"); };
    assert.deepEqual(replayCore(core, inputs, finalTick, seed, target), replay);
  } finally { Math.random = random; Date.now = now; }
  console.log(`${core.gameId}@${core.gameVersion} fixture OK · score=${golden.score} · tick=${finalTick} · replay/render/input/golden hash verified`);
  return replay;
}
