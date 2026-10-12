# v95-mobile — ranking inside Avatar

The bottom navigation now has Juegos, Grupo and Avatar. The global ranking
and its existing content live only inside Avatar. The catalogue shortcut opens
that section; browser back preserves its selection and historical ranking state
is mapped to Avatar. No ranking repository or competitive core is replaced.

This descendant includes the search removal in v92 and Cartesian Roulette V2
in v94: flight, gravity, contact and rolling use the replayed physical position,
without a prescribed circular ball animation. Historical Roulette V1 remains.

Validation: full deterministic suite, typecheck/lint, production build and diff
check passed. Native touch QA covered catalogue320px/landscape, both ranking
entry points, profile switching, real unavailable state, isolated sample pages,
back/history, pagination and no horizontal overflow or page errors. Roulette
V2 touch at320×568 and568×320 covered all49bets, one release/TOSS and abandoned
record receipt. Prior complete V2 wins/losses remain in GALACTIC_ROULETTE_V2.md.

Delivery: v92/v93 previews subsequently became Ready; mobile-test safely advanced
to v93 (921f314). CI38295718573 succeeded for d3c60be, including PostgreSQL17.
Vercel has not emitted a deployment for that commit after push and draft PR8;
exact-HEAD Ready remains required before promotion. The stable alias redirects
to Vercel SSO from this environment, so hosted browser inspection cannot claim
that its content is updated. The owner’s existing access is preserved.
Remaining product scope stays in PRODUCT_BACKLOG_STATUS.md. No real identity,
money or unconfigured private Mine service is activated.
