import assert from "node:assert/strict";
import {
  JET_STREAM_CORE_V4 as core,
  JET_STREAM_V4,
  jetV4ShiftLimits,
  type JetStreamV4State,
} from "../lib/verified/jetStreamCore.v4";
import { createJetStreamV3 } from "../lib/verified/jetStreamCore.v3";
import { JET_STREAM_V1 } from "../lib/verified/jetStreamCore.v1";
import type { JetGateV2 } from "../lib/verified/jetStreamCore.v2";
import { generateScenario } from "../lib/server/scenarios";
import {
  applyCoreInput,
  replayCore,
  stepCore,
} from "../lib/verified/coreRuntime.v1";
import type { ReplayInput } from "../lib/verified/inputValidation";
import { verifyCoreFixture } from "./core-test-utils";
import { shouldFlapJetV4 } from "./jet-v4-play-fixture";
import fixture from "./fixtures/jet-v4.json" with { type: "json" };

verifyCoreFixture(core, fixture.seed, fixture.inputs, fixture.finalTick, 1e6, {
  score: fixture.score,
  status: "won",
  failure: null,
  hash: fixture.hash,
});

function immutableGeometry(gate: JetGateV2) {
  return JSON.stringify({
    index: gate.index,
    worldXMilli: gate.worldXMilli,
    centerYMilli: gate.centerYMilli,
    windows: gate.windows,
    pickup: gate.pickup,
  });
}

function checkWindows(gate: JetGateV2, previous: number | undefined) {
  assert.ok(gate.centerYMilli >= JET_STREAM_V4.minimumCenter);
  assert.ok(gate.centerYMilli <= JET_STREAM_V4.maximumCenter);
  if (gate.index < 2) assert.equal(gate.centerYMilli, 305000);
  else {
    assert.notEqual(previous, undefined);
    const delta = Math.abs(gate.centerYMilli - previous!),
      limits = jetV4ShiftLimits(gate.index);
    assert.ok(
      delta >= limits.minimum && delta <= limits.maximum,
      `gate ${gate.index} shift ${delta} is bounded and visibly varied`,
    );
  }
  for (const window of gate.windows) {
    assert.ok(window.centerYMilli - Math.floor(window.gapMilli / 2) >= 0);
    assert.ok(window.centerYMilli + Math.floor(window.gapMilli / 2) <= 620000);
  }
  for (let i = 1; i < gate.windows.length; i++)
    assert.ok(
      gate.windows[i].centerYMilli - Math.floor(gate.windows[i].gapMilli / 2) >
        gate.windows[i - 1].centerYMilli +
          Math.floor(gate.windows[i - 1].gapMilli / 2),
      "dual windows remain distinct and never overlap",
    );
  assert.equal(
    gate.windows.some((window) => window.centerYMilli === gate.centerYMilli),
    true,
  );
  if (gate.windows.length === 2)
    assert.equal(
      Math.abs(gate.windows[0].centerYMilli - gate.windows[1].centerYMilli),
      190000,
    );
}

const fingerprints = new Set<string>();
for (let i = 0; i < 1000; i++) {
  const seed = generateScenario(
      { game_id: core.gameId, game_version: core.gameVersion },
      i,
    ).seed,
    state = core.create(seed),
    baseline = createJetStreamV3(seed);
  fingerprints.add(
    JSON.stringify(state.gates.map((g) => JSON.parse(immutableGeometry(g)))),
  );
  assert.deepEqual(
    core.create(seed),
    state,
    "both competitors receive the same course",
  );
  let previous: number | undefined;
  for (let g = 0; g < state.gates.length; g++) {
    const gate = state.gates[g],
      old = baseline.gates[g];
    checkWindows(gate, previous);
    previous = gate.centerYMilli;
    assert.equal(gate.worldXMilli, old.worldXMilli);
    assert.equal(gate.pickup, old.pickup);
    assert.equal(gate.windows.length, old.windows.length);
    assert.deepEqual(
      gate.windows.map((w) => w.gapMilli).sort(),
      old.windows.map((w) => w.gapMilli).sort(),
    );
    if (gate.index < 2) assert.equal(gate.windows[0].gapMilli, 250000);
  }
}
assert.equal(
  fingerprints.size,
  1000,
  "natural geometry fingerprints exclude scenario/seed identifiers",
);

