# Galactic Birds2.0.0

Original continuous sling/demolition game inspired by established genre mechanics;
no protected characters, branding, commercial assets, source or level layouts are
copied. Uses the existing authoritative runtime, recorded AIM/POWER/SHOOT inputs,
shared seed/scenario generator, registry/lazy loader and versioned server adapter.
Published1.0 core/adapter/hash remains available without reinterpretation.

One field keeps six structures/twelve drones, thirty projectiles and the four-minute
replay budget. Existing glass/ceramic/alloy resistance, gravity, ordered body
contacts, automatic launcher approach, support collapses, final-shot settling and
unique-target scoring remain. Version2 changes projectile rules and the pinned
field namespace, rather than altering historical1.0 matches.

Three physical archetypes:

| Kind | Radius | Speed vs scout | Mass/impact vs scout |
| --- | ---: | ---: | ---: |
| Explorador/scout | 12units | 100% | 100% |
| Rápido/dart | 9units | 120% | 75% |
| Pesado/meteor | 18units | 85% | 200% |

Radius changes collision contacts; integer speed changes the launch velocity;
mass changes body damage and transferred impulse. Gravity remains16fixed-point
units per tick. No random landing, UI-only ability, extra input protocol or
independent replay stack is introduced. First three shots are scout/dart/meteor;
then nine seeded permutations of three yield ten of each type in a reproducible,
immutable queue. The server derives the next kind from seed and shots consumed.
The client cannot send/select a different type.

Upcoming/current types are visible as original distinct-colour/radius silhouettes
and short identity labels, with no procedural tutorial. A live radar shows every
actual surviving structure/enemy and the camera region, never a predicted landing.
Main structures have clearer glass contrast. Flight/camera/trails/material damage,
collapse rings and shared space background are preserved. Terrain is persistent;
no levels or between-field resets.

Validation:1000distinct fields,64stable openings,16full clears,four complete
losses,shot/input locks,late-clear/timeout,signed replay ignoring client score and
rejecting changed seed,render60/120/144Hz,integer positions,immutable queue and
speed-order checks.576actual renderer frames show all structures and one active
projectile without mutating state. Pure test pilots stay outside production.
Golden seed `birds-v2-golden`,eight shots/twelve kills,score6920,t2201,
`sha256:782ac9a69c65ef22b1c0d3b44949638f5a996c0e5bc6a2f09539a8cadcb9bf76`.

Native production-browser QA: portrait11shots/12kills,6890,t3280;
landscape11/12,6890,t3568. Losses30shots/0kills,t7993/t8078. Real gestures,
rotation,music state changes,cancel/blur,one terminal upload,new-ticket restart,
abandoned-prefix receipt and clean console; no client-state/clock overrides.

This remains fixed-point translational/AABB arcade physics, not a full rotating
rigid-body simulation. It does not claim an exact clone or physical-device approval.
No production auth, money, ledger, durable pairing or hidden-game activation.
