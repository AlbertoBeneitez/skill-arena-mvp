# Galactic Birds 1.0.0

Original orbital sling-and-demolition game. Uses the common GameCore, integer
math, seeded scenario generation, registry/lazy loader, input recorder, signed
manifest/ticket and server replay adapter. No commercial code, characters,
levels, artwork or audio have been imported.

One continuous 1,600-unit field contains six persistent structures and twelve
drones. Glass, ceramic and alloy have increasing impact resistance; later
structures are taller, contain more alloy and offer different firing distances.
The launcher approaches the next surviving drone without rebuilding the field.
Thirty projectiles and a four-minute budget; clear all drones to finish, or end
with ammunition exhausted/time expired. A final projectile gets two seconds of
settling time so delayed collapses still count. A cleared field remains a win
even if its presentation/settling window reaches the time boundary.

Pull the visible projectile back and release. The UI quantizes direction into
61 angles (10–70 degrees) and distance into thirteen powers. It records AIM,
POWER and SHOOT on consecutive ticks through the common queue; no client
trajectory/result is accepted as authority. Cancel, blur or a short gesture
does not shoot. Inputs during flight are unavailable. Keyboard arrows/space
provide an accessible alternate input path.

Physics uses fixed-point integer positions, 120 ticks/sec, two projectile
substeps, gravity, circle/AABB impacts, material damage, translational body
contacts, supports and falling drones. Body order and rounding are explicit.
This is an arcade AABB solver, not a rotating rigid-body simulator. Flight
trails, fragments, camera, launcher stretch and synthesized sounds are cosmetic.
No projected landing path or procedural instructions appear inside the game.

Reach is unique drones destroyed. Historical runtime score stays zero while
running; terminal score is 500 per drone +30 per destroyed body +20 per unused
projectile only on a clear. Server replay computes all values from the issued
scenario and inputs. Terminal records upload before the common result animation;
exiting sends the actual unfinished prefix as an abandoned receipt, not a win.

Golden `birds-v1-golden`: eleven shots, twelve drones, score6890, finalTick3017,
`sha256:7aca439d9ed49a602fdaccb09eb80dfcc4fa8bec668d49b9ce4d1068ba7a705e`.
Tests cover 1000 distinct fields, sixteen full clears, sixty-four stable/easy
openings, four full ammunition losses, timeout, late clearance, shot locking,
integer physics, keyboard power parsing, invalid/excess inputs, repeated replay,
60/120/144Hz and signed endpoint rejection of a chosen seed/client score.

Native production-browser evidence and limitations are in the v83 release.
Public deterministic parameters remain automatable; replay is not proof of
human play. Production identity, durable pairing/consumption and real-money
settlement remain inactive, as for the rest of the public training catalogue.
