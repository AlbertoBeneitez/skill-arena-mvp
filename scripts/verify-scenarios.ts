import assert from "node:assert/strict";
import {
  generateScenario,
  resolveScenario,
  selectScenario,
  SCENARIO_CATALOG_V1,
} from "../lib/server/scenarios";
import { DARTS_CORE_V3 } from "../lib/verified/dartsCore.v3";
import { replayCore } from "../lib/verified/coreRuntime.v1";

const identity = { game_id: "darts", game_version: "3.0.0" };
const golden = generateScenario(identity, 7);
assert.deepEqual(golden, {
  ...identity,
  scenario: { scenario_id: "seed-catalog-v1:000007", generator_version: "1.0.0" },
  seed: "35c435b9e1277a943f2de2690388c416f3287a30a9346563b57067310da8d62f",
});
assert(Object.isFrozen(golden) && Object.isFrozen(golden.scenario));
assert.deepEqual(resolveScenario(identity, golden.scenario), golden);
assert.equal(generateScenario({ game_id: "precision-stack", game_version: "2.0.0" }, 0).seed, "b0df17a25cbca4118e6bb6b529d3ae98d2fef4cfafd5f1494a0ce1ca2c6037d7");
assert.equal(generateScenario({ game_id: "billiards", game_version: "1.0.0" }, 65_535).seed, "7ad32622fd131848c07a26ca1d7e7c271c1523b068447166cb4b68b8b9b67e5d");
assert.notEqual(generateScenario({ ...identity, game_version: "2.0.0" }, 7).seed, golden.seed);
assert.notEqual(generateScenario({ ...identity, game_id: "billiards" }, 7).seed, golden.seed);
assert.notEqual(generateScenario(identity, 8).seed, golden.seed);

// Mapping cannot depend on a player's wall clock or an uncontrolled RNG.
const originalRandom = Math.random;
const originalNow = Date.now;
try {
  Math.random = () => { throw new Error("uncontrolled RNG in scenario mapping"); };
  Date.now = () => { throw new Error("wall clock in scenario mapping"); };
  const seeds = new Set<string>();
  for (let index = 0; index < 4096; index += 1) {
    const generated = generateScenario(identity, index);
    const participantA = resolveScenario(identity, JSON.parse(JSON.stringify(generated.scenario)));
    const participantB = resolveScenario(identity, structuredClone(generated.scenario));
    assert.deepEqual(participantA, participantB);
    assert.deepEqual(participantA, generated);
    seeds.add(generated.seed);
  }
  assert.equal(seeds.size, 4096, "catalogue has duplicate seed identities");
} finally {
  Math.random = originalRandom;
  Date.now = originalNow;
}

for (const index of [-1, 65_536, Number.MAX_SAFE_INTEGER, 1.5, NaN, Infinity, "7", null]) {
  assert.throws(() => generateScenario(identity, index as number), /INVALID_SCENARIO_INDEX/);
}
for (const bad of [
  { ...identity, game_id: "../darts" },
  { ...identity, game_id: "Darts" },
  { ...identity, game_id: "darts\n" },
  { ...identity, game_version: "01.0.0" },
  { ...identity, game_version: "1.0.0\n" },
  { ...identity, game_version: "1.0" },
]) assert.throws(() => generateScenario(bad, 0), /INVALID_SCENARIO_IDENTITY/);
assert.throws(() => generateScenario(identity, 0, "2.0.0"), /UNSUPPORTED_SCENARIO_GENERATOR/);
for (const descriptor of [
  null, [], {},
  { ...golden.scenario, seed: "client-picked" },
  { ...golden.scenario, scenario_id: "seed-catalog-v1:7" },
  { ...golden.scenario, scenario_id: "seed-catalog-v1:000007\n" },
  { ...golden.scenario, scenario_id: "seed-catalog-v1:065536" },
  { ...golden.scenario, scenario_id: "seed-catalog-v2:000007" },
  { ...golden.scenario, generator_version: "2.0.0" },
  Object.assign(Object.create(golden.scenario), { extraA: true, extraB: true }),
]) assert.throws(() => resolveScenario(identity, descriptor));

// Random selection happens once on the server. Resolution after selection is
// deterministic; this is not a claim of persisted two-player matchmaking yet.
for (let attempt = 0; attempt < 32; attempt += 1) {
  const selected = selectScenario(identity);
  assert.match(selected.scenario.scenario_id, /^seed-catalog-v1:\d{6}$/);
  assert.deepEqual(resolveScenario(identity, selected.scenario), selected);
}

// A generated seed feeds the existing frozen core without changing its rules.
const first = replayCore(DARTS_CORE_V3, [], 29760, golden.seed);
const second = replayCore(DARTS_CORE_V3, [], 29760, resolveScenario(identity, golden.scenario).seed);
assert.equal(first.valid, true);
assert.equal(first.state.status, "failed");
assert.deepEqual(first, second);

console.log(`Scenario catalogue OK · capacity=${SCENARIO_CATALOG_V1.count} · 4096 reproducible mappings · bounds/goldens/replay passed · issuance not enabled`);
