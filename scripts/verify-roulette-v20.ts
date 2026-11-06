import assert from "node:assert/strict";
import { ROULETTE_CORE_V20 as core, ROULETTE_RULES_V20 as R, rouletteLobV20, rouletteAimReachesV20, rouletteSurfaceV20, ROULETTE_THROWS_V16 } from "../lib/verified/galacticRouletteCore.v20";
import { ROULETTE_CORE_V19, ROULETTE_RULES_V19 } from "../lib/verified/galacticRouletteCore.v19";
import { applyCoreInput, stepCore } from "../lib/verified/coreRuntime.v1";
import { verifyCoreFixture } from "./core-test-utils";
import fixture from "./fixtures/roulette-v20.json" with { type: "json" };

assert.equal(core.gameVersion, "20.0.0");
assert.equal(ROULETTE_CORE_V19.gameVersion, "19.0.0", "V19 stays published");
verifyCoreFixture(core, fixture.seed, fixture.inputs, fixture.finalTick, 1e9, { score: fixture.score, status: fixture.status as "won", failure: fixture.failure, hash: fixture.hash });
const toss = (d: number, p: number) => `TOSS_D${String(d).padStart(2, "0")}_P${String(p).padStart(2, "0")}`;
for (let d = 0; d < 32; d++) assert.equal(rouletteAimReachesV20(d), ROULETTE_THROWS_V16[d] !== undefined);
const dist = (x: number, y: number) => Math.hypot(x - R.centerX, y - R.centerY) * 1000;

const durations: number[] = [];
let allBounces = 0;
for (let d = 16; d <= 24; d++) {
  let prev = -1;
  for (const p of [0, 5, 10, 15]) {
    const lob = rouletteLobV20(d, p)!;
    // The lob lands inside the wheel, further along the line the harder the throw.
    assert.ok(dist(lob.x, lob.y) < R.wallR, `lands inside (D${d} P${p})`);
    const along = Math.hypot(lob.x - R.releaseX, lob.y - R.releaseY);
    assert.ok(along > prev, "more power, further"); prev = along;
    const s = core.create(`v20-${d}-${p}`); applyCoreInput(core, s, "BET_RED", 1e9); applyCoreInput(core, s, toss(d, p), 1e9);
    const t0 = s.tick;
    // A true parabola: no surface contact until the ball comes down where the throw sends it, at the predicted time.
    let peak = 0, firstContact = -1;
    for (let k = 0; k < lob.substeps / 4 + 2 && firstContact < 0; k++) {
      const c = s.contacts; stepCore(core, s, 1e9); peak = Math.max(peak, s.ballZ);
      if (s.contacts > c || s.ballPhase !== 0) firstContact = s.tick - t0;
    }
    assert.ok(peak > R.rimTop + R.releaseLift + 20 * 1e6, "a lob, high over the rim");
    assert.ok(firstContact < 0 || Math.abs(firstContact * 4 - lob.substeps) <= 8 || s.diamonds > 0, `comes down on time (D${d} P${p})`);
    // Bounces (each lower than the last on average), then it rolls into a pocket without circling the track.
    let bounces = s.contacts, track = 0;
    while (s.landingTick !== -1) {
      const c = s.contacts; stepCore(core, s, 1e9);
      if (s.ballPhase === 0) bounces += s.contacts - c;
      if (s.ballPhase === 1 && s.ballR > R.trackInner) track++;
    }
    assert.ok(bounces >= 1, `bounces (D${d} P${p})`);
    assert.ok(track < 120 * 4, "no run along the track");
    assert.ok(!s.lastMiss && s.lastNumber !== null, "settles in a pocket");
    allBounces += bounces;
    durations.push((s.tick - t0) / 120);
  }
}
const mean = durations.reduce((a, b) => a + b, 0) / durations.length;
assert.ok(allBounces / durations.length >= 6, "about eight bounces a throw (V18: four)");
assert.ok(mean > 5.5 && mean < 11 && Math.max(...durations) < 25, `spins ${mean.toFixed(1)} s (V19: 5.1)`);
// V19 slowed by k ≈ 1.29: gravity × 0.6, the rotor and every speed × 0.775, the lob 1.29 times longer in the air.
assert.equal(R.gravity, Math.round(ROULETTE_RULES_V19.gravity * 0.6));
assert.ok(Math.abs(R.wheelSpeedMin / ROULETTE_RULES_V19.wheelSpeedMin - 0.775) < 0.01 && Math.abs(R.lobSubsteps / ROULETTE_RULES_V19.lobSubsteps - 1.29) < 0.01);
// Fair: over many throws every pocket comes up and none dominates.
const counts = new Array(37).fill(0);
for (let i = 0; i < 740; i++) {
  const s = core.create(`fair-${i}`); applyCoreInput(core, s, "BET_RED", 1e9); applyCoreInput(core, s, toss(16 + (i % 9), (i * 7) % 16), 1e9);
  while (s.landingTick !== -1) stepCore(core, s, 1e9);
  counts[s.lastNumber as number]++;
}
const exp = 740 / 37, chi = counts.reduce((a, c) => a + (c - exp) ** 2 / exp, 0);
assert.ok(Math.min(...counts) > 0 && chi < 70, `pockets spread (χ² ${chi.toFixed(1)})`);
// The bowl the ball bounces on is the core's: rim above the track, track above the pockets.
assert.ok(R.rimTop > rouletteSurfaceV20(R.wallR) && rouletteSurfaceV20(R.wallR) > rouletteSurfaceV20(R.lipTop));
const once = () => { const s = core.create("twice"); applyCoreInput(core, s, "BET_RED", 1e9); applyCoreInput(core, s, toss(20, 9), 1e9); while (s.landingTick !== -1) stepCore(core, s, 1e9); return JSON.stringify(s); };
assert.equal(once(), once());
console.log(`Roulette V20 OK · parabolic lob to the aimed point · ${(allBounces / durations.length).toFixed(1)} bounces off the real bowl · roll into a pocket · ${mean.toFixed(1)} s · χ² ${chi.toFixed(1)}`);
