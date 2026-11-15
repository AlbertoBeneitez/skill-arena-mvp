/** v191 · Accounts and fictitious wallet against local PostgreSQL. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { cleanName, WELCOME_MINOR } from "../lib/accountRules";
import { AccountError, accountAuthKey, createAccount, deleteAccount, exchangeFictitious, findAccount, listMovements, updateProfile } from "../lib/server/accounts";

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
  for (let i = 0; i < 2; i++) await pool.query(await readFile("db/migrations/007-accounts.sql", "utf8"));

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

  // The ledger is append-only; erasure removes the account and its ledger.
  await assert.rejects(pool.query("UPDATE arena_wallet_entries SET amount_minor = 1"), /immutable/);
  assert.equal(await deleteAccount(pool, k1), true);
  assert.equal(await findAccount(pool, k1), null);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM arena_wallet_entries")).rows[0].n, 1, "only Lucía's welcome entry is left");
  assert.equal((await createAccount(pool, k1, "Mr Beny", 3, "mobile")).balanceMinor, WELCOME_MINOR, "the name is free again");
  console.log("Accounts: unique names, one per identity, 5 % exchange, idempotent, no overdraft, append-only ledger, erasure");
} finally {
  await pool.end();
  if (created) await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  await admin.end();
}
