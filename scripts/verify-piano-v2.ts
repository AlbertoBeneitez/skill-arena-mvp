import assert from "node:assert/strict";
import { PIANO_V2_CORE as core } from "../lib/verified/pianoRushCore.v2";
import { generateScenario } from "../lib/server/scenarios";
import {
  applyCoreInput,
  stepCore,
  replayCore,
} from "../lib/verified/coreRuntime.v1";
import type { ReplayInput } from "../lib/verified/inputValidation";
import { verifyCoreFixture } from "./core-test-utils";
import fixture from "./fixtures/piano-v2.json" with { type: "json" };
verifyCoreFixture(core, fixture.seed, fixture.inputs, fixture.finalTick, 1e6, {
  score: fixture.score,
  status: "won",
  failure: null,
  hash: fixture.hash,
});
for (let i = 0; i < 64; i++) {
  const seed = generateScenario(
      { game_id: "piano-rush", game_version: "2.0.0" },
      i,
    ).seed,
    s = core.create(seed),
    inputs: ReplayInput[] = [];
  while (s.status === "running") {
    const note = s.notes[s.nextNoteIndex];
    if (note && s.tick === note.targetTick) {
      const action = `LANE_${note.lane}`;
      inputs.push({ seq: inputs.length, tick: s.tick, action });
      assert.equal(applyCoreInput(core, s, action, 1e6), true);
    }
    stepCore(core, s, 1e6);
  }
  assert.equal(s.status, "won");
  assert.equal(s.correct, 48);
  assert.equal(s.nextNoteIndex, 48);
  assert.equal(s.lives, 3);
  assert.deepEqual(replayCore(core, inputs, s.tick, seed, 1e6).state, s);
}
for (let i = 0; i < 128; i++) {
  const s = core.create(`intro-${i}`);
  for (let t = 0; t < 960; t++) stepCore(core, s, 1e6);
  assert.equal(s.lives, 3, "first eight seconds teach without shield loss");
  assert.ok(
    s.notes.every(
      (n, j) =>
        j < 2 ||
        n.lane !== s.notes[j - 1].lane ||
        n.lane !== s.notes[j - 2].lane,
    ),
  );
  assert.ok(
    s.notes.every(
      (n, j) =>
        j === 0 ||
        n.targetTick -
          s.notes[j - 1].targetTick -
          n.window -
          s.notes[j - 1].window >=
          36,
      "all legal consecutive hit windows respect cooldown",
    ),
  );
}
const warm = core.create("warm");
assert.equal(applyCoreInput(core, warm, "LANE_0", 1e6), true);
assert.equal(warm.lives, 3);
assert.equal(warm.lastJudgement, "EARLY");
assert.equal(
  applyCoreInput(core, warm, "LANE_0", 1e6),
  false,
  "double tap cooldown",
);
const wrong = core.create("wrong");
wrong.nextNoteIndex = 8;
wrong.tick = wrong.notes[8].targetTick;
applyCoreInput(core, wrong, `LANE_${(wrong.notes[8].lane + 1) % 4}`, 1e6);
assert.equal(wrong.lives, 2);
assert.equal(wrong.missed, 1);
assert.equal(wrong.nextNoteIndex, 9);
for (let t = 0; t < 36; t++) stepCore(core, wrong, 1e6);
applyCoreInput(core, wrong, "LANE_0", 1e6);
assert.equal(wrong.lives, 2, "protection limits repeated mistakes");
for (const index of [0, 16, 32])
  for (const sign of [-1, 1]) {
    const s = core.create("edge");
    s.nextNoteIndex = index;
    s.tick = s.notes[index].targetTick + sign * s.notes[index].window;
    applyCoreInput(core, s, `LANE_${s.notes[index].lane}`, 1e6);
    assert.equal(s.correct, 1, "inclusive hit window");
    assert.equal(s.lastScoreDelta, 362);
  }
const idle = core.create("idle");
while (idle.status === "running") stepCore(core, idle, 1e6);
assert.equal(idle.failure, "MISSED_NOTES");
assert.ok(idle.tick > 960);
assert.equal(replayCore(core, [], idle.tick, "idle", 1e6).valid, true);
console.log(
  "Piano V2: 64 full 48-note courses, 128 safe eight-second warmups, stage windows/gaps, no triple repeat, valid timings never conflict with cooldown, double tap, damage/protection and replay",
);
