# v92-mobile — catalogue and first-person darts

Base v91-mobile3e6071113b03d5fa9178e5fe9138d45206874691. Catalogue search,
filter state and unused search CSS removed; common registry/lazy access preserved.
Native catalogue QA covers320px/landscape, all games, loading, failed start,
result guard and navigation. Slot secondary awards are quieter and separated;
V1 payouts/goldens unchanged. Actual full insolvencies20spins and reference/zero/
rotation/restart/abandoned-record QA pass in both orientations.

Darts uses a read-only perspective projection of a solved gravitational flight
between the release and the frozen V3 authoritative impact. Depth1.2→10m,
gravity9.81m/s², one-second flight; minimum sprite silhouette aids legibility.
The rules, gesture, impact,20throws and scoring remain V3, not a new physics
adjudicator in React. Historical visual helpers/core adapters remain preserved.
4672 read-only renderer frames and native20throw runs:portrait975/t4077;
landscape defeat0/t4129. Cancel/blur/rotation/restart/record delivery/no console
errors pass. Typecheck/lint, production builds and full deterministic history
suite required before publication. CI+Vercel exactHEAD before mobile-testFF.

Next: Birds multi-storey scaffolding and counts, Roulette cartesian toss/bowl
physics and collapsible real-table bet arrangement. No production auth/money.
