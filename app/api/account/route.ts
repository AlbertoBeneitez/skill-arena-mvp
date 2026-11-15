import { cleanName, validAvatar } from "@/lib/accountRules";
import { isPlatform } from "@/lib/platform";
import { AccountError, createAccount, deleteAccount, findAccount, updateProfile } from "@/lib/server/accounts";
import { accountContext, json, readJson } from "@/lib/server/accountHttp";
import { getProductionPostgresPool } from "@/lib/server/postgresPool";

/**
 * v191 · The signed-in player's account. GET: the account or null (then the app asks for name and avatar). POST: create
 * it ({ name, avatar, platform }). PATCH: change name and/or avatar. DELETE: erase the account and its ledger.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const failure = (e: unknown) => {
  if (e instanceof AccountError) return json({ error: e.code }, e.code === "NO_ACCOUNT" ? 404 : 409);
  return json({ error: "STORAGE_FAILED" }, 503);
};

export async function GET(req: Request) {
  const ctx = accountContext(req, false);
  if (ctx instanceof Response) return ctx;
  try {
    return json({ account: await findAccount(getProductionPostgresPool(), ctx.authKey), providerName: ctx.providerName });
  } catch (e) { return failure(e); }
}

export async function POST(req: Request) {
  const ctx = accountContext(req, true);
  if (ctx instanceof Response) return ctx;
  const body = await readJson(req);
  const name = cleanName(body?.name);
  if (!name) return json({ error: "INVALID_NAME" }, 400);
  if (!validAvatar(body?.avatar)) return json({ error: "INVALID_AVATAR" }, 400);
  const platform = isPlatform(body?.platform) ? body.platform : "mobile";
  try {
    return json({ account: await createAccount(getProductionPostgresPool(), ctx.authKey, name, body.avatar as number, platform) }, 201);
  } catch (e) { return failure(e); }
}

export async function PATCH(req: Request) {
  const ctx = accountContext(req, true);
  if (ctx instanceof Response) return ctx;
  const body = await readJson(req);
  const name = body?.name === undefined ? undefined : cleanName(body.name);
  if (name === null) return json({ error: "INVALID_NAME" }, 400);
  if (body?.avatar !== undefined && !validAvatar(body.avatar)) return json({ error: "INVALID_AVATAR" }, 400);
  if (name === undefined && body?.avatar === undefined) return json({ error: "NOTHING_TO_CHANGE" }, 400);
  try {
    return json({ account: await updateProfile(getProductionPostgresPool(), ctx.authKey, { name, avatar: body?.avatar as number | undefined }) });
  } catch (e) { return failure(e); }
}

export async function DELETE(req: Request) {
  const ctx = accountContext(req, true);
  if (ctx instanceof Response) return ctx;
  try {
    return json({ deleted: await deleteAccount(getProductionPostgresPool(), ctx.authKey) });
  } catch (e) { return failure(e); }
}
