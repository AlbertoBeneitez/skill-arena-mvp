import { getHiddenTrainingService } from "@/lib/server/hiddenTrainingService";
import { NextRequest, NextResponse } from "next/server";
import { newLocalActor } from "@/lib/server/demo/localHiddenGames";
import {
  checkHiddenOrigin,
  demoActor,
  HIDDEN_DEMO_COOKIE,
  hiddenError,
  readHiddenBody,
} from "@/lib/server/hiddenHttp";
import { CommandAuthorityError } from "@/lib/server/commandAttemptRepository";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    checkHiddenOrigin(request);
    const body = await readHiddenBody(request);
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).join(",") !== "gameId" ||
      !("gameId" in body) ||
      body.gameId !== "mine-grid"
    )
      throw new CommandAuthorityError("INVALID_COMMAND");
    const actor = demoActor(request) ?? newLocalActor(),
      session = await getHiddenTrainingService().start(actor);
    const response = NextResponse.json(session, {
      headers: { "Cache-Control": "no-store" },
    });
    response.cookies.set(HIDDEN_DEMO_COOKIE, actor, {
      httpOnly: true,
      sameSite: "strict",
      secure:
        new URL(request.url).protocol === "https:" ||
        request.headers.get("x-forwarded-proto") === "https",
      path: "/api/hidden-game",
      maxAge: 1800,
    });
    return response;
  } catch (error) {
    return hiddenError(error);
  }
}

/** Readiness only; no session, identity or secret state is disclosed. */
export async function GET() {
  try {
    const service = getHiddenTrainingService();
    const available = "available" in service ? await service.available() : true;
    return NextResponse.json(
      { available, scope: "training", durable: "available" in service },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { available: false, scope: "training", durable: false },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}
