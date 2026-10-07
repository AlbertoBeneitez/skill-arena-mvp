# v25-mobile — River Dash movement coherence and server replay

Base: v24-mobile, 5ed134d563a6fc82a63ac1cc8a32c14387a5bda4.

## Audit and correction

The integrated 0.1.0 component applies carry inside evaluateLane(), including
input events; its column does not track carried x, so later inputs snap backwards.
It also multiplies all elapsed travel by current crossing difficulty, teleporting
traffic after a crossing. The old component/source and licence notices remain.
New 1.0.0 moves rules into a pure core and retains the lane-crossing design,
9×11 board, seeded directions/speeds/lengths, resting rows and crossing rewards.
Registry, lazy loader, lifecycle, inputs, manifest and server replay are shared.

Platforms and cargo use a regular length+gap tiling, shared by collision/render.
Offsets integrate velocity every tick; speed progression never rewrites past
travel. Carry occurs only on simulation ticks, including across phase wrap.
Horizontal input moves relative to actual carried x; vertical input preserves x.
Full player support is required on platforms; partial edge contact is explicit
failure. Cargo collision and drifting outside the field end the run. Inputs have
12-tick cooldown and bounds; no repeated evaluation adds movement. Crossing adds
1250 + 150×crossing number and resets the player to base; the traffic phase persists.
Simulation is 120 Hz with a six-minute limit and authoritative server score.

Original orbital presentation distinguishes safe zones, energy platforms and
cargo. Swipe, keyboard and four accessible buttons reuse the shared adapter;
landscape placement reuses Serpent's responsive control rules. New original cover,
no imported third-party source/assets or dependencies. Existing MIT inspiration
notice remains; no change to historical verified cores/contract V2.

## Validation

16 seeded complete crossings, replayed exactly. Tests cover tick-only carry,
relative movement, preserved drift during vertical inputs, phase continuity across
crossings, both directions of phase wrap, full/partial support, traffic collision,
cooldown and time limit. Scenario 000007 seed:
5e649dfb2917be3857d8fbbf93723ebaff0d79d316cb2ace3db12c671ac242dd.
Pinned score 1400, finalTick 224, won, hash
sha256:53753528792e982a64bc4477c907b1ca7d19ede47317c308f38a5ec6a3509513.
Repeated replay, 60/120/144 Hz and invalid-input tests pass; existing goldens remain
unchanged. Typecheck/lint and production build pass. Browser QA uses a server-issued
demo training target of 1400, preserving server-selected seed and signed manifest.
Actual winning inputs and score are checked against server replay. Landscape
pointer and keyboard controls are exercised; screenshots inspected.

Full catalogue smoke mounts/unmounts all 19 games separately in portrait AND
landscape (38 cases), with server issuance checked for all seven VERIFIED games.
No console/HTTP/request errors. Human mobile-device QA remains pending. VERIFIED
is server replay in the demo flow, not activated production competition.
No auth/database/signing secrets added or real competition/money activation.

Remaining: Alien Dash gameplay, Orb Burst, Shot Gallery, Sky Hop, Pulse Runner,
Metro Shift, Mine Grid, Brick Relay, Stack Shift, Maze Rush, Star Phalanx, rankings
and staged production scenario/persistence integration.

Two browser play-throughs won at 1400 with thirteen inputs each, verified against
the server's authoritative replay. Final orbital vector cover loads and displays without image errors; the older cover remains as a historical asset.
