import fixture from "./fixtures/phalanx-v3.json" with { type: "json" };
import assert from "node:assert/strict";
import {
  PHALANX_CORE as core,
  phalanxVolleySpread,
} from "../lib/verified/starPhalanxCore.v3";
import { choosePhalanxAction } from "./phalanx-v3-play-fixture";
import {
  applyCoreInput,
  stepCore,
  replayCore,
  advanceCoreToTick,
} from "../lib/verified/coreRuntime.v1";
import { canonicalJson } from "../lib/verified/canonical";
import { sha256 } from "../lib/server/matchIntegrity";
import {
  createMatchManifest,
  issueAttemptTicket,
  processAttemptRecord,
} from "../lib/server/verifiedMatch";
import { verifyCoreFixture } from "./core-test-utils";
import { generateScenario } from "../lib/server/scenarios";
import type { ReplayInput } from "../lib/verified/inputValidation";
let wins = 0;
for (let i = 0; i < 32; i++) {
  const seed =
      i === 0
        ? "phalanx3-golden"
        : generateScenario(
            { game_id: core.gameId, game_version: core.gameVersion },
            i,
          ).seed,
    s = core.create(seed),
    inputs: ReplayInput[] = [];
  while (s.status === "running") {
    const a = choosePhalanxAction(s);
    if (a && core.canApply(s, a)) {
      inputs.push({ seq: inputs.length, tick: s.tick, action: a });
      assert.ok(applyCoreInput(core, s, a, 1));
    }
    assert.equal(s.score, 0, "target cannot close a live continuous run");
    stepCore(core, s, 1);
  }
  if (s.status === "won") {
    wins++;
    assert.equal(s.kills, 168);
    assert.equal(s.clearedLayers, 24);
  }
  assert.equal(s.score, s.total);
  assert.deepEqual(replayCore(core, inputs, s.tick, seed, 1).state, s);
  console.log(
    i,
    s.status,
    s.tick,
    s.kills,
    s.lives,
    s.collected,
    inputs.length,
  );
  if (i === 0) {
    const g = {
      seed,
      inputs,
      finalTick: s.tick,
      score: s.score,
      status: s.status,
      failure: s.failure,
      hash: sha256(canonicalJson(s)),
    };
    assert.deepEqual(g, fixture, "frozen complete run inputs/score/tick/hash");
    verifyCoreFixture(core, seed, inputs, s.tick, 1, {
      score: s.score,
      status: s.status,
      failure: s.failure,
      hash: g.hash,
    });
  }
}
assert.ok(wins >= 24, "harder directed volleys must remain masterable");
for (let i = 0; i < 128; i++) {
  const s = core.create(`phalanx3-opening-${i}`);
  advanceCoreToTick(core, s, 360, 1);
  assert.equal(
    s.lives,
    3,
    "announced opening cannot kill before the player learns",
  );
  assert.ok(s.enemies.length === 5);
}
assert.deepEqual([0, 1, 2].map(phalanxVolleySpread), [
  [0],
  [-450, 450],
  [-450, 0, 450],
]);
const reward = core.create("reward-regression");
reward.lives = 2;
reward.rewards = [
  { id: 0, x: reward.shipX, y: 551000, kind: "shield" },
  { id: 1, x: reward.shipX, y: 551000, kind: "points" },
];
stepCore(core, reward, 1);
assert.equal(reward.lives, 3);
assert.equal(reward.collected, 2);
assert.equal(reward.rewardPoints, 800);
assert.equal(reward.total, 800);
assert.equal(reward.score, 0);
assert.equal(reward.rewards.length, 0);
stepCore(core, reward, 1);
assert.equal(reward.rewardPoints, 800, "rewards cannot be collected twice");
const missed = core.create("missed-reward");
missed.rewards = [{ id: 0, x: 20000, y: 619900, kind: "points" }];
stepCore(core, missed, 1);
assert.equal(missed.rewards.length, 0);
assert.equal(missed.total, 0);
const hit = core.create("hit");
hit.total = 1000;
hit.shots = [
  {
    id: 0,
    x: hit.shipX,
    y: 551000,
    vx: 0,
    vy: 1900,
    enemy: true,
    spent: false,
  },
];
stepCore(core, hit, 1);
assert.equal(hit.total, 750);
assert.equal(hit.lives, 2);
console.log(
  "Phalanx V3: directed single/double/triple threats,168 enemies,24continuous arrivals,target-independent reach/terminal score,optional point/health rewards and deterministic replay",
);

const manifest = createMatchManifest({
    gameId: core.gameId,
    gameVersion: core.gameVersion,
    seed: fixture.seed,
    targetScore: 1,
  }),
  ticket = issueAttemptTicket({ manifest, playerId: "phalanx3-test" }),
  now = Date.now;
try {
  Date.now = () => Date.parse(ticket.issued_at) + 180000;
  const response = processAttemptRecord({
    manifest,
    ticket,
    inputs: fixture.inputs,
    final_tick: fixture.finalTick,
    score: 999999,
    kills: 99999,
    rewardPoints: 999999,
  });
  assert.equal(response.status, 200);
  assert.ok("score" in response.body);
  assert.equal(response.body.score, fixture.score);
  assert.equal(response.body.height, 168);
  assert.notEqual(
    processAttemptRecord({
      manifest: { ...manifest, seed: "client-seed" },
      ticket,
      inputs: fixture.inputs,
      final_tick: fixture.finalTick,
    }).status,
    200,
  );
} finally {
  Date.now = now;
}
const idleState = core.create("idle-v3");
while (idleState.status === "running") stepCore(core, idleState, 1);
const idle = replayCore(core, [], idleState.tick, "idle-v3", 1);
assert.equal(idle.valid, true);
assert.equal(idle.won, false);
assert.equal(idle.failure, "HULL_EXHAUSTED");
assert.equal(
  replayCore(core, [], idleState.tick + 1, "idle-v3", 1).error,
  "FINAL_TICK_AFTER_RESOLUTION",
);
const dodging = core.create("no-fire-v3"),
  dodgeInputs: ReplayInput[] = [];
while (dodging.status === "running") {
  const a = choosePhalanxAction(dodging, false);
  if (a && core.canApply(dodging, a)) {
    dodgeInputs.push({
      seq: dodgeInputs.length,
      tick: dodging.tick,
      action: a,
    });
    applyCoreInput(core, dodging, a, 1);
  }
  stepCore(core, dodging, 1);
}
assert.equal(dodging.failure, "TIME_LIMIT");
assert.equal(dodging.tick, core.maxFinalTick);
assert.equal(dodging.score, 0);
assert.equal(
  replayCore(core, dodgeInputs, dodging.tick, dodging.seed, 1).valid,
  true,
);
