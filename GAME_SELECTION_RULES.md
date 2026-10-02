# Skill Arena — Game Selection Rules

This document is the source of truth for discovering, auditing, selecting, and integrating games into Skill Arena.

## 1. Non-negotiable acceptance gate

A game can only be approved for Skill Arena when all of the following are true:

1. **No outcome-affecting randomness**
   - No RNG may influence score, win/loss, available actions, level layout, enemies, items, physics, timing windows, cards, spawns, rewards, or any other competitive state.
   - Reject or remove gameplay uses of `Math.random`, `random`, `rnd`, `rndi`, `shuffle`, random seeds, procedural generation, random spawn tables, dice, decks, loot, etc.
   - Cosmetic randomness that cannot affect perception, timing, collision, input, scoring, or outcome must still be removed before Skill Arena integration whenever practical.
   - A fixed authored level, fixed sequence, or deterministic opponent is acceptable.

2. **Deterministic simulation**
   - Given the same initial state and the same ordered inputs, the game must produce the same competitive result.
   - Time, physics, collision, and scoring must not depend on render FPS or device performance.
   - Prefer fixed-step simulation and integer/fixed-point or otherwise reproducible game-state logic where physics matters.
   - Rendering must be separated from authoritative game state.

3. **Objective competition**
   - The result must be measurable without subjective judging.
   - Valid examples: finish time, score, distance, accuracy, move count, objective completion, direct win/loss.
   - Both competitors must face the same rules and competitive state.

4. **Real skill**
   - Practice must produce a meaningful performance advantage.
   - Suitable skill dimensions include precision, timing, movement, planning, memory, strategy, rhythm, execution, multitasking, and control.
   - Reject games dominated by trivial repetition, hidden information, or luck.

5. **Mobile suitability**
   - Must already support touch or be realistically adaptable to touch without changing the competitive mechanic.
   - Preferred inputs: tap, hold, release, swipe, drag, directional touch, limited multitouch.
   - Reject designs that fundamentally require a keyboard/mouse layout unsuitable for phones.

6. **Permissive commercial source-code licence**
   - Preferred: MIT, BSD-2-Clause, BSD-3-Clause, Apache-2.0, ISC, zlib, public domain/CC0 where applicable.
   - GPL and AGPL are not accepted for the default Skill Arena stack.
   - MPL-2.0 requires separate review before use.
   - A public GitHub repository without an explicit licence is **not** approved.
   - A README saying "MIT" is not enough if the repository has no actual licence file.
   - A licence inherited from a framework/template is not enough unless it clearly licenses the game author's own contributions. If the root licence only names the upstream template/framework copyright holder, treat the game source as **not approved for reuse** until the author explicitly licenses their contributions.

7. **Assets audited separately**
   - The code licence does not automatically license art, music, SFX, fonts, trademarks, characters, or third-party packs.
   - Every bundled asset must have a commercially usable licence or be replaced with original/commissioned/CC0/OFL-compatible material as appropriate.
   - Avoid recognizable third-party characters, brands, franchises, trade dress, logos, or copied level/art designs.

8. **Anti-cheat viability**
   - We must be able to validate the initial state, ordered player inputs, timing, and final result.
   - Prefer replayable input logs and server-verifiable simulations.
   - Never trust a client-submitted score as authoritative for real-money competition.

9. **Integration viability**
   - The game must be feasible to integrate, adapt, or reimplement in Skill Arena's web/mobile architecture.
   - Prefer JavaScript/TypeScript/HTML5/Canvas/WebGL/Phaser/Kaplay or clean portable game logic.
   - Unity/Godot/native projects are acceptable only when the mechanic is strong enough to justify a port or clean-room reimplementation using the licensed source as a reference.

10. **Original Skill Arena identity**
   - Reuse permitted source code and general game mechanics, not third-party branding.
   - Reskin/rewrite visuals, sound, naming, UX, progression, and presentation so the final product has its own identity.

## 2. No duration filter

There is **no minimum or maximum average match duration**. A game is not rejected because a round lasts seconds, minutes, or substantially longer. Duration is a product-balancing variable, not an acceptance gate.

## 3. Audit procedure

For every candidate:

1. Record repository, current licence, technologies, and upstream dependencies.
2. Read the actual licence file, not only the GitHub badge.
3. Audit asset provenance and third-party notices.
4. Search source for randomness-related calls and inspect each hit manually.
5. Identify every source of game state and confirm whether it is authored/fixed or generated.
6. Check frame timing, physics step, collision, and score logic for device-dependent behaviour.
7. Check mobile/touch controls.
8. Define an objective 1v1 comparison rule.
9. Define the minimal input log required for replay/verification.
10. Classify implementation effort:
    - direct integration
    - light adaptation
    - partial rewrite
    - full reimplementation
11. Run the same recorded input sequence multiple times and compare resulting state/results.
12. Approve only after licence, randomness, determinism, mobile, and anti-cheat gates all pass.

## 4. Candidate statuses

- **GREEN — APPROVED CANDIDATE:** mandatory gates passed sufficiently for prototyping.
- **YELLOW — AUDIT/ADAPT:** promising, but one or more non-negotiable gates still require verification or a defined modification.
- **RED — REJECTED:** incompatible randomness, licence, rights, controls, or architecture.

A YELLOW candidate must never be presented as production-ready.

## 5. Categories

Use one or more of:

- Timing / Reflex
- Precision
- Deterministic Physics
- Movement / Platforming
- Rhythm
- Speed Puzzle
- Logic Puzzle
- Memory
- Strategy
- Control / Dexterity
- Direct PvP

## 6. Selection priorities

Among games that pass the mandatory gates, prefer:

1. Strong replayability and high skill ceiling.
2. Immediate, understandable core mechanic.
3. Good touch feel.
4. Objective and transparent scoring.
5. Strong replay/anti-cheat potential.
6. Distinctive or fresh mechanic.
7. Clean, maintainable source.
8. Low integration risk.
9. Clear asset/licence provenance.
10. Visual potential for a distinctive Skill Arena treatment.

## 7. Competitive implementation rule

The Skill Arena version is authoritative, not the upstream demo.

Before real-money use:
- freeze the exact game version;
- freeze each competitive ruleset/level;
- version initial state and physics constants;
- record ordered inputs and trusted timestamps;
- validate/replay results server-side or in an equivalent trusted verifier;
- ensure both competitors receive the same competitive state;
- keep financial/legal records separate from cosmetic profile resets.



## 8. V4 prototype catalog

The V4 branch contains four directly integrated deterministic prototypes selected for Skill Arena:

- **Shadow Sprint** — original Skill Arena time-trial platformer implementation with fixed authored course and fixed-step simulation.
- **Gravity Shift** — original Skill Arena gravity/slide puzzle implementation. It does not reuse the code, levels, assets, or template from the previously reviewed GravitySwitch repository.
- **Arrow Escape** — original Skill Arena implementation of a directional grid-escape puzzle using an authored fixed board.
- **Brick Breaker** — original Skill Arena implementation of the classic paddle/ball skill mechanic with fixed brick layout and fixed-step simulation.

These V4 prototypes contain no gameplay RNG. Their competitive layouts and initial state are fixed in source. The prototypes are intended for gameplay evaluation before production-grade server verification and anti-cheat are added.
