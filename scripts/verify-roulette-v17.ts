import assert from "node:assert/strict";
import { ROULETTE_CORE_V17 as core, ROULETTE_RULES_V17 as R, ROULETTE_THROWS_V16, rouletteSurfaceV17, rouletteAimReachesV17 } from "../lib/verified/galacticRouletteCore.v17";
import { ROULETTE_CORE_V16 } from "../lib/verified/galacticRouletteCore.v16";
import { applyCoreInput, stepCore } from "../lib/verified/coreRuntime.v1";
import { verifyCoreFixture } from "./core-test-utils";
import fixture from "./fixtures/roulette-v17.json" with { type: "json" };

assert.equal(core.gameVersion, "17.0.0");
assert.equal(ROULETTE_CORE_V16.gameVersion, "16.0.0", "V16 stays published");
verifyCoreFixture(core, fixture.seed, fixture.inputs, fixture.finalTick, 1e9, { score: fixture.score, status: fixture.status as "won", failure: fixture.failure, hash: fixture.hash });
const toss = (d: number, p: number) => `TOSS_D${String(d).padStart(2, "0")}_P${String(p).padStart(2, "0")}`;
const MM = 1e6;
for (let d = 0; d < 32; d++) assert.equal(rouletteAimReachesV17(d), ROULETTE_THROWS_V16[d] !== undefined);

// The bowl's height is the integral of the core's slopes: 0 at the pocket floor's edge, rising to the track.
assert.equal(rouletteSurfaceV17(R.floorOut), 0);
assert.ok(rouletteSurfaceV17(R.wallR) > rouletteSurfaceV17(R.trackInner) && rouletteSurfaceV17(R.trackInner) > rouletteSurfaceV17(R.rotorEdge) && rouletteSurfaceV17(R.rotorEdge) > rouletteSurfaceV17(R.lipTop));
assert.ok(rouletteSurfaceV17(R.floorIn - 5 * MM) > 0, "the cone rises inwards");
assert.ok(Math.abs(rouletteSurfaceV17(93 * MM) + 1 * MM) < 0.01 * MM, "dished pocket floor, 1 mm deep");

const durations: number[] = [];
for (let d = 16; d <= 24; d++) for (const p of [0, 4, 8, 12, 15]) {
  const s = core.create(`v17-${d}-${p}`); applyCoreInput(core, s, "BET_RED", 1e9); stepCore(core, s, 1e9);
  applyCoreInput(core, s, toss(d, p), 1e9);
  const t0 = s.tick;
  // The flight is a ballistic arc that clears the rim: always above the rim's height until it is over the wall.
  let minZ = Infinity;
  while (s.ballPhase === 0) { stepCore(core, s, 1e9); if (s.ballPhase === 0) minZ = Math.min(minZ, s.ballZ); }
  if (minZ !== Infinity) assert.ok(minZ > R.rimHeight, `clears the rim (D${d} P${p})`);
  // It comes over the rim in the air, and lands (the core's own bounce) within half a second.
  assert.ok(s.ballZ > R.rimHeight, "still in the air over the wall");
  let landed = -1;
  for (let k = 0; k < 60 && landed < 0; k++) { stepCore(core, s, 1e9); if (s.ballZ === 0) landed = k; }
  assert.ok(landed > 0, "drops onto the track");
  // Ridden along the track in one sense: a diamond never sends it back.
  let run = s.ballVt, reversed = false;
  while (s.landingTick !== -1) {
    stepCore(core, s, 1e9);
    if (s.ballR > R.rotorEdge && Math.abs(run) > 300_000 && Math.sign(s.ballVt) !== Math.sign(run)) reversed = true;
    // On the rotor the counter-turning wheel may carry the ball the other way (real); start over when it climbs out.
    run = s.ballR > R.rotorEdge ? s.ballVt : 0;
  }
  assert.ok(!reversed, `no reversal on the track (D${d} P${p})`);
  durations.push((s.tick - t0) / 120);
}
// Realistic spins: weak clumsy throws drop in quickly, the rest ride the track for many turns.
const mean = durations.reduce((a, b) => a + b, 0) / durations.length;
assert.ok(mean > 9 && Math.max(...durations) < 25 && Math.min(...durations) > 2, `spin lengths ${mean.toFixed(1)} s`);
assert.ok(durations.filter((t) => t >= 8).length >= durations.length * 0.75, "most throws ride the track");
// Determinism.
const once = () => { const s = core.create("twice"); applyCoreInput(core, s, "BET_RED", 1e9); applyCoreInput(core, s, toss(20, 9), 1e9); while (s.landingTick !== -1) stepCore(core, s, 1e9); return JSON.stringify(s); };
assert.equal(once(), once());
console.log(`Roulette V17 OK · ballistic arc over the rim · drop into the groove · run along the track · airborne height over the real bowl · no diamond reversal · spins ${mean.toFixed(1)} s on average`);
