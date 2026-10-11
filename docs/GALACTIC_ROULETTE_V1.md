# Galactic Roulette 1.0.0

Original European single-zero arcade wheel, not a real casino service. Reuses
GameCore/runtime, scenarios/seed issuance, lazy registry, input recorder,
manifest/ticket, common terminal/abandoned endpoint and server adapter archive.
All values are fictitious integer cents, isolated from wallet/ranking/settlement.

100€ starting balance, one5€ bet per launch, three-minute limit or zero balance.
Available bets: straight0–36, red/black, even/odd,1–18/19–36 and the three dozens.
Total returns including stake: straight36×, outside2×, dozens3×. Zero loses all
outside bets. Split/corner/street/multiple-chip bet layouts are outside this
initial quick-play variant; no claim of a full professional casino simulator.

A server-seeded initial wheel phase, ball phase and constant wheel speed form
the shared initial conditions. There is no new random draw on a spin. A swipe
in the wheel area releases the visible ball. Distance quantizes power0–63
(round((distance−18)/2), clamp), horizontal direction chooses clockwise or
counterclockwise. Gestures shorter than18 logical pixels cancel. Pointer
cancel/blur never release a launch; no launch button. Core accepts bounded
LAUNCH_CW/CCW tokens and freezes the selected bet once a launch begins.

Pure integer angular simulation:65536 phase units per turn,120 ticks/sec.
Initial signed ball speed1200+16×power; each tick advances phase and applies
floor(abs(speed)×997/1000) friction. Wheel speed45–65 units/tick comes from the
initial seed. Flight lasts600+4×power ticks; radial descent over the last180ticks
is presentation only. The nearest relative wheel pocket determines the number;
no server RNG chooses it afterwards. At landing, the ball follows its pocket
with the wheel. Decorative rim studs are artwork, not hidden collision rules.
A launch is rejected if it cannot land by21600 ticks. Bet changes and duplicate
launches are unavailable during flight. The pure core settles exactly once.

Terminal score/reach are balance cents; score is zero during the live session,
so the archived runtime's target resolver cannot prematurely terminate it.
Results format balance as fictitious euros. Completion/survival does not assign
a winner against an authenticated opponent. Production identity, persisted
pairing/consumption and ledger remain inactive. Shared manifests support equal
conditions; independent training starts do not pretend to be paired matches.
Public deterministic parameters are automatable: replay verifies physics and
wealth, not human-only play or bot resistance.

Golden `roulette-v1-golden`:35 straight wins,622500 cents, finalTick21600,
`sha256:a7c66aeb8c43c16a9ed144438ee2c4abdba498fabc0c0bd7bca44e7ec90a87d8`.
Tests:1000 initial configurations,32 complete sessions, all37 straight payouts,
zero/outside/dozen rules, full-cycle insolvency, both directions and power bounds,
locked bet/double charge, cutoff, signed endpoint, tampering, repeated replay,
60/120/144Hz, malformed/excess inputs and forbidden clocks/uncontrolled RNG.
Native production-build evidence is maintained in the release checkpoint.

Original cover/Canvas geometry, no imported casino assets/code/brand/sounds.
