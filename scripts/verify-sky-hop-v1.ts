import assert from "node:assert/strict";
import {
  SKY_HOP_CORE as core,
  hopPlatformX,
} from "../lib/verified/skyHopCore.v1";
import {
  applyCoreInput,
  stepCore,
  replayCore,
} from "../lib/verified/coreRuntime.v1";
import { generateScenario } from "../lib/server/scenarios";
import { chooseHopAction } from "./sky-hop-play-fixture";
import type { ReplayInput } from "../lib/verified/inputValidation";
import { verifyCoreFixture } from "./core-test-utils";
import fixture from "./fixtures/sky-hop-v1.json" with { type: "json" };
verifyCoreFixture(core, fixture.seed, fixture.inputs, fixture.finalTick, 1e6, {
  score: fixture.score,
  status: "won",
  failure: null,
  hash: fixture.hash,
});
let wins = 0;
for (let i = 0; i < 32; i++) {
  const seed = generateScenario(
      { game_id: "sky-hop", game_version: "1.0.0" },
      i,
    ).seed,
    s = core.create(seed),
    inputs: ReplayInput[] = [];
  while (s.status === "running") {
    const a = chooseHopAction(s);
    if (a && core.canApply(s, a)) {
      inputs.push({ seq: inputs.length, tick: s.tick, action: a });
      applyCoreInput(core, s, a, 1e6);
    }
    stepCore(core, s, 1e6);
  }
  if (s.status === "won") wins++;
  assert.deepEqual(replayCore(core, inputs, s.tick, seed, 1e6).state, s);

  if (i < 3)
    console.log(
      i,
      s.status,
      s.highest,
      s.score,
      s.tick,
      inputs.length,
      s.lives,
    );
}
assert.equal(wins, 32, "all sampled courses have a playable full ascent");
for (let i = 0; i < 128; i++) {
  const s = core.create(
    generateScenario({ game_id: "sky-hop", game_version: "1.0.0" }, i).seed,
  );
  for (let t = 0; t < 600; t++) stepCore(core, s, 1e6);
  assert.equal(
    s.lives,
    3,
    "five seconds without input teach the bounce safely",
  );
  assert.ok(s.highest >= 3);
  for (let p = 1; p < 76; p++) {
    const a = s.platforms[p - 1],
      b = s.platforms[p];
    assert.ok(a.y - b.y <= 97_000 && a.y - b.y >= 72_000);
    assert.ok(hopPlatformX(b, 0) >= 20000);
  }
}
const farm = core.create("farm");
farm.platforms = farm.platforms.slice(0, 1);
farm.brokenAt = [-1];
farm.collected = [false];
for (let t = 0; t < 3000; t++) stepCore(core, farm, 1e6);
assert.ok(farm.landings > 10);
assert.equal(farm.score, 0, "repeated base bounces never farm points");
console.log(
  "Sky Hop: 32 full ascent replays, 128 safe openings, no idle farming",
);

// Invalid held-state transitions are rejected, including repeated downs/ups.
const held = core.create("held");
assert.equal(applyCoreInput(core, held, "LEFT_UP", 1e6), false);
assert.equal(applyCoreInput(core, held, "LEFT_DOWN", 1e6), true);
assert.equal(applyCoreInput(core, held, "LEFT_DOWN", 1e6), false);
assert.equal(applyCoreInput(core, held, "RIGHT_DOWN", 1e6), true);
for (let t = 0; t < 20; t++) stepCore(core, held, 1e6);
assert.equal(held.vx, 0, "opposing held directions cancel");
applyCoreInput(core, held, "LEFT_UP", 1e6);
applyCoreInput(core, held, "RIGHT_UP", 1e6);
assert.equal(held.left, false);
assert.equal(held.right, false);
const landing = core.create("landing"),
  p = landing.platforms[1];
landing.x = p.x + p.width / 2;
landing.y = p.y - 19500;
landing.vy = 1000;
stepCore(core, landing, 1e6);
assert.equal(landing.y, p.y - 19000);
assert.equal(landing.vy, -4300);
assert.equal(landing.highest, 1);
assert.equal(landing.score, 288);
landing.y = p.y - 19500;
landing.vy = 1000;
stepCore(core, landing, 1e6);
assert.equal(landing.score, 288, "same platform never scores twice");
const side = core.create("side");
side.x = p.x + p.width / 2;
side.y = p.y - 18000;
side.vy = 1000;
stepCore(core, side, 1e6);
assert.equal(side.highest, 0, "side overlap does not teleport to support");
const ascending = core.create("ascending");
ascending.x = p.x + p.width / 2;
ascending.y = p.y - 18000;
ascending.vy = -1000;
stepCore(core, ascending, 1e6);
assert.equal(ascending.highest, 0, "upward crossings are not landings");
const recovery = core.create("recovery");
recovery.checkpoint = 10;
recovery.highest = 15;
recovery.camera = -2000000;
recovery.y = -1200000;
stepCore(core, recovery, 1e6);
assert.equal(recovery.lives, 2);
assert.equal(recovery.lastLandingIndex, 10);
assert.equal(recovery.score, 0);
assert.equal(recovery.y, recovery.platforms[10].y - 19000);
for (let k = 0; k < 2; k++) {
  recovery.y = recovery.camera + 700000;
  stepCore(core, recovery, 1e6);
}
assert.equal(recovery.status, "failed");
assert.equal(recovery.failure, "FALLEN");
const wrap = core.create("wrap");
wrap.x = 405000;
wrap.vx = 2000;
wrap.right = true;
stepCore(core, wrap, 1e6);
assert.ok(wrap.x < 0);
wrap.x = -15000;
wrap.vx = -2000;
wrap.left = true;
wrap.right = false;
stepCore(core, wrap, 1e6);
assert.ok(wrap.x > 390000);
function landOn(i: number) {
  const s = core.create("special"),
    p = s.platforms[i];
  s.x = hopPlatformX(p, s.tick + 1) + p.width / 2;
  s.y = p.y - 19500;
  s.vy = 1000;
  s.camera = Math.min(0, s.y - 260000);
  return s;
}
const boost = landOn(7);
stepCore(core, boost, 1e6);
assert.equal(boost.vy, -5200);
const crumble = landOn(13);
stepCore(core, crumble, 1e6);
assert.equal(crumble.brokenAt[13], crumble.tick + 72);
const broken = crumble.platforms[13];
crumble.tick = crumble.brokenAt[13];
crumble.y = broken.y - 19500;
crumble.vy = 1000;
stepCore(core, crumble, 1e6);
assert.ok(crumble.vy > 0);
const pickup = landOn(6);
pickup.lives = 2;
stepCore(core, pickup, 1e6);
assert.equal(pickup.lives, 3);
assert.equal(pickup.collected[6], true);
const scored = pickup.score;
pickup.y = pickup.platforms[6].y - 19500;
pickup.vy = 1000;
stepCore(core, pickup, 1e6);
assert.equal(pickup.score, scored, "no reusable healing or pickup points");
const idle = core.create("idle");
while (idle.status === "running") stepCore(core, idle, 1e6);
assert.equal(replayCore(core, [], idle.tick, "idle", 1e6).valid, true);
assert.equal(idle.status, "failed");
assert.ok(
  Buffer.byteLength(
    JSON.stringify(
      Array.from({ length: 4000 }, (_, seq) => ({
        seq,
        tick: 21600,
        action: "RIGHT_DOWN",
      })),
    ),
  ) < 240000,
);
console.log(
  "Sky Hop: held/cancel semantics, downward support, no side/up snaps, checkpoint/shields, wrap, boost/crumble/unique pickups, input cap, idle loss",
);
