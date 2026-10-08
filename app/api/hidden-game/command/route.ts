import type { NextRequest } from "next/server";
import { getLocalHiddenGames } from "@/lib/server/demo/localHiddenGames";
import {
  checkHiddenOrigin,
  demoActor,
  hiddenError,
} from "@/lib/server/hiddenHttp";
import { CommandAuthorityError } from "@/lib/server/commandAttemptRepository";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    checkHiddenOrigin(request);
    const actor = demoActor(request);
    if (!actor) throw new CommandAuthorityError("NOT_FOUND");
    if (Number(request.headers.get("content-length")) > 4096)
      throw new CommandAuthorityError("INVALID_COMMAND");
    const body = await request.json(),
      session = await getLocalHiddenGames().authority.command(body, actor);
    return Response.json(session, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return hiddenError(error);
  }
}