for (let i = 0; i < 32; i++) {
  const seed = generateScenario(
      { game_id: core.gameId, game_version: core.gameVersion },
      i,
    ).seed,
    state = core.create(seed),
    inputs: ReplayInput[] = [],
    seen = new Map<number, { center: number; geometry: string }>();
  let dual = false,
    narrow = false;
  const inspect = (s: JetStreamV4State) => {
    for (const gate of s.gates) {
      const existing = seen.get(gate.index);
      if (existing)
        assert.equal(
          immutableGeometry(gate),
          existing.geometry,
          "existing gates and pickup coordinates never move",
        );
      else {
        const previous = seen.get(gate.index - 1)?.center;
        checkWindows(gate, previous);
        if (state.tick > 0)
          assert.ok(
            gate.worldXMilli - s.scrollMilli > 390000,
            "new geometry is prepared outside the visible arena",
          );
        seen.set(gate.index, {
          center: gate.centerYMilli,
          geometry: immutableGeometry(gate),
        });
      }
      dual ||= gate.windows.length === 2;
      narrow ||= gate.windows.some((w) => w.gapMilli < 150000);
    }
  };
  inspect(state);
  while (state.status === "running") {
    if (shouldFlapJetV4(state)) {
      inputs.push({ seq: inputs.length, tick: state.tick, action: "FLAP" });
      assert.equal(applyCoreInput(core, state, "FLAP", 1e6), true);
    }
    stepCore(core, state, 1e6);
    inspect(state);
    assert.equal(
      state.height,
      state.passed,
      "reach comes from deterministic gate passage",
    );
  }
  console.log(
    `Jet V4 course ${i}: ${state.status}, ${state.tick} ticks, ${state.passed} gates, ${state.lives} shields, ${state.collected} pickups`,
  );
  assert.equal(state.status, "won", `full 180-second course ${i}`);
  assert.equal(state.tick, 21600);
  assert.ok(state.passed > 200);
  assert.ok(state.collected > 10);
  assert.ok(dual && narrow);
  assert.deepEqual(
    replayCore(core, inputs, state.tick, seed, 1e6).state,
    state,
  );
}

for (let i = 0; i < 128; i++) {
  const state = core.create(`jet4-launch-${i}`),
    geometry = state.gates.map(immutableGeometry);
  for (let tick = 0; tick < 480; tick++) stepCore(core, state, 1e6);
  assert.equal(state.status, "running");
  assert.equal(state.lives, 3);
  assert.equal(state.yMilli, 305000);
  assert.equal(state.scrollMilli, 0);
  assert.equal(state.score, 0);
  assert.equal(state.height, 0);
  assert.deepEqual(state.gates.map(immutableGeometry), geometry);
  assert.equal(applyCoreInput(core, state, "FLAP", 1e6), true);
  assert.equal(state.launchedAtTick, 480);
  assert.equal(applyCoreInput(core, state, "FLAP", 1e6), false);
  assert.equal(core.canApply(state, "FORBIDDEN"), false);
}
const idleSeed = "jet4-idle",
  idle = core.create(idleSeed);
while (idle.status === "running") stepCore(core, idle, 1e6);
assert.equal(idle.lives, 0);
assert.equal(idle.failure, "OUT_OF_BOUNDS");
assert.ok(idle.tick > 120 * 6);
assert.equal(replayCore(core, [], idle.tick, idleSeed, 1e6).valid, true);

const double = core.create(fixture.seed);
while (!double.gates.some((g) => g.windows.length === 2)) {
  if (shouldFlapJetV4(double)) applyCoreInput(core, double, "FLAP", 1e6);
  stepCore(core, double, 1e6);
}
const dual = double.gates.find((g) => g.windows.length === 2)!;
for (const window of dual.windows) {
  const state = structuredClone(double);
  state.launchedAtTick = 0;
  state.scrollMilli = dual.worldXMilli - JET_STREAM_V1.playerX;
  state.yMilli = window.centerYMilli;
  stepCore(core, state, 1e6);
  assert.equal(state.lives, 3, "both reanchored dual windows are safe");
}
console.log(
  "Jet V4: 1000 natural course fingerprints, min/max reflected shifts, fixed windows/pickups, 32 full three-minute replays, novice launch, dual paths, goldens/render/input bounds; historical V1/V2/V3 preserved",
);
