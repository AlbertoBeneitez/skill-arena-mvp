# v88-mobile — persisted private Mine training transport

Base: v87-mobile `836702575ca33861369ae8df3db095ba69dc0ef0`, CI38165672231
successful, Vercel7000173634Ready; mobile-test advanced normally from281b3ef.

Connects Mine2.0's existing private authority to PostgreSQL transactions/CAS and
the normal catalogue under explicit durable-training configuration. No hidden
seed/board in client projections, no real authentication/money/ranking activation,
no new core or parallel persistence engine. Committed commands survive exit.

PostgreSQL17 local: complete replay, distinct starts, worker recovery, membership,
concurrent retry once, atomic rollback, cross-worker quotas and TLS gates.
Native touch full wins/losses/restart/cancel from catalogue in both orientations;
HTTP privacy/origin/body/stale/seed checks and exit-prefix persistence. Unconfigured
production-build QA preserves legacy training and never uses Vercel memory.
Full deterministic/history suite, typecheck/lint, production build, diff checks.

[Scope and evidence](../MINE_PERSISTED_TRAINING.md). Public Mine still uses the
legacy fixed setup until PostgreSQL is supplied/configured; no DATABASE_URL or
provider exists in the current environment. The16 avatar files remain absent.
No secret values requested, introduced or logged. Existing privacy audit followed;
retention/production identity and elapsed-time policy remain explicit prerequisites.
CI/Ready must pass this HEAD before mobile-test advances; physical QA is not a gate.
