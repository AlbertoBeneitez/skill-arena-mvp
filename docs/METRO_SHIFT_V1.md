# Metro Shift 1.0

The incremental audit located all logic in the legacy React component:
seven lanes, jump, fixed repeated hazard/gap arrays, perspective-dependent
polygon collision, frame delta capping, UI-owned score and result. Its useful
lane/jump/forward-reading mechanic is retained. The old 0.1 component remains
archived outside the active lazy loader; no historical server adapter existed
for it, and all existing verified cores/adapters/hashes remain untouched.

New original integer core uses the existing 120 Hz runtime, shared RNG/scenario
identity, strict input/replay, lifecycle, registry and server adapter. Protocol
LEFT/RIGHT/JUMP, 16-tick lane cooldown, continuous lateral motion, no airborne
double jump; native swipe uses the common gesture path. A cancelled swipe stops
further movement; already accepted movement is not undone or re-recorded.

60 seeded groups in three sectors. First eight seconds are safe without input;
subsequent walls require lane choices, amber barriers require at least 45 px
jump clearance. Each group leaves at least three obstacle-free lanes. Density,
wall/barrier combinations and three forward speeds progress by groups, not
render FPS. An optional safe-lane recharge appears every eight groups.

Three shields, 180-tick hit protection, one damage per group, hit penalty 300
(floor zero), collided-group score 60. Clean passes score
`300 + min(540,passed*12)`, plus 200 for actually clearing a barrier. Unique
pickup scores 150 when healing, otherwise 80. Reach all 60 groups or the issued
target to win; shields exhausted or 150-second limit lose. Catalogue target
42000; complete-course practice uses its existing server-issued target. No real
pairing/auth/money activation or new per-game infrastructure.

Collision uses logical world distance and continuous X. Perspective, shadows,
particles, road colour/space atmosphere and audio are presentation only. This
avoids deriving physics from camera projection or screen dimensions. Original
Canvas art uses the common space backdrop; no external code/assets/dependency.

Golden in scripts/fixtures/metro-v1.json: score 43320, finalTick 11133,
state hash sha256:0ef385d90980e60dfdb35041ee5c0a247008b57037c448f42d57f7d41e9c4a8c.
32 complete seeded replays, 128 safe openings, open routes, continuous movement,
wall/barrier distinction, no repeated damage/air jump, unique pickups, idle
loss, invalid input/limits and 60/120/144 Hz golden checks. All historical
fixtures/typecheck/build remain passing. Browser touch QA compares actual
posted inputs and server scores, not the steering mirror's predictions.
Physical human QA remains recommended; not a PRODUCTION-GRADE claim.
