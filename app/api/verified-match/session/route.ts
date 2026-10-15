import { NextRequest, NextResponse } from "next/server";
import {
  persistentMatchesRequested,
  getPublicMatchService,
  newActorCapability,
  PUBLIC_ACTOR_COOKIE,
  sameOrigin,
  publicMatchError,
} from "@/lib/server/publicMatchHttp";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  if (!persistentMatchesRequested())
    return NextResponse.json(
      { durable: false, scope: "training" },
      { headers: { "Cache-Control": "no-store" } },
    );
  try {
    sameOrigin(request);
    getPublicMatchService();
    const response = NextResponse.json(
      { durable: true, scope: "training" },
      { headers: { "Cache-Control": "no-store" } },
    );
    if (
      !request.cookies.get(PUBLIC_ACTOR_COOKIE)?.value?.match(/^[a-f0-9]{64}$/)
    )
      response.cookies.set(PUBLIC_ACTOR_COOKIE, newActorCapability(), {
        httpOnly: true,
        sameSite: "strict",
        secure:
          new URL(request.url).protocol === "https:" ||
          request.headers.get("x-forwarded-proto") === "https",
        path: "/api/verified-match",
        maxAge: 86400,
      });
    return response;
  } catch (e) {
    return publicMatchError(e);
  }
}
