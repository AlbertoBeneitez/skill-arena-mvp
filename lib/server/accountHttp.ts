/**
 * v191 · Shared HTTP plumbing for /api/account and /api/wallet: who is signed in (the signed `ga_session` cookie),
 * whether accounts can work here (AUTH_SECRET + DATABASE_URL), same-origin checks and bounded JSON bodies.
 */
import { authSecret, decodeSession, readCookie, SESSION_COOKIE } from "./authSession";
import { accountAuthKey, findAccount } from "./accounts";
import { getProductionPostgresPool } from "./postgresPool";
import { sameOrigin } from "./publicMatchHttp";

export const noStore = { "Cache-Control": "no-store" };
export const json = (body: unknown, status = 200) => Response.json(body, { status, headers: noStore });

export type AccountContext = { authKey: string; provider: string; providerName: string };

/** The signed-in identity, or the Response to send back instead. Mutations must come from this same site
 * (sameOrigin throws when they do not). */
export function accountContext(req: Request, mutation: boolean): AccountContext | Response {
  if (mutation) {
    try { sameOrigin(req); } catch { return json({ error: "ORIGIN_REJECTED" }, 403); }
  }
  const secret = authSecret();
  if (!secret || !process.env.DATABASE_URL) return json({ error: "ACCOUNTS_NOT_CONFIGURED" }, 503);
  const session = decodeSession(readCookie(req, SESSION_COOKIE), secret);
  if (!session) return json({ error: "SIGN_IN_REQUIRED" }, 401);
  return { authKey: accountAuthKey(session.p, session.sub, secret), provider: session.p, providerName: session.n };
}

export async function readJson(req: Request, maxBytes = 2048): Promise<Record<string, unknown> | null> {
  const text = await req.text().catch(() => "");
  if (!text || text.length > maxBytes) return null;
  try {
    const value = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

/** v195 · The account behind this request, if any: read from the signed session cookie only (the browser never says
 * who it is). Returns null for guests, when accounts are not configured, or when the lookup fails, so playing as a
 * guest keeps working and the match simply carries no person. */
export async function sessionAccountId(req: Request): Promise<string | null> {
  const secret = authSecret();
  if (!secret || !process.env.DATABASE_URL) return null;
  const session = decodeSession(readCookie(req, SESSION_COOKIE), secret);
  if (!session) return null;
  try {
    const account = await findAccount(getProductionPostgresPool(), accountAuthKey(session.p, session.sub, secret));
    return account?.id ?? null;
  } catch {
    return null;
  }
}
