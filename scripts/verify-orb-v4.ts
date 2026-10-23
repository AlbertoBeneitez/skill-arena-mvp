import assert from "node:assert/strict";
import { generateScenario } from "../lib/server/scenarios";
import { replayCore } from "../lib/verified/coreRuntime.v1";
import {
  ORB_BURST_CORE_V4 as core,
  ORB_V4_RULES as rules,
  orbSourceRowV4,
  orbPhaseV4,
  orbMissLimitV4,
  copyOrbV4State,
} from "../lib/verified/orbBurstCore.v4";
import { ORB_ACTIONS_V4 } from "../lib/verified/orbBurstProtocol.v4";
import { verifyCoreFixture } from "./core-test-utils";
import { playOrbV4 } from "./orb-v4-play-fixture";
import fixture from "./fixtures/orb-v4.json" with { type: "json" };

assert.equal(core.actions.length, ORB_ACTIONS_V4.length);
for (const a of ["SWAP", "POWER_BOMB", "POWER_LIGHTNING", "POWER_RAINBOW"]) assert.ok(core.actions.includes(a));

// Generation: asteroids thicken, ice arrives from row 7, five colours late, deterministic.
let stones = 0, ices = 0, doubleIce = 0;
for (let i = 0; i < 200; i++) {
  const seed = generateScenario({ game_id: core.gameId, game_version: core.gameVersion }, i).seed;
  assert.deepEqual(core.create(seed), core.create(seed));
  for (let ordinal = 4; ordinal < rules.sourceRows; ordinal++) {
    const row = orbSourceRowV4(seed, ordinal);
    assert.deepEqual(row, orbSourceRowV4(seed, ordinal));
    const a = row.filter((b) => b.color === rules.asteroid).length;
    if (ordinal < 6) assert.equal(a, 0);
    stones += a;
    for (const b of row) {
      if (b.ice) {
        assert.ok(ordinal >= 7);
        ices++;
        if (b.ice === 2) doubleIce++;
        assert.notEqual(b.color, rules.asteroid);
      }
    }
  }
}
assert.ok(stones > 200 * 6, "denser asteroids than V3");
assert.ok(ices > 0 && doubleIce > 0);

// Phases tighten the miss limit.
assert.deepEqual([0, 24, 54, 84].map((height) => orbMissLimitV4({ height })), [5, 4, 3, 3]);
assert.equal(orbPhaseV4({ height: 100 }), 3);

// Powers: need stored charge, convert the loaded orb, hand the old colour back after the shot.
const s = core.create("orb4-power");
assert.equal(core.canApply(s, "POWER_BOMB"), false);
s.power = 4;
const loaded = s.currentColor, next = s.nextColor;
assert.equal(core.canApply(s, "POWER_BOMB"), true);
core.apply(s, "POWER_BOMB");
assert.equal(s.currentColor, rules.bomb);
assert.equal(s.held, loaded);
assert.equal(s.power, 2);
assert.equal(core.canApply(s, "POWER_RAINBOW"), false, "already special");
assert.equal(s.nextColor, next);
const t = copyOrbV4State(s);
t.currentColor = loaded; t.held = -1; t.power = 2;
assert.equal(core.canApply(t, "POWER_LIGHTNING"), false, "lightning costs 3");
t.power = 3;
assert.equal(core.canApply(t, "POWER_LIGHTNING"), true);

// Bot with swaps and powers: powers are used, replay equals live play.
const run = playOrbV4("orb4-bot", 400, true);
assert.ok(run.inputs.some((i) => i.action.startsWith("POWER_")), "bot uses powers");
assert.ok(run.inputs.some((i) => i.action === "SWAP"), "bot uses swaps");
const replay = replayCore(core, run.inputs, run.s.tick, "orb4-bot", 108);
assert.equal(replay.valid, true, String(replay.error));
assert.deepEqual(replay.state, run.s);
assert.ok(run.s.points > 0 && run.s.height > 0);

for (const r of fixture.runs as any[])
  verifyCoreFixture(core, r.seed, r.inputs.map(([tick, action]: (string | number)[], seq: number) => ({ seq, tick: Number(tick), action: String(action) })), r.finalTick, rules.sourceGoal, {
    score: r.score, status: r.status as "running", failure: r.failure, hash: r.hash,
  });
console.log(`Orb V4 OK (height ${run.s.height}, points ${run.s.points}, status ${run.s.status})`);
