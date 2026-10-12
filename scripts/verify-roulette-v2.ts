import assert from "node:assert/strict";
import {
  ROULETTE_CORE_V2 as core,
  rouletteTossVelocity,
  rouletteReturnV2,
} from "../lib/verified/galacticRouletteCore.v2";
import { rouletteTossAction } from "../lib/verified/galacticRouletteProtocol.v2";
import {
  rouletteHandToss,
  rouletteTossCanGrab,
} from "../lib/rouletteTossGesture";
import {
  applyCoreInput,
  stepCore,
  replayCore,
} from "../lib/verified/coreRuntime.v1";
import {
  createMatchManifest,
  issueAttemptTicket,
  processAttemptRecord,
} from "../lib/server/verifiedMatch";
import { verifyCoreFixture } from "./core-test-utils";
import { playRouletteV2, rouletteTossTrial } from "./roulette-v2-play-fixture";
import fixture from "./fixtures/roulette-v2.json" with { type: "json" };
verifyCoreFixture(core, fixture.seed, fixture.inputs, fixture.finalTick, 1e9, {
  score: fixture.score,
  status: "won",
  failure: null,
  hash: fixture.hash,
});
const setups = new Set();
for (let i = 0; i < 1000; i++) {
  const s = core.create(`roulette2-setup-${i}`);
  setups.add(`${s.wheelPhase}:${s.wheelSpeed}`);
  assert.deepEqual(core.create(`roulette2-setup-${i}`), s);
}
assert.ok(setups.size >= 995);
const pockets = new Set<number>();
for (let d = 0; d < 32; d++)
  for (let p = 0; p < 16; p++) {
    const s = core.create("cartesian-check"),
      v = rouletteTossVelocity(d, p);
    assert.ok(applyCoreInput(core, s, rouletteTossAction(d, p), 1e9));
    for (let t = 0; t < 15; t++) {
      const z = s.ballZ,
        vz = s.ballVz,
        x = s.ballX;
      stepCore(core, s, 1e9);
      assert.equal(s.ballVz, vz - 30);
      assert.equal(s.ballZ, z + vz - 30);
      assert.equal(s.ballX, x + v.vx);
    }
    while (s.status === "running" && s.landingTick !== -1)
      stepCore(core, s, 1e9);
    assert.ok(
      [s.ballX, s.ballY, s.ballZ, s.balanceMinor].every(Number.isSafeInteger),
    );
    assert.ok(s.tick <= 720);
    if (s.lastNumber !== null) pockets.add(s.lastNumber);
  }
assert.ok(
  pockets.size >= 12,
  "direction/impulse cause different physical pockets",
);
for (let i = 0; i < 32; i++) {
  const { s, inputs } = playRouletteV2(`roulette2-full-${i}`);
  assert.equal(s.status, "won");
  assert.equal(s.tick, 21600);
  assert.ok(s.spins >= 25);
  assert.deepEqual(
    replayCore(core, inputs, s.tick, `roulette2-full-${i}`, 1).state,
    s,
  );
}
for (let i = 0; i < 8; i++) {
  const seed = `roulette2-loss-${i}`,
    { s, inputs } = playRouletteV2(seed, true);
  assert.equal(s.status, "failed");
  assert.equal(s.balanceMinor, 0);
  assert.equal(s.spins, 20);
  assert.equal(s.lastMiss, true);
  assert.deepEqual(replayCore(core, inputs, s.tick, seed, 1e9).state, s);
}
for (const [bet, n, value] of [
  ["COLUMN_1", 1, 1500],
  ["COLUMN_2", 35, 1500],
  ["COLUMN_3", 36, 1500],
  ["COLUMN_3", 0, 0],
  ["COLUMN_2", 36, 0],
] as const)
  assert.equal(rouletteReturnV2(bet, n), value);
const release = core.create("release-position");
for (const a of ["RELEASE_X_25", "RELEASE_Y_25", "TOSS_D20_P07"]) {
  assert.ok(applyCoreInput(core, release, a, 1));
  if (!a.startsWith("TOSS_")) stepCore(core, release, 1);
}
assert.equal(release.ballX, 250000);
assert.equal(
  release.ballY - release.ballZ,
  250000,
  "flight begins exactly at quantized finger release",
);
assert.equal(
  core.canApply(release, "TOSS_D20_P07"),
  false,
  "one debit/flight at a time",
);
const collision = rouletteTossTrial(core.create("contact-check"));
assert.ok(collision.contacts > 0);
assert.equal(collision.lastMiss, false);
assert.deepEqual(rouletteHandToss({ x: 323, y: 330 }, { x: 250, y: 250 }), [
  "RELEASE_X_25",
  "RELEASE_Y_25",
  "TOSS_D20_P07",
]);
assert.equal(rouletteHandToss({ x: 323, y: 330 }, { x: 320, y: 327 }), null);
assert.equal(rouletteHandToss({ x: 195, y: 195 }, { x: 250, y: 250 }), null);
assert.equal(rouletteHandToss({ x: 323, y: 330 }, { x: 450, y: 400 }), null);
assert.equal(rouletteHandToss({ x: NaN, y: 330 }, { x: 195, y: 195 }), null);
assert.equal(rouletteTossCanGrab({ x: 367, y: 330 }), true);
const manifest = createMatchManifest({
  gameId: core.gameId,
  gameVersion: core.gameVersion,
  seed: fixture.seed,
  targetScore: 1,
});
const ticket = issueAttemptTicket({
  manifest,
  playerId: "qa-roulette2",
  slot: "A",
});
const now = Date.now;
try {
  Date.now = () =>
    Date.parse(ticket.issued_at) + (fixture.finalTick * 1000) / 120 + 1000;
  const payload = {
    manifest,
    ticket,
    inputs: fixture.inputs,
    final_tick: fixture.finalTick,
  };
  const r = processAttemptRecord({
    ...payload,
    score: 999999999,
    ballX: 0,
    lastNumber: 0,
  });
  assert.equal(r.body.verified, true);
  assert.equal(r.body.score, fixture.score);
  assert.equal(
    processAttemptRecord({
      ...payload,
      manifest: { ...manifest, seed: "client-seed" },
    }).body.verified,
    false,
  );
} finally {
  Date.now = now;
}
console.log(
  `RouletteV2: cartesian gravity/contacts,${pockets.size} pockets,32full wins/8losses,columns,gesture,golden/replay/render/invalid-input/server authority preserved`,
);
