import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import type { MatchManifestV3 } from "../lib/verified/contracts";
import { MatchRepositoryError } from "../lib/server/matchRepository";
import { PostgresMatchRepository, getProductionMatchRepository } from "../lib/server/postgresMatchRepository";
import { createMatchManifest, hashManifest, validateManifest } from "../lib/server/verifiedMatch";
import { generateScenario } from "../lib/server/scenarios";

// Deliberately no fallback or silent skip. Never migrate a configured production
// database; each run owns a fresh schema in an explicitly local test database.
const connectionString = process.env.TEST_DATABASE_URL;
assert.ok(connectionString, "TEST_DATABASE_URL is required for PostgreSQL tests");
const url = new URL(connectionString);
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname), "Local test database required");
assert.equal(url.pathname, "/skill_arena_test", "Dedicated test database required");
const schema = `qa_matches_${randomBytes(8).toString("hex")}`;
const admin = new Pool({ connectionString, max: 1 });
const pool = new Pool({ connectionString, max: 8, options: `-c search_path=${schema}` });
let createdSchema = false;

const hasCode = (code: string) => (error: unknown) =>
  error instanceof MatchRepositoryError && error.code === code;

try {
  await admin.query(`CREATE SCHEMA ${schema}`);
  createdSchema = true;
  const migration = await readFile("db/migrations/001-matches.sql", "utf8");
  await pool.query(migration);
  await pool.query(migration);
  const repository = new PostgresMatchRepository(pool);
  const participants = { A: "test-player-a", B: "test-player-b" };
  const v2 = createMatchManifest({ gameId: "dino-dash", matchId: "test-v2", targetScore: 1000 });
  assert.equal(validateManifest(v2).ok, true);
  const savedV2 = await repository.createMatch(v2, participants);
  assert.deepEqual(savedV2.manifest, v2);
  assert.equal(savedV2.manifestHash, hashManifest(v2));

  const scenario = generateScenario({ game_id: v2.game_id, game_version: v2.game_version }, 17);
  const v3: MatchManifestV3 = {
    ...v2, match_id: "test-v3", manifest_version: 3,
    seed: scenario.seed, scenario: scenario.scenario,
  };
  assert.equal(validateManifest(v3).ok, false, "Existing HTTP acceptance stays V2");
  assert.equal(validateManifest(v3, { allowV3: true }).ok, true);
  const savedV3 = await repository.createMatch(v3, participants);
  const forA = await repository.findMatchForPlayer(v3.match_id, participants.A);
  const forB = await repository.findMatchForPlayer(v3.match_id, participants.B);
  assert.deepEqual(forA, savedV3);
  assert.deepEqual(forB, savedV3, "Both participants recover the identical manifest");
  assert.equal(await repository.findMatchForPlayer(v3.match_id, "outsider"), null);
  assert.equal(await repository.findMatchForPlayer("missing", participants.A), null);
  assert.equal(await repository.findMatchForPlayer(v3.match_id, "' OR TRUE --"), null);

  // Returned objects are detached snapshots, not a mutable in-memory authority.
  assert.ok(forA);
  forA.manifest.seed = "client-replacement";
  assert.deepEqual(await repository.findMatchForPlayer(v3.match_id, participants.A), savedV3);

  const retries = await Promise.all(Array.from({ length: 20 }, () =>
    repository.createMatch(v3, participants)));
  retries.forEach(value => assert.deepEqual(value, savedV3));
  const count = await pool.query("SELECT count(*)::int AS count FROM arena_matches WHERE match_id=$1", [v3.match_id]);
  assert.equal(count.rows[0].count, 1);

  const nextScenario = generateScenario({ game_id: v2.game_id, game_version: v2.game_version }, 18);
  await assert.rejects(repository.createMatch({ ...v3, seed: nextScenario.seed, scenario: nextScenario.scenario }, participants), hasCode("MATCH_CONFLICT"));
  await assert.rejects(repository.createMatch(v3, { A: participants.B, B: participants.A }), hasCode("MATCH_CONFLICT"));
  await assert.rejects(repository.createMatch({ ...v2, match_id: v3.match_id }, participants), hasCode("MATCH_CONFLICT"));
  await assert.rejects(repository.createMatch({ ...v3, seed: "arbitrary-seed" }, participants), hasCode("INVALID_MATCH"));
  await assert.rejects(repository.createMatch({ ...v3, scenario: { ...v3.scenario, generator_version: "9.0.0" } }, participants), hasCode("INVALID_MATCH"));
  await assert.rejects(repository.createMatch({ ...v3, match_id: "" }, participants), hasCode("INVALID_MATCH"));
  for (const invalid of [ { A: "same", B: "same" }, { A: " ", B: "valid" }, { A: "x".repeat(129), B: "valid" } ]) {
    await assert.rejects(repository.createMatch(v3, invalid), hasCode("INVALID_PARTICIPANTS"));
  }

  for (const sql of [
    "UPDATE arena_matches SET player_a='replacement' WHERE match_id=$1",
    "UPDATE arena_matches SET manifest=jsonb_set(manifest, '{seed}', '\"replacement\"'::jsonb) WHERE match_id=$1",
  ]) {
    await assert.rejects(pool.query(sql, [v3.match_id]), (error: unknown) =>
      typeof error === "object" && error !== null && "code" in error && error.code === "23514");
  }
  assert.deepEqual(await repository.findMatchForPlayer(v3.match_id, participants.A), savedV3);

  // Also exercise concurrent FIRST creation, rather than only retries.
  const race = { ...v3, match_id: "test-first-create-race" };
  const firstCreates = await Promise.all(Array.from({ length: 20 }, () => repository.createMatch(race, participants)));
  firstCreates.forEach(value => assert.deepEqual(value, firstCreates[0]));

  const reopenedPool = new Pool({ connectionString, max: 1, options: `-c search_path=${schema}` });
  try {
    assert.deepEqual(await new PostgresMatchRepository(reopenedPool).findMatchForPlayer(v3.match_id, participants.B), savedV3);
  } finally {
    await reopenedPool.end();
  }

  // Storage corruption must not be presented as a valid competitive manifest.
  await pool.query(
    "INSERT INTO arena_matches (match_id, manifest, manifest_hash, player_a, player_b) VALUES ($1,$2::jsonb,$3,$4,$5)",
    ["test-corrupt", JSON.stringify({ ...v3, match_id: "test-corrupt" }), `sha256:${"0".repeat(64)}`, participants.A, participants.B]
  );
  await assert.rejects(repository.findMatchForPlayer("test-corrupt", participants.A), hasCode("CORRUPT_MATCH"));

  if (!process.env.DATABASE_URL) {
    assert.throws(() => getProductionMatchRepository(), hasCode("DATABASE_NOT_CONFIGURED"));
  }
  console.log("PostgreSQL match repository: migration, V2/V3, membership, concurrency, immutability and persistence OK");
} finally {
  await pool.end();
  if (createdSchema) await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  await admin.end();
}
