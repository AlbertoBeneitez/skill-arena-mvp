# v20-mobile — staged product evolution

Base: `v19-mobile` at `392016dc64dc34cecd558842c88e3d10a70e72c1`.
Remote `mobile-test` and `feature/dino-dash-professional` are ancestors of this
base. Previous version branches remain untouched. No real competition, users
or money are activated. Human mobile-device QA remains pending.

## U1 — shared terminal lifecycle

Audit: all five verified UIs use `useVerifiedAttempt`; cores, input validation,
scoring, V2 manifests, registry/lazy loaders and append-only server adapters
remain unchanged. The hook could abort/repeat verification on a second call,
accept inputs after finishing and update a stale session after unmount.

The shared `SubmissionGate` caches one terminal request per attempt until the
session resets. Inputs are snapshotted and closed on first submission. Cleanup
aborts the request, rejects late transports even if they ignore cancellation,
and generation checks prevent stale state publication. All five callers ignore
the explicit cancelled result rather than invoking a stale `onFinish`.

Validation: `pnpm check`, frozen replay/contract/scenario goldens and build pass.
New tests exercise duplicate pending/completed calls, conflicting ids, reset,
cancellation before transport and an aborted transport resolving late. Chromium
QA mounts/unmounts all 19 games at portrait/landscape dimensions without console
errors; delayed server verification cannot finish a newly started Dino session.
No new dependency, copied code/assets or competitive rule change.

## A1 — Alien Dash presentation, historical Dino V1 retained

Audit: `DinoDash.tsx` already adapts the pure 120 Hz V1 core, shared attempt
hook, canvas letterboxing and server replay. Keep those mechanics, input
protocol, score, internal `dino-dash` id, version 1.0.0 and licence notices.
Registry display name/accessibility/cover become Alien Dash. Original canvas
art depicts a colony, alien runner, drones and plasma barriers; the old cover
remains available for historical references. `drawSpaceBackdrop` is a small
presentation helper with no game-state mutations or simulation RNG consumption.
Focus/visibility loss records a reproducible duck release; listeners clean up.

New enemies, platforms/heights and life pickups are NOT claimed by A1; those
require a later versioned core. Existing V1 obstacle positions/hitboxes and
results are unchanged. Validation: typecheck, deterministic/golden tests,
production build and 19-game smoke pass; portrait/landscape screenshots reviewed.
Browser replay verifies normal V2 completion and the DUCK_DOWN/DUCK_UP sequence
after blur. No important console errors or new third-party dependency/asset.

## L1 — Solitaire orbital backdrop

Audit: retain the solver-curated deck selector, Klondike moves, scoring, card
layout, selected destinations and cleaned-up timer. This unit changes only the
effective `.solitaireSprint` background, using original CSS starfields/nebulae.
The game remains INTEGRATED; a visual change does not claim server verification.
Typecheck, deterministic tests and production build pass. Chromium mobile QA
checks 28 tableau cards/7 face-up cards, drawing stock, unchanged visible card
identities after orientation, scrolling/layout and clean unmount without console
errors. Portrait/landscape presentation reviewed; no new dependency/assets.

## Remaining after this batch

Stack 3D, new Tower physics, Jet widths/dual passages/lives, Alien's new enemy/
height/platform/life rules, Shot Gallery, Serpent and the other gameplay units
remain pending. S3b atomic attempt/results, authenticated shared matchmaking,
ranking read model/UI and production integration also remain pending. No real
competition or money is enabled by this batch. Do not label the full backlog
complete. Publish v20 and advance mobile-test only after green CI and preview.
