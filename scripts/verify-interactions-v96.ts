import {createMatchManifest, issueAttemptTicket, processAttemptRecord} from "../lib/server/verifiedMatch";
import { chooseBilliardsShotV2 } from "./billiards-v2-play-fixture";
import { billiardsAimAction } from "../lib/verified/billiardsProtocol.v1";
import assert from "node:assert/strict";
import { BILLIARDS_CORE_V3 as core } from "../lib/verified/billiardsCore.v3";
import { grabBilliardsCue, pullBilliardsCue } from "../lib/billiardsPullback";
import { solitaireDestinations, type Card } from "../lib/solitaireMoves";
import { applyCoreInput, stepCore, replayCore } from "../lib/verified/coreRuntime.v1";
import type { ReplayInput } from "../lib/verified/inputValidation";
import { verifyCoreFixture } from "./core-test-utils";
import fixture from "./fixtures/billiards-v3.json" with {type: "json"};
verifyCoreFixture(core, fixture.seed, fixture.inputs, fixture.finalTick, 1e9, {...fixture, status: "failed"});
const cue = {x: 195, y: 300};
const drag = grabBilliardsCue(cue, cue, 0)!;
assert.ok(drag);
assert.equal(pullBilliardsCue(drag, {x: 190, y: 300}), null);
assert.deepEqual(pullBilliardsCue(drag, {x: 133, y: 300}), ["AIM_000", "POWER_06"]);
assert.deepEqual(pullBilliardsCue(drag, {x: -500, y: 300}), ["AIM_000", "POWER_12"]);
assert.deepEqual(pullBilliardsCue(drag, {x: 195, y: 362}), ["AIM_135", "POWER_06"]);
assert.equal(grabBilliardsCue({x: 195, y: 200}, cue, 0), null);
const shaft = grabBilliardsCue({x: 135, y: 300}, cue, 0)!;
assert.deepEqual(pullBilliardsCue(shaft, {x: 73, y: 300}), ["AIM_000", "POWER_06"]);
assert.equal(pullBilliardsCue(drag, {x: NaN, y: 0}), null);
for (let power = 0; power <= 12; power++) {
  const s = core.create("pullback");
  assert.equal(core.canApply(s, "POWER_13"), false);
  if (power !== s.power) assert.ok(applyCoreInput(core, s, `POWER_${String(power).padStart(2, "0")}`, 1e9));
  assert.ok(applyCoreInput(core, s, "SHOOT", 1e9));
  const speed = Math.hypot(s.balls[0].vx, s.balls[0].vy);
  assert.ok(Math.abs(speed - (1500 + power * 150)) < 5);
  assert.equal(s.shotsLeft, 17);
  assert.equal(core.canApply(s, "SHOOT"), false);
}
const card = (rank: number, suit: Card["suit"], faceUp = true): Card => ({id: `${rank}${suit}`, rank, suit, faceUp});
const foundations: Card[][] = [[], [], [], []];
assert.deepEqual(solitaireDestinations({type:"waste"}, [[], [card(2,"♥")]], [card(1,"♠")], foundations)[0], {type:"foundation",index:0});
assert.deepEqual(solitaireDestinations({type:"waste"}, [[card(8,"♣")], [card(8,"♦")]], [card(7,"♥")], foundations), [{type:"tableau",index:0}]);
assert.deepEqual(solitaireDestinations({type:"tableau", column:0,index:0}, [[card(13,"♠")], []], [], foundations), []);
assert.deepEqual(solitaireDestinations({type:"tableau", column:0,index:0}, [[card(9,"♠",false)], [card(10,"♥")]], [], foundations), []);
const stack = [[card(8,"♠"),card(7,"♥")], [card(9,"♦")]];
assert.deepEqual(solitaireDestinations({type:"tableau",column:0,index:0}, stack, [], foundations), [{type:"tableau",index:1}]);
assert.deepEqual(solitaireDestinations({type:"tableau",column:0,index:0}, [[card(8,"♠"),card(6,"♥")], [card(9,"♦")]], [], foundations), []);
console.log("V96 pullback/13 powers/visible-card predictions and illegal moves OK");

for (const seed of ["billiards3-pilot-0", "billiards3-pilot-1"]) {
  const s = core.create(seed), inputs: ReplayInput[] = [];
  while (s.status === "running") {
    if (s.phase === "aim") {
      // The three archived speeds are an exact subset (0/6/12) of V3.
      const shot = chooseBilliardsShotV2({...s, power: Math.round(s.power / 6)});
      for (const action of [billiardsAimAction(shot.aim), `POWER_${String(shot.power * 6).padStart(2,"0")}`, "SHOOT"]) {
        if (!core.canApply(s, action)) continue;
        inputs.push({seq:inputs.length, tick:s.tick, action});
        assert.ok(applyCoreInput(core,s,action,1e9));
        stepCore(core,s,1e9);
      }
    } else stepCore(core,s,1e9);
  }
  assert.equal(s.status,"won",seed);
  assert.equal(s.height,10);
  assert.deepEqual(replayCore(core,inputs,s.tick,seed,1e9).state,s);
}
assert.deepEqual(solitaireDestinations({type:"waste"}, [[]], [card(1,"♥")], foundations)[0], {type:"foundation",index:1});

const manifest = createMatchManifest({gameId:core.gameId,gameVersion:core.gameVersion,seed:fixture.seed,targetScore:1e9});
const ticket = issueAttemptTicket({manifest,playerId:"v96-fixture-player"});
const payload = {manifest,ticket,inputs:fixture.inputs,final_tick:fixture.finalTick};
const now = Date.now;
try {
  Date.now = () => Date.parse(ticket.issued_at) + fixture.finalTick * 1000 / 120 + 1000;
  const checked = processAttemptRecord({...payload, score:999999999});
  assert.equal(checked.body.verified,true);
  assert.equal(checked.body.score,fixture.score);
  assert.equal(processAttemptRecord({...payload,manifest:{...manifest,seed:"tampered"}}).body.verified,false);
} finally {Date.now = now;}
