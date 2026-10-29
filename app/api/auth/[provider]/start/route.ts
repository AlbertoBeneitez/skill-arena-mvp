import { isAuthProviderId, providerConfigured, publicOrigin, startAuthorization } from "@/lib/server/authProviders";
import { cookieHeader, newState } from "@/lib/server/authSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OAUTH_COOKIE = "ga_oauth";

/** Step 1: send the player to the provider with a fresh state (+ PKCE verifier) kept in a short-lived cookie. */
export async function GET(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const origin = publicOrigin(req);
  if (!isAuthProviderId(provider) || !providerConfigured(provider)) {
    return Response.redirect(`${origin}/?auth=unavailable`, 303);
  }
  // Cookies and redirect URIs live on one origin (AUTH_URL): bounce there first if needed.
  if (new URL(req.url).origin !== origin) return Response.redirect(`${origin}/api/auth/${provider}/start`, 303);
  const state = newState();
  const { url, verifier } = startAuthorization(provider, origin, state);
  const headers = new Headers({ Location: url.toString(), "Cache-Control": "no-store" });
  // SameSite=None: Apple returns with a cross-site form POST.
  headers.append("Set-Cookie", cookieHeader(OAUTH_COOKIE, `${provider}.${state}.${verifier ?? ""}`, { maxAge: 600, sameSite: "None", path: "/api/auth" }));
  return new Response(null, { status: 303, headers });
}
