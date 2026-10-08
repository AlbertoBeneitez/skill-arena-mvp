import assert from "node:assert/strict";
import { BRICK_RELAY_CORE as core } from "../lib/verified/brickRelayCore.v1";
import { chooseBrickAction } from "./brick-play-fixture";
import { generateScenario } from "../lib/server/scenarios";
import {
  applyCoreInput,
  stepCore,
  replayCore,
} from "../lib/verified/coreRuntime.v1";
import type { ReplayInput } from "../lib/verified/inputValidation";
import { verifyCoreFixture } from "./core-test-utils";
import fixture from "./fixtures/brick-v1.json" with { type: "json" };
verifyCoreFixture(core, fixture.seed, fixture.inputs, fixture.finalTick, 1e6, {
  score: fixture.score,
  status: "won",
  failure: null,
  hash: fixture.hash,
});
let wins = 0;
for (let i = 0; i < 16; i++) {
  const s = core.create(
      generateScenario({ game_id: "brick-relay", game_version: "1.0.0" }, i)
        .seed,
    ),
    inputs: ReplayInput[] = [];
  while (s.status === "running") {
    const a = chooseBrickAction(s);
    if (core.canApply(s, a)) {
      inputs.push({ seq: inputs.length, tick: s.tick, action: a });
      applyCoreInput(core, s, a, 1e6);
    }
    stepCore(core, s, 1e6);
  }
  if (s.status === "won") wins++;
  console.log(i, s.status, s.wave, s.tick, s.score, s.lives, inputs.length);
  assert.deepEqual(replayCore(core, inputs, s.tick, s.seed, 1e6).state, s);
}
assert.ok(wins >= 12, "sampled full progression stays achievable");

for (let i = 0; i < 128; i++) {
  const s = core.create(
    generateScenario({ game_id: "brick-relay", game_version: "1.0.0" }, i).seed,
  );
  for (let t = 0; t < 960; t++) stepCore(core, s, 1e6);
  assert.equal(s.lives, 3, "vertical opening teaches without early loss");
}
const input = core.create("input");
assert.equal(applyCoreInput(core, input, "AIM_000", 1e6), true);
assert.equal(input.targetX, 70000);
assert.equal(applyCoreInput(core, input, "AIM_078", 1e6), false);
for (let t = 0; t < 7; t++) stepCore(core, input, 1e6);
assert.equal(applyCoreInput(core, input, "AIM_078", 1e6), true);
assert.equal(input.targetX, 320000);
assert.equal(core.canApply(input, "AIM_079"), false);
const miss = core.create("miss");
miss.serveUntil = 0;
miss.ballY = 638000;
miss.vy = 2000;
stepCore(core, miss, 1e6);
assert.equal(miss.lives, 2);
assert.equal(miss.serveUntil, miss.tick + 120);
for (let i = 0; i < 2; i++) {
  miss.tick = miss.serveUntil;
  miss.ballY = 638000;
  miss.vy = 2000;
  stepCore(core, miss, 1e6);
}
assert.equal(miss.failure, "BALL_LOST");
const armor = core.create("armor");
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
assert.ok(armor.vy > 0, "contact resolves outward, not repeated damage");
const blast = core.create("blast");
blast.serveUntil = 0;
blast.bricks = [
  {
    id: 0,
    x: 160000,
    y: 150000,
    w: 60000,
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
    x: 225000,
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
blast.ballX = 190000;
blast.ballY = 180000;
blast.vy = -4000;
stepCore(core, blast, 1e6);
assert.equal(blast.destroyed, 2);
assert.equal(blast.wave, 2);
assert.equal(blast.waveUntil, blast.tick + 240);
assert.ok(
  Buffer.byteLength(
    JSON.stringify(
      Array.from({ length: 4500 }, (_, seq) => ({
        seq,
        tick: 28800,
        action: "AIM_078",
      })),
    ),
  ) < 240000,
);
console.log(
  "Brick Relay: 16 full four-wave replays, 128 safe openings, circle/box/support, armor/explosion, outward contact, recovery, aim bounds/cooldown, body cap, golden/render/invalid inputs",
);
