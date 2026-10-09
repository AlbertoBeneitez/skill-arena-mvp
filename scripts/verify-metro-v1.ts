import assert from "node:assert/strict";
import {
  METRO_CORE as core,
  metroSpeed,
  METRO_LANES,
} from "../lib/verified/metroShiftCore.v1";
import {
  applyCoreInput,
  stepCore,
  replayCore,
} from "../lib/verified/coreRuntime.v1";
import { generateScenario } from "../lib/server/scenarios";
import { chooseMetroAction } from "./metro-play-fixture";
import type { ReplayInput } from "../lib/verified/inputValidation";
import { verifyCoreFixture } from "./core-test-utils";
import fixture from "./fixtures/metro-v1.json" with { type: "json" };
verifyCoreFixture(core, fixture.seed, fixture.inputs, fixture.finalTick, 1e6, {
  score: fixture.score,
  status: "won",
  failure: null,
  hash: fixture.hash,
});
for (let i = 0; i < 32; i++) {
  const s = core.create(
      generateScenario({ game_id: "metro-shift", game_version: "1.0.0" }, i)
        .seed,
    ),
    inputs: ReplayInput[] = [];
  while (s.status === "running") {
    const a = chooseMetroAction(s);
    if (a && core.canApply(s, a)) {
      inputs.push({ seq: inputs.length, tick: s.tick, action: a });
      applyCoreInput(core, s, a, 1e6);
    }
    stepCore(core, s, 1e6);
  }
  assert.equal(s.status, "won", `scenario${i} full course`);
  assert.equal(s.passed, 60);
  assert.equal(s.lives, 3);
  assert.ok(s.jumps > 0);
  assert.ok(s.groups.some((g) => g.collected));
  assert.deepEqual(replayCore(core, inputs, s.tick, s.seed, 1e6).state, s);
}
for (let i = 0; i < 128; i++) {
  const s = core.create(
    generateScenario({ game_id: "metro-shift", game_version: "1.0.0" }, i).seed,
  );
  for (let t = 0; t < 960; t++) stepCore(core, s, 1e6);
  assert.equal(s.lives, 3, "eight-second intro without input");
  assert.ok(
    s.groups.every(
      (g) =>
        new Set(g.hazards.map((h) => h.lane)).size === g.hazards.length &&
        g.hazards.length <= 4,
    ),
  );
  assert.ok(
    s.groups.every(
      (g) =>
        g.pickupLane === null ||
        !g.hazards.some((h) => h.lane === g.pickupLane),
    ),
  );
}
const jump = core.create("jump");
assert.equal(applyCoreInput(core, jump, "JUMP", 1e6), true);
assert.equal(applyCoreInput(core, jump, "JUMP", 1e6), false);
for (let t = 0; t < 20; t++) stepCore(core, jump, 1e6);
assert.ok(jump.jumpY < 0);
const lane = core.create("lane");
applyCoreInput(core, lane, "LEFT", 1e6);
assert.equal(applyCoreInput(core, lane, "LEFT", 1e6), false);
stepCore(core, lane, 1e6);
assert.ok(lane.x > METRO_LANES[2], "lane change is continuous, no teleport");
function atHazard(kind: "wall" | "barrier", air: number) {
  const s = core.create("hit");
  s.groups = [
    {
      index: 0,
      z: 0,
      hazards: [{ lane: 3, kind }],
      pickupLane: null,
      collected: false,
      passed: false,
      hit: false,
      jumped: false,
    },
  ];
  s.jumpY = air;
  s.jumpVy = 0;
  return s;
}
const wall = atHazard("wall", -60000);
stepCore(core, wall, 1e6);
assert.equal(wall.lives, 2, "walls cannot be jumped");
const barrier = atHazard("barrier", -60000);
stepCore(core, barrier, 1e6);
assert.equal(barrier.lives, 3);
assert.equal(barrier.groups[0].jumped, true);
const low = atHazard("barrier", -20000);
stepCore(core, low, 1e6);
assert.equal(low.lives, 2);
for (let t = 0; t < 10; t++) stepCore(core, low, 1e6);
assert.equal(low.lives, 2, "one group cannot drain multiple shields");
const idle = core.create("idle");
while (idle.status === "running") stepCore(core, idle, 1e6);
assert.equal(idle.status, "failed");
assert.equal(replayCore(core, [], idle.tick, "idle", 1e6).valid, true);
assert.equal(metroSpeed(core.create("speed")), 1700);
console.log(
  "Metro: 32 complete courses, 128 safe eight-second openings, route openings, continuous lane movement, jump/wall distinction, no air double jump, shield semantics, unique pickups, common replay",
);

// Regression: incoming hazards cannot stay fixed at the horizon. The old .08
// minimum projected 1090..1020 at one position/size despite advancing distance.
const { metroObstacleDepth } = await import("../components/games/metro-shift/presentation");
let previousDepth = metroObstacleDepth(1100);
assert.equal(previousDepth, 0);
for (let distance = 1090; distance >= -100; distance -= 10) {
  const depth = metroObstacleDepth(distance);
  assert.ok(depth > previousDepth, `approaching hazard must move at distance ${distance}`);
  previousDepth = depth;
}
assert.equal(metroObstacleDepth(0), 1, "collision line retains its projection");
assert.equal(metroObstacleDepth(1200), 0, "offscreen hazards stay beyond the horizon");
console.log("Metro presentation: continuous horizon approach and unchanged collision-line projection passed");
