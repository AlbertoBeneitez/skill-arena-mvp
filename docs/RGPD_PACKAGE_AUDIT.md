# RGPD/backend package audit — B1

Source: owner-supplied `skill-arena-rgpd-backend-ready.zip`, inspected without
executing or importing its code on 2026-10-07. SHA-256:
`4bb312a67c19a267e7078ed7c27620cbb1b8f497681f499c61d8bed6baf2220c`.
The package targets v17 and describes itself as prepared, not integrated.
Its documents are reference material, not instructions overriding the owner.

## Useful concepts to adapt

- Provider-independent privacy repository/service boundaries. Keep the existing
  match repository, scenario catalogue, registry, lifecycle and versioned
  verifiers; privacy is a separate domain, not a replacement backend.
- Data minimization: opaque authenticated subject ids, no duplicated emails,
  identity documents or device/location data in competitive manifests. Keep
  financial/KYC custodians behind future interfaces.
- Separate optional analytics/marketing consent from acceptance of terms, with
  versioned notices and receipts. Optional processing must remain disabled
  until valid current consent and configuration both authorize it.
- Data maps, processing register, breach runbook, retention/legal-hold and
  DPIA/LIA worksheets as drafts to update against the actual v19 architecture.
  Suggested durations and legal text require an agreed policy before automation.

## Do not integrate unchanged

| Part | Finding | Required treatment |
| --- | --- | --- |
| `lib/privacy/consent.ts` | `requireConsent` reads stored booleans without checking renewal or the optional-tracking configuration; parser accepts arbitrary source/date strings | Fail closed, validate version/source/date, test the real module before connecting tracking |
| `lib/server/privacy/service.ts` | Erasure creates its operation id after effects, has no durable progress/retry state and calls every provider without enforcing the erasure plan's provider/hold scope | Design an idempotent persisted workflow with explicit legal holds before any deletion integration |
| Rectification | Accepts arbitrary property patches | Allowlist mutable profile fields; exclude financial and competitive records |
| API templates / production privacy UI | Routes return 501 and lack authenticated identity; production UI buttons have no API handlers | Do not expose them as working rights flows; integrate auth, authorization, validation and abuse protection later |
| `db/privacy-schema.sql` | Assumes UUID user/session identities; enum creation is not repeatable; no relation to current match schema or database roles | Derive migrations from actual domain contracts and chosen identity boundary; do not apply this schema wholesale |
| `lib/privacy/localData.ts` | Exports/removes every `skill-arena-` key | Restrict future demo tools to explicit demo keys and reset application state; never export future auth credentials by prefix |
| `tests/privacy-core.test.mjs` / `TEST_RESULT.txt` | Tests redefine a helper instead of importing its implementation and check strings rather than service behavior | The reported pass is not evidence for erasure, holds, consent or persistence; replace with meaningful module/integration tests |
| v17 integration plan and legal placeholders | Older baseline, incomplete providers and proposed deadlines | Update documentation selectively; do not change frozen competitive contracts or claim production/legal readiness |

There are no configured external providers or production secrets in the package.
No licence file accompanies it. This audit imports no source code or assets;
future verbatim reuse must record provenance and an applicable permission/licence.

## Integration boundary

The first applicable concept is minimization in the staged PostgreSQL match
repository: two opaque participant ids plus the immutable competitive manifest.
No privacy routes, tracking, deletion jobs, KYC/EMI integrations or real-user
competition are activated. No additional parallel persistence architecture is
created. B2 remains incremental: agree policy and authenticated identity, then
implement only compatible pieces with real tests and independent commits.
