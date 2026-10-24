import assert from "node:assert/strict";
import { generateScenario } from "../lib/server/scenarios";
import { applyCoreInput, stepCore, replayCore } from "../lib/verified/coreRuntime.v1";
import { STACK_3D_CORE, STACK_3D_RULES, createStack3DState } from "../lib/verified/precisionStackCore.v4";
import type { ReplayInput } from "../lib/verified/inputValidation";
import { canonicalJson } from "../lib/verified/canonical";
import { sha256 } from "../lib/server/matchIntegrity";
import { verifyCoreFixture } from "./core-test-utils";
import fixture from "./fixtures/stack-v4.json" with { type: "json" };

const TARGET = 600_000; // six blocks
const ver = { game_id: "precision-stack" as const, game_version: "4.0.0" };

function botRun(seed: string, target: number, slop: (n: number) => number) {
  const state = createStack3DState(seed);
  const inputs: ReplayInput[] = [];
  while (state.status === "running" && state.tick < 20000) {
    if (state.phase === "moving") {
      const top = state.blocks[state.blocks.length - 1];
      const error = state.axis === "x" ? Math.abs(state.moving.xMilli - top.xMilli) : Math.abs(state.moving.zMilli - top.zMilli);
      if (error <= slop(inputs.length)) {
        inputs.push({ seq: inputs.length, tick: state.tick, action: "DROP" });
        assert.equal(applyCoreInput(STACK_3D_CORE, state, "DROP", target), true);
      }
    }
    if (state.status === "running") stepCore(STACK_3D_CORE, state, target);
  }
  return { state, inputs };
}
const scenario = generateScenario(ver, 7);
const win = botRun(scenario.seed, TARGET, n => (n === 1 ? 14000 : n === 2 ? 22000 : 0));
assert.equal(win.state.status, "won");
assert.equal(win.state.height, 6);
// score = height first, surface (1 unit = 100 px^2) as tie-break
assert.equal(win.state.score, 6 * STACK_3D_RULES.scoreHeightUnit + Math.floor(win.state.surfaceMilli2 / STACK_3D_RULES.surfaceUnitMilli2));
const lose = botRun(scenario.seed, 1e9, n => (n < 3 ? 0 : 1e9));
assert.equal(lose.state.status, "failed");
assert.ok(lose.state.lastPlacement && lose.state.lastPlacement.landed === null && lose.state.lastPlacement.source);
if (process.env.PRINT_STACK4) {
  console.log(JSON.stringify({ win_h: sha256(canonicalJson(replayCore(STACK_3D_CORE, win.inputs, win.state.tick, scenario.seed, TARGET).state)), lose_h: sha256(canonicalJson(replayCore(STACK_3D_CORE, lose.inputs, lose.state.tick, scenario.seed, 1e9).state)), winScore: win.state.score, loseScore: lose.state.score, win: win.inputs.map(i => i.tick), winTick: win.state.tick, lose: lose.inputs.map(i => i.tick), loseTick: lose.state.tick, loseFailure: lose.state.failure }));
}
const golden = fixture;
if (process.env.PRINT_STACK4) process.exit(0);
verifyCoreFixture(STACK_3D_CORE, scenario.seed, win.inputs, win.state.tick, TARGET, golden.win as never);
verifyCoreFixture(STACK_3D_CORE, scenario.seed, lose.inputs, lose.state.tick, 1e9, golden.lose as never);

// Surface only breaks ties: a taller tower always outranks a wider shorter one.
const a = botRun(scenario.seed, 1e9, n => (n < 5 ? 0 : 1e9)).state;
const sloppy = botRun(scenario.seed, 1e9, n => (n < 3 ? 40000 : 1e9)).state;
if (a.height > sloppy.height) assert.ok(a.score > sloppy.score);
assert.ok(STACK_3D_RULES.scoreHeightUnit > 60 * (STACK_3D_RULES.baseSizeMilli ** 2) / STACK_3D_RULES.surfaceUnitMilli2, "surface cannot overflow into height");

for (let index = 0; index < 32; index++) {
  const { seed } = generateScenario(ver, index);
  const run = botRun(seed, TARGET, n => (n === 1 ? 14000 : n === 2 ? 22000 : 0));
  assert.deepEqual(replayCore(STACK_3D_CORE, run.inputs, run.state.tick, seed, TARGET).state, run.state);
  assert.equal(run.state.blocks.length, run.state.height + 1);
}
const hit = createStack3DState(scenario.seed);
hit.moving.xMilli = 300000;
applyCoreInput(STACK_3D_CORE, hit, "DROP", 1e9);
assert.equal(hit.failure, "NO_OVERLAP");
assert.equal(hit.height, 0);
console.log("Stack V4 OK · height-first score · surface tie-break · visible failed drop data · golden win/loss");
