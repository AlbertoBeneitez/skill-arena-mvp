# Star Phalanx 2.0.0

One uninterrupted course of16layers/100opponents. V1 remains archived unchanged.
V2 retains the original integer ship, shots, hitboxes, charge warnings, armor,
shields, seeded formation patterns and held-fire/aim protocol. No new RNG, replay,
registry or lifecycle. The common120Hz driver and server verifier remain authority.

Defeating a layer appends its successor immediately at the next simulation tick.
No layer/wave waiting ticks, no projectile clearing, no movement/volley clock or
direction reset. Shots keep positions/velocities/IDs, even as the next layer arrives.
Defeated rows stay in the bounded100-enemy history; living opponents are filtered.
Relative vertical coordinates rebase before new arrival so accumulated descent
cannot place future opponents offscreen after shield recovery. The initial grace
period remains8seconds with readable half-second charge before the first attack.

Internal geometry bands retain V1's3..8columns, V/stagger/stair patterns, armor
and paired attack lanes. These are difficulty parameters, not product levels:
no screen change, pause, empty field reset, flight discard or progress reset.
Lives can recover at the inherited progress milestones, with maximum3. Completed
layers and kill/interrupt/armor bonuses retain V1 arithmetic; penalties remain250.
`height` records unique defeated opponents. Manifest target/time bound retain the
common contract; full100opponent course wins,21600ticks time limit loses.

V2 opts into common coalesced single-axis pointer destinations. Down still emits
ordered AIM + FIRE_DOWN, release/cancel/blur emits FIRE_UP via the shared recorder.
Fast final drag positions survive the aim cooldown; replay uses accepted ticks.
Presentation from v77 is preserved: differentiated projectiles, muzzle flash,
charge ring, shield arc and armor pips; no tutorials/wave/cape/score overlays.

Golden: seed`phalanx-v2-continuous-golden`,tick10352,score43475,won,
sha256:023e94a805184bcfff80a95971e02d7c72b3b2be57f331213439b285e116694e.
Tests:32full win/loss replays,128safe openings, render60/120/144, malformed/order/
limit inputs, controlled RNG/clock, flight carry, safe descent rebasing, held fire,
shield/defeat, actual read-only renderer on both V1/V2 states.

Original implementation with proven arcade readability principles, no third-party
code/assets/licence dependency. Real-money/authentication remain disabled.
