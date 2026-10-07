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
19-game browser smoke and cancelled-verification restart QA pass. The new canvas
shell remains unused until a separately audited/validated game unit integrates
it; production-grade/human-device readiness is not claimed by helper tests.
Original implementation, no new dependency or third-party asset.
