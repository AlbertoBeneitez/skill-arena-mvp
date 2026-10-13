# v96-mobile — demolition variety and physical controls

Owner's five requested changes are implemented as one bounded batch:

- Galactic Birds 4.0.0: six different seeded load-bearing assemblies (arch,
  cargo pyramid, bridge, offset staircase, unequal towers, overhang). Destroyed
  supports cause falling loads and deterministic impact damage between bodies.
  Material shards tumble and settle, with longer rubble/dust feedback. One
  continuous field, twelve targets and thirty shots; V1–V3 remain archived.
- Galactic Roulette: collapsible betting cloth with joined numbered cells,
  separate dozens/outside bets and a selected chip, preserving green/blue/white.
  Zenithal ball position follows V2's authoritative Cartesian coordinates;
  bounce height affects scale/shadow, not horizontal position. The raised central
  cone has radial shading, slope ribs and a lit boss. On settlement the ball
  remains in the awarded pocket, following wheel rotation until the next toss.
  V2 physics/scoring/replays remain unchanged.
- Darts: all non-timeout landed darts remain embedded with their tips exactly at
  core impact coordinates. The newest dart appears there only at impact tick120;
  no duplicate flying/embedded sprite. V3 scoring and drift stay unchanged.
- Billiards 3.0.0: grab the white ball or shaft, pull backwards to set direction
  and thirteen power steps, release to shoot. Cancel/blur/resize do not shoot.
  Existing integer physics, fixed ten-ball arena and eighteen-shot budget remain;
  V1/V2 and their three archived speeds remain reproducible. Keyboard fallback
  retained; power/discharge buttons removed.
- Solitaire Sprint 0.2.0: tap to choose a legal visible-card destination, or drag
  a card/sequence and snap near a valid pile. Bases respect the displayed suit;
  destinations light up during drag. Hidden cards/stock are never used for
  assistance. Empty-to-empty king moves, self moves and broken sequences are
  rejected. Existing client-result/training maturity remains unchanged; known
  legacy scoring/end-condition audit is outside this input/presentation unit.

Validation: complete deterministic suite/typecheck and production build passed.
New Birds and Billiards versions have golden replay hashes, 60/120/144Hz parity,
invalid-input checks and signed server replay ignoring fabricated client score.
Birds:64 stable distinct initial fields, two full pilot wins and native touch win
(12kills/10shots), cancel/blur/rotation/restart/abandoned receipt. Billiards: all
13speeds, two full ten-ball pilot clears and actual native cancel/release/receipt
in390×844 and844×390. Roulette: all49bets,44px touch targets, collapsed/expanded
panel, one toss/abandoned receipt at320×568 and568×320. Darts: full touch verified
20throw win (975total), restart/receipt; renderer tests cover persistent exact
impacts across five throws. Solitaire: native predictive taps and legal waste
card snap in both orientations, no page errors/overflow. No new assets or deps.

Delivery: GitHub push, CI and exact-commit Vercel preview are checked after the
implementation commit. mobile-test stays on its validated checkpoint until CI
and the matching preview are ready. No access policy change or real-money
activation is included. Physical-device QA remains unverified.
