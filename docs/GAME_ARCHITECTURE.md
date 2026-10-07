# Skill Arena game architecture

Status: **STABLE**. Tower Drop V2, Precision Stack V2, Piano Rush V1, Jet Stream V1 and Dino Dash V1 pass the common registry/server-replay contract and deterministic replay tests. The external game contract is frozen; changes require a demonstrated cross-game need rather than convenience for one implementation.

Promotion beyond `INTEGRATED` follows the mandatory cycle in `docs/GAME_PROFESSIONALIZATION_CYCLE.md`.

## Boundaries

```text
Skill Arena platform
  auth · wallet · matchmaking · stakes · ranking · groups · global UI
        |
        v
Game integration layer
  lib/games.ts registry · GameLoader · GameResult · lazy loading
        |
        v
Competition layer
  lib/verified/* · manifest · seed · ticket · hashes · replay
  lib/server/gameVerifiers.ts · authoritative server adapters
        |
        v
Game implementation
  competitive core · inputs · rules · scoring
  presentation · camera · effects · audio/haptics · tests
```

The platform owns money, opponents, navigation and settlement. A game owns its
rules and presentation. Platform code must not know game gravity, hitboxes,
spawn algorithms or collision details.

## Single game registry

`lib/games.ts` is the single catalogue/registry. Every registered game declares:

- id and explicit version;
- maturity: `DEMO | INTEGRATED | VERIFIED | PRODUCTION-GRADE`;
- metadata used by the catalogue;
- lazy component loader;
- competition capability.

`GameLoader.tsx` contains no per-game switch. It resolves the registered lazy
loader and passes the common runtime props.

Legacy games remain usable with the one documented compatibility cast in the
registry. New games should accept `GameRuntimeProps` directly.

## Competitive games

A verified game has a pure core that can run in Node without React, Canvas,
DOM, wall-clock time, audio or device APIs.

The server creates a versioned manifest containing the game identity, engine
version, rules/content hashes, server-issued seed, simulation configuration,
competition configuration and input protocol. An AttemptTicket binds a player
attempt to the manifest hash.

The browser records only ordered, tick-indexed inputs. The server validates the
manifest/ticket/input sequence, replays the registered core and derives the
authoritative result. Client score is ignored.

The shared client lifecycle is `useVerifiedAttempt`. It starts an attempt,
owns the ticket/manifest, records ordered inputs, aborts pending requests on
unmount and submits the replay. Game components do not duplicate the verified
match HTTP protocol.

## Determinism

Reuse `lib/deterministic/`. Do not create another RNG and never use
`Math.random()` in competitive rules.

For a verified version:

```text
gameVersion + rules + seed + initial configuration + inputs
= identical authoritative result
```

The visual renderer may differ by device or refresh rate. Competitive state
may not.

## Versioning and frozen cores

A change to physics, collision, tolerances, speed, scoring, pieces, generation
or any other outcome-affecting rule requires a new game version.

Never silently change a core that has produced persistent competitive matches.
Historical replays must remain reproducible. A versioned file such as
`precisionStackCore.v1.ts` is acceptable when it is the clearest way to keep
that invariant.

Presentation-only changes do not require a competitive version bump unless
they alter input timing semantics.

## Lifecycle

External lifecycle is intentionally small:

- module load is lazy through the registry;
- mount allocates presentation resources;
- `active=true` starts the attempt;
- finish produces one `GameResult`;
- a changed instance key restarts the mounted game;
- unmount/stop must cancel RAF, timers, listeners, pending requests and audio.

Verified competitive attempts currently do **not** support pausing the
authoritative clock. A future pause/resume product requirement must define its
fairness policy before changing this contract. Do not silently stop simulation
when the page is hidden and call that a competitive pause.

## Game-internal structure

Do not force identical folders on every game. Separate responsibilities when
complexity justifies it:

1. **competitive core** — state, rules, physics, scoring, terminal condition;
2. **input** — typed actions and validation;
3. **presentation** — Canvas/DOM/WebGL, camera, animations, particles;
4. **feedback** — SFX, haptics, shake and decorative effects.

Presentation and feedback never decide competitive outcomes.

Tower Drop, Precision Stack, Piano Rush and Jet Stream demonstrate this split: pure outcome-affecting cores live under `lib/verified/`; React/Canvas adapters and optional presentation helpers live under `components/games/`; server replay dispatch remains in `lib/server/gameVerifiers.ts`.

## Adding a game

1. Choose the mechanic and, if useful, audit a mature permissive implementation.
2. Verify code **and asset** licences separately.
3. Prototype external code only in the laboratory; do not import a repository wholesale.
4. Create the game module and explicit version.
5. Add one registry entry with metadata and lazy loader.
6. Define a typed input protocol.
7. For competition, create a pure deterministic core and server replay adapter.
8. Add deterministic, input-validation and golden replay tests.
9. Polish presentation independently from competitive rules.
10. Test mobile touch/layout, cleanup and restart.
11. Record upstream commit/tag, modifications and asset status in
   `THIRD_PARTY_NOTICES.md`.
12. Raise maturity only when its corresponding guarantees are actually met.

## Legacy migration

Do not mass-migrate. Existing games may stay `INTEGRATED` and client-result
based. Piano Rush and Jet Stream have now migrated. Dino Dash is also verified. The current product roadmap is in `docs/PRODUCT_BACKLOG.md`; 2048 is retired from the v19 catalogue. Remaining migrations proceed one game at a time, after the shared competitive match prerequisites.

## Open-source import rule

Use surgical import:

```text
run original
→ inspect licence and provenance
→ identify the gameplay-producing modules
→ extract only useful mechanics/code
→ replace unclear assets
→ adapt to Skill Arena deterministic core
→ add tests and notices
```

Never assume an MIT/BSD/Apache code licence grants rights to sprites, music,
characters, logos, fonts or trademarks.

## Current maturity

- Tower Drop: **VERIFIED** competitive reference core.
- Precision Stack: **VERIFIED**, current V2 core with faster cadence, adaptive perfect window and minimum-stable-overlap rule; frozen V1 remains replayable for historical manifests.
- Piano Rush: **VERIFIED**, with seeded timing chart and typed lane protocol.
- Jet Stream: **VERIFIED**, with seeded gate course and typed FLAP protocol.
- Remaining catalogue: **INTEGRATED** legacy games pending one-by-one professionalisation.
- `PRODUCTION-GRADE` remains reserved for games that also pass real-device QA,
  operational security requirements and production settlement integration.

## Professionalisation gate

`VERIFIED` means server-authoritative replay and deterministic outcome; it does
not by itself claim commercial-grade game feel. A game is only a finished
quality pass when its input, responsive rendering, lifecycle cleanup,
presentation, feedback, difficulty curve and relevant open-source provenance
have also been reviewed.

Competitive rules stay in a pure versioned core. Camera, particles, decorative
animation and haptics remain presentation/feedback unless changing them would
alter input semantics.

## Freeze rule

The registry/runtime/verified-match contract is the Skill Arena standard from
this point forward. New games adapt to it. A future change to the common
contract must document the concrete cross-game requirement in a new ADR and
must preserve historical replay compatibility.

## Non-goals

No event bus, new global store, DI framework, ECS, microservices or plugin
framework. The architecture should remain explicit and boring.
