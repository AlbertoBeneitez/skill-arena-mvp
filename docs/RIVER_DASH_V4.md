# River Dash V4 — generated continuous course

V4 keeps V1/V2/V3 cores, signed manifests and replay fixtures unchanged. The
existing registry, lazy loader, scenario generator, input recorder, fixed-tick
runtime and server adapter are reused. No third-party code/assets are introduced.

The course appends twelve rows ahead, using the shared RNG with seed namespace
`river4:row:<absolute row>`. There is no finish row, crossing reset, level or
mid-run teleport. Safe rows interrupt at most two consecutive hazards. The
opening remains forgiving; later rows vary speed, length and separation with a
smooth bounded difficulty curve. This is an endless course, not an unlimited
session: the existing six-minute/4000-input verification resource limits remain.

Traffic phases are computed from absolute integer ticks even outside the camera;
a row generated later has the same phase it would have had from the beginning.
Rendering geometry is read-only and reuses frozen V1 tiling. Platforms carry the
player once per tick; relative movement preserves fractional position.

`height` is maximum safely reached row. A fatal arrival earns nothing. Repeated
rows cannot farm reach. Score remains zero while playing, so an old signed target
cannot prematurely stop the run; terminal score equals height. Collisions and the
technical time limit terminate the run. Training completion is not adjudication
against a real opponent; common ranking/comparison integration remains separate.

Validation: 1000 distinct reproducible course profiles; 384 forgiving starts;
eight routes past the old finish; replay at 60/120/144 Hz; invalid/excess inputs;
carry, bounds, farming, target independence and signed score/seed verification.
Golden: `river4-golden`, reach151, tick43200, TIME_LIMIT,
`sha256:30235597c9d6197574fa8044ca53884f6493399b758b8aa36d022ded90c4fff9`.
Native browser touch: portrait reach80/t3863/109inputs; landscape
reach80/t3681/103inputs; initial defeats t165/t159. Restart, orientation, cancel,
blur and explicit abandoned-prefix receipt checked; no console errors.
Physical-device QA remains useful, not a release gate imposed on the owner.
