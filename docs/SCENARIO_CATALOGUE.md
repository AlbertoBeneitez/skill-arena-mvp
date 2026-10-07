# Shared scenario catalogue — generator 1.0.0

`lib/server/scenarios.ts` implements one shared mapping, independent of the
live UI catalogue. It can resolve historical identities after a catalogue
entry is retired. It does not decide whether a game/version is competitively
eligible: the existing server verifier archive owns that decision.

## Frozen mapping

Generator `1.0.0` defines 65,536 bounded indices, 0 through 65,535. The id is
`seed-catalog-v1:` followed by six decimal digits. The seed is the lowercase
SHA-256 digest of the existing canonical JSON serializer applied to:

```json
{
  "domain": "skill-arena/scenarios",
  "game_id": "dino-dash",
  "game_version": "1.0.0",
  "scenario_id": "seed-catalog-v1:000007",
  "generator_version": "1.0.0"
}
```

That example always yields
`cfbb1cb33e2390560a05558ba5335d3a895fe029e345a8b3d76811216bef90a1`.
The mapping has no clock, device, DOM, uncontrolled randomness or per-scenario
file. Game cores continue using the shared seeded RNG with the emitted seed;
this is a seed namespace, not another gameplay RNG.

Future revisions must keep this algorithm, index bounds and identity format
available for historical resolution. Add a generator revision to expand or
change the catalogue; do not mutate this frozen mapping. Outcome-affecting
course/rule changes also require the appropriate game/core version.

## Generation, selection and recovery

- `generateScenario(identity, index)` is a reproducible server-side mapping.
- `resolveScenario(identity, descriptor)` rejects aliases, unknown revisions,
  malformed descriptors and out-of-range indices, then recovers that mapping.
- `selectScenario(identity)` uses Node `crypto.randomInt` only for selecting a
  new match's index. Store its complete manifest before issuing either ticket.
  Joining an existing match must recover its stored manifest, not draw again.

Knowing a catalogue seed does not authorize an attempt. The competitive route
must resolve the approved game adapter, participant and stored match; it must
never accept a browser-selected index/seed as authority. These helpers are not
exposed by an HTTP endpoint in this unit.

## Current scope and guarantees

The mapping and server selection helper are implemented and tested; production
match persistence and authenticated two-player issuance are **not** active.
`/start` still emits V2 and uses its previous server-random seed. V3 verification
remains disabled until its manifest/participant/repository path is ready.

65,536 identities do not imply 65,536 distinct courses in every existing core.
For example Tower Drop V2 does not consume a seed. It needs a separately audited,
versioned scenario integration before claiming varying layouts. Shared mapping
must not silently alter that historical core. Legacy games remain INTEGRATED
and client-result based until individually migrated.

## Validation

The permanent suite covers pinned seed fixtures including both index limits,
4,096 repeated mappings, identity/version separation, strict bounds/descriptors,
immutable generated data, mapping with `Math.random`/`Date.now` unavailable,
server selection recovery, and identical Dino Dash core/replay states from a
generated seed. Existing 60/120/144 Hz, invalid-input and game replay goldens
remain in the same CI suite. Typecheck and production build passed. No UI,
gameplay core, licence or asset changes are part of this unit; browser gameplay
and real two-player matching are not newly claimed.
