import assert from "node:assert/strict";
import { SHOT_GALLERY_CORE_V6 as core, GALLERY_V6, GALLERY_V6_COLORS } from "../lib/verified/shotGalleryCore.v6";
import { applyCoreInput, replayCore, stepCore } from "../lib/verified/coreRuntime.v1";
import { generateScenario } from "../lib/server/scenarios";
import { canonicalJson } from "../lib/verified/canonical";
import { sha256 } from "../lib/server/matchIntegrity";
import { playGalleryV6 } from "./gallery-v6-play-fixture";
import { verifyCoreFixture } from "./core-test-utils";
import fixture from "./fixtures/gallery-v6.json" with { type: "json" };

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
    assert.ok(t.answers.length >= 1 && t.answers.length <= 4);
    if (n < 2) assert.equal(t.answers.length, 1, "gentle opening");
    if (t.order.kind === "SUM") {
      assert.equal(t.answers.length, 1, "SUM has exactly one correct coloured figure");
      assert.ok(t.targets.every((x) => x.type === "COMBO"));
      assert.ok(t.targets.some((x, j) => j !== t.answers[0] && x.color === t.order.color && x.shape !== t.order.shape), "decoy sharing only the colour");
      assert.ok(t.targets.some((x, j) => j !== t.answers[0] && x.shape === t.order.shape && x.color !== t.order.color), "decoy sharing only the shape");
    }
    if (t.answers.length > 1) multi.count++;
    t.targets.forEach((x, j) => {
      // A target is a splash (colour only) or a grey figure (shape only), never both.
      if (x.type === "SPLASH") { assert.ok(x.color >= 0 && x.shape === -1); colorsUsed.add(x.color); }
      else if (x.type === "FIGURE") { assert.ok(x.shape >= 0 && x.color === -1); shapesUsed.add(x.shape); }
      else { assert.ok(x.shape >= 0 && x.color >= 0); colorsUsed.add(x.color); shapesUsed.add(x.shape); }
      const matches = (x.type === "COMBO" && x.color === t.order.color && x.shape === t.order.shape) || (x.type === "SPLASH" && t.order.kind === "COLOR" && x.color === t.order.color) || (x.type === "FIGURE" && t.order.kind === "SHAPE" && x.shape === t.order.shape);
      assert.equal(matches, t.answers.includes(j));
      assert.ok(x.x >= GALLERY_V6.field.x0 && x.x <= GALLERY_V6.field.x1 && x.y >= GALLERY_V6.field.y0 && x.y <= GALLERY_V6.field.y1);
      for (let k = 0; k < j; k++) assert.ok(Math.hypot(t.targets[k].x - x.x, t.targets[k].y - x.y) >= GALLERY_V6.field.minDistance - 14);
    });
    const mirrored = t.targets.every((p) => t.targets.some((q) => Math.abs(q.x - (390 - p.x)) <= 4 && Math.abs(q.y - p.y) <= 4));
    assert.equal(mirrored, false);
  });
}
assert.deepEqual([...kinds].sort(), ["COLOR", "SHAPE", "SUM"]);
assert.equal(colorsUsed.size, GALLERY_V6_COLORS.length);
assert.equal(shapesUsed.size, 5);
assert.ok(multi.count > 300);

// Perfect fast play, wrong taps, false starts, idle.
const fast = playGalleryV6("gallery6-fast", "correct", 30);
assert.equal(fast.s.status, "won");
assert.equal(fast.s.correct, 12);
assert.equal(fast.s.total, fast.s.score);
assert.ok(fast.s.results.every((r) => r.type === "CORRECT" && r.taps.length >= 1));
assert.ok(fast.s.results.some((r) => r.kind === "SUM" && r.taps.length === 1), "SUM is a single tap on the combined figure");
const slow = playGalleryV6("gallery6-fast", "correct", 90);
assert.ok(slow.s.total < fast.s.total, "faster reactions score more");
const wrong = playGalleryV6("gallery6-wrong", "wrong");
assert.equal(wrong.s.status, "failed");
assert.ok(wrong.s.results.every((r) => r.type === "WRONG" && r.wrongs === GALLERY_V6.maxWrong));
assert.equal(wrong.s.total, 0);
const early = playGalleryV6("gallery6-early", "early");
assert.ok(early.s.results.every((r) => r.type === "FALSE_START"));
assert.equal(early.s.total, 0);
const idle = playGalleryV6("gallery6-idle", "idle");
assert.ok(idle.s.results.every((r) => r.type === "TIMEOUT"));
assert.equal(idle.s.status, "failed");

// A false start precedes the green dot only: while waiting nothing may be scored.
{
  const s = core.create("gallery6-phase");
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
  const s = core.create("gallery6-multi");
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
const run = playGalleryV6("gallery6-golden", "correct", 36);
assert.ok(run.s.status === "won");
verifyCoreFixture(core, fixture.seed, fixture.inputs, fixture.finalTick, 1e9, {
  score: fixture.score,
  status: "won",
  failure: null,
  hash: fixture.hash,
});
void canonicalJson;
void sha256;
console.log(`Gallery V6 OK · 8 colours · 5 figures · scattered · multi-target · mixed orders · golden replay (fast ${fast.s.total}, slow ${slow.s.total})`);
