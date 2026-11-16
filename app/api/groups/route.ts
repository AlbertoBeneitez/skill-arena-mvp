import { findAccount } from "@/lib/server/accounts";
import { accountContext, json, readJson } from "@/lib/server/accountHttp";
import { BadRequest, GroupError, groupAction, groupErrorStatus, groupsOverview } from "@/lib/server/groupHttp";
import { getProductionPostgresPool } from "@/lib/server/postgresPool";

/**
 * v197 · Groups on the server (fictitious balance). GET: my groups and competitions, open challenges, group money
 * ranking. POST { action, … }: create, join, leave, close, competition, enter, start, cancel, accept, result.
 * Platform comes from the account; scores come from verified attempts, never from this request.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function actor(authKey: string) {
  const account = await findAccount(getProductionPostgresPool(), authKey);
  return account ? { accountId: account.id, platform: account.platform } : null;
}
const failure = (e: unknown) => {
  if (e instanceof BadRequest) return json({ error: "INVALID_REQUEST", field: e.message }, 400);
  if (e instanceof GroupError) return json({ error: e.code }, groupErrorStatus(e.code));
  return json({ error: "STORAGE_FAILED" }, 503);
};

export async function GET(req: Request) {
  const ctx = accountContext(req, false);
  if (ctx instanceof Response) return ctx;
  try {
    const who = await actor(ctx.authKey);
    if (!who) return json({ error: "NO_ACCOUNT" }, 404);
    return json(await groupsOverview(getProductionPostgresPool(), who));
  } catch (e) { return failure(e); }
}

export async function POST(req: Request) {
  const ctx = accountContext(req, true);
  if (ctx instanceof Response) return ctx;
  const body = await readJson(req, 4096);
  if (!body) return json({ error: "INVALID_REQUEST" }, 400);
  try {
    const who = await actor(ctx.authKey);
    if (!who) return json({ error: "NO_ACCOUNT" }, 404);
    return json(await groupAction(getProductionPostgresPool(), who, body));
  } catch (e) { return failure(e); }
}
