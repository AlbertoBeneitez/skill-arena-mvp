import type { NextRequest } from "next/server";
import { CommandAuthorityError } from "./commandAttemptRepository";
export const HIDDEN_DEMO_COOKIE = "arena_hidden_demo_actor";
export function demoActor(request: NextRequest) {
  const id = request.cookies.get(HIDDEN_DEMO_COOKIE)?.value;
  return id && /^[0-9a-f]{64}$/.test(id) ? id : null;
}
export function checkHiddenOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin) {
    const parsed = new URL(origin),
      protocol =
        request.headers.get("x-forwarded-proto") ??
        new URL(request.url).protocol.replace(":", "");
    if (
      parsed.host !== request.headers.get("host") ||
      parsed.protocol !== `${protocol}:`
    )
      throw new CommandAuthorityError("INVALID_COMMAND");
  }
}
export function hiddenError(error: unknown) {
  const code =
    error instanceof CommandAuthorityError ? error.code : "UNAVAILABLE";
  return Response.json(
    {
      source: "server",
      status: code === "UNAVAILABLE" ? "not-configured" : "rejected",
      error: code,
    },
    {
      status:
        code === "UNAVAILABLE"
          ? 200
          : code === "NOT_FOUND"
            ? 404
            : code === "REVISION_CONFLICT" || code === "COMMAND_CONFLICT"
              ? 409
              : 400,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
