# V16.3 arcade-inspired deterministic games

This iteration adds four original Skill Arena implementations inspired by
well-known arcade mechanics. The commercial names are used only here as
internal design references; they are not used in the product catalogue.

## Maze Rush

Design reference: maze-chase games such as Pac-Man.

Skill Arena uses:
- an original maze;
- geometric runner/enemy shapes;
- original colours and UI;
- deterministic enemy movement from the match seed.

It does not use Pac-Man names, characters, ghosts, maze artwork, sounds or
Namco/Bandai Namco assets.

## Star Phalanx

Design reference: fixed shooters such as Space Invaders.

Skill Arena uses:
- an original geometric fleet;
- original player craft;
- deterministic wave layouts and enemy fire;
- original scoring and visual presentation.

It does not use Space Invaders alien sprites, branding, sounds or Taito assets.

## River Dash

Design reference: lane-crossing games such as Frogger.

Skill Arena uses:
- original road/river lane generation;
- abstract vehicles, platforms and player marker;
- deterministic lane speeds, phases and directions;
- repeated crossings with progressive difficulty.

It does not use Frogger characters, art, branding or Konami assets.

## Orb Burst

Design reference: bubble-launch matching games such as Puzzle Bobble /
Bust-A-Move.

Skill Arena uses:
- original orb artwork and palette;
- original board geometry and pressure rules;
- deterministic board and colour queue;
- drag-to-aim mobile controls.

It does not use Bubble Bobble/Puzzle Bobble characters, artwork, sounds,
branding or Taito assets.

## Competitive determinism

For the demo, each game has a fixed deterministic seed in `lib/games.ts`.
For production, the server should issue a per-match seed and bind it to the
match manifest so every competitor receives exactly the same environmental
sequence.
