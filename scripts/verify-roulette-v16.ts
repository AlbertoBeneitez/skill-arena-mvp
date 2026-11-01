import assert from "node:assert/strict";
import { ROULETTE_CORE_V16 as core, ROULETTE_RULES_V16 as R, ROULETTE_THROWS_V16, ROULETTE_WHEEL, roulettePocketAt, rouletteAimReachesV16 } from "../lib/verified/galacticRouletteCore.v16";
import { ROULETTE_CORE_V15 } from "../lib/verified/galacticRouletteCore.v15";
import { sinPhaseMilli } from "../lib/deterministic/integerMath";
import { applyCoreInput, stepCore } from "../lib/verified/coreRuntime.v1";
import { verifyCoreFixture } from "./core-test-utils";
import fixture from "./fixtures/roulette-v16.json" with { type: "json" };

assert.equal(core.gameVersion, "16.0.0");
verifyCoreFixture(core, fixture.seed, fixture.inputs, fixture.finalTick, 1e9, { score: fixture.score, status: fixture.status as "won", failure: fixture.failure, hash: fixture.hash });
const toss = (d: number, p: number) => `TOSS_D${String(d).padStart(2, "0")}_P${String(p).padStart(2, "0")}`;

// Only aims that reach the wheel are throws; the table is the launcher geometry (ray from the launcher to the wall).
const reach: number[] = [];
for (let d = 0; d < 32; d++) {
  const s = core.create("aim"); applyCoreInput(core, s, "BET_RED", 1e9);
  assert.equal(core.canApply(s, toss(d, 5)), rouletteAimReachesV16(d));
  if (!rouletteAimReachesV16(d)) continue;
  reach.push(d);
  const cx = sinPhaseMilli(d * 128 + 1024) / 1000, cy = sinPhaseMilli(d * 128) / 1000, n = Math.hypot(cx, cy);
  const [dist, theta, , , ux, uy] = ROULETTE_THROWS_V16[d];
  const x = R.releaseX - R.centerX + (ux / 1e6) * dist, y = R.releaseY - R.centerY + (uy / 1e6) * dist;
  assert.ok(Math.abs(Math.hypot(x, y) - R.wallR / 1000) < 2, `entry on the wall (D${d})`);
  assert.ok(Math.abs(ux / 1e6 - cx / n) < 2e-6 && Math.abs(uy / 1e6 - cy / n) < 2e-6, `aim of D${d}`);
  assert.ok(Math.abs(((Math.atan2(x, -y) + 2 * Math.PI) % (2 * Math.PI)) - theta / 1e7) < 1e-5, `entry angle of D${d}`);
}
assert.deepEqual(reach, [16, 17, 18, 19, 20, 21, 22, 23, 24]);

// The flight is a straight line from the launcher at the throw's speed, and the ball enters with exactly that
// velocity: no speed floor and no forced circle.
for (const [d, p] of [[16, 0], [20, 7], [24, 15]]) {
  const s = core.create(`flight-${d}-${p}`); applyCoreInput(core, s, "BET_RED", 1e9); stepCore(core, s, 1e9);
  applyCoreInput(core, s, toss(d, p), 1e9);
  const pts: [number, number][] = [];
  while (s.ballPhase === 0) { stepCore(core, s, 1e9); if (s.ballPhase === 0) pts.push([s.ballX, s.ballY]); }
  const [, , radial, tangent, ux, uy] = ROULETTE_THROWS_V16[d];
  for (const [x, y] of pts) assert.ok(Math.abs((x - R.releaseX) * uy - (y - R.releaseY) * ux) / 1e6 < 2, "straight flight along the aim");
  // Entry split: radial and tangential parts of the same unit aim, so the ball enters at the throw's full speed.
  assert.ok(Math.abs(Math.hypot(radial, tangent) - 1e6) < 5, "entry speed is the throw's speed");
  assert.ok(pts.length >= 1 && Math.hypot(pts[0][0] - R.releaseX, pts[0][1] - R.releaseY) > 0, "it flies");
}

// Every throw settles by itself in a pocket; the number is the pocket under the ball; aim and power matter.
const counts = new Array(37).fill(0);
let rides = 0, drops = 0;
for (const d of reach) for (let p = 0; p < 16; p += 3) for (let k = 0; k < 6; k++) {
  const s = core.create(`all-${d}-${p}-${k}`); applyCoreInput(core, s, "BET_RED", 1e9); stepCore(core, s, 1e9);
  assert.ok(applyCoreInput(core, s, toss(d, p), 1e9));
  const t0 = s.tick; let onWall = 0, maxR = 0;
  while (s.landingTick !== -1) { stepCore(core, s, 1e9); if (s.ballPhase === 1) { maxR = Math.max(maxR, s.ballR); if (s.ballR === R.wallR) onWall++; } }
  assert.ok(maxR <= R.wallR, "never leaves the wheel");
  assert.ok(s.lastLandingTick - t0 < R.maximumFlightTicks - 240, "rests by itself");
  assert.ok(s.ballR >= R.floorIn - 1e6 && s.ballR <= R.floorOut + 1e6, "on a pocket floor");
  assert.equal(s.lastNumber, ROULETTE_WHEEL[roulettePocketAt(s.restOffset)]);
  counts[s.lastNumber!]++;
  if (onWall > 5 * 120) rides++; else drops++;
}
assert.ok(rides >= 30 && drops >= 120, `some throws ride the wall, many drop in (${rides}/${drops})`);
assert.equal(counts.filter((c) => c > 0).length, 37, "every number can come up");
// Strong throws along the track ride the wall; the gentle ones at the same aim fall in.
const wallTime = (d: number, p: number) => {
  const s = core.create(`ride-${d}-${p}`); applyCoreInput(core, s, "BET_RED", 1e9); stepCore(core, s, 1e9); applyCoreInput(core, s, toss(d, p), 1e9);
  let w = 0; while (s.landingTick !== -1) { stepCore(core, s, 1e9); if (s.ballPhase === 1 && s.ballR === R.wallR) w++; } return w;
};
assert.ok(wallTime(16, 15) > 6 * 120 && wallTime(16, 0) < 120, "power along the track keeps the ball on the wall");
// V15 is untouched by V16.
assert.equal(ROULETTE_CORE_V15.gameVersion, "15.0.0");
console.log(`Roulette V16 OK · straight throw from the launcher · 9 aims reach the wheel · entry at the throw's velocity · rides ${rides} / drops ${drops} · 37/37`);
