# v81-mobile — Galactic Slot

Base: v80-mobile `8120e40fc7c35973fb5108cc7d6a1bdada1f2e14`.

New original Galactic Slot1.0 uses the existing VERIFIED engine/recorder/server
adapter. Three fixed eight-symbol strips, varying server-issued initial setup,
per-reel eighth-turn controls and visible payout table; 100€ fictitious balance,
5€ per spin, three-minute timeout or zero balance. No real wallet/money changes.
Total outcome is integer-cent final balance, rendered as fictitious euros via
optional registry result metadata. Other games retain their existing metric.

Input controls are accessible DOM buttons rather than small Canvas hit regions;
portrait pairs sit below reels, landscape moves the six selectors and spin to a
side panel. Targets remain at least44px even at320px. Shared lifecycle handles
cancel, blur, double press, rotation, terminal-first upload and exit receipt.
Original cover/cabinet/fruit/geometry assets; no third-party imports.

Validation:
- Slot golden:59 spins, balance1,160,500 cents, tick21600,
  hash `sha256:b9ea1be8854eea77579ddf4b88969657669e19ea20cdbab3408218886e28adae`.
-1,000 distinct configurations,32 full courses, payouts, input locks/bounds,
  invalid sequences, no clocks/uncontrolled RNG, repeat replay and60/120/144Hz.
- Signed endpoint recomputes wealth, ignores supplied client wealth, rejects
  seed tampering. Attempt record regression suite covers43 current/old versions.
- Full deterministic/history suite, typecheck/lint and production build passed.
- Chromium production-build native touch covers whole timeout sessions, zero
  balance losses, cancel/double press, rotation, one terminal request, fresh
  restart and separate abandoned-prefix receipt. Exact runtime figures are
  retained outside Git; no issued private session data committed.
-320px: seven>=44px controls, one native spin, no horizontal overflow, no
  application console errors, explicit abandoned receipt.

CI/Vercel are checked on the published commit before safe mobile-test fast-forward;
provider-protected external preview cannot be interactively QA'd without its
owner's access. Local production QA is not presented as remote browser QA.

Still pending: Galactic Roulette and Galactic Birds; broader prior backlog stays
in PRODUCT_BACKLOG_STATUS. Fictitious casino balance is a game metric, never a
real ranking earning, settlement, payment or cash prize. Auth/PostgreSQL/pairing
and durable result consumption remain unconfigured. Replay is not bot resistance.
