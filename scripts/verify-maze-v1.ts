import assert from "node:assert/strict";
import {
  MAZE_CORE as core,
  buildMazeSector,
  mazeDistances,
} from "../lib/verified/mazeRushCore.v1";
import { chooseMazeAction } from "./maze-play-fixture";
import { generateScenario } from "../lib/server/scenarios";
import {
  applyCoreInput,
  stepCore,
  replayCore,
} from "../lib/verified/coreRuntime.v1";
import type { ReplayInput } from "../lib/verified/inputValidation";
import { verifyCoreFixture } from "./core-test-utils";
import fixture from "./fixtures/maze-v1.json" with { type: "json" };
verifyCoreFixture(core, fixture.seed, fixture.inputs, fixture.finalTick, 1e6, {
  score: fixture.score,
  status: "won",
  failure: null,
  hash: fixture.hash,
});
let wins = 0;
for (let i = 0; i < 32; i++) {
  const seed = generateScenario(
      { game_id: "maze-rush", game_version: "1.0.0" },
      i,
    ).seed,
    s = core.create(seed),
    inputs: ReplayInput[] = [];
  while (s.status === "running") {
    const a = chooseMazeAction(s);
    if (a && core.canApply(s, a)) {
      inputs.push({ seq: inputs.length, tick: s.tick, action: a });
      applyCoreInput(core, s, a, 1e6);
    }
    stepCore(core, s, 1e6);
  }
  console.log(i, s.status, s.tick, s.score, s.sector, s.lives, inputs.length);
  if (s.status === "won") wins++;
  assert.deepEqual(replayCore(core, inputs, s.tick, seed, 1e6).state, s);
}
assert.equal(wins, 32, `full seeded courses stay attainable: ${wins}/32`);
for (let i = 0; i < 128; i++)
  for (let sector = 1; sector <= 3; sector++) {
    const b = buildMazeSector(`board-${i}`, sector),
      d = mazeDistances(b, b.start);
    assert.equal(b.walls[b.start], false, "start must never be a wall");
    assert.ok(b.walls.every((wall, j) => wall || d[j] >= 0));
    assert.equal(b.pulses.filter(Boolean).length, 3);
    assert.ok(b.pulses.every((v, j) => !v || b.nodes[j]));
  }
const idle = core.create("idle");
for (let i = 0; i < 1200; i++) stepCore(core, idle, 1e6);
assert.equal(idle.lives, 3);
assert.equal(idle.score, 0);
assert.equal(idle.player, idle.board.start);
while (idle.status === "running") stepCore(core, idle, 1e6);
assert.equal(idle.failure, "TIME_LIMIT");
assert.equal(replayCore(core, [], idle.tick, "idle", 1e6).valid, true);
console.log(
  "Maze: connected seeded sectors, full replay and safe idle opening",
);

const buffered = core.create("buffered");
assert.equal(applyCoreInput(core, buffered, "LEFT", 1e6), true);
assert.equal(applyCoreInput(core, buffered, "LEFT", 1e6), false);
assert.equal(
  applyCoreInput(core, buffered, "RIGHT", 1e6),
  false,
  "input cooldown",
);
for (let t = 0; t < 240; t++) stepCore(core, buffered, 1e6);
assert.equal(
  buffered.player,
  buffered.board.start - 1,
  "first corridor is traversable",
);
const once = buffered.score;
applyCoreInput(core, buffered, "RIGHT", 1e6);
for (let t = 0; t < 20; t++) stepCore(core, buffered, 1e6);
applyCoreInput(core, buffered, "LEFT", 1e6);
for (let t = 0; t < 20; t++) stepCore(core, buffered, 1e6);
assert.equal(
  buffered.score,
  once,
  "returning to a consumed node cannot farm points",
);
applyCoreInput(core, buffered, "STOP", 1e6);
const stopped = buffered.player;
for (let t = 0; t < 40; t++) stepCore(core, buffered, 1e6);
assert.equal(
  buffered.player,
  stopped,
  "STOP does not pause the simulation clock",
);
function contactFixture(power = false) {
  const s = core.create("contact");
  s.tick = 1200;
  s.readyAt = 0;
  s.nextMoveTick = 9999;
  s.nextEnemyTick = 9999;
  s.stageCollected = 12;
  s.board.enemies[0].cell = s.player;
  s.poweredUntil = power ? 1500 : 0;
  return s;
}
const hit = contactFixture();
stepCore(core, hit, 1e6);
assert.equal(hit.lives, 2);
assert.equal(hit.lastDamageTick, 1201);
hit.board.enemies[0].cell = hit.player;
hit.board.enemies[0].dormantUntil = 0;
stepCore(core, hit, 1e6);
assert.equal(hit.lives, 2, "protection prevents a repeated hit");
const powered = contactFixture(true);
stepCore(core, powered, 1e6);
assert.equal(powered.lives, 3);
assert.equal(powered.score, 0, "pursuer contacts cannot farm score");
assert.ok(powered.board.enemies[0].dormantUntil > powered.tick);
const lethal = contactFixture();
lethal.lives = 1;
stepCore(core, lethal, 1e6);
assert.equal(lethal.failure, "PURSUER_COLLISION");
// Both actors exchange adjacent tiles at the same tick: endpoint-only checks miss it.
const swap = contactFixture();
swap.player = swap.board.start;
swap.direction = "LEFT";
swap.queued = "LEFT";
swap.nextMoveTick = 1201;
swap.nextEnemyTick = 1201;
swap.board.walls[swap.player - 1] = false;
swap.board.pulses[swap.player - 1] = false;
swap.board.enemies[0].home = swap.player;
swap.board.enemies[0].cell = swap.player - 1;
swap.board.enemies[0].tie = 3;
stepCore(core, swap, 1e6);
assert.equal(swap.lives, 2, "edge swap is a collision");
console.log(
  "Maze: golden/render60/120/144, 384 connected boards, unique nodes, buffered turns/STOP/cooldown, chase/patrol, shields/pulse, overlap/edge-swap, terminal replay and invalid inputs",
);
