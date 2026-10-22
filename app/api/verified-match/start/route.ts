import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getGameDefinition, type GameId } from "@/lib/games";
import {
  createMatchManifest,
  hashManifest,
  issueAttemptTicket,
  isAllowedStakeMinor,
} from "@/lib/server/verifiedMatch";

import {
  persistentMatchesRequested,
  getPublicMatchService,
  actorFromRequest,
  sameOrigin,
  readBoundedJson,
  publicMatchError,
  requireLegacyStatelessTraining,
} from "@/lib/server/publicMatchHttp";
export const runtime = "nodejs";
type StartRequest = {
  game_id?: string;
  stake_minor?: number;
  target_score?: number;
};

function reject(error: string, status = 400) {
  return NextResponse.json(
    { ok: false, error },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  if (persistentMatchesRequested()) {
    try {
      sameOrigin(request);
      const actor = actorFromRequest(request);
      return NextResponse.json(
        await getPublicMatchService().start(
          actor,
          await readBoundedJson(request, 4096),
        ),
        { headers: { "Cache-Control": "no-store" } },
      );
    } catch (e) {
      return publicMatchError(e);
    }
  }
  let body: StartRequest = {};
  try {
    requireLegacyStatelessTraining();
    sameOrigin(request);
    const parsed = await readBoundedJson(request, 4096);
    body =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as StartRequest)
        : {};
  } catch (e) {
    return publicMatchError(e);
  }

  if (typeof body.game_id !== "string") {
    return reject("INVALID_MANIFEST");
  }

  const game = getGameDefinition(body.game_id);
  if (
    !game ||
    !game.enabled ||
    game.competition.verification !== "server-replay"
  ) {
    return reject("UNSUPPORTED_GAME_VERSION");
  }

  const stakeMinor =
    typeof body.stake_minor === "number" && Number.isInteger(body.stake_minor)
      ? body.stake_minor
      : 0;

  if (!isAllowedStakeMinor(stakeMinor)) {
    return reject("INVALID_STAKE");
  }

  const targetScore =
    typeof body.target_score === "number" && Number.isInteger(body.target_score)
      ? Math.max(1, Math.min(1_000_000_000, body.target_score))
      : 1;

  const manifest = createMatchManifest({
    gameId: game.id as GameId,
    stakeMinor,
    targetScore,
  });

  let ticket;
  try {
    ticket = issueAttemptTicket({
      manifest,
      playerId: `demo-player:${randomUUID()}`,
      slot: "A",
      ttlMinutes: 15,
    });
  } catch (e) {
    return publicMatchError(e);
  }

  return NextResponse.json(
    {
      ok: true,
      manifest,
      manifest_hash: hashManifest(manifest),
      ticket,
      note:
        ticket.security_mode === "demo"
          ? "Demo signing key active. Configure MATCH_SIGNING_SECRET before production."
          : undefined,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
