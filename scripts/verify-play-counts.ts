/** v186 · Monthly counted matches against local PostgreSQL: verified only, per month, capped per player/game/day. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { monthRange, monthlyPlayCounts } from "../lib/server/playCounts";

const connectionString = process.env.TEST_DATABASE_URL;
assert.ok(connectionString);
const url = new URL(connectionString);
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
assert.equal(url.pathname, "/skill_arena_test");
const schema = `qa_plays_${randomBytes(8).toString("hex")}`,
  admin = new Pool({ connectionString, max: 1 }),
  pool = new Pool({ connectionString, max: 4, options: `-c search_path=${schema}` });
let created = false, n = 0;
async function play(gameId: string, player: string, at: string, state = "verified") {
  const id = `m${n++}`;
  await pool.query(
    "INSERT INTO arena_matches(match_id,manifest,manifest_hash,player_a) VALUES($1,$2,$3,$4)",
    [id, JSON.stringify({ match_id: id, manifest_version: "3", game_id: gameId }), "sha256:" + "0".repeat(64), player],
  );
  await pool.query("INSERT INTO arena_public_matches(match_id,policy_version,scope,expires_at) VALUES($1,'forfeit-on-disconnect-v1','training',now())", [id]);
  await pool.query(
    `INSERT INTO arena_public_attempts(attempt_id,match_id,player_id,slot,start_key,request_hash,ticket,state,lease_until,deadline,record_received_at)
     VALUES($1,$2,$3,'A',$1,'h','{}',$4,now(),now(),$5)`,
    [`a-${id}`, id, player, state, at],
  );
}
try {
  await admin.query(`CREATE SCHEMA ${schema}`);
  created = true;
  for (const f of ["001-matches.sql", "003-public-attempts.sql", "006-platform-pools.sql"]) await pool.query(await readFile(`db/migrations/${f}`, "utf8"));
  assert.deepEqual(monthRange("2026-11")?.map((d) => d.toISOString()), ["2026-11-01T00:00:00.000Z", "2026-12-01T00:00:00.000Z"]);
  assert.equal(monthRange("2026-13"), null);
  for (let i = 0; i < 25; i++) await play("slot", "p1", "2026-11-05T10:00:00Z");   // capped at 20
  for (let i = 0; i < 3; i++) await play("slot", "p1", "2026-11-06T10:00:00Z");    // another day
  await play("slot", "p2", "2026-11-05T23:59:59Z");
  await play("nova-run", "p2", "2026-11-30T23:59:59Z");
  await play("nova-run", "p3", "2026-12-01T00:00:00Z");                           // next month
  await play("nova-run", "p3", "2026-11-10T00:00:00Z", "rejected");               // not verified
  await play("nova-run", "p4", "2026-11-11T00:00:00Z", "forfeited");              // abandoned
  const counts = await monthlyPlayCounts(pool, "2026-11");
  assert.deepEqual(counts, [{ gameId: "slot", plays: 24, players: 2 }, { gameId: "nova-run", plays: 1, players: 1 }]);
  assert.deepEqual(await monthlyPlayCounts(pool, "2026-12"), [{ gameId: "nova-run", plays: 1, players: 1 }]);
  console.log("Play counts: verified only, calendar month in UTC, at most 20 per player, game and day");
} finally {
  await pool.end();
  if (created) await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  await admin.end();
}
