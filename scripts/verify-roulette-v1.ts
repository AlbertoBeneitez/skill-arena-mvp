import {
  createMatchManifest,
  issueAttemptTicket,
  processAttemptRecord,
} from "../lib/server/verifiedMatch";
import assert from "node:assert/strict";
import {
  ROULETTE_CORE as core,
  ROULETTE_RED,
  ROULETTE_WHEEL,
  rouletteReturn,
} from "../lib/verified/galacticRouletteCore.v1";
import {
  applyCoreInput,
  stepCore,
  replayCore,
} from "../lib/verified/coreRuntime.v1";
import { generateScenario } from "../lib/server/scenarios";
import { playRoulette } from "./roulette-play-fixture";
import { verifyCoreFixture } from "./core-test-utils";
import fixture from "./fixtures/roulette-v1.json" with { type: "json" };
verifyCoreFixture(core, fixture.seed, fixture.inputs, fixture.finalTick, 1e9, {
  score: fixture.score,
  status: "won",
  failure: null,
  hash: fixture.hash,
});
assert.equal(new Set(ROULETTE_WHEEL).size, 37);
for (let n = 0; n < 37; n++) {
  assert.equal(
    rouletteReturn(`NUMBER_${String(n).padStart(2, "0")}`, n),
    18000,
  );
  assert.equal(
    rouletteReturn(`NUMBER_${String((n + 1) % 37).padStart(2, "0")}`, n),
    0,
  );
  if (n === 0) {
    for (const b of [
      "RED",
      "BLACK",
      "ODD",
      "EVEN",
      "LOW",
      "HIGH",
      "DOZEN_1",
      "DOZEN_2",
      "DOZEN_3",
    ])
      assert.equal(rouletteReturn(b, 0), 0);
  } else {
    assert.equal(rouletteReturn("RED", n) + rouletteReturn("BLACK", n), 1000);
    assert.equal(rouletteReturn("EVEN", n) + rouletteReturn("ODD", n), 1000);
    assert.equal(rouletteReturn("LOW", n) + rouletteReturn("HIGH", n), 1000);
    assert.equal(
      [1, 2, 3].reduce((v, i) => v + rouletteReturn(`DOZEN_${i}`, n), 0),
      1500,
    );
  }
}
const setups = new Set<string>();
for (let i = 0; i < 1000; i++) {
  const seed = generateScenario(
      { game_id: core.gameId, game_version: core.gameVersion },
      i,
    ).seed,
    s = core.create(seed);
  setups.add(`${s.wheelPhase}:${s.ballPhase}:${s.wheelSpeed}`);
  assert.deepEqual(core.create(seed), s);
  if (i < 16)
    for (const loss of [false, true]) {
      const { s, inputs } = playRoulette(seed, loss);
      assert.equal(s.status, loss ? "failed" : "won");
      assert.equal(s.tick, loss ? 12060 : 21600);
      assert.equal(s.spins, loss ? 20 : 35);
      assert.equal(s.score, loss ? 0 : 622500);
      assert.deepEqual(replayCore(core, inputs, s.tick, seed, 1e9).state, s);
    }
}
assert.equal(setups.size, 1000);
for (const direction of ["CW", "CCW"])
  for (const power of [0, 32, 63]) {
    const s = core.create(`flight-${direction}-${power}`);
    assert.ok(
      applyCoreInput(
        core,
        s,
        `LAUNCH_${direction}_${String(power).padStart(2, "0")}`,
        1,
      ),
    );
    assert.equal(s.balanceMinor, 9500);
    assert.equal(s.score, 0);
    assert.equal(s.status, "running");
    assert.equal(applyCoreInput(core, s, "BET_BLACK", 1e9), false);
    assert.equal(applyCoreInput(core, s, "LAUNCH_CW_00", 1e9), false);
    const speed = Math.abs(s.ballSpeed),
      phase = s.ballPhase;
    for (let t = 0; t < 600 + power * 4; t++) stepCore(core, s, 1e9);
    assert.equal(s.spins, 1);
    assert.equal(s.landingTick, -1);
    assert.ok(s.lastNumber !== null);
    assert.notEqual(s.ballPhase, phase);
    assert.equal(s.ballSpeed, 0);
    assert.ok(speed > 1200 || power === 0);
  }
const timeout = core.create("idle");
for (let i = 0; i < 21600; i++) stepCore(core, timeout, 1);
assert.equal(timeout.score, 10000);
assert.equal(timeout.status, "won");
const late = core.create("late");
for (let i = 0; i < 21001; i++) stepCore(core, late, 1e9);
assert.equal(core.canApply(late, "LAUNCH_CW_00"), false);
console.log(
  "Roulette: 1000 distinct setups,32 full sessions, zero loses outside bets, integer returns, both launch directions/power bounds, locked bet/no double debit, deadline/replay/invalid input",
);

const manifest = createMatchManifest({
    gameId: core.gameId,
    seed: fixture.seed,
    targetScore: 1e9,
  }),
  ticket = issueAttemptTicket({
    manifest,
    playerId: "roulette-fixture-player",
  }),
  payload = {
    manifest,
    ticket,
    inputs: fixture.inputs,
    final_tick: fixture.finalTick,
  },
  originalNow = Date.now;
try {
  Date.now = () => Date.parse(ticket.issued_at) + 181000;
  const checked = processAttemptRecord({
    ...payload,
    score: 999999999,
    balanceMinor: 999999999,
    number: 7,
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
  Date.now = originalNow;
}
console.log(
  "Roulette signed endpoint: input-only reconstruction, ignored client score/number/balance, seed tampering rejected",
);
