import assert from "node:assert/strict";
import {
  SHOT_GALLERY_CORE as core,
  GALLERY_COLORS,
  GALLERY_SHAPES,
} from "../lib/verified/shotGalleryCore.v1";
import {
  applyCoreInput,
  stepCore,
  replayCore,
} from "../lib/verified/coreRuntime.v1";
import { generateScenario } from "../lib/server/scenarios";
import type { ReplayInput } from "../lib/verified/inputValidation";
import fixture from "./fixtures/gallery-v1.json" with { type: "json" };
import { verifyCoreFixture } from "./core-test-utils";
const target = 1000000;
function run(seed: string) {
  const state = core.create(seed),
    inputs: ReplayInput[] = [];
  while (state.status === "running") {
    if (state.phase === "ready" && state.phaseTicks >= 24 + state.trial * 3) {
      const action = `PICK_${state.trials[state.trial].answer}`;
      inputs.push({ seq: inputs.length, tick: state.tick, action });
      assert.equal(applyCoreInput(core, state, action, target), true);
      assert.equal(
        core.canApply(state, action),
        false,
        "double response rejected",
      );
    }
    if (state.status === "running") stepCore(core, state, target);
  }
  assert.equal(state.status, "won");
  assert.equal(state.correct, 12);
  assert.equal(state.results.length, 12);
  assert.equal(
    state.score,
    state.results.reduce((sum, r) => sum + r.award, 0),
  );
  assert.deepEqual(
    replayCore(core, inputs, state.tick, seed, target).state,
    state,
  );
  return { state, inputs };
}
const seed = generateScenario(
    { game_id: "reaction-test", game_version: "1.0.0" },
    7,
  ).seed,
  first = run(seed);
assert.equal(seed, fixture.seed);
assert.deepEqual(first.inputs, fixture.inputs);
verifyCoreFixture(
  core,
  fixture.seed,
  fixture.inputs,
  fixture.finalTick,
  target,
  { score: fixture.score, status: "won", failure: null, hash: fixture.hash },
);
for (let i = 0; i < 128; i++) {
  const s = core.create(
    generateScenario({ game_id: "reaction-test", game_version: "1.0.0" }, i)
      .seed,
  );
  assert.deepEqual(core.create(s.seed), s);
  for (const t of s.trials) {
    assert.ok(t.answer >= 0 && t.answer < t.cards.length);
    assert.ok(t.waitTicks >= 60);
    const c = t.cards[t.answer];
    if (t.kind === "COLOR") {
      const word = t.rule.replace("COLOR ", "");
      assert.equal(GALLERY_COLORS[c.color], word);
      assert.equal(
        t.cards.filter((c) => GALLERY_COLORS[c.color] === word).length,
        1,
      );
    }
    if (t.kind === "SHAPE")
      assert.equal(
        t.cards.filter((c) => GALLERY_SHAPES[c.shape] === t.rule).length,
        1,
      );
    if (t.kind === "NUMBER")
      assert.equal(
        c.number,
        t.rule.includes("MAYOR")
          ? Math.max(...t.cards.map((c) => c.number))
          : t.rule.includes("MENOR")
            ? Math.min(...t.cards.map((c) => c.number))
            : t.cards.find((c) => c.number % 2 === 0)!.number,
      );
    if (t.kind === "COMBINATION")
      assert.equal(
        t.cards.filter(
          (c) =>
            `${GALLERY_SHAPES[c.shape]} ${GALLERY_COLORS[c.color]}` === t.rule,
        ).length,
        1,
      );
  }
  if (i < 32) run(s.seed);
}
const falseStart = core.create("false");
assert.equal(applyCoreInput(core, falseStart, "PICK_0", target), true);
assert.equal(falseStart.results[0].type, "FALSE_START");
assert.equal(falseStart.status, "running");
assert.equal(falseStart.correct, 0);
assert.equal(core.canApply(falseStart, "PICK_0"), false);
const wrong = core.create("wrong");
while (wrong.phase === "waiting") stepCore(core, wrong, target);
wrong.score = 500;
applyCoreInput(core, wrong, `PICK_${1 - wrong.trials[0].answer}`, target);
assert.equal(wrong.score, 400);
assert.equal(wrong.results[0].type, "WRONG");
assert.equal(wrong.status, "running");
const idle = core.create("idle");
while (idle.status === "running") stepCore(core, idle, target);
assert.equal(idle.failure, "RECOGNITION_SCORE");
assert.equal(idle.results.length, 12);
assert.ok(idle.results.every((r) => r.type === "TIMEOUT"));
assert.equal(replayCore(core, [], idle.tick, "idle", target).valid, true);
assert.equal(core.canApply(core.create("slots"), "PICK_3"), false);
assert.equal(core.canApply(core.create("slots"), "PICK_4"), false);
for (const reaction of [0, 6, 12]) {
  const s = core.create("cap");
  while (s.phase === "waiting") stepCore(core, s, target);
  for (let i = 0; i < reaction; i++) stepCore(core, s, target);
  applyCoreInput(core, s, `PICK_${s.trials[0].answer}`, target);
  assert.equal(s.score, 900, "no bonus advantage below 100ms");
}
console.log(
  "Shot Gallery: 1536 unique-answer trials, 32 complete aggregate replays, color/shape/number/combined rules, cap, false start/wrong/timeout without early death",
);
