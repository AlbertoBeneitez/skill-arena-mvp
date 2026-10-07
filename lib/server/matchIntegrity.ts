import { createHash, createHmac } from "node:crypto";
import { canonicalJson } from "../verified/canonical";
import type { AttemptTicket, MatchManifest } from "../verified/contracts";

// Keep the algorithms and canonical serializer used by historical V2 tickets.
// Isolated from registry/React so the real signing path can be tested in Node.
export function sha256(value: string) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

export function hashManifest(manifest: MatchManifest) {
  return sha256(canonicalJson(manifest));
}

export function signAttemptTicket(
  ticket: Omit<AttemptTicket, "signature">,
  secret: string
) {
  return createHmac("sha256", secret)
    .update(canonicalJson(ticket))
    .digest("base64url");
}
