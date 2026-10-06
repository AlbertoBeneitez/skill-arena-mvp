# Competitive challenge datasets

## Solitaire Sprint

The demo no longer fabricates trivially solvable Klondike layouts.

`lib/deterministic/challengeSets.ts` contains a curated pool of full 52-card
decks that were solver-validated offline under the same simplified Skill Arena
rules used by the client:

- draw one;
- unlimited stock redeals;
- legal alternating tableau moves;
- waste/tableau to foundation;
- no foundation-to-tableau undo.

The selected pool intentionally includes deals requiring many tableau moves
and multiple stock passes. The current dataset contains challenges ranging from
147 to 268 verified solution actions.

The client still uses standard Klondike dealing: tableau columns contain
1..7 cards and the remaining 24 cards form the stock.

For production, the server match seed should select one challenge index so all
competitors receive the exact same deck.

## Mine Grid

Mine Grid now uses curated 10 x 14 boards with 24 mines rather than generating
a small board at runtime.

Every included board was validated offline from the fixed opening cell using
only standard local Minesweeper deductions:

1. if clue - flagged mines equals all unknown neighbours, those neighbours are
   mines;
2. if clue equals flagged mines, every other unknown neighbour is safe.

The selected boards require multiple deduction rounds and keep a larger active
frontier than the previous generator. Therefore they are no-guess boards, but
not intentionally trivial boards.

Mine Grid ignores the opponent benchmark while the board is active. The player
must actually finish every safe cell or hit a mine; beating an intermediate
score does not end the game.
