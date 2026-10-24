import assert from "node:assert/strict";
import { ROULETTE_CORE_V8 as core, rouletteStake } from "../lib/verified/galacticRouletteCore.v8";
import { applyCoreInput, stepCore, replayCore } from "../lib/verified/coreRuntime.v1";
import { verifyCoreFixture } from "./core-test-utils";
import fixture from "./fixtures/roulette-v8.json" with { type: "json" };
assert.equal(core.gameVersion, "8.0.0");
assert.equal(core.create("x").balanceMinor, 10000, "always 100 chips");
verifyCoreFixture(core, fixture.seed, fixture.inputs, fixture.finalTick, 1e9, { score: fixture.score, status: fixture.status as "won", failure: fixture.failure, hash: fixture.hash });
assert.equal(fixture.inputs.at(-1)?.action, "CASH_OUT");
// Denominations: 1 by default, 5 and 25 selectable, stake added up.
const s = core.create("denoms");
assert.equal(s.denomination, 1);
applyCoreInput(core, s, "BET_RED", 1e9); stepCore(core, s, 1e9);
applyCoreInput(core, s, "CHIP_25", 1e9); stepCore(core, s, 1e9);
applyCoreInput(core, s, "BET_NUMBER_17", 1e9); stepCore(core, s, 1e9);
applyCoreInput(core, s, "CHIP_5", 1e9); stepCore(core, s, 1e9);
applyCoreInput(core, s, "BET_RED", 1e9); stepCore(core, s, 1e9);
assert.equal(rouletteStake(s), 31);
// Cannot stake more than the balance.
const poor = core.create("poor");
poor.balanceMinor = 2000;
poor.denomination = 25;
assert.equal(core.canApply(poor, "BET_RED"), false);
poor.denomination = 5;
assert.equal(core.canApply(poor, "BET_RED"), true);
// Unthrown chips stay on the cloth (no expiry); nothing is charged until the throw.
const e = core.create("expiry");
applyCoreInput(core, e, "BET_RED", 1e9);
for (let i = 0; i < 1199; i++) stepCore(core, e, 1e9);
assert.equal(e.chips.length, 1);
stepCore(core, e, 1e9);
assert.equal(e.chips.length, 1);
assert.equal(e.balanceMinor, 10000);
// The cloth is empty right after the throw and after the spin, and history records results.
const t = core.create("spin");
applyCoreInput(core, t, "BET_RED", 1e9); stepCore(core, t, 1e9);
applyCoreInput(core, t, "TOSS_D10_P08", 1e9);
assert.equal(t.chips.length, 0);
assert.equal(t.lockedChips.length, 1);
assert.equal(t.balanceMinor, 9900);
while (t.landingTick !== -1 && t.status === "running") stepCore(core, t, 1e9);
assert.equal(t.chips.length, 0);
assert.ok(t.history.length === 1 || t.lastMiss);
assert.ok(fixture.inputs.length > 10);
// Stop keeps the balance; nothing can follow.
const c = core.create("stop");
assert.equal(applyCoreInput(core, c, "CASH_OUT", 1e9), true);
assert.equal(c.status, "won");
assert.equal(core.canApply(c, "BET_RED"), false);
assert.equal(replayCore(core, [], 21600, "idle", 1e9).valid, false);
assert.equal(core.maxFinalTick, 72000);
// Containment: every throw (all directions/powers) ends in a pocket, never a miss and never outside the rim.
let contained = 0;
for (let d = 0; d < 32; d += 2) for (const p of [0, 3, 7, 11, 15]) {
  const b = core.create(`contain-${d}-${p}`);
  applyCoreInput(core, b, "BET_RED", 1e9); stepCore(core, b, 1e9);
  applyCoreInput(core, b, `TOSS_D${String(d).padStart(2, "0")}_P${String(p).padStart(2, "0")}`, 1e9);
  for (let i = 0; i < 1100 && b.landingTick !== -1; i++) stepCore(core, b, 1e9);
  assert.equal(b.lastMiss, false, `miss at d${d} p${p}`);
  assert.notEqual(b.lastNumber, null);
  const dist = Math.hypot(b.ballX - 195000, b.ballY - 195000);
  assert.ok(dist <= 151000, `ball outside wheel at d${d} p${p}: ${dist}`);
  contained++;
}
console.log("Roulette V8 OK: ball contained in", contained, "throws, denominations, cleared cloth, no expiry, history, golden replay");
