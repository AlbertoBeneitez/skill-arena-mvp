# v32-mobile · Orb Burst deterministic progression

Audit: the legacy Orb component combined animation, simulation, input, color queue and scoring in React effects. v26 fixed its launch reset, but it still trusted client results. The original component remains archived; the catalogue now loads the new 1.0.0 core through the existing shared controller and append-only server adapter. Historical verified cores and V2/V3 contracts are unchanged.

Rules: 120 Hz integer fixed-point shots, 89 upward aim directions, wall rebounds, hexagonal matching of at least three, detached cluster removal. Each removed orb earns 280, with 90 extra per removed orb beyond three in that shot. After a match leaves at most three orbs, those remaining orbs are swept with the same scoring, completing the sector. Starting sectors have four rows and three colors in readable groups; every two completed sectors adds a row/color, capped at six/five. Miss tolerance decreases from six to four. Forty-five seconds without a shot/pressure event adds a row; reaching the danger line loses. Six-minute limit and 4,000-input limit are authoritative.

The server-issued seed deterministically generates each board, ammunition bag and pressure row. Inputs are tick + aim token or SHOOT; launching during flight/settling is rejected. The server rebuilds the complete game and calculates the score. No provider, credentials, real players or real-money competition are activated.

Original spatial rendering includes an observatory frame, distinct color glyphs, shot guide using the same read-only physics forecast, queue, sector feedback and ring/particle burst. Full guides teach the opening; later sectors shorten the guide. Launch sound respects the common sound setting. Shared pointer handling retains one owner, ignores stray releases and cancels only the owning gesture.

Validation: sixteen generated scenarios have accessible initial matches and reproducible winning replays; all sixteen can progress to another sector. Golden replay: seed `4550a254df1355bb9b6ae76761123eff54f81eddd86122c0c285e705b4b58454`, score 10390, finalTick 1663, won, state hash `922a8bddbdf82c26baed15c64502677ac63099740473afd2c422934f0661dc5f`. Repeated replay, 60/120/144 Hz, forbidden/duplicate/out-of-order/excess inputs, flight rejection, wall bounce, immutable forecast, pressure boundary, timeout and uncontrolled clock/RNG guards pass.

Native Chromium mobile touch regression exercises cancellation, launch, stray pointer-up, sound toggles during flight, one server verification, authoritative score and fresh-ticket restart. Portrait and landscape are tested. Deliberate missed shots cause a server-verified BOARD_OVERFLOW (observed score 0, 22 recorded inputs, 26.46 seconds); shared River touch-win regression and 36 catalogue mounts also pass. Typecheck/lint, full deterministic suite and production build are required before publication. Physical-device human QA remains pending.

```sh
pnpm check
pnpm build
pnpm start --port 3000
QA_BASE_URL=http://127.0.0.1:3000 PLAYWRIGHT_MODULE_PATH=/tmp/arena-qa/node_modules/playwright-core node scripts/qa-orb-touch.cjs
```

Mechanics reference: [sausi-7/games](https://github.com/sausi-7/games), MIT, copyright 2026 Saurabh Singh. Its license is retained at `docs/licenses/sausi-7-games-MIT.txt`. New core, space presentation, glyphs and particles are original; no protected commercial assets were copied.
