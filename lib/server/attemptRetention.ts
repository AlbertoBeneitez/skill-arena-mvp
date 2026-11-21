/**
 * v228 · Retention of match inputs (owner decision, 21-nov-2026): after 90 days a finished attempt keeps its result,
 * score, record hash and manifest, but its ordered inputs are replaced by a stub ({record_kind, pruned_at}). Rankings,
 * play counts, group results and the ledger do not change; only the replay detail goes. Migration 018 lets only this job
 * do it (SET LOCAL arena.retention = 'on'). Runs in small batches, at most once an hour per server instance, from the
 * start of a new match (no scheduled job, no extra cost).
 */
import type { Pool } from "pg";

export const ATTEMPT_RETENTION_DAYS = 90;
const BATCH = 500;
const EVERY_MS = 60 * 60 * 1000;
let lastRun = 0;

/** Prunes up to `batch` finished attempts older than `days`; returns how many. */
export async function pruneOldAttempts(pool: Pool, days = ATTEMPT_RETENTION_DAYS, batch = BATCH): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL arena.retention = 'on'");
    const r = await client.query(
      `UPDATE arena_public_attempts
          SET record = jsonb_build_object('record_kind', record->>'record_kind', 'pruned_at', clock_timestamp())
        WHERE attempt_id IN (
          SELECT attempt_id FROM arena_public_attempts
           WHERE record IS NOT NULL AND NOT (record ? 'pruned_at') AND state IN ('verified','rejected','forfeited')
             AND started_at < clock_timestamp() - $1 * interval '1 day'
           ORDER BY started_at LIMIT $2 FOR UPDATE SKIP LOCKED)`,
      [days, batch],
    );
    await client.query("COMMIT");
    return r.rowCount ?? 0;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Fire-and-forget hourly prune; never delays or fails the request that triggers it. */
export function maybePruneOldAttempts(pool: Pool, now = Date.now()) {
  if (now - lastRun < EVERY_MS) return;
  lastRun = now;
  void pruneOldAttempts(pool).catch(() => undefined);
}
