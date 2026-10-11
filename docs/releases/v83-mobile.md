# v83-mobile — Galactic Birds and casino lifecycle

Base: v82-mobile `8188f30964b4d009347229732e0696ea4e7e84b5`, CI38129330262
successful, Vercel6993747488 Ready and mobile-test safely fast-forwarded.

Galactic Birds adds an original continuous demolition field, twelve drones,
glass/ceramic/alloy structures, thirty shots, pull-back/release direction and
power, fixed-point gravity/contact replay and original orbital artwork. Uses
the existing shared runtime/scenarios/recorder/server verification. No levels,
commercial assets, alternate replay engine or production providers introduced.
Physics is intentionally translational/AABB arcade, not a full rotating-body
simulation; see GALACTIC_BIRDS_V1 for the authoritative rules.

Two input bugs caught before publication: a redundant core cooldown discarded
the POWER/SHOOT tail of a queued gesture; keyboard POWER_UP/DOWN initially
matched the numeric parser. Both are corrected and covered. Terminal clearance
at the time boundary preserves an already achieved win; the last shot waits
for delayed collapses before adjudicating ammunition exhaustion.

Separate UI lifecycle fix: Slot/Roulette now pass stable HUD/feedback callbacks
to the common controller. Changing sound preferences previously recreated the
core while retaining the recorder: native reproduction reset Slot from295€
and175.6s to100€ and179.9s. The regression test now checks a real sound-state
change, retained balance, monotonically advancing clock and an accepted prefix
record in both games. Their published V1 cores/hashes/rules are unchanged.

Evidence:
- Birds golden eleven shots/twelve drones,6890,t3017, hash
  `sha256:7aca439d9ed49a602fdaccb09eb80dfcc4fa8bec668d49b9ce4d1068ba7a705e`.
- 1000 distinct fields, sixteen full clears, sixty-four stable openings,
  four complete losses, timeout/late-clear/input locks, integer physics,
  signed endpoint, malformed/excess inputs and replay/render60/120/144Hz.
- Native production-build touch wins: portrait twelve drones/nine shots,
  score6900,t3384; landscape twelve drones/eleven shots,6920,t3540.
  Complete losses: thirty shots,zero drones,t7814/t7865. No clock/client-state
  overrides. Rotation, cancel/blur, sound preference, one terminal submission,
  fresh restart and abandoned-prefix receipt checked; no app console errors.
- Focused 320px portrait/small landscape gesture/cancel/blur/record validation.
  Native touch release now drives shared game-header buttons; optional compatibility
  clicks are deduplicated, while keyboard/mouse retain click semantics. This fixes
  an actual missing-click path observed after canvas gestures. Sling hit area is
  also enlarged to stay at least44px in the tested small landscape viewport.
- Full deterministic/history suite, typecheck/lint, production build and diff
  checks required before publication; CI and Vercel checked on the published
  HEAD before mobile-test promotion. Preview access remains provider-protected.

Slot/Roulette use fictitious balance only, isolated from wallet and real ranking.
Roulette remains one bet per shot, without split/corner/multi-chip layouts.
Native emulation does not replace the owner's subsequent physical-device QA.
Earlier product/private-public integration work remains in PRODUCT_BACKLOG_STATUS;
this checkpoint does not claim that the whole historical backlog is complete.
