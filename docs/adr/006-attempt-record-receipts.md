# ADR 006 — Unfinished attempt record receipts

## Context

The browser must send the ordered match record when a player leaves a running
game. A reproducible unfinished prefix is not a verified competitive outcome.
The existing `/api/verified-match/verify` endpoint accepts only terminal replays;
calling every unfinished sequence a victory or advancing the simulation after
the player leaves would change fairness and historical rules.

## Decision

Keep the historical terminal envelope and result unchanged. Add the explicit
optional envelope discriminator `record_kind: "abandoned"` for an unfinished
record. This field is outside the signed manifest and ticket. It does not change
game versions, gameplay hashes, seed issuance, input semantics or archived cores.

Both modes use the same manifest/ticket validation, ordered input validation,
registered adapter replay, body limits and simulation clock-lead check.
An abandoned record is accepted only when replay reports exactly
`CLIENT_ENDED_BEFORE_RESOLUTION`: all inputs were consumed, the tick matches,
and the core is still running. Other errors remain errors. A terminal replay
labelled as abandoned is rejected with `TERMINAL_RECORD_REQUIRES_VERIFICATION`.
It must use the existing terminal path.

The acknowledgement contains only `ok: true`, `received: true`,
`verified: false`, `durable: false`, `attempt_id` and `final_tick`. It exposes no
score, winner, height, competitive time, verification id or replay result. It
acknowledges reception and processing in that request, not durable storage.
It must never reach the game-result, ranking or settlement path.

The shared client lifecycle captures the last actually simulated tick and status
alongside the existing ordered input log. Before clearing a started session it
commits one immutable snapshot: the terminal path if already terminal, otherwise
the explicit unfinished record. A committed terminal request takes priority;
leaving or restarting preserves the transport and discards stale callbacks.
No simulation is advanced during cleanup and no DOM clock or client score
becomes authoritative.

## Consequences and limits

There is no additional endpoint, replay engine, provider or production storage.
Historical requests without the discriminator retain terminal-only validation,
hashes and result fields. Private V3 manifests remain unavailable through this
public endpoint; Mine/Solitaire legacy coverage is still a separate migration
through the existing hidden-information authority.

This unit does not adjudicate abandonment as a loss/refund, consume an attempt,
persist a result or settle money. Durable idempotent storage, retries, retention
and identity remain staged integration work. A successful processing receipt is
not an offline-delivery guarantee. Hard shutdown or unavailable networking can
still prevent receipt. Real users, money and competition remain disabled.
