import assert from "node:assert/strict";
import {
  BIRDS_CORE_V6 as core,
  enforceMinimumSupport,
} from "../lib/verified/galacticBirdsCore.v6";
import {
  applyCoreInput,
  replayCore,
  stepCore,
} from "../lib/verified/coreRuntime.v1";
import type { ReplayInput } from "../lib/verified/inputValidation";

const selectable = core.create("birds6-selection");
assert.deepEqual(selectable.remaining, { scout: 10, dart: 10, meteor: 10 });
assert.ok(applyCoreInput(core, selectable, "SELECT_METEOR", 1e9));
stepCore(core, selectable, 1e9);
assert.ok(applyCoreInput(core, selectable, "SHOOT", 1e9));
assert.equal(selectable.bird?.kind, "meteor");
assert.equal(selectable.remaining.meteor, 9);
assert.equal(core.canApply(selectable, "SELECT_DART"), false);

const unstable = core.create("birds6-support");
unstable.bodies = [
  {
    id: 0,
    x: 100_000,
    y: 540_000,
    w: 20_000,
    h: 40_000,
    vx: 0,
    vy: 0,
    hp: 100,
    maxHp: 100,
    material: "alloy",
    alive: true,
  },
  {
    id: 1,
    x: 60_000,
    y: 510_000,
    w: 100_000,
    h: 20_000,
    vx: 0,
    vy: 0,
    hp: 100,
    maxHp: 100,
    material: "alloy",
    alive: true,
  },
];
const beforeX = unstable.bodies[1].x;
enforceMinimumSupport(unstable);
assert.ok(unstable.bodies[1].x < beforeX);
assert.ok(unstable.bodies[1].vy > 0);
assert.equal(unstable.unstableContacts, 1);

for (let index = 0; index < 32; index++) {
  const state = core.create(`birds6-stable-${index}`);
  for (let tick = 0; tick < 960; tick++) stepCore(core, state, 1e9);
  assert.equal(state.kills, 0, `spontaneous target loss at seed ${index}`);
  assert.ok(
    state.bodies.every((body) => body.alive),
    `spontaneous structural loss at seed ${index}`,
  );
}

const timeoutInputs: ReplayInput[] = [
  { seq: 0, tick: 0, action: "SELECT_DART" },
];
const timeoutA = replayCore(core, timeoutInputs, 28_800, "birds6-timeout", 1e9);
const timeoutB = replayCore(core, timeoutInputs, 28_800, "birds6-timeout", 1e9);
assert.equal(timeoutA.valid, true);
assert.equal(timeoutA.failure, "TIME_LIMIT");
assert.deepEqual(timeoutA.state, timeoutB.state);
console.log(
  "Birds V6 selectable archetypes, bounded inventories, minimum support and deterministic timeout replay OK",
);
