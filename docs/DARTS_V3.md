# Dardos 3.0.0

One persistent standard twenty-sector dartboard; exactly twenty upward-release
throws, with no stage resets, objectives, streaks or goal bonuses. The raw total
is the sum of classic dartboard values (including bull, doubles and triples).
Missing the board or an aim deadline contributes zero, consumes a throw and does
not end the run early. A nonzero twenty-throw total completes the training run;
zero ends with NO_SCORE. This is run completion, not real-player adjudication.

V1/V2 cores, adapters, fixtures and hashes remain frozen. V3 reuses their pinned
dartboard value calculation, the shared integer/seed utilities, AIM_X/AIM_Y/THROW
protocol, upward-swipe predicate, lifecycle, recorder and server adapter. New
sway profiles are generated once from the versioned seed, one independent X/Y
phase pair per throw. Amplitude/cadence/aim pressure rise gently with continuous
progress. No RNG is consulted at landing and no screen size or rendering affects
score. Reference rival metadata is adjusted to the raw-score scale.

Core keeps total separately during flight and publishes score only at the final
throw, preventing the common target resolver from truncating the twenty-throw
format. A valid hit is awarded once at120ticks; flight completes at144ticks.
The maximum replay budget remains bounded at36000ticks/8000inputs. Even twenty
full aim deadlines naturally finish before that guard.

Presentation models a one-second10m arcade throw with perspective reduction,
curved arc and changing tangent; it does not pretend to be a calibrated physical
projectile simulator. No landing reticle, future-coordinate projection, persistent
impact markers, per-shot toast or target instructions are rendered. The actual
projectile briefly reaches the authoritative impact before disappearing; a timeout
does not fabricate a thrown dart. Only accumulated total and throw count are shown.

Validation:1000 distinct sway profiles,64 full nonzero runs,eight complete miss
runs,twenty deadlines,flight locks,target1/50/1e9 equivalence,server ignoring a
forged client score and rejecting altered seed,invalid inputs/budgets,render60/
120/144Hz,immutable historical fixtures and4672 pure renderer frames.
Golden: seed `darts-v3-golden`,score925,t4350,
`sha256:264c920dc230b22ca2d38eff5f4aeca470e69a4a7901b45775a065d5fe5e08aa`.
Native browser QA uses real upward swipes and public render observations, without
client-state/clock overrides; terminal replay, both outcomes, rotation, cancel,
blur,CAMBIAR/OTRA VEZ,new ticket and abandoned prefix are checked.

Original artwork and code; no new external code/assets/audio dependency. No
production auth, money or settlement activated. Physical-device QA is follow-up.
