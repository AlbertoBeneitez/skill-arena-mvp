import { ANALYTICS_CONSENT_VERSION } from "@/lib/events";
import { findAccount } from "@/lib/server/accounts";
import { accountContext, json, readJson } from "@/lib/server/accountHttp";
import { consentState, setConsent } from "@/lib/server/events";
import { getProductionPostgresPool } from "@/lib/server/postgresPool";

/** v196 · The signed-in player's decision about measurement. GET: current state. POST { granted, version }. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function accountId(authKey: string) {
  return (await findAccount(getProductionPostgresPool(), authKey))?.id ?? null;
}

export async function GET(req: Request) {
  const ctx = accountContext(req, false);
  if (ctx instanceof Response) return ctx;
  try {
    const id = await accountId(ctx.authKey);
    if (!id) return json({ error: "NO_ACCOUNT" }, 404);
    return json({ consent: await consentState(getProductionPostgresPool(), id) });
  } catch { return json({ error: "STORAGE_FAILED" }, 503); }
}

export async function POST(req: Request) {
  const ctx = accountContext(req, true);
  if (ctx instanceof Response) return ctx;
  const body = await readJson(req);
  if (typeof body?.granted !== "boolean") return json({ error: "INVALID_BODY" }, 400);
  if (body.granted && body.version !== ANALYTICS_CONSENT_VERSION) return json({ error: "CONSENT_VERSION" }, 409);
  try {
    const id = await accountId(ctx.authKey);
    if (!id) return json({ error: "NO_ACCOUNT" }, 404);
    return json({ consent: await setConsent(getProductionPostgresPool(), id, body.granted) });
  } catch { return json({ error: "STORAGE_FAILED" }, 503); }
}
