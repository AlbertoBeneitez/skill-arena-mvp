import assert from "node:assert/strict";
import { BRICK_RELAY_CORE as core } from "../lib/verified/brickRelayCore.v2";
import { chooseBrickAction } from "./brick-play-fixture";
import { generateScenario } from "../lib/server/scenarios";
import {
  applyCoreInput,
  stepCore,
  replayCore,
} from "../lib/verified/coreRuntime.v1";
import type { ReplayInput } from "../lib/verified/inputValidation";
import { verifyCoreFixture } from "./core-test-utils";
import fixture from "./fixtures/brick-v2.json" with { type: "json" };
verifyCoreFixture(core, fixture.seed, fixture.inputs, fixture.finalTick, 1e6, {
  score: 24887,
  status: "won",
  failure: null,
  hash: "sha256:91d4390c85bafc6b24c7dd0bea2eeace00973deb7e75e0f063d1528fbf52069d",
});
let wins = 0;
for (let i = 0; i < 16; i++) {
  const s = core.create(
      generateScenario({ game_id: "brick-relay", game_version: "2.0.0" }, i)
        .seed,
    ),
    inputs: ReplayInput[] = [];
  const ids = s.bricks.map((b) => b.id);
  while (s.status === "running") {
    const toggle =
      s.tick % 1200 === 0
        ? "BOOST_DOWN"
        : s.tick % 1200 === 360
          ? "BOOST_UP"
          : null;
    const a =
      toggle && core.canApply(s, toggle) ? toggle : chooseBrickAction(s);
    if (core.canApply(s, a)) {
      inputs.push({ seq: inputs.length, tick: s.tick, action: a });
      applyCoreInput(core, s, a, 1e6);
    }
    stepCore(core, s, 1e6);
    assert.deepEqual(
      s.bricks.map((b) => b.id),
      ids,
      "no replacement/sector reset",
    );
    assert.equal(s.height, s.destroyed);
    assert.ok(s.speed <= 4200);
  }
  if (s.status === "won") wins++;
  console.log(i, s.status, s.tick, s.destroyed, s.lives, inputs.length);
  assert.deepEqual(replayCore(core, inputs, s.tick, s.seed, 1e6).state, s);
}
assert.ok(wins >= 12, "single wall stays achievable with boost");
for (let i = 0; i < 128; i++) {
  const s = core.create(`brick-opening-${i}`);
  for (let t = 0; t < 960; t++) stepCore(core, s, 1e6);
  assert.equal(s.lives, 3);
}
const s = core.create("boost-validation");
assert.equal(applyCoreInput(core, s, "BOOST_UP", 1e6), false);
const before = { vx: s.vx, vy: s.vy, speed: s.speed };
assert.equal(applyCoreInput(core, s, "BOOST_DOWN", 1e6), true);
assert.equal(s.speed, 3000);
assert.equal(s.vy, -3000);
assert.equal(applyCoreInput(core, s, "BOOST_DOWN", 1e6), false);
stepCore(core, s, 1e6);
assert.equal(applyCoreInput(core, s, "BOOST_UP", 1e6), true);
assert.deepEqual({ vx: s.vx, vy: s.vy, speed: s.speed }, before);
console.log("Brick V2 continuous wall / boost / full replay / safe opening OK");

const miss = core.create("loss");
miss.serveUntil = 0;
for (let i = 0; i < 3; i++) {
  miss.tick = miss.serveUntil;
  miss.ballY = 638000;
  miss.vy = miss.speed;
  stepCore(core, miss, 1e6);
}
assert.equal(miss.failure, "BALL_LOST");
assert.equal(miss.status, "failed");
const armor = core.create("contact");
armor.serveUntil = 0;
armor.bricks = [
  {
    id: 0,
    x: 160000,
    y: 150000,
    w: 60000,
    h: 20000,
    hp: 2,
    maxHp: 2,
    kind: "armor",
    drift: 0,
    period: 1,
    phase: 0,
  },
];
armor.ballX = 190000;
armor.ballY = 180000;
armor.vy = -4000;
stepCore(core, armor, 1e6);
assert.equal(armor.bricks[0].hp, 1);
assert.equal(armor.score, 95);
assert.ok(armor.vy > 0);
for (let t = 0; t < 10; t++) stepCore(core, armor, 1e6);
assert.equal(armor.bricks[0].hp, 1, "outward contact prevents repeated damage");
const boost = core.create("boosted-contact");
boost.serveUntil = 0;
boost.ballX = 195000;
boost.ballY = 560000;
boost.vy = 2000;
applyCoreInput(core, boost, "BOOST_DOWN", 1e6);
stepCore(core, boost, 1e6);
assert.equal(boost.paddleHits, 1);
assert.ok(boost.vy < 0);
assert.equal(boost.speed, 3012);
assert.equal(applyCoreInput(core, boost, "BOOST_UP", 1e6), true);
assert.equal(boost.speed, 2008);
const hashes = new Set<string>();
for (let i = 0; i < 1000; i++) {
  const b = core.create(
    generateScenario({ game_id: "brick-relay", game_version: "2.0.0" }, i).seed,
  );
  hashes.add(JSON.stringify(b.bricks));
}
assert.equal(hashes.size, 1000, "distinct reproducible walls");
const blast = core.create("blast");
blast.serveUntil = 0;
blast.bricks = [
  {
    id: 0,
    x: 160000,
    y: 150000,
    w: 50000,
    h: 20000,
    hp: 1,
    maxHp: 1,
    kind: "blast",
    drift: 0,
    period: 1,
    phase: 0,
  },
  {
    id: 1,
    x: 218000,
    y: 150000,
    w: 50000,
    h: 20000,
    hp: 2,
    maxHp: 2,
    kind: "armor",
    drift: 0,
    period: 1,
    phase: 0,
  },
];
blast.ballX = 185000;
blast.ballY = 180000;
blast.vy = -4000;
stepCore(core, blast, 1e6);
assert.equal(blast.destroyed, 2);
assert.equal(blast.status, "won");
assert.equal(blast.height, 2);
const repeated = core.create("held-toggle");
repeated.vx = 1237;
repeated.vy = -1572;
for (let t = 0; t < 100; t++) {
  const a = repeated.boosted ? "BOOST_UP" : "BOOST_DOWN";
  applyCoreInput(core, repeated, a, 1e6);
  stepCore(core, repeated, 1e6);
}
assert.equal(repeated.speed, 2000);
assert.equal(repeated.vx, 1237);
assert.equal(
  repeated.vy,
  -1572,
  "rapid toggles do not accumulate velocity rounding",
);
