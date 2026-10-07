# v29-mobile — Tower composition and Jet death feedback

Base: v28-mobile 8d7655707d9a19858ff566df6b52e112fc82fcda.

## Tower Drop (independent commits)

Audited the existing V3 core, forecast, renderer, shared input adapter, registry and historical verifier. All competitive rules are unchanged. A uniform scene projection gives the crane rail margin, preserves rope/block proportions and shows a docking structure under the tower. Removed the anticipation caption and gameplay score; retained height and occasional perfect-placement feedback. Start and in-game instructions use the same simple tap instruction.

Real touch QA in portrait and landscape: one landing, server-verified win (780 points in both runs), duplicate touch during flight discarded, restart issued a new match. Historical V2 and V3 deterministic fixtures remain unchanged. Visual changes do not need a competitive version bump.

## Jet Stream (independent commit)

Retained V2 flight, varied windows, double passages, collectibles and verifier. Removed the name from the left gameplay HUD. On terminal failure the ship disappears into an original flash, expanding shockwave and 24 sparks; impact sound/haptic occurs once. Shared CoreCanvasGame owns the optional 720 ms presentation phase: terminal state/tick remain frozen, input queue is cleared, then the existing single-flight verifier runs. RAF and presentation state are cancelled on teardown. Games without a finale retain immediate verification.

Browser regression `scripts/qa-jet-finale.cjs`: no-input death, visible effect before result, measured 727–733 ms before verification, server score 0/OUT_OF_BOUNDS, finalTick 205/time_ms 1708 (animation time excluded). One verification request. Portrait/landscape and restart passed. Exiting during the effect produced zero verify requests and a clean restart.

```sh
QA_BASE_URL=http://127.0.0.1:3000 PLAYWRIGHT_MODULE_PATH=/tmp/arena-qa/node_modules/playwright-core node scripts/qa-jet-finale.cjs
# Repeat with QA_LANDSCAPE=1 or QA_CANCEL_FINALE=1.
```

Catalogue QA: 18 loaded covers and 36 portrait/landscape mount checks passed. River Dash also passed a touch-driven verified win/restart after the common lifecycle change.

Typecheck, deterministic/replay suite and production build pass. These checks do not substitute physical-device human QA. Shared lifecycle changes do not change any core, input protocol, replay hash or manifest contract. No real competition activation.

## Pending

Stack camera/progression, Orb Burst progression/authoritative core, other games' product improvements/backgrounds, billiards, darts, global net-profit ranking, production provider integration and human mobile QA.
