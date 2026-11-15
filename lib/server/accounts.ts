/**
 * v191 · Player accounts and their fictitious wallet on the server — registration as it will work for real players.
 *
 * - One account per sign-in identity. The identity is kept as HMAC(AUTH_SECRET, provider:subject) (`auth_key`): a
 *   database leak does not reveal anyone's Google/Apple/… account id.
 * - Public name unique by its folded form (accents and case ignored), reserved names refused (lib/accountRules.ts).
 * - Avatar: one of the app's portraits by number. Custom photos stay on the device.
 * - Balance: the last `balance_after` of an append-only ledger; every change locks the account row, so two requests at
 *   once cannot spend the same cosmicoins. Exchange € ↔ ₡ keeps 5 % (lib/wallet.ts), recorded as `fee_minor`.
 * - Fictitious only (`scope = 'fictitious'`): no payment provider is involved and nothing is redeemable.
 */
import { createHmac, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { WELCOME_MINOR, foldName } from "@/lib/accountRules";
import { EXCHANGE_FEE_BPS } from "@/lib/wallet";
import type { Platform } from "@/lib/platform";

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
   COALESCE((SELECT balance_after FROM arena_wallet_entries w WHERE w.account_id = a.account_id ORDER BY entry_id DESC LIMIT 1), 0) AS balance
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

/** Right to erasure: the account and its whole ledger go (ON DELETE CASCADE). */
export async function deleteAccount(pool: Pool, authKey: string): Promise<boolean> {
  const { rowCount } = await pool.query("DELETE FROM arena_accounts WHERE auth_key = $1", [authKey]);
  return (rowCount ?? 0) > 0;
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
    const last = await c.query("SELECT balance_after FROM arena_wallet_entries WHERE account_id = $1 ORDER BY entry_id DESC LIMIT 1", [accountId]);
    const balance = Number(last.rows[0]?.balance_after ?? 0);
    const delta = direction === "deposit" ? amountMinor - fee : -amountMinor;
    if (balance + delta < 0) throw new AccountError("INSUFFICIENT_BALANCE");
    await c.query(
      "INSERT INTO arena_wallet_entries(account_id, kind, amount_minor, fee_minor, balance_after, request_key) VALUES ($1,$2,$3,$4,$5,$6)",
      [accountId, direction, delta, fee, balance + delta, requestKey],
    );
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
