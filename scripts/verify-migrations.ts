/** v192 · Automatic migrations against local PostgreSQL: once, recorded, idempotent, tamper-proof, additive only. */
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { Pool } from "pg";
import { MigrationError, applyMigrations, assertAdditive, schemaVersion } from "../lib/server/migrations";
import { MIGRATIONS } from "../lib/server/migrationsBundle";

// The bundle matches db/migrations exactly (run node scripts/build-migrations.mjs after changing a migration).
const files = readdirSync("db/migrations").filter((f) => /^\d{3}-.*\.sql$/.test(f)).sort();
assert.deepEqual(MIGRATIONS.map((m) => m.file), files);
for (const m of MIGRATIONS) assert.equal(m.sha256, createHash("sha256").update(readFileSync(`db/migrations/${m.file}`, "utf8")).digest("hex"), m.file);
// Additive guard.
for (const m of MIGRATIONS) assertAdditive(m);
for (const bad of ["DROP TABLE arena_accounts;", "ALTER TABLE x DROP COLUMN y;", "TRUNCATE arena_matches;", "DELETE FROM arena_accounts;", "alter table x drop constraint y;"])
  assert.throws(() => assertAdditive({ file: "x.sql", sql: bad }), MigrationError, bad);
assertAdditive({ file: "ok.sql", sql: "ALTER TABLE x ALTER COLUMN y DROP NOT NULL; DROP TRIGGER IF EXISTS t ON x;" });

const connectionString = process.env.TEST_DATABASE_URL;
assert.ok(connectionString);
const url = new URL(connectionString);
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
assert.equal(url.pathname, "/skill_arena_test");
const schema = `qa_migr_${randomBytes(8).toString("hex")}`, schema2 = `${schema}_hand`,
  admin = new Pool({ connectionString, max: 1 }),
  pool = new Pool({ connectionString, max: 4, options: `-c search_path=${schema}` }),
  hand = new Pool({ connectionString, max: 4, options: `-c search_path=${schema2}` });
let created = false;
try {
  await admin.query(`CREATE SCHEMA ${schema}`);
  await admin.query(`CREATE SCHEMA ${schema2}`);
  created = true;
  // Fresh database: everything once, two instances starting together do not collide.
  const [a, b] = await Promise.all([applyMigrations(pool), applyMigrations(pool)]);
  assert.deepEqual([...a, ...b].sort(), MIGRATIONS.map((m) => m.id));
  assert.deepEqual(await applyMigrations(pool), [], "second start applies nothing");
  assert.equal(await schemaVersion(pool), MIGRATIONS[MIGRATIONS.length - 1].id);
  // A database where 001–006 were pasted by hand (Neon, 12-nov): they are recorded, 007 is applied.
  for (const m of MIGRATIONS.slice(0, 6)) await hand.query(m.sql);
  assert.deepEqual(await applyMigrations(hand), MIGRATIONS.map((m) => m.id));
  assert.ok((await hand.query("SELECT to_regclass('arena_accounts') AS t")).rows[0].t);
  // A changed migration is refused.
  await pool.query("UPDATE arena_schema_migrations SET sha256 = 'x' WHERE id = '007'");
  await assert.rejects(applyMigrations(pool), /already applied with different content/);
  await pool.query("UPDATE arena_schema_migrations SET sha256 = $1 WHERE id = '007'", [MIGRATIONS[6].sha256]);
  // A failing migration leaves nothing behind: all pending ones apply together or not at all.
  const extra = [...MIGRATIONS, { id: "008", file: "008-ok.sql", sha256: "a", sql: "CREATE TABLE qa_ok(x int);" },
    { id: "009", file: "009-bad.sql", sha256: "b", sql: "SELECT qa_missing_function();" }];
  await assert.rejects(applyMigrations(pool, extra));
  assert.equal((await pool.query("SELECT to_regclass('qa_ok') AS t")).rows[0].t, null);
  assert.equal(await schemaVersion(pool), "007");
  console.log("Migrations: applied once by itself, parallel-safe, records hand-applied ones, all-or-nothing, refuses changed or destructive SQL");
} finally {
  await pool.end();
  await hand.end();
  if (created) { await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.query(`DROP SCHEMA ${schema2} CASCADE`); }
  await admin.end();
}
