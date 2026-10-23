import assert from "node:assert/strict";
import { generateScenario } from "../lib/server/scenarios";
import { applyCoreInput, replayCore, stepCore } from "../lib/verified/coreRuntime.v1";
import { METRO_CORE_V2 as core, METRO_V2_LANES, metroSpeedV2, type MetroStateV2 } from "../lib/verified/metroShiftCore.v2";
import { planMetroV2Run } from "./metro-v2-play-fixture";
import { verifyCoreFixture } from "./core-test-utils";
import fixture from "./fixtures/metro-v2.json" with { type: "json" };

/** A clean lane with a single hand-placed item, so each rule is tested alone. */
function bare(): MetroStateV2 {
  const s = core.create("metro2-bare");
  s.obstacles = [];
  s.coins = [];
  s.pickups = [];
  s.nextZ = 1e12;
  return s;
}
function run(s: MetroStateV2, ticks: number, at: Record<number, string> = {}) {
  for (let i = 0; i < ticks && s.status === "running"; i++) {
    const a = at[s.tick];
    if (a) assert.equal(applyCoreInput(core, s, a, 1e9), true, `${a}@${s.tick}`);
    stepCore(core, s, 1e9);
  }
}

// Course: deterministic, always passable (never three lanes of trains at once).
const patterns = new Set<number>();
for (let i = 0; i < 200; i++) {
  const seed = generateScenario({ game_id: core.gameId, game_version: core.gameVersion }, i).seed;
  assert.deepEqual(core.create(seed), core.create(seed));
  const a = planMetroV2Run(core.create(seed), 5000).state;
  const trains = a.obstacles.filter((o) => o.kind === "train");
  assert.ok(a.obstacles.length > 4 && a.coins.length > 40);
  for (let z = 0; z < a.nextZ; z += 20000) {
    const blocked = new Set(trains.filter((o) => o.z <= z && z <= o.z + o.len).map((o) => o.lane));
    assert.ok(blocked.size <= 2, `seed${i}@${z}`);
  }
  for (const o of a.obstacles) assert.ok(o.lane >= 0 && o.lane <= 2);
  patterns.add(a.lastPattern);
  // The first obstacle leaves the runner time to read the scene.
  assert.ok(a.obstacles[0].z >= 1_300_000 || a.coins[0].z >= 1_300_000);
}
assert.ok(patterns.size >= 6);

// Speed ramps and jet/stumble modifiers.
const probe = bare();
assert.equal(metroSpeedV2(probe), 1500);
probe.tick = 6000;
assert.equal(metroSpeedV2(probe), 2000);
probe.jetUntil = 7000;
assert.equal(metroSpeedV2(probe), 2700);

// Lane changes: cooldown and edges.
{
  const s = bare();
  assert.equal(core.canApply(s, "LEFT"), true);
  applyCoreInput(core, s, "LEFT", 1e9);
  assert.equal(s.lane, 0);
  assert.equal(core.canApply(s, "LEFT"), false, "edge");
  assert.equal(core.canApply(s, "RIGHT"), false, "cooldown");
  run(s, 8);
  assert.equal(core.canApply(s, "RIGHT"), true);
  run(s, 10);
  assert.equal(Math.round(s.x), METRO_V2_LANES[0]);
}

// Trains always hurt; shield makes the same train harmless afterwards.
{
  const s = bare();
  s.obstacles = [{ z: 400000, len: 420000, lane: 1, kind: "train", hit: false }];
  run(s, 400);
  assert.equal(s.lives, 2);
  assert.ok(s.shieldUntil > s.tick - 400);
  const other = bare();
  other.obstacles = [{ z: 400000, len: 420000, lane: 1, kind: "train", hit: false }];
  run(other, 20, { 0: "LEFT" });
  run(other, 400);
  assert.equal(other.lives, 3, "dodged by changing lane");
}

// Low barrier: jump clears it, standing or sliding does not.
{
  const jumped = bare();
  jumped.obstacles = [{ z: 600000, len: 30000, lane: 1, kind: "low", hit: false }];
  // 600000 at 1500/tick: crossing around tick 400; jump ~24 ticks before.
  run(jumped, 370, {});
  applyCoreInput(core, jumped, "JUMP", 1e9);
  run(jumped, 120);
  assert.equal(jumped.lives, 3);
  assert.equal(jumped.jumps, 1);
  const stood = bare();
  stood.obstacles = [{ z: 600000, len: 30000, lane: 1, kind: "low", hit: false }];
  run(stood, 500);
  assert.equal(stood.lives, 2);
  assert.equal(core.canApply(stood, "JUMP"), true);
}

