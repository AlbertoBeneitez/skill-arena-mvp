# v27-mobile — River Dash introductory crossing

Base: v26-mobile 6984bfda2d556fbf21d419ac1620cb8eaa737291.

## Audit

V1 fixed movement continuity but had no novice opening: seeded traffic could occupy the entry position immediately. The same collision geometry was used by renderer and verifier; the issue was the initial challenge design. Full platform support, tick-only carry, relative movement, cooldown and scoring are retained. The V1 core and golden replay are untouched and its server adapter remains available.

## New competitive version 2.0.0

Composes the frozen V1 simulation with a versioned sector generator. First-sector roads have a wide central opening and slow traffic; platforms are broad and slow. Difficulty increases by completed crossings: traffic speeds rise, road gaps narrow, platforms shorten and their movement accelerates, within caps. New seeded layouts appear only at the safe home dock after a crossing. Both opponents receive identical sector generation for their issued seed. Inputs, runtime, lifecycle, scoring, replay and server verification reuse the existing shared infrastructure. No new manifest protocol or production activation.

## Validation

128 seeds × three initial delays: 384 novice crossings using only ten UP inputs at half-second intervals. Sixteen two-sector replay tests, golden score 1400/finalTick 780/status won/hash c1ada6b8a8ac94bc928b7378bb9e8f69cbdebe09674f99041d8b5bff0622ad29, render equivalence 60/120/144 Hz and invalid-input checks. Historical deterministic fixtures pass.

Actual mobile Chromium portrait and landscape touch controls: ten UP presses, server issued an unchanged seed, server replay returned verified=true, won=true, score=1400, no console errors. The browser fixture lowers only the local demo target to one crossing; it does not select the seed or provide a client score.

```sh
QA_BASE_URL=http://127.0.0.1:3000 PLAYWRIGHT_MODULE_PATH=/tmp/arena-qa/node_modules/playwright-core node scripts/qa-river-touch.cjs
```

Deliberate touch-driven traffic collision also returned a verified loss with zero score. Restart obtained a different match ticket and no stale result overlay. The browser regression supports QA_EXPECT_LOSS=1 and QA_LANDSCAPE=1.

Typecheck, deterministic suite and production build pass. Physical-device human QA and broader progression tuning remain pending. Orb Burst progression, Pulse Runner removal, other games, billiards, darts and ranking remain in the backlog.
