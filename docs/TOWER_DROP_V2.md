# Tower Drop v2 — mechanics and provenance

## Scope

Tower Drop v2 upgrades only the Tower Drop game. The rest of Skill Arena is not
part of this mechanics migration.

## Mechanics adapted from the MIT reference

The reference implementation is `iamkun/tower_game` (MIT). Tower Drop v2
adapts the following gameplay ideas:

1. A block is delivered by a **swinging hook / pendulum**, rather than moving
   horizontally on a rail.
2. Pressing DROP **releases** the block; it then follows an **accelerated
   vertical fall**.
3. Contact uses the real **support interval** between the falling block and the
   top block.
4. A partially supported block is stable only while its **centre of mass**
   remains inside the support interval.
5. An unstable block **pivots around the support edge** and rotates before
   falling.
6. Difficulty increases as the tower grows by increasing pendulum amplitude
   and swing rate.

## Skill Arena-specific implementation

These parts are original to Skill Arena:

- fixed-timestep deterministic core at 120 Hz;
- integer/fixed-point pendulum wave rather than browser-dependent trig;
- replayable DROP input protocol;
- server-authoritative replay and manifest hashing;
- target-score early win condition;
- five-minute per-block inactivity timeout;
- Skill Arena scoring, combo and perfect thresholds;
- camera behaviour, visual design, colours, ghost mode and result flow;
- no reuse of upstream assets, sound files, branding or UI.

## Files

- `lib/verified/towerDropCore.v1.ts`: frozen previous engine, kept for audit.
- `lib/verified/towerDropCore.v2.ts`: active deterministic physics engine.
- `components/games/TowerDrop.tsx`: renderer/input adapter for v2.
- `lib/server/verifiedMatch.ts`: server manifest and verification binding.
- `scripts/verify-tower-drop-determinism.ts`: deterministic and physics
  regression tests.
- `THIRD_PARTY_NOTICES.md`: upstream MIT attribution.

## Determinism

The pendulum does not call `Math.sin`. It uses an integer, sine-like wave so
that the same input ticks produce the same positions on client and server.
Gravity, tipping and angular acceleration are advanced only through the fixed
120 Hz simulation.

The client sends only the ordered DROP input ticks. The authoritative result
is recomputed server-side.
