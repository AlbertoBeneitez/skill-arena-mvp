import { finishAuthorization, isAuthProviderId, providerConfigured, publicOrigin } from "@/lib/server/authProviders";
import { SESSION_COOKIE, SESSION_MAX_AGE_S, authSecret, cookieHeader, encodeSession, readCookie } from "@/lib/server/authSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OAUTH_COOKIE = "ga_oauth";

/** Step 2: the provider comes back with a code (GET, or a form POST for Apple). */
async function handle(req: Request, provider: string, params: URLSearchParams) {
  const origin = publicOrigin(req);
  const headers = new Headers({ "Cache-Control": "no-store" });
  headers.append("Set-Cookie", cookieHeader(OAUTH_COOKIE, "", { maxAge: 0, sameSite: "None", path: "/api/auth" }));
  const fail = (why: string) => { headers.set("Location", `${origin}/?auth=error&reason=${why}`); return new Response(null, { status: 303, headers }); };
  const secret = authSecret();
  if (!isAuthProviderId(provider) || !providerConfigured(provider) || !secret) return fail("unavailable");
  if (params.get("error")) return fail("cancelled");
  const [cp, cs, cv] = (readCookie(req, OAUTH_COOKIE) ?? "").split(".");
  const code = params.get("code"), state = params.get("state");
  if (!code || !state || cp !== provider || !cs || cs !== state) return fail("state");
  try {
    const profile = await finishAuthorization(provider, origin, code, cv || null, params.get("user"));
    if (!profile.sub || profile.sub === "undefined") return fail("profile");
    const now = Math.floor(Date.now() / 1000);
    headers.append("Set-Cookie", cookieHeader(SESSION_COOKIE, encodeSession({ p: provider, sub: profile.sub, n: profile.name, iat: now, exp: now + SESSION_MAX_AGE_S }, secret), { maxAge: SESSION_MAX_AGE_S }));
    headers.set("Location", `${origin}/?auth=ok`);
    return new Response(null, { status: 303, headers });
  } catch {
    return fail("exchange");
  }
}

export async function GET(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  return handle(req, provider, new URL(req.url).searchParams);
}

export async function POST(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const form = await req.formData().catch(() => null);
  const params = new URLSearchParams();
  if (form) for (const [k, v] of form.entries()) if (typeof v === "string") params.set(k, v);
  return handle(req, provider, params);
}
