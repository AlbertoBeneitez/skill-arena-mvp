# v75-mobile · Serpent mobile control

Serpent2.0.0 composes the frozen V1 movement/food/collision/queue kernel with a
small cadence reduction: initial18ticks instead17, minimum10 instead9 at120Hz.
Same toroidal18×28 grid, acceleration per two foods, two-turn queue, food
placement, scoring, tail rules and bounds. New authoritative height counts
consumed foods. Historical1.0.0 adapter/core/golden remain untouched.

Visual field grows from300×466.7 to338.1×526 logical units. Portrait direction
buttons72×64px (at320px width71px); landscape72×60px. Controls remain outside the
board. HUD shows nuclei; pickup ring replaces +1000 text. Shared recorder,
scenario binding, lazy registry and lifecycle reused. No third-party assets/code.

## Validation

- V1 golden and 32 courses preserved. V2 golden: synthetic seed
  serpent-v2-golden-original, score7000, finalTick1363, won, state hash
  sha256:1df254053f0b161dcac23cd7fa8f17ea874995c7d3322600c89ee12a7d697b6d.
- 32 full V2 courses match every V1 grid movement, food and collision decision
  with identical scores and different timing. Eight self-collision replays.
  Golden60/120/144, invalid/duplicated/excessive actions, queued opposites,
  time bound, uncontrolled RNG/clock rejection and repeated replay passed.
- Manifest V2/V3 contract and40 current/archive record versions passed.
- Typecheck/lint, production build and diff whitespace passed.
- Production Chromium/native touch, portrait390×844 and landscape844×390:
  existing fictitious5€ reply wins reach7nuclei in10.567s/11.942s,14inputs each,
  three wraps. Training defeats after3/4nuclei in5.250s/6.342s,9inputs each;
  all server-replayed, one submit, result advance exact, clean console.
- Actual UI selects the fictitious reply for target7000; free training remains
  continuous and has no seven-food limit. The first QA winning setup incorrectly
  used free training; corrected to test the real target-bearing UI rather than
  override clocks or manifests. No real-money service activated.
- Restart gets a fresh server seed, rotation and320px layout preserve session;
  all direction targets≥70×60px and no overflow. Evidence/live records outside Git.

Publish CI/Vercel are checked before mobile-test fast-forward. Physical devices
are owner follow-up. Other latest requests remain in PRODUCT_BACKLOG_STATUS.md.
