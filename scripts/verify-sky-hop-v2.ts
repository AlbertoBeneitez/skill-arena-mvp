import assert from "node:assert/strict";
import { SKY_HOP_CORE } from "../lib/verified/skyHopCore.v1";
import { SKY_HOP_CORE_V2 } from "../lib/verified/skyHopCore.v2";
import {
  applyCoreInput,
  stepCore,
  replayCore,
} from "../lib/verified/coreRuntime.v1";
import type { ReplayInput } from "../lib/verified/inputValidation";
import { chooseHopAction } from "./sky-hop-play-fixture";
import { verifyCoreFixture } from "./core-test-utils";
import fixture from "./fixtures/sky-hop-v1.json" with { type: "json" };
// The no-fall historical trajectory is deliberately identical in V2.
verifyCoreFixture(
  SKY_HOP_CORE_V2,
  fixture.seed,
  fixture.inputs,
  fixture.finalTick,
  1e6,
  { score: fixture.score, hash: fixture.hash, status: "won", failure: null },
);
assert.equal(SKY_HOP_CORE.gameVersion, "1.0.0");
for (let k = 0; k < 8; k++) {
  for (const core of [SKY_HOP_CORE, SKY_HOP_CORE_V2]) {
    const seed = `recovery-probe-${k}`,
      state = core.create(seed),
      inputs: ReplayInput[] = [];
    let forcing = false,
      recovered = false;
    while (state.status === "running") {
      if (
        state.highest >= 13 &&
        state.brokenAt[13] >= 0 &&
        !forcing &&
        !recovered
      )
        forcing = true;
      const lives = state.lives;
      const action: string | null = forcing
        ? state.right
          ? "RIGHT_UP"
          : !state.left
            ? "LEFT_DOWN"
            : null
        : chooseHopAction(state);
      if (action) {
        assert.equal(applyCoreInput(core, state, action, 1e6), true);
        inputs.push({ tick: state.tick, action, seq: inputs.length });
      }
      stepCore(core, state, 1e6);
      if (forcing && state.lives < lives) {
        forcing = false;
        recovered = true;
        assert.equal(state.checkpoint, 10);
        assert.equal(
          state.highest,
          13,
          "recovery cannot erase attained height",
        );
        assert.equal(
          state.collected[13],
          true,
          "recovery cannot farm a life pickup",
        );
        assert.equal(state.brokenAt[13] >= 0, core.gameVersion === "1.0.0");
      }
    }
    assert.equal(recovered, true);
    const replay = replayCore(core, inputs, state.tick, seed, 1e6);
    assert.equal(replay.valid, true, replay.error ?? "invalid replay");
    assert.equal(replay.score, state.score);
    assert.deepEqual(replay.state, state);
    if (core.gameVersion === "1.0.0") {
      assert.equal(state.highest, 13);
      assert.equal(state.failure, "TIME_LIMIT");
    } else {
      assert.equal(state.highest, 75);
      assert.equal(state.status, "won");
    }
  }
}
console.log(
  "Sky V2: eight replayed broken-support recoveries finish; V1 softlock/history preserved; height/pickups cannot reset",
);
