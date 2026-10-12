# Star Phalanx V3 — decisions, dodging and rewards

Version3.0 uses the common scenario manifest, input recorder, replay runtime and
append-only server adapter. V1/V2 cores/adapters/goldens remain unchanged.
The AIM/FIRE protocol stays version1. No trusted client score or real-money activation.

One continuous run has24 arriving formations/168 enemies, without level screens,
pauses, projectile clearing or formation-motion resets. Three hull lives and
150ticks of hit protection remain. First enemy charge starts at tick300–380;
84ticks of warning lock the current ship position before firing. Single, double
and triple directed fans cycle; the renderer uses the same pure volley geometry
for visible warnings. Killing the charging enemy interrupts the volley.

Every fourth kill drops a falling reward; every twelfth drops a shield instead.
Points yield500; shields yield300 and recover one hull life, capped at3. Rewards
expire below the field. Choosing whether to leave a firing line to collect one
adds risk/reward; there is no automatic recovery between formations.

Kill award =180 +35×formation index within generator band +20×band +80×extra
armor. Clearing a formation adds300 +70×band, completing a generator band adds
400; interrupting a charged enemy adds100. Hull damage subtracts250, floored at0.
These internal generator bands do not introduce separate levels. Live total is
rendered, but competitive score is published only at natural terminal, preventing
a manifest target from cutting the run short. Terminal:24 cleared formations,
hull exhaustion or21600ticks/180seconds. Authoritative reach is unique kills.

Golden: seed phalanx3-golden,607inputs, score85845, finalTick15166, statuswon,
sha256:cc954114e4daeeb13bdc64eb2ef2ffa0aaeaf9cb15c9f14bbd0cc153a05802d5.
Tests cover32 complete wins,128 fair openings, no-fire timeout, hull loss,
reward bounds/expiry/idempotent collection, invalid inputs, forged score/seed,
repeated replay and60/120/144Hz equivalence;3228 read-only renderer frames.

Production-build browser QA sends actual touch/drag/cancel/blur inputs and lets
the server replay the submitted record. Portrait:168kills/24formations,
score84645/tick14653/621inputs. Landscape:168/24,83895/tick15280/634inputs.
Both collect actual rewards and rotate mid-run; terminal result and restart
pass without console errors. Idle/cancel defeat also passes, with no stuck fire.
Full deterministic/history suite, typecheck/lint and production build pass.
Physical-mobile performance/feel remains useful follow-up, not a release blocker.

All gameplay, vectors and effects are original; no third-party assets imported.
