import { NextRequest, NextResponse } from "next/server";
import { actorFromRequest, readBoundedJson, sameOrigin } from "@/lib/server/publicMatchHttp";
import { getHiddenMatchService, hiddenMatchError } from "@/lib/server/hiddenMatchHttp";
import { sessionAccountId } from "@/lib/server/accountHttp";
import { refuseBot } from "@/lib/server/botProtection";
export const runtime = "nodejs";
/** Starts or joins a paired hidden-information match. Never returns the manifest, seed or ticket. */
export async function POST(request: NextRequest) {
  const bot = await refuseBot();
  if (bot) return bot;
  try {
    sameOrigin(request);
    const actor = actorFromRequest(request);
    return NextResponse.json(
      await getHiddenMatchService().start(actor, await readBoundedJson(request, 4096), await sessionAccountId(request)),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return hiddenMatchError(e);
  }
}
