import assert from "node:assert/strict";
import {
  DARTS_CORE_V3 as core,
  DARTS_RULES_V3,
  dartsDriftV3,
} from "../lib/verified/dartsCore.v3";
import {
  applyCoreInput,
  stepCore,
  replayCore,
  advanceCoreToTick,
} from "../lib/verified/coreRuntime.v1";
import type { ReplayInput } from "../lib/verified/inputValidation";
import { generateScenario } from "../lib/server/scenarios";
import { verifyCoreFixture } from "./core-test-utils";
import { canonicalJson } from "../lib/verified/canonical";
import { sha256 } from "../lib/server/matchIntegrity";
import {
  createMatchManifest,
  issueAttemptTicket,
  processAttemptRecord,
} from "../lib/server/verifiedMatch";
import fixture from "./fixtures/darts-v3.json" with { type: "json" };
export function playDartsV3(seed: string, miss = false, target = 1e9) {
  const state = core.create(seed),
    inputs: ReplayInput[] = [];
  function send(action: string) {
    if (!core.canApply(state, action)) return;
    inputs.push({ seq: inputs.length, tick: state.tick, action });
    assert.ok(applyCoreInput(core, state, action, target));
    stepCore(core, state, target);
  }
  while (state.status === "running") {
    if (state.phase !== "aim") {
      stepCore(core, state, target);
      continue;
    }
    advanceCoreToTick(
      core,
      state,
      state.tick + 45 + state.throwIndex * 3,
      target,
    );
    if (miss) {
      send("AIM_X_00");
      send("AIM_Y_60");
    }
    send("THROW");
    assert.equal(core.canApply(state, "THROW"), false);
  }
  assert.equal(state.impacts.length, 20);
  assert.equal(state.throwIndex, 20);
  assert.equal(
    state.score,
    state.impacts.reduce((sum, p) => sum + p.points, 0),
  );
  assert.equal(state.total, state.score);
  assert.ok(state.impacts.every((p) => p.award === p.points));
  assert.deepEqual(
    replayCore(core, inputs, state.tick, seed, target).state,
    state,
  );
  return { state, inputs };
}
const run = playDartsV3(fixture.seed);
assert.deepEqual(run.inputs, fixture.inputs);
verifyCoreFixture(core, fixture.seed, fixture.inputs, fixture.finalTick, 1e9, {
  score: fixture.score,
  status: "won",
  failure: null,
  hash: fixture.hash,
});
for (const target of [1, 50, 1000000000])
  assert.deepEqual(
    playDartsV3(fixture.seed, false, target),
    run,
    "target cannot truncate twenty throws",
  );
const profiles = new Set<string>();
for (let i = 0; i < 1000; i++) {
  const seed = generateScenario(
      { game_id: core.gameId, game_version: core.gameVersion },
      i,
    ).seed,
    s = core.create(seed);
  profiles.add(
    JSON.stringify(
      Array.from({ length: 20 }, (_, throwIndex) =>
        dartsDriftV3({ ...s, throwIndex }, 37),
      ),
    ),
  );
  assert.deepEqual(s, core.create(seed));
  if (i < 64) {
    const played = playDartsV3(seed);
    assert.equal(played.state.status, "won");
    assert.ok(played.state.score >= 500);
  }
}
assert.equal(profiles.size, 1000);
for (let i = 0; i < 8; i++) {
  const missed = playDartsV3(`miss-v3-${i}`, true);
  assert.equal(missed.state.score, 0);
  assert.equal(missed.state.failure, "NO_SCORE");
}
const idle = core.create("darts3-idle");
advanceCoreToTick(core, idle, core.maxFinalTick, 1);
assert.equal(idle.impacts.length, 20);
assert.equal(idle.total, 0);
assert.equal(idle.failure, "NO_SCORE");
assert.ok(idle.tick < core.maxFinalTick);
assert.ok(idle.impacts.every((p) => p.timeout));
const state = core.create("flight-lock");
applyCoreInput(core, state, "THROW", 1);
advanceCoreToTick(core, state, 119, 1);
assert.equal(state.total, 0);
assert.equal(state.score, 0);
stepCore(core, state, 1);
assert.ok(state.total > 0);
assert.equal(state.score, 0);
assert.equal(state.status, "running");
assert.equal(core.canApply(state, "THROW"), false);
assert.equal(DARTS_RULES_V3.throws, 20);
const manifest = createMatchManifest({
    gameId: "darts",
    gameVersion: "3.0.0",
    seed: fixture.seed,
    targetScore: 1,
  }),
  ticket = issueAttemptTicket({ manifest, playerId: "darts-test" });
const originalNow = Date.now;
try {
  Date.now = () => Date.parse(ticket.issued_at) + 60000;
  const response = processAttemptRecord({
    manifest,
    ticket,
    inputs: run.inputs,
    final_tick: run.state.tick,
    score: 99999999,
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.verified, true);
  assert.ok("score" in response.body);
  assert.equal(response.body.score, run.state.score);
  assert.equal(
    processAttemptRecord({
      manifest: { ...manifest, seed: "client-choice" },
      ticket,
      inputs: run.inputs,
      final_tick: run.state.tick,
    }).body.verified,
    false,
  );
} finally {
  Date.now = originalNow;
}
assert.equal(sha256(canonicalJson(run.state)), fixture.hash);
console.log(
  "Darts V3:20 raw-score throws,64 full wins,8 full losses,1000 sway profiles,target-independent completion,server replay,timeout/lock/golden/render/input validation",
);
