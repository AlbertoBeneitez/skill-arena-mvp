# ADR 005 — Shared versioned scenarios

Status: **ACCEPTED**, implementation staged. The owner approved V3 compatibility
and a migration by small units. This ADR extends the existing architecture
contract for a demonstrated cross-game requirement, not for one game's UI.

## Problem

All compatible games need a reproducible scenario identity and many generated
courses. A competitive pair must share one manifest selected by the server;
independent demo starts do not provide that guarantee. Signed historical V2
manifests must remain replayable byte-for-byte under the existing canonical
hash/signature algorithms.

## Decision

Use a discriminated `MatchManifestV2 | MatchManifestV3` in the existing contract.
V2 retains its exact wire fields. V3 adds a mandatory `scenario` descriptor:

```text
game_id + game_version + scenario.scenario_id
+ scenario.generator_version + seed + inputSequence
```

The game version pins outcome-affecting rules. The generator revision pins the
scenario-to-seed mapping. Full canonical manifest hashes bind all of these
fields, and AttemptTicket signatures bind that hash as before. Do not attach
new fields to a historical V2 payload or recalculate its rules/content hashes.

Reuse the current registry, seeded utilities, pure cores, verifier archive,
client attempt hook and HTTP boundary. Put the existing canonical hashing and
HMAC signing primitives in `lib/server/matchIntegrity.ts` so their real runtime
implementation can be tested in Node without loading React or HTTP handlers.
Keep the public `hashManifest` export from `verifiedMatch.ts` compatible.

## Staged implementation

1. Contract and compatibility fixtures: V2 hash/signature goldens, V3 tuple
   binding, unchanged game replay goldens. **Current unit.** Existing routes
   still create and accept V2 only. No V3 match is issued yet.
2. One shared, pinned generator maps bounded scenario indices to reproducible
   seeds. Server selection uses crypto; no file per scenario and no browser
   selection of competitive seeds. Test bounds, mapping, golden fixtures and
   matching pair identity before enabling V3 issuance.
3. Add a narrow persisted match/attempt/result repository in the existing
   server layer. PostgreSQL is the production target. Any memory adapter is
   explicitly demo/test-only. Preserve immutable manifests and consume attempts
   atomically; retries return one stored result.
4. Add authenticated participant/membership checks and server-owned conditions.
   Both participants recover the same stored manifest. Missing database/auth
   configuration prevents real competition rather than silently using mocks.
5. Extend existing routes/lifecycle and integrate one verified game at a time.
   Continue supporting historical V2 manifests and exact versioned adapters.

## Limits

This contract unit is not matchmaking, persistence, authentication, settlement
or a production-readiness claim. Existing demo identity, isolated attempts and
ticket-consumption limitations remain until their respective units are closed.
Do not replace a VERIFIED core or promote any legacy game during this migration.

## Contract unit validation

`pnpm check` and the production build passed. The test runner preserves the
frontend's Bundler type resolution and uses a Node-only ESM loader for emitted
test imports; no checks or assertions are disabled. V2 canonical hash/HMAC
fixtures and every existing core replay hash remain unchanged.

HTTP QA confirmed that starts remain V2, browser seed overrides have no effect,
tampered tickets are rejected, and V3 payloads are not yet accepted. Chromium
mobile smoke coverage loaded/unmounted all 19 games and started all five
verified versions without application console errors. A complete Dino Dash V2
manifest attempt returned a server-replayed result (`OBSTACLE_COLLISION`), score
283 and a replay hash. Human device/game-feel QA remains pending.
