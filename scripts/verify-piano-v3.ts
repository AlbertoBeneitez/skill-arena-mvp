import assert from "node:assert/strict";
import { PIANO_V3_CORE as core } from "../lib/verified/pianoRushCore.v3";
import { PIANO_V2_CORE } from "../lib/verified/pianoRushCore.v2";
import { generateScenario } from "../lib/server/scenarios";
import { getServerGameAdapter } from "../lib/server/gameVerifiers";
import {
  applyCoreInput,
  stepCore,
  replayCore,
} from "../lib/verified/coreRuntime.v1";
import type { ReplayInput } from "../lib/verified/inputValidation";
import { verifyCoreFixture } from "./core-test-utils";
import fixture from "./fixtures/piano-v3.json" with { type: "json" };

assert.equal(
  fixture.seed,
  generateScenario({ game_id: core.gameId, game_version: core.gameVersion }, 0)
    .seed,
);
verifyCoreFixture(core, fixture.seed, fixture.inputs, fixture.finalTick, 1e6, {
  score: 51960,
  status: "won",
  failure: null,
  hash: "sha256:12317ef9ba309d9eb4916aab23626ba77409b2cf9846e15c75b63736f17c2c01",
});
assert.equal(fixture.finalTick, 4848);
for (let i = 0; i < 64; i++) {
  const seed = generateScenario(
    { game_id: core.gameId, game_version: core.gameVersion },
    i,
  ).seed;
  const s = core.create(seed),
    inputs: ReplayInput[] = [];
  while (s.status === "running") {
    const note = s.notes[s.nextNoteIndex];
    if (note && s.tick === note.targetTick) {
      const action = `LANE_${note.lane}`;
      inputs.push({ seq: inputs.length, tick: s.tick, action });
      assert.equal(applyCoreInput(core, s, action, 1e6), true);
      if (s.nextNoteIndex === 16 || s.nextNoteIndex === 32)
        assert.ok(
          s.notes[s.nextNoteIndex].targetTick - s.tick <= 108,
          "milestone never pauses the run",
        );
    }
    stepCore(core, s, 1e6);
  }
  assert.equal(s.status, "won");
  assert.equal(s.correct, 48);
  assert.equal(s.lives, 3);
  assert.equal(s.score, 51960);
  assert.equal(s.tick, 4848);
  assert.deepEqual(replayCore(core, inputs, s.tick, seed, 1e6).state, s);
}
for (let i = 0; i < 128; i++) {
  const s = core.create(`continuous-${i}`),
    old = PIANO_V2_CORE.create(`continuous-${i}`);
  assert.deepEqual(
    s.notes.map((n) => n.lane),
    old.notes.map((n) => n.lane),
    "frozen proven lane generation reused",
  );
  let interval = 108,
    window = 36;
  for (const [j, note] of s.notes.entries()) {
    assert.ok(note.window <= window && note.window >= 24);
    window = note.window;
    if (j) {
      const gap = note.targetTick - s.notes[j - 1].targetTick;
      assert.ok(
        gap <= interval && gap >= 84,
        "gradual acceleration without sector gaps",
      );
      assert.ok(
        gap - note.window - s.notes[j - 1].window >= 36,
        "all valid windows respect input cooldown",
      );
      interval = gap;
    }
    if (j < 8) assert.equal(note.window, 36, "protected broad opening");
  }
  while (s.tick < 960) stepCore(core, s, 1e6);
  assert.equal(s.lives, 3);
}
for (const index of [0, 8, 15, 16, 31, 32, 47]) {
  for (const edge of [-1, 1]) {
    const s = core.create("window-edge");
    s.nextNoteIndex = index;
    s.tick = s.notes[index].targetTick + edge * s.notes[index].window;
    assert.equal(
      applyCoreInput(core, s, `LANE_${s.notes[index].lane}`, 1e6),
      true,
    );
    assert.equal(s.correct, 1, "inclusive gradual precision window");
    assert.equal(s.lastScoreDelta, 362);
  }
}
const warm = core.create("double");
assert.equal(applyCoreInput(core, warm, "LANE_0", 1e6), true);
assert.equal(applyCoreInput(core, warm, "LANE_0", 1e6), false);
assert.equal(warm.lives, 3);
const idle = core.create("idle");
while (idle.status === "running") stepCore(core, idle, 1e6);
assert.equal(idle.failure, "MISSED_NOTES");
assert.equal(idle.tick, 1354);
assert.equal(replayCore(core, [], idle.tick, "idle", 1e6).valid, true);
assert.equal(getServerGameAdapter(core.gameId, "2.0.0")?.gameVersion, "2.0.0");
console.log(
  "Piano V3: 64 continuous full runs, 128 safe/gradual schedules, no gaps at milestones, valid window boundaries/cooldown, deterministic loss, archived V2 and golden/replay/render/invalid inputs passed",
);
