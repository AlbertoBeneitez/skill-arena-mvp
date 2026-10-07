# Product evolution from v18-mobile

## Baseline and execution

Stable recovery point: `v18-mobile` at
`6edf319f06a34936ddca7dc84e86b63591c35982`. Product work starts on
`v19-mobile`. Do not move the stable branch or `mobile-test`, rewrite valid
history, or apply the quarantined v17-based working copy wholesale.

This document records product scope and dependencies. `lib/games.ts` remains
the runtime registry. Follow `GAME_PROFESSIONALIZATION_CYCLE.md` for each game:
audit, implement one bounded change, deterministic/specific tests, typecheck,
build, mobile/browser QA, review provenance, and commit. Continue with the next
unit unless an architecture, fairness, security, compatibility or data decision
needs the owner's input. Passing automation does not replace human device QA.

Do not promote a legacy game to VERIFIED through presentation changes. Do not
change a published competitive core in place. Preserve historical verifier
adapters and their golden fixtures. No new third-party code or assets have
been imported in the initial catalogue retirement unit.

## Shared infrastructure audit and decision gate

Keep and extend these existing boundaries:

- Registry and lazy loading: `lib/games.ts`, `components/GameLoader.tsx`.
- Reproducible generators: `lib/deterministic/seeded.ts`; audit the small legacy
  challenge catalogues in `lib/deterministic/challengeSets.ts` before migration.
- Versioned pure cores: `lib/verified/*Core.v*.ts`.
- Input validation and canonical serialization: `inputValidation.ts`,
  `canonical.ts`; do not introduce another RNG, serializer or replay engine.
- Shared client attempt lifecycle: `useVerifiedAttempt.ts`.
- Server manifest/ticket and append-only verifier dispatch:
  `lib/server/verifiedMatch.ts`, `lib/server/gameVerifiers.ts`.
- Existing golden, invalid-input and 60/120/144 Hz tests:
  `scripts/verify-competitive-games.ts`.

The current start endpoint creates an independent random-seed manifest and a
new `demo-player` in slot A on every call. It does not create/recover one
persisted match for two authenticated participants. Manifest V2 has no
scenario identifier. Stake/target arrive from the browser. The verify endpoint
replays the core correctly, but neither consumes an attempt atomically nor
persists the result; retrying can create another verification id. The shared
hook can also initiate repeated verification requests. Existing wallet,
opponents, groups and ranking in `DemoApp` are demonstrations.

**Decision gate before activating the production match contract:** define
the authenticated player boundary and the durable match/attempt repository.
The target database is PostgreSQL, never production SQLite or process memory.
Missing database/auth configuration must fail closed for real competition;
any in-memory adapter must be explicitly demo/test-only. Confirm the migration
boundary before changing acceptance rules. The owner accepted the compatible
V3 migration by units; see `adr/005-versioned-scenarios.md`. Production identity
and database service configuration are still required before real matches.

Proposed units, each with its own validation and commit:

| Unit | Scope | Dependency / acceptance |
| --- | --- | --- |
| S1 | ADR for versioned scenario descriptor and manifest compatibility | Owner decision; preserve signed V2 replays; do not silently add fields to V2 |
| S2 | Shared seed-based scenario generation descriptors | `gameId + gameVersion + scenarioId + seed`; pinned generator revision; bounded scenario parameters; reproducibility tests; no hundreds of handwritten files |
| S3 | Match/attempt repository and PostgreSQL schema | Decide auth boundary first; transactions, immutable manifests, participant slots, migration/retention policy; demo adapter isolated |
| S4 | Server-issued shared match scenarios | S1–S3; both participants recover the same manifest; no client-selected competitive seed, target or rules; enforce membership |
| S5 | Single result per attempt and lifecycle protection | S3–S4; atomic replay verification/result persistence, idempotent retry, cancellation/generation checks, double-submit tests |
| S6 | Integrate current VERIFIED games with shared scenarios | One game per unit; keep frozen cores/adapter archive; fixture and scheduling equivalence |
| R1 | Server leaderboard read model | S3–S5; agree global ranking metric and tie policy; net profit from settled ledger entries, not local storage |
| R2 | Global and net-profit ranking UI | R1; pagination, loading/empty/error states; visibly separate demo data module |
| B1 | Inspect `skill-arena-rgpd-backend-ready` | Source not supplied/available in the checkout; audit before any import; adopt only useful parts, provenance and licences |
| B2 | Integrate selected RGPD/backend parts | B1 and relevant server units; avoid duplicate auth, ledger, repositories or routing |

Global ranking aggregation across different game score scales is a product
decision, not an arbitrary sum of incomparable client scores. Profit requires
an authoritative settlement definition, including refunds and fees.

## Game units

The first independent unit removes 2048. Subsequent rule-changing units follow
the shared competition prerequisites. Within each row the units execute in
order, each separately audited and committed. Tuning a new version is allowed
before publication; published/versioned behavior stays immutable.

