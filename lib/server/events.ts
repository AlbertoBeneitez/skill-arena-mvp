/**
 * v196 · Consent and event log (append-only). Events are written only for a signed-in account whose latest decision
 * is "granted" for the current consent version; the platform comes from the account, never from the browser.
 * A client may only send client-source kinds; server code records the server kinds.
 */
import type { Pool } from "pg";
import { ANALYTICS_CONSENT_VERSION, ANALYTICS_PURPOSE, EVENT_RETENTION_MONTHS, MAX_EVENTS_PER_REQUEST, cleanEventData, eventSource, eventTakesGame, isEventKind, type EventInput } from "@/lib/events";
import { getGameDefinition } from "@/lib/games";

type Db = Pick<Pool, "query">;
export type ConsentState = { granted: boolean; version: string | null; decidedAt: string | null; currentVersion: string };

export async function consentState(db: Db, accountId: string): Promise<ConsentState> {
  const { rows } = await db.query(
    `SELECT granted, version, decided_at FROM arena_consents WHERE account_id = $1 AND purpose = $2 ORDER BY consent_id DESC LIMIT 1`,
    [accountId, ANALYTICS_PURPOSE]);
  const r = rows[0];
  return { granted: Boolean(r?.granted) && r.version === ANALYTICS_CONSENT_VERSION, version: r?.version ?? null, decidedAt: r ? new Date(r.decided_at).toISOString() : null, currentVersion: ANALYTICS_CONSENT_VERSION };
}

/** Records a decision (a new row each time). Repeating the current decision writes nothing. */
export async function setConsent(db: Db, accountId: string, granted: boolean): Promise<ConsentState> {
  const now = await consentState(db, accountId);
  if (now.version === ANALYTICS_CONSENT_VERSION && now.granted === granted) return now;
  if (!granted && now.version === null) return now; // never agreed, nothing to withdraw
  await db.query(`INSERT INTO arena_consents (account_id, purpose, version, granted) VALUES ($1, $2, $3, $4)`, [accountId, ANALYTICS_PURPOSE, ANALYTICS_CONSENT_VERSION, granted]);
  return consentState(db, accountId);
}

/** Writes one event if the account agreed. Returns false when nothing was written (no consent, erased account, bad input). */
export async function recordEvent(db: Db, accountId: string, event: EventInput, source: "client" | "server"): Promise<boolean> {
  if (!isEventKind(event.kind) || eventSource(event.kind) !== source) return false;
  const data = cleanEventData(event.kind, event.data);
  if (!data) return false;
  let gameId: string | null = null, gameVersion: string | null = null;
  if (eventTakesGame(event.kind)) {
    const game = typeof event.gameId === "string" ? getGameDefinition(event.gameId) : undefined;
    if (!game) return false;
    gameId = game.id;
    gameVersion = typeof event.gameVersion === "string" && /^[A-Za-z0-9._-]{1,24}$/.test(event.gameVersion) ? event.gameVersion : null;
  } else if (event.gameId !== undefined) return false;
  const { rowCount } = await db.query(
    `INSERT INTO arena_events (account_id, source, kind, platform, game_id, game_version, consent_version, data)
     SELECT a.account_id, $2, $3, a.platform, $4, $5, c.version, $6::jsonb
       FROM arena_accounts a
       JOIN LATERAL (SELECT version, granted FROM arena_consents WHERE account_id = a.account_id AND purpose = $7 ORDER BY consent_id DESC LIMIT 1) c
         ON c.granted AND c.version = $8
      WHERE a.account_id = $1 AND a.deleted_at IS NULL`,
    [accountId, source, event.kind, gameId, gameVersion, JSON.stringify(data), ANALYTICS_PURPOSE, ANALYTICS_CONSENT_VERSION]);
  return rowCount === 1;
}

export async function recordClientEvents(db: Db, accountId: string, events: unknown): Promise<number> {
  if (!Array.isArray(events) || events.length === 0 || events.length > MAX_EVENTS_PER_REQUEST) return 0;
  let written = 0;
  for (const e of events) {
    if (!e || typeof e !== "object") continue;
    const { kind, gameId, gameVersion, data } = e as Record<string, unknown>;
    if (!isEventKind(kind)) continue;
    if (await recordEvent(db, accountId, { kind, gameId: gameId as string | undefined, gameVersion: gameVersion as string | undefined, data: data as Record<string, unknown> | undefined }, "client")) written++;
  }
  return written;
}

/** Rebuilds the daily summary for [from, to) UTC days from the events (safe to repeat). */
export async function rebuildDaily(pool: Pool, from: Date, to: Date): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM arena_event_daily WHERE day >= ($1::timestamptz AT TIME ZONE 'UTC')::date AND day < ($2::timestamptz AT TIME ZONE 'UTC')::date`, [from, to]);
    await client.query(
      `INSERT INTO arena_event_daily (day, platform, game_id, kind, events, players)
       SELECT (occurred_at AT TIME ZONE 'UTC')::date, platform, COALESCE(game_id, ''), kind, count(*)::int, count(DISTINCT account_id)::int
         FROM arena_events WHERE occurred_at >= $1 AND occurred_at < $2 GROUP BY 1, 2, 3, 4`, [from, to]);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
}

/** Retention: removes detailed events older than the period after rebuilding their daily summary, so the summary stays. */
export async function purgeEvents(pool: Pool, now: Date, months = EVENT_RETENTION_MONTHS): Promise<number> {
  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - months);
  const oldest = await pool.query(`SELECT min(occurred_at) AS t FROM arena_events WHERE occurred_at < $1`, [cutoff]);
  if (!oldest.rows[0]?.t) return 0;
  await rebuildDaily(pool, new Date(oldest.rows[0].t), cutoff);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL arena.retention = 'on'");
    const { rowCount } = await client.query(`DELETE FROM arena_events WHERE occurred_at < $1`, [cutoff]);
    await client.query("COMMIT");
    return rowCount ?? 0;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
}
