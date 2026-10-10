# Brick Relay 2.0.0

Original continuous fixed-point adaptation of V1, archived unchanged. One wall of
69 bricks: plain stationary lower rows, explosive and armored middle/upper rows,
subtle motion in upper rows. No sectors, replacement fields, wave pauses or life
resets. Same server-issued scenario for competing attempts; 1000 sampled seeds
produce 1000 different walls without manually maintained layout files.

Physics retains V1 integer geometry, ordered circle/box face resolution and two
substeps at120Hz, reusing `relayBrickX` and `relayBounce`. Base speed2000..2800
increases with destroyed bricks and paddle returns; paddle narrows140..104px.
Three lives, safe initial serve240ticks, missed-ball recovery120ticks. `height`
is the number of uniquely destroyed bricks. The historical score is still
server-calculated for the existing contract, not a new client authority.

Protocol2 adds `BOOST_DOWN`/`BOOST_UP` to V1 quantized5px AIM and LEFT/RIGHT.
Holding multiplies speed by3/2, max4200 fixed units/tick. Release restores normal
speed immediately, including during serving/recovery. Duplicate held transitions
are invalid. Aim cooldown remains7ticks. Touch, pointer-cancel, lost capture,
blur and keyboard share the common held-action lifecycle and recorder.

Brick opts into the existing coalesced destination slot in CoreCanvasGame: the
last single-axis finger destination survives the input cooldown. Other games
retain their existing queue; joystick behavior is unchanged. Accepted actions
are stamped at the actual simulation tick and verified by the common replay.

Scoring: armor contact95; unique kill306×combo (8%/kill, cap240%); clear500+
50×remaining lives; miss−200 floored0. One complete wall wins; manifest target
and28800tick timeout retain the common runtime semantics. Final and abandoned
records use the existing endpoint, no new ranking/settlement implementation.

Golden: seed`brick-v2-continuous-golden`, tick14259, score24887, won,
sha256:91d4390c85bafc6b24c7dd0bea2eeace00973deb7e75e0f063d1528fbf52069d.
Tests cover full courses, render60/120/144, replay, invalid input/limits, held
boost, bounce speed, misses, armor, safe opening and reproducible wall variety.
No external code, assets or sounds imported. Production identity/money remain
inactive; physical device follow-up does not block subsequent development.
