import assert from "node:assert/strict";
import { generateScenario } from "../lib/server/scenarios";
import { applyCoreInput, replayCore, stepCore } from "../lib/verified/coreRuntime.v1";
import type { ReplayInput } from "../lib/verified/inputValidation";
import { canonicalJson } from "../lib/verified/canonical";
import { hopPlatformX, type HopPlatform } from "../lib/verified/skyHopCore.v1";
import { SKY_HOP_CORE_V3 } from "../lib/verified/skyHopCore.v3";
import { SKY_HOP_CORE_V4 as core, SKY_HOP_V4, makeHopPlatformV4, type SkyHopV4State } from "../lib/verified/skyHopCore.v4";
import { hopDirectionAction } from "./sky-hop-v3-play-fixture";

assert.equal(SKY_HOP_CORE_V3.gameVersion, "3.0.0", "V3 stays untouched");
assert.equal(core.gameVersion, "4.0.0");
assert.equal(core.inputVersion, 1);
assert.deepEqual(core.actions, SKY_HOP_CORE_V3.actions);

// The course is a pure function of seed and index: any prefix is identical.
{
  const seed = generateScenario({ game_id: "sky-hop", game_version: "4.0.0" }, 3).seed;
  const s = core.create(seed);
  assert.ok(s.platforms.length >= SKY_HOP_V4.ahead + 1);
  let previous: HopPlatform | null = null;
  for (let i = 0; i < 400; i++) {
    const p = makeHopPlatformV4(seed, i, previous);
    if (i < s.platforms.length) assert.deepEqual(s.platforms[i], p, `platform ${i}`);
    previous = p;
  }
}
// Fair and increasingly hard: bounded gaps, always inside the screen, narrower supports.
{
  const widths: number[] = [], gaps: number[] = [];
  for (let n = 0; n < 12; n++) {
    const seed = `fair-${n}`;
    let previous: HopPlatform | null = null;
    for (let i = 0; i < 300; i++) {
      const p = makeHopPlatformV4(seed, i, previous);
      assert.ok(p.x - p.drift >= 26_000 - 1 && p.x + p.width + p.drift <= 364_000 + 1, `inside the screen ${seed}:${i}`);
      assert.ok(p.width >= SKY_HOP_V4.minWidth - 1000);
      if (previous) {
        const gap: number = previous.y - p.y;
        assert.ok(gap >= 72_000 && gap <= SKY_HOP_V4.maxGap, `gap ${gap}`);
        if (i >= 10 && i < 30) gaps.push(gap);
        if (i >= 150 && i < 170) gaps.push(-gap);
      }
      if (i >= 10 && i < 30) widths.push(p.width);
      if (i >= 150 && i < 170) widths.push(-p.width);
      previous = p;
    }
  }
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  assert.ok(mean(widths.filter((w) => w < 0).map((w) => -w)) < mean(widths.filter((w) => w > 0)) - 20_000, "supports narrow with height");
  assert.ok(mean(gaps.filter((g) => g < 0).map((g) => -g)) > mean(gaps.filter((g) => g > 0)) + 8_000, "jumps get longer with height");
}
// A simple bot (steers to the next platform) plays: replay is identical and there is no finish.
function bot(s: SkyHopV4State): string | null {
  const p = s.platforms[Math.min(s.platforms.length - 1, s.lastLandingIndex + 1)];
  let y = s.y, vy = s.vy, landing = 1;
  for (let t = 1; t < 200; t++) {
    vy += 73;
    y += vy;
    if (vy > 0 && y + 19000 >= p.y) { landing = t; break; }
  }
  const error = hopPlatformX(p, s.tick + landing) + p.width / 2 - (s.x + s.vx * 7);
  return hopDirectionAction(s, error > 14_000 ? 1 : error < -14_000 ? -1 : 0);
}
let best = 0;
for (let index = 0; index < 8; index++) {
  const seed = generateScenario({ game_id: "sky-hop", game_version: "4.0.0" }, index).seed;
  const s = core.create(seed), inputs: ReplayInput[] = [];
  while (s.status === "running") {
    const action = bot(s);
    if (action && applyCoreInput(core, s, action, 1e9)) inputs.push({ seq: inputs.length, tick: s.tick, action });
    if (s.status === "running") stepCore(core, s, 1e9);
  }
  assert.notEqual(s.status, "won", "there is no finish line");
  assert.ok(["FALLEN", "ALIEN_CONTACT", "TIME_LIMIT"].includes(s.failure!));
  assert.ok(s.platforms.length >= s.highest + SKY_HOP_V4.ahead, "course keeps generating ahead");
  assert.equal(s.platforms.length, s.brokenAt.length);
  assert.equal(s.platforms.length, s.collected.length);
  assert.equal(s.enemies.length, s.enemyArmedAt.length);
  assert.equal(canonicalJson(replayCore(core, inputs, s.tick, seed, 1e9).state), canonicalJson(s), `replay ${index}`);
  best = Math.max(best, s.highest);
}
assert.ok(best > 12, `the bot climbs a good way (${best})`);
// Reaching past the old 75-platform finish does not end the run.
{
  const s = core.create("beyond");
  s.highest = 74; s.checkpoint = 70; s.lastLandingIndex = 74;
  stepCore(core, s, 1e9); // the course extends ahead of the highest platform
  assert.ok(s.platforms.length > 100);
  // Teleport onto platform 75 from above and land.
  const p = s.platforms[74];
  s.x = p.x + p.width / 2;
  s.y = p.y - 19000 - 100;
  s.vy = 1000;
  s.camera = Math.min(s.camera, s.y - 260000);
  for (let t = 0; t < 60; t++) stepCore(core, s, 1e9);
  assert.equal(s.status, "running");
}
console.log(`Sky Hop V4 OK · endless · pure per-index course · fair ramp · bot best height ${best} · 8 replays`);
