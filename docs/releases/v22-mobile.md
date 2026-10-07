# v22-mobile — Tower Drop natural pendulum

Base: validated v21-mobile at 41fb867404fa5def7600cf6b8d666038d49e1f46.
Historical branches and V2 contracts/cores remain intact. No real competition,
authentication, production persistence or money activation.

## Audit and boundaries

Tower Drop 2.1.0 uses quarter-wise smoothstep: velocity approaches zero both at
turnarounds and centre crossings. That unnatural centre hesitation cannot be
changed silently without changing historical outcomes. Version 3.0.0 replaces
only delivery/release rules, reusing V2 gravity, support/contact, tipping, drag,
wall rebound and scoring. The old core/component/verifier and golden are retained.
The current registry/lazy loader selects V3; the existing server archive adds its
adapter through the shared runtime, input validation, manifest and replay path.

## Mechanics

120 Hz integer simulation; a rational sine approximation gives highest lateral
speed at centre and gradual rest near extremes. An integer square root enforces
constant rope length. Initial phase, speed and amplitude depend on the issued
seed. The crane phase continues while a block falls. Amplitude grows gradually
between floors; release preserves the rope's horizontal and vertical velocity.
Contact still checks support and centre of mass, with archived gravity/tipping.
Original space artwork, gantry, procedural blocks and an exact read-only landing
preview aid timing without modifying state. All scoring remains server-replayed.
DROP is available only while swinging; 45-second idle and six-minute limits are
explicitly versioned. V3 uses the shared lifecycle/canvas/input driver. Competitive
manifest V3 production issuance remains staged; demo endpoints still emit V2.

## Validation

32 reproducible, successful seeded runs; read-only forecast; constant rope length;
wave symmetry/centre velocity; inherited release velocity; idle termination and
bad-release failure replay. The pinned scenario 000007 seed is
9cfe3ebfbb7a58e46db026a8cf3840d88b06df9f171ec6f025b124b29f0046bf.
DROP ticks 96,437,778,1120 yield score 4192, finalTick 1224, won and state hash
sha256:9187ebd127fb6cb3a025ee728daac07cb22aff63b2dd5480f773f802623969b7.
Repeated replay and 60/120/144 Hz produce identical state; malformed, repeated,
out-of-order, excessive and forbidden inputs are rejected. Existing goldens pass.
No third-party code/assets added; V2 inspiration/license notice remains preserved.
Human mobile-device QA remains pending; VERIFIED does not imply production-grade.

Typecheck/lint, deterministic suites and production build pass. All 19 lazy games
load/unmount without console errors in mobile portrait/landscape. Two real browser
play-throughs reached server-verified results (4209 and 4207 points, five inputs,
CENTER_OF_MASS), with authoritative score matching replay. Final presentation
corrects bottom-face contact with the support. Screenshots inspected; touch and
orientation smoke pass. CI/Vercel validation follows publication of this branch.

Remaining: Jet Stream, Alien Dash gameplay, Orb Burst, Shot Gallery, River Dash,
Sky Hop, Pulse Runner, Metro Shift, Mine Grid, Serpent, Brick Relay, Stack Shift,
Maze Rush, Star Phalanx, real-data rankings and production scenario/persistence
integration. Stack 3D and Solitaire spatial presentation are already delivered.
