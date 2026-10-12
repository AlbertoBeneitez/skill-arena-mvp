# v89-mobile — mobile Slot/Roulette controls

Base v88-mobile a90a328251e1ced5703c8a7259f2bd4b6862eb2b, CI38166607996
successful, Vercel7000335773Ready and mobile-test fast-forwarded.

Slot's fixed order reference is aligned with the reels and disappears at1200ticks
(10seconds). The machine expands smoothly into that space. Existing full-wrap8
is presented as0 and that reel stays visually still; authoritative positions,
three-second settling, costs/payouts and published core1.0 remain unchanged.

Roulette replaces the small wheel and persistent grid/settings with a native
46-option bet dropdown and a visible ball dock. Dragging from the dock into the
wheel quantizes distance and direction into existing LAUNCH actions. No power
slider, copied casino assets, outcome RNG or client score. Core1.0 hashes preserved.
An optional native choice control in CoreCanvasGame sends through the same queue,
validation and recorder; external runtime/protocol/replay contracts unchanged.
It reads authoritative selection and is disabled during a flight. No parallel
per-game inputs, transport or verifiers are introduced.

Checks: typecheck/lint, production build, shared/full deterministic history suite,
Slot presentation invariants and Roulette gesture bounds/directions, existing
1000scenarios and core goldens. Native browser sessions: Slot wins53spins/180s/
1043500minor in both orientations; insolvency20spins/t8326,t8393. Roulette wins
32spins/180s/553000portrait,552000landscape; insolvency22spins/t14775,t14755.
Both restart, rotate, cancel, avoid duplicate charge and send prefix receipts.
Slot0/10s reference removal and Roulette320×568/568×320 usability checked.
Keyboard dropdown, CW06/CCW35 drags, wrong starts, blur/resize/double launch and
sound-preference rerenders checked. No app console errors. Preview interactive
QA is local production build; hosted Vercel preview may remain access-protected.

New request still pending: Phalanx decisions/dodge/rewards, Shot Gallery template
and tension music, original pig-target demolition presentation in Birds. Previous
Mine public activation/identity/money and missing16avatars are unchanged blockers.
No real-money activation. Remote CI/Ready required before mobile-test promotion.
