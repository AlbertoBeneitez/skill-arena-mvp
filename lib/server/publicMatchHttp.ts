import { randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import { sha256 } from "./matchIntegrity";
import { getProductionPostgresPool } from "./postgresPool";
import { PostgresPublicAttemptRepository } from "./postgresPublicAttemptRepository";
import { PublicMatchService } from "./publicMatchService";
import { PublicAttemptError } from "./publicAttemptRepository";
import {
  SigningKeyUnavailableError,
  legacyStatelessTrainingAllowed,
} from "./runtimeMode";
export const PUBLIC_ACTOR_COOKIE = "arena_match_training";
export const persistentMatchesRequested = () =>
  process.env.ALLOW_PERSISTED_MATCH_TRAINING === "1";
/**
 * Gate for the stateless training path (no database, no stored attempt).
 * Closed in production unless ALLOW_LEGACY_STATELESS_TRAINING=1.
 */
export function requireLegacyStatelessTraining() {
  if (!legacyStatelessTrainingAllowed())
    throw new PublicAttemptError("LEGACY_TRAINING_DISABLED", 503);
}
export function getPublicMatchService() {
  if (!persistentMatchesRequested() || !process.env.DATABASE_URL)
    throw new PublicAttemptError("MATCH_STORAGE_UNAVAILABLE", 503);
  const u = new URL(process.env.DATABASE_URL),
    local = ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
  if (
    !["postgres:", "postgresql:"].includes(u.protocol) ||
    (local
      ? process.env.VERCEL === "1"
      : u.searchParams.get("sslmode") !== "verify-full")
  )
    throw new PublicAttemptError("MATCH_STORAGE_UNAVAILABLE", 503);
  return new PublicMatchService(
    new PostgresPublicAttemptRepository(getProductionPostgresPool()),
  );
}
export function actorFromRequest(req: NextRequest) {
  const capability = req.cookies.get(PUBLIC_ACTOR_COOKIE)?.value;
  if (!capability || !/^[a-f0-9]{64}$/.test(capability))
    throw new PublicAttemptError("SESSION_REQUIRED", 401);
  return sha256("arena/training/actor:" + capability).slice(7);
}
export const newActorCapability = () => randomBytes(32).toString("hex");
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin"),
    site = req.headers.get("sec-fetch-site");
  const url = new URL(req.url),
    protocol =
      req.headers.get("x-forwarded-proto") ?? url.protocol.slice(0, -1);
  if (protocol !== "http" && protocol !== "https")
    throw new PublicAttemptError("ORIGIN_REJECTED", 403);
  // Construct afresh: URL.host assignment would retain the adapter's internal port.
  // The deployment proxy must overwrite forwarded protocol; it is not an actor credential.
  let expected: URL;
  try {
    expected = new URL(`${protocol}://${req.headers.get("host") ?? url.host}`);
  } catch {
    throw new PublicAttemptError("ORIGIN_REJECTED", 403);
  }
  if (
    expected.username ||
    expected.password ||
    expected.pathname !== "/" ||
    expected.search ||
    expected.hash ||
    site === "cross-site" ||
    (origin !== null && origin !== expected.origin)
  )
    throw new PublicAttemptError("ORIGIN_REJECTED", 403);
}
export async function readBoundedJson(req: Request, limit: number) {
  const reader = req.body?.getReader();
  if (!reader) throw new PublicAttemptError("INVALID_JSON", 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new PublicAttemptError("PAYLOAD_TOO_LARGE", 413);
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch (e) {
    if (e instanceof PublicAttemptError) throw e;
    throw new PublicAttemptError("INVALID_JSON", 400);
  } finally {
    reader.releaseLock();
  }
}
export function publicMatchError(error: unknown) {
  const e =
    error instanceof PublicAttemptError
      ? error
      : error instanceof SigningKeyUnavailableError
        ? new PublicAttemptError(error.code, 503)
        : new PublicAttemptError("MATCH_STORAGE_UNAVAILABLE", 503);
  return Response.json(
    { ok: false, verified: false, error: e.code },
    { status: e.status, headers: { "Cache-Control": "no-store" } },
  );
}
