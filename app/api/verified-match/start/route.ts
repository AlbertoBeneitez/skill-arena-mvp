import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  createTowerDropManifest,
  hashManifest,
  issueAttemptTicket,
} from "@/lib/server/verifiedMatch";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: { stake_minor?: number } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const stakeMinor =
    typeof body.stake_minor === "number" &&
    Number.isFinite(body.stake_minor)
      ? Math.max(0, Math.floor(body.stake_minor))
      : 0;

  const manifest = createTowerDropManifest({ stakeMinor });
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
