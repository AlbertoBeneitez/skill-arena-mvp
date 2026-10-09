# AGENTS.md — GALACTIC GAMES

## Scope
Persistent operating rules for AI coding agents working on this repository.

Product name: **GALACTIC GAMES**.

Current conversational instructions override this file only when explicit.

## Read first
Before substantial work, read:
1. `AGENTS.md`
2. `docs/PRODUCT_BACKLOG.md`
3. `docs/GAME_PROFESSIONALIZATION_CYCLE.md`
4. `docs/GAME_ARCHITECTURE.md`
5. Relevant ADRs under `docs/adr/`
6. The actual current branch/code/tests

Code reality overrides stale documentation.

At every resumed session:
- inspect the requested base branch and HEAD;
- compare with `mobile-test` and newer `vXX-mobile` branches if relevant;
- work only on pending, partial, regressed, or insufficiently polished items;
- never redo validated work without a concrete reason.

After every stable `vXX-mobile` checkpoint, update `docs/PRODUCT_BACKLOG.md` so it matches reality.

## Highest priority
**Game quality > task count.**

Games should be:
- immediately understandable;
- mobile-first;
- easy to start;
- progressively harder;
- varied;
- fair;
- responsive;
- visually coherent;
- satisfying to control;
- deterministic/server-verifiable where required.

Preferred progression:
`easy start → understanding → confidence → increasing challenge → mastery`

Product sessions are one continuous run. Do not introduce levels or disguise
separate levels as sectors. Remove existing level mechanics incrementally in
new versions, preserving archived replay behavior. Difficulty may evolve within
the same run. Physical dartboard sectors and tower height are not levels.

Do not raise difficulty only by increasing speed.

## Product identity
Visible brand: **GALACTIC GAMES**

Direction:
`spatial + futuristic + premium + arcade + clean + competitive + mobile-first`

Rebrand visible surfaces, but do not rename historical/internal IDs, APIs, tables, routes, manifests, versions, secrets, or persisted identifiers unless technically necessary.

## Stable architecture
Reuse the existing architecture:
- registry: `lib/games.ts`
- loader: `components/GameLoader.tsx`
- deterministic utilities: `lib/deterministic/`
- versioned cores: `lib/verified/*Core.v*.ts`
- verified lifecycle: `useVerifiedAttempt`
- server verification: `lib/server/verifiedMatch.ts`
- verifier registry/archive: `lib/server/gameVerifiers.ts`
- existing deterministic/golden tests under `scripts/`

Do not create parallel RNGs, registries, replay engines, serializers, or per-game verification stacks.

## Competitive contract
Preserve:

`gameId + gameVersion + scenarioId + seed`
→ `ordered inputs`
→ `pure deterministic core`
→ `authoritative scoring`
→ `replay`
→ `server verification`
→ `authoritative result`

The client renders and records inputs. It must not authoritatively choose score, result, competitive seed/scenario, or rules.

Send the ordered match record at the deterministic terminal immediately, before
presentation animations finish. Leaving that screen must not cancel a committed
terminal upload or publish a stale result in a later session. Document incomplete
legacy coverage and delivery limitations instead of claiming universal recording.

Never downgrade a `VERIFIED` game to client-trusted scoring.

## Versioning
Published competitive behavior is immutable.

If physics, collisions, scoring, generation, lives, tolerances, spawn schedules, win/loss rules, or input semantics change, create a new competitive version.

Preserve historical:
- cores;
- verifier adapters;
- hashes;
- golden fixtures;
- replay compatibility.

Presentation-only changes do not need a core version bump unless they alter input timing or outcomes.

## Scenarios/seeds
Use the shared scenario system.

Same competitive match = same:
- game version;
- scenario;
- seed;
- rules;
- initial conditions.

The server selects/issues competitive scenarios. The browser must not freely choose competitive seeds.

## Per-game workflow
For each substantial game unit:

1. **Audit** current core/UI/inputs/scoring/lifecycle/registry/loader/replay/tests/licence/mobile behavior.
2. **Fix bugs first** and add regression coverage where practical.
3. **Improve gameplay**: learnability, progression, duration, fairness, variety, game feel.
4. **Improve presentation** without changing authoritative simulation.
5. **Validate competition**: determinism, replay, scoring, scenario/seed binding, historical compatibility.
6. **Real QA**: play several runs; test start, controls, first obstacle/level, progression, death, restart, terminal state, console.
7. **Automated validation**: relevant tests, deterministic tests, invalid inputs, golden tests, typecheck/lint, production build, `git diff --check`.
8. **Commit** as a small coherent unit.

Do not consider a game finished merely because it loads or compiles.

## Mobile quality
Check:
- portrait mobile layouts;
- touch targets;
- swipe/pointer reliability;
- pointer cancel/capture;
- accidental double inputs;
- safe areas;
- resize/orientation;
- canvas scaling;
- cleanup on unmount/restart;
- smooth presentation near 60 FPS on normal hardware.

Authoritative simulation must not depend on refresh rate or screen size.

## Ranking / auth / money
Real ranking data must come from authoritative server/settlement data.

Demo/mock data must stay internally separated from production. Do not use
"demo" in user-facing frontend copy. Describe actual scope with session local,
entrenamiento, saldo ficticio, rivales simulados or datos de ejemplo; never imply
that fictitious money, local identity or sample ranking data is real.

Do not activate real-money competition until production identity, PostgreSQL, settlement, and required compliance boundaries are configured.

Do not request or commit secrets.

## Privacy / RGPD
Follow `docs/RGPD_PACKAGE_AUDIT.md`.

Keep:
- data minimization;
- provider/repository separation;
- versioned consent;
- idempotent deletion;
- recovery from partial failure;
- secrets out of logs/repository.

For hidden-information games such as Mine Grid, deterministic replay alone is not enough; protect secret state separately.

## Third-party code/assets
Use surgical import only.

Verify code and asset licences separately. Do not copy protected commercial assets or branding. Record provenance in `THIRD_PARTY_NOTICES.md` when applicable.

## Version/checkpoint policy
Use recoverable branches:

`vXX-mobile`

Create a new version only for a coherent, stable, testable batch.

Each stable version must:
- descend from the previous validated version;
- preserve validated work;
- pass required tests;
- pass typecheck/lint;
- pass production build;
- be pushed to GitHub;
- have CI checked;
- have Vercel deployment checked when available.

Never force-push historical version branches.

## mobile-test
`mobile-test` is the stable test branch.

After a validated `vXX-mobile` checkpoint:
- update `mobile-test` only by normal fast-forward;
- never force-push;
- verify CI/deployment.

If fast-forward is impossible, stop and inspect divergence.

## Autonomy
Continue automatically through normal validated units.

Stop only for:
- irreversible architecture changes;
- replay incompatibility;
- destructive migrations;
- production auth activation;
- real-money/settlement activation;
- secrets;
- unclear licensing;
- major privacy/security/fairness decisions.

## Reporting
After each stable version, report briefly:
- version;
- HEAD;
- games/features changed;
- bugs fixed;
- tests/CI/build;
- Vercel;
- `mobile-test`;
- remaining backlog.

## Completion gate
Do not write `BACKLOG COMPLETADO` until:
1. `docs/PRODUCT_BACKLOG.md` has been reread;
2. backlog has been compared against actual code;
3. no required game/feature remains pending or partial;
4. no known control bug remains;
5. documentation has been updated to match the final state.

If anything is still partial, continue working instead of claiming completion.
