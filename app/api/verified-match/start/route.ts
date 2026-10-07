import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getGameDefinition, type GameId } from "@/lib/games";
import {
  createMatchManifest,
  hashManifest,
  issueAttemptTicket,
  isAllowedStakeMinor,
} from "@/lib/server/verifiedMatch";

export const runtime = "nodejs";

type StartRequest = {
  game_id?: string;
  stake_minor?: number;
  target_score?: number;
};

function reject(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(request: Request) {
  let body: StartRequest = {};
  try {
    body = (await request.json()) as StartRequest;
  } catch {
    body = {};
  }

  if (typeof body.game_id !== "string") {
    return reject("INVALID_MANIFEST");
  }

  const game = getGameDefinition(body.game_id);
  if (
    !game ||
    game.competition.verification !== "server-replay"
  ) {
    return reject("UNSUPPORTED_GAME_VERSION");
  }

  const stakeMinor =
    typeof body.stake_minor === "number" &&
    Number.isInteger(body.stake_minor)
      ? body.stake_minor
      : 0;

  if (!isAllowedStakeMinor(stakeMinor)) {
    return reject("INVALID_STAKE");
  }

  const targetScore =
    typeof body.target_score === "number" &&
    Number.isInteger(body.target_score)
      ? Math.max(1, Math.min(1_000_000_000, body.target_score))
      : 1;

  const manifest = createMatchManifest({
    gameId: game.id as GameId,
    stakeMinor,
    targetScore,
  });

  const ticket = issueAttemptTicket({
    manifest,
    playerId: `demo-player:${randomUUID()}`,
    slot: "A",
    ttlMinutes: 15,
  });

  return NextResponse.json({
    ok: true,
    manifest,
    manifest_hash: hashManifest(manifest),
    ticket,
    note:
      ticket.security_mode === "demo"
        ? "Demo signing key active. Configure MATCH_SIGNING_SECRET before production."
        : undefined,
  });
}
