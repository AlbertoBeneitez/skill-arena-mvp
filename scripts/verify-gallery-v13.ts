import assert from "node:assert/strict";
import {
  SHOT_GALLERY_CORE_V13 as core, GALLERY_V13, GALLERY_V13_AURAS, GALLERY_V13_FORMS, galleryMatchesV13, galleryTicksToMsV13,
} from "../lib/verified/shotGalleryCore.v13";
import { SHOT_GALLERY_CORE_V12 } from "../lib/verified/shotGalleryCore.v12";
import { applyCoreInput, replayCore, stepCore } from "../lib/verified/coreRuntime.v1";
import { generateScenario } from "../lib/server/scenarios";
import { playGalleryV13 } from "./gallery-v13-play-fixture";
import { verifyCoreFixture } from "./core-test-utils";
import fixture from "./fixtures/gallery-v13.json" with { type: "json" };

assert.equal(core.gameVersion, "13.0.0");
assert.equal(SHOT_GALLERY_CORE_V12.gameVersion, "12.0.0", "V12 stays published");
assert.deepEqual([0, 1, 3, 12, 120].map(galleryTicksToMsV13), [0, 8, 25, 100, 1000], "integer ms from ticks");
assert.equal(GALLERY_V13_AURAS.length, 4, "four auras: green, blue, red, purple");
assert.equal(GALLERY_V13_FORMS.length, 3, "three forms");
// Hiding places: irregular (no two share a height in the same depth band), every depth has several, both ways out.
{
  const spots = GALLERY_V13.spots;
  assert.equal(spots.length, 10);
  for (let d = 0; d < 3; d++) { const ys = spots.filter((p) => p.layer === d).map((p) => p.y); assert.ok(ys.length >= 3 && new Set(ys).size === ys.length, "no rows"); }
  assert.ok(spots.some((p) => p.dir === "LEFT") && spots.some((p) => p.dir === "RIGHT") && spots.some((p) => p.dir === "UP"));
}
const seen = { aura: 0, form: 0, look: 0 };
const values = { aura: [0, 0, 0, 0], form: [0, 0, 0] };
for (let i = 0; i < 200; i++) {
  const seed: string = generateScenario({ game_id: core.gameId, game_version: core.gameVersion }, i).seed;
  const a = core.create(seed);
  assert.deepEqual(a, core.create(seed));
  const kinds = a.trials.map((t) => t.order.kind);
  assert.notEqual(kinds[0], kinds[1], "the first two orders are one of each");
  assert.equal(kinds.filter((k) => k === "AURA").length, 6, "six aura orders and six form orders");
  a.trials.forEach((t, n) => {
    const o = t.order;
    seen[o.kind === "AURA" ? "aura" : "form"]++;
    (o.kind === "AURA" ? values.aura : values.form)[o.value]++;
    assert.equal(t.targets.length, n < 3 ? 4 : n < 6 ? 5 : n < 9 ? 6 : 7, "few beings, a few more each stage");
    assert.ok(t.answers.length >= 2 && t.answers.length <= 3, "2–3 to take down");
    assert.equal(new Set(t.targets.map((x) => x.spot)).size, t.targets.length, "one being per hiding place");
    t.targets.forEach((x, k) => {
      const { spot: _s, aura, form, lookalike, ...where } = x;
      assert.deepEqual(where, GALLERY_V13.spots[x.spot], "beings sit on their hiding place");
      assert.ok(aura >= 0 && aura < 4 && form >= 0 && form < 3);
      assert.equal(t.answers.includes(k), galleryMatchesV13(o, x), "answers are exactly the beings with the ordered trait");
      if (lookalike) {
        seen.look++;
        assert.ok(n >= GALLERY_V13.lookalikeFrom && !galleryMatchesV13(o, x), "a look-alike is a decoy from round 4");
        assert.ok(t.answers.some((j) => (o.kind === "AURA" ? t.targets[j].form === form : t.targets[j].aura === aura)), "it copies a target's other trait");
      }
    });
  });
}
assert.ok(seen.aura === 1200 && seen.form === 1200 && seen.look > 1000, JSON.stringify(seen));
for (const c of [values.aura, values.form]) { const avg = c.reduce((x, y) => x + y, 0) / c.length; for (const v of c) assert.ok(v > avg * 0.8 && v < avg * 1.2, `order values spread ${c}`); }
// Score: accumulated reaction time (lower is better); the run always completes.
const fast = playGalleryV13("gallery13-fast", "correct", 30), slow = playGalleryV13("gallery13-fast", "correct", 90);
assert.equal(fast.s.status, "won");
assert.equal(fast.s.correct, 12);
assert.ok(fast.s.score < slow.s.score, `faster is better (${fast.s.score} < ${slow.s.score})`);
assert.equal(fast.s.score, fast.s.totalMs);
assert.equal(fast.s.height, GALLERY_V13.reachBase - fast.s.totalMs);
const dbl = playGalleryV13("gallery13-fast", "double", 30);
assert.equal(dbl.s.correct, 12);
assert.ok(dbl.s.score < fast.s.score, "two fingers at once are faster");
// Penalties: a wrong being (look-alikes included), a false start, targets left standing.
const wrong = playGalleryV13("gallery13-wrong", "wrong");
assert.ok(wrong.s.results.every((r) => r.type === "WRONG" && r.wrongs === GALLERY_V13.maxWrong));
assert.equal(wrong.s.totalMs, wrong.s.results.reduce((sum, r) => sum + r.wrongs * GALLERY_V13.wrongPenaltyMs, 0) + wrong.s.trials.reduce((sum, t) => sum + t.answers.length * GALLERY_V13.missedPlatePenaltyMs, 0));
const look = playGalleryV13("gallery13-look", "lookalike");
assert.ok(look.s.results.every((r) => r.type === "WRONG"), "a look-alike is never a target");
const early = playGalleryV13("gallery13-early", "early");
assert.ok(early.s.results.every((r) => r.type === "FALSE_START"));
assert.equal(early.s.totalMs, 12 * GALLERY_V13.falseStartPenaltyMs);
const idle = playGalleryV13("gallery13-idle", "idle");
assert.ok(idle.s.results.every((r) => r.type === "TIMEOUT"));
assert.ok(fast.s.score < idle.s.score && fast.s.score < wrong.s.score);
{
  const s = core.create("gallery13-same-tick");
  while (s.phase !== "ready") stepCore(core, s, 1e9);
  const [a, b] = s.trials[0].answers;
  assert.equal(replayCore(core, [{ seq: 0, tick: s.tick, action: `PICK_${a}` }, { seq: 1, tick: s.tick, action: `PICK_${b}` }], s.tick + 10, s.seed, 1e9).valid, false, "one input per tick");
  const k = s.trials[0].targets.findIndex((_, i) => !s.trials[0].answers.includes(i));
  applyCoreInput(core, s, `PICK_${k}`, 1e9);
  assert.equal(s.lastAddedMs, GALLERY_V13.wrongPenaltyMs);
}
for (const m of [fast, dbl, wrong, early]) {
  const r = replayCore(core, m.inputs, m.s.tick, m.s.seed, 1e9);
  assert.equal(r.valid, true);
  assert.deepEqual(r.state, m.s);
}
verifyCoreFixture(core, fixture.seed, fixture.inputs, fixture.finalTick, 1e9, { score: fixture.score, status: "won", failure: null, hash: fixture.hash });
console.log(`Gallery V13 OK · Xeno jungle · aura-or-form orders (6+6) · look-alikes · fast ${fast.s.score} ms, double ${dbl.s.score} ms, idle ${idle.s.score} ms`);