// Overhead beam: sliding passes, jumping or running does not.
{
  const slid = bare();
  slid.obstacles = [{ z: 600000, len: 30000, lane: 1, kind: "high", hit: false }];
  run(slid, 380);
  applyCoreInput(core, slid, "SLIDE", 1e9);
  assert.equal(core.canApply(slid, "SLIDE"), false, "already sliding");
  run(slid, 120);
  assert.equal(slid.lives, 3);
  const jumped = bare();
  jumped.obstacles = [{ z: 600000, len: 30000, lane: 1, kind: "high", hit: false }];
  run(jumped, 370);
  applyCoreInput(core, jumped, "JUMP", 1e9);
  run(jumped, 120);
  assert.equal(jumped.lives, 2, "beams cannot be jumped");
}

// Air slide = fast fall, then a slide on landing.
{
  const s = bare();
  applyCoreInput(core, s, "JUMP", 1e9);
  run(s, 12);
  assert.ok(s.jumpY < 0);
  assert.equal(core.canApply(s, "SLIDE"), true);
  applyCoreInput(core, s, "SLIDE", 1e9);
  run(s, 30);
  assert.equal(s.jumpY, 0);
  assert.ok(s.slideUntil > s.tick, "slides right after landing");
}

// Coins: ground coins need ground, air coins need height; lane must match.
{
  const s = bare();
  s.coins = [
    { z: 100000, lane: 1, air: false, state: 0 },
    { z: 200000, lane: 0, air: false, state: 0 },
    { z: 300000, lane: 1, air: true, state: 0 },
  ];
  run(s, 400);
  assert.equal(s.coinCount, 1);
  assert.deepEqual(s.coins.map((c) => c.state), [1, 2, 2]);
  assert.equal(s.score, Math.floor(s.distance / 10000) + 10);
  const air = bare();
  air.coins = [{ z: 300000, lane: 1, air: true, state: 0 }];
  run(air, 120);
  applyCoreInput(core, air, "JUMP", 1e9);
  run(air, 200);
  assert.equal(air.coinCount, 0, "jumped too late/early is allowed to miss");
}

// Pickups: life restores up to three; jet flies, protects, and stops commands.
{
  const s = bare();
  s.lives = 1;
  s.pickups = [{ z: 100000, lane: 1, kind: "life", state: 0 }];
  run(s, 100);
  assert.equal(s.lives, 2);
  const jet = bare();
  jet.pickups = [{ z: 100000, lane: 1, kind: "jet", state: 0 }];
  jet.obstacles = [{ z: 600000, len: 420000, lane: 1, kind: "train", hit: false }];
  run(jet, 200);
  assert.ok(jet.tick < jet.jetUntil);
  assert.ok(jet.jumpY < -50000, "flying");
  assert.equal(core.canApply(jet, "JUMP"), false);
  assert.equal(core.canApply(jet, "SLIDE"), false);
  assert.equal(core.canApply(jet, "LEFT"), true);
  run(jet, 900);
  assert.equal(jet.lives, 3, "flew over the train");
  assert.equal(jet.jumpY, 0, "landed");
}

// Three crashes end the run with the crash reason and the score so far.
{
  const s = bare();
  s.obstacles = [0, 1, 2].map((i) => ({ z: 300000 + i * 700000, len: 420000, lane: 1, kind: "train" as const, hit: false }));
  run(s, 6000);
  assert.equal(s.status, "failed");
  assert.equal(s.failure, "CRASH");
  assert.equal(s.lives, 0);
}

// Reference player: long, reproducible runs and exact replay.
let best = 0;
for (let i = 0; i < 12; i++) {
  const seed = `metro2-route-${i}`;
  const r = planMetroV2Run(core.create(seed), 18000, 2000);
  assert.equal(r.state.status, "won", `seed${i} reaches the target`);
  assert.ok(r.state.jumps > 0 && r.state.slides > 0 && r.state.coinCount > 20, `seed${i}`);
  assert.ok(r.state.score > 600);
  best = Math.max(best, r.state.score);
  const replay = replayCore(core, r.inputs, r.state.tick, seed, 2000);
  assert.equal(replay.valid, true);
  assert.deepEqual(replay.state, r.state);
}
verifyCoreFixture(core, fixture.seed, fixture.inputs, fixture.finalTick, 2000, {
  score: fixture.score,
  status: "won",
  failure: fixture.failure,
  hash: fixture.hash,
});
console.log(`Metro V2 OK · 3 lanes · jump/slide/train rules · coins · jet · golden replay (best bot ${best})`);
