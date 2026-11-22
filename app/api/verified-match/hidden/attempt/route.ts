import { NextRequest, NextResponse } from "next/server";
import { actorFromRequest, sameOrigin } from "@/lib/server/publicMatchHttp";
import { getHiddenMatchService, hiddenMatchError } from "@/lib/server/hiddenMatchHttp";
export const runtime = "nodejs";
/** Current view and, once finished, the authoritative result. Reading also closes an attempt whose time is up. */
export async function GET(request: NextRequest) {
  try {
    sameOrigin(request);
    const actor = actorFromRequest(request);
    return NextResponse.json(await getHiddenMatchService().read(actor, request.nextUrl.searchParams.get("id") ?? ""), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return hiddenMatchError(e);
  }
}
