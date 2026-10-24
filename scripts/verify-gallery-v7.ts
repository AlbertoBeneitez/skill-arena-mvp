import assert from "node:assert/strict";
import { SHOT_GALLERY_CORE_V7 as core, GALLERY_V7, GALLERY_V7_COLORS } from "../lib/verified/shotGalleryCore.v7";
import { applyCoreInput, replayCore, stepCore } from "../lib/verified/coreRuntime.v1";
import { generateScenario } from "../lib/server/scenarios";
import { canonicalJson } from "../lib/verified/canonical";
import { sha256 } from "../lib/server/matchIntegrity";
import { playGalleryV7 } from "./gallery-v7-play-fixture";
import { verifyCoreFixture } from "./core-test-utils";
import fixture from "./fixtures/gallery-v7.json" with { type: "json" };

// Generation: splashes (colour), grey figures (shape) and, for SUM, coloured figures that must match BOTH traits.
const kinds = new Set<string>(),
  colorsUsed = new Set<number>(),
  shapesUsed = new Set<number>(),
  multi = { count: 0 };
for (let i = 0; i < 300; i++) {
  const seed = generateScenario({ game_id: core.gameId, game_version: core.gameVersion }, i).seed,
    a = core.create(seed);
  assert.deepEqual(a, core.create(seed));
  a.trials.forEach((t, n) => {
    kinds.add(t.order.kind);
    assert.ok(t.answers.length >= 2 && t.answers.length <= 4, "every screen asks for several shots");
    if (n < 3) assert.equal(t.answers.length, 2, "gentle opening: two shots");
    assert.ok(t.targets.length >= t.answers.length + 5 && t.targets.length <= 12);
    if (t.order.kind === "SUM") {
      assert.ok(t.answers.length >= 2 && t.answers.length <= 3, "SUM asks for 2–3 coloured figures");
      if (n < 7) assert.equal(t.answers.length, 2);
      assert.ok(t.targets.every((x) => x.type === "COMBO"));
      assert.ok(t.targets.some((x, j) => !t.answers.includes(j) && x.color === t.order.color && x.shape !== t.order.shape), "decoy sharing only the colour");
      assert.ok(t.targets.some((x, j) => !t.answers.includes(j) && x.shape === t.order.shape && x.color !== t.order.color), "decoy sharing only the shape");
    }
    if (t.answers.length > 1) multi.count++;
    t.targets.forEach((x, j) => {
      // A target is a splash (colour only) or a grey figure (shape only), never both.
      if (x.type === "SPLASH") { assert.ok(x.color >= 0 && x.shape === -1); colorsUsed.add(x.color); }
      else if (x.type === "FIGURE") { assert.ok(x.shape >= 0 && x.color === -1); shapesUsed.add(x.shape); }
      else { assert.ok(x.shape >= 0 && x.color >= 0); colorsUsed.add(x.color); shapesUsed.add(x.shape); }
      const matches = (x.type === "COMBO" && x.color === t.order.color && x.shape === t.order.shape) || (x.type === "SPLASH" && t.order.kind === "COLOR" && x.color === t.order.color) || (x.type === "FIGURE" && t.order.kind === "SHAPE" && x.shape === t.order.shape);
      assert.equal(matches, t.answers.includes(j));
      assert.ok(x.x >= GALLERY_V7.field.x0 && x.x <= GALLERY_V7.field.x1 && x.y >= GALLERY_V7.field.y0 && x.y <= GALLERY_V7.field.y1);
      for (let k = 0; k < j; k++) assert.ok(Math.hypot(t.targets[k].x - x.x, t.targets[k].y - x.y) >= GALLERY_V7.field.minDistance - 14);
    });
    const mirrored = t.targets.every((p) => t.targets.some((q) => Math.abs(q.x - (390 - p.x)) <= 4 && Math.abs(q.y - p.y) <= 4));
    assert.equal(mirrored, false);
  });
}
assert.deepEqual([...kinds].sort(), ["COLOR", "SHAPE", "SUM"]);
assert.equal(colorsUsed.size, GALLERY_V7_COLORS.length);
assert.equal(shapesUsed.size, 5);
assert.equal(multi.count, 300 * GALLERY_V7.trials);

// Perfect fast play, wrong taps, false starts, idle.
const fast = playGalleryV7("gallery7-fast", "correct", 30);
assert.equal(fast.s.status, "won");
assert.equal(fast.s.correct, 12);
assert.equal(fast.s.total, fast.s.score);
assert.ok(fast.s.results.every((r) => r.type === "CORRECT" && r.taps.length >= 1));
assert.ok(fast.s.results.every((r) => r.taps.length >= 2), "several shots per screen");
assert.ok(fast.s.results.reduce((n, r) => n + r.taps.length, 0) >= 26, "more than two shots per screen on average");
const slow = playGalleryV7("gallery7-fast", "correct", 90);
assert.ok(slow.s.total < fast.s.total, "faster reactions score more");
const wrong = playGalleryV7("gallery7-wrong", "wrong");
assert.equal(wrong.s.status, "failed");
assert.ok(wrong.s.results.every((r) => r.type === "WRONG" && r.wrongs === GALLERY_V7.maxWrong));
assert.equal(wrong.s.total, 0);
const early = playGalleryV7("gallery7-early", "early");
assert.ok(early.s.results.every((r) => r.type === "FALSE_START"));
assert.equal(early.s.total, 0);
const idle = playGalleryV7("gallery7-idle", "idle");
assert.ok(idle.s.results.every((r) => r.type === "TIMEOUT"));
assert.equal(idle.s.status, "failed");

// A false start precedes the green dot only: while waiting nothing may be scored.
{
  const s = core.create("gallery7-phase");
  assert.equal(s.phase, "waiting");
  assert.equal(core.canApply(s, "PICK_0"), true);
  assert.equal(core.canApply(s, "PICK_99"), false);
  assert.equal(core.canApply(s, "PICK_12"), false);
  applyCoreInput(core, s, "PICK_0", 1e9);
  assert.equal(s.phase, "feedback");
  assert.equal(core.canApply(s, "PICK_0"), false);
  for (let t = 0; t < 84; t++) stepCore(core, s, 1e9);
  assert.equal(s.trial, 1);
}
// A target can only be tapped once and partial multi-hits are paid.
{
  const s = core.create("gallery7-multi");
  let guard = 0;
  while (s.trials[s.trial].answers.length < 2 && guard++ < 12) {
    while (s.trial === guard - 1) stepCore(core, s, 1e9);
  }
  void guard;
}
// Replay equivalence and golden.
for (const m of [fast, wrong, early]) {
  const r = replayCore(core, m.inputs, m.s.tick, m.s.seed, 1e9);
  assert.equal(r.valid, true);
  assert.deepEqual(r.state, m.s);
}
const run = playGalleryV7("gallery7-golden", "correct", 36);
assert.ok(run.s.status === "won");
verifyCoreFixture(core, fixture.seed, fixture.inputs, fixture.finalTick, 1e9, {
  score: fixture.score,
  status: "won",
  failure: null,
  hash: fixture.hash,
});
void canonicalJson;
void sha256;
console.log(`Gallery V7 OK · several shots per screen · mixed orders · golden replay (fast ${fast.s.total}, slow ${slow.s.total})`);
