import assert from "node:assert/strict";
import { PHALANX_CORE as core } from "../lib/verified/starPhalanxCore.v2";
import { choosePhalanxAction } from "./phalanx-play-fixture";
import { generateScenario } from "../lib/server/scenarios";
import {
  applyCoreInput,
  stepCore,
  replayCore,
} from "../lib/verified/coreRuntime.v1";
import type { ReplayInput } from "../lib/verified/inputValidation";
import { verifyCoreFixture } from "./core-test-utils";
import fixture from "./fixtures/phalanx-v2.json" with { type: "json" };
verifyCoreFixture(core, fixture.seed, fixture.inputs, fixture.finalTick, 1e6, {
  score: 43475,
  status: "won",
  failure: null,
  hash: "sha256:023e94a805184bcfff80a95971e02d7c72b3b2be57f331213439b285e116694e",
});
let wins = 0;
for (let n = 0; n < 32; n++) {
  const s = core.create(
      generateScenario({ game_id: "star-phalanx", game_version: "2.0.0" }, n)
        .seed,
    ),
    inputs: ReplayInput[] = [];
  while (s.status === "running") {
    const a = choosePhalanxAction(s);
    if (a && core.canApply(s, a)) {
      inputs.push({ seq: inputs.length, tick: s.tick, action: a });
      applyCoreInput(core, s, a, 1e6);
    }
    const count = s.enemies.length,
      shotIds = new Set(s.shots.map((b) => b.id)),
      oldVolley = s.nextVolleyTick;
    stepCore(core, s, 1e6);
    assert.equal(s.nextLayerTick, null, "no pause clock");
    assert.equal(s.height, s.kills);
    assert.ok(s.enemies.length >= count, "no field replacement");
    if (s.enemies.length > count) {
      assert.ok(
        s.shots.some((b) => shotIds.has(b.id)) || shotIds.size === 0,
        "unspent projectiles continue across arrival",
      );
      assert.ok(
        s.nextVolleyTick <= Math.max(oldVolley, s.tick + 240),
        "arrival does not restart volley grace",
      );
    }
  }
  if (s.status === "won") {
    wins++;
    assert.equal(s.kills, 100);
    assert.equal(s.clearedLayers, 16);
  }
  assert.deepEqual(replayCore(core, inputs, s.tick, s.seed, 1e6).state, s);
  console.log(n, s.status, s.tick, s.kills, s.lives, inputs.length);
}
assert.ok(wins >= 28, "continuous full course remains achievable");

for (let i = 0; i < 128; i++) {
  const s = core.create(`phalanx-v2-opening-${i}`);
  for (let t = 0; t < 960; t++) stepCore(core, s, 1e6);
  assert.equal(s.lives, 3);
}
const carry = core.create("continuity");
carry.enemies.forEach((e) => (e.hp = 0));
carry.shots = [
  { id: 12, x: 90000, y: 300000, vy: -4000, enemy: false, spent: false },
  { id: 13, x: 90000, y: 220000, vy: 1700, enemy: true, spent: false },
];
carry.shotIndex = 14;
carry.offset = 17000;
carry.direction = -1;
carry.moveRemainder = 80;
carry.descent = 125000;
carry.nextVolleyTick = 7000;
stepCore(core, carry, 1e6);
assert.equal(carry.enemies.length, 7);
assert.equal(carry.clearedLayers, 1);
assert.equal(carry.nextLayerTick, null);
assert.equal(carry.direction, -1);
assert.equal(carry.nextVolleyTick, 7000);
assert.deepEqual(
  carry.shots.map((b) => [b.id, b.y]),
  [
    [12, 296000],
    [13, 221700],
  ],
);
assert.ok(
  carry.enemies
    .filter((e) => e.hp > 0)
    .every(
      (e) => e.y + carry.descent >= 100000 && e.y + carry.descent < 200000,
    ),
  "fresh arrivals stay visible after accumulated descent",
);
const held = core.create("hold");
assert.equal(applyCoreInput(core, held, "FIRE_DOWN", 1e6), true);
assert.equal(applyCoreInput(core, held, "FIRE_DOWN", 1e6), false);
for (let i = 0; i < 25; i++) stepCore(core, held, 1e6);
assert.equal(held.shotIndex, 2);
assert.equal(applyCoreInput(core, held, "FIRE_UP", 1e6), true);
const count = held.shotIndex;
for (let i = 0; i < 60; i++) stepCore(core, held, 1e6);
assert.equal(held.shotIndex, count);
const loss = core.create("hull");
for (let i = 0; i < 3; i++) {
  loss.tick = loss.shieldUntil;
  loss.shots = [
    { id: i, x: loss.shipX, y: 550300, vy: 1700, enemy: true, spent: false },
  ];
  stepCore(core, loss, 1e6);
}
assert.equal(loss.status, "failed");
assert.equal(loss.failure, "HULL_EXHAUSTED");
console.log(
  "Phalanx V2: continuous layers, preserved projectile flights, safe rebasing, shield/held inputs, 128 safe openings, 32 full replays",
);
