# v74-mobile · Maze Rush circular controls

Presentation-only controller over the existing maze-rush@3.0.0. A 116px circular
stick, neutral center and diagonal axis hysteresis replace the five directional
buttons. Release keeps continuous heading; center/stop button stops. Cancellation,
capture loss, blur and hiding stop an owned gesture. Latest motion is coalesced
until the existing core cooldown permits an input, then the common recorder
records it at its actually simulated tick. No per-game replay/transport added.
Canvas swipes and arrow-key fallback remain. Board and stick do not overlap in
portrait or landscape. No coaching added; accessible labels remain.

Generation, rules, hashes, scoring, registry version and archived V1/V2/V3 cores
are unchanged. Original CSS/graphics; no third-party game assets/code imported.

## Validation

- Maze V1/V2/V3 historical goldens, invalid inputs and render60/120/144; full
  continuous deterministic wins/losses; common runtime, attempt records (39
  versions) and submission lifecycle passed.
- Joystick finger-path regression: cardinal/neutral, diagonal jitter, deliberate
  axis changes and captured movement outside the ring.
- Typecheck/lint, production build and diff whitespace passed.
- Chromium production/native touch, real issued seeds, portrait390×844 and
  landscape844×390: wins70/70 in33.675s and30.350s, full server replay matches;
  pursuer defeats at24nodes in41.800s and64.167s, zero lives. One submit per run.
- Native swipe/cancel and rapid stick drag/cancel record a STOP; thumb resets.
  Stop target remains50px. Restart issues a new match; rotation does not reset
  it. Both orientations have no console errors or horizontal overflow.
- Screenshots/logs and live match data kept outside Git in .cloud-setup.

GitHub CI and Vercel are checked at publication before advancing mobile-test.
Physical device follow-up belongs to the owner and does not block later work.
Remaining latest feedback is tracked in PRODUCT_BACKLOG_STATUS.md; this release
closes only the Maze joystick unit, not the complete product backlog.
