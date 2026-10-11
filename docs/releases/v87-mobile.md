# v87-mobile — River course without a finish row

Base: v86-mobile `281b3ef91f1d1797bf6bad7ab15dd834c935b9d4`; CI38155661041
successful, Vercel6998411564Ready, mobile-test safely fast-forwarded.

River4.0 appends deterministic rows with variable traffic/platform speed,
length and gaps, bounded gradual difficulty and a forgiving opening. Removes
the 65-row finish; no levels/resets. Terminal score is maximum safe reach.
Existing six-minute verification limit remains, documented rather than described
as an unlimited-duration session. V1–V3 and their replays remain archived.

Full deterministic/history suite, typecheck/lint, production build and diff checks
passed. Golden and specific tests cover1000courses,384starts,eight long routes,
carry/phase/target/farming/invalid inputs/server replay. Native touch complete
long runs and defeats in both orientations, restart/rotation/cancel/blur and
abandoned record checked. Details: [River V4](../RIVER_DASH_V4.md).

No production identity, money or database activation. Next: safe persisted Mine
HTTP integration using existing private authority and PostgreSQL; actual public
activation requires a configured database. The16 avatar images remain missing.
CI and Vercel must pass the published HEAD before mobile-test advances.
