# v20-mobile — staged product evolution

Base: `v19-mobile` at `392016dc64dc34cecd558842c88e3d10a70e72c1`.
Remote `mobile-test` and `feature/dino-dash-professional` are ancestors of this
base. Previous version branches remain untouched. No real competition, users
or money are activated. Human mobile-device QA remains pending.

## U1 — shared terminal lifecycle

Audit: all five verified UIs use `useVerifiedAttempt`; cores, input validation,
scoring, V2 manifests, registry/lazy loaders and append-only server adapters
remain unchanged. The hook could abort/repeat verification on a second call,
accept inputs after finishing and update a stale session after unmount.

The shared `SubmissionGate` caches one terminal request per attempt until the
session resets. Inputs are snapshotted and closed on first submission. Cleanup
aborts the request, rejects late transports even if they ignore cancellation,
and generation checks prevent stale state publication. All five callers ignore
the explicit cancelled result rather than invoking a stale `onFinish`.

Validation: `pnpm check`, frozen replay/contract/scenario goldens and build pass.
New tests exercise duplicate pending/completed calls, conflicting ids, reset,
cancellation before transport and an aborted transport resolving late. Chromium
QA mounts/unmounts all 19 games at portrait/landscape dimensions without console
errors; delayed server verification cannot finish a newly started Dino session.
No new dependency, copied code/assets or competitive rule change.
