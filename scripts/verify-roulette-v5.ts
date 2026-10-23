import assert from "node:assert/strict";
import { ROULETTE_CORE_V5 as core, ROULETTE_RULES_V5 as rules, rouletteChipReturn, rouletteChipCount } from "../lib/verified/galacticRouletteCore.v5";
import { ROULETTE_CORE_V4 } from "../lib/verified/galacticRouletteCore.v4";
import { ROULETTE_ACTIONS_V3, rouletteTossAction } from "../lib/verified/galacticRouletteProtocol.v3";
import { applyCoreInput, replayCore, stepCore } from "../lib/verified/coreRuntime.v1";
import { rouletteLauncherToss, rouletteLauncherCanGrab, ROULETTE_BALL_DOCK } from "../lib/rouletteLaunchGesture";
import { createMatchManifest, issueAttemptTicket, processAttemptRecord } from "../lib/server/verifiedMatch";
import { verifyCoreFixture } from "./core-test-utils";
import type { ReplayInput } from "../lib/verified/inputValidation";
import fixture from "./fixtures/roulette-v5.json" with { type: "json" };

assert.equal(ROULETTE_CORE_V4.gameVersion, "4.0.0", "V4 stays untouched");
assert.equal(core.gameVersion, "5.0.0");
verifyCoreFixture(core, fixture.seed, fixture.inputs, fixture.finalTick, 1e9, {
  score: fixture.score,
  status: fixture.status as "won" | "failed",
  failure: fixture.failure,
  hash: fixture.hash,
});

// Protocol: no column bets, no free release point, chips can be added, undone and cleared.
assert.ok(!ROULETTE_ACTIONS_V3.some((a) => a.includes("COLUMN") || a.startsWith("RELEASE_")));
{
  const s = core.create("chips");
  assert.equal(s.balanceMinor, 10000);
  assert.equal(applyCoreInput(core, s, "BET_COLUMN_1", 1e9), false);
  assert.equal(applyCoreInput(core, s, "RELEASE_X_10", 1e9), false);
  assert.equal(core.canApply(s, rouletteTossAction(20, 8)), false, "a spin needs at least one chip");
  for (const a of ["BET_RED", "BET_RED", "BET_NUMBER_17", "BET_DOZEN_2"]) assert.equal(applyCoreInput(core, s, a, 1e9), true);
  assert.deepEqual(s.chips, ["RED", "RED", "NUMBER_17", "DOZEN_2"]);
  assert.equal(rouletteChipCount(s.chips, "RED"), 2);
  assert.equal(applyCoreInput(core, s, "BETS_UNDO", 1e9), true);
  assert.deepEqual(s.chips, ["RED", "RED", "NUMBER_17"]);
  assert.equal(applyCoreInput(core, s, "BETS_CLEAR", 1e9), true);
  assert.deepEqual(s.chips, []);
  assert.equal(core.canApply(s, "BETS_CLEAR"), false);
  // per-bet and table caps
  for (let i = 0; i < rules.maxChipsPerBet; i++) assert.equal(applyCoreInput(core, s, "BET_ODD", 1e9), true);
  assert.equal(applyCoreInput(core, s, "BET_ODD", 1e9), false, "per-bet cap");
  const t = core.create("cap");
  const bets = ["RED", "BLACK", "EVEN", "ODD", "LOW", "HIGH", "DOZEN_1", "DOZEN_2", "DOZEN_3"];
  for (let i = 0; i < rules.maxTableChips; i++) assert.equal(applyCoreInput(core, t, `BET_${bets[i % bets.length]}`, 1e9), true);
  assert.equal(applyCoreInput(core, t, "BET_NUMBER_01", 1e9), false, "table cap");
  // cannot bet more than the balance
  const u = core.create("broke");
  u.balanceMinor = 200;
  assert.equal(applyCoreInput(core, u, "BET_RED", 1e9), true);
  assert.equal(applyCoreInput(core, u, "BET_RED", 1e9), true);
  assert.equal(applyCoreInput(core, u, "BET_RED", 1e9), false, "no chips beyond the balance");
}

// Payouts per chip: stake included, summed over every chip riding on the spin.
assert.equal(rouletteChipReturn("NUMBER_17", 17), 3600);
assert.equal(rouletteChipReturn("NUMBER_17", 18), 0);
assert.equal(rouletteChipReturn("RED", 1), 200);
assert.equal(rouletteChipReturn("DOZEN_1", 12), 300);
assert.equal(rouletteChipReturn("RED", 0), 0);

