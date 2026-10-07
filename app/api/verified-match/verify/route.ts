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
  hashManifest,
  hashReplay,
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

  const adapter = manifestCheck.adapter;
  const inputError = validateInputSequence(inputs, finalTick, {
    version: adapter.inputProtocol.version,
    allowedActions: adapter.inputProtocol.allowedActions,
    maxInputs: adapter.inputProtocol.maxInputs,
    maxFinalTick: adapter.simulation.maxFinalTick,
  });

  if (inputError) return reject(inputError);

  const replay = adapter.replay({
    inputs,
    finalTick,
    manifest,
  });

  if (!replay.valid) {
    return reject(replay.error ?? "REPLAY_MISMATCH");
  }

  const elapsedWallMs = Date.now() - ticketCheck.issuedAt;
  const maxClockLeadMs = 2_500;
  if (replay.timeMs > elapsedWallMs + maxClockLeadMs) {
    return reject("SIMULATION_FASTER_THAN_REAL_TIME", 409);
  }

  const manifestHash = hashManifest(manifest);
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

  return NextResponse.json({
    ok: true,
    verified: true,
    verification_id: randomUUID(),
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
