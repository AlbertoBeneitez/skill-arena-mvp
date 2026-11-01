# DESIGN.md — GALACTIC GAMES

The design system of the app, as built (v132). Code is the source of truth: tokens live in `app/globals.css`
(`--st-*` Saturn stage, `--gx-*` type and glass). Change a token here and there in the same pull request.

## 1. Visual theme

A night watch on a Saturn orbit: one black sky, one ringed gas giant seen close and lit from behind (a crescent, v134), and the app's
panels floating in front of it like instruments on a console. Premium arcade, not neon chaos. The sky is black with smoky,
nearly neutral dust (v132 replaced the navy), the light is warm (the sun and the rings), the interface signals are cold (ion cyan). Each
game keeps its own art inside its frame; the chrome around it stays the same everywhere.

## 2. Colour

| Token | Value | Role |
| --- | --- | --- |
| `--st-abyss` | `#09090b` | Page and stage background; header and tab bar surfaces |
| `--st-deep` | `#131315` | Raised panels, sheets |
| `--st-panel` | `linear-gradient(180deg, #1c1c1f, #131316)` | Cards, forms, standings |
| `--st-ion` | `#7fe3ee` | The one interactive accent: selection, focus ring, active tab, primary action |
| `--st-gold` | `#e9c27a` | Money and rank: fictitious balance, pot, prizes, places |
| `--st-ink` | `#eceef2` | Primary text |
| `--st-mute` | `#9c9ea6` | Secondary text, labels |
| `--st-edge` | `rgba(127,227,238,.2)` | Panel borders |
| `--st-hair` | `rgba(232,240,251,.12)` | Hairlines, quiet borders |
| `--st-nebula` | `#8c7bff` | Decoration only (orbit trace); never a control colour |
| Success | `linear-gradient(180deg, #67dc94, #3faf68)` | Confirmations, the "pay and start" action |
| Alert | `#ff4f5e` | Losses, errors, destructive actions |

Rules: ion means "you can touch this" or "this is selected"; gold means "money or rank"; nothing else uses them.
No navy, generic purples or indigos in the chrome: surfaces are black and graphite (v132 converted every dark blue chrome colour to a neutral black of the same lightness). Games may use their own palettes inside the
canvas (a roulette is green and gold, a slot is a lit cabinet).

## 3. Typography

| Role | Face | Where |
| --- | --- | --- |
| Display | Unbounded (variable, 200–900) | Wordmark, screen titles, primary actions |
| Interface | Chakra Petch 400 / 600 / 700 | Every label, button, tab, HUD caption and line of copy |
| Data | JetBrains Mono (variable), tabular figures | Balances, scores, pots, codes, timers, counters |

All self-hosted in `public/fonts/` (OFL, see `THIRD_PARTY_NOTICES.md`), `font-display: swap`, latin + latin-ext.
Other scripts (Arabic, Urdu, Hindi, Bengali, Chinese, Cyrillic) fall back per glyph to the system face set for
their locale. Scale: 11.5 caption · 13 body · 15 emphasis · 18 section · 22–28 title; labels in small caps
tracking (+.06em) only where they name a field. Digit runs that change in place always use the data face.
Seven-segment readouts (`SegmentDigits`) are the scoreboard voice of games and rival boards.

## 4. Components

- **Primary action:** 48–56 px tall, radius 16, display face, a lit gradient with a 4 px base shadow (it looks
  pressable); disabled = 40 % opacity, no shadow. One primary per screen.
- **Play (catalogue):** dark glass `linear-gradient(180deg, rgba(16,32,58,.92), rgba(6,13,28,.96))` with a 1 px ion edge at 55 %; on touch it lights ion (wash + glow). The cover art carries the colour of each game (v130; it replaced the v109 gold-to-magenta gradient).
- **Choice tiles:** dark glass, hairline border; selected = ion border + ion wash, `aria-pressed`.
- **Icon buttons:** 42 × 42, radius 12–13, LED dot for on/off state.
- **Chips:** balance chip in gold glass; group code badge in the data face.
- **Lists and standings:** rows on `rgba(5,10,26,.5)`, radius 12; your own row ringed in ion.
- **Game controls:** owned by each game (slot push buttons, pinball flippers…); the chrome rules below skip
  `.gameScreen`.

## 5. Layout

Phone portrait first (390 × 844 reference), 16 px gutters, safe areas respected, no horizontal page scroll. A screen
is a header, one column of panels, the tab bar. The catalogue is a stack of rows (Populares, Nuevos, Casino, Bar, Míticos,
Dinámicos, Alternativos): each row scrolls sideways, snaps per card and shows two cards and a half, ordered by
popularity left to right. Game screens take the full height under a 60 px header; the art runs under the gesture bar.

**Nothing overlaps (v132, owner rule):** no control, panel or label may sit on top of another or on the game canvas,
at any moment. Games with buttons get a control band under the canvas, and the canvas fits the space above it.
Allowed exceptions: dialogs opened on purpose, cards fanned in one Solitaire pile, and content scrolling under the
opaque fixed header or tab bar. `scripts/qa-overlap.cjs` checks every tab and game at 390 × 844.
Between tapping a game and seeing it there is only the black stage and a thin progress line: no emblem, cover or
other picture.

## 6. Depth

Three planes: the stage (sky + planet, fixed), panels (gradient + 1 px edge + soft drop shadow
`0 10px 24px rgba(0,0,0,.35)`), and overlays (sheets, dialogs: `--gx-glass-strong`). Light comes from the upper
left: highlights on top edges (`inset 0 1px 0 rgba(255,255,255,.06)`), shadows below. Live `backdrop-filter` blur
is not used on the header, tab bar or welcome lock-up (removed in v121: it made scrolling stutter on phones); glass
is an opaque tint instead.

## 7. Motion and feedback

- One orchestrated moment per screen (the welcome camera move, the result reveal).
- Every chrome button answers the finger: 1 px travel, 1.5 % shrink and a little light on press (`translate` and
  `scale`, so positioning transforms are never overridden), brighter on hover where hover exists, an ion focus
  ring for keyboards.
- Game feedback is drawn by the game (hits, sparks, scoreboard flashes) as a pure function of the simulation.
- `prefers-reduced-motion` turns off travel, loops and camera moves.

## 8. Copy

Short, direct, Spanish first (10 locales). Themed where it does not cost clarity ("DESPEGAR" to enter the app,
"Jornada", "Bote", "Ronda"); plain where money or rules are involved ("PAGAR 5,00 € Y EMPEZAR", "La partida contará
como perdida"). Always name the real scope: saldo ficticio, sesión local, rivales simulados, datos de ejemplo.
Never "demo" in visible copy, never tutorials or instructions inside a game.

## 9. Do and don't

- Do give each game its own art and keep the chrome identical around it.
- Do keep one accent per meaning (ion = interactive, gold = money/rank).
- Don't add gradient washes, emoji or decorative icons to fill space.
- Don't put eyebrow labels over every heading or number every list; numbers only for real sequences.
- Don't use a generic system font for copy or proportional digits for changing figures.

## 10. For agents changing the UI

Read this file and `docs/STATE.md`; reuse the tokens above; scope new rules to the screen they belong to; check the
change at 390 × 844 in the production build before committing; never alter a game's simulation for a visual change.