| Game | Ordered executable units | Competitive boundary |
| --- | --- | --- |
| 2048 | C1: retire registry entry, lazy import, component, cover and exclusive CSS; inspect group selection and persisted state | No server adapter or historical VERIFIED replay exists for this game; preserve historical licence notices |
| Dino Dash → Alien Dash | A1: rename visible/accessibility/cover text and space presentation; A2: versioned enemy/variable-height obstacle course; A3: life pickups and progression | Retain internal `dino-dash` identity and V1 replay; outcome changes require a new competitive version |
| Stack | K1: audit current projection/core; K2: new alternating X/Z placement core with 2-axis overlap and scoring; K3: 3D presentation and touch polish | Preserve Precision Stack V1/V2; a 3D projection alone does not implement perpendicular-axis gameplay |
| Tower Drop | T1: audit existing pendulum/release momentum/landing; T2: new version only for demonstrated physics improvement; T3: presentation/feedback | V2 already models pendulum and release momentum; do not replace it without measured reason |
| Jet Stream | J1: new version with variable gate widths and occasional two passages in one vertical; J2: deterministic life pickups; J3: pacing and mobile feedback | Preserve V1; collision, collectible locations and rules belong in new seeded core |
| Reaction Test → Shot Gallery | H1: pure multi-round recognition core and closed inputs; H2: versioned seeded colour/shape/number trials and aggregate scoring; H3: name, visual/input integration and verifier | Current five-round UI uses wall time and an average-based final bonus; it is not server verified |
| River Dash | D1: movement/carry/collision audit and reproducible incongruence fixture; D2: corrected pure movement core/verifier; D3: mobile readability and pacing | Fix logic before visuals; define road/river coordinate semantics explicitly |
| Serpent | N1: extract deterministic movement core and input/replay; N2: wrap in four directions and self-collision tests; N3: name and space visuals | Current grid edge death is a rule; wrapping is a versioned behavior change |
| Stack Shift | F1: piece/support/rotation/settling audit and fixtures; F2: corrected pure core/verifier; F3: space background and landing feedback | Validate support and collisions before visual polish |
| Orb Burst | O1: trajectory/board/scoring/input audit and pure core; O2: bounded deterministic difficulty/progression; O3: aim/feedback/readability polish | Preserve useful existing mechanics; verify launch inputs and collisions |
| Sky Hop | Y1: deterministic platform/movement core; Y2: seeded dynamic platform situations/progression; Y3: touch/camera/feedback | Device height and render rate must not determine landing/outcome |
| Pulse Runner | P1: deterministic running/jump/obstacle core; P2: course variety and difficulty progression; P3: control feel and presentation | Reuse tick inputs and replay infrastructure |
| Metro Shift | M1: deterministic lane/jump/collision core; M2: variety and progression; M3: orbital setting/presentation | Keep useful lane mechanics; shared scenario and input validation |
| Mine Grid | I1: board/reveal/flag/scoring audit and pure core; I2: seed-versioned level generation/progression; I3: readable mobile level UI | Test board validity and solvability policy; keep both participants' initial conditions identical |
| Solitaire Sprint | L1: space background only; L2: separate future pure card/action verifier audit | L1 does not change deck, inputs, scoring, layout or maturity |
| Brick Relay | E1: pure ball/paddle/collision/scoring core; E2: seeded stage progression/pacing; E3: feedback and touch | Quantized paddle inputs and fixed simulation; avoid device-dependent collision |
| Maze Rush | Z1: pure map/movement/pursuer core and verifier; Z2: readable seed-generated progression; Z3: mobile navigation/feedback | Validate reachability and pursuer rules before progression |
| Star Phalanx | W1: pure ship/projectile/enemy core and verifier; W2: enemies enter layer by layer with seeded increasing waves; W3: clarity/feedback | Spawn schedules belong to ticks/rules, never render timers |

For vague requests such as “improve professionally”, the audit must produce a
bounded measurable unit (e.g. input latency, readability, solvable layouts,
collision ambiguity, deterministic progression) before editing. Product scope
must not be treated as a reason to rewrite an otherwise stable core.

## C1 audit and validation record

- Component/UI, input, scoring and lifecycle were co-located in
  `components/games/Merge2048.tsx`; local seeded events came from shared RNG.
- Integration was one `lib/games.ts` entry plus catalogue order. No dedicated
  route, server replay adapter, golden fixture or shared core depended on it.
- `GameLoader` derives lazy loaders from the registry. `DemoApp` and `GroupHub`
  derive individual/group selectors from `GAMES`; saved profile/group data
  does not persist a selected game or competition game list.
- Remove only the retired entry/module/cover/exclusive styling. Keep shared
  styles, deterministic utilities, other registry identities and all verifiers.
- Historical documentation/licence notices remain; current architecture docs
  point to this backlog instead of recommending 2048 migration.
- C1 validation passed: `pnpm check` (existing lint/typecheck and all
  deterministic replay/invalid-input/render-rate/golden fixtures), `pnpm build`,
  and `git diff --check`. No changes to cores, replay adapters, manifest,
  endpoints, dependency declarations or lockfile relative to v18.
- Chromium 151 smoke QA passed at 390×844 and 844×390: 19 catalogue entries,
  all covers loaded, no 2048 in individual/group selectors, all 19 lazy modules
  mounted/unmounted successfully, all five VERIFIED games started with their
  expected server-issued version, no application console errors or failed HTTP
  responses. This is integration smoke coverage, not full gameplay/device QA.
- Human mobile-device QA remains pending; no maturity promotion is claimed.

## Deployment policy follow-up

GitHub reported Vercel `success` for v18 and the initial v19 commit, but the
status description was `Canceled by Ignored Build Step`. No ready preview was
created for those commits. Do not interpret a successful Vercel comment check
or canceled status as a successful deployment.

`vercel.json` overrides the project's Ignored Build Step for versions containing
this configuration. The documented `ignoreCommand` exit code **1 continues
the build** (0 skips it). The explicit `exit 1` therefore allows Git previews
to build; it does not suppress CI or change the build/install commands,
authentication or deployment protection. `mobile-test` and v18 remain unchanged.

Reference: https://vercel.com/docs/project-configuration/vercel-json#ignorecommand
