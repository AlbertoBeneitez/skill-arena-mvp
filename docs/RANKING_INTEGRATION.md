# Global net-profit ranking integration

This is a read-only, provider-independent preparation. No real users, real funds or financial settlement are enabled. No ZIP source is imported.

## Current behavior

The visible Ranking entry opens a server query first. `GET /api/rankings/global` returns an explicit not-configured status when the real read model has not been enabled; a configured service failure returns HTTP 503. It never substitutes a demo repository. A separate explicit “Ver demo” UI loads fictional fixtures from `lib/demo/globalRanking.ts`; every page is marked demo and all player names include demo. Local demo wallet results never feed the real ranking. Removed the client formula that fabricated a global position from local earnings.

Limits: 25 entries by default, maximum 100. Read-only keyset cursor pins the financial snapshot and the last benefit/public-player key; ties sort by public key using PostgreSQL C collation. No offset pagination. Positions must be precomputed across the full snapshot, so page reads do not re-rank the entire population. Bigint cents travel as strings and render without float rounding. EUR only; other currencies are not added to EUR totals. `findPlayerPosition` is a server repository port for future authenticated identity mapping, not an unauthenticated personal-data endpoint.

## PostgreSQL read-model contract

`PostgresRankingRepository` takes an injected Pool. Production uses the same lazily-created bounded PostgreSQL pool as MatchRepository. It does not create tables, migrate a production database, write profits or invent a ledger. The integration must supply the read-only relation `skill_arena_global_profit_ranking` with:

| Column | Meaning |
| --- | --- |
| snapshot_id text | Opaque snapshot identifier (ASCII letters/digits/underscore/hyphen, maximum 100) |
| as_of timestamptz | Same authoritative snapshot timestamp for its rows |
| position bigint | Derived global ordinal, precomputed by descending net profit and public key tie order |
| player_id text | Public ranking key; never provider login/email/private identity identifier |
| display_name text | Approved public display name, 1–80 characters |
| net_profit_minor bigint | Settled net monetary profit in currency minor units |
| currency text | EUR for the current global ranking |

The relation must contain one row per public player/currency/snapshot and expose only eligible public profiles. Publish snapshots from authoritative, settled financial entries. Net profit includes settled outcome income minus entry cost and finalized applicable fees; refunds reverse their original cost. Deposits, withdrawals, game scores and localStorage balances must not be counted as winnings. Final ledger semantics and provider integration require review before activation.

Target indexes on the underlying read model: (currency, as_of DESC, snapshot_id), and (snapshot_id, currency, net_profit_minor DESC, player_id COLLATE "C"). Materialize ranks once per snapshot in the trusted read model rather than computing row_number on every page; the adapter consumes its position column. No manual hundreds-of-file dataset.

## Pending activation steps

1. Select auth and PostgreSQL hosting independently; connect trusted identity to a public ranking key.
2. Implement/review authoritative financial settlement and supply the actual read projection. Do not populate production from demo fixtures.
3. Apply approved GDPR architecture: versioned consent/public-display eligibility, minimization and idempotent erasure. Financial-retention obligations must remain isolated from public ranking publication. Erasure must redact/remove public data and invalidate/re-publish affected public snapshots; snapshot stability is not a reason to retain public personal data.
4. Validate real read-model correctness, operational permissions, source provenance, currency rules and limits. Use read-only database permissions for the ranking query.
5. Only after review configure `DATABASE_URL` and `RANKING_READ_MODEL_READY=1` in the hosting settings. Neither is introduced or enabled by this change. Match/money competition remains separately disabled.

## Local tests

PostgreSQL tests create only an owned schema in a loopback database named skill_arena_test. Explicitly fictional fixtures verify SQL sorting, equal profits, bigint precision, cursor continuity after a new snapshot, EUR filtering, personal-position lookup and corrupt/invalid data. They drop only their owned schema. Existing match-repository tests remain part of CI. No SQLite production path or provider-specific auth/payment/KYC adapter is added.

## Avatares y posición propia (v38)

El read model puede añadir `avatar_key` nullable con valores `avatar-1`..`avatar-8`, assets originales locales. La lectura es compatible con una vista anterior que no tenga esa columna; null/missing produce monograma de nombre. El contrato público añade `avatarKey` opcional y rechaza keys inválidas/URLs externas. No se ejecuta una migración de producción ni se consulta una tabla privada de identidad. El publicador de snapshots debe aplicar el mismo consentimiento de publicación y mantener metadata coherente con el snapshot. No admite tracking de imágenes de terceros.

Top jugadores usa las primeras tres filas del snapshot de la primera página, sin otro dataset o beneficio calculado en cliente. `findPlayerPosition` ya existe como puerto de servidor; conectar esa operación al actor autenticado sigue pendiente. La UI no asocia el perfil demo a un jugador real ni inventa su posición.
