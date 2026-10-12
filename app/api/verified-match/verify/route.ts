import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type {
  AttemptTicket,
  MatchManifest,
  VerifiedAttemptPayload,
} from "@/lib/verified/contracts";
import {
  validateInputSequence,
  type ReplayInput,
} from "@/lib/verified/inputValidation";
import {
  recordAttemptSubmission,
  reserveAttemptSubmission,
} from "@/lib/server/attemptAuditLedger";
import {
  checkRateLimit,
  rateLimitHeaders,
  requestRateLimitKey,
} from "@/lib/server/rateLimit";
import {
  hashManifest,
  hashReplay,
  MAX_CLOCK_LEAD_MS,
  validateManifest,
  verifyAttemptTicket,
} from "@/lib/server/verifiedMatch";

export const runtime = "nodejs";

const MAX_VERIFY_BODY_BYTES = 256_000;

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
  const requestKey = requestRateLimitKey(request);
  const rate = checkRateLimit({
    scope: "verified-match:verify",
    key: requestKey,
    limit: 60,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, verified: false, error: "RATE_LIMITED" },
      {
        status: 429,
        headers: rateLimitHeaders(rate),
      }
    );
  }

  const declaredLength = Number(
    request.headers.get("content-length") ?? 0
  );
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_VERIFY_BODY_BYTES
  ) {
    return reject("PAYLOAD_TOO_LARGE", 413);
  }

  let raw: unknown;
  try {
    const body = await request.text();
    if (
      new TextEncoder().encode(body).byteLength >
      MAX_VERIFY_BODY_BYTES
    ) {
      return reject("PAYLOAD_TOO_LARGE", 413);
    }
    raw = JSON.parse(body);
  } catch {
    return reject("INVALID_JSON");
  }

  if (!isPayload(raw)) return reject("INVALID_PAYLOAD");

  const manifest = raw.manifest as MatchManifest;
  const ticket = raw.ticket as AttemptTicket;
  const inputs = raw.inputs as ReplayInput[];
  const finalTick = raw.final_tick;

  const manifestCheck = validateManifest(manifest);
  if (!manifestCheck.ok) return reject(manifestCheck.error);

  const ticketCheck = verifyAttemptTicket(ticket, manifest);
  if (!ticketCheck.ok) {
    return reject(ticketCheck.error, 401);
  }

  if (!reserveAttemptSubmission(ticket.attempt_id)) {
    return reject("ATTEMPT_ALREADY_SUBMITTED", 409);
  }

  const adapter = manifestCheck.adapter;
  const manifestHash = hashManifest(manifest);
  const recordRejected = (auditId: string, error: string) => {
    recordAttemptSubmission({
      auditId,
      attemptId: ticket.attempt_id,
      matchId: ticket.match_id,
      playerId: ticket.player_id,
      slot: ticket.slot,
      manifestHash,
      accepted: false,
      error,
      inputs,
      finalTick,
      receivedAt: new Date().toISOString(),
    });
  };

  const inputError = validateInputSequence(inputs, finalTick, {
    version: adapter.inputProtocol.version,
    allowedActions: adapter.inputProtocol.allowedActions,
    maxInputs: adapter.inputProtocol.maxInputs,
    maxFinalTick: adapter.simulation.maxFinalTick,
  });

  if (inputError) {
    const auditId = randomUUID();
    recordRejected(auditId, inputError);
    return reject(inputError);
  }

  const replay = adapter.replay({
    inputs,
    finalTick,
    manifest,
  });

  if (!replay.valid) {
    const error = replay.error ?? "REPLAY_MISMATCH";
    const auditId = randomUUID();
    recordRejected(auditId, error);
    return reject(error);
  }

  const elapsedWallMs = Date.now() - ticketCheck.issuedAt;
  if (replay.timeMs > elapsedWallMs + MAX_CLOCK_LEAD_MS) {
    const auditId = randomUUID();
    recordRejected(auditId, "SIMULATION_FASTER_THAN_REAL_TIME");
    return reject("SIMULATION_FASTER_THAN_REAL_TIME", 409);
  }

  const replayHash = hashReplay({
    manifestHash,
    attemptId: ticket.attempt_id,
    inputs,
    finalTick,
    result: {
      score: replay.score,
      timeMs: replay.timeMs,
      won: replay.won,
      height: replay.height,
      failure: replay.failure,
    },
  });
  const verificationId = randomUUID();

  recordAttemptSubmission({
    auditId: verificationId,
    attemptId: ticket.attempt_id,
    matchId: ticket.match_id,
    playerId: ticket.player_id,
    slot: ticket.slot,
    manifestHash,
    accepted: true,
    inputs,
    finalTick,
    receivedAt: new Date().toISOString(),
    replayHash,
    result: {
      score: replay.score,
      timeMs: replay.timeMs,
      won: replay.won,
      height: replay.height,
      failure: replay.failure,
    },
  });

  return NextResponse.json({
    ok: true,
    verified: true,
    verification_id: verificationId,
    audit_id: verificationId,
    replay_hash: replayHash,
    score: replay.score,
    time_ms: replay.timeMs,
    height: replay.height,
    failure: replay.failure ?? null,
    won: replay.won,
    authoritative_source: "SERVER_REPLAY",
    client_score_ignored: true,
  });
}
