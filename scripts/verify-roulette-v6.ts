import assert from "node:assert/strict";
import { ROULETTE_CORE_V6 as core } from "../lib/verified/galacticRouletteCore.v6";
import { applyCoreInput, replayCore } from "../lib/verified/coreRuntime.v1";
import { verifyCoreFixture } from "./core-test-utils";
import fixture from "./fixtures/roulette-v6.json" with { type: "json" };
assert.equal(core.gameVersion, "6.0.0");
assert.equal(core.create("x").balanceMinor, 10000, "always 100 chips");
verifyCoreFixture(core, fixture.seed, fixture.inputs, fixture.finalTick, 1e9, { score: fixture.score, status: fixture.status as "won", failure: fixture.failure, hash: fixture.hash });
assert.equal(fixture.inputs.at(-1)?.action, "CASH_OUT");
// Stopping keeps the balance as the result; nothing can follow a stop.
const s = core.create("stop");
assert.equal(applyCoreInput(core, s, "CASH_OUT", 1e9), true);
assert.equal(s.status, "won");
assert.equal(s.score, 10000);
assert.equal(core.canApply(s, "BET_RED"), false);
// Stop is refused while the ball is rolling.
const r = core.create("rolling");
r.landingTick = 500;
assert.equal(core.canApply(r, "CASH_OUT"), false);
// Without CASH_OUT an unfinished replay is invalid; the session never ends by a 3 minute clock.
assert.equal(replayCore(core, [], 21600, "idle", 1e9).valid, false);
assert.equal(core.maxFinalTick, 72000);
console.log("Roulette V6 OK: stop/cash-out, 100 chips, golden replay");