// A spin costs one chip per chip on the cloth; the winnings are the sum over all of them.
for (let seed = 0; seed < 12; seed++) {
  const s = core.create(`spin-${seed}`);
  const placed = ["RED", "RED", "BLACK", "NUMBER_07", "DOZEN_3", "ODD"];
  for (const b of placed) applyCoreInput(core, s, `BET_${b}`, 1e9);
  const toss = rouletteTossAction(20, 8);
  assert.equal(applyCoreInput(core, s, toss, 1e9), true);
  assert.equal(s.balanceMinor, 10000 - placed.length * rules.chipMinor, "chips are paid when the ball is thrown");
  assert.equal(s.ballX, rules.releaseX, "the ball starts at the launcher");
  assert.equal(s.ballY, rules.releaseY + 24000);
  for (let t = 0; t < rules.maximumFlightTicks && s.landingTick !== -1; t++) stepCore(core, s, 1e9);
  assert.equal(s.landingTick, -1);
  const n = s.lastNumber;
  const expected = n === null ? 0 : placed.reduce((sum, b) => sum + rouletteChipReturn(b, n), 0);
  assert.equal(s.lastPayout, expected);
  assert.equal(s.balanceMinor, 10000 - placed.length * rules.chipMinor + expected);
  assert.deepEqual(s.chips, placed, "chips stay on the cloth for the next spin");
}
// The launcher position never depends on the swipe: same start for every direction.
for (const d of [0, 7, 13, 20, 27]) {
  const s = core.create("launcher");
  applyCoreInput(core, s, "BET_RED", 1e9);
  applyCoreInput(core, s, rouletteTossAction(d, 5), 1e9);
  assert.equal(s.ballX, rules.releaseX);
}
// Swipe gesture: must start at the launcher, quantised direction/power, no release point.
assert.equal(rouletteLauncherCanGrab(ROULETTE_BALL_DOCK), true);
assert.equal(rouletteLauncherToss({ x: 195, y: 195 }, { x: 100, y: 100 }), null, "cannot throw from above the wheel");
assert.equal(rouletteLauncherToss(ROULETTE_BALL_DOCK, { x: ROULETTE_BALL_DOCK.x + 5, y: ROULETTE_BALL_DOCK.y }), null, "too short");
const wheelwards = rouletteLauncherToss(ROULETTE_BALL_DOCK, { x: 230, y: 230 });
assert.ok(wheelwards && wheelwards.length === 1 && ROULETTE_ACTIONS_V3.includes(wheelwards[0]));
assert.notEqual(wheelwards![0], rouletteLauncherToss(ROULETTE_BALL_DOCK, { x: 300, y: 250 })![0]);

// The ball thrown toward the wheel is thrown over the rim, bounces on the outer wall and is captured by a pocket.
let settled = 0;
for (let seed = 0; seed < 24; seed++) {
  const s = core.create(`natural-${seed}`);
  applyCoreInput(core, s, "BET_RED", 1e9);
  assert.equal(applyCoreInput(core, s, "TOSS_D20_P08", 1e9), true);
  for (let t = 0; t < rules.maximumFlightTicks && s.landingTick !== -1; t++) stepCore(core, s, 1e9);
  assert.equal(s.landingTick, -1);
  assert.equal(s.lastMiss, false);
  const age = s.tick - s.flightStart;
  assert.ok(age >= rules.minimumFlightTicks && age < rules.maximumFlightTicks);
  assert.ok(s.lastNumber !== null);
  settled++;
}
assert.equal(settled, 24);
// A feeble throw (power 0) is a miss only when the ball never reaches the bowl; both outcomes resolve.
{
  const s = core.create("feeble");
  applyCoreInput(core, s, "BET_RED", 1e9);
  applyCoreInput(core, s, "TOSS_D00_P00", 1e9);
  for (let t = 0; t < rules.maximumFlightTicks && s.landingTick !== -1; t++) stepCore(core, s, 1e9);
  assert.equal(s.landingTick, -1);
  assert.equal(s.lastMiss, true, "thrown away from the wheel: the chips are lost");
  assert.equal(s.balanceMinor, 10000 - rules.chipMinor);
}

// Server replay accepts the golden run and rejects a tampered seed.
{
  const manifest = createMatchManifest({ gameId: core.gameId, gameVersion: core.gameVersion, seed: fixture.seed, targetScore: 1e9 });
  const ticket = issueAttemptTicket({ manifest, playerId: "roulette-v5-player" });
  const payload = { manifest, ticket, inputs: fixture.inputs as ReplayInput[], final_tick: fixture.finalTick };
  const now = Date.now;
  try {
    Date.now = () => Date.parse(ticket.issued_at) + (fixture.finalTick * 1000) / 120 + 1000;
    const checked = processAttemptRecord({ ...payload, score: 999999999 });
    assert.equal(checked.body.verified, true);
    assert.equal(checked.body.score, fixture.score);
    assert.equal(processAttemptRecord({ ...payload, manifest: { ...manifest, seed: "tampered" } }).body.verified, false);
  } finally {
    Date.now = now;
  }
}
assert.equal(replayCore(core, [{ seq: 0, tick: 0, action: "BET_COLUMN_2" }], 10, "x", 1e9).error, "INVALID_INPUT");
console.log("Roulette V5 OK · chips · multi-bet · fixed launcher · payouts per chip · golden replay");
