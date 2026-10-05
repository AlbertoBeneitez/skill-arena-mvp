import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type {
  MatchManifest,
  AttemptTicket,
  VerifiedAttemptPayload,
} from "@/lib/verified/contracts";
import type { TowerDropInput } from "@/lib/verified/towerDropCore.v1";
import {
  replayTowerDrop,
  TOWER_DROP_V1,
} from "@/lib/verified/towerDropCore.v1";
import {
  hashManifest,
  hashReplay,
  validateManifest,
  verifyAttemptTicket,
} from "@/lib/server/verifiedMatch";

export const runtime = "nodejs";

function reject(error: string, status = 400) {
  return NextResponse.json(
    { ok: false, verified: false, error },
    { status }
  );
}

function isPayload(value: unknown): value is VerifiedAttemptPayload {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    !!record.manifest &&
    typeof record.manifest === "object" &&
    !!record.ticket &&
    typeof record.ticket === "object" &&
    Array.isArray(record.inputs) &&
    Number.isInteger(record.final_tick)
  );
}

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return reject("INVALID_JSON");
  }

  if (!isPayload(raw)) return reject("INVALID_PAYLOAD");

  const payload = raw;
  const manifest = payload.manifest as MatchManifest;
  const ticket = payload.ticket as AttemptTicket;
  const inputs = payload.inputs as TowerDropInput[];
  const finalTick = payload.final_tick;

  const manifestCheck = validateManifest(manifest);
  if (!manifestCheck.ok) return reject(manifestCheck.error);

  const ticketCheck = verifyAttemptTicket(ticket, manifest);
  if (!ticketCheck.ok) return reject(ticketCheck.error, 401);

  const replay = replayTowerDrop(inputs, finalTick);
  if (!replay.valid) return reject(replay.error ?? "INVALID_REPLAY");

  const elapsedWallMs = Date.now() - ticketCheck.issuedAt;
  const maxClockLeadMs = 2_500;
  if (replay.timeMs > elapsedWallMs + maxClockLeadMs) {
    return reject("SIMULATION_FASTER_THAN_REAL_TIME", 409);
  }

  if (replay.state.tick > TOWER_DROP_V1.tickRate * 60 * 15) {
    return reject("ATTEMPT_TOO_LONG");
  }

  const manifestHash = hashManifest(manifest);
  const replayHash = hashReplay({
    manifestHash,
    attemptId: ticket.attempt_id,
    inputs,
    finalTick,
    score: replay.score,
    height: replay.height,
    failure: replay.failure,
  });

  return NextResponse.json({
    ok: true,
    verified: true,
    verification_id: randomUUID(),
    replay_hash: replayHash,
    score: replay.score,
    time_ms: replay.timeMs,
    height: replay.height,
    failure: replay.failure,
    authoritative_source: "SERVER_REPLAY",
    client_score_ignored: true,
  });
}
