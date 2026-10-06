# V16 deterministic competitive game set

This iteration adds seven original Skill Arena implementations built around a
shared deterministic challenge model.

## Shared fairness rule

For the current demo each game has a fixed `deterministicSeed` in
`lib/games.ts`. Two players entering the same game therefore receive the same
deck, board, food sequence, spawn sequence, puzzle, brick layout or piece
sequence.

Production should replace the fixed demo seed with a server-issued seed stored
inside the match manifest. The seed must be immutable for both player attempts
and included in the authoritative replay payload.

The common deterministic helpers live in:

- `lib/deterministic/seeded.ts`

## Games

### Solitaire Sprint

Original Skill Arena Klondike-style implementation.

Deterministic input:
- identical shuffled 52-card deck;
- identical seven-column deal;
- identical stock order.

No third-party card art or source code is used.

### Mine Grid

Original Skill Arena minesweeper-style implementation.

Deterministic input:
- same mine coordinates;
- same numeric clues;
- same opening-safe cells.

No Microsoft assets, UI or source code are used.

### Grid Serpent

Original Skill Arena snake-style implementation.

Deterministic input:
- same food coordinate sequence;
- same starting body;
- same initial speed.

No third-party assets or source code are used.

### Merge Grid

Original Skill Arena sliding-merge puzzle.

Deterministic input:
- same preferred spawn positions;
- same spawned values;
- same 4x4 starting state.

The original open-source 2048 project by Gabriele Cirulli is MIT-licensed, but
Skill Arena does not import or copy that source or its visual assets. The game
uses its own name, palette, UI and TypeScript implementation.

### Pixel Logic

Original Skill Arena nonogram implementation.

Deterministic input:
- same generated solution;
- same row clues;
- same column clues.

The product does not use the Picross name or Nintendo visual assets.

### Brick Relay

Original Skill Arena brick-and-paddle implementation.

Deterministic input:
- same brick map;
- same initial ball position and velocity;
- fixed 120 Hz physics.

The product does not use Breakout branding or Atari assets.

### Stack Shift

Original Skill Arena falling-block puzzle designed to avoid reproducing the
distinctive Tetris presentation.

Deterministic input:
- same custom piece sequence;
- same board dimensions;
- same fall timing.

The implementation intentionally uses:
- an 8-column board rather than the classic Tetris presentation;
- a custom mix of 3-, 4- and 5-cell pieces rather than the canonical seven
  tetromino set;
- original colours and controls;
- the name Stack Shift rather than Tetris.

No Tetris source, art, sounds, branding or UI are used.

## IP approach

All seven V16 components are original project code. No third-party source files
or game assets were copied into the repository.

This is intentional. The legal strategy is to reuse general game mechanics
while creating independent source code and expressive presentation. In the EU,
Directive 2009/24/EC distinguishes protected program expression from the ideas
and principles underlying program elements. That does not mean a clone is
automatically risk-free: audiovisual expression, artwork, text, branding,
trademarks and sufficiently distinctive presentation can still create
copyright, trademark or unfair-competition risk.

For that reason the V16 catalogue uses original names and presentation rather
than the commercial names 2048, Picross, Breakout or Tetris in the product UI.
