import { NextRequest, NextResponse } from "next/server";
import {
  getLocalHiddenGames,
  newLocalActor,
} from "@/lib/server/demo/localHiddenGames";
import {
  checkHiddenOrigin,
  demoActor,
  HIDDEN_DEMO_COOKIE,
  hiddenError,
} from "@/lib/server/hiddenHttp";
import { CommandAuthorityError } from "@/lib/server/commandAttemptRepository";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    checkHiddenOrigin(request);
    const body = await request.json();
    if (
      !body ||
      Object.keys(body).join(",") !== "gameId" ||
      body.gameId !== "mine-grid"
    )
      throw new CommandAuthorityError("INVALID_COMMAND");
    const actor = demoActor(request) ?? newLocalActor(),
      session = await getLocalHiddenGames().start(actor);
    const response = NextResponse.json(session, {
      headers: { "Cache-Control": "no-store" },
    });
    response.cookies.set(HIDDEN_DEMO_COOKIE, actor, {
      httpOnly: true,
      sameSite: "strict",
      secure: false,
      path: "/api/hidden-game",
      maxAge: 1800,
    });
    return response;
  } catch (error) {
    return hiddenError(error);
  }
}
