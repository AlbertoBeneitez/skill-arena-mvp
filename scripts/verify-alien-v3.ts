import assert from "node:assert/strict";
import { ALIEN_DASH_CORE_V3 as core } from "../lib/verified/alienDashCore.v3";
import { ALIEN_DASH_CORE as previousCore } from "../lib/verified/alienDashCore.v2";
import { generateScenario } from "../lib/server/scenarios";
import {
  applyCoreInput,
  stepCore,
  replayCore,
} from "../lib/verified/coreRuntime.v1";
import type { ReplayInput } from "../lib/verified/inputValidation";
import { chooseAlienActionV3 } from "./alien-v3-play-fixture";
import { canonicalJson } from "../lib/verified/canonical";
import fixture from "./fixtures/alien-v3.json" with { type: "json" };
import { verifyCoreFixture } from "./core-test-utils";
const target = 1e9;
function run(index: number, delay = 0) {
  const seed = generateScenario(
      { game_id: "dino-dash", game_version: "3.0.0" },
      index,
    ).seed,
    state = core.create(seed),
    inputs: ReplayInput[] = [];
  let pending: { tick: number; action: string } | null = null,
    supportTicks = 0,
    roofDuckTicks = 0,
    chainJumps = 0,
    damage = 0;
  while (state.status === "running") {
    if (!pending) {
      const action = chooseAlienActionV3(state);
      if (action && core.canApply(state, action))
        pending = { tick: state.tick + delay, action };
    }
    if (pending && pending.tick <= state.tick) {
      if (core.canApply(state, pending.action)) {
        if (pending.action === "JUMP" && state.supportId !== null) {
          const support = state.actors.find((a) => a.id === state.supportId)!;
          if (
            state.actors.some(
              (a) =>
                a.kind === "platform" &&
                a.x >= support.x + support.width &&
                a.x - support.x - support.width <= 140000,
            )
          )
            chainJumps++;
        }
        assert.ok(applyCoreInput(core, state, pending.action, target));
        inputs.push({
          seq: inputs.length,
          tick: state.tick,
          action: pending.action,
        });
      }
      pending = null;
    }
    const lives = state.lives,
      height = state.height;
    stepCore(core, state, target);
    if (state.lives < lives) damage++;
    assert.ok(
      state.height >= height,
      "Physical reach cannot decrease after contact",
    );
    assert.equal(state.height, state.passed);
    if (state.supportId !== null) {
      supportTicks++;
      if (
        state.ducking &&
        state.actors.some(
          (a) =>
            a.kind === "drone" &&
            a.bottom === 430000 &&
            a.x - state.scroll < 108000 &&
            a.x - state.scroll + a.width > 78000,
        )
      )
        roofDuckTicks++;
    }
  }
  assert.equal(
    state.status,
    "won",
    `scenario=${index} delay=${delay} tick=${state.tick} passed=${state.passed}`,
  );
  assert.equal(state.tick, 14400);
  assert.ok(
    supportTicks > 14400 * 0.1,
    "Platforms must be part of the played course",
  );
  assert.ok(roofDuckTicks > 0, "The low roof is traversed by grounded ducking");
  assert.ok(
    chainJumps > 0,
    "Supported jumping is used across a real platform gap",
  );
  assert.ok(
    state.actors.some((a) => a.fired),
    "Attackers fire through the inherited kernel",
  );
  assert.ok(
    state.collectibles.some((l) => l.collected),
    "Recoveries are reachable",
  );
  assert.deepEqual(
    replayCore(core, inputs, state.tick, seed, target).state,
    state,
  );
  return {
    seed,
    state,
    inputs,
    damage,
    supportTicks,
    roofDuckTicks,
    chainJumps,
  };
}
const first = run(7);
assert.equal(first.seed, fixture.seed);
assert.deepEqual(first.inputs, fixture.inputs);
assert.equal(fixture.score, 26400);
assert.equal(fixture.height, 56);
assert.equal(
  fixture.hash,
  "sha256:8edb707e573a53e379530e87eac5744c3facace29e6d4ebd73915e80c073f736",
);
verifyCoreFixture(
  core,
  fixture.seed,
  fixture.inputs,
  fixture.finalTick,
  target,
  { score: fixture.score, status: "won", failure: null, hash: fixture.hash },
);
const rows = [];
for (let i = 0; i < 32; i++) {
  const immediate = run(i),
    delayed = run(i, 8);
  assert.equal(
    immediate.damage,
    0,
    `scenario ${i} must not need damage immunity to cross a phrase`,
  );
  rows.push({
    index: i,
    reach: immediate.state.height,
    supportPct: Math.round(immediate.supportTicks / 144),
    delayedDamage: delayed.damage,
  });
}
const fingerprints = new Set<string>();
for (let i = 0; i < 1000; i++) {
  const seed = generateScenario(
      { game_id: "dino-dash", game_version: "3.0.0" },
      i,
    ).seed,
    state = core.create(seed);
  assert.ok(state.actors.length <= 128);
  assert.ok(
    state.actors.at(-1)!.x > 24000280,
    "The course cannot empty before the deterministic terminal",
  );
  // Restrict the fingerprint to the playable course; no IDs, seed or decoration.
  const reachable = 24000280 + 108000;
  const shape = {
    actors: state.actors
      .filter((a) => a.x < reachable)
      .map((a) => ({
        kind: a.kind,
        x: a.x,
        width: a.width,
        height: a.height,
        bottom: a.bottom,
      })),
    collectibles: state.collectibles
      .filter((l) => l.x < reachable)
      .map((l) => ({ x: l.x, y: l.y })),
  };
  fingerprints.add(canonicalJson(shape));
  if (i < 128) {
    for (let t = 0; t < 360; t++) stepCore(core, state, target);
    assert.equal(state.lives, 3);
    assert.equal(state.status, "running");
  }
}
assert.equal(
  fingerprints.size,
  1000,
  "1000 distinct playable geometries, not distinct metadata",
);
// New generation must not silently substitute old physics, input or scoring.
const current = core.create(first.seed),
  previous = previousCore.create(first.seed);
previous.actors = structuredClone(current.actors);
previous.collectibles = structuredClone(current.collectibles);
let input = 0;
while (current.status === "running") {
  if (
    input < fixture.inputs.length &&
    fixture.inputs[input].tick === current.tick
  ) {
    const action = fixture.inputs[input++].action;
    assert.equal(
      applyCoreInput(core, current, action, target),
      applyCoreInput(previousCore, previous, action, target),
    );
  }
  stepCore(core, current, target);
  stepCore(previousCore, previous, target);
  const { height, ...physical } = current;
  assert.deepEqual(
    physical,
    previous,
    "V2 mechanics must remain identical on V3 geometry",
  );
}
const idle = core.create("no-input-alien3");
while (idle.status === "running") stepCore(core, idle, target);
assert.equal(idle.failure, "HULL_EXHAUSTED");
assert.ok(idle.tick > 120 * 8);
assert.equal(
  replayCore(core, [], idle.tick, "no-input-alien3", target).valid,
  true,
);
assert.equal(
  replayCore(
    core,
    [{ seq: 0, tick: 0, action: "DUCK_UP" }],
    idle.tick,
    "no-input-alien3",
    target,
  ).error,
  "ACTION_NOT_AVAILABLE",
);
console.log(
  JSON.stringify({
    courses: 32,
    delayedCourses: 32,
    safeOpenings: 128,
    uniqueGeometries: fingerprints.size,
    rows,
    golden: {
      score: fixture.score,
      height: fixture.height,
      finalTick: fixture.finalTick,
      hash: fixture.hash,
    },
  }),
);
