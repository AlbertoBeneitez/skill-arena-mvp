# v84-mobile — identity, retirement and roulette controls

Base: v83-mobile `9f32952dd6ae7e1956733dc9d75c98e7cb67f919`, matching
remote mobile-test. No later version branch existed at the initial check.

Memoria is removed from the active catalogue/lazy loaders. Its registry metadata
is disabled, new HTTP starts are rejected, and both historical cores/adapters,
replay fixtures and record receipts remain available. Identity heading is white.
The requested sixteen avatar images have not been received; the eight existing
choices are preserved, without fabricated replacements.

Roulette shows every one of its 46 supported bets without nested scrolling.
Wide layout follows European columns; portrait/small landscape fold the same
number columns to preserve physical44px targets. Green/dark blue numbers and
white zero are consistent on table and wheel. Power is explicitly adjustable,
direction selectable, and a wheel release/rotation gesture launches the recorded
quantized action. Common controls gain optional presentation-only CSS properties;
no extra input/replay engine, RNG, authoritative result or core is introduced.

Browser QA found a zero-width positioned container and the existing520px game
body limit cutting off the wide table. Both are fixed before publication; the
width exception applies only to Roulette. Direction controls reuse touch-release
click-deduplication; power uses a native range with keyboard support. Stable
module callbacks preserve the live state across preference/settings renders.

Validation: full deterministic/history suite; typecheck/lint; production build;
retired HTTP start and onboarding/catalogue in390×844,844×390 and320×568;
all46bets visible with44px buttons and correct colours; native cancel/blur,
launch/prefix receipt in320×568 and568×320; full terminal replay, restart,
rotation and clean console in portrait and landscape. CI/Vercel must be checked
on the published HEAD before safe mobile-test fast-forward.

No new bet rules: one bet per throw, no split/corner/multi-chip betting. Published
Roulette1.0 simulation/hashes and Memoria1.0/2.0 histories remain unchanged.
Mine's private candidate still cannot use process memory as Vercel persistence;
provider/durable repository integration remains pending. No real money or identity
is activated. Owner physical-device QA is follow-up, not a development gate.

Final native runs: portrait31launches/180s,534500minor; landscape31/180s,
535500minor. Losses22launches/zero balance,t14880/t15021. Both orientations
restarted with a fresh ticket and sent an unfinished prefix on exit. Shared
casino sound regression retained Slot295€ and Roulette95€ with advancing clocks.
