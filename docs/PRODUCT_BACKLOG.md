# Product evolution — current scope and recoverable versions

## Baseline and execution

Stable recovery point: `v18-mobile` at
`6edf319f06a34936ddca7dc84e86b63591c35982`. Product work started on
`v19-mobile`; continue from the latest validated published version. Preserve
all historical vXX-mobile branches. Update `mobile-test` only by normal safe
fast-forward after tests, CI and a ready Vercel deployment; never force-push or
rewrite valid history. Do not apply the quarantined v17-based working copy wholesale.

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
hook now protects verification with single-flight, terminal caching and generation
cancellation (v20). Durable server attempt consumption is still pending. Wallet,
opponents and groups remain demonstrations. The ranking now separates an
unconfigured real-source API from isolated, explicitly selected demo data (v31).

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
| S1 | Contract and compatibility fixtures implemented in `6a75815` | V2 still issued/accepted; signed V2 hashes and frozen cores preserved; ADR 005 accepted |
| S2 | Shared seed-based scenario mapping implemented | `SCENARIO_CATALOGUE.md`; 65,536 identifiers, pinned generator and tested bounds; selection helper not yet connected to real matches |
| S3a | Staged immutable match repository and PostgreSQL schema | `MATCH_PERSISTENCE.md`; trusted opaque identities, both slots, local/CI DB tests; no HTTP activation or production configuration |
| S3b | Atomic attempt/result persistence | S3a; idempotent consumption and retries, same manifest binding; independent of auth/DB vendors, no real competition activation |
| S4 | Server-issued shared match scenarios | S1–S3; both participants recover the same manifest; no client-selected competitive seed, target or rules; enforce membership |
| S5 | Single result per attempt and lifecycle protection | S3–S4; atomic replay verification/result persistence, idempotent retry, cancellation/generation checks, double-submit tests |
| S6 | Integrate current VERIFIED games with shared scenarios | One game per unit; keep frozen cores/adapter archive; fixture and scheduling equivalence |
| R1 | PostgreSQL read-only ranking repository staged in v31 | Snapshot-pinned keyset pages, exact cents, EUR, public-key ties; real settled ledger/public-profile projection and activation still pending |
| R2 | Global net-profit ranking UI implemented in v31 | Visible shortcut/navigation; explicit source selection, bounded pages, no fabricated personal position; demo never replaces real-source data |
| B1 | Owner-supplied package audited | `RGPD_PACKAGE_AUDIT.md`; useful concepts identified, unsafe/incomplete templates excluded; no source imported |
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
| Pulse Runner | RETIRED in v28 per latest owner request | No runtime/import/asset/test references; historical branches preserved |
| Metro Shift | M1: deterministic lane/jump/collision core; M2: variety and progression; M3: orbital setting/presentation | Keep useful lane mechanics; shared scenario and input validation |
| Mine Grid | I1: board/reveal/flag/scoring audit and pure core; I2: seed-versioned level generation/progression; I3: readable mobile level UI | Test board validity and solvability policy; keep both participants' initial conditions identical |
| Solitaire Sprint | L1: space background only; L2: separate future pure card/action verifier audit | L1 does not change deck, inputs, scoring, layout or maturity |
| Brick Relay | E1: pure ball/paddle/collision/scoring core; E2: seeded stage progression/pacing; E3: feedback and touch | Quantized paddle inputs and fixed simulation; avoid device-dependent collision |
| Maze Rush | Z1: pure map/movement/pursuer core and verifier; Z2: readable seed-generated progression; Z3: mobile navigation/feedback | Validate reachability and pursuer rules before progression |
| Star Phalanx | W1: pure ship/projectile/enemy core and verifier; W2: enemies enter layer by layer with seeded increasing waves; W3: clarity/feedback | Spawn schedules belong to ticks/rules, never render timers |

New product additions from the latest owner request:

| Game | Units | Acceptance |
| --- | --- | --- |
| Billiards | Fast limited-shot variant; integer physics/aim/power inputs and server replay; mobile controls and seeded progressive positions/obstacles | Same scenario/rules for opponents; no full simulator or copied commercial assets |
| Darts | Skill-based aim/timing; deterministic scoring and server replay; progressively smaller/varied targets and mobile feedback | Fast intuitive first throws; same conditions for opponents |

