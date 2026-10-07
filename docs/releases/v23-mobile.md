# v23-mobile — Jet Stream corridor variety and lives

Base: v22-mobile, 179988a78ab23486442e265a025a5fc1fa747ef1. V1 remains replayable.

## Audit

Preserve V1 flap/gravity parameters, ship/background art, logical canvas metrics,
registry/lazy loading, shared lifecycle/input/replay driver and append-only server
verifier. The old private flight/scroll/gate helpers are not altered or exported;
V2 uses their published flight constants and flap action while adding window/life
rules in a new pure core. No second replay/scenario/lifecycle infrastructure.

V1 changes all active gap widths based on the latest passed count. V2 fixes each
window's width when generated, varying it by versioned index/seed and progression.
Occasionally a column contains two distinct openings, both valid collision paths.
The normal route has bounded centre changes; alternatives are optional.
Life recharge pickups occur along the normal route, once per eligible gate.
Initial lives: two, maximum three. Damage applies once per gate with a 90-tick
shield; boundary contact costs a life and recentres inside the arena. Zero lives
ends the run. Pickups add 100 points. Clean passes use base 280 plus precision up
to 220; damaged gates yield only 80. FLAP has a 12-tick cooldown. Simulation is
120 Hz with a six-minute hard limit. Version 2.0.0 signs rules through the current
manifest/adapter path; final score comes only from server replay.

## Validation

16 seeded successful runs; varying frozen widths; both openings accepted; one
life collection per pickup; no repeated damage while crossing one gate; cooldown,
bounds death and failure replay. Scenario 000007 seed:
7c9104afb9d5b115125ffa4f6bdc14d46251201efe1aad2579b6735c39460976.
Pinned fixture: score 4211, finalTick 1911, won, state hash
sha256:b5d9e9a91a21d40227955a6563646f12c320f9ec216eb15b0d56b7dcbe1d15c2.
Repeated replay and 60/120/144 Hz agree. Invalid, duplicate, unordered, excessive
and unavailable inputs are rejected. All historical goldens remain unchanged.
Typecheck/lint and production build pass. No new third-party code/assets or deps;
existing MIT inspiration notices remain intact. Human-device QA pending.

Production authentication/PostgreSQL and real competition/money are not activated.
Demo endpoints continue using signed V2 envelopes; production V3 scenario issuance
and paired authenticated matches remain staged, not claimed complete here.

All 19 games pass mobile portrait/landscape loading/unmount smoke without console
errors. Two browser runs yielded 2785/2938 server-verified points with 17 inputs
each; posted inputs reproduce those scores. The portrait screenshot visibly
contains a dual opening and a collected recharge; landscape was checked too.
No production-grade/human-device freeze is claimed.

Remaining: Alien Dash gameplay, Orb Burst, Shot Gallery, River Dash, Sky Hop, Pulse
Runner, Metro Shift, Mine Grid, Serpent, Brick Relay, Stack Shift, Maze Rush, Star
Phalanx, rankings and staged production integration.
