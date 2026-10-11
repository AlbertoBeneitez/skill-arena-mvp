import assert from "node:assert/strict";
import {
  BIRDS_CORE as core,
  birdsVelocity,
} from "../lib/verified/galacticBirdsCore.v1";
import { playBirds } from "./birds-play-fixture";
import {
  applyCoreInput,
  stepCore,
  replayCore,
} from "../lib/verified/coreRuntime.v1";
import { generateScenario } from "../lib/server/scenarios";
import { verifyCoreFixture } from "./core-test-utils";
import {
  createMatchManifest,
  issueAttemptTicket,
  processAttemptRecord,
} from "../lib/server/verifiedMatch";
import type { ReplayInput } from "../lib/verified/inputValidation";
import fixture from "./fixtures/birds-v1.json" with { type: "json" };
verifyCoreFixture(core, fixture.seed, fixture.inputs, fixture.finalTick, 1e9, {
  score: fixture.score,
  status: "won",
  failure: null,
  hash: fixture.hash,
});
const setups = new Set<string>();
for (let i = 0; i < 1000; i++) {
  const seed = generateScenario(
      { game_id: core.gameId, game_version: core.gameVersion },
      i,
    ).seed,
    s = core.create(seed);
  setups.add(JSON.stringify([s.bodies, s.enemies]));
  assert.deepEqual(core.create(seed), s);
  assert.equal(s.enemies.length, 12);
  assert.equal(s.ammo, 30);
  if (i < 64) {
    for (let t = 0; t < 960; t++) stepCore(core, s, 1e9);
    assert.equal(s.kills, 0, "no spontaneous opening deaths");
    assert.ok(s.bodies.every((b) => b.alive));
    assert.equal(s.status, "running");
  }
  if (i < 16) {
    const { s, inputs } = playBirds(seed);
    assert.equal(s.status, "won", `course${i}`);
    assert.equal(s.kills, 12);
    assert.ok(s.shots <= 22);
    assert.ok(s.tick < 15000);
    assert.deepEqual(replayCore(core, inputs, s.tick, seed, 1e9).state, s);
    assert.ok(
      s.bodies.every((b) =>
        [b.x, b.y, b.vx, b.vy, b.hp].every(Number.isSafeInteger),
      ),
    );
  }
}
assert.equal(setups.size, 1000);
for (const a of [0, 30, 60])
  for (const p of [0, 6, 12]) {
    const v = birdsVelocity(a, p);
    assert.ok(
      Number.isSafeInteger(v.vx) &&
        Number.isSafeInteger(v.vy) &&
        v.vx > 0 &&
        v.vy < 0,
    );
  }
const keys = core.create("keys");
for (const a of ["POWER_UP", "POWER_DOWN", "ANGLE_UP", "ANGLE_DOWN"]) {
  assert.ok(applyCoreInput(core, keys, a, 1e9));
  stepCore(core, keys, 1e9);
}
assert.equal(keys.power, 6);
assert.equal(keys.aim, 30);
const lock = core.create("lock");
assert.ok(applyCoreInput(core, lock, "SHOOT", 1));
assert.equal(lock.ammo, 29);
assert.equal(lock.score, 0);
assert.equal(applyCoreInput(core, lock, "SHOOT", 1), false);
stepCore(core, lock, 1);
assert.equal(applyCoreInput(core, lock, "AIM_30", 1), false);
for (let i = 0; i < 4; i++) {
  const seed = `birds-loss-${i}`,
    s = core.create(seed),
    inputs: ReplayInput[] = [];
  while (s.status === "running") {
    if (s.phase !== "aim") {
      stepCore(core, s, 1e9);
      continue;
    }
    for (const a of ["AIM_60", "POWER_00", "SHOOT"]) {
      if (s.status !== "running") break;
      inputs.push({ seq: inputs.length, tick: s.tick, action: a });
      assert.ok(applyCoreInput(core, s, a, 1e9));
      stepCore(core, s, 1e9);
    }
  }
  assert.equal(s.status, "failed");
  assert.equal(s.failure, "OUT_OF_SHOTS");
  assert.equal(s.shots, 30);
  assert.equal(s.kills, 0);
  assert.deepEqual(replayCore(core, inputs, s.tick, seed, 1e9).state, s);
}
const idle = core.create("timeout");
for (let t = 0; t < 28800; t++) stepCore(core, idle, 1e9);
assert.equal(idle.failure, "TIME_LIMIT");
assert.equal(idle.kills, 0);
const manifest = createMatchManifest({
    gameId: core.gameId,
    gameVersion: core.gameVersion,
    seed: fixture.seed,
    targetScore: 1e9,
  }),
  ticket = issueAttemptTicket({ manifest, playerId: "birds-fixture-player" }),
  payload = {
    manifest,
    ticket,
    inputs: fixture.inputs,
    final_tick: fixture.finalTick,
  },
  now = Date.now;
try {
  Date.now = () =>
    Date.parse(ticket.issued_at) + (fixture.finalTick * 1000) / 120 + 1000;
  const checked = processAttemptRecord({
    ...payload,
    score: 99999999,
    kills: 12,
  });
  assert.equal(checked.body.verified, true);
  assert.equal(checked.body.score, fixture.score);
  assert.equal(
    processAttemptRecord({
      ...payload,
      manifest: { ...manifest, seed: "chosen-by-client" },
    }).body.verified,
    false,
  );
} finally {
  Date.now = now;
}
console.log(
  "Birds:1000 distinct fields,16 complete wins,64 stable openings,4 full losses, gravity/materials/shot limits, keyboard regression, signed replay/invalid inputs/render independence",
);

const lateClear = core.create("late-clear");
lateClear.tick = 28799;
lateClear.kills = 12;
lateClear.height = 12;
lateClear.enemies.forEach((e) => (e.alive = false));
lateClear.phase = "clearing";
lateClear.finishAt = 28880;
stepCore(core, lateClear, 1e9);
assert.equal(
  lateClear.status,
  "won",
  "a goal reached within the time budget must not lose to the settling window",
);
assert.equal(lateClear.tick, 28800);
