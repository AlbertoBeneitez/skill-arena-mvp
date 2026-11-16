/**
 * v191 · Player accounts and their fictitious wallet on the server — registration as it will work for real players.
 *
 * - One account per sign-in identity. The identity is kept as HMAC(AUTH_SECRET, provider:subject) (`auth_key`): a
 *   database leak does not reveal anyone's Google/Apple/… account id.
 * - Public name unique by its folded form (accents and case ignored), reserved names refused (lib/accountRules.ts).
 * - Avatar: one of the app's portraits by number. Custom photos stay on the device.
 * - Balance (v193): the player's account in the double-entry ledger (lib/server/ledger.ts; competition entries and prizes
 *   move it too). The wallet statement below keeps the exchange movements. Every change locks the account row, so two requests at
 *   once cannot spend the same cosmicoins. Exchange € ↔ ₡ keeps 5 % (lib/wallet.ts), recorded as `fee_minor`.
 * - v193: every money movement is also posted to the double-entry ledger (lib/server/ledger.ts) in the same database
 *   transaction, and deleting an account anonymises it: the ledger is kept for the legal period.
 * - Fictitious only (`scope = 'fictitious'`): no payment provider is involved and nothing is redeemable.
 */
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { WELCOME_MINOR, foldName } from "@/lib/accountRules";
import { EXCHANGE_FEE_BPS } from "@/lib/wallet";
import type { Platform } from "@/lib/platform";
import { depositPostings, ledgerBalance, postTransaction, welcomePostings, withdrawPostings } from "./ledger";

export type Account = { id: string; name: string; avatar: number; platform: Platform; createdAt: string; balanceMinor: number };
export type Movement = { id: string; kind: "welcome" | "deposit" | "withdraw"; amountMinor: number; feeMinor: number; balanceAfter: number; at: string };
export class AccountError extends Error {
  constructor(readonly code: "NAME_TAKEN" | "ACCOUNT_EXISTS" | "NO_ACCOUNT" | "INSUFFICIENT_BALANCE" | "INVALID_AMOUNT") { super(code); }
}

/** Per-movement limits of the fictitious exchange: from 1 € to 500 €. */
export const EXCHANGE_LIMITS = { minMinor: 100, maxMinor: 50_000 } as const;

export const accountAuthKey = (provider: string, subject: string, secret: string) =>
  createHmac("sha256", secret).update(`account:v1:${provider}:${subject}`).digest("hex");

const toAccount = (r: Record<string, unknown>): Account => ({
  id: r.account_id as string, name: r.display_name as string, avatar: Number(r.avatar), platform: r.platform as Platform,
  createdAt: new Date(r.created_at as string).toISOString(), balanceMinor: Number(r.balance ?? 0),
});

const ACCOUNT_SELECT = `SELECT a.account_id, a.display_name, a.avatar, a.platform, a.created_at,
   COALESCE((SELECT sum(p.amount_minor) FROM arena_ledger_accounts l JOIN arena_ledger_postings p USING (ledger_account_id)
              WHERE l.kind = 'player' AND l.currency = 'CC' AND l.scope = 'fictitious' AND l.owner_account_id = a.account_id), 0) AS balance
   FROM arena_accounts a`;

export async function findAccount(db: Pick<Pool, "query">, authKey: string): Promise<Account | null> {
  const { rows } = await db.query(`${ACCOUNT_SELECT} WHERE a.auth_key = $1`, [authKey]);
  return rows[0] ? toAccount(rows[0]) : null;
}

