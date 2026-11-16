/**
 * v193 · Double-entry money ledger (db/migrations/010-ledger.sql). One operation = one transaction whose postings add
 * up to zero in every currency; the database checks it again at commit. 1 CC (cosmicoin) = 1 euro cent. Fictitious
 * scope only for now: real money needs identity, settlement and compliance (AGENTS.md) and is not activated here.
 *
 * Amounts are signed: + holds value, − gives it away. Player and pot accounts never go below zero; the system accounts
 * (house, conversion, external, studios) can, because they are where money enters and leaves.
 */
import { randomUUID } from "node:crypto";

export type Currency = "EUR" | "CC";
export type LedgerRef =
  | { kind: "player"; accountId: string }
  | { kind: "pot"; competitionId: string }
  | { kind: "house" | "conversion" | "external" | "studios" };
export type LedgerKind = "welcome" | "deposit" | "withdraw" | "entry" | "prize" | "refund" | "fee" | "studio_share" | "adjustment" | "reversal";
export type PostingInput = { ref: LedgerRef; currency: Currency; amountMinor: number };
/** A pool or a client: all this module needs is `query`. */
export type Queryable = { query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }> };
type Db = Queryable;

export class LedgerError extends Error {
  constructor(readonly code: "UNBALANCED" | "EMPTY" | "INVALID_AMOUNT") { super(code); }
}

/** Finds or creates the ledger account for `ref` in `currency`. */
export async function ledgerAccountId(c: Db, ref: LedgerRef, currency: Currency): Promise<number> {
  const owner = ref.kind === "player" ? ref.accountId : null;
  const competition = ref.kind === "pot" ? ref.competitionId : null;
  const find = () => c.query(
    `SELECT ledger_account_id FROM arena_ledger_accounts
      WHERE kind = $1 AND currency = $2 AND scope = 'fictitious'
        AND owner_account_id IS NOT DISTINCT FROM $3::uuid AND competition_id IS NOT DISTINCT FROM $4::uuid`,
    [ref.kind, currency, owner, competition],
  );
  let { rows } = await find();
  if (!rows[0]) {
    await c.query(
      "INSERT INTO arena_ledger_accounts(kind, currency, owner_account_id, competition_id) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING",
      [ref.kind, currency, owner, competition],
    );
    ({ rows } = await find());
  }
  return Number(rows[0].ledger_account_id);
}

/**
 * Posts one transaction inside the caller's database transaction. Returns its id, or null when `requestKey` was
 * already posted for this person and kind (a retried tap): nothing is posted twice.
 */
export async function postTransaction(
  c: Db,
  tx: { kind: LedgerKind; accountId?: string | null; competitionId?: string | null; requestKey?: string | null; detail?: Record<string, unknown>; postings: readonly PostingInput[] },
): Promise<string | null> {
  if (!tx.postings.length) throw new LedgerError("EMPTY");
  const totals: Record<string, number> = {};
  for (const p of tx.postings) {
    if (!Number.isSafeInteger(p.amountMinor) || p.amountMinor === 0) throw new LedgerError("INVALID_AMOUNT");
    totals[p.currency] = (totals[p.currency] ?? 0) + p.amountMinor;
  }
  if (Object.values(totals).some((v) => v !== 0)) throw new LedgerError("UNBALANCED");
  const id = randomUUID();
  const inserted = await c.query(
    `INSERT INTO arena_ledger_transactions(tx_id, kind, account_id, competition_id, request_key, detail)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb) ON CONFLICT DO NOTHING RETURNING tx_id`,
    [id, tx.kind, tx.accountId ?? null, tx.competitionId ?? null, tx.requestKey ?? null, JSON.stringify(tx.detail ?? {})],
  );
  if (!inserted.rows[0]) return null;
  for (const p of tx.postings) {
    const account = await ledgerAccountId(c, p.ref, p.currency);
    await c.query("INSERT INTO arena_ledger_postings(tx_id, ledger_account_id, currency, amount_minor) VALUES ($1,$2,$3,$4)", [id, account, p.currency, p.amountMinor]);
  }
  return id;
}

export async function ledgerBalance(db: Queryable, ref: LedgerRef, currency: Currency): Promise<number> {
  const owner = ref.kind === "player" ? ref.accountId : null;
  const competition = ref.kind === "pot" ? ref.competitionId : null;
  const { rows } = await db.query(
    `SELECT COALESCE(sum(p.amount_minor), 0) AS balance FROM arena_ledger_accounts a
       LEFT JOIN arena_ledger_postings p USING (ledger_account_id)
      WHERE a.kind = $1 AND a.currency = $2 AND a.scope = 'fictitious'
        AND a.owner_account_id IS NOT DISTINCT FROM $3::uuid AND a.competition_id IS NOT DISTINCT FROM $4::uuid`,
    [ref.kind, currency, owner, competition],
  );
  return Number(rows[0]?.balance ?? 0);
}

/** Postings of the three money operations that exist today. 1 CC = 1 euro cent, the exchange keeps `feeMinor`. */
export const welcomePostings = (accountId: string, amountMinor: number): PostingInput[] => [
  { ref: { kind: "house" }, currency: "CC", amountMinor: -amountMinor },
  { ref: { kind: "player", accountId }, currency: "CC", amountMinor },
];
/** Deposit: the player pays `euroMinor` euros and receives it minus the fee as cosmicoins. */
export const depositPostings = (accountId: string, euroMinor: number, feeMinor: number): PostingInput[] => [
  { ref: { kind: "external" }, currency: "EUR", amountMinor: -euroMinor },
  { ref: { kind: "conversion" }, currency: "EUR", amountMinor: euroMinor - feeMinor },
  { ref: { kind: "house" }, currency: "EUR", amountMinor: feeMinor },
  { ref: { kind: "conversion" }, currency: "CC", amountMinor: -(euroMinor - feeMinor) },
  { ref: { kind: "player", accountId }, currency: "CC", amountMinor: euroMinor - feeMinor },
];
/** Withdrawal: the player gives `ccMinor` cosmicoins and receives it minus the fee as euros. */
export const withdrawPostings = (accountId: string, ccMinor: number, feeMinor: number): PostingInput[] => [
  { ref: { kind: "player", accountId }, currency: "CC", amountMinor: -ccMinor },
  { ref: { kind: "conversion" }, currency: "CC", amountMinor: ccMinor },
  { ref: { kind: "conversion" }, currency: "EUR", amountMinor: -ccMinor },
  { ref: { kind: "house" }, currency: "EUR", amountMinor: feeMinor },
  { ref: { kind: "external" }, currency: "EUR", amountMinor: ccMinor - feeMinor },
];
