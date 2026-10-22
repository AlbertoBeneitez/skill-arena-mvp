import assert from "node:assert/strict";
import {
  TOWER_DROP_CORE_V3,
  createTowerDropV3,
} from "../lib/verified/towerDropCore.v3";
import {
  TOWER_DROP_CORE_V4,
  createTowerDropV4,
} from "../lib/verified/towerDropCore.v4";
import { applyCoreInput, stepCore } from "../lib/verified/coreRuntime.v1";

const seed = "tower-v4-descent",
  v3 = createTowerDropV3(seed),
  v4 = createTowerDropV4(seed);
assert.ok(applyCoreInput(TOWER_DROP_CORE_V3, v3, "DROP", 1e9));
assert.ok(applyCoreInput(TOWER_DROP_CORE_V4, v4, "DROP", 1e9));
assert.equal(v4.releaseHookXMilli, v4.fallXMilli + v4.movingWMilli / 2);

let v3Ticks = 0,
  v4Ticks = 0;
while (v3.status === "running" && v3.phase !== "swing" && v3Ticks++ < 2000)
  stepCore(TOWER_DROP_CORE_V3, v3, 1e9);
while (v4.status === "running" && v4.phase !== "swing" && v4Ticks++ < 4000) {
  stepCore(TOWER_DROP_CORE_V4, v4, 1e9);
  assert.ok(v4.hookOpenMilli >= 0 && v4.hookOpenMilli <= 1000);
}
assert.ok(v4Ticks >= v3Ticks * 1.8, `${v3Ticks} -> ${v4Ticks}`);
assert.equal(v4.score, v3.score);
assert.deepEqual(v4.blocks, v3.blocks);
assert.equal(v4.phase, v3.phase);
console.log(
  `Tower V4 articulated hook state and progressive descent OK · ${v3Ticks}->${v4Ticks} ticks`,
);
