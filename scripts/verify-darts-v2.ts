import assert from "node:assert/strict";
import { DARTS_CORE_V2 as core } from "../lib/verified/dartsCore.v2";
import { DARTS_CORE } from "../lib/verified/dartsCore.v1";
import { isDartsThrowGesture as gesture } from "../lib/verified/dartsGesture.v2";
import { verifyCoreFixture } from "./core-test-utils";
import fixture from "./fixtures/darts-v1.json" with { type: "json" };
verifyCoreFixture(
  core,
  fixture.seed,
  fixture.inputs,
  fixture.finalTick,
  1000000,
  { score: fixture.score, hash: fixture.hash, status: "won", failure: null },
);
assert.equal(DARTS_CORE.gameVersion, "1.0.0");
assert.equal(core.gameVersion, "2.0.0");
assert.equal(gesture({ x: 195, y: 560 }, { x: 210, y: 290 }), true);
assert.equal(gesture({ x: 195, y: 560 }, { x: 195, y: 513 }), false);
assert.equal(gesture({ x: 195, y: 420 }, { x: 195, y: 372 }), true);
assert.equal(gesture({ x: 195, y: 419 }, { x: 195, y: 300 }), false);
assert.equal(gesture({ x: 100, y: 560 }, { x: 350, y: 500 }), false);
assert.equal(gesture({ x: 195, y: 450 }, { x: 195, y: 560 }), false);
assert.equal(gesture({ x: 195, y: 560 }, { x: 195, y: 560 }), false);
console.log(
  "Darts V2: upward swipe boundaries and immutable V1 simulation, replay/render/invalid inputs/golden passed",
);
