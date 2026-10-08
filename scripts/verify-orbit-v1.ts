import assert from "node:assert/strict";
import {
  ORBIT_CORE as core,
  ORBIT_RADII,
  buildOrbitCourse,
  orbitSpeed,
} from "../lib/verified/orbitShiftCore.v1";
import { chooseOrbitAction } from "./orbit-play-fixture";
import { generateScenario } from "../lib/server/scenarios";
import {
  applyCoreInput,
  stepCore,
  replayCore,
} from "../lib/verified/coreRuntime.v1";
import type { ReplayInput } from "../lib/verified/inputValidation";
import { verifyCoreFixture } from "./core-test-utils";
import fixture from "./fixtures/orbit-v1.json" with { type: "json" };
verifyCoreFixture(core, fixture.seed, fixture.inputs, fixture.finalTick, 1e6, {
  score: fixture.score,
  status: "won",
  failure: null,
  hash: fixture.hash,
});
for (let i = 0; i < 64; i++) {
  const seed = generateScenario(
      { game_id: "orbit-shift", game_version: "1.0.0" },
      i,
    ).seed,
    s = core.create(seed),
    inputs: ReplayInput[] = [];
  while (s.status === "running") {
    const a = chooseOrbitAction(s);
    if (a && core.canApply(s, a)) {
      inputs.push({ seq: inputs.length, tick: s.tick, action: a });
      applyCoreInput(core, s, a, 1e6);
    }
    stepCore(core, s, 1e6);
  }
  assert.equal(s.status, "won", `scenario${i}`);
  assert.equal(s.passed, 60);
  assert.equal(s.lives, 3);
  assert.equal(s.cleanPasses, 60);
  assert.ok(s.pickups > 0);
  assert.deepEqual(replayCore(core, inputs, s.tick, seed, 1e6).state, s);
}
for (let i = 0; i < 128; i++) {
  const s = core.create(`opening-${i}`);
  for (let t = 0; t < 960; t++) stepCore(core, s, 1e6);
  assert.equal(s.lives, 3);
  assert.ok(s.score > 0);
  const course = buildOrbitCourse(`course-${i}`);
  assert.ok(
    course.every(
      (g) => new Set(g.lanes).size === g.lanes.length && g.lanes.length <= 3,
    ),
  );
  assert.ok(
    course.every((g) => g.pickup === null || !g.lanes.includes(g.pickup)),
  );
  assert.ok(course.every((g, j) => j === 0 || g.angle > course[j - 1].angle));
}
const input = core.create("input");
assert.equal(applyCoreInput(core, input, "IN", 1e6), true);
assert.equal(input.lane, 1);
assert.equal(applyCoreInput(core, input, "IN", 1e6), false);
stepCore(core, input, 1e6);
assert.ok(
  input.radius > ORBIT_RADII[1] && input.radius < ORBIT_RADII[2],
  "continuous radius",
);
for (let i = 0; i < 11; i++) stepCore(core, input, 1e6);
assert.equal(applyCoreInput(core, input, "IN", 1e6), true);
assert.equal(input.lane, 0);
for (let i = 0; i < 12; i++) stepCore(core, input, 1e6);
assert.equal(applyCoreInput(core, input, "IN", 1e6), false, "inner boundary");
function atGate(lives = 3) {
  const s = core.create("hit");
  s.gates[0].angle = 0;
  s.gates[0].lanes = [2];
  s.gates[0].pickup = null;
  s.lives = lives;
  return s;
}
const hit = atGate();
stepCore(core, hit, 1e6);
assert.equal(hit.lives, 2);
assert.equal(hit.passed, 1);
assert.equal(hit.gates[0].hit, true);
hit.gates[1].angle = 0;
hit.gates[1].lanes = [2];
stepCore(core, hit, 1e6);
assert.equal(hit.lives, 2, "protected collision cannot drain another shield");
const lethal = atGate(1);
stepCore(core, lethal, 1e6);
assert.equal(lethal.failure, "ORBIT_COLLISION");
const heal = atGate(2);
heal.gates[0].lanes = [0];
heal.gates[0].pickup = 2;
stepCore(core, heal, 1e6);
assert.equal(heal.lives, 3);
assert.equal(heal.pickups, 1);
assert.equal(heal.gates[0].collected, true);
const score = heal.score;
stepCore(core, heal, 1e6);
assert.equal(heal.score, score, "pickup is unique");
const idle = core.create("idle");
while (idle.status === "running") stepCore(core, idle, 1e6);
assert.equal(idle.status, "failed");
assert.equal(replayCore(core, [], idle.tick, "idle", 1e6).valid, true);
assert.equal(orbitSpeed({ passed: 0 }), 128);
assert.equal(orbitSpeed({ passed: 20 }), 152);
assert.equal(orbitSpeed({ passed: 40 }), 176);
console.log(
  "Orbit: 64 full 60-gate wins, 128 safe eight-second openings, seeded 1/2/3 rings with >=2 safe, pickups/shields, continuous radial motion, bounds/cooldown, common replay",
);
