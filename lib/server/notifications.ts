/**
 * v230 · In-app notices on the server (db/migrations/020-notifications.sql).
 *
 * The facts are decided elsewhere (lib/server/groups.ts: a challenge accepted, a matchday or competition starting, a
 * matchday or competition won); this module only files the notice for each person, in the same transaction and
 * behind a savepoint, so a notice can never undo or block the fact itself. What a person turned off is not filed.
 * Notices are kept 30 days (pruned when the inbox is read) and leave with the account (deleteAccount).
 */
import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import {
  cleanNoticeSettings, DEFAULT_NOTICE_SETTINGS, NOTICE_KINDS, topicOf,
  type Notice, type NoticeData, type NoticeInbox, type NoticeKind, type NoticeSettings,
} from "@/lib/notices";

export type NoticeDraft = { accountId: string; kind: NoticeKind; data: NoticeData; key: string };
export const NOTICE_RETENTION_DAYS = 30;
const INBOX_SIZE = 50;

/** Files notices inside the caller's transaction. Never throws: on any failure the notices are dropped, not the fact. */
export async function addNotices(c: PoolClient, drafts: readonly NoticeDraft[]): Promise<void> {
  if (!drafts.length) return;
  await c.query("SAVEPOINT notices");
  try {
    const ids = [...new Set(drafts.map((d) => d.accountId))];
    const { rows } = await c.query("SELECT account_id, settings FROM arena_notification_settings WHERE account_id = ANY($1::uuid[])", [ids]);
    const prefs = new Map<string, NoticeSettings>(rows.map((r) => [r.account_id as string, cleanNoticeSettings(r.settings)]));
    for (const d of drafts) {
      if (!(prefs.get(d.accountId) ?? DEFAULT_NOTICE_SETTINGS).topics[topicOf(d.kind)]) continue;
      await c.query(
        // clock_timestamp(), not now(): several notices of one transaction keep the order of the facts (matchday won,
        // then competition won), so the inbox lists them newest first correctly.
        `INSERT INTO arena_notifications(notification_id, account_id, kind, data, dedupe_key, created_at)
         SELECT $1, $2, $3, $4::jsonb, $5, clock_timestamp() WHERE EXISTS (SELECT 1 FROM arena_accounts WHERE account_id = $2 AND deleted_at IS NULL)
         ON CONFLICT (account_id, dedupe_key) DO NOTHING`,
        [randomUUID(), d.accountId, d.kind, JSON.stringify(d.data), d.key.slice(0, 200)],
      );
    }
    await c.query("RELEASE SAVEPOINT notices");
  } catch {
    await c.query("ROLLBACK TO SAVEPOINT notices").catch(() => undefined);
  }
}

const settingsOf = async (q: Pick<Pool, "query">, accountId: string) =>
  cleanNoticeSettings((await q.query("SELECT settings FROM arena_notification_settings WHERE account_id = $1", [accountId])).rows[0]?.settings);

/** The latest notices (newest first), how many are unread, and the person's settings. Prunes their old notices. */
export async function noticeInbox(pool: Pool, accountId: string): Promise<NoticeInbox> {
  await pool.query("DELETE FROM arena_notifications WHERE account_id = $1 AND created_at < now() - $2 * interval '1 day'", [accountId, NOTICE_RETENTION_DAYS]);
  const [list, unread, settings] = await Promise.all([
    pool.query(
      "SELECT notification_id, kind, data, created_at, read_at FROM arena_notifications WHERE account_id = $1 ORDER BY created_at DESC, notification_id LIMIT $2",
      [accountId, INBOX_SIZE]),
    pool.query("SELECT count(*)::int AS n FROM arena_notifications WHERE account_id = $1 AND read_at IS NULL", [accountId]),
    settingsOf(pool, accountId),
  ]);
  const notices: Notice[] = list.rows
    .filter((r) => (NOTICE_KINDS as readonly string[]).includes(r.kind))
    .map((r) => ({ id: r.notification_id, kind: r.kind, data: r.data as NoticeData, createdAt: new Date(r.created_at).toISOString(), read: r.read_at !== null }));
  // Push to the phone needs keys the owner sets in Vercel; until then «Móvil» is shown as not available yet.
  return { notices, unread: unread.rows[0].n, settings, phoneAvailable: false };
}

/** Marks some (or all) of the person's notices as read. Ids of other people are ignored. */
export async function markNoticesRead(pool: Pool, accountId: string, ids: readonly string[] | "all"): Promise<void> {
  if (ids === "all") await pool.query("UPDATE arena_notifications SET read_at = now() WHERE account_id = $1 AND read_at IS NULL", [accountId]);
  else if (ids.length)
    await pool.query("UPDATE arena_notifications SET read_at = now() WHERE account_id = $1 AND read_at IS NULL AND notification_id = ANY($2::uuid[])", [accountId, ids]);
}

export async function saveNoticeSettings(pool: Pool, accountId: string, raw: unknown): Promise<NoticeSettings> {
  const settings = cleanNoticeSettings(raw);
  await pool.query(
    `INSERT INTO arena_notification_settings(account_id, settings) VALUES ($1, $2::jsonb)
     ON CONFLICT (account_id) DO UPDATE SET settings = EXCLUDED.settings, updated_at = now()`,
    [accountId, JSON.stringify(settings)]);
  return settings;
}
