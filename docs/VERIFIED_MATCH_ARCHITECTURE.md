# Verified match architecture

This document describes the shared competitive verification path used by
Skill Arena. Tower Drop V2 and Precision Stack V1 are the two reference
implementations.

## Authority boundary

The browser is responsible for presentation and collecting player input. It is
not authoritative for competitive score, elapsed simulation time, winner or
failure reason.

The server issues:

- an immutable `MatchManifest`;
- a signed `AttemptTicket`;
- the competitive seed.

The client returns:

- the same manifest and ticket;
- the ordered tick-indexed input stream;
- the final simulation tick.

The server validates the payload, resolves the registered verifier for
`game_id + game_version`, replays the frozen core and derives the result.

## Shared contracts

The common contracts live in:

- `lib/verified/contracts.ts`;
- `lib/verified/inputValidation.ts`;
- `lib/verified/useVerifiedAttempt.ts`;
- `lib/server/verifiedMatch.ts`;
- `lib/server/gameVerifiers.ts`.

`useVerifiedAttempt` owns the repeated client session mechanics: start,
manifest/ticket storage, ordered input capture, request cancellation and replay
submission. Games do not duplicate the verified-match HTTP protocol.

## MatchManifest

Manifest version 2 binds:

- game id and explicit game version;
- engine version;
- rules hash;
- gameplay-content hash;
- server-issued seed;
- simulation tick rate and coordinate space;
- end condition;
- stake/currency/tie rule/target;
- input protocol version, allowed actions and maximum input count;
- creation timestamp.

A competitive seed is created by the server. Demo-only fixed seeds may still
exist in catalogue metadata for legacy games, but verified games use the
manifest seed.

## AttemptTicket

A ticket binds one player attempt to one manifest hash and contains:

- attempt id;
- match id;
- player id;
- player slot;
- manifest hash;
- issue/expiry time;
- nonce;
- HMAC signature;
- demo/production signing mode.

Malformed, expired, mismatched or incorrectly signed tickets are rejected.

## Game verifier registry

`lib/server/gameVerifiers.ts` is the server-only dispatch boundary.

Each verified game adapter declares only the data the shared infrastructure
needs:

- game/version/engine identity;
- simulation configuration;
- typed input protocol constraints;
- rules/content descriptors used for hashing;
- authoritative replay adapter.

Game-specific physics, collision and scoring stay inside each versioned core.

Current adapters:

- Tower Drop `2.1.0` → `towerDropCore.v2.ts`;
- Precision Stack `1.0.0` → `precisionStackCore.v1.ts`.

## Input protocol

Inputs are closed action sets, not arbitrary strings at the game boundary.

Examples:

```ts
{ seq: 0, tick: 139, action: "DROP" }
```

Shared validation rejects:

- malformed inputs;
- wrong sequence numbers;
- repeated or descending ticks;
- actions outside the manifest protocol;
- inputs after the final tick;
- excessive input counts;
- invalid final ticks.

The verify endpoint also rejects request bodies above its configured byte
limit before replay.

## Replay and result

The verification flow is:

1. client requests `POST /api/verified-match/start` with `game_id`, stake
   and target;
2. server resolves the registered competitive game;
3. server creates manifest + seed + signed ticket;
4. client runs the pure core and records inputs by simulation tick;
5. client submits manifest + ticket + inputs + final tick to
   `POST /api/verified-match/verify`;
6. server validates manifest, ticket and input protocol;
7. server replays the frozen core;
8. server performs real-time sanity checks;
9. server returns authoritative score/time/outcome plus replay hash and
   verification id;
10. platform accepts competitive results only when `verified === true`.

Client-reported score is never trusted.

## Frozen cores and versioning

Once a competitive version has produced persistent matches, outcome-affecting
behaviour is frozen. Changes to physics, hitboxes, movement, tolerances,
scoring, generation or rules require a new game version.

Historical replay support therefore identifies the exact core used by the
manifest. Presentation-only changes may evolve independently provided they do
not alter input semantics.

## Determinism tests

Both reference games have permanent deterministic fixtures.

Tests cover:

- same seed + same ordered inputs → identical state/result;
- 60/120/144 Hz render scheduling → identical competitive outcome;
- invalid sequence/action/tick/payload cases;
- permanent golden score/failure/time/replay hash fixtures.

`pnpm test:determinism` runs these regressions in CI.

## Security scope still outside this MVP

Before real-money production, the platform still needs:

- authenticated player identity instead of demo ids;
- durable attempt/match/replay storage;
- production signing secret management;
- rate limiting and abuse controls;
- replay retention/dispute policy;
- bot/automation controls;
- authoritative two-player settlement wired to the ledger.

Those concerns extend this verified-match layer; they do not change the game
core contract.
