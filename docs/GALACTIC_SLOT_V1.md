# Galactic Slot 1.0.0

Original implementation using the shared core driver, RNG, registry, lazy loader,
manifest/ticket, recorder, terminal upload and append-only server adapter.
No casino service, payment, wallet or settlement integration is introduced.

Three server-seeded strips each contain the same eight distinct symbols in a
scenario-specific fixed order. Initial positions vary. The public reference
strips remain visible and unchanged for the entire run. The six controls choose
1–8 steps per strip. A step is one eighth-turn: a whole turn alone cannot change
a symbol. Decorative full turns and easing do not determine the outcome.

Balance starts at 10,000 fictitious cents; each accepted spin debits exactly 500.
A spin lasts 360 ticks at 120 Hz. Positions and controls lock until settlement.
Last legal start is tick 21,240, leaving enough time to finish before the
21,600-tick (three-minute) deadline. No auto-spin or uncontrolled outcome RNG.

Highest applicable payout only: triples multiply the stake by 4,5,6,8,12,16,24,40
(lemon, orange, cherry, bell, star, BAR, diamond, seven). A pair returns 1,000
cents; an otherwise unmatched seven returns 500. Other combinations return zero.
Amounts stay in integer cents; the displayed paytable gives total returns,
including any stake refund. Insolvency is zero and resolves after the last spin;
time expiry resolves with the final balance. An unplayed run ends with 100€.

Score stays zero while running so the historical target resolver cannot terminate
a balance session early. Terminal score and reach are the final fictitious cents;
the registry explicitly formats this metric as fictitious euros in results.
The core terminal owns success/insolvency. This does not adjudicate an opponent
or settle funds: the platform still lacks production identity/durable consumption
and actual competitive pairing. Existing equal-manifest pairing infrastructure
is reused; independent training starts are not claimed to be paired matches.

The browser sends only the shared manifest/ticket, ordered action sequence and
final tick. The server rebuilds positions, debits and payouts. All information is
public: solving/automation is possible and replay verification does not assert
human skill or bot resistance. No real casino odds or gambling fairness claim.

Golden: `slot-v1-golden`, 59 spins, finalTick 21600, final balance 1,160,500 cents,
state hash `sha256:b9ea1be8854eea77579ddf4b88969657669e19ea20cdbab3408218886e28adae`.
Tests cover 1,000 distinct initial scenarios, 32 complete win/insolvency runs,
fixed strip permutations, payouts, controls during a spin, double debit,
time cutoff, invalid inputs, repeated replay, 60/120/144 Hz and no clocks/RNG in
simulation. Endpoint tests bind the signed manifest and reject seed tampering;
client-supplied wealth is ignored. Native QA evidence belongs in the release.

All cover/symbol/cabinet drawings are original; no external assets or code.
