import assert from "node:assert/strict";
import { SHOT_GALLERY_CORE_V10 as core, GALLERY_V10, galleryTicksToMsV10 } from "../lib/verified/shotGalleryCore.v10";
import { applyCoreInput, replayCore, stepCore } from "../lib/verified/coreRuntime.v1";
import { generateScenario } from "../lib/server/scenarios";
import { playGalleryV10 } from "./gallery-v10-play-fixture";
import { verifyCoreFixture } from "./core-test-utils";
import fixture from "./fixtures/gallery-v10.json" with { type: "json" };

assert.deepEqual([0, 1, 3, 12, 120].map(galleryTicksToMsV10), [0, 8, 25, 100, 1000], "integer ms from ticks");
// Same static range as V9: colour + figure orders, 2–4 matches.
for (let i = 0; i < 100; i++) {
  const seed = generateScenario({ game_id: core.gameId, game_version: core.gameVersion }, i).seed, a = core.create(seed);
  assert.deepEqual(a, core.create(seed));
  for (const t of a.trials) assert.ok(t.answers.length >= 2 && t.answers.length <= 4);
}
// The score is the accumulated reaction time: faster play scores LESS; the run always completes.
const fast = playGalleryV10("gallery10-fast", "correct", 30), slow = playGalleryV10("gallery10-fast", "correct", 90);
assert.equal(fast.s.status, "won");
assert.equal(fast.s.correct, 12);
assert.ok(fast.s.score < slow.s.score, `faster is better (${fast.s.score} < ${slow.s.score})`);
assert.equal(fast.s.score, fast.s.totalMs);
assert.equal(fast.s.height, GALLERY_V10.reachBase - fast.s.totalMs, "reach mirrors the time for duels");
assert.ok((fast.s.height ?? 0) > (slow.s.height ?? 0));
// Every correct tap adds the time since the green light or the previous hit.
{
  const taps = fast.s.results.flatMap((r) => r.taps);
  const expected = fast.s.results.reduce((sum, r) => sum + r.taps.reduce((acc, t, k) => acc + galleryTicksToMsV10(t - (k ? r.taps[k - 1] : 0)), 0), 0);
  assert.ok(taps.length >= 24);
  assert.equal(fast.s.totalMs, expected, "no penalties on a clean run");
}
// Penalties: wrong plates, false starts and plates left standing.
const wrong = playGalleryV10("gallery10-wrong", "wrong");
assert.equal(wrong.s.status, "won");
assert.equal(wrong.s.totalMs, wrong.s.trials.reduce((sum, t) => sum + GALLERY_V10.maxWrong * GALLERY_V10.wrongPenaltyMs + t.answers.length * GALLERY_V10.missedPlatePenaltyMs, 0));
const early = playGalleryV10("gallery10-early", "early");
assert.ok(early.s.results.every((r) => r.type === "FALSE_START"));
assert.equal(early.s.totalMs, 12 * GALLERY_V10.falseStartPenaltyMs);
const idle = playGalleryV10("gallery10-idle", "idle");
assert.ok(idle.s.results.every((r) => r.type === "TIMEOUT"));
assert.equal(idle.s.totalMs, idle.s.trials.reduce((sum, t) => sum + t.answers.length * GALLERY_V10.missedPlatePenaltyMs, 0));
assert.ok(fast.s.score < idle.s.score && fast.s.score < wrong.s.score);
{
  const s = core.create("gallery10-phase");
  applyCoreInput(core, s, "PICK_0", 1e9);
  assert.equal(s.phase, "feedback");
  for (let t = 0; t < GALLERY_V10.feedbackTicks; t++) stepCore(core, s, 1e9);
  assert.equal(s.trial, 1);
}
for (const m of [fast, wrong, early]) {
  const r = replayCore(core, m.inputs, m.s.tick, m.s.seed, 1e9);
  assert.equal(r.valid, true);
  assert.deepEqual(r.state, m.s);
}
verifyCoreFixture(core, fixture.seed, fixture.inputs, fixture.finalTick, 1e9, { score: fixture.score, status: "won", failure: null, hash: fixture.hash });
console.log(`Gallery V10 OK · accumulated reaction time · fast ${fast.s.score} ms, slow ${slow.s.score} ms, idle ${idle.s.score} ms`);
