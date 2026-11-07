import assert from "node:assert/strict";
import { replayCore } from "../lib/verified/coreRuntime.v1";
import { ORB_BURST_CORE_V8 as core, orbEliminatedV8 } from "../lib/verified/orbBurstCore.v8";
import { ORB_BURST_CORE_V7 } from "../lib/verified/orbBurstCore.v7";
import { verifyCoreFixture } from "./core-test-utils";
import { playOrbV8 } from "./orb-v8-play-fixture";
import { playOrbV7 } from "./orb-v7-play-fixture";
import fixture from "./fixtures/orb-v8.json" with { type: "json" };

// V8 keeps V7's board and rules: the same inputs lead to the same board; only the score changes meaning.
assert.equal(core.gameVersion, "8.0.0");
assert.notEqual(core.content, ORB_BURST_CORE_V7.content);
assert.equal(core.create("orb8-start").score, 0);
const v7 = playOrbV7("orb8-same", "smart", 40), v8 = playOrbV8("orb8-same", "smart", 40);
assert.deepEqual(v8.inputs, v7.inputs, "same bot, same decisions");
assert.deepEqual({ ...v8.s, score: 0 }, { ...v7.s, score: 0 }, "same board, same pace");
// Score = orbs eliminated (popped + dropped), never the old bonus points.
assert.equal(v8.s.score, v8.s.popped + v8.s.dropped);
assert.equal(v8.s.score, orbEliminatedV8(v8.s));
assert.ok(v8.s.points > v8.s.score, "bonus points no longer count");
assert.equal(replayCore(core, v8.inputs, v8.s.tick, v8.s.seed, 1e9).valid, true);
// Skill still matters with the new count.
const smart = playOrbV8("orb8-random", "smart", 60), careless = playOrbV8("orb8-random", "random", 60);
assert.ok(smart.s.score > careless.s.score * 2, `skill matters (${smart.s.score} vs ${careless.s.score})`);
for (const r of fixture.runs as any[])
  verifyCoreFixture(core, r.seed, r.inputs.map(([tick, action]: (string | number)[], seq: number) => ({ seq, tick: Number(tick), action: String(action) })), r.finalTick, 1e9, { score: r.score, status: r.status, failure: r.failure, hash: r.hash });
assert.ok(fixture.runs.length >= 2, "golden runs present");
console.log(`Orb Burst V8 OK · score = orbs eliminated · smart ${smart.s.score} vs careless ${careless.s.score}`);
