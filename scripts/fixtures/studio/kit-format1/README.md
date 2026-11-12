# Galactic Games — studio kit (package format 1)

Send your game as **one .zip** from the app (Games → ENVIAR JUEGO / SEND GAME). It is checked automatically the
moment you send it; if it passes, Galactic Games plays it and reviews it. This folder is a complete, valid package:
zip it and send it to see the whole process.

## What goes in the .zip (max 4 MB)

| File | What it is |
| --- | --- |
| `galactic.json` | Manifest: `format` (1), `id` (lowercase-dashes), `name`, `version` (x.y.z), `shelf` (`bar`, `mythic`, `dynamic`, `alternative`), `description` (10–280 chars), `developer`, `actions` (1–64 names in CAPS, the inputs your game accepts), `tickRate` (30, 60 or 120), `maxTicks` (hard length of a match, up to 108 000), `thirdParty` (every asset or library you did not make: `{ "name", "license" }`). |
| `game.html` | The interface, in **one self-contained file** (inline scripts, styles, images as data: URLs). It runs in an isolated frame with **no network**: anything loaded from outside is refused at upload. |
| `core.wasm` | The **rules**, as WebAssembly with **no imports**. Matches are replayed and verified on it, so it decides the result, not the interface. |
| `cover.webp` / `.png` / `.jpg` | Catalogue image, 16:11, at least 800 × 550 (1600 × 1100 is best), max 1.5 MB. |

## The core (ABI 1)

All parameters and results are 32-bit integers.

```
gg_init(seedLo, seedHi)   start a match from the seed the server issues
gg_input(action) -> 1|0   apply one input at the current tick (0 = ignored)
gg_step()                 advance one tick
gg_status() -> 0|1        0 running, 1 finished
gg_score() -> n           the score, an integer >= 0
gg_hash() -> h            a digest of the whole state (replays compare it)
```

A match replays as: `gg_init`; then for every tick, the inputs recorded at that tick in order, then `gg_step`; until
`gg_status` is 1. **Same seed + same inputs = same result, always.** Use integers; never read a clock or a random source
(you can't anyway: the core has no imports). `core/index.ts` is the example in AssemblyScript:

```
npx asc core/index.ts -O3 --runtime stub --use abort= --noAssert -o core.wasm
```

Rust (`wasm32-unknown-unknown`, `#![no_std]`), C/C++ (clang `--target=wasm32 -nostdlib`) or Zig work the same way.

## The interface ↔ host protocol

`window.postMessage`, the host is `window.parent`:

```
game → host  { type: "gg:ready", abi: 1 }
host → game  { type: "gg:start", seed, seedLo, seedHi }
game → host  { type: "gg:input", tick, action }   every input, with the tick it was applied at
game → host  { type: "gg:end", score, ticks }
```

The simplest way to stay in sync is the example's: embed `core.wasm` in `game.html` and run it there too.

## Automatic checks at upload

1. The .zip opens, stays within limits and has safe file names.
2. `galactic.json` is valid.
3. `game.html` exists and loads nothing from outside.
4. The cover has the right format and size.
5. `core.wasm` compiles, imports nothing and exports the ABI.
6. Three seeded matches with random inputs give the same result twice (on a fresh core and on a re-initialised one), finish by `maxTicks` and score an integer ≥ 0.
7. The seed matters: another seed gives another match.
8. A full match replays in under 1.5 s.

You get the report immediately. Then Galactic Games plays the game: the score your interface reports must match the
core's replay of your inputs.

## Conditions (summary)

Your game stays yours (copyright and all intellectual property). You grant a non-exclusive, revocable licence to host
and show it in Galactic Games while it is published, and you receive 50 % of the net commission of the matches of your
game. The full text is shown before you send, and a full agreement is signed before publication.

The example game, its core and this kit are CC0: copy anything you like.
