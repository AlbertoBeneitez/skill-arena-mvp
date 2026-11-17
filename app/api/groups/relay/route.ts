import { findAccount } from "@/lib/server/accounts";
import { accountContext, json, readJson } from "@/lib/server/accountHttp";
import { RelayError, cancelRelay, createRelay, relayErrorStatus, relayOverview, releaseRelayTurn, startRelayTurn, submitRelayTurn } from "@/lib/server/groupRelays";
import { getProductionPostgresPool } from "@/lib/server/postgresPool";

/**
 * v211 · Group relay ("juego grupal", Stack). GET ?groupId=… → the group's relay in play (or its latest).
 * POST { action: "create", groupId, blocksPerTurn } | { action: "start" | "release" | "cancel", relayId }
 *    | { action: "submit", relayId, turnNo, inputs: [{ tick, action: "DROP" }], finalTick }.
 * Only the drops travel: the tower, height and score are recomputed on the server by replaying the whole run.
 * A refused start or turn answers with who has the turn and since when, so the player who came later is told.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const isUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);

async function accountId(authKey: string) {
  return (await findAccount(getProductionPostgresPool(), authKey))?.id ?? null;
}
const failure = (e: unknown) => {
  if (e instanceof RelayError) return json({ error: e.code, ...e.detail }, relayErrorStatus(e.code));
  return json({ error: "STORAGE_FAILED" }, 503);
};

export async function GET(req: Request) {
  const ctx = accountContext(req, false);
  if (ctx instanceof Response) return ctx;
  const groupId = new URL(req.url).searchParams.get("groupId");
  if (!isUuid(groupId)) return json({ error: "INVALID_REQUEST" }, 400);
  try {
    const me = await accountId(ctx.authKey);
    if (!me) return json({ error: "NO_ACCOUNT" }, 404);
    const pool = getProductionPostgresPool();
    const member = await pool.query("SELECT 1 FROM arena_group_members WHERE group_id = $1 AND account_id = $2 AND left_at IS NULL", [groupId, me]);
    if (!member.rows[0]) return json({ error: "NOT_MEMBER" }, 403);
    return json({ relay: await relayOverview(pool, me, groupId) });
  } catch (e) { return failure(e); }
}

export async function POST(req: Request) {
  const ctx = accountContext(req, true);
  if (ctx instanceof Response) return ctx;
  const body = await readJson(req, 8192);
  if (!body) return json({ error: "INVALID_REQUEST" }, 400);
  try {
    const me = await accountId(ctx.authKey);
    if (!me) return json({ error: "NO_ACCOUNT" }, 404);
    const pool = getProductionPostgresPool();
    switch (body.action) {
      case "create":
        if (!isUuid(body.groupId)) return json({ error: "INVALID_REQUEST" }, 400);
        return json(await createRelay(pool, me, body.groupId, body.blocksPerTurn));
      case "start":
      case "release":
      case "cancel": {
        if (!isUuid(body.relayId)) return json({ error: "INVALID_REQUEST" }, 400);
        const run = body.action === "start" ? startRelayTurn : body.action === "release" ? releaseRelayTurn : cancelRelay;
        return json(await run(pool, me, body.relayId));
      }
      case "submit":
        if (!isUuid(body.relayId) || !Number.isInteger(body.turnNo) || !Array.isArray(body.inputs) || body.inputs.length > 20 || !Number.isInteger(body.finalTick)) return json({ error: "INVALID_REQUEST" }, 400);
        return json(await submitRelayTurn(pool, me, body.relayId, body.turnNo, body.inputs, body.finalTick));
      default:
        return json({ error: "INVALID_REQUEST" }, 400);
    }
  } catch (e) { return failure(e); }
}
