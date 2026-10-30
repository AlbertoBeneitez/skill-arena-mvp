import assert from "node:assert/strict";
import { SHOT_GALLERY_CORE_V12 as core, GALLERY_V12, GALLERY_V12_CIVILIAN, galleryTicksToMsV12 } from "../lib/verified/shotGalleryCore.v12";
import { applyCoreInput, replayCore, stepCore } from "../lib/verified/coreRuntime.v1";
import { generateScenario } from "../lib/server/scenarios";
import { playGalleryV12 } from "./gallery-v12-play-fixture";
import { verifyCoreFixture } from "./core-test-utils";
import fixture from "./fixtures/gallery-v12.json" with { type: "json" };

assert.deepEqual([0, 1, 3, 12, 120].map(galleryTicksToMsV12), [0, 8, 25, 100, 1000], "integer ms from ticks");
assert.equal(GALLERY_V12.spots.length, 12);
const seen = { camo: 0, holo: 0, civ: 0, two: 0 };
for (let i = 0; i < 200; i++) {
  const seed = generateScenario({ game_id: core.gameId, game_version: core.gameVersion }, i).seed, a = core.create(seed);
  assert.deepEqual(a, core.create(seed));
  a.trials.forEach((t, n) => {
    assert.ok(t.answers.length >= 2 && t.answers.length <= 4, "2–4 targets to take down");
    assert.equal(t.targets.length, Math.min(12, 8 + Math.floor(n / 3)));
    assert.equal(new Set(t.targets.map((x) => x.spot)).size, t.targets.length, "one creature per spot");
    assert.equal(t.order.species.length, n >= GALLERY_V12.twoSpeciesFrom ? 2 : 1);
    if (t.order.species.length === 2) { seen.two++; assert.notEqual(t.order.species[0], t.order.species[1]); }
    t.targets.forEach((x, k) => {
      const spot = GALLERY_V12.spots[x.spot];
      assert.deepEqual({ x: x.x, y: x.y, scaleMilli: x.scaleMilli, cover: x.cover }, spot, "targets sit on their spot");
      const valid = !x.holo && x.species !== GALLERY_V12_CIVILIAN && t.order.species.includes(x.species);
      assert.equal(t.answers.includes(k), valid, "answers are exactly the real ordered species");
      assert.equal(valid, x.decoy === "NONE");
      if (x.decoy === "CAMO") { seen.camo++; assert.ok(n >= GALLERY_V12.camoFrom && !t.order.species.includes(x.species) && t.order.species.includes(x.tint), "camouflage wears the target's colours"); }
      if (x.decoy === "HOLO") { seen.holo++; assert.ok(n >= GALLERY_V12.holoFrom && t.order.species.includes(x.species)); }
      if (x.decoy === "CIVILIAN") seen.civ++;
      if (x.decoy === "OTHER") assert.ok(!t.order.species.includes(x.species) && x.tint === x.species);
    });
    // every ordered species has at least one real target
    for (const sp of t.order.species) assert.ok(t.answers.some((k) => t.targets[k].species === sp), "each ordered species appears");
  });
}
assert.ok(seen.camo > 300 && seen.holo > 300 && seen.civ > 300 && seen.two === 200 * 6, `decoy families present ${JSON.stringify(seen)}`);
// Orders are spread over the six species (first and second ordered species alike).
{
  const first = Array(6).fill(0), second = Array(6).fill(0);
  for (let i = 0; i < 300; i++) core.create(`gallery12-spread-${i}`).trials.forEach((t) => { first[t.order.species[0]]++; if (t.order.species[1] !== undefined) second[t.order.species[1]]++; });
  for (const c of [first, second]) { const avg = c.reduce((a, b) => a + b, 0) / 6; for (const n of c) assert.ok(n > avg * 0.75 && n < avg * 1.25, `species spread ${c}`); }
}
// The score is the accumulated reaction time: faster play scores LESS; the run always completes.
const fast = playGalleryV12("gallery12-fast", "correct", 30), slow = playGalleryV12("gallery12-fast", "correct", 90);
assert.equal(fast.s.status, "won");
assert.equal(fast.s.correct, 12);
assert.ok(fast.s.score < slow.s.score, `faster is better (${fast.s.score} < ${slow.s.score})`);
assert.equal(fast.s.score, fast.s.totalMs);
assert.equal(fast.s.height, GALLERY_V12.reachBase - fast.s.totalMs, "reach mirrors the time for duels");
// Two at once: consecutive-tick pairs are accepted, and the second costs only one tick.
const dbl = playGalleryV12("gallery12-fast", "double", 30);
assert.equal(dbl.s.correct, 12);
const pairs = dbl.inputs.filter((x, k) => k && dbl.inputs[k - 1].tick === x.tick - 1).length;
assert.ok(pairs >= 12, `paired shots ${pairs}`);
assert.ok(dbl.s.score < fast.s.score, `shooting two at once is faster (${dbl.s.score} < ${fast.s.score})`);
{
  const taps = fast.s.results.flatMap((r) => r.taps);
  const expected = fast.s.results.reduce((sum, r) => sum + r.taps.reduce((acc, t, k) => acc + galleryTicksToMsV12(t - (k ? r.taps[k - 1] : 0)), 0), 0);
  assert.ok(taps.length >= 24);
  assert.equal(fast.s.totalMs, expected, "no penalties on a clean run");
}
// Penalties: decoys, civilians (heavier), false starts and targets left standing.
const wrong = playGalleryV12("gallery12-wrong", "wrong");
assert.equal(wrong.s.status, "won");
assert.ok(wrong.s.results.every((r) => r.type === "WRONG" && r.wrongs === GALLERY_V12.maxWrong));
assert.equal(wrong.s.totalMs, wrong.s.results.reduce((sum, r) => sum + r.civilians * GALLERY_V12.civilianPenaltyMs + (r.wrongs - r.civilians) * GALLERY_V12.wrongPenaltyMs, 0) + wrong.s.trials.reduce((sum, t) => sum + t.answers.length * GALLERY_V12.missedPlatePenaltyMs, 0));
const civ = playGalleryV12("gallery12-civ", "civilian");
assert.ok(civ.s.results.some((r) => r.civilians > 0));
{
  const s = core.create("gallery12-one-civ");
  while (s.phase !== "ready") stepCore(core, s, 1e9);
  let k = s.trials[0].targets.findIndex((t) => t.species === GALLERY_V12_CIVILIAN);
  for (let n = 0; k < 0 && n < 400; n++) { const t = core.create(`gallery12-one-civ-${n}`); k = t.trials[0].targets.findIndex((x) => x.species === GALLERY_V12_CIVILIAN); if (k >= 0) { Object.assign(s, t); while (s.phase !== "ready") stepCore(core, s, 1e9); } }
  assert.ok(k >= 0);
  applyCoreInput(core, s, `PICK_${k}`, 1e9);
  assert.equal(s.lastAddedMs, GALLERY_V12.civilianPenaltyMs);
  assert.equal(s.civilians, 1);
  assert.equal(s.lastPick, k);
}
const early = playGalleryV12("gallery12-early", "early");
assert.ok(early.s.results.every((r) => r.type === "FALSE_START"));
assert.equal(early.s.totalMs, 12 * GALLERY_V12.falseStartPenaltyMs);
const idle = playGalleryV12("gallery12-idle", "idle");
assert.ok(idle.s.results.every((r) => r.type === "TIMEOUT"));
assert.equal(idle.s.totalMs, idle.s.trials.reduce((sum, t) => sum + t.answers.length * GALLERY_V12.missedPlatePenaltyMs, 0));
assert.ok(fast.s.score < idle.s.score && fast.s.score < wrong.s.score);
// Same tick twice is not allowed by the replay contract.
{
  const s = core.create("gallery12-same-tick");
  while (s.phase !== "ready") stepCore(core, s, 1e9);
  const [a, b] = s.trials[0].answers;
  const inputs = [{ seq: 0, tick: s.tick, action: `PICK_${a}` }, { seq: 1, tick: s.tick, action: `PICK_${b}` }];
  assert.equal(replayCore(core, inputs, s.tick + 10, s.seed, 1e9).valid, false, "one input per tick");
}
for (const m of [fast, dbl, wrong, early]) {
  const r = replayCore(core, m.inputs, m.s.tick, m.s.seed, 1e9);
  assert.equal(r.valid, true);
  assert.deepEqual(r.state, m.s);
}
verifyCoreFixture(core, fixture.seed, fixture.inputs, fixture.finalTick, 1e9, { score: fixture.score, status: "won", failure: null, hash: fixture.hash });
console.log(`Gallery V12 OK · hangar species orders · camouflage/hologram/civilian decoys · two-at-once ${pairs} pairs · fast ${fast.s.score} ms, double ${dbl.s.score} ms, idle ${idle.s.score} ms`);
