/** v191 · Accounts and fictitious wallet against local PostgreSQL. */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { cleanName, WELCOME_MINOR } from "../lib/accountRules";
import { applyMigrations } from "../lib/server/migrations";
import { ledgerBalance } from "../lib/server/ledger";
import { sessionAccountId } from "../lib/server/accountHttp";
import { encodeSession, SESSION_COOKIE } from "../lib/server/authSession";
import { AccountError, accountAuthKey, createAccount, deleteAccount, exchangeFictitious, findAccount, listMovements, recordPlays, updateProfile } from "../lib/server/accounts";

const connectionString = process.env.TEST_DATABASE_URL;
assert.ok(connectionString);
const url = new URL(connectionString);
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
assert.equal(url.pathname, "/skill_arena_test");
const schema = `qa_accounts_${randomBytes(8).toString("hex")}`,
  admin = new Pool({ connectionString, max: 1 }),
  pool = new Pool({ connectionString, max: 8, options: `-c search_path=${schema}` });
const code = async (p: Promise<unknown>) => { try { await p; return "ok"; } catch (e) { if (e instanceof AccountError) return e.code; throw e; } };
const SECRET = "x".repeat(40);
let created = false;
try {
  // Pure rules
  assert.equal(cleanName("  Mr   Beny "), "Mr Beny");
  assert.equal(cleanName("a"), null);
  assert.equal(cleanName("Admin"), null);
  assert.equal(cleanName("Galactic_Games"), null);
  assert.equal(cleanName("<script>"), null);
  const k1 = accountAuthKey("google", "sub-1", SECRET), k2 = accountAuthKey("google", "sub-2", SECRET);
  assert.match(k1, /^[0-9a-f]{64}$/);
  assert.notEqual(k1, accountAuthKey("apple", "sub-1", SECRET), "same subject, other provider: other account");

  await admin.query(`CREATE SCHEMA ${schema}`);
  created = true;
  await applyMigrations(pool);

  // Registration: welcome balance, unique names (case and accents ignored), one account per identity.
  const a = await createAccount(pool, k1, "Mr Beny", 3, "mobile");
  assert.equal(a.balanceMinor, WELCOME_MINOR);
  assert.equal(await code(createAccount(pool, k2, "mr bény", 4, "mobile")), "NAME_TAKEN");
  assert.equal(await code(createAccount(pool, k1, "Otro", 4, "mobile")), "ACCOUNT_EXISTS");
  const b = await createAccount(pool, k2, "Lucía", 7, "desktop");
  assert.equal(b.platform, "desktop");
  assert.equal(await findAccount(pool, accountAuthKey("google", "nobody", SECRET)), null);

  // Profile changes keep names unique.
  assert.equal(await code(updateProfile(pool, k2, { name: "MR BENY" })), "NAME_TAKEN");
  assert.equal((await updateProfile(pool, k2, { avatar: 9 })).avatar, 9);

  // Exchange: 5 % each way; idempotent per request; no overdraft, even with parallel requests.
  const dep = await exchangeFictitious(pool, k1, "deposit", 1000, "r1");
  assert.equal(dep.movement.amountMinor, 950);
  assert.equal(dep.movement.feeMinor, 50);
  assert.equal(dep.account.balanceMinor, WELCOME_MINOR + 950);
  const again = await exchangeFictitious(pool, k1, "deposit", 1000, "r1");
  assert.equal(again.account.balanceMinor, WELCOME_MINOR + 950, "a retried request applies once");
  assert.equal(await code(exchangeFictitious(pool, k1, "withdraw", 99, "w0")), "INVALID_AMOUNT");
  assert.equal(await code(exchangeFictitious(pool, k1, "withdraw", 50_001, "w0")), "INVALID_AMOUNT");
  const results = await Promise.all(Array.from({ length: 6 }, (_, i) => code(exchangeFictitious(pool, k1, "withdraw", 1000, `w${i + 1}`))));
  assert.equal(results.filter((r) => r === "ok").length, 3, "3 450 can pay three withdrawals of 1 000");
  assert.equal(results.filter((r) => r === "INSUFFICIENT_BALANCE").length, 3);
  assert.equal((await findAccount(pool, k1))!.balanceMinor, 450);
  const moves = await listMovements(pool, k1);
  assert.deepEqual(moves.map((m) => m.kind), ["withdraw", "withdraw", "withdraw", "deposit", "welcome"]);
  assert.equal(moves[0].feeMinor, 50);

  // The two ledgers agree: the player's statement and the double-entry ledger, and money is neither created nor lost.
  const aId = (await pool.query("SELECT account_id FROM arena_accounts WHERE auth_key = $1", [k1])).rows[0].account_id as string;
  assert.equal(await ledgerBalance(pool, { kind: "player", accountId: aId }, "CC"), 450);
  assert.equal(await ledgerBalance(pool, { kind: "house" }, "EUR"), 50 + 3 * 50, "5 % kept on the deposit and on three withdrawals");
  for (const currency of ["EUR", "CC"]) {
    const total = (await pool.query("SELECT COALESCE(sum(amount_minor),0)::int AS t FROM arena_ledger_postings WHERE currency = $1", [currency])).rows[0].t;
    assert.equal(total, 0, `${currency}: everything adds up to zero`);
  }
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM arena_ledger_transactions WHERE kind = 'deposit'")).rows[0].n, 1, "the retried deposit posted once");

  // v219: matches started per game, kept with the account; device counts only raise them.
  assert.deepEqual(await recordPlays(pool, k1, {}), {});
  assert.deepEqual(await recordPlays(pool, k1, { add: "darts" }), { darts: 1 });
  assert.deepEqual(await recordPlays(pool, k1, { add: "darts", atLeast: { bowling: 4, darts: 1 } }), { darts: 2, bowling: 4 }, "never lowered");
  assert.equal(await recordPlays(pool, "f".repeat(64), { add: "darts" }), null, "no account, nothing stored");

  // Erasure anonymises: the account and its movements stay, without a name or sign-in identity.
  await assert.rejects(pool.query("UPDATE arena_wallet_entries SET amount_minor = 1"), /immutable/);
  await assert.rejects(pool.query("DELETE FROM arena_accounts WHERE account_id = $1", [aId]), /anonymised, never deleted/);
  assert.equal(await deleteAccount(pool, k1), true);
  assert.equal(await deleteAccount(pool, k1), false, "already erased");
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM arena_play_counts WHERE account_id = $1", [aId])).rows[0].n, 0, "play counts go with the account");
  assert.equal(await findAccount(pool, k1), null);
  const gone = (await pool.query("SELECT display_name, name_key, avatar, deleted_at FROM arena_accounts WHERE account_id = $1", [aId])).rows[0];
  assert.equal(gone.display_name, "Cuenta borrada");
  assert.ok(gone.deleted_at);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM arena_wallet_entries WHERE account_id = $1", [aId])).rows[0].n, 5, "the movements are kept");
  assert.equal(await ledgerBalance(pool, { kind: "player", accountId: aId }, "CC"), 450, "and so is the ledger");
  assert.equal((await createAccount(pool, k1, "Mr Beny", 3, "mobile")).balanceMinor, WELCOME_MINOR, "the name is free again");
  // v195: the account behind a request comes only from the signed session cookie.
  process.env.AUTH_SECRET = SECRET;
  process.env.DATABASE_URL = `${connectionString}?options=${encodeURIComponent(`-c search_path=${schema}`)}`;
  const who = (sub: string, secret = SECRET) => new Request("http://x/api", { headers: { cookie: `${SESSION_COOKIE}=${encodeSession({ p: "google", sub, n: "N", iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 }, secret)}` } });
  const mine = await createAccount(pool, accountAuthKey("google", "sess-1", SECRET), "Sesion Uno", 2, "mobile");
  assert.equal(await sessionAccountId(who("sess-1")), mine.id, "a signed-in player is found by the session");
  assert.equal(await sessionAccountId(who("sess-unknown")), null, "no account yet: no person");
  assert.equal(await sessionAccountId(who("sess-1", "y".repeat(40))), null, "a cookie signed with another secret is ignored");
  assert.equal(await sessionAccountId(new Request("http://x/api")), null, "a guest has no person");
  console.log("Accounts: unique names, one per identity, 5 % exchange, idempotent, no overdraft, append-only ledger, double-entry ledger agrees, erasure anonymises");
} finally {
  await pool.end();
  if (created) await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  await admin.end();
}
