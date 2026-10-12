# Game professionalization cycle

Use this cycle for one game at a time. Do not advance the next game until the
current one has a written freeze note and a green verification run.

## 1. Desarrollo

- Choose the target game and branch from the current deployed base.
- Classify the existing implementation as CONSERVAR, MEJORAR, SUSTITUIR or
  ELIMINAR at the component, core, input, rendering, scoring, lifecycle and
  licensing levels.
- Keep the existing platform contract: registry entry, `GameLoader`,
  `GameResult`, verified-match APIs and shared runtime props.
- Change competitive rules only in a versioned deterministic core. Keep
  presentation, camera, particles, sound and haptics outside outcome logic.

## 2. Tests

- Run TypeScript and deterministic replay checks.
- Add or update golden replays for score, time, failure, replay hash and
  render-rate equivalence.
- Cover edge cases that matter to the mechanic: invalid input, duplicated
  ticks, timeout, near miss, perfect action, fail state and target-score win.
- Confirm API-level start and verify flows for at least one win, one legitimate
  failure and one rejected invalid payload.

## 3. Juego Real / QA

- Play several attempts on a mobile viewport before marking the game done.
- Check touch response, accidental double input, blocked scroll, restart,
  leaving mid-game, returning after result and orientation/resize.
- Inspect console and network. Major console errors, rejected valid attempts,
  unbounded request retries or repeated verification submissions block freeze.
- Estimate frame stability. The target is a visually stable 60 FPS on a normal
  mobile viewport; the competitive simulation may run at a higher fixed tick
  rate if replay remains deterministic.

## 4. Revisión Técnica

- Remove duplication only where it reduces real risk or makes the game easier
  to verify.
- Improve names and ownership when they clarify responsibility between core,
  input, presentation, feedback and platform integration.
- Check lifecycle cleanup: RAF, timers, listeners, pending requests, audio and
  transient effects must stop on unmount or restart.
- Verify that long frame gaps do not become a hidden competitive pause.

## 5. Pulido

- Tune feel, readability, hit targets, feedback and mobile layout without
  changing frozen replay semantics.
- Keep visible UI minimal inside the play surface. Move explanatory copy to the
  cover/catalog where possible.
- Re-run tests after every outcome-affecting change.

## 6. Congelación

A game can be frozen for the next phase only when:

- `pnpm check` passes.
- `pnpm build` passes.
- Deterministic replay and server verification pass for the current version.
- License/provenance is documented in `THIRD_PARTY_NOTICES.md`.
- QA notes record what was tested, what could not be tested, and any residual
  risk.
- The game status in `lib/games.ts` reflects the guarantees actually met.

## Precision Stack freeze note

Precision Stack is currently `VERIFIED`, not `PRODUCTION-GRADE`.

Completed in this pass:

- Deterministic V2 golden replay, render-rate equivalence and server replay
  checks pass.
- API QA covers one verified win, one verified legitimate failure and one
  rejected invalid duplicate-tick payload.
- The presentation loop now advances competitive time across long frame gaps
  instead of turning throttled frames into a pause.
- Stale verification results are ignored after unmount/restart.
- MIT provenance for the Stack mechanic remains documented under
  `sausi-7/games` in `THIRD_PARTY_NOTICES.md`.

Not completed in this environment:

- Real browser mobile QA with console/FPS capture could not run because the
  available cloud browser cannot access the local dev server and the Chromium
  download for Playwright was truncated by the CDN.

## Dino Dash freeze note

Dino Dash is currently `VERIFIED`, not `PRODUCTION-GRADE`.

Completed in this pass:

- Migrated the runner from client-result gameplay to a pure deterministic V1
  core with a seeded obstacle schedule, jump/duck input protocol, scoring,
  collision and timeout semantics.
- Added a server replay adapter and moved the catalogue entry to
  `server-replay`.
- The React component now acts as presentation/input only: responsive canvas,
  mobile jump/duck controls, feedback, ordered input recording and verified
  result submission.
- Deterministic golden replay, render-rate equivalence and no-input collision
  tests pass.
- API QA covers one verified win, one verified legitimate failure and one
  rejected invalid duplicate-tick payload.
- BSD-3-Clause provenance for the runner reference remains documented under
  `wayou/t-rex-runner` in `THIRD_PARTY_NOTICES.md`.

Not completed in this environment:

- Real browser mobile QA with console/FPS capture remains blocked for the same
  local-browser access and Playwright Chromium download reasons noted above.

## Pulse Runner freeze note

Pulse Runner is currently `VERIFIED`, not `PRODUCTION-GRADE`.

Completed in this pass:

- Migrated the one-button runner from client-result gameplay to a pure
  deterministic V1 core with seeded progressive obstacle patterns, fixed jump
  physics, scoring, collision and timeout semantics.
- Added official rules and scenario registry coverage, a server replay adapter
  and a `server-replay` catalogue entry.
- The React component now acts as presentation/input only: responsive canvas,
  mobile tap/keyboard input, feedback, ordered input recording and verified
  result submission.
- Deterministic golden replay, render-rate equivalence and no-input collision
  tests pass.

Not completed in this environment:

- Real browser mobile QA with console/FPS capture remains blocked because this
  sandbox rejects local socket binding and the previous Playwright Chromium
  download was truncated by the CDN.
