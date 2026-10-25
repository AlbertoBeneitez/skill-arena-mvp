import assert from "node:assert/strict";
import { SHOT_GALLERY_CORE_V9 as core, GALLERY_V9, galleryTargetPosV9 } from "../lib/verified/shotGalleryCore.v9";
import { applyCoreInput, replayCore, stepCore } from "../lib/verified/coreRuntime.v1";
import { generateScenario } from "../lib/server/scenarios";
import { playGalleryV9 } from "./gallery-v9-play-fixture";
import { verifyCoreFixture } from "./core-test-utils";
import fixture from "./fixtures/gallery-v9.json" with { type: "json" };

// Generation: every order is colour + figure; every target is a coloured figure on a static plate; decoys share one trait.
const colours = new Set<number>(), shapes = new Set<number>();
for (let i = 0; i < 300; i++) {
  const seed = generateScenario({ game_id: core.gameId, game_version: core.gameVersion }, i).seed, a = core.create(seed);
  assert.deepEqual(a, core.create(seed));
  a.trials.forEach((t, n) => {
    assert.equal(t.targets.length, Math.min(12, 8 + Math.floor(n / 3)));
    assert.ok(t.answers.length >= 2 && t.answers.length <= 4, "several shots per screen");
    if (n < 3) assert.equal(t.answers.length, 2);
    t.targets.forEach((x, j) => {
      assert.ok(x.color >= 0 && x.color < 8 && x.shape >= 0 && x.shape < 5, "colour and figure on every target");
      assert.equal(x.color === t.order.color && x.shape === t.order.shape, t.answers.includes(j));
      colours.add(x.color); shapes.add(x.shape);
    });
    assert.ok(t.targets.some((x, j) => !t.answers.includes(j) && x.color === t.order.color), "decoy sharing only the colour");
    assert.ok(t.targets.some((x, j) => !t.answers.includes(j) && x.shape === t.order.shape), "decoy sharing only the figure");
    // Plates are static and well spaced inside the range.
    for (const x of t.targets) {
      assert.deepEqual(galleryTargetPosV9(x), { x: x.x, y: x.y }, "plates never move");
      assert.ok(x.x >= GALLERY_V9.field.x0 && x.x <= GALLERY_V9.field.x1 && x.y >= GALLERY_V9.field.y0 && x.y <= GALLERY_V9.field.y1);
    }
    let close = 0;
    for (let p = 0; p < t.targets.length; p++) for (let q = p + 1; q < t.targets.length; q++)
      if (Math.hypot(t.targets[p].x - t.targets[q].x, t.targets[p].y - t.targets[q].y) < 50) close++;
    assert.equal(close, 0, "plates never overlap");
  });
}
assert.equal(colours.size, 8);
assert.equal(shapes.size, 5);
const fast = playGalleryV9("gallery9-fast", "correct", 30);
assert.equal(fast.s.status, "won");
assert.equal(fast.s.correct, 12);
assert.ok(fast.s.results.every((r) => r.taps.length >= 2));
const slow = playGalleryV9("gallery9-fast", "correct", 90);
assert.ok(slow.s.total < fast.s.total);
const wrong = playGalleryV9("gallery9-wrong", "wrong");
assert.equal(wrong.s.status, "failed");
assert.equal(wrong.s.total, 0);
const early = playGalleryV9("gallery9-early", "early");
assert.ok(early.s.results.every((r) => r.type === "FALSE_START"));
const idle = playGalleryV9("gallery9-idle", "idle");
assert.ok(idle.s.results.every((r) => r.type === "TIMEOUT"));
{
  const s = core.create("gallery9-phase");
  assert.equal(core.canApply(s, "PICK_12"), false);
  applyCoreInput(core, s, "PICK_0", 1e9);
  assert.equal(s.phase, "feedback");
  for (let t = 0; t < GALLERY_V9.feedbackTicks; t++) stepCore(core, s, 1e9);
  assert.equal(s.trial, 1);
}
for (const m of [fast, wrong, early]) {
  const r = replayCore(core, m.inputs, m.s.tick, m.s.seed, 1e9);
  assert.equal(r.valid, true);
  assert.deepEqual(r.state, m.s);
}
verifyCoreFixture(core, fixture.seed, fixture.inputs, fixture.finalTick, 1e9, { score: fixture.score, status: "won", failure: null, hash: fixture.hash });
console.log(`Gallery V9 OK · colour+figure orders · static plates · fast ${fast.s.total} slow ${slow.s.total}`);
