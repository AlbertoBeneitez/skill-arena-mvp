# v24-mobile — Serpent toroidal core and server replay

Base: validated v23-mobile, 47f28fef57b2e3aa3732eba31553e0fe45f900ed.

## Audit

Grid Serpent 0.1.0 keeps its rules inside React, submits a client result and treats
all four board edges as failure. Its two-turn mobile queue, 18×28 grid, growth and
food reward are useful and preserved. The old component is retained as historical
source; it had no authoritative replay contract to erase. New 1.0.0 moves rules
into a pure core, registered/lazy-loaded and verified through the existing shared
runtime, lifecycle, server manifest, input validation and append-only adapter.

## Rules and presentation

The public name is Serpent; internal grid-serpent identity remains stable.
Both axes wrap symmetrically. A vacating tail is legal to enter; occupied body
contact ends the run. UP/DOWN/LEFT/RIGHT inputs use the existing bounded two-turn
queue. Same-direction, reverse, and full-queue inputs are unavailable and rejected
in replay. One recorded input per tick. Food uses a versioned seed/index hash over
all free cells, with no occupied-cell fallback or manually maintained scenario
files. Its placement depends on the replayed body state, under identical rules;
initial state/scenario is identical for both opponents, but different inputs may
produce different subsequent states. A full board wins. Each food scores 1000;
speed increases after every two foods from 17 to a minimum of nine ticks per
movement, at 120 Hz simulation. A six-minute limit is authoritative.

Original space backdrop, luminous food, rounded segmented body and directional
head eyes; sound/haptic/score feedback reuse the common shell. Swipe, keyboard and
four accessible control buttons are supported. Landscape controls sit beside the
board without obscuring it. Resize/capture/RAF/unmount and result submission are
owned by the common lifecycle. UI never chooses seed or authoritative score.

## Validation

32 successful seeded replay runs; four wrap directions; no food inside the body;
legal tail exit; self collision; bounded turn queue; forbidden opposite input;
authoritative time limit. Frozen scenario 000007 seed:
d514b4c2e2b55c3dec520a55fa1869db88e589ac611810958954069f89d8e5cc.
Golden score 7000, finalTick 1367, won, state hash
sha256:969ce262f680510c5b89966e2b02d6ea9271502f2469e45d8d623f632240a441.
Repeated replay and 60/120/144 Hz agree; protocol bounds and uncontrolled clocks/
randomness are checked. Historical fixtures remain unchanged. Typecheck/lint and
production build pass. No third-party code/assets/dependencies added.

Human-device QA and production security/infrastructure are pending. VERIFIED
means server replay in the existing demo flow, not activated real competition.
Auth/PostgreSQL configuration and paired production issuance remain staged.

All 19 games pass mobile portrait/landscape smoke, including server start and
unmount for the six VERIFIED games. Two actual browser runs scored 3000 with
nine inputs and SELF_COLLISION, matching authoritative server replay exactly.
Portrait/landscape screenshots inspected: wrap counter and food rewards present,
controls clear of the board. A new original cover uses SERPENT; old GRID SERPENT
cover/component are retained only as historical assets/source. No console errors.

Remaining: Alien Dash gameplay, Orb Burst, Shot Gallery, River Dash, Sky Hop, Pulse
Runner, Metro Shift, Mine Grid, Brick Relay, Stack Shift, Maze Rush, Star Phalanx,
rankings and staged production integration.
