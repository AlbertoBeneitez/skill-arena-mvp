import { type NextRequest } from "next/server";
import {
  actorFromRequest,
  getPublicMatchService,
  publicMatchError,
  sameOrigin,
} from "@/lib/server/publicMatchHttp";
import { PublicAttemptError } from "@/lib/server/publicAttemptRepository";
import { isAllowedStakeMinor } from "@/lib/server/verifiedMatch";
export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  try {
    sameOrigin(req);
    const actor = actorFromRequest(req),
      raw = req.nextUrl.searchParams.get("stake_minor") ?? "0";
    if (!/^\d{1,4}$/.test(raw) || !isAllowedStakeMinor(Number(raw)))
      throw new PublicAttemptError("INVALID_STAKE", 400);
    return Response.json(
      {
        durable: true,
        scope: "training",
        games: await getPublicMatchService().availability(actor, Number(raw)),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return publicMatchError(e);
  }
}
