# v26-mobile — reliable Orb Burst touch launch

Base: v25-mobile f2cedb0c5fa7bd79bcdad69c01e60006710cf77a.

## Audit and correction

Orb Burst is an INTEGRATED game, not a VERIFIED server core. Its existing seeded board, queue, grid matching, floating clusters and scoring remain unchanged. Registry and lazy loader are unchanged. Source attribution remains in the component. No historical core or server contract changes.

Critical cause: aimAngle and nextColor React state changed the draw callback; draw changed loop; both were dependencies of the initialization effect. Aiming and advancing the ammunition queue consequently reset the board, projectile, score and start time. Visual aim/ammunition are now refs consumed by the existing canvas renderer; updating them no longer restarts the simulation. Pointer ownership accepts one gesture, fires once on its release and discards cancellation/lost capture. Existing touch-action:none remains in place.

## Validation

Real Chromium touchStart/touchEnd on a production build, after the shared countdown: the historical component produced only 60 bright pixels (aim guide) in the flight region; corrected component produced 844–846 pixels, showing the launched ball. No page errors. This is a launch regression check, not a claim that all progression or competitive verification work is complete.

Run the browser regression against a production server:

```sh
npm install --prefix /tmp/arena-qa --no-audit --no-fund playwright-core@1.58.2
QA_BASE_URL=http://127.0.0.1:3000 PLAYWRIGHT_MODULE_PATH=/tmp/arena-qa/node_modules/playwright-core node scripts/qa-orb-touch.cjs
```

Uses system Chromium at /usr/bin/chromium. Tooling remains outside application dependencies. Typecheck (`pnpm lint`), deterministic/replay suite and production build passed. Physical-device human QA remains pending.

## Pending

Orb Burst progression/feedback and authoritative core, River Dash introductory crossing, Pulse Runner removal, presentation refinements, other game improvements, billiards, darts and real-server-ready net-profit ranking. Real-money competition remains disabled.
