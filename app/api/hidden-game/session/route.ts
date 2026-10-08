import type { NextRequest } from "next/server";
import { getLocalHiddenGames } from "@/lib/server/demo/localHiddenGames";
import { demoActor, hiddenError } from "@/lib/server/hiddenHttp";
import { CommandAuthorityError } from "@/lib/server/commandAttemptRepository";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  try {
    const actor = demoActor(request),
      id = new URL(request.url).searchParams.get("attemptId");
    if (!actor || !id || id.length > 128)
      throw new CommandAuthorityError("NOT_FOUND");
    return Response.json(
      await getLocalHiddenGames().authority.read(id, actor),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return hiddenError(error);
  }
}
