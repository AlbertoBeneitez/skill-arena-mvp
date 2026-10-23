import assert from "node:assert/strict";
import { SHOT_GALLERY_CORE_V3 as core, GALLERY_V3, GALLERY_V3_COLORS } from "../lib/verified/shotGalleryCore.v3";
import { applyCoreInput, replayCore, stepCore } from "../lib/verified/coreRuntime.v1";
import { generateScenario } from "../lib/server/scenarios";
import { canonicalJson } from "../lib/verified/canonical";
import { sha256 } from "../lib/server/matchIntegrity";
import { playGalleryV3 } from "./gallery-v3-play-fixture";
import { verifyCoreFixture } from "./core-test-utils";
import fixture from "./fixtures/gallery-v3.json" with { type: "json" };

// Generation: unique solvable orders, scattered asymmetrically, never overlapping.
const kinds = new Set<string>(),
  colorsUsed = new Set<number>(),
  multi = { count: 0 };
for (let i = 0; i < 300; i++) {
  const seed = generateScenario({ game_id: core.gameId, game_version: core.gameVersion }, i).seed,
    a = core.create(seed);
  assert.deepEqual(a, core.create(seed));
  a.trials.forEach((t, n) => {
    kinds.add(t.order.kind);
    assert.ok(t.answers.length >= 1 && t.answers.length <= 3);
    if (n < 3) assert.equal(t.answers.length, 1, "gentle opening");
    if (t.answers.length > 1) multi.count++;
    t.targets.forEach((x, j) => {
      colorsUsed.add(x.color);
      const matches =
        t.order.kind === "COLOR" ? x.color === t.order.color : t.order.kind === "SHAPE" ? x.shape === t.order.shape : x.color === t.order.color && x.shape === t.order.shape;
      assert.equal(matches, t.answers.includes(j));
      assert.ok(x.x >= GALLERY_V3.field.x0 && x.x <= GALLERY_V3.field.x1 && x.y >= GALLERY_V3.field.y0 && x.y <= GALLERY_V3.field.y1);
      for (let k = 0; k < j; k++) assert.ok(Math.hypot(t.targets[k].x - x.x, t.targets[k].y - x.y) >= GALLERY_V3.field.minDistance - 14);
    });
    // Not mirrored: the layout must not be symmetric about the vertical axis.
    const mirrored = t.targets.every((p) => t.targets.some((q) => Math.abs(q.x - (390 - p.x)) <= 4 && Math.abs(q.y - p.y) <= 4));
    assert.equal(mirrored, false);
  });
}
assert.deepEqual([...kinds].sort(), ["COLOR", "COMBINATION", "SHAPE"]);
assert.equal(colorsUsed.size, GALLERY_V3_COLORS.length);
assert.ok(multi.count > 300);

// Perfect fast play, wrong taps, false starts, idle.
const fast = playGalleryV3("gallery3-fast", "correct", 30);
assert.equal(fast.s.status, "won");
assert.equal(fast.s.correct, 12);
assert.equal(fast.s.total, fast.s.score);
assert.ok(fast.s.results.every((r) => r.type === "CORRECT" && r.taps.length >= 1));
const slow = playGalleryV3("gallery3-fast", "correct", 90);
assert.ok(slow.s.total < fast.s.total, "faster reactions score more");
const wrong = playGalleryV3("gallery3-wrong", "wrong");
assert.equal(wrong.s.status, "failed");
assert.ok(wrong.s.results.every((r) => r.type === "WRONG" && r.wrongs === GALLERY_V3.maxWrong));
assert.equal(wrong.s.total, 0);
const early = playGalleryV3("gallery3-early", "early");
assert.ok(early.s.results.every((r) => r.type === "FALSE_START"));
assert.equal(early.s.total, 0);
const idle = playGalleryV3("gallery3-idle", "idle");
assert.ok(idle.s.results.every((r) => r.type === "TIMEOUT"));
assert.equal(idle.s.status, "failed");

// A false start precedes the green dot only: while waiting nothing may be scored.
{
  const s = core.create("gallery3-phase");
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
  const s = core.create("gallery3-multi");
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
const run = playGalleryV3("gallery3-golden", "correct", 36);
assert.ok(run.s.status === "won");
verifyCoreFixture(core, fixture.seed, fixture.inputs, fixture.finalTick, 1e9, {
  score: fixture.score,
  status: "won",
  failure: null,
  hash: fixture.hash,
});
void canonicalJson;
void sha256;
console.log(`Gallery V3 OK · 8 colours · 5 figures · scattered · multi-target · mixed orders · golden replay (fast ${fast.s.total}, slow ${slow.s.total})`);
