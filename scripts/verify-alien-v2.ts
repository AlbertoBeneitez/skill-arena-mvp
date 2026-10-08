import assert from "node:assert/strict";
import {
  ALIEN_DASH_CORE as core,
  ALIEN_RULES,
} from "../lib/verified/alienDashCore.v2";
import {
  applyCoreInput,
  stepCore,
  replayCore,
} from "../lib/verified/coreRuntime.v1";
import { generateScenario } from "../lib/server/scenarios";
import { chooseAlienAction } from "./alien-play-fixture";
import type { ReplayInput } from "../lib/verified/inputValidation";
import fixture from "./fixtures/alien-v2.json" with { type: "json" };
import { verifyCoreFixture } from "./core-test-utils";
const target = 1000000;
function run(seed: string) {
  const state = core.create(seed),
    inputs: ReplayInput[] = [];
  let landed = 0,
    enemyFired = 0,
    lifeCollected = 0;
  while (state.status === "running") {
    const action = chooseAlienAction(state);
    if (action && core.canApply(state, action)) {
      inputs.push({ seq: inputs.length, tick: state.tick, action });
      assert.equal(applyCoreInput(core, state, action, target), true);
    }
    stepCore(core, state, target);
    if (state.supportId !== null) landed++;
    enemyFired = state.actors.filter((a) => a.fired).length;
    lifeCollected = state.collectibles.filter((l) => l.collected).length;
  }
  assert.equal(
    state.status,
    "won",
    `seed=${seed} tick=${state.tick} passed=${state.passed} lives=${state.lives}`,
  );
  assert.equal(state.tick, 14400);
  assert.ok(landed > 0, "real downward platform support");
  assert.ok(enemyFired > 0, "attackers really shoot");
  assert.ok(lifeCollected > 0, "collectibles reachable");
  assert.deepEqual(
    replayCore(core, inputs, state.tick, seed, target).state,
    state,
  );
  return { state, inputs };
}
const seed = generateScenario(
    { game_id: "dino-dash", game_version: "2.0.0" },
    7,
  ).seed,
  first = run(seed);
assert.equal(seed, fixture.seed);
assert.deepEqual(first.inputs, fixture.inputs);
verifyCoreFixture(
  core,
  fixture.seed,
  fixture.inputs,
  fixture.finalTick,
  target,
  { score: fixture.score, status: "won", failure: null, hash: fixture.hash },
);
for (let i = 0; i < 24; i++)
  run(
    generateScenario({ game_id: "dino-dash", game_version: "2.0.0" }, i).seed,
  );
for (let i = 0; i < 128; i++) {
  const seed = generateScenario(
      { game_id: "dino-dash", game_version: "2.0.0" },
      i,
    ).seed,
    s = core.create(seed);
  for (let t = 0; t < 360; t++) stepCore(core, s, target);
  assert.equal(s.lives, 3, "first three seconds teach before contact");
  assert.equal(s.status, "running");
}
const idle = core.create("no-input");
while (idle.status === "running") stepCore(core, idle, target);
assert.equal(idle.failure, "HULL_EXHAUSTED");
assert.ok(idle.tick > 120 * 8, "no premature first-death gameover");
assert.equal(replayCore(core, [], idle.tick, "no-input", target).valid, true);
const jump = core.create("jump");
applyCoreInput(core, jump, "JUMP", target);
assert.equal(core.canApply(jump, "JUMP"), false);
for (let t = 0; t < 45; t++) stepCore(core, jump, target);
assert.ok(jump.feet < 420000);
assert.equal(core.canApply(jump, "JUMP"), false);
const duck = core.create("duck");
applyCoreInput(core, duck, "DUCK_DOWN", target);
assert.equal(core.canApply(duck, "DUCK_DOWN"), false);
assert.equal(applyCoreInput(core, duck, "DUCK_UP", target), true);
console.log(
  "Alien V2: 24 full two-minute replays, reachable platforms/lives, telegraphed attackers, 128 safe openings, shields, no air double jump, historical Dino V1 preserved",
);

const support = core.create("support");
support.actors = [
  {
    id: 0,
    kind: "platform",
    x: 90000,
    width: 148000,
    height: 44000,
    bottom: 508000,
    passed: false,
    collided: false,
    chargeTick: null,
    fired: false,
  },
];
support.feet = 463500;
support.vy = 1000;
support.grounded = false;
core.step(support);
assert.equal(support.feet, 464000);
assert.equal(support.supportId, 0);
assert.equal(support.grounded, true);
const side = core.create("side");
side.actors = [{ ...support.actors[0], collided: false, x: 90000 }];
core.step(side);
assert.equal(side.feet, 508000, "side collision never teleports onto the roof");
assert.equal(side.supportId, null);
assert.equal(side.lives, 2);
const shield = core.create("shield");
shield.actors = [
  { ...side.actors[0], collided: false, id: 1 },
  { ...side.actors[0], collided: false, id: 2 },
];
core.step(shield);
assert.equal(
  shield.lives,
  2,
  "one damage in the shield window, even with overlapping obstacles",
);

// A 67 ms delay between reading the scene and executing the control must not
// require frame-perfect inputs to survive the complete progression.
for (let i = 0; i < 64; i++) {
  const s = core.create(
    generateScenario({ game_id: "dino-dash", game_version: "2.0.0" }, i).seed,
  );
  let pending: { tick: number; action: string } | null = null;
  while (s.status === "running") {
    if (!pending) {
      const action = chooseAlienAction(s);
      if (action && core.canApply(s, action))
        pending = { tick: s.tick + 8, action };
    }
    if (pending && pending.tick <= s.tick) {
      if (core.canApply(s, pending.action))
        applyCoreInput(core, s, pending.action, target);
      pending = null;
    }
    stepCore(core, s, target);
  }
  assert.equal(s.status, "won", `67 ms delayed controls scenario ${i}`);
  assert.equal(s.tick, 14400);
}
console.log("Alien V2: 64 complete progressions with 67 ms delayed controls");
