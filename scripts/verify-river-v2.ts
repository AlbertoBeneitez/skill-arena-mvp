import assert from "node:assert/strict";
import { RIVER_DASH_CORE_V2 as core } from "../lib/verified/riverDashCore.v2";
import { RIVER_DASH_CORE } from "../lib/verified/riverDashCore.v1";
import { generateScenario } from "../lib/server/scenarios";
import { replayCore } from "../lib/verified/coreRuntime.v1";
import { planRiverCrossing } from "./river-play-fixture";
import { verifyCoreFixture } from "./core-test-utils";

for (let index = 0; index < 128; index++) {
  const seed = generateScenario(
    { game_id: "river-dash", game_version: "2.0.0" },
    index,
  ).seed;
  for (const delay of [0, 240, 600]) {
    const inputs = Array.from({ length: 10 }, (_, seq) => ({
      seq,
      tick: delay + seq * 60,
      action: "UP",
    }));
    const replay = replayCore(core, inputs, delay + 540, seed, 1400);
    assert.equal(replay.valid, true, `${index}/${delay}: ${replay.error}`);
    assert.equal(
      replay.state.status,
      "won",
      `${index}/${delay}: ${replay.failure}`,
    );
    assert.equal(replay.score, 1400);
    assert.deepEqual(replayCore(core, inputs, delay + 540, seed, 1400), replay);
  }
  const initial = core.create(seed);
  const advanced = core.create(seed);
  advanced.row = 1;
  core.apply(advanced, "UP");
  assert.equal(advanced.crossings, 1);
  assert.equal(advanced.row, 10);
  assert.ok(advanced.lanes[9].speedMilli > initial.lanes[9].speedMilli);
  assert.ok(advanced.lanes[4].lengthMilli < initial.lanes[4].lengthMilli);
}
const seed = generateScenario(
  { game_id: "river-dash", game_version: "2.0.0" },
  7,
).seed;
const inputs = Array.from({ length: 10 }, (_, seq) => ({
  seq,
  tick: 240 + seq * 60,
  action: "UP",
}));
assert.equal(
  seed,
  "67546497552569e93a1439ef4c249ef57931350eff4b2010021713dfeed306d4",
);

verifyCoreFixture(core, seed, inputs, 780, 1400, {
  score: 1400,
  status: "won",
  failure: null,
  hash: "sha256:c1ada6b8a8ac94bc928b7378bb9e8f69cbdebe09674f99041d8b5bff0622ad29",
});
assert.equal(RIVER_DASH_CORE.gameVersion, "1.0.0");
console.log(
  "River V2: 384 novice crossings, progressive sectors, historical V1 preserved",
);

for (let index = 0; index < 16; index++) {
  const seed = generateScenario(
    { game_id: "river-dash", game_version: "2.0.0" },
    index,
  ).seed;
  const first = planRiverCrossing(core.create(seed), 0, core);
  const second = planRiverCrossing(
    { ...first.state, status: "running" },
    0,
    core,
  );
  const inputs = [...first.inputs, ...second.inputs].map((input, seq) => ({
    ...input,
    seq,
  }));
  const replay = replayCore(core, inputs, second.state.tick, seed, 2950);
  assert.equal(replay.valid, true, replay.error ?? "");
  assert.equal(replay.score, 2950);
  assert.deepEqual(replay.state, second.state);
}
