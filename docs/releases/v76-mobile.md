# v76-mobile · Avatar ranking and Solitaire presentation

Avatar now has48px Profile/Ranking controls. Ranking renders the existing
GlobalRanking component within Avatar, retaining selected Avatar navigation and
#profile. Standalone ranking remains accessible. Same real read API, pagination,
source validation, cancellation and isolated sample module; no extra datastore,
no fabricated authenticated position or real earnings. Embedded heading h2 and
inherited space background keep hierarchy/padding consistent.

Solitaire has an original lightweight SVG cover depicting seven staggered
columns, stock and four foundations on a space console. No duplicate game name,
no coaching and no protected assets. It is an illustration, not a seed/layout
preview. No game rules changed or legacy maturity promoted.

## Validation

Typecheck/lint, production build and diff whitespace passed. Ranking contract
(exact cents, query limits, cursors, source isolation) passed. Native Chromium
production tests pass for embedded and standalone modes:3sample pages25/25/14,
top3, avatars, negative profits, pagination bounds, real-unconfigured empty
state, no sample requests to the real API, source switching. Portrait390×844,
landscape844×390 and embedded320px layout have no overflow/console errors.
Switch Profile→Ranking→Profile→Ranking recreates clean real-unconfigured state,
without keeping sample rows. Tab controls≥44px; Avatar remains selected.

Solitaire catalogue/entry QA in both orientations: cover decodes, game name
appears once, seven columns, native stock draw produces waste, no console/width
errors. This is pre-game presentation QA; it does not close Solitaire's known
legacy win/farming/repeated-layout defects or claim complete-game validation.

Build and browser QA repeated over the final cover+ranking batch. Existing
historical game goldens are exercised by publication CI. Vercel readiness and
normal mobile-test fast-forward are checked at publication. Evidence outside Git.
