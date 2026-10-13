import assert from "node:assert/strict";
import { BIRDS_CORE_V5 as birds } from "../lib/verified/galacticBirdsCore.v5";
import { ROULETTE_CORE_V3 as roulette, rouletteTossVelocity } from "../lib/verified/galacticRouletteCore.v3";
import { SLOT_CORE_V2 as slot } from "../lib/verified/galacticSlotCore.v2";
import { JET_STREAM_CORE_V5 as jet } from "../lib/verified/jetStreamCore.v5";
import { slotReelPosition } from "../lib/slotPresentation.v2";
import { verifyCoreFixture } from "./core-test-utils";
import {applyCoreInput,stepCore,advanceCoreToTick} from "../lib/verified/coreRuntime.v1";
import {createMatchManifest,issueAttemptTicket,processAttemptRecord} from "../lib/server/verifiedMatch";
import birdFixture from "./fixtures/birds-v5.json" with {type:"json"};
import rouletteFixture from "./fixtures/roulette-v3.json" with {type:"json"};
import slotFixture from "./fixtures/slot-v2.json" with {type:"json"};
import jetFixture from "./fixtures/jet-v5.json" with {type:"json"};
for (const [core, fixture] of [[birds,birdFixture],[roulette,rouletteFixture],[slot,slotFixture],[jet,jetFixture]] as const) {
  // The four states are distinct, so invoke the generic contract with each core independently below.
  const manifest = createMatchManifest({gameId:core.gameId,gameVersion:core.gameVersion,seed:fixture.seed,targetScore:1e9});
  const ticket = issueAttemptTicket({manifest,playerId:"v97-fixture-player"});
  const payload = {manifest,ticket,inputs:fixture.inputs,final_tick:fixture.finalTick};
  const now = Date.now;
  try {
    Date.now = () => Date.parse(ticket.issued_at) + fixture.finalTick * 1000 / 120 + 1000;
    const checked = processAttemptRecord({...payload,score:999999999});
    assert.equal(checked.body.verified,true);
    assert.equal(checked.body.score,fixture.score);
    assert.equal(processAttemptRecord({...payload,manifest:{...manifest,seed:"tampered"}}).body.verified,false);
  } finally {Date.now = now;}
}
const b = verifyCoreFixture(birds,birdFixture.seed,birdFixture.inputs,birdFixture.finalTick,1e9,{...birdFixture,status:"won"}).state;
assert.equal(b.level,5);assert.equal(b.completedKills+b.kills,12);assert.equal(b.launcherX,110000);
assert.ok(b.shots<=30);
for(let seed=0;seed<64;seed++) {
  const s=birds.create(`fixed-level-${seed}`);
  assert.equal(s.enemies.length,2);
  assert.ok(s.bodies.every(body=>body.x-body.w/2>=100000&&body.x+body.w/2<=383000));
  for(let t=0;t<480;t++)stepCore(birds,s,1e9);
  assert.equal(s.kills,0);assert.ok(s.bodies.every(body=>body.alive));
  assert.equal(s.level,0);assert.equal(s.launcherX,110000);
}
verifyCoreFixture(roulette,rouletteFixture.seed,rouletteFixture.inputs,rouletteFixture.finalTick,1e9,{...rouletteFixture,status:"won"});
assert.ok(rouletteTossVelocity(20,15).vz>rouletteTossVelocity(20,0).vz*3);
const inclined=roulette.create("inclined-normal");
Object.assign(inclined,{ballX:120000,ballY:195000,ballZ:11000,ballVx:600,ballVy:0,ballVz:-300,inBowl:true,flightStart:0,landingTick:720});
stepCore(roulette,inclined,1e9);
assert.ok(inclined.ballVz>0,"inclined 3D impact rebounds upwards");
assert.ok(inclined.ballVx<600,"cone normal changes radial velocity as well as height");
assert.equal(inclined.contacts,1);
assert.ok([inclined.ballX,inclined.ballY,inclined.ballZ,inclined.ballVx,inclined.ballVy,inclined.ballVz].every(Number.isSafeInteger));
verifyCoreFixture(slot,slotFixture.seed,slotFixture.inputs,slotFixture.finalTick,1e9,{...slotFixture,status:"won"});
const zero=slot.create("no000");
for(let reel=0;reel<3;reel++){assert.ok(applyCoreInput(slot,zero,`REEL_${reel}_LESS`,1e9));advanceCoreToTick(slot,zero,zero.tick+3,1e9);}
assert.deepEqual(zero.steps,[0,0,0]);
const snapshot=JSON.stringify(zero);assert.equal(applyCoreInput(slot,zero,"SPIN",1e9),false);assert.equal(JSON.stringify(zero),snapshot);
for(const delta of [-3,-2,-1,0,1,2,3]) {
 const s=slot.create("signed-step");s.steps=[delta,1,1];
 const from=s.positions[0];assert.ok(applyCoreInput(slot,s,"SPIN",1e9));
 advanceCoreToTick(slot,s,120,1e9);assert.equal(slotReelPosition(s,0),from+delta);
 advanceCoreToTick(slot,s,180,1e9);assert.equal(s.positions[0],(from+delta+8)%8);
 s.steps[0]=3;assert.equal(slot.canApply(s,"REEL_0_MORE"),false);s.steps[0]=-3;assert.equal(slot.canApply(s,"REEL_0_LESS"),false);
}
const j=verifyCoreFixture(jet,jetFixture.seed,jetFixture.inputs,jetFixture.finalTick,1e9,{...jetFixture,status:"won"}).state;
assert.equal(j.tick,32400);assert.ok(j.clocks>0);assert.ok(j.passed>250);
const normal=jet.create("clock-speed");normal.launchedAtTick=0;
const slow=structuredClone(normal);slow.slowUntilTick=480;
for(let t=0;t<100;t++){stepCore(jet,normal,1e9);stepCore(jet,slow,1e9);}
assert.equal(normal.tick,slow.tick);assert.ok(Math.abs(slow.scrollMilli*2-normal.scrollMilli)<2);
assert.ok(slow.yMilli<normal.yMilli,"clock slows vertical motion as well as world speed");
assert.ok(new Set(jet.create("tube-widths").gates.map(g=>g.widthMilli)).size>=3);
// A clock collects once and lasts four real seconds.
const clock=jet.create("clock-once");clock.launchedAtTick=0;
clock.gates[0].clock=true;clock.gates[0].clockCollected=false;
clock.gates[0].worldXMilli=92000-clock.gates[0].widthMilli/2;
clock.gates[0].centerYMilli=clock.yMilli;clock.gates[0].windows=[{centerYMilli:clock.yMilli,gapMilli:250000}];
stepCore(jet,clock,1e9);assert.equal(clock.clocks,1);assert.equal(clock.slowUntilTick,481);
stepCore(jet,clock,1e9);assert.equal(clock.clocks,1);
console.log("V97 fixed levels, signed short reels/no000, 3D surface bounces, wider tubes, half-speed clocks and270s replay OK");