Current completed units: 2048 retirement (v19); shared client lifecycle and Alien/Solitaire space visuals (v20); Stack V3 perpendicular geometry (v21); Tower V3 swing (v22); Jet V2 windows/lives (v23); Serpent wrap/core (v24); River V1 motion (v25); Orb launch bug (v26); River V2 novice opening/progression (v27); Pulse retirement (v28); Tower composition and Jet terminal feedback (v29); Stack camera/shadows/axis clarity (v30); honest global net-profit ranking preparation (v31); Orb V1 authoritative core, sector progression, original presentation and touch regression (v32). These are unit completions, not blanket claims that every game is commercially frozen.

The current completion/partial-work ledger is [PRODUCT_BACKLOG_STATUS.md](PRODUCT_BACKLOG_STATUS.md).
It includes the validated v33–v52 units without repeating their implementation
records here. Sky Hop Y1–Y3 are implemented in v44 with a new integer core,
server replay, bounded progressive platforms, checkpoints and touch QA.
v45 adds registry-derived searchable game discovery, readable instructions and
coherent product navigation without changing competitive contracts.
Metro Shift M1–M3 follow in v46 using the same runtime and server verifier,
with a seeded 60-group course and three progressive sectors.
Brick Relay E1–E3 follow in v47 with four progressive sectors, directed rebounds,
three lives, armored/blast/moving bricks, authoritative replay and full touch QA.
v48 improves local-demo account readability, explicit fictitious money/actions,
empty states and information sections; the profit chart now aligns zero correctly.
Maze Rush Z1–Z3 follow in v49: fixed initial wall spawn, connected seeded sectors,
authoritative movement/pursuers/scoring, progressive pulses/shields and full touch QA.
Orbit Shift follows in v50 with a safe opening, 60 seeded gates, combined rings,
shields/pickups and common authoritative replay; full touch wins/losses/restarts.
Continue only with outstanding rows in that ledger. Human physical-device QA
and unconfigured production identity/ledger integration remain explicit limits.

Mine Grid hidden-information fairness requires a separate decision before VERIFIED promotion: public seeded layouts expose all mine positions. Audit hidden-state requirements for Solitaire as well. Keep existing maturity and training behavior while preparing a common proposal; do not silently claim that replay alone protects secret boards.

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

Piano Rush follows in v51 with a finite 48-note V2, protected learning phase,
three precision sectors, shields, common clock and authoritative replay. V1 stays
frozen; native touch wins/losses/restarts pass in both orientations.

v52 improves group demo clarity, configuration validation and actionable clipboard
feedback, with native touch league/tournament/start/exit QA in both orientations.
Solitaire audit identifies premature completion, incorrect natural-win status and
repeatable move score. Fix in a new version; reuse common hidden authority rather
than exposing future cards or enabling real competition with local storage.

## Revisión de producto · 9 octubre 2026

Solicitud vigente: un único nivel/recorrido continuo. Comparar altura o avance
real alcanzado, con menor tiempo autoritativo decimal en empates; NO crear una
conversión artificial puntos→niveles. Requiere contrato/métricas versionadas.

Tandas pendientes: segmentos Jet menos alineados; River con separación fluida;
añadir enemigo Sky; ampliar escenarios Mine y Solitaire con generación versionada;
Maze más fácil y continuo. Portadas deben representar la mecánica actual.
v53: entrada reducida a identidad/accesos, logo original desarrollado, Avatar con
ranking, catálogo sin títulos duplicados, CAMBIAR y retirada de coaching genérico.
Saturno compartido más elaborado, proyecciones Stack/Tower retiradas, nodos Maze
ampliados. Dardos V2 usa swipe ascendente sin botón, preservando V1. La transición
a resultados protege los controles 350 ms contra toques de finalización.
Validación incremental y evidencia en docs/releases/v53-mobile.md.

