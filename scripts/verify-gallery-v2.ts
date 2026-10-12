import fixture from "./fixtures/gallery-v2.json" with { type: "json" };
import assert from "node:assert/strict";
import {
  SHOT_GALLERY_CORE_V2 as core,
  GALLERY_COLORS,
  GALLERY_SHAPES,
} from "../lib/verified/shotGalleryCore.v2";
import {
  applyCoreInput,
  stepCore,
  replayCore,
} from "../lib/verified/coreRuntime.v1";
import { generateScenario } from "../lib/server/scenarios";
import { canonicalJson } from "../lib/verified/canonical";
import { sha256 } from "../lib/server/matchIntegrity";
import {
  createMatchManifest,
  issueAttemptTicket,
  processAttemptRecord,
} from "../lib/server/verifiedMatch";
import type { ReplayInput } from "../lib/verified/inputValidation";
import { verifyCoreFixture } from "./core-test-utils";
export function playGalleryV2(
  seed: string,
  mode: "correct" | "wrong" | "early" = "correct",
  target = 1e9,
) {
  const s = core.create(seed),
    inputs: ReplayInput[] = [];
  while (s.status === "running") {
    if (
      (mode === "early" && s.phase === "waiting") ||
      (s.phase === "ready" && s.phaseTicks >= 24 + s.trial * 3)
    ) {
      const answer = s.trials[s.trial].answer,
        a = `PICK_${mode === "correct" ? answer : mode === "early" ? 0 : (answer + 1) % 6}`;
      inputs.push({ seq: inputs.length, tick: s.tick, action: a });
      assert.ok(applyCoreInput(core, s, a, target));
      assert.equal(core.canApply(s, a), false);
      assert.equal(
        s.score,
        0,
        "published total must not finish live aggregation",
      );
    }
    if (s.status === "running") stepCore(core, s, target);
  }
  assert.equal(s.results.length, 12);
  assert.equal(s.total, s.score);
  assert.deepEqual(replayCore(core, inputs, s.tick, seed, target).state, s);
  return { s, inputs };
}
const run = playGalleryV2("gallery2-golden");
const golden = {
  seed: run.s.seed,
  inputs: run.inputs,
  finalTick: run.s.tick,
  score: run.s.score,
  hash: sha256(canonicalJson(run.s)),
};
assert.deepEqual(golden, fixture, "frozen inputs/score/tick/hash");
verifyCoreFixture(core, golden.seed, golden.inputs, golden.finalTick, 1e9, {
  score: golden.score,
  status: "won",
  failure: null,
  hash: golden.hash,
});
for (const target of [1, 2500, 7500, 1e9])
  assert.deepEqual(playGalleryV2(golden.seed, "correct", target), run);
const layouts = new Set<string>(),
  numberRules = new Set<string>();
for (let i = 0; i < 1000; i++) {
  const seed = generateScenario(
      { game_id: core.gameId, game_version: core.gameVersion },
      i,
    ).seed,
    s = core.create(seed);
  assert.deepEqual(core.create(seed), s);
  layouts.add(JSON.stringify(s.trials));
  for (const t of s.trials) {
    assert.equal(t.cards.length, 6);
    assert.ok(t.answer >= 0 && t.answer < 6);
    const matches = t.cards.filter((c) =>
      t.kind === "COLOR"
        ? `COLOR ${GALLERY_COLORS[c.color]}` === t.rule
        : t.kind === "SHAPE"
          ? GALLERY_SHAPES[c.shape] === t.rule
          : t.kind === "COMBINATION"
            ? `${GALLERY_SHAPES[c.shape]} ${GALLERY_COLORS[c.color]}` === t.rule
            : t.rule.includes("MAYOR")
              ? c.number === Math.max(...t.cards.map((c) => c.number))
              : t.rule.includes("MENOR")
                ? c.number === Math.min(...t.cards.map((c) => c.number))
                : c.number % 2 === 0,
    );
    assert.equal(matches.length, 1);
    assert.deepEqual(matches[0], t.cards[t.answer]);
    if (t.kind === "NUMBER") numberRules.add(t.rule);
  }
  if (i < 32) assert.equal(playGalleryV2(seed).s.correct, 12);
}
assert.equal(layouts.size, 1000);
assert.equal(numberRules.size, 3);
for (const mode of ["wrong", "early"] as const) {
  const r = playGalleryV2(`gallery2-${mode}`, mode);
  assert.equal(r.s.status, "failed");
  assert.equal(r.s.score, 0);
  assert.ok(
    r.s.results.every(
      (t) => t.type === (mode === "wrong" ? "WRONG" : "FALSE_START"),
    ),
  );
}
const idle = core.create("gallery2-idle");
while (idle.status === "running") stepCore(core, idle, 1e9);
assert.ok(idle.results.every((r) => r.type === "TIMEOUT"));
assert.equal(replayCore(core, [], idle.tick, idle.seed, 1e9).valid, true);
assert.equal(
  replayCore(core, [{ seq: 0, tick: 0, action: "PICK_6" }], 0, "bad", 1e9)
    .error,
  "INVALID_INPUT",
);
const manifest = createMatchManifest({
    gameId: core.gameId,
    gameVersion: core.gameVersion,
    seed: golden.seed,
    targetScore: 1,
  }),
  ticket = issueAttemptTicket({ manifest, playerId: "gallery2-test" }),
  now = Date.now;
try {
  Date.now = () => Date.parse(ticket.issued_at) + 60000;
  const r = processAttemptRecord({
    manifest,
    ticket,
    inputs: run.inputs,
    final_tick: run.s.tick,
    score: 999999,
  });
  assert.equal(r.status, 200);
  assert.ok("score" in r.body);
  assert.equal(r.body.score, run.s.score);
  assert.notEqual(
    processAttemptRecord({
      manifest: { ...manifest, seed: "client-choice" },
      ticket,
      inputs: run.inputs,
      final_tick: run.s.tick,
    }).status,
    200,
  );
} finally {
  Date.now = now;
}
console.log(
  "Gallery V2: 1000 six-target templates, unique answers and three number rules,32 aggregate wins,wrong/early/timeout, target independence and signed input-only replay",
);
