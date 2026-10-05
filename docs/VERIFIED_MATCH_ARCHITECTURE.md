# Verified Match Architecture — V6

V6 introduces the first server-authoritative competitive path for Skill Arena. Tower Drop is the reference implementation.

## Authority boundary

The browser renders the game and records user actions. It is **not** authoritative for score, elapsed competitive time, height, failure reason, or winner.

The server accepts only:

- the immutable `MatchManifest`,
- the signed `AttemptTicket`,
- the ordered tick-indexed input stream,
- the claimed final simulation tick.

The server replays the frozen game core and derives the authoritative result itself. No client score is submitted or trusted.

## Frozen game core

Tower Drop competitive logic lives in:

`lib/verified/towerDropCore.v1.ts`

Do not change the behavior of this file after production matches exist for version `1.0.0`. Any behavior change must create a new frozen version such as `towerDropCore.v2.ts` and a new `game_version`.

The core:

- has no React, DOM, Canvas, device APIs, or wall-clock time,
- runs at exactly 120 simulation ticks per second,
- uses integer milli-pixel state for competitive movement,
- accepts discrete `DROP` inputs indexed by simulation tick,
- ends only on the first defined failure.

## MatchManifest

The server creates the manifest. It binds:

- `match_id`,
- game and engine versions,
- gameplay-content hash,
- rules hash,
- tick rate and coordinate space,
- first-failure end condition,
- player count and attempts per player,
- stake/currency,
- tie rule,
- allowed input protocol.

The manifest is shared by both players in a real 1v1 and must be byte-equivalent after canonical serialization.

## AttemptTicket

Each player gets a different ticket. It binds one attempt to:

- `attempt_id`,
- `match_id`,
- `player_id`,
- player slot A/B,
- manifest hash,
- issue/expiry time,
- nonce.

The server HMAC-signs the ticket and verifies it with a timing-safe comparison before replay.

For development, a clearly marked demo signing key is used when `MATCH_SIGNING_SECRET` is absent. Production must configure a secret outside the repository.

## Input protocol

Tower Drop V1 accepts only:

`{ seq, tick, action: "DROP" }`

Rules:

- `seq` must start at zero and increase by one,
- ticks must be integer and strictly increasing,
- inputs cannot occur after `final_tick`,
- input count and attempt duration are bounded,
- game state is reconstructed exclusively from the initial state + ordered inputs.

## Verification flow

1. Client requests `POST /api/verified-match/start`.
2. Server returns manifest + signed attempt ticket.
3. Client starts the frozen core only after receiving them.
4. Client records `DROP` events by simulation tick.
5. First failure stops the client simulation.
6. Client sends manifest + ticket + inputs + final tick to `POST /api/verified-match/verify`.
7. Server validates manifest hashes/version and ticket signature/expiry.
8. Server replays Tower Drop V1 from tick zero.
9. If replay does not end in the same valid first-failure state, the attempt is rejected.
10. Server returns score/time/height/failure plus a replay hash and verification ID.
11. The UI uses only this server result for the competitive outcome.

## Anti-tamper scope

Implemented in V6:

- signed attempt ticket,
- immutable manifest hash,
- frozen content/rules hashes,
- strict input schema/order,
- server replay,
- client score ignored,
- attempt expiry,
- rough real-time sanity check,
- replay hash,
- golden deterministic test,
- 60/120/144 Hz render-rate equivalence test.

Still required before real money:

- authenticated player identity instead of demo player IDs,
- durable match/attempt storage,
- incremental input commitments or chunks,
- replay retention policy and dispute window,
- production `MATCH_SIGNING_SECRET`,
- rate limiting and abuse controls,
- automated mobile/browser device matrix,
- bot/automation detection,
- two-player settlement wired to the authoritative ledger.
