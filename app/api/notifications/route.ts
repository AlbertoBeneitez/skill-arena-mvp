import { findAccount } from "@/lib/server/accounts";
import { accountContext, json, readJson } from "@/lib/server/accountHttp";
import { markNoticesRead, noticeInbox, saveNoticeSettings } from "@/lib/server/notifications";
import { getProductionPostgresPool } from "@/lib/server/postgresPool";

/**
 * v230 · In-app notices (good news only; lib/notices.ts). GET: the latest 50, how many are unread and the settings.
 * POST { action: "read", ids?: string[] } (no ids = all) · { action: "settings", settings }. Notices are written by the
 * server when the fact happens (lib/server/groups.ts), never through this endpoint.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function accountOf(authKey: string) {
  return (await findAccount(getProductionPostgresPool(), authKey))?.id ?? null;
}

export async function GET(req: Request) {
  const ctx = accountContext(req, false);
  if (ctx instanceof Response) return ctx;
  try {
    const id = await accountOf(ctx.authKey);
    if (!id) return json({ error: "NO_ACCOUNT" }, 404);
    return json(await noticeInbox(getProductionPostgresPool(), id));
  } catch {
    return json({ error: "STORAGE_FAILED" }, 503);
  }
}

export async function POST(req: Request) {
  const ctx = accountContext(req, true);
  if (ctx instanceof Response) return ctx;
  const body = await readJson(req, 4096);
  if (!body) return json({ error: "INVALID_REQUEST" }, 400);
  try {
    const id = await accountOf(ctx.authKey);
    if (!id) return json({ error: "NO_ACCOUNT" }, 404);
    const pool = getProductionPostgresPool();
    if (body.action === "read") {
      const ids = body.ids;
      if (ids !== undefined && (!Array.isArray(ids) || ids.length > 50 || !ids.every((x) => typeof x === "string" && UUID.test(x))))
        return json({ error: "INVALID_REQUEST" }, 400);
      await markNoticesRead(pool, id, ids === undefined ? "all" : (ids as string[]));
      return json({ ok: true });
    }
    if (body.action === "settings") return json({ ok: true, settings: await saveNoticeSettings(pool, id, body.settings) });
    return json({ error: "INVALID_REQUEST" }, 400);
  } catch {
    return json({ error: "STORAGE_FAILED" }, 503);
  }
}
