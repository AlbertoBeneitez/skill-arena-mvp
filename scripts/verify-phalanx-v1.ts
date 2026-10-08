import assert from "node:assert/strict";
import {
  PHALANX_CORE as core,
  phalanxLayerCount,
} from "../lib/verified/starPhalanxCore.v1";
import {
  applyCoreInput,
  stepCore,
  replayCore,
} from "../lib/verified/coreRuntime.v1";
import { generateScenario } from "../lib/server/scenarios";
import { verifyCoreFixture } from "./core-test-utils";
import { choosePhalanxAction } from "./phalanx-play-fixture";
import type { ReplayInput } from "../lib/verified/inputValidation";
import fixture from "./fixtures/phalanx-v1.json" with { type: "json" };
verifyCoreFixture(core, fixture.seed, fixture.inputs, fixture.finalTick, 1e6, {
  score: fixture.score,
  status: "won",
  failure: null,
  hash: fixture.hash,
});
let fullWins = 0,
  replayLosses = 0;
for (let i = 0; i < 32; i++) {
  const s = core.create(
      generateScenario({ game_id: "star-phalanx", game_version: "1.0.0" }, i)
        .seed,
    ),
    inputs: ReplayInput[] = [];
  const stages = new Set<number>();
  while (s.status === "running") {
    const a = choosePhalanxAction(s);
    if (a && core.canApply(s, a)) {
      inputs.push({ seq: inputs.length, tick: s.tick, action: a });
      applyCoreInput(core, s, a, 1e6);
    }
    stages.add(s.wave);
    stepCore(core, s, 1e6);
  }
  if (s.status === "won") {
    fullWins++;
    assert.equal(s.kills, 100);
    assert.equal(s.clearedLayers, 16);
    assert.equal(stages.size, 5);
    assert.ok(s.tick > 120 * 60 && s.tick < 21600);
  } else {
    replayLosses++;
    assert.ok(["HULL_EXHAUSTED", "TIME_LIMIT"].includes(s.failure!));
  }
  assert.deepEqual(replayCore(core, inputs, s.tick, s.seed, 1e6).state, s);
}
assert.ok(
  fullWins >= 28,
  "full progression remains achievable across the sampled scenarios",
);
const layers = core.create("layers");
assert.equal(layers.enemies.length, 3);
assert.deepEqual([1, 2, 3, 4, 5].map(phalanxLayerCount), [2, 3, 3, 4, 4]);
layers.enemies.forEach((e) => (e.hp = 0));
stepCore(core, layers, 1e6);
assert.equal(layers.layer, 1);
assert.equal(layers.clearedLayers, 1);
assert.equal(layers.enemies.filter((e) => e.hp > 0).length, 0);
for (let t = 0; t < 149; t++) stepCore(core, layers, 1e6);
assert.equal(layers.enemies.filter((e) => e.hp > 0).length, 0);
stepCore(core, layers, 1e6);
assert.equal(
  layers.enemies.filter((e) => e.hp > 0).length,
  4,
  "next layer arrives only after pause",
);
const shooting = core.create("shooting");
applyCoreInput(core, shooting, "FIRE_DOWN", 1e6);
assert.equal(applyCoreInput(core, shooting, "FIRE_DOWN", 1e6), false);
for (let t = 0; t < 25; t++) stepCore(core, shooting, 1e6);
assert.equal(shooting.shotIndex, 2);
applyCoreInput(core, shooting, "FIRE_UP", 1e6);
const shots = shooting.shotIndex;
for (let t = 0; t < 60; t++) stepCore(core, shooting, 1e6);
assert.equal(shooting.shotIndex, shots, "release really stops firing");
const toggle = core.create("toggle");
for (let t = 0; t < 32; t++) {
  applyCoreInput(core, toggle, toggle.firing ? "FIRE_UP" : "FIRE_DOWN", 1e6);
  stepCore(core, toggle, 1e6);
}
assert.equal(toggle.shotIndex, 2, "rapid toggle cannot bypass the shot clock");
const hit = core.create("hit");
hit.shots = [0, 1].map((id) => ({
  id,
  x: 195000,
  y: 550000,
  vy: 2100,
  enemy: true,
  spent: false,
}));
stepCore(core, hit, 1e6);
assert.equal(hit.lives, 2, "simultaneous hits cost one shield");
assert.equal(hit.shots.length, 0);
const inputs = core.create("inputs");
assert.equal(applyCoreInput(core, inputs, "AIM_000", 1e6), true);
assert.equal(inputs.targetX, 20000);
assert.equal(applyCoreInput(core, inputs, "AIM_001", 1e6), false);
for (let t = 0; t < 6; t++) stepCore(core, inputs, 1e6);
assert.equal(applyCoreInput(core, inputs, "AIM_035", 1e6), true);
assert.equal(inputs.targetX, 370000);
assert.equal(core.canApply(inputs, "AIM_036"), false);
for (let i = 0; i < 128; i++) {
  const s = core.create(
    generateScenario({ game_id: "star-phalanx", game_version: "1.0.0" }, i)
      .seed,
  );
  for (let t = 0; t < 960; t++) stepCore(core, s, 1e6);
  assert.equal(s.lives, 3);
  assert.equal(
    s.shots.filter((b) => b.enemy).length,
    0,
    "eight seconds of learning before enemy fire",
  );
  assert.equal(s.enemies.length, 3);
}
const idle = core.create("idle");
while (idle.status === "running") stepCore(core, idle, 1e6);
assert.ok(idle.tick > 960);
assert.ok(["HULL_EXHAUSTED", "TIME_LIMIT"].includes(idle.failure!));
assert.equal(replayCore(core, [], idle.tick, "idle", 1e6).valid, true);
const charged = core.create("charged");
while (charged.chargeId === null) stepCore(core, charged, 1e6);
assert.equal(charged.shots.filter((b) => b.enemy).length, 0);
for (let t = 0; t < 59; t++) stepCore(core, charged, 1e6);
assert.equal(charged.shots.filter((b) => b.enemy).length, 0);
stepCore(core, charged, 1e6);
assert.equal(charged.shots.filter((b) => b.enemy).length, 1);
assert.ok(
  Buffer.byteLength(
    JSON.stringify(
      Array.from({ length: 4500 }, (_, seq) => ({
        seq,
        tick: 21600,
        action: "AIM_035",
      })),
    ),
  ) < 240000,
  "input cap leaves room in shared 256 KB route limit",
);
console.log(
  "Star Phalanx V1: 32 progression win/loss replays, five waves/16 layers/100-enemy goal, 128 safe eight-second openings, layer pause, telegraphs, armor, shields, pointer release semantics, no rapid-fire exploit, bounds/input/golden",
);

const pair = core.create("pair");
pair.wave = 4;
pair.tick = 959;
pair.chargeId = pair.enemies[0].id;
pair.chargeStarted = 900;
stepCore(core, pair, 1e6);
assert.equal(
  pair.shots.filter((b) => b.enemy).length,
  2,
  "late waves have telegraphed paired lanes",
);
assert.equal(Math.abs(pair.shots[0].x - pair.shots[1].x), 44000);
const interrupted = core.create("interrupt");
interrupted.tick = 960;
interrupted.chargeId = interrupted.enemies[0].id;
interrupted.chargeStarted = 960;
interrupted.shots = [
  {
    id: 0,
    x: interrupted.enemies[0].x,
    y: interrupted.enemies[0].y + 4000,
    vy: -4000,
    enemy: false,
    spent: false,
  },
];
stepCore(core, interrupted, 1e6);
assert.equal(interrupted.kills, 1);
assert.equal(
  interrupted.score,
  300,
  "interrupting a charged enemy awards the core bonus",
);
console.log(
  `Star Phalanx progressive geometry/paired lanes: ${fullWins} full wins and ${replayLosses} loss replays; original art and server authority preserved`,
);
