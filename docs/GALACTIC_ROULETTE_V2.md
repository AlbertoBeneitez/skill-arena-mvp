# Galactic Roulette V2 — hand toss and folding table

New competitive core2.0/protocol2 replaces prescribed circular ball motion.
Wheel order, existing payouts and V1 replay adapter/golden remain preserved.
The common server issues the seed/version/ticket, records bounded ordered inputs
and reconstructs the result; no client balance/number/score is authoritative.

One gesture emits RELEASE_X_00..39, RELEASE_Y_00..40 and TOSS_D00..31_P00..15.
Release is quantized to10logical pixels; direction has32bins and impulse16bins.
The ball starts at that release point, not the original dock. The common input
queue records one action per tick; the core accepts the ordered parameter
sequence without a second cooldown that would discard same-frame queued inputs.
Another toss/bet is rejected during flight; max1200inputs and standard sequence
validation bound the record. Cancel/blur never launch. No wall-clock gesture
velocity, client simulation state or arbitrary competitive seed is submitted.

Physics is fixed-point Cartesian x/y/z with120Hz ticks: gravity30units/tick²,
initial horizontal speed700+95×impulse, vertical220+12×impulse, release height24k.
A sloped central boss and outer bowl redirect rolling motion; floor restitution,
friction and rim contacts are deterministic. The pocket is the nearest rotating
wheel sector at physical capture, from integer dot products. There is no
outcome RNG or prescribed circular flight. Flight is bounded by720ticks, with
capture after240ticks when sufficiently settled. This is an original arcade
approximation, not a calibrated real-world or chaotic rigid-body simulator.

100€ fictitious start; each toss costs5€; terminal balance only, at180s or0.
Late tosses require the full six-second resolution window. Existing49bets:
37numbers plus color/parity/halves/dozens and three new columns. Columns return
15€ total on a5€stake(2:1); zero loses outside bets. One bet per toss, no splits,
corners or simultaneous chips. Real identity/money/competition remain disabled.

The foldout uses a real-table arrangement: zero, three number columns, side
 dozens, column returns and outside bets. Dark blue/green/white0 are product
colors; RED/BLACK technical identifiers stay historical.48px minimum cells,
internal scrolling, selected marker, flight lock and orientation reflow.
CoreCanvasGame extends its existing choiceControl with optional generic grid;
GameActionButton handles touch release/cancel and suppresses compatibility clicks.
It reuses the input queue/replay/lifecycle; opening a table never resets time.

Tests:512direction/impulse combinations,35physical pockets,1000reproducible
starts,32complete wins/8losses, gravity/contact/release continuity, columns,
input bounds, repeated replay and60/120/144Hz equivalence;3632readonly actual
renderer frames. Golden roulette2-golden:score920000/t21600,52tosses,
sha256:399cd1b93a680e78309121e43f15248aa77bbd09ee634b983e9c55ad08a88246.

Production-build touch QA:full portrait70tosses/9000minor/t21600; landscape
68/13000/t21600. Natural insolvency20tosses/t15480 and15331, both orientations.
Cancel/blur/rotation/restart, one terminal record and abandoned receipt pass;
no console errors.320×568/568×320 cover all49cells, exact release tokens,
minimum targets, open-table rotation and flight locking. Music toggles preserve
Slot and Roulette clock/state and recording. Typecheck/lint/build and full
historical deterministic suite pass. Physical phones remain owner follow-up.
No new third-party assets/code; standard European wheel/table facts only.
