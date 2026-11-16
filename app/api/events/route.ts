import { findAccount } from "@/lib/server/accounts";
import { accountContext, json } from "@/lib/server/accountHttp";
import { recordClientEvents } from "@/lib/server/events";
import { getProductionPostgresPool } from "@/lib/server/postgresPool";

/** v196 · Client events (screens, games opened). Only catalogue kinds, only with consent, never authoritative. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ctx = accountContext(req, true);
  if (ctx instanceof Response) return ctx;
  const text = await req.text().catch(() => "");
  if (!text || text.length > 8192) return json({ error: "INVALID_BODY" }, 400);
  let body: unknown;
  try { body = JSON.parse(text); } catch { return json({ error: "INVALID_BODY" }, 400); }
  try {
    const pool = getProductionPostgresPool();
    const account = await findAccount(pool, ctx.authKey);
    if (!account) return json({ error: "NO_ACCOUNT" }, 404);
    const events = (body as { events?: unknown })?.events;
    return json({ recorded: await recordClientEvents(pool, account.id, events) });
  } catch { return json({ error: "STORAGE_FAILED" }, 503); }
}
