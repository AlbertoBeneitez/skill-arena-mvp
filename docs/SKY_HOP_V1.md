# Sky Hop 1.0

## Incremental audit and preservation

Legacy 0.1 lives in `components/games/SkyHop.tsx`, archived outside the active
lazy loader. Useful auto-bounce, horizontal wrap and downward feet-crossing
mechanics are retained, with the MIT provenance already recorded in
THIRD_PARTY_NOTICES.md. No imported assets or additional dependencies.

The legacy component awarded points on every landing, including repeat bounces
on the same support. It also capped elapsed frames, used React-held controls
and computed a client result. New 1.0 uses the shared core runtime, held-input
protocol, lifecycle, registry, lazy loader and append-only server adapter.
All existing historical verified cores/hashes remain unchanged.

## Authoritative rules

- Logical 390×620 field, 120 Hz, integer milli-pixel coordinates and velocities.
- `LEFT_DOWN/UP`, `RIGHT_DOWN/UP`; duplicate held states rejected. Opposite
  directions cancel. Shared pointer capture/cancel/lost capture/blur releases.
- Automatic bounce; descending feet must cross a platform while horizontally
  overlapping. No upward/side snap. Horizontal wrap is symmetric.
- 76 generated supports (base plus 75), fixed versioned RNG namespace and
  bounded shifts/gaps. First five wide supports teach safely; three sectors
  narrow supports and vary their placement without simply increasing speed.
- Moving supports use integer triangular motion; violet supports boost;
  clearly cracked pink supports dissolve 72 ticks after landing. Green
  checkpoints every ten supports stay stable. Pickups every seven supports
  restore one recovery up to three and can be collected only once.
- New highest support awards `280 + min(480,index*8)` per gained index.
  Skipped height counts; replaying an old support never awards it again.
  Pickups award 150 when healing, otherwise 80. Falling below the view costs
  one recovery and 350 points (floor zero), then restores the last checkpoint.
- Camera advancement and explicit checkpoint reset are tick-derived, not
  viewport-derived. Canvas scenery, bounce rings and sound do not affect rules.
- Reach support 75 or the issued manifest target to win; three falls or
  180-second timeout lose. Default catalogue target 43000; full practice uses
  its existing server-issued target and the intrinsic final support.
- 4000 inputs, within common request bounds. No browser-selected valid seed,
  alternate replay stack, money/auth activation or production persistence.

## Validation

Golden seed/input/state/hash stored in `scripts/fixtures/sky-hop-v1.json`:
43560 points, tick 6527. 32 complete seeded ascent replays, 128 safe five-second
openings, repeat-bounce regression, downward/side/upward collision tests,
wrap, checkpoints/lives, boost/crumble, unique pickups, invalid inputs,
render equivalence at 60/120/144 Hz. Existing historical fixtures remain green.

Native browser QA records actual touch inputs and server replay; controls
remain outside the field and at least 44 px in both orientations. Browser QA
is not physical-device acceptance; final human playtesting remains recommended.

Native visible-geometry steering completed 75 supports in portrait (43560
points, tick 6542) and landscape (43560, tick 6396), with three recoveries.
The loss run exposed held-touch click-through to a new result action; the
shared result panel now requires a fresh pointer gesture for pointer clicks,
while keyboard/assistive clicks remain available. This is presentation input
safety only and changes no competitive core or historical replay.
