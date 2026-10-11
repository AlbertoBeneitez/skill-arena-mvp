import assert from "node:assert/strict";
import { generateScenario } from "../lib/server/scenarios";
import { advanceCoreToTick, applyCoreInput, replayCore, stepCore } from "../lib/verified/coreRuntime.v1";
import { RIVER_DASH_CORE_V4 as core, riverRectsV4, riverSupportedV4 } from "../lib/verified/riverDashCore.v4";
import { canonicalJson } from "../lib/verified/canonical";
import { sha256 } from "../lib/server/matchIntegrity";
import { createMatchManifest, issueAttemptTicket, processAttemptRecord } from "../lib/server/verifiedMatch";
import { planRiverV4Run, cloneRiverV4State } from "./river-v4-play-fixture";
import { verifyCoreFixture } from "./core-test-utils";
import fixture from "./fixtures/river-v4.json" with { type: "json" };
import type { ReplayInput } from "../lib/verified/inputValidation";
const profiles = new Set<string>();
for (let i = 0; i < 1000; i++) {
  const seed = generateScenario({ game_id: core.gameId, game_version: core.gameVersion }, i).seed;
  const s = core.create(seed);
  profiles.add(JSON.stringify(s.lanes));
  assert.deepEqual(s, core.create(seed));
  if (i < 128) for (const delay of [0,240,600]) {
    const inputs = Array.from({ length: 8 }, (_, seq) => ({ seq, tick: delay + seq * 60, action: "UP" }));
    const r = replayCore(core, inputs, delay + 420, seed, 1);
    assert.equal(r.error, "CLIENT_ENDED_BEFORE_RESOLUTION", `${i}/${delay}:${r.failure}`);
    assert.equal(r.height, 8);
    assert.equal(r.score, 0, "target must not end a continuous run");
  }
}
assert.equal(profiles.size, 1000);
let golden: { seed: string; inputs: ReplayInput[]; finalTick: number; score: number; hash: string; failure: string | null } | undefined;
for (let i = 0; i < 8; i++) {
  const seed = i === 0 ? "river4-golden" : `river4-route-${i}`;
  const initial = core.create(seed), snapshot = cloneRiverV4State(initial);
  const run = planRiverV4Run(initial, i === 0 ? 150 : 90);
  assert.deepEqual(initial, snapshot);
  assert.ok(run.state.height > 64 && run.state.status === "running");
  assert.ok(run.state.lanes.length > 65);
  const speeds = new Set(run.state.lanes.filter(l => l.kind === "road").map(l => l.speedMilli));
  assert.ok(speeds.size > 10);
  let hazards = 0;
  for (const lane of run.state.lanes) {
    hazards = lane.kind === "safe" ? 0 : hazards + 1;
    assert.ok(hazards <= 2);
    if (lane.kind === "river") assert.ok(lane.lengthMilli >= 222000);
    if (lane.kind === "road") assert.ok(lane.gapMilli >= 196000);
  }
  assert.equal(replayCore(core, run.inputs, run.state.tick, seed, 1).error, "CLIENT_ENDED_BEFORE_RESOLUTION");
  assert.deepEqual(replayCore(core, run.inputs, run.state.tick, seed, 1).state, run.state);
  const height = run.state.height;
  advanceCoreToTick(core, run.state, core.maxFinalTick, 1);
  assert.equal(run.state.failure, "TIME_LIMIT");
  assert.equal(run.state.score, height);
  const terminal = replayCore(core, run.inputs, run.state.tick, seed, 1);
  assert.equal(terminal.valid, true, terminal.error ?? "terminal replay");
  assert.deepEqual(terminal.state, run.state);
  assert.deepEqual(replayCore(core, run.inputs, run.state.tick, seed, 1e9), terminal);
  if (i === 0) golden = { seed, inputs: run.inputs, finalTick: run.state.tick, score: height, hash: sha256(canonicalJson(run.state)), failure: run.state.failure };
}
assert.ok(golden);
// Golden is pinned after the route's first validated replay, not regenerated on each run.
assert.deepEqual(golden,fixture,"pinned input sequence and final-state golden");
verifyCoreFixture(core, golden.seed, golden.inputs, golden.finalTick, 1, { score: golden.score, status: "failed", hash: golden.hash, failure: "TIME_LIMIT" });
const manifest = createMatchManifest({ gameId: core.gameId, gameVersion: core.gameVersion, seed: golden.seed, targetScore: 1 }), ticket = issueAttemptTicket({ manifest, playerId: "river4-test" });
const now = Date.now;
try {
  Date.now = () => Date.parse(ticket.issued_at) + 400000;
  const r = processAttemptRecord({ manifest, ticket, inputs: golden.inputs, final_tick: golden.finalTick, score: 999999, height: 999999 });
  assert.equal(r.status, 200);
  assert.ok("score" in r.body);
  assert.equal(r.body.score, golden.score);
  assert.equal(r.body.height, golden.score);
  assert.notEqual(processAttemptRecord({ manifest: { ...manifest, seed: "tamper" }, ticket, inputs: golden.inputs, final_tick: golden.finalTick }).status, 200);
} finally { Date.now = now; }
const farming = core.create("farming");
applyCoreInput(core, farming, "UP", 1);
advanceCoreToTick(core, farming, 24, 1);
applyCoreInput(core, farming, "DOWN", 1);
advanceCoreToTick(core, farming, 48, 1);
applyCoreInput(core, farming, "UP", 1);
assert.equal(farming.height, 1);
assert.equal(farming.score, 0);
assert.equal(applyCoreInput(core, farming, "UP", 1), false);
for (const direction of [-1,1] as const) {
  const s = core.create("carry");
  s.row = 3; s.height = 3;
  s.lanes[3] = { ...s.lanes[3], kind: "river", direction, speedMilli: 18000, lengthMilli: 250000, gapMilli: 40000, phaseMilli: 0 };
  assert.ok(riverSupportedV4(s));
  stepCore(core, s, 1);
  assert.equal(s.xMilli, 180000 + direction * 150);
  assert.equal(s.status, "running");
  const copy = structuredClone(s);
  riverRectsV4(s,3,10000);
  assert.deepEqual(s,copy,"render geometry never mutates state");
  applyCoreInput(core,s,"LEFT",1);
  assert.equal(s.xMilli,140000 + direction*150,"no snap or extra carry on input");
}
for(let i=0;i<8;i++) {
  const s = core.create(`blind-${i}`), inputs: ReplayInput[]=[];
  while(s.status === "running" && s.tick < 12000) {
    if(core.canApply(s,"UP")) { inputs.push({seq:inputs.length,tick:s.tick,action:"UP"}); applyCoreInput(core,s,"UP",1); }
    if(s.status === "running") advanceCoreToTick(core,s,s.tick+60,1);
  }
  assert.equal(s.status,"failed");
  assert.ok(s.height >= 8,"learnable first phase before a generated defeat");
  const r=replayCore(core,inputs,s.tick,s.seed,1);
  assert.equal(r.valid,true,r.error ?? "loss replay");
  assert.deepEqual(r.state,s);
  assert.equal(r.score,r.height);
}
console.log("River V4: 1000 distinct courses, 384 forgiving starts, 8 routes past row64, terminal reach, target independence, carry/farming/security/replay");
