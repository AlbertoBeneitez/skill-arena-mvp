# Galactic Birds V3 — structural demolition

Version3.0 changes generation; the original V2 integer translation/contact
kernel, typed projectile physics,30shots, scoring and four-minute budget remain.
Six persistent scaffolds use2,2,3,3,4,4 storeys with two independent posts and
actual cross-beams per storey,58bodies total. Glass/ceramic/alloy and inset upper
supports vary reproducibly by server seed. Twelve space pigs remain the goal;
removing supports makes decks fall and defeat elevated pigs indirectly.
The renderer shows bracing/fasteners within the exact collision bodies and a
whole-field radar. Persistent counters show scout/dart/meteor remaining,
excluding already fired projectiles; each starts at10. No separate levels.

Shared protocol1, recorder, scenario manifest, registry, lazy loader and server
replay reused; V1/V2 adapters and fixtures preserved. No copied commercial
characters, graphics or code. Physics stays translational AABB, not rotating
rigid bodies; the structured gameplay does not claim otherwise.

Tests:1000distinct/reproducible fields,32 stable960tick starts without spontaneous
kills/damage,8full clears,4losses, input/score/seed validation, repeated replay,
60/120/144Hz equivalence and576 pure real renderer frames with all bodies on the
radar and exact remaining counters. Golden birds-v3-golden:7470/t3972,
15shots/12pigs; frozen input sequence/hash in scripts/fixtures/birds-v3.json.

Production-build native touch QA:portrait16shots/12pigs/7330/t5556;
landscape13shots/12pigs/7360/t4849. Loss30shots/0pigs/t8274 and8181.
Each tests cancel/blur/orientation/music rerender/restart/terminal and abandoned
records with no console errors. Typecheck/lint and build pass; complete history
suite and exact-head CI/providerReady gate publication/mobile-test advancement.
Physical devices remain owner follow-up, not a continuation blocker.
