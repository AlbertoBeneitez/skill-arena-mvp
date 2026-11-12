# Galactic Games — studio kit (package format 2)

Write your game the way Galactic Games writes its own: **pure TypeScript rules** and a **canvas screen**. Send it as
**one .zip** from the app (Games → ENVIAR JUEGO / SEND GAME). If it passes the automatic checks, Galactic Games plays
it, and an approved game is brought into the app as a new version, with the same replay and server verification as
every game in the catalogue. When the test is finished, you get a notification.

This folder is a complete, valid package (the example game «Pulse»): `npm install`, `npm run check`, `npm run zip`
and send `pulse.zip` to see the whole process.

## What goes in the .zip (max 4 MB)

| File | What it is |
| --- | --- |
| `galactic.json` | Manifest: `format` (2), `id` (lowercase-dashes), `name`, `version` (x.y.z), `shelf` (`casino`, `bar`, `mythic`, `dynamic`, `alternative`), `description` (10–280 chars), `developer`, `actions` (1–64 names in CAPS), `tickRate` (30, 60 or 120), `maxTicks` (hard length of a match, up to 108 000), `width` and `height` (the logical canvas, 120–2000), `thirdParty` (every asset or library you did not make: `{ "name", "license" }`). |
| `cover.webp` / `.png` / `.jpg` | **Required.** The presentation image players see before they play: 16:11, at least 800 × 550 (1600 × 1100 is best), max 1.5 MB. Keep the subject in the middle square: catalogue cards show the centre and put the game's name over the bottom. |
| `src/core.ts` | **The rules**: a `GameCore` (see `kit/core.ts`). It decides the result. If you split it, put the other rule files in `src/rules/`. |
| `src/game.ts` | **The screen**: a `GameView` (see `kit/view.ts`): `render(ctx, state, viewport)` and how touches and keys become actions. |
| `kit/` | The contract and the seeded random generator. Ship it unchanged. |

`npm run zip` packs exactly these (no `node_modules`, `tools` or `preview`).

## The rules (`src/core.ts`)

```ts
create(seed)            // a fresh match from the seed the server issues
step(state)             // exactly one tick: state.tick + 1
canApply(state, action) // may this action be applied now?
apply(state, action)    // apply it
```

A match replays as: `create(seed)`; then, for every tick, the inputs recorded at that tick in order, then `step`;
until the status is not `running` or `maxFinalTick` is reached (`replay` in `kit/core.ts` is exactly what the
server does). **Same seed + same inputs = same result, always.** So, in the rules:

- randomness only from `createRng` in `kit/seeded.ts`, seeded from the match seed, its state kept in the game state;
- no `Date`, `performance`, timers, `Math.random`, `window`, `document`, network or storage;
- prefer integers (or quantise floats) so every device computes the same thing;
- only relative imports (`../kit/…`, `./…`).

## The screen (`src/game.ts`)

It **only reads** the state: drawing never changes it. Draw in logical units (`width` × `height`); the app scales the
canvas to the phone. The app draws the scoreboard (`scoreCells`), the countdown, the result and the button chrome, and
records every action with its tick. No network, no `eval`, no external URLs; only relative imports.

## Test it yourself

```
npm install
npm run check     # types + the same determinism test Galactic Games runs before integrating
npm run preview   # play it in the browser (R: new match)
npm run zip       # <id>.zip, ready to send
```

## Automatic checks at upload

1. The .zip opens, stays within limits and has safe file names.
2. `galactic.json` is valid (format 2).
3. `src/core.ts` exists and the rules use nothing that breaks determinism (clock, `Math.random`, browser APIs,
   network, `eval`, non-relative imports).
4. `src/game.ts` exists and uses no network, `eval` or external URLs.
5. The cover is there, with the right format and size.

Code is not run at upload. Before a game is published, Galactic Games replays it on its servers with the app's own
tests (determinism, seed, length, golden replays).

## Conditions (summary)

Your game stays yours (copyright and all intellectual property). You grant a non-exclusive, revocable licence to host
and show it in Galactic Games while it is published, and you receive 50 % of the net commission of your game's matches (the profits it generates). The
full text is shown before you send, and a full agreement is signed before publication.

The example game, its code and this kit are CC0: copy anything you like.
