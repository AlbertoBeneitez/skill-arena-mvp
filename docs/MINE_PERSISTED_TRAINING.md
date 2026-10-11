# Mine Grid — durable private training integration

v88 connects the existing Mine2.0 private core, command authority, projections,
PostgreSQL match/attempt repositories and lazy catalogue loader. The core and
its V1/V2 replay hashes are unchanged. No code from the RGPD ZIP is imported.

## Scope and activation

This is anonymous training, not production authentication, matchmaking, ranking
or real money. An opaque256-bit bearer cookie owns the attempt; it is HttpOnly,
SameSiteStrict and Secure over HTTPS. The client cannot supply a participant id,
seed, board, score or result. Internally the existing wire mode remains `demo`;
no such label is rendered. Actual record persistence uses PostgreSQL, not mocks.

The server selects a private reproducible scenario for every new attempt.
Existing core tests cover1000distinct no-guess setups; persisted start tests
confirm different boards across repeated attempts. Only clues legally revealed
by accepted actions reach the browser. Public scenario seeds are not reused for
hidden boards. Both future participants can share the stored private manifest
through the existing authority, but this training route does not pair real users.

`GET /api/hidden-game/start` reports availability/scope/durability, no secrets.
The single registry lazy-loads MineGridEntry; when durable private training is
available it mounts the existing authority UI. Otherwise it preserves the legacy
INTEGRATED game. Its fixed setup therefore remains a known public limitation
until the database is configured; this checkpoint does not claim that Vercel's
current Mine setup has changed. The registry stays0.1/INTEGRATED for that default.

Configuration requires `ALLOW_PERSISTED_HIDDEN_TRAINING=1`, a real `DATABASE_URL`,
and explicit application of existing migrations001/002. Builds/startup never
apply migrations. Remote connections require `sslmode=verify-full`; localhost
is allowed only off Vercel for tests. Missing configuration, migrations or
connectivity never falls back to process memory on Vercel. Local memory QA stays
separately opt-in. Credentials must be supplied through provider/environment
settings, never chat, source, commits or logs.

## Persistence and lifecycle

A transaction stores immutable match and initial attempt together. Existing
repository constructors accept a query-capable transaction client as well as a
pool; no duplicate repository or SQL persistence framework is introduced.
The same authority validates ordered inputs and replays the pinned core after
each command. PostgreSQL CAS commits each revision once and recovers retries
and worker restarts. Terminal records are already persisted before feedback.
Committed command uploads use keepalive and survive component cleanup; stale
callbacks remain discarded. Leaving saves actual commands without adjudicating
an unfinished attempt as a winner. Offline/hard shutdown is not guaranteed.

Bodies are streamed with a4096-byte limit; unknown fields and cross-site or
malformed origins are rejected. Sessions are no-store and cookie-scoped.
Training starts have transaction-serialized bounds:20per actor/24h and2000total
training records, until an operator chooses a retention/abuse policy. No data
is automatically deleted and no production retention policy is invented.

Mine2.0 uses command ordinals, not a reaction-time clock. It cannot currently
provide a real elapsed-time competitive tiebreak. The UI presents authoritative
reach; real competition requires identity, elapsed-time policy, settlement,
retention, rate controls and privacy integration before activation.

## Validation

Real local PostgreSQL17 tests cover migrations, atomic rollback, worker recovery,
complete authoritative replay, concurrent idempotent commands, membership,
shared quotas and TLS/config gates. Historical repository/ranking/command tests
also pass. Full core suite preserves Mine goldens and1000field/64replay tests.

Production-build native touch QA from the normal catalogue: portrait victory
8370/revision51 and defeat1300/revision3; landscape victory8385/revision46 and
defeat580/revision3. Both have reach66on clear, new attempts on restart,
public-clue-only decisions, cancel handling and no console errors.
HTTP QA checks cookie isolation, body/seed/origin/stale rejection, retries once,
readback and committed exit-prefix persistence without a winner. Unconfigured
QA confirms no private activation/cookie and preservation of legacy training.
Physical-device testing remains recommended but is not a blocker imposed on the
owner. Public Vercel activation is still blocked by missing database configuration.
