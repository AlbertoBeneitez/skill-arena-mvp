/**
 * v192 · Automatic database migrations (owner, 15-nov: «tiene que ser un proceso automático»). Each server instance
 * applies the bundled migrations (lib/server/migrationsBundle.ts) once when it starts (instrumentation.ts):
 *
 * - One instance at a time: a transaction advisory lock serialises instances starting together.
 * - All pending migrations run in one transaction; each is recorded in `arena_schema_migrations` with its SHA-256; an
 *   applied migration whose file changed is refused (published schema is immutable, like published games).
 * - Additive only: SQL that drops tables, columns, constraints or data is refused here — that kind of change needs the
 *   owner (AGENTS.md › Autonomy, destructive migrations).
 * - Migrations 001–007 are idempotent, so a database where they were pasted by hand just gets them recorded.
 * A failure is logged and leaves the app running: features that need the new tables stay off until it is fixed.
 */
import type { Pool } from "pg";
import { MIGRATIONS, type BundledMigration } from "./migrationsBundle";

const LOCK = 19462816;
const DESTRUCTIVE = /\bDROP\s+(TABLE|COLUMN|SCHEMA|DATABASE|VIEW|TYPE|INDEX)\b|\bTRUNCATE\b|\bDELETE\s+FROM\b|\bALTER\s+TABLE\s+\S+\s+DROP\s+(COLUMN|CONSTRAINT)\b/i;

export class MigrationError extends Error {}

export function assertAdditive(m: Pick<BundledMigration, "file" | "sql">) {
  // Function bodies may legitimately contain words like DELETE in comments; only plain SQL is checked.
  const plain = m.sql.replace(/\$\$[\s\S]*?\$\$/g, "").replace(/--[^\n]*/g, "");
  if (DESTRUCTIVE.test(plain)) throw new MigrationError(`${m.file}: destructive SQL is not applied automatically`);
}

/**
 * Applies pending migrations; returns the ids it applied. Everything happens in ONE transaction holding a
 * transaction-level advisory lock: safe behind Neon's pooled endpoint (PgBouncer in transaction mode keeps a
 * transaction on one server connection, but a session lock could outlive its client there and block the next start).
 * All pending migrations apply together or not at all.
 */
export async function applyMigrations(pool: Pool, list: readonly BundledMigration[] = MIGRATIONS): Promise<string[]> {
  for (const m of list) assertAdditive(m);
  const client = await pool.connect();
  const applied: string[] = [];
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [LOCK]);
    await client.query(`CREATE TABLE IF NOT EXISTS arena_schema_migrations (
      id text PRIMARY KEY, file text NOT NULL, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`);
    const { rows } = await client.query("SELECT id, sha256 FROM arena_schema_migrations");
    const done = new Map(rows.map((r) => [r.id as string, r.sha256 as string]));
    for (const m of list) {
      const sha = done.get(m.id);
      if (sha === m.sha256) continue;
      if (sha) throw new MigrationError(`${m.file}: already applied with different content`);
      await client.query(m.sql);
      await client.query("INSERT INTO arena_schema_migrations(id, file, sha256) VALUES ($1,$2,$3)", [m.id, m.file, m.sha256]);
      applied.push(m.id);
    }
    await client.query("COMMIT");
    return applied;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** The newest migration recorded in the database, or null. For /api/health. */
export async function schemaVersion(pool: Pool): Promise<string | null> {
  try {
    const { rows } = await pool.query("SELECT max(id) AS id FROM arena_schema_migrations");
    return (rows[0]?.id as string | null) ?? null;
  } catch {
    return null;
  }
}
