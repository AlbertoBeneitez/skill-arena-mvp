import {createMatchManifest, issueAttemptTicket, processAttemptRecord} from "../lib/server/verifiedMatch";
import assert from "node:assert/strict";
import { BIRDS_CORE as core } from "../lib/verified/galacticBirdsCore.v4";
import { stepCore, replayCore } from "../lib/verified/coreRuntime.v1";
import { playBirds } from "./birds-v4-play-fixture";
import { verifyCoreFixture } from "./core-test-utils";
import fixture from "./fixtures/birds-v4.json" with {type: "json"};
verifyCoreFixture(core, fixture.seed, fixture.inputs, fixture.finalTick, 1e9, {...fixture, status: "won"});
const setups = new Set<string>();
for (let i = 0; i < 64; i++) {
  const seed = `birds4-${i}`, s = core.create(seed);
  assert.deepEqual(core.create(seed), s);
  assert.equal(s.enemies.length, 12);
  const groups = new Set(s.enemies.filter((_, i) => i % 2 === 0).map((e, i) => {
    const centre = 300000 + i * 210000;
    return JSON.stringify(s.bodies.filter(b => Math.abs(b.x - centre) < 105000).map(b => [b.x - centre,b.y,b.w,b.h]));
  }));
  assert.equal(groups.size, 6, "every assembly has a distinct silhouette");
  setups.add(JSON.stringify(s.bodies));
  for (let t = 0; t < 960; t++) stepCore(core, s, 1e9);
  assert.equal(s.kills, 0, `spontaneous deaths: ${seed}`);
  assert.ok(s.bodies.every(b => b.alive), `spontaneous destruction: ${seed}`);
  assert.ok(s.bodies.every(b => [b.x,b.y,b.vx,b.vy,b.hp].every(Number.isSafeInteger)));
}
assert.equal(setups.size, 64);
for (const seed of ["birds4-pilot-0", "birds4-pilot-1"]) {
  const {s, inputs} = playBirds(seed);
  assert.equal(s.status, "won", seed);
  assert.equal(s.kills, 12);
  assert.ok(s.destroyed >= 6);
  assert.deepEqual(replayCore(core, inputs, s.tick, seed, 1e9).state, s);
}
console.log("Birds V4 distinct stable assemblies, chain destruction and full win/replay OK");

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
