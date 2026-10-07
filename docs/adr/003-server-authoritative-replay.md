# ADR 003 — Server-authoritative replay

## Context

A browser is controlled by the player and cannot be trusted to report score,
time or winner.

## Decision

The server issues the manifest, seed and signed AttemptTicket. The client sends
only ordered tick-indexed inputs and final tick. The server validates the
payload, resolves the registered game adapter, replays the pure core and
calculates the authoritative result. Client score is ignored.

## Consequences

Competitive outcomes are reproducible and auditable. Games that have not
migrated to this path remain explicitly `INTEGRATED`, not `VERIFIED`.
