/** v196 · Consent and event log: catalogue, consent rules, append-only, retention, daily summary, match view. */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { ANALYTICS_CONSENT_VERSION, EVENT_CATALOG, cleanEventData, isEventKind } from "../lib/events";
import { accountAuthKey, createAccount, deleteAccount } from "../lib/server/accounts";
import { consentState, purgeEvents, rebuildDaily, recordClientEvents, recordEvent, setConsent } from "../lib/server/events";
import { applyMigrations } from "../lib/server/migrations";

const connectionString = process.env.TEST_DATABASE_URL;
assert.ok(connectionString);
const url = new URL(connectionString);
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
assert.equal(url.pathname, "/skill_arena_test");
const schema = `qa_events_${randomBytes(8).toString("hex")}`,
  admin = new Pool({ connectionString, max: 1 }),
  pool = new Pool({ connectionString, max: 4, options: `-c search_path=${schema}` });
const SECRET = "z".repeat(40);
const count = async (where = "true") => (await pool.query(`SELECT count(*)::int AS n FROM arena_events WHERE ${where}`)).rows[0].n as number;
const fails = async (sql: string, text: RegExp) => { try { await pool.query(sql); } catch (e) { assert.match(String((e as Error).message), text); return; } assert.fail(`expected failure: ${sql}`); };
let created = false;
try {
  // Catalogue (pure)
  assert.ok(isEventKind("screen_view") && !isEventKind("anything"));
  assert.deepEqual(cleanEventData("screen_view", { screen: "games" }), { screen: "games" });
  assert.equal(cleanEventData("screen_view", { screen: "games", extra: 1 }), null, "extra fields");
  assert.equal(cleanEventData("screen_view", { screen: "hello world" }), null, "no free text");
  assert.equal(cleanEventData("screen_view", {}), null, "missing field");
  assert.equal(cleanEventData("game_left", { ms: -1 }), null);
  assert.equal(cleanEventData("game_left", { ms: 1.5 }), null);
  assert.deepEqual(cleanEventData("game_opened", undefined), {});
  assert.ok(Object.keys(EVENT_CATALOG).length >= 9);

  await admin.query(`CREATE SCHEMA ${schema}`);
  created = true;
  await applyMigrations(pool);
  const a = await createAccount(pool, accountAuthKey("google", "ev-a", SECRET), "Medida Uno", 1, "mobile");
  const d = await createAccount(pool, accountAuthKey("google", "ev-d", SECRET), "Medida Dos", 2, "desktop");

  // No decision yet: nothing is recorded
  assert.equal(await recordEvent(pool, a.id, { kind: "screen_view", data: { screen: "games" } }, "client"), false);
  assert.equal(await count(), 0);
  assert.equal((await consentState(pool, a.id)).granted, false);
  assert.equal((await setConsent(pool, a.id, false)).version, null, "withdrawing what was never given writes nothing");

  // Granted: recorded, with the platform of the account
  assert.equal((await setConsent(pool, a.id, true)).granted, true);
  assert.equal((await setConsent(pool, d.id, true)).granted, true);
  assert.equal(await recordEvent(pool, a.id, { kind: "screen_view", data: { screen: "games" } }, "client"), true);
  assert.equal(await recordEvent(pool, d.id, { kind: "screen_view", data: { screen: "groups" } }, "client"), true);
  assert.deepEqual((await pool.query("SELECT platform FROM arena_events ORDER BY event_id")).rows.map((r) => r.platform), ["mobile", "desktop"]);
  assert.equal((await pool.query("SELECT consent_version FROM arena_events LIMIT 1")).rows[0].consent_version, ANALYTICS_CONSENT_VERSION);
  assert.equal(await recordEvent(pool, a.id, { kind: "game_opened", gameId: "billiards", gameVersion: "7.0.0" }, "client"), true);
  assert.equal(await recordEvent(pool, a.id, { kind: "game_opened", gameId: "no-such-game" }, "client"), false, "unknown game");
  assert.equal(await recordEvent(pool, a.id, { kind: "screen_view", gameId: "billiards", data: { screen: "x" } }, "client"), false, "a game on a kind without game");
  assert.equal(await recordEvent(pool, a.id, { kind: "group_created" }, "client"), false, "a client cannot write server kinds");
  assert.equal(await recordEvent(pool, a.id, { kind: "group_created" }, "server"), true);
  assert.equal(await recordEvent(pool, a.id, { kind: "screen_view", data: { screen: "games" } }, "server"), false, "and the server does not write client kinds");
  assert.equal(await recordClientEvents(pool, a.id, [{ kind: "screen_view", data: { screen: "ranking" } }, { kind: "bad" }, null, { kind: "screen_view", data: { screen: "a b" } }]), 1, "a batch keeps only valid events");
  assert.equal(await recordClientEvents(pool, a.id, Array.from({ length: 21 }, () => ({ kind: "game_opened", gameId: "billiards" }))), 0, "a batch is bounded");

  // Withdrawn: stops at once, history stays, decisions are a trail
  const before = await count();
  assert.equal((await setConsent(pool, a.id, false)).granted, false);
  assert.equal(await recordEvent(pool, a.id, { kind: "screen_view", data: { screen: "games" } }, "client"), false);
  assert.equal(await count(), before);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM arena_consents WHERE account_id = $1", [a.id])).rows[0].n, 2);
  await setConsent(pool, a.id, true);

  // Append-only
  await fails("UPDATE arena_events SET kind = 'screen_view'", /append-only/);
  await fails("DELETE FROM arena_events", /append-only/);
  await fails("UPDATE arena_consents SET granted = false", /append-only/);
  await fails("DELETE FROM arena_consents", /append-only/);

  // Match behaviour comes from verified attempts, never copied: the view
  await pool.query("INSERT INTO arena_matches(match_id, manifest, manifest_hash, player_a) VALUES ('mv1', $1::jsonb, $2, 'dev')", [JSON.stringify({ match_id: "mv1", manifest_version: "3", game_id: "billiards", game_version: "7.0.0" }), `sha256:${"0".repeat(64)}`]);
  await pool.query("INSERT INTO arena_public_matches(match_id, policy_version, scope, expires_at, platform) VALUES ('mv1','forfeit-on-disconnect-v1','training', now() + interval '1 day', 'desktop')");
  await pool.query(`INSERT INTO arena_public_attempts(attempt_id, match_id, player_id, slot, start_key, request_hash, ticket, state, lease_until, deadline, response, account_id)
    VALUES ('av1','mv1','dev','A','av1','h','{}'::jsonb,'verified', now() + interval '1 day', now() + interval '1 day', '{"score": 42, "authoritative_source": "SERVER_REPLAY"}'::jsonb, $1)`, [d.id]);
  const row = (await pool.query("SELECT game_id, game_version, platform, state, score, authoritative_source, abandoned FROM arena_player_matches WHERE account_id = $1", [d.id])).rows[0];
  assert.deepEqual(row, { game_id: "billiards", game_version: "7.0.0", platform: "desktop", state: "verified", score: 42, authoritative_source: "SERVER_REPLAY", abandoned: null });

  // Daily summary is rebuilt from events; retention keeps it
  const day = (await pool.query("SELECT date_trunc('day', now() AT TIME ZONE 'UTC') AS d")).rows[0].d as Date;
  const from = new Date(day.getTime() - 86_400_000), to = new Date(day.getTime() + 2 * 86_400_000);
  await rebuildDaily(pool, from, to);
  const first = (await pool.query("SELECT day, platform, game_id, kind, events, players FROM arena_event_daily ORDER BY platform, kind, game_id")).rows;
  await rebuildDaily(pool, from, to);
  assert.deepEqual((await pool.query("SELECT day, platform, game_id, kind, events, players FROM arena_event_daily ORDER BY platform, kind, game_id")).rows, first, "rebuilding is repeatable");
  assert.equal(first.find((r) => r.platform === "mobile" && r.kind === "screen_view")?.events, 2);
  await pool.query("ALTER TABLE arena_events DISABLE TRIGGER arena_events_guard");
  await pool.query("UPDATE arena_events SET occurred_at = now() - interval '13 months' WHERE kind = 'screen_view' AND platform = 'desktop'");
  await pool.query("ALTER TABLE arena_events ENABLE TRIGGER arena_events_guard");
  const removed = await purgeEvents(pool, new Date());
  assert.equal(removed, 1, "only events past the retention period go");
  assert.equal(await count("platform = 'desktop'"), 0);
  assert.ok((await pool.query("SELECT 1 FROM arena_event_daily WHERE platform = 'desktop' AND kind = 'screen_view' AND day < (now() - interval '12 months')::date")).rowCount === 1, "their daily summary stays");
  assert.equal(await purgeEvents(pool, new Date()), 0, "nothing more to purge");

  // Erased account: no more events, consent trail remains
  assert.equal(await deleteAccount(pool, accountAuthKey("google", "ev-a", SECRET)), true);
  assert.equal(await recordEvent(pool, a.id, { kind: "screen_view", data: { screen: "games" } }, "client"), false);
  console.log("Events: consent trail, catalogue-only events, platform from the account, append-only, match view, repeatable summary, retention keeps the summary");
} finally {
  await pool.end();
  if (created) await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  await admin.end();
}
