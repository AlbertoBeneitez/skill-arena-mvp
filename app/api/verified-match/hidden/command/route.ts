import { NextRequest, NextResponse } from "next/server";
import { actorFromRequest, readBoundedJson, sameOrigin } from "@/lib/server/publicMatchHttp";
import { getHiddenMatchService, hiddenMatchError } from "@/lib/server/hiddenMatchHttp";
export const runtime = "nodejs";
/** One move of a paired hidden-information match. Not bot-checked on purpose: a failed check must not cost a match. */
export async function POST(request: NextRequest) {
  try {
    sameOrigin(request);
    const actor = actorFromRequest(request);
    return NextResponse.json(await getHiddenMatchService().command(actor, await readBoundedJson(request, 4096)), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return hiddenMatchError(e);
  }
}
