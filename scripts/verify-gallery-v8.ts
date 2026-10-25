import assert from "node:assert/strict";
import { SHOT_GALLERY_CORE_V8 as core, GALLERY_V8, galleryTargetPosV8 } from "../lib/verified/shotGalleryCore.v8";
import { applyCoreInput, replayCore, stepCore } from "../lib/verified/coreRuntime.v1";
import { generateScenario } from "../lib/server/scenarios";
import { playGalleryV8 } from "./gallery-v8-play-fixture";
import { verifyCoreFixture } from "./core-test-utils";
import fixture from "./fixtures/gallery-v8.json" with { type: "json" };

// Generation: every order is colour + figure; every target is a coloured figure on a rail; decoys share one trait.
const colours = new Set<number>(), shapes = new Set<number>();
for (let i = 0; i < 300; i++) {
  const seed = generateScenario({ game_id: core.gameId, game_version: core.gameVersion }, i).seed, a = core.create(seed);
  assert.deepEqual(a, core.create(seed));
  a.trials.forEach((t, n) => {
    assert.equal(t.targets.length, GALLERY_V8.rails.length * GALLERY_V8.perRail);
    assert.ok(t.answers.length >= 2 && t.answers.length <= 4, "several shots per screen");
    if (n < 3) assert.equal(t.answers.length, 2);
    t.targets.forEach((x, j) => {
      assert.ok(x.color >= 0 && x.color < 8 && x.shape >= 0 && x.shape < 5, "colour and figure on every target");
      assert.equal(x.color === t.order.color && x.shape === t.order.shape, t.answers.includes(j));
      colours.add(x.color); shapes.add(x.shape);
    });
    assert.ok(t.targets.some((x, j) => !t.answers.includes(j) && x.color === t.order.color), "decoy sharing only the colour");
    assert.ok(t.targets.some((x, j) => !t.answers.includes(j) && x.shape === t.order.shape), "decoy sharing only the figure");
    // Stands on one rail keep their spacing (never overlap) and move with time.
    for (const rail of [0, 1, 2]) {
      const on = t.targets.filter((x) => x.rail === rail);
      assert.equal(new Set(on.map((x) => x.speed)).size, 1);
      for (const ticks of [0, 300, 900]) {
        const xs = on.map((x) => galleryTargetPosV8(x, ticks).x).sort((p, q) => p - q);
        for (let k = 1; k < xs.length; k++) assert.ok(xs[k] - xs[k - 1] > 70, "stands never overlap");
      }
      assert.notEqual(galleryTargetPosV8(on[0], 0).x, galleryTargetPosV8(on[0], 240).x, "stands slide");
    }
  });
}
assert.equal(colours.size, 8);
assert.equal(shapes.size, 5);
const fast = playGalleryV8("gallery8-fast", "correct", 30);
assert.equal(fast.s.status, "won");
assert.equal(fast.s.correct, 12);
assert.ok(fast.s.results.every((r) => r.taps.length >= 2));
const slow = playGalleryV8("gallery8-fast", "correct", 90);
assert.ok(slow.s.total < fast.s.total);
const wrong = playGalleryV8("gallery8-wrong", "wrong");
assert.equal(wrong.s.status, "failed");
assert.equal(wrong.s.total, 0);
const early = playGalleryV8("gallery8-early", "early");
assert.ok(early.s.results.every((r) => r.type === "FALSE_START"));
const idle = playGalleryV8("gallery8-idle", "idle");
assert.ok(idle.s.results.every((r) => r.type === "TIMEOUT"));
{
  const s = core.create("gallery8-phase");
  assert.equal(core.canApply(s, "PICK_12"), false);
  applyCoreInput(core, s, "PICK_0", 1e9);
  assert.equal(s.phase, "feedback");
  for (let t = 0; t < GALLERY_V8.feedbackTicks; t++) stepCore(core, s, 1e9);
  assert.equal(s.trial, 1);
}
for (const m of [fast, wrong, early]) {
  const r = replayCore(core, m.inputs, m.s.tick, m.s.seed, 1e9);
  assert.equal(r.valid, true);
  assert.deepEqual(r.state, m.s);
}
verifyCoreFixture(core, fixture.seed, fixture.inputs, fixture.finalTick, 1e9, { score: fixture.score, status: "won", failure: null, hash: fixture.hash });
console.log(`Gallery V8 OK · colour+figure orders · moving rails · fast ${fast.s.total} slow ${slow.s.total}`);
