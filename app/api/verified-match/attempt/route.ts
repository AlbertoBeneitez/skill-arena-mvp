import { type NextRequest } from "next/server";
import {
  actorFromRequest,
  getPublicMatchService,
  publicMatchError,
  readBoundedJson,
  sameOrigin,
} from "@/lib/server/publicMatchHttp";
import { PublicAttemptError } from "@/lib/server/publicAttemptRepository";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  try {
    sameOrigin(req);
    const actor = actorFromRequest(req),
      b = (await readBoundedJson(req, 1024)) as Record<string, unknown>;
    if (
      !b ||
      typeof b !== "object" ||
      Array.isArray(b) ||
      Object.keys(b).sort().join(",") !== "action,attempt_id" ||
      typeof b.attempt_id !== "string" ||
      b.attempt_id.length > 128 ||
      !["heartbeat", "abandon"].includes(b.action as string)
    )
      throw new PublicAttemptError("INVALID_COMMAND", 400);
    return Response.json(
      await getPublicMatchService().pulse(
        actor,
        b.attempt_id,
        b.action === "abandon",
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return publicMatchError(e);
  }
}
export async function GET(req: NextRequest) {
  try {
    sameOrigin(req);
    const actor = actorFromRequest(req),
      id = req.nextUrl.searchParams.get("attempt_id");
    if (!id)
      return Response.json(
        { attempts: await getPublicMatchService().recent(actor) },
        { headers: { "Cache-Control": "no-store" } },
      );
    if (id.length > 128) throw new PublicAttemptError("INVALID_QUERY", 400);
    const r = await getPublicMatchService().read(actor, id);
    return Response.json(r.body, {
      status: r.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return publicMatchError(e);
  }
}
