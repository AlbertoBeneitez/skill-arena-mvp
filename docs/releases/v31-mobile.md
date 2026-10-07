# v31-mobile — global net-profit ranking, honest data sources

Base: v30-mobile c0dbd66feaecd77939da7b6a6277c5a4e67734d3.

## Read model

Provider-independent ranking repository and read-only PostgreSQL adapter, sharing the bounded production pool with the existing MatchRepository. API limit 25/default, 100/max; keyset pagination pinned to a financial snapshot, descending net benefit, deterministic public-key ties, exact bigint cents, EUR filtering and a future authenticated personal-position port. No production migration, financial writes, invented ledger or real competition activation.

The actual ledger/public-profile view must be integrated before enabling the read-model flag. Without configuration the API returns explicit not-configured metadata; a configured service failure returns 503. Neither case substitutes demo data. See docs/RANKING_INTEGRATION.md for the view contract, materialized ranks, source semantics, consent/erasure goals and pending provider integration.

## Product UI

Visible home shortcut and persistent RANKING navigation. Position/player/net benefit table with previous/next pages. Default real-source view honestly says unavailable; an explicit Ver demo option loads only isolated fictional fixtures. Sticky “DEMOSTRACIÓN · IMPORTES FICTICIOS”, demo-labelled players and separated request state prevent source confusion during scrolling or switching. Removed the fabricated global-position formula based on local earnings. Account and wallet are marked demo; no client earnings are inserted into the real ranking.

## Validation

Typecheck, historical/current deterministic suite, real local PostgreSQL integration and production build passed. Database tests check bigint precision above JS safe integer, equal-profit ordering, pagination continuity after a new snapshot, EUR isolation, player position, malformed cursors and corrupted rows; existing match immutability/concurrency tests still pass. Test schemas are isolated and removed.

Mobile Chromium: server not-configured state contains no rows; three demo pages (25/25/14) navigate correctly, including negative benefits; demo navigation makes no production requests; source switching removes fictional rows; sticky disclaimer remains visible after scrolling. Portrait/landscape fit without horizontal overflow or page errors. Invalid API limits return 400. Physical-device human QA remains pending.

```sh
QA_BASE_URL=http://127.0.0.1:3000 PLAYWRIGHT_MODULE_PATH=/tmp/arena-qa/node_modules/playwright-core node scripts/qa-ranking-mobile.cjs
```

Real identities, settled profits, provider configuration and public-profile consent/erasure integration are still pending; real-money competition stays disabled. Other games' product progression, Orb authoritative core, billiards and darts remain in the backlog.