async function inTransaction<T>(pool: Pool, work: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const out = await work(client);
    await client.query("COMMIT");
    return out;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

const isUnique = (e: unknown, constraint: string) =>
  typeof e === "object" && e !== null && (e as { code?: string }).code === "23505" && String((e as { constraint?: string }).constraint ?? "").includes(constraint);

/** Creates the account with its welcome balance. `name` and `avatar` must already be valid (lib/accountRules.ts). */
export async function createAccount(pool: Pool, authKey: string, name: string, avatar: number, platform: Platform): Promise<Account> {
  const id = randomUUID();
  try {
    await inTransaction(pool, async (c) => {
      await c.query(
        "INSERT INTO arena_accounts(account_id, auth_key, display_name, name_key, avatar, platform) VALUES ($1,$2,$3,$4,$5,$6)",
        [id, authKey, name, foldName(name), avatar, platform],
      );
      await c.query("INSERT INTO arena_wallet_entries(account_id, kind, amount_minor, balance_after) VALUES ($1,'welcome',$2,$2)", [id, WELCOME_MINOR]);
      await postTransaction(c, { kind: "welcome", accountId: id, requestKey: "welcome", postings: welcomePostings(id, WELCOME_MINOR) });
    });
  } catch (e) {
    if (isUnique(e, "name_key")) throw new AccountError("NAME_TAKEN");
    if (isUnique(e, "auth_key")) throw new AccountError("ACCOUNT_EXISTS");
    throw e;
  }
  return (await findAccount(pool, authKey))!;
}

export async function updateProfile(pool: Pool, authKey: string, change: { name?: string; avatar?: number }): Promise<Account> {
  try {
    const { rowCount } = await pool.query(
      `UPDATE arena_accounts SET display_name = COALESCE($2, display_name), name_key = COALESCE($3, name_key),
              avatar = COALESCE($4, avatar), updated_at = now() WHERE auth_key = $1`,
      [authKey, change.name ?? null, change.name ? foldName(change.name) : null, change.avatar ?? null],
    );
    if (!rowCount) throw new AccountError("NO_ACCOUNT");
  } catch (e) {
    if (isUnique(e, "name_key")) throw new AccountError("NAME_TAKEN");
    throw e;
  }
  return (await findAccount(pool, authKey))!;
}

/**
 * Right to erasure (v193): the account is anonymised, not deleted. Name, avatar and sign-in identity go; the row and its
 * money movements stay without a name for the legal retention period (decided by the owner on 15 Nov 2026; the period
 * itself is still to be confirmed with the lawyer). The name is free again and the person leaves every group.
 */
export async function deleteAccount(pool: Pool, authKey: string): Promise<boolean> {
  return inTransaction(pool, async (c) => {
    const found = await c.query("SELECT account_id FROM arena_accounts WHERE auth_key = $1 AND deleted_at IS NULL FOR UPDATE", [authKey]);
    if (!found.rows[0]) return false;
    const id = found.rows[0].account_id as string;
    await c.query(
      `UPDATE arena_accounts SET display_name = 'Cuenta borrada', name_key = $2, avatar = 1, auth_key = $3, deleted_at = now(), updated_at = now()
        WHERE account_id = $1`,
      [id, `deleted:${id}`, randomBytes(32).toString("hex")],
    );
    await c.query("UPDATE arena_group_members SET left_at = now() WHERE account_id = $1 AND left_at IS NULL", [id]);
    return true;
  });
}

export async function listMovements(pool: Pool, authKey: string, limit = 50): Promise<Movement[]> {
  const { rows } = await pool.query(
    `SELECT w.entry_id, w.kind, w.amount_minor, w.fee_minor, w.balance_after, w.created_at
       FROM arena_wallet_entries w JOIN arena_accounts a USING (account_id)
      WHERE a.auth_key = $1 ORDER BY w.entry_id DESC LIMIT $2`,
    [authKey, Math.min(Math.max(limit, 1), 200)],
  );
  return rows.map((r) => ({
    id: String(r.entry_id), kind: r.kind, amountMinor: Number(r.amount_minor), feeMinor: Number(r.fee_minor),
    balanceAfter: Number(r.balance_after), at: new Date(r.created_at).toISOString(),
  }));
}

/**
 * Fictitious exchange. "deposit": the player pays `amountMinor` euro cents and receives them minus 5 % as cosmicoins.
 * "withdraw": the player gives `amountMinor` cosmicoins and would receive them minus 5 % as euros. The same
 * `requestKey` never applies twice (a retried tap returns the first result).
 */
export async function exchangeFictitious(pool: Pool, authKey: string, direction: "deposit" | "withdraw", amountMinor: number, requestKey: string): Promise<{ account: Account; movement: Movement }> {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < EXCHANGE_LIMITS.minMinor || amountMinor > EXCHANGE_LIMITS.maxMinor) throw new AccountError("INVALID_AMOUNT");
  const fee = Math.round((amountMinor * EXCHANGE_FEE_BPS) / 10000);
  await inTransaction(pool, async (c) => {
    const acc = await c.query("SELECT account_id FROM arena_accounts WHERE auth_key = $1 FOR UPDATE", [authKey]);
    if (!acc.rows[0]) throw new AccountError("NO_ACCOUNT");
    const accountId = acc.rows[0].account_id as string;
    const done = await c.query("SELECT 1 FROM arena_wallet_entries WHERE account_id = $1 AND request_key = $2 AND kind = $3", [accountId, requestKey, direction]);
    if (done.rows[0]) return;
    const balance = await ledgerBalance(c, { kind: "player", accountId }, "CC");
    const delta = direction === "deposit" ? amountMinor - fee : -amountMinor;
    if (balance + delta < 0) throw new AccountError("INSUFFICIENT_BALANCE");
    await c.query(
      "INSERT INTO arena_wallet_entries(account_id, kind, amount_minor, fee_minor, balance_after, request_key) VALUES ($1,$2,$3,$4,$5,$6)",
      [accountId, direction, delta, fee, balance + delta, requestKey],
    );
    await postTransaction(c, {
      kind: direction, accountId, requestKey, detail: { amountMinor, feeMinor: fee },
      postings: direction === "deposit" ? depositPostings(accountId, amountMinor, fee) : withdrawPostings(accountId, amountMinor, fee),
    });
  });
  const { rows } = await pool.query(
    `SELECT w.entry_id, w.kind, w.amount_minor, w.fee_minor, w.balance_after, w.created_at
       FROM arena_wallet_entries w JOIN arena_accounts a USING (account_id)
      WHERE a.auth_key = $1 AND w.request_key = $2 AND w.kind = $3`,
    [authKey, requestKey, direction],
  );
  const r = rows[0];
  const movement: Movement = { id: String(r.entry_id), kind: r.kind, amountMinor: Number(r.amount_minor), feeMinor: Number(r.fee_minor), balanceAfter: Number(r.balance_after), at: new Date(r.created_at).toISOString() };
  return { account: (await findAccount(pool, authKey))!, movement };
}
