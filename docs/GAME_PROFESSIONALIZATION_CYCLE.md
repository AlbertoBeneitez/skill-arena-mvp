# Game professionalization cycle

Status: **MANDATORY** for games promoted beyond `INTEGRATED`.

GALACTIC GAMES improves one game at a time. A game is not considered finished because it renders or can be played; it is frozen only after its competitive core, mobile lifecycle and replay contract have been validated together.

## 1. Audit before editing

Review the existing core, presentation, input path, scoring, `GameLoader` integration, lifecycle, tests, documentation and licence provenance. Classify code as keep, improve, replace or remove. Avoid aesthetic refactors or parallel abstractions that do not materially improve quality, security, performance, clarity or maintainability.

## 2. Develop against the stable platform contract

Outcome-affecting rules belong in a pure versioned core under `lib/verified/`. React owns presentation and input translation only. Reuse the registry, deterministic utilities, `useVerifiedAttempt`, server verifier archive and common result contract. Do not duplicate RNG, replay, loading or settlement logic.

## 3. Validate determinism and replay

Every verified version must have:

- a frozen golden replay and hash;
- identical authoritative outcome across repeated runs;
- render-rate equivalence at 60, 120 and 144 Hz;
- protocol rejection tests for malformed or duplicated inputs;
- meaningful failure-path tests and edge cases;
- server-authoritative scoring with the client score ignored.

Any change to physics, collision, generation, scoring, tolerances or other competitive rules requires a new game version.

## 4. Mobile QA and lifecycle

Check touch targets, double taps, pointer cancellation, keyboard fallback where useful, restart/unmount behaviour, pending request cancellation, resize/orientation handling and terminal submission. The fixed simulation clock must not pause because a render frame is late or the browser briefly throttles presentation.

Target smooth presentation around 60 FPS on normal mobile hardware without coupling competitive state to refresh rate.

## 5. Review and simplify

After functional tests pass, remove duplicated logic, stale state, accidental wall-clock dependencies and avoidable allocations in hot paths. Keep names and boundaries consistent with `docs/GAME_ARCHITECTURE.md`.

## 6. Freeze

A game may move to `VERIFIED` only when typecheck, deterministic tests and production build pass, licence provenance is documented, important console errors are absent, and several real play-throughs have been completed. `PRODUCTION-GRADE` additionally requires production security/infrastructure and final device QA; it is not implied by a green local build.
