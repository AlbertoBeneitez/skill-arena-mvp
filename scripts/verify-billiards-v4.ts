import assert from "node:assert/strict";
import { BILLIARDS_CORE_V4 as core, BILLIARDS_V4_RULES as rules } from "../lib/verified/billiardsCore.v4";
import { BILLIARDS_POCKETS } from "../lib/verified/billiardsCore.v1";
import { replayCore } from "../lib/verified/coreRuntime.v1";
import { generateScenario } from "../lib/server/scenarios";
import { verifyCoreFixture } from "./core-test-utils";
import { playBilliardsV4 } from "./billiards-v4-play-fixture";
import fixture from "./fixtures/billiards-v4.json" with { type: "json" };

assert.equal(core.gameVersion, "4.0.0");
// Opening: no bumpers, no overlaps, clear of pockets, different for every game.
const layouts = new Set<string>(), corners = new Set<string>();
for (let i = 0; i < 400; i++) {
  const seed: string = generateScenario({ game_id: core.gameId, game_version: core.gameVersion }, i).seed,
    s = core.create(seed);
  assert.deepEqual(s, core.create(seed));
  assert.equal(s.bumpers.length, 0);
  assert.equal(s.balls.length, 11);
  s.balls.forEach((a, n) => {
    assert.ok(a.x > 42000 + 10000 && a.x < 348000 - 10000 && a.y > 94000 + 10000 && a.y < 504000 - 10000);
    for (let k = 0; k < n; k++) assert.ok(Math.hypot(a.x - s.balls[k].x, a.y - s.balls[k].y) >= 20000 + 4000, "no overlap");
    for (const p of BILLIARDS_POCKETS) assert.ok(Math.hypot(a.x - p.x, a.y - p.y) >= 40000, "clear of pockets");
  });
  layouts.add(s.balls.map((b) => `${b.x},${b.y}`).join(";"));
  corners.add(`${Math.sign(s.balls[1].x - 195000)}${Math.sign(s.balls[1].y - 299000)}`);
  assert.equal(s.shotsLeft, rules.shots);
}
assert.equal(layouts.size, 400, "every opening differs");
assert.equal(corners.size, 4, "easy target appears in all four corners");

// Replays: bot play reproduces exactly; 60/120/144 Hz and validation covered by verifyCoreFixture.
const a = playBilliardsV4("billiards4-bot");
assert.deepEqual(replayCore(core, a.inputs, a.state.tick, "billiards4-bot", 1e9).state, a.state);
for (const r of fixture.runs as any[])
  verifyCoreFixture(core, r.seed, r.inputs, r.finalTick, 1e9, { score: r.score, status: r.status as "failed", failure: r.failure, hash: r.hash });
console.log(`Billiards V4 OK · no bumpers · 400 distinct openings · bot score ${a.state.score}`);
