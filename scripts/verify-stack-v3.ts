import assert from "node:assert/strict";
import { generateScenario } from "../lib/server/scenarios";
import { applyCoreInput, stepCore, replayCore } from "../lib/verified/coreRuntime.v1";
import { STACK_3D_CORE, createStack3DState, type Stack3DState } from "../lib/verified/precisionStackCore.v3";
import type { ReplayInput } from "../lib/verified/inputValidation";
import { verifyCoreFixture } from "./core-test-utils";

function skilledRun(seed: string, target = 8000) {
  const state = createStack3DState(seed);
  const inputs: ReplayInput[] = [];
  while (state.status === "running" && state.tick < 10000) {
    if (state.phase === "moving") {
      const top = state.blocks[state.blocks.length - 1];
      const error = state.axis === "x" ? Math.abs(state.moving.xMilli - top.xMilli) : Math.abs(state.moving.zMilli - top.zMilli);
      const plannedError = inputs.length === 1 ? 14000 : inputs.length === 2 ? 22000 : 0;
      if (error <= plannedError) {
        inputs.push({ seq: inputs.length, tick: state.tick, action: "DROP" });
        assert.equal(applyCoreInput(STACK_3D_CORE, state, "DROP", target), true);
      }
    }
    if (state.status === "running") stepCore(STACK_3D_CORE, state, target);
  }
  assert.equal(state.status, "won");
  return { state, inputs };
}
const scenario = generateScenario({game_id:"precision-stack",game_version:"3.0.0"},7);
assert.equal(scenario.seed,"64359e9aaf7b61e179e812c492cf8ef8b5b01937ac9c14b361b61f0a13ed0e29");
const goldenInputs = [116,247,373,507,638,767].map((tick,seq)=>({seq,tick,action:"DROP"}));
verifyCoreFixture(STACK_3D_CORE,scenario.seed,goldenInputs,767,8000,{
  score:8919,status:"won",failure:null,hash:"sha256:2046e8f4f45dadf20bede21e795425539b31abf91ca3ccaa615f43fab4fcd234",
});
for (let index=0;index<64;index++) {
  const {seed}=generateScenario({game_id:"precision-stack",game_version:"3.0.0"},index);
  const {state,inputs}=skilledRun(seed);
  assert.deepEqual(replayCore(STACK_3D_CORE,inputs,state.tick,seed,8000).state,state);
  assert.equal(state.blocks.length,state.height+1);
  state.blocks.slice(1).forEach((block,i)=>{
    const below=state.blocks[i];
    assert.ok(block.xMilli>=below.xMilli && block.zMilli>=below.zMilli);
    assert.ok(block.xMilli+block.wMilli<=below.xMilli+below.wMilli && block.zMilli+block.dMilli<=below.zMilli+below.dMilli);
  });
}
const state=createStack3DState(scenario.seed);
const axis=(s:Stack3DState)=>s.axis;
assert.equal(axis(state),"x");
state.moving={...state.blocks[0]};
applyCoreInput(STACK_3D_CORE,state,"DROP",1e9);
assert.equal(state.phase,"settling");
assert.equal(applyCoreInput(STACK_3D_CORE,state,"DROP",1e9),false);
for(let n=0;n<24;n++)stepCore(STACK_3D_CORE,state,1e9);
assert.equal(axis(state),"z");
const below=state.blocks.at(-1)!;
state.moving={...below,zMilli:below.zMilli+20000};
applyCoreInput(STACK_3D_CORE,state,"DROP",1e9);
assert.equal(state.blocks.at(-1)!.dMilli,below.dMilli-20000);
assert.equal(state.blocks.at(-1)!.wMilli,below.wMilli);
const missed=createStack3DState(scenario.seed);missed.moving.xMilli=300000;
applyCoreInput(STACK_3D_CORE,missed,"DROP",1e9);assert.equal(missed.failure,"NO_OVERLAP");
const sliver=createStack3DState(scenario.seed);sliver.moving.xMilli=sliver.blocks[0].xMilli+sliver.blocks[0].wMilli-1000;
applyCoreInput(STACK_3D_CORE,sliver,"DROP",1e9);assert.equal(sliver.failure,"UNSTABLE_OVERLAP");
console.log("Stack V3 geometry OK · 64 seeded replays · alternating axes · exact support · slivers · settling");
