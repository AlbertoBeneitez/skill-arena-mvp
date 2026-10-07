# v21-mobile — deterministic gameplay evolution

Base: validated v20 at `aca86c5d04eb96fe5919098743746a992c911e3c`.
v20 CI: https://github.com/AlbertoBeneitez/skill-arena-mvp/actions/runs/37660119066
v20 preview: https://skill-arena-ophk0zrj0-skill-arena2.vercel.app
mobile-test advanced from 401ffef to aca86c5 by normal fast-forward.
Human mobile-device QA remains pending. No real competition/money activation.

## U2 — reusable driver for new core versions

Audit: preserve the frozen historical cores and their drivers. New rule versions
need the same deterministic input clock, terminal semantics and React lifecycle;
do not duplicate those per game. `coreRuntime.v1.ts` extends existing input
validation and defines one shared replay/clock/target/time-limit driver.
`coreAdapter` registers it through the current append-only verifier archive,
not a new endpoint or registry. `CoreCanvasGame` uses `useVerifiedAttempt`,
existing logical canvas sizing, generation protection and server-only final score.
Game modules provide pure rules, closed actions, rendering and gesture mapping.

The client queues a bounded number of actions, records at most one per tick,
checks semantic availability and processes queued inputs during fixed-step
catch-up. Focus/pointer cancellation, held keys, resize, RAF and requests clean up.
Changed attempt options expose idle until the new session state exists, hiding
stale ready/rejected state during restart. No rule changes to archived versions.

Driver tests exercise semantic/protocol rejection, target/timeout, replay,
60/120/144 Hz and late-frame catch-up. Existing goldens, typecheck and build pass;
19-game browser smoke and cancelled-verification restart QA pass. The shared canvas shell is integrated by the separately validated Stack V3
unit below; production-grade/human-device readiness is not claimed by helper tests.
Original implementation, no new dependency or third-party asset.

## U3 — Stack V3: perpendicular X/Z geometry

Audit: preserve PrecisionStack V1/V2, historical scoring helpers, registry, lazy
loading, canvas sizing, server-issued manifests and append-only verifiers. V2
contains only one-dimensional widths/positions; genuine support in two axes
requires a new competitive version. New version 3.0.0 models integer X/Z solids
and trims their intersection with the supporting block. Successive blocks
sweep on perpendicular axes, with seed-dependent direction and period.
Original canvas projection renders three faces, settlement, cut fragments and
space scenery; screen dimensions/render rate never affect authoritative geometry.

Rules: 120 ticks/s, 24-tick settlement, 45-second idle timeout, six-minute maximum.
DROP is available only during movement, once per tick. A missed support or an
intersection below 12 logical units ends the run. Area overlap supplies precision
points; the existing base/perfect/combo constants and adaptive perfect tolerance
are preserved, with new area geometry explicitly versioned. Final score and
termination are computed by shared server replay. Existing V1/V2 adapters and
goldens are unchanged. V3 still uses the existing V2 issuance envelope; the V3
scenario manifest and production issuance remain staged, not activated.

Validation: 64 seeded successful replays and exact supporting bounds; alternating
axes, depth cuts, failed/sliver placement and input rejection while settling.
Pinned golden: scenario seed-catalog-v1:000007, version 3.0.0, score 8919, tick 767,
won, state hash sha256:2046e8f4f45dadf20bede21e795425539b31abf91ca3ccaa615f43fab4fcd234.
Repeated replay and 60/120/144 Hz agree; invalid inputs and uncontrolled randomness
are checked. Typecheck/lint and production build pass. All 19 lazy games pass
mobile portrait/landscape smoke with no console errors. Actual browser Stack
run: nine inputs, score 10357, NO_OVERLAP, verified by SERVER_REPLAY with client
score ignored. Portrait/landscape screenshots inspected. Human-device QA pending.

All artwork and geometry are original; no imported code/assets or new dependencies.
No authentication, production database, real competition or money activation.
Remaining product backlog: Tower Drop, Jet Stream, Alien Dash V2 gameplay, Orb
Burst, Shot Gallery, River Dash, Sky Hop, Pulse Runner, Metro Shift, Mine Grid,
Serpent, Brick Relay, Stack Shift, Maze Rush, Star Phalanx and real-data rankings.
Solitaire spatial presentation and Stack 3D are delivered; future production
scenario/persistence integration remains pending.
