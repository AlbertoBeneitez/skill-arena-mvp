# Staged match persistence — S3a

This unit implements storage of the authoritative shared manifest only. It does
not enable real users/matches, issue V3 tickets, settle money, persist attempts
or expose database operations through HTTP. Existing demo routes still issue
and accept V2; their replay verification and historical fixtures are retained.

## Boundaries

`MatchRepository` has two operations: create an immutable match and retrieve it
for a participant. The caller must supply a **trusted server identity**, never
a player id accepted from the request body. Auth provider selection is pending.
Opaque text ids avoid imposing any provider's UUID/email format.

`PostgresMatchRepository` implements the boundary with parameterized queries.
The unique match id arbitrates simultaneous creation. An identical retry
returns the same record; changing participants, rules, seed, scenario or version
under that id produces `MATCH_CONFLICT`. Both slots retrieve the same persisted
manifest, hash and timestamp; outsiders receive no record. JSONB round trips
are checked against the existing canonical hash. A corrupted record is rejected.

The explicit `db/migrations/001-matches.sql` migration adds `arena_matches` and
an update-blocking trigger. Stored identifiers and the manifest are immutable;
there is no deletion method in this repository. This is **not** an indefinite
retention policy: authorized erasure/retention, restricted audit evidence and
legal holds need a separate agreed policy before production data exists. No
such jobs are scheduled or imported from the RGPD package.

V3 storage validation explicitly enables scenario resolution and requires the
versioned catalogue seed to match its descriptor. The default HTTP validator
remains V2-only. Storage is not authorization to choose a competitive seed:
future server matchmaking must select it once and recover the stored manifest
when a second participant joins.

## Production integration still required

- Choose authentication and implement the trusted subject/session boundary,
  membership authorization and protected matchmaking. Do not trust local demo
  profiles or browser-supplied ids, stakes, targets or seeds.
- Choose PostgreSQL hosting/pooling and deployment region. The lazy factory
  accepts the standard `DATABASE_URL`; if absent it fails with
  `DATABASE_NOT_CONFIGURED`, without SQLite or memory fallback. Nothing invokes
  the factory from existing endpoints. TLS verification is not disabled.
- Apply reviewed migrations explicitly through the deployment process, under a
  migration role. Configure a separate least-privilege runtime role and scope
  connection/TLS/pool limits to the chosen platform. No startup/build migrations.
- Add atomic attempt issuance and result consumption in the next bounded unit;
  persist replay verification before treating results as authoritative. S3a
  does not solve double-submit, financial settlement or cross-request identity.
- Agree retention, erasure/holds and operational audit/backup access. Store no
  email, avatar, IP, location, identity document or demo-wallet fields here.
  See `RGPD_PACKAGE_AUDIT.md` for compatible privacy concepts and excluded code.

No production database or auth service is configured. No production secrets
are requested or added. The CI password below is a public disposable test
fixture, not a credential for any real service.

## Local PostgreSQL integration tests

Use a dedicated disposable PostgreSQL 17 database on localhost named
`skill_arena_test`. For example:

```sh
docker run --rm --name skill-arena-postgres-test \
  -p 127.0.0.1:55439:5432 \
  -e POSTGRES_DB=skill_arena_test \
  -e POSTGRES_PASSWORD=local-test-only-skill-arena \
  postgres:17@sha256:2d2b8998d31037bf721cfdf764d76ba74171b4fab3431b7f72c27c56ddbdf9e3
```

In another terminal after it is ready:

```sh
TEST_DATABASE_URL=postgres://postgres:local-test-only-skill-arena@127.0.0.1:55439/skill_arena_test pnpm test:repository
pnpm check
pnpm build
docker stop skill-arena-postgres-test
```

The integration suite refuses remote hosts or other database names, requires
configuration rather than silently skipping, and creates/removes only its own
random schema. It tests repeated migrations, V2/V3 round trips, both slots,
outsiders, detached snapshots, concurrent first creation/retries, conflicts,
invalid seeds/participants, SQL immutability and corrupted-hash rejection.
Reopening a connection recovers the stored record. GitHub CI runs the same
suite against a disposable pinned PostgreSQL service; Vercel builds do not need
a database. The app's `lint` script currently runs TypeScript, not ESLint.

## S3a validation record

Frozen lockfile installation, `pnpm check`, the real PostgreSQL 17.11 suite,
production build, workflow actionlint and diff checks passed. Existing replay
goldens are unchanged. HTTP QA confirms V2 issuance, ignored client seed,
V3 rejection and rejected tampered tickets. Mobile browser smoke mounted and
unmounted all 19 lazy games and started all five verified adapters correctly.
It also found a pre-existing missing `/favicon.ico` on a fresh origin; this
minor presentation issue is tracked for a separate follow-up. No gameplay or
server errors were detected. Human mobile-device QA remains pending.

The follow-up adds an original `app/icon.svg` through Next's existing metadata
convention, so a fresh browser requests the supplied icon. It changes no game
rules, contracts, loaders or competitive code and imports no third-party asset.
Typecheck/deterministic fixtures, build and browser QA passed for this follow-up:
all 19 games loaded/unmounted, both mobile orientations were checked, and a
fresh origin produced no console errors or failed requests.
