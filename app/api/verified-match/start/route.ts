import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  createTowerDropManifest,
  hashManifest,
  issueAttemptTicket,
  isAllowedStakeMinor,
} from "@/lib/server/verifiedMatch";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: { stake_minor?: number; target_score?: number } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const stakeMinor =
    typeof body.stake_minor === "number" &&
    Number.isInteger(body.stake_minor)
      ? body.stake_minor
      : 0;

  if (!isAllowedStakeMinor(stakeMinor)) {
    return NextResponse.json(
      { ok: false, error: "INVALID_STAKE" },
      { status: 400 }
    );
  }

  const targetScore =
    typeof body.target_score === "number" && Number.isInteger(body.target_score)
      ? Math.max(1, Math.min(1_000_000_000, body.target_score))
      : 1;

  const manifest = createTowerDropManifest({ stakeMinor, targetScore });
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