Siguen pendientes las mejoras de recorrido/dificultad/datasets indicadas arriba. No se declara Maze más fácil por ampliar
sus nodos. El alcance de altura/avance frente a puntuación requiere aclaración:
Stack, Stack/Tower o una métrica propia por juego; no se altera scoring histórico.

v54 amplía la superficie útil del tablero Stack Shift y sus piezas, conservando
física/core/replay V1. Victoria, derrota y reinicio táctiles comprobados; suelo y
botones no se solapan en vertical/horizontal. Solicitud de arena mayor resuelta.

v55 corrige el tramo visual inmóvil de los obstáculos Metro al entrar por el
horizonte: no era una pausa de la simulación. Proyección continua y regresión,
con reglas/core V1 conservados. Victoria completa, derrota y reinicio táctiles
con replay comprobados. Los restantes recorridos/datasets/métricas siguen abiertos.


v56 repara el bloqueo Sky tras romper baliza y volver al checkpoint. Core V2
restaura apoyos destruidos por delante del checkpoint conservando altura, score
y recogibles consumidos. V1/verificador/golden preservados. Ocho escenarios de
regresión pasan de bloqueo hasta TIME_LIMIT en V1 a victoria en V2. Partida
táctil con caída deliberada y recuperación llega a altura 75; derrota/reinicio
horizontal también pasan. El enemigo Sky sigue pendiente, no se da por incluido.


## Contrato de producto · continuación de v56

No crear niveles ni disfrazarlos de sectores: recorrido continuo con dificultad
progresiva. Mantener históricos reproducibles. No usar «demo» en frontend;
identificar sesión local, saldo ficticio, rivales simulados y datos de ejemplo.
El navegador debe enviar el registro de partida; el resultado sigue siendo
reconstruido por servidor para los VERIFIED.

v57: envío terminal inmediato antes de la animación, transporte conservado al
salir y callbacks antiguos descartados; textos frontend actualizados y etiquetas
de nivel eliminadas de juegos que ya eran continuos. La API verifica pero no
persiste de forma durable; siguen pendientes registros interrumpidos y los dos
legacy. No se declara cobertura universal.

Maze, Billar, Orb, Brick, River, Piano y Phalanx aún requieren eliminar resets o
pausas reales en versiones nuevas. Mine candidato privado requiere un campo por
partida antes de integración pública. El siguiente checkpoint aborda Maze.


v58 convierte Maze Rush en un solo laberinto continuo: V2 con apertura segura,
70 nodos grandes, giros anticipados y aviso de activación por perseguidor. Daño
conserva posición y nodos; no hay cambio de tablero, pausa ni nivel nuevo. V1 y
su golden quedan archivados. Validación/replays/QA en release v58; siguiente
unidad: envío común de registros de abandono, sin resultados ficticios.


v59 registra también abandonos mediante un prefijo reconstruido por el mismo
verificador. Receipt explícito sin resultado/durabilidad; terminal histórico sin
cambios. Checkpoint real por intento, transporte preservado, keepalive acotado y
renovación tras BFCache; ver ADR 006/release v59. Nuevas prioridades de producto
y garantías aún pendientes se mantienen en PRODUCT_BACKLOG_STATUS.md.

v60 retira coaching/instrucciones visibles, usa nombres de juego como acceso,
revisa portadas/fondo orbital y amplía otra vez Stack Shift conservando core V1.
Resultado muestra tiempo decimal real; scoring/desempate todavía no migrados.
Evidencia incremental en release v60 y pendientes en el ledger, sin duplicar
reglas competitivas ni afirmar dataset de 1000 por usar seeds distintas.


v61–v67 continúan las unidades pendientes: Piano y River sin resets, Jet con
cambios de altura más claros y Maze con lectura/cadencia pulidas; fondo/audio/Tower corregidos, Memoria añadida y Alien con decisiones encadenadas. Estado, evidencia y siguientes tareas se mantienen
en PRODUCT_BACKLOG_STATUS.md y sus releases; no se declara rotación1000 global
ni comparación por avance completadas.

Las nuevas solicitudes (fondo generado, mute fiable, base visible de Tower,
variedad de Alien y Memoria) se mantienen en PRODUCT_BACKLOG_STATUS.md.
