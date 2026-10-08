# v51-mobile · Piano Rush

Based on validated v50-mobile. Piano Rush V2 adds a finite 48-note course with
three precision sectors, eight-note learning phase, shields, combo and clear
judgements. Common simulation clock, lifecycle and server replay replace the
old UI clock; V1 history remains reproducible. Touch canvas and four large lane
buttons work in portrait and landscape. Original spatial presentation.

Typecheck/lint, full deterministic/historical suite, invalid-input/render/golden
checks and production build pass. Native touch wins: portrait 49640/tick 5246,
landscape 48993/tick 5247, 48 correct and three shields. Both idle losses replay
at tick 1357 with MISSED_NOTES. Restart, audio, cancel/blur, rotation, narrow
layout and single start/submit pass without console errors or overflow.

20 active games: 18 VERIFIED and two INTEGRATED. Next: Solitaire quality,
groups and secure public Mine integration. Production identity/PG/ledger remain
unconfigured; no real competition activated. Physical QA does not block work.
