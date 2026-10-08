# Piano Rush V2

V1 core, adapter and golden remain immutable. V2 replaces the presentation clock
that discarded frame time with the common deterministic runtime and lifecycle.
Rules, scoring and completion belong to the core, not React.

48 seeded notes, three sectors of 16, first target at tick 240. The first eight
notes teach the mechanic without consuming shields. Intervals 108/96/84 ticks,
windows ±36/30/24 ticks; sector transitions add 240 ticks. No three consecutive
notes share a lane. Four explicit LANE actions, 36-tick cooldown, 240-input limit.

Hit score: 350 + rounded remaining-window fraction of 450 + combo bonus capped
at 360. Early taps cost 100 without consuming the note; wrong/missed notes cost
180 and reset combo. Three shields, short damage protection, sector bonus 500
and one shield recovery. Full course requires at least 32 correct notes; timeout
60 seconds. Registry target 39000; practice runs the full course. Max perfect
score 51960. No device timing, audio or canvas geometry enters simulation.

Golden: score 51960, final tick 5244; state hash
`sha256:5d589516914d8342001036e80168575bdca4c8411d8ffc0b7a1c71d7ef48f627`.
Tests cover 64 complete courses, 128 safe openings, windows/cooldown, shields,
invalid inputs, repeated replay and render independence at 60/120/144 Hz.

Native Chromium touch QA: both orientations complete all 48 notes with three
shields; idle loss is MISSED_NOTES at tick 1357, after the learning phase.
Server replay matches every result. Audio, cancel/blur, unique submit, restart,
rotation and 320-pixel layout pass without console errors or overflow. Controls
are at least 44 px. Physical-device testing is follow-up, not a release gate.

Original implementation and graphics; no external assets or code imported.
Real identity, competition and money remain disabled.
