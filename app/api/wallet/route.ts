import { AccountError, exchangeFictitious, findAccount, listMovements } from "@/lib/server/accounts";
import { accountContext, json, readJson } from "@/lib/server/accountHttp";
import { getProductionPostgresPool } from "@/lib/server/postgresPool";

/**
 * v191 · The signed-in player's fictitious wallet. GET: balance and the last movements. POST { direction: "deposit" |
 * "withdraw", amount_minor, key }: fictitious exchange with the 5 % commission. No payment provider is called.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ctx = accountContext(req, false);
  if (ctx instanceof Response) return ctx;
  try {
    const pool = getProductionPostgresPool();
    const account = await findAccount(pool, ctx.authKey);
    if (!account) return json({ error: "NO_ACCOUNT" }, 404);
    return json({ balanceMinor: account.balanceMinor, movements: await listMovements(pool, ctx.authKey), scope: "fictitious" });
  } catch {
    return json({ error: "STORAGE_FAILED" }, 503);
  }
}

export async function POST(req: Request) {
  const ctx = accountContext(req, true);
  if (ctx instanceof Response) return ctx;
  const body = await readJson(req);
  const direction = body?.direction;
  const key = body?.key;
  if ((direction !== "deposit" && direction !== "withdraw") || typeof key !== "string" || !/^[A-Za-z0-9_-]{8,64}$/.test(key))
    return json({ error: "INVALID_REQUEST" }, 400);
  try {
    const out = await exchangeFictitious(getProductionPostgresPool(), ctx.authKey, direction, Number(body?.amount_minor), key);
    return json({ balanceMinor: out.account.balanceMinor, movement: out.movement, scope: "fictitious" });
  } catch (e) {
    if (e instanceof AccountError)
      return json({ error: e.code }, e.code === "NO_ACCOUNT" ? 404 : e.code === "INSUFFICIENT_BALANCE" ? 409 : 400);
    return json({ error: "STORAGE_FAILED" }, 503);
  }
}
