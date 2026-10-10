# v77-mobile · Star Phalanx readability and impact

Original presentation takes proven genre principles from Space Invaders/Galaga:
distinct friendly/hostile projectile signatures, readable imminent attacks,
visible hull protection and armor feedback. No third-party code, sprites, audio,
commercial likeness or branding imported. This unit retains the fixed-point
star-phalanx@1.0.0 core, generation, controls, score, hashes and collision rules.

Bolts retain their actual4×16 body/center and add color trails/highlights. Ship
has original wing trim and a tick-driven muzzle flash on actual firing. Charged
enemies retain their exact paired/single warning lanes and add a remaining
charge ring. Armor pips replace overlaid numbers. Shield ring shows remaining
protection. HUD shows destroyed ships instead of wave/cape/score clutter;
no coaching text introduced. No future landing path added.

## Validation

- V1 golden, input bounds, render60/120/144, 32 win/loss progression replays,
  128 safe openings, armor/shield/held-fire contracts passed unchanged.
- New actual SWC renderer regression:2921 seeded frames, exact projectile centers
  and identities, read-only core state, balanced canvas save/restore/alpha.
- Native touch production Chromium:100kills/16layers wins portrait14429ticks
  (120.242s),42775points,481inputs; landscape14073ticks(117.275s),43475points,
  463inputs. Both end with3lives, one server-verified submit and clean console.
- Defeats portrait5738ticks/0kills, landscape7535ticks/1kill; release/cancel/blur
  recorded FIRE_UP and never left automatic fire running. Restart gets a new
  manifest, no stale result/overflow. Touch-enabled audio emits oscillators.
- QA now observes the actual four-vertex ship outline; the older observer checked
  three vertices and silently used its default center. First portrait steering
  run lost; a fresh server-issued attempt completed. No seed or clock override.
- Typecheck/lint, production build and diff whitespace passed. Live manifests,
  logs/screenshots remain outside Git. Historical behavior stays reproducible.

This is a presentation/input-observation unit, not completion of the Phalanx
backlog: V2 still needs continuous layers without pause/board clearing, and common
advance/time comparison remains pending. Physical devices are owner follow-up.
CI/Vercel are checked before publishing the stable mobile-test fast-forward.
