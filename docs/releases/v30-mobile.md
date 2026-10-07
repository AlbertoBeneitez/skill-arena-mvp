# v30-mobile — Stack depth and clear perpendicular movement

Base: v29-mobile 2ccea90a55164dc44c983305320a4e7d9cd20b33.

Audit confirmed that V3 already alternates X and Z, cuts both real dimensions, accelerates by height and retains frozen historical replay adapters. These rules, seeds, inputs, scoring and perfect windows are unchanged. The initial 254-unit block and maximum 150-unit displacement leave at least 104 units of support, already making the first placement forgiving.

Presentation now names longitudinal/transverse motion, draws original vector direction arrows (no font-dependent symbols), deepens the projection, distinguishes side thickness, adds clipped support shadow/overlap feedback and a docking-platform shadow. Camera elevation follows a placement smoothly above eight layers. Drawing is clipped to the logical arena so high towers do not overwrite the HUD or letterbox. Registry/start instructions match the in-game instruction.

Validation: unchanged historical/current deterministic fixtures, 64 seed geometry tests, replay/render equivalence and input validation; typecheck and build. Actual Chromium touch runs in portrait and landscape produced server-verified wins (5425 and 5492 points). Final vector-arrow run produced 4800 points; high-tower run reached height 11 with 16783 points, exercising the camera. Actual posted inputs were replayed independently and matched the server score. No page errors. Physical-device human QA remains pending.

```sh
# Run pnpm test:determinism first to emit the historical core used by the browser fixture.
QA_BASE_URL=http://127.0.0.1:3000 PLAYWRIGHT_MODULE_PATH=/tmp/arena-qa/node_modules/playwright-core node scripts/qa-stack-touch.cjs
# Optional QA_LANDSCAPE=1, QA_TARGET_SCORE=16000, QA_ARTIFACT_DIR=/tmp.
```

No new competitive version or production activation. Other product improvements, Orb progression, billiards, darts, global net-profit ranking and human mobile QA remain pending.
