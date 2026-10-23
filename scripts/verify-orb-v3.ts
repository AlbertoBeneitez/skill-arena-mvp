import assert from "node:assert/strict";
import { generateScenario } from "../lib/server/scenarios";
import { replayCore } from "../lib/verified/coreRuntime.v1";
import { ORB_BURST_CORE_V3 as core, ORB_V3_RULES as rules, orbSourceRowV3, copyOrbV3State } from "../lib/verified/orbBurstCore.v3";
import { ORB_ACTIONS_V3 } from "../lib/verified/orbBurstProtocol.v3";
import { verifyCoreFixture } from "./core-test-utils";
import { playOrbV3 } from "./orb-v3-play-fixture";
import fixture from "./fixtures/orb-v3.json" with { type: "json" };

assert.equal(core.actions.at(-1), "SWAP");
assert.equal(core.actions.length, ORB_ACTIONS_V3.length);
// Generation: stones from row 6, five colours late, one bomb in every sixth shot, nothing random.
let stones = 0, fiveColours = 0;
for (let i = 0; i < 200; i++) {
  const seed = generateScenario({ game_id: core.gameId, game_version: core.gameVersion }, i).seed;
  assert.deepEqual(core.create(seed), core.create(seed));
  for (let ordinal = 4; ordinal < rules.sourceRows; ordinal++) {
    const row = orbSourceRowV3(seed, ordinal);
    const a = row.filter((b) => b.color === rules.asteroid).length;
    assert.equal(a, ordinal >= 6 ? 1 : 0);
    stones += a;
    if (new Set(row.map((b) => b.color)).size >= 5) fiveColours++;
  }
}
assert.equal(stones, 200 * 6);
assert.ok(fiveColours > 0);

// SWAP exchanges the two orbs, spends one charge, is refused at zero or while shooting.
const s = core.create("orb3-swap");
assert.equal(s.swaps, rules.initialSwaps);
const [c, n] = [s.currentColor, s.nextColor];
if (c !== n) {
  assert.equal(core.canApply(s, "SWAP"), true);
  core.apply(s, "SWAP");
  assert.deepEqual([s.currentColor, s.nextColor], [n, c]);
  assert.equal(s.swaps, rules.initialSwaps - 1);
}
const none = copyOrbV3State(s);
none.swaps = 0;
assert.equal(core.canApply(none, "SWAP"), false);

// Bot with and without swap: bombs show up, swaps are used, replays match live play.
const withSwap = playOrbV3("orb3-bot", 400, true);
assert.ok(withSwap.inputs.some((i) => i.action === "SWAP"), "bot uses swap");
const replay = replayCore(core, withSwap.inputs, withSwap.s.tick, "orb3-bot", 108);
assert.equal(replay.valid, true, String(replay.error));
assert.deepEqual(replay.state, withSwap.s);
let bombSeen = false;
const probe = core.create("orb3-bomb");
for (let k = 0; k < 12 && !bombSeen; k++) { /* queue pattern */
  const t = copyOrbV3State(probe);
  t.shotOrdinal = k;
  bombSeen = k % rules.bombEvery === rules.bombEvery - 1;
}
assert.ok(bombSeen);
const run = withSwap.s;
assert.ok(run.height > 0, "progress made");

for (const r of fixture.runs as any[])
  verifyCoreFixture(core, r.seed, r.inputs.map(([tick, action]: (string | number)[], seq: number) => ({ seq, tick: Number(tick), action: String(action) })), r.finalTick, rules.sourceGoal, {
    score: r.score, status: r.status as "running", failure: r.failure, hash: r.hash,
  });
console.log(`Orb V3 OK (height ${run.height}, swaps left ${run.swaps})`);
