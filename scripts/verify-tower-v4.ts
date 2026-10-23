import assert from "node:assert/strict";
import { generateScenario } from "../lib/server/scenarios";
import { applyCoreInput, stepCore, replayCore } from "../lib/verified/coreRuntime.v1";
import {
  TOWER_DROP_CORE_V4 as core,
  TOWER_DROP_V4,
  createTowerDropV4,
  forecastTowerLanding,
} from "../lib/verified/towerDropCore.v4";
import { TOWER_DROP_CORE_V3 } from "../lib/verified/towerDropCore.v3";
import type { ReplayInput } from "../lib/verified/inputValidation";
import { canonicalJson } from "../lib/verified/canonical";

assert.equal(TOWER_DROP_CORE_V3.gameVersion, "3.0.0", "V3 stays untouched");
assert.equal(core.gameVersion, "4.0.0");
assert.equal(TOWER_DROP_V4.lives, 3);
const scenario = generateScenario({ game_id: "tower-drop", game_version: "4.0.0" }, 7);

type Plan = (state: ReturnType<typeof createTowerDropV4>) => boolean;
/** Plays DROP whenever `want` says so and returns the recorded run. */
function play(seed: string, want: Plan, target = 4000, maxTick = 20000) {
  const state = createTowerDropV4(seed),
    inputs: ReplayInput[] = [];
  while (state.status === "running" && state.tick < maxTick) {
    if (state.phase === "swing" && want(state)) {
      inputs.push({ seq: inputs.length, tick: state.tick, action: "DROP" });
      applyCoreInput(core, state, "DROP", target);
    }
    if (state.status === "running") stepCore(core, state, target);
  }
  return { state, inputs };
}
const good: Plan = (s) => {
  const top = s.blocks.at(-1)!,
    center = top.xMilli + top.wMilli / 2,
    f = forecastTowerLanding(s);
  return f.stable && Math.abs(f.xMilli + s.movingWMilli / 2 - center) < 7000;
};
const bad: Plan = (s) => !forecastTowerLanding(s).stable;

// New runs start with three lives.
{
  const s = createTowerDropV4(scenario.seed);
  assert.equal(s.lives, 3);
  assert.equal(s.lastLossTick, -1);
}
// A failed block costs exactly one life: the tower is kept and the hook swings on.
{
  const s = createTowerDropV4(scenario.seed);
  const heightBefore = s.blocks.length;
  let losses = 0;
  while (s.status === "running" && s.tick < 9000 && losses < 1) {
    if (s.phase === "swing" && bad(s)) applyCoreInput(core, s, "DROP", 1e9);
    stepCore(core, s, 1e9);
    if (s.lives < 3) losses++;
  }
  assert.equal(s.lives, 2, "one life lost");
  assert.equal(s.status, "running", "run continues after the first miss");
  assert.equal(s.failure, null);
  assert.equal(s.phase, "swing");
  assert.equal(s.blocks.length, heightBefore, "tower is kept, failed block discarded");
  assert.equal(s.combo, 0);
  assert.ok(s.lastLossTick > 0);
  assert.equal(core.canApply(s, "DROP"), true);
}
// Three failures end the run; the failure reason is reported.
{
  const { state, inputs } = play(scenario.seed, bad);
  assert.equal(state.status, "failed");
  assert.equal(state.lives, 0);
  assert.ok(["CENTER_OF_MASS", "NO_SUPPORT", "TIMEOUT_IDLE"].includes(state.failure!));
  assert.deepEqual(replayCore(core, inputs, state.tick, scenario.seed, 1e9).state, state);
}
// Idle: each idle period costs a life, so an AFK player still ends the run.
{
  const r = replayCore(core, [], 120 * 45 * 3, scenario.seed, 1e9);
  assert.equal(r.valid, true);
  assert.equal(r.failure, "TIMEOUT_IDLE");
  assert.equal(r.state.lives, 0);
}
// One early miss does not prevent winning; replay is identical for 24 seeds.
for (let index = 0; index < 24; index++) {
  const seed = generateScenario({ game_id: "tower-drop", game_version: "4.0.0" }, index).seed;
  let missed = false;
  const { state, inputs } = play(seed, (s) => {
    if (!missed && s.blocks.length === 2) {
      missed = bad(s);
      return missed;
    }
    return good(s);
  });
  assert.equal(state.status, "won", `seed ${index}`);
  assert.equal(state.lives, missed ? 2 : 3);
  assert.equal(canonicalJson(replayCore(core, inputs, state.tick, seed, 4000).state), canonicalJson(state));
}
console.log("Tower V4 OK · three lives · miss keeps the tower · idle ends the run · 24 seed replays");
