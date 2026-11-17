import assert from "node:assert/strict";
import { SHOT_GALLERY_CORE_V14 as core, GALLERY_V14, galleryAtSpotV14, galleryRemainingV14 } from "../lib/verified/shotGalleryCore.v14";
import { SHOT_GALLERY_CORE_V13, galleryTrialsV13 } from "../lib/verified/shotGalleryCore.v13";
import { applyCoreInput, replayCore, stepCore } from "../lib/verified/coreRuntime.v1";
import { generateScenario } from "../lib/server/scenarios";
import { playGalleryV14 } from "./gallery-v14-play-fixture";
import { verifyCoreFixture } from "./core-test-utils";
import fixture from "./fixtures/gallery-v14.json" with { type: "json" };

assert.equal(core.gameVersion, "14.0.0");
assert.equal(SHOT_GALLERY_CORE_V13.gameVersion, "13.0.0", "V13 stays published");
// Same screens as V13 for the same seed (the rules change, not the jungle).
for (let i = 0; i < 20; i++) {
  const seed: string = generateScenario({ game_id: core.gameId, game_version: core.gameVersion }, i).seed;
  assert.deepEqual(core.create(seed).trials, galleryTrialsV13(seed));
  assert.deepEqual(core.create(seed), core.create(seed));
}
// Every screen is cleared: the run always completes with 12 cleared screens.
const fast = playGalleryV14("gallery14-fast", "correct", 30), slow = playGalleryV14("gallery14-fast", "correct", 90);
for (const m of [fast, slow]) {
  assert.equal(m.s.status, "won");
  assert.equal(m.s.correct, 12);
  assert.ok(m.s.results.every((r) => r.type === "CORRECT" && r.wrongs === 0 && r.spawned === 0));
}
assert.ok(fast.s.score < slow.s.score, "faster is better");
assert.equal(fast.s.score, fast.s.totalMs);
assert.equal(fast.s.height, GALLERY_V14.reachBase - fast.s.totalMs);
const dbl = playGalleryV14("gallery14-fast", "double", 30);
assert.ok(dbl.s.score < fast.s.score, "two fingers at once are faster");
// A wrong shot: +400 ms, the being goes back into hiding and a NEW target comes out at another hiding place.
{
  const s = core.create("gallery14-spawn");
  while (s.phase !== "ready") stepCore(core, s, 1e9);
  const decoy = s.live.findIndex((b) => !b.target), before = galleryRemainingV14(s), spot = s.live[decoy].spot;
  assert.ok(decoy >= 0);
  assert.ok(applyCoreInput(core, s, `PICK_${spot}`, 1e9));
  assert.equal(s.lastAddedMs, GALLERY_V14.wrongPenaltyMs);
  assert.equal(s.live[decoy].gone, s.tick, "the wrong being hides");
  assert.equal(galleryAtSpotV14(s, spot), -1, "its hiding place cannot be shot again");
  assert.equal(galleryRemainingV14(s), before + 1, "one more target to take down");
  const born = s.live.at(-1)!;
  assert.ok(born.target && born.born === s.tick && born.spot !== spot, "the new target comes out elsewhere");
  assert.equal(new Set(s.live.filter((b, i) => b.gone < 0 && !s.hits.includes(i)).map((b) => b.spot)).size, s.live.filter((b, i) => b.gone < 0 && !s.hits.includes(i)).length, "one being per hiding place");
  assert.equal(s.phase, "ready", "the screen stays");
}
const wrong = playGalleryV14("gallery14-wrong", "wrong", 30);
assert.equal(wrong.s.status, "won");
assert.ok(wrong.s.results.every((r) => r.type === "CORRECT"));
assert.ok(wrong.s.results.filter((r) => r.wrongs === 1 && r.spawned === 1).length >= 10, "a wrong shot spawns exactly one target");
const spray = playGalleryV14("gallery14-wrong", "spray", 30);
assert.ok(spray.s.score > wrong.s.score && wrong.s.score > playGalleryV14("gallery14-wrong", "correct", 30).s.score, "spraying never pays");
// Too early: penalised, the screen still has to be cleared.
const early = playGalleryV14("gallery14-early", "early", 30), clean = playGalleryV14("gallery14-early", "correct", 30);
assert.equal(early.s.correct, 12);
assert.ok(early.s.results.every((r) => r.falseStarts === 1));
assert.equal(early.s.totalMs - clean.s.totalMs, 12 * GALLERY_V14.falseStartPenaltyMs);
// Abandoned run: each screen closes after the safety time with the usual penalty per target left standing.
const idle = playGalleryV14("gallery14-idle", "idle");
assert.ok(idle.s.results.every((r) => r.type === "TIMEOUT"));
assert.equal(idle.s.status, "won");
assert.ok(idle.s.tick < core.maxFinalTick, "an idle run still ends inside the time limit");
assert.equal(idle.s.totalMs, idle.s.trials.reduce((sum, t) => sum + t.answers.length * GALLERY_V14.missedPlatePenaltyMs, 0));
// Taps: only a being that is out; one input per tick.
{
  const s = core.create("gallery14-taps");
  while (s.phase !== "ready") stepCore(core, s, 1e9);
  const free = GALLERY_V14.spots.map((_, n) => n).find((n) => galleryAtSpotV14(s, n) < 0)!;
  assert.equal(core.canApply(s, `PICK_${free}`), false, "an empty hiding place cannot be shot");
  assert.equal(core.canApply(s, "PICK_11"), false);
  const [a, b] = s.live.filter((x) => x.target).map((x) => x.spot);
  assert.equal(replayCore(core, [{ seq: 0, tick: s.tick, action: `PICK_${a}` }, { seq: 1, tick: s.tick, action: `PICK_${b}` }], s.tick + 10, s.seed, 1e9).valid, false, "one input per tick");
}
for (const m of [fast, dbl, wrong, spray, early]) {
  const r = replayCore(core, m.inputs, m.s.tick, m.s.seed, 1e9);
  assert.equal(r.valid, true, r.error ?? "");
  assert.deepEqual(r.state, m.s);
}
verifyCoreFixture(core, fixture.seed, fixture.inputs, fixture.finalTick, 1e9, { score: fixture.score, status: "won", failure: null, hash: fixture.hash });
console.log(`Gallery V14 OK · screens stay until cleared · a wrong shot spawns a target · fast ${fast.s.score} ms, wrong ${wrong.s.score} ms, spray ${spray.s.score} ms`);
