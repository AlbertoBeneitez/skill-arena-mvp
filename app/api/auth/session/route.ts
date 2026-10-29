import { configuredProviders } from "@/lib/server/authProviders";
import { SESSION_COOKIE, authSecret, cookieHeader, decodeSession, readCookie } from "@/lib/server/authSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Which providers are live, and who is signed in on this device (provider + display name only). */
export async function GET(req: Request) {
  const secret = authSecret();
  const s = secret ? decodeSession(readCookie(req, SESSION_COOKIE), secret) : null;
  return Response.json(
    { providers: configuredProviders(), session: s ? { provider: s.p, name: s.n } : null },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** Sign out: the cookie is the whole session, so clearing it is the whole logout. */
export async function DELETE(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin && origin !== process.env.AUTH_URL?.replace(/\/+$/, "")) {
    return Response.json({ error: "ORIGIN_REJECTED" }, { status: 403 });
  }
  return new Response(null, { status: 204, headers: { "Set-Cookie": cookieHeader(SESSION_COOKIE, "", { maxAge: 0 }), "Cache-Control": "no-store" } });
}
