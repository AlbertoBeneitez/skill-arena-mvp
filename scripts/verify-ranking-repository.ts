import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { PostgresRankingRepository } from "../lib/server/postgresRankingRepository";
import { RankingRepositoryError } from "../lib/server/rankingRepository";
const connectionString = process.env.TEST_DATABASE_URL;
assert.ok(connectionString, "TEST_DATABASE_URL required");
const url = new URL(connectionString);
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
assert.equal(url.pathname, "/skill_arena_test");
const schema = `qa_ranking_${randomBytes(8).toString("hex")}`;
const admin = new Pool({ connectionString, max: 1 }),
  pool = new Pool({
    connectionString,
    max: 2,
    options: `-c search_path=${schema}`,
  });
let created = false;
try {
  await admin.query(`CREATE SCHEMA ${schema}`);
  created = true;
  // Explicitly fictional fixtures in an isolated local test schema, never production.
  await pool.query(`CREATE TABLE ranking_fixture(snapshot_id text,as_of timestamptz,player_id text,display_name text,net_profit_minor bigint,currency text);
 CREATE VIEW skill_arena_global_profit_ranking AS SELECT *,row_number() OVER(PARTITION BY snapshot_id,currency ORDER BY net_profit_minor DESC,player_id COLLATE "C" ASC)::bigint AS position FROM ranking_fixture`);
  const repository = new PostgresRankingRepository(pool);
  assert.deepEqual(
    (await repository.readGlobalNetProfit({ limit: 3, cursor: null })).entries,
    [],
  );
  for (const [id, name, profit] of [
    ["p-a", "Fixture A", "9007199254740993"],
    ["p-b", "Fixture B", "9007199254740993"],
    ["p-c", "Fixture C", "20000"],
    ["p-d", "Fixture D", "-5"],
    ["p-e", "Fixture E", "-20000"],
  ])
    await pool.query("INSERT INTO ranking_fixture VALUES($1,$2,$3,$4,$5,$6)", [
      "snapshot-old",
      "2026-01-01T00:00:00Z",
      id,
      name,
      profit,
      "EUR",
    ]);
  // Other currencies cannot contaminate the EUR ranking or latest-snapshot choice.
  await pool.query("INSERT INTO ranking_fixture VALUES($1,$2,$3,$4,$5,$6)", [
    "snapshot-other",
    "2026-03-01T00:00:00Z",
    "p-usd",
    "Fixture USD",
    "9223372036854775807",
    "USD",
  ]);
  const first = await repository.readGlobalNetProfit({
    limit: 2,
    cursor: null,
  });
  assert.equal(first.snapshotId, "snapshot-old");
  assert.deepEqual(
    first.entries.map((r) => r.playerId),
    ["p-a", "p-b"],
  );
  assert.equal(first.entries[0].netProfitMinor, "9007199254740993");
  assert.ok(first.nextCursor);
  await pool.query("INSERT INTO ranking_fixture VALUES($1,$2,$3,$4,$5,$6)", [
    "snapshot-new",
    "2026-02-01T00:00:00Z",
    "p-new",
    "Fixture new",
    "100000",
    "EUR",
  ]);
  const second = await repository.readGlobalNetProfit({
    limit: 2,
    cursor: first.nextCursor,
  });
  assert.equal(second.snapshotId, "snapshot-old");
  assert.deepEqual(
    second.entries.map((r) => r.position),
    [3, 4],
  );
  assert.deepEqual(
    second.entries.map((r) => r.playerId),
    ["p-c", "p-d"],
  );
  assert.ok(second.nextCursor);
  const last = await repository.readGlobalNetProfit({
    limit: 2,
    cursor: second.nextCursor,
  });
  assert.deepEqual(
    last.entries.map((r) => r.position),
    [5],
  );
  assert.equal(last.nextCursor, null);
  assert.equal(
    (await repository.readGlobalNetProfit({ limit: 2, cursor: null }))
      .snapshotId,
    "snapshot-new",
  );
  assert.equal(
    (await repository.findPlayerPosition("p-b", "snapshot-old"))?.position,
    2,
  );
  assert.equal(
    await repository.findPlayerPosition("missing", "snapshot-old"),
    null,
  );
  for (const cursor of [
    "invalid",
    "!",
    Buffer.from(
      JSON.stringify({
        version: 1,
        snapshotId: "missing",
        profit: "1",
        playerId: "p-a",
      }),
    ).toString("base64url"),
    Buffer.from(
      JSON.stringify({
        version: 1,
        snapshotId: "snapshot-old",
        profit: "9223372036854775808",
        playerId: "p-a",
      }),
    ).toString("base64url"),
  ])
    await assert.rejects(
      () => repository.readGlobalNetProfit({ limit: 2, cursor }),
      (e) =>
        e instanceof RankingRepositoryError &&
        e.code === "INVALID_RANKING_CURSOR",
    );
  await assert.rejects(
    () => repository.findPlayerPosition("' OR 1=1"),
    RankingRepositoryError,
  );
  await pool.query(
    "UPDATE ranking_fixture SET display_name=$1 WHERE player_id=$2",
    ["", "p-new"],
  );
  await assert.rejects(
    () => repository.readGlobalNetProfit({ limit: 2, cursor: null }),
    (e) => e instanceof RankingRepositoryError && e.code === "CORRUPT_RANKING",
  );
  // Optional avatar metadata is backwards compatible with the original public view.
  await pool.query(
    "UPDATE ranking_fixture SET display_name='Fixture new' WHERE player_id='p-new'",
  );
  await pool.query("ALTER TABLE ranking_fixture ADD COLUMN avatar_key text");
  await pool.query(`DROP VIEW skill_arena_global_profit_ranking;
   CREATE VIEW skill_arena_global_profit_ranking AS SELECT *,row_number() OVER(PARTITION BY snapshot_id,currency ORDER BY net_profit_minor DESC,player_id COLLATE "C" ASC)::bigint AS position FROM ranking_fixture`);
  await pool.query(
    "UPDATE ranking_fixture SET avatar_key='avatar-3' WHERE player_id='p-new'",
  );
  assert.equal(
    (await repository.readGlobalNetProfit({ limit: 2, cursor: null }))
      .entries[0].avatarKey,
    "avatar-3",
  );
  assert.equal(
    (await repository.findPlayerPosition("p-new"))?.avatarKey,
    "avatar-3",
  );
  await pool.query(
    "UPDATE ranking_fixture SET avatar_key=$1 WHERE player_id='p-new'",
    ["https://tracker.invalid/avatar"],
  );
  await assert.rejects(
    () => repository.readGlobalNetProfit({ limit: 2, cursor: null }),
    (e) => e instanceof RankingRepositoryError && e.code === "CORRUPT_RANKING",
  );
  console.log(
    "PostgreSQL ranking: exact bigint ordering/ties, immutable-cursor pages, currency separation, player position and invalid data passed",
  );
} finally {
  await pool.end();
  if (created) await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  await admin.end();
}
