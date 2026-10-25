import assert from "node:assert/strict";
import { generateScenario } from "../lib/server/scenarios";
import { applyCoreInput, replayCore, stepCore } from "../lib/verified/coreRuntime.v1";
import { ORB_BURST_CORE_V7 as core, ORB_V7_RULES as R, orbMissLimitV7, orbNeighborsV7, orbRowTimerV7 } from "../lib/verified/orbBurstCore.v7";
import { verifyCoreFixture } from "./core-test-utils";
import { playOrbV7 } from "./orb-v7-play-fixture";
import fixture from "./fixtures/orb-v7.json" with { type: "json" };

// Board: 8 full rows of 6 colours, clumped; reproducible; ammo only uses colours on the board.
for (let i = 0; i < 40; i++) {
  const seed = generateScenario({ game_id: core.gameId, game_version: core.gameVersion }, i).seed, s = core.create(seed);
  assert.deepEqual(s, core.create(seed));
  assert.equal(s.bubbles.length, R.initialRows * R.cols);
  const colours = new Set(s.bubbles.map((b) => b.color));
  assert.ok(colours.size >= 5, "six colours in play");
  assert.ok(colours.has(s.currentColor) && colours.has(s.nextColor));
  let sameNeighbours = 0;
  const map = new Map(s.bubbles.map((b) => [`${b.row},${b.col}`, b]));
  for (const b of s.bubbles) for (const n of orbNeighborsV7(s, b.row, b.col)) if (map.get(`${n.row},${n.col}`)?.color === b.color) sameNeighbours++;
  assert.ok(sameNeighbours > s.bubbles.length * 0.35, "colours come in clumps");
}
assert.deepEqual([0, 2, 4, 6, 8].map((rows) => orbMissLimitV7({ rowsAdded: rows })), [4, 3, 2, 1, 1], "fewer misses allowed as rows arrive");
assert.deepEqual([0, 5, 12, 30].map((rows) => orbRowTimerV7({ rowsAdded: rows })), [2400, 1800, 960, 960], "the ceiling clock speeds up");
assert.equal(R.initialRows, 8);
assert.equal(core.actions.some((a) => a.startsWith("POWER_")), false, "no power-ups");
// A miss streak pushes a new row down; the danger line ends the run; idle runs out of time.
{
  const r = playOrbV7("orb7-random", "random", 400);
  assert.equal(r.s.status, "failed");
  assert.equal(r.s.failure, "BOARD_OVERFLOW", "careless shooting floods the board");
  assert.ok(r.s.rowsAdded >= 3);
  const replay = replayCore(core, r.inputs, r.s.tick, r.s.seed, 1e9);
  assert.equal(replay.valid, true, String(replay.error));
  assert.deepEqual(replay.state, r.s);
}
// Idle: the clock alone keeps lowering the ceiling until the board overflows.
const idle = playOrbV7("orb7-idle", "idle");
assert.equal(idle.s.failure, "BOARD_OVERFLOW", String(idle.s.failure));
assert.ok(idle.s.rowsAdded >= 1);
// Good play pops, drops hanging orbs for doubled points, and outscores careless play.
const smart = playOrbV7("orb7-random", "smart", 60), careless = playOrbV7("orb7-random", "random", 60);
assert.ok(smart.s.popped > 30 && smart.s.dropped > 0, `smart pops ${smart.s.popped} drops ${smart.s.dropped}`);
assert.ok(smart.s.score > careless.s.score * 2, `skill matters (${smart.s.score} vs ${careless.s.score})`);
assert.equal(replayCore(core, smart.inputs, smart.s.tick, smart.s.seed, 1e9).valid, true);
// Swap exchanges the loaded and next orb; SHOOT waits while a shot flies.
{
  const s = core.create("orb7-swap");
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
console.log(`Orb Burst V7 OK · classic bubble shooter · smart ${smart.s.score} (pops ${smart.s.popped}, drops ${smart.s.dropped}) vs careless ${careless.s.score}`);
