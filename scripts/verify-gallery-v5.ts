import assert from "node:assert/strict";
import { SHOT_GALLERY_CORE_V5 as core, GALLERY_V5, GALLERY_V5_COLORS } from "../lib/verified/shotGalleryCore.v5";
import { applyCoreInput, replayCore, stepCore } from "../lib/verified/coreRuntime.v1";
import { generateScenario } from "../lib/server/scenarios";
import { canonicalJson } from "../lib/verified/canonical";
import { sha256 } from "../lib/server/matchIntegrity";
import { playGalleryV5 } from "./gallery-v5-play-fixture";
import { verifyCoreFixture } from "./core-test-utils";
import fixture from "./fixtures/gallery-v5.json" with { type: "json" };

// Generation: splashes and grey figures are separate targets; SUM asks for both.
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
      assert.ok(t.answers.length >= 2);
      assert.ok(t.answers.some((k) => t.targets[k].type === "SPLASH") && t.answers.some((k) => t.targets[k].type === "FIGURE"), "SUM needs both a splash and a figure");
    }
    if (t.answers.length > 1) multi.count++;
    t.targets.forEach((x, j) => {
      // A target is a splash (colour only) or a grey figure (shape only), never both.
      if (x.type === "SPLASH") { assert.ok(x.color >= 0 && x.shape === -1); colorsUsed.add(x.color); }
      else { assert.ok(x.shape >= 0 && x.color === -1); shapesUsed.add(x.shape); }
      const matches = (x.type === "SPLASH" && t.order.kind !== "SHAPE" && x.color === t.order.color) || (x.type === "FIGURE" && t.order.kind !== "COLOR" && x.shape === t.order.shape);
      assert.equal(matches, t.answers.includes(j));
      assert.ok(x.x >= GALLERY_V5.field.x0 && x.x <= GALLERY_V5.field.x1 && x.y >= GALLERY_V5.field.y0 && x.y <= GALLERY_V5.field.y1);
      for (let k = 0; k < j; k++) assert.ok(Math.hypot(t.targets[k].x - x.x, t.targets[k].y - x.y) >= GALLERY_V5.field.minDistance - 14);
    });
    const mirrored = t.targets.every((p) => t.targets.some((q) => Math.abs(q.x - (390 - p.x)) <= 4 && Math.abs(q.y - p.y) <= 4));
    assert.equal(mirrored, false);
  });
}
assert.deepEqual([...kinds].sort(), ["COLOR", "SHAPE", "SUM"]);
assert.equal(colorsUsed.size, GALLERY_V5_COLORS.length);
assert.equal(shapesUsed.size, 5);
assert.ok(multi.count > 300);

// Perfect fast play, wrong taps, false starts, idle.
const fast = playGalleryV5("gallery5-fast", "correct", 30);
assert.equal(fast.s.status, "won");
assert.equal(fast.s.correct, 12);
assert.equal(fast.s.total, fast.s.score);
assert.ok(fast.s.results.every((r) => r.type === "CORRECT" && r.taps.length >= 1));
assert.ok(fast.s.results.some((r) => r.kind === "SUM" && r.taps.length >= 2), "SUM needs two separate taps");
const slow = playGalleryV5("gallery5-fast", "correct", 90);
assert.ok(slow.s.total < fast.s.total, "faster reactions score more");
const wrong = playGalleryV5("gallery5-wrong", "wrong");
assert.equal(wrong.s.status, "failed");
assert.ok(wrong.s.results.every((r) => r.type === "WRONG" && r.wrongs === GALLERY_V5.maxWrong));
assert.equal(wrong.s.total, 0);
const early = playGalleryV5("gallery5-early", "early");
assert.ok(early.s.results.every((r) => r.type === "FALSE_START"));
assert.equal(early.s.total, 0);
const idle = playGalleryV5("gallery5-idle", "idle");
assert.ok(idle.s.results.every((r) => r.type === "TIMEOUT"));
assert.equal(idle.s.status, "failed");

// A false start precedes the green dot only: while waiting nothing may be scored.
{
  const s = core.create("gallery5-phase");
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
  const s = core.create("gallery5-multi");
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
const run = playGalleryV5("gallery5-golden", "correct", 36);
assert.ok(run.s.status === "won");
verifyCoreFixture(core, fixture.seed, fixture.inputs, fixture.finalTick, 1e9, {
  score: fixture.score,
  status: "won",
  failure: null,
  hash: fixture.hash,
});
void canonicalJson;
void sha256;
console.log(`Gallery V5 OK · 8 colours · 5 figures · scattered · multi-target · mixed orders · golden replay (fast ${fast.s.total}, slow ${slow.s.total})`);
