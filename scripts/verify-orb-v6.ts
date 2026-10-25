import assert from "node:assert/strict";
import { generateScenario } from "../lib/server/scenarios";
import { applyCoreInput, replayCore, stepCore } from "../lib/verified/coreRuntime.v1";
import { ORB_BURST_CORE_V6 as core, ORB_V6_RULES as R, orbMissLimitV6, orbNeighborsV6 } from "../lib/verified/orbBurstCore.v6";
import { verifyCoreFixture } from "./core-test-utils";
import { playOrbV6 } from "./orb-v6-play-fixture";
import fixture from "./fixtures/orb-v6.json" with { type: "json" };

// Board: 7 full rows of 6 colours, clumped; reproducible; ammo only uses colours on the board.
for (let i = 0; i < 40; i++) {
  const seed = generateScenario({ game_id: core.gameId, game_version: core.gameVersion }, i).seed, s = core.create(seed);
  assert.deepEqual(s, core.create(seed));
  assert.equal(s.bubbles.length, R.initialRows * R.cols);
  const colours = new Set(s.bubbles.map((b) => b.color));
  assert.ok(colours.size >= 5, "six colours in play");
  assert.ok(colours.has(s.currentColor) && colours.has(s.nextColor));
  let sameNeighbours = 0;
  const map = new Map(s.bubbles.map((b) => [`${b.row},${b.col}`, b]));
  for (const b of s.bubbles) for (const n of orbNeighborsV6(s, b.row, b.col)) if (map.get(`${n.row},${n.col}`)?.color === b.color) sameNeighbours++;
  assert.ok(sameNeighbours > s.bubbles.length * 0.6, "colours come in clumps");
}
assert.deepEqual([0, 3, 6, 9, 12].map((rows) => orbMissLimitV6({ rowsAdded: rows })), [5, 4, 3, 2, 2], "fewer misses allowed as rows arrive");
assert.equal(core.actions.some((a) => a.startsWith("POWER_")), false, "no power-ups");
// A miss streak pushes a new row down; the danger line ends the run; idle runs out of time.
{
  const r = playOrbV6("orb6-random", "random", 400);
  assert.equal(r.s.status, "failed");
  assert.equal(r.s.failure, "BOARD_OVERFLOW", "careless shooting floods the board");
  assert.ok(r.s.rowsAdded >= 3);
  const replay = replayCore(core, r.inputs, r.s.tick, r.s.seed, 1e9);
  assert.equal(replay.valid, true, String(replay.error));
  assert.deepEqual(replay.state, r.s);
}
const idle = playOrbV6("orb6-idle", "idle");
assert.equal(idle.s.failure, "TIME_LIMIT");
// Good play pops, drops hanging orbs for doubled points, and outscores careless play.
const smart = playOrbV6("orb6-random", "smart", 60), careless = playOrbV6("orb6-random", "random", 60);
assert.ok(smart.s.popped > 30 && smart.s.dropped > 0, `smart pops ${smart.s.popped} drops ${smart.s.dropped}`);
assert.ok(smart.s.score > careless.s.score * 2, `skill matters (${smart.s.score} vs ${careless.s.score})`);
assert.equal(replayCore(core, smart.inputs, smart.s.tick, smart.s.seed, 1e9).valid, true);
// Swap exchanges the loaded and next orb; SHOOT waits while a shot flies.
{
  const s = core.create("orb6-swap");
  while (s.currentColor === s.nextColor) { s.nextColor = (s.nextColor + 1) % R.colors; }
  const [a, b] = [s.currentColor, s.nextColor];
  applyCoreInput(core, s, "SWAP", 1e9);
  assert.deepEqual([s.currentColor, s.nextColor], [b, a]);
  applyCoreInput(core, s, "SHOOT", 1e9);
  assert.equal(core.canApply(s, "SHOOT"), false);
  for (let t = 0; t < 400 && s.shot; t++) stepCore(core, s, 1e9);
  assert.equal(s.shot, null);
}
for (const r of fixture.runs as any[])
  verifyCoreFixture(core, r.seed, r.inputs.map(([tick, action]: (string | number)[], seq: number) => ({ seq, tick: Number(tick), action: String(action) })), r.finalTick, 1e9, { score: r.score, status: r.status, failure: r.failure, hash: r.hash });
console.log(`Orb Burst V6 OK · classic bubble shooter · smart ${smart.s.score} (pops ${smart.s.popped}, drops ${smart.s.dropped}) vs careless ${careless.s.score}`);
