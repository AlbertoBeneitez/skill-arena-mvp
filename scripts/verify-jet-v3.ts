import assert from "node:assert/strict";
import { JET_STREAM_CORE_V3 as core } from "../lib/verified/jetStreamCore.v3";
import { JET_STREAM_V1 } from "../lib/verified/jetStreamCore.v1";
import { shouldFlapJet } from "./jet-v3-play-fixture";
import { generateScenario } from "../lib/server/scenarios";
import {
  applyCoreInput,
  stepCore,
  replayCore,
} from "../lib/verified/coreRuntime.v1";
import { verifyCoreFixture } from "./core-test-utils";
import type { ReplayInput } from "../lib/verified/inputValidation";
import fixture from "./fixtures/jet-v3.json" with { type: "json" };
verifyCoreFixture(core, fixture.seed, fixture.inputs, fixture.finalTick, 1e6, {
  score: fixture.score,
  status: "won",
  failure: null,
  hash: fixture.hash,
});
for (let i = 0; i < 32; i++) {
  const s = core.create(
      generateScenario({ game_id: "jet-stream", game_version: "3.0.0" }, i)
        .seed,
    ),
    inputs: ReplayInput[] = [];
  let narrow = false,
    dual = false;
  while (s.status === "running") {
    if (shouldFlapJet(s)) {
      inputs.push({ seq: inputs.length, tick: s.tick, action: "FLAP" });
      applyCoreInput(core, s, "FLAP", 1e6);
    }
    stepCore(core, s, 1e6);
    narrow ||= s.gates.some((g) => g.windows[0].gapMilli < 150000);
    dual ||= s.gates.some((g) => g.windows.length === 2);
  }
  assert.equal(s.status, "won");
  assert.equal(s.tick, 21600);
  assert.ok(s.passed > 200);
  assert.ok(s.collected > 10);
  assert.ok(dual && narrow);
  assert.deepEqual(replayCore(core, inputs, s.tick, s.seed, 1e6).state, s);
}
for (let i = 0; i < 128; i++) {
  const s = core.create(
    generateScenario({ game_id: "jet-stream", game_version: "3.0.0" }, i).seed,
  );
  const windows = JSON.stringify(s.gates.map((g) => g.windows));
  for (let t = 0; t < 480; t++) stepCore(core, s, 1e6);
  assert.equal(s.status, "running");
  assert.equal(s.lives, 3);
  assert.equal(s.yMilli, 305000);
  assert.equal(s.scrollMilli, 0);
  assert.equal(s.score, 0);
  assert.equal(JSON.stringify(s.gates.map((g) => g.windows)), windows);
  assert.equal(applyCoreInput(core, s, "FLAP", 1e6), true);
  assert.equal(s.launchedAtTick, 480);
  assert.equal(applyCoreInput(core, s, "FLAP", 1e6), false);
  assert.equal(core.canApply(s, "FORBIDDEN"), false);
  const first = s.gates[0];
  assert.equal(first.windows[0].gapMilli, 250000);
  assert.equal(first.centerYMilli, 305000);
}
const idle = core.create("idle");
while (idle.status === "running") stepCore(core, idle, 1e6);
assert.equal(idle.lives, 0);
assert.equal(idle.failure, "OUT_OF_BOUNDS");
assert.ok(idle.tick > 120 * 6);
assert.equal(replayCore(core, [], idle.tick, "idle", 1e6).valid, true);
const double = core.create(fixture.seed);
while (!double.gates.some((g) => g.windows.length === 2)) {
  if (shouldFlapJet(double)) applyCoreInput(core, double, "FLAP", 1e6);
  stepCore(core, double, 1e6);
}
const d = double.gates.find((g) => g.windows.length === 2)!;
for (const w of d.windows) {
  const s = structuredClone(double);
  s.launchedAtTick = 0;
  s.scrollMilli = d.worldXMilli - JET_STREAM_V1.playerX;
  s.yMilli = w.centerYMilli;
  stepCore(core, s, 1e6);
  assert.equal(s.lives, 3, "both windows safe");
}
console.log(
  "Jet V3: 32 three-minute replays, 128 safe four-second launches, wide teaching gates, gradual flight, narrow/dual progression, pickups, cooldown and historical V1/V2 preserved",
);
