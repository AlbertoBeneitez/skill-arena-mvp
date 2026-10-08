# Third-party notices

## Tower Building Game

Tower Drop v2 takes mechanical inspiration from the open-source project:

- **Project:** Tower Building Game
- **Repository:** https://github.com/iamkun/tower_game
- **Copyright:** Copyright (c) 2018 BMQB, Inc
- **License:** MIT
- **Pinned reference commit:** `c6fa84afe179b661fa71cf7cc8788d0c47ca2875`
- **Source modules consulted:** `src/block.js`, `src/hook.js`, `src/utils.js`
- **Files reused verbatim:** none
- **Modifications:** mechanics reimplemented as a fixed-timestep deterministic TypeScript core with server replay
- **Asset status:** no upstream sprites, audio, branding or UI assets are reused

Skill Arena does **not** reuse the original game's branding, image assets, audio
assets, UI, levels or bundled resources. The Skill Arena implementation is a
separate TypeScript deterministic engine. The mechanics adapted for Tower Drop
v2 are the swinging delivery, accelerated vertical fall, partial-support
contact, edge-pivot/tipping behaviour and progressive difficulty.

The upstream MIT notice is reproduced below.

---

MIT License

Copyright (c) 2018 BMQB, Inc

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.


## 2048

**Historical use:** retired 2048 / Merge 2048 deterministic arena. Removed from the current catalogue in v19; this notice is retained for source history and earlier releases.

- **Project:** 2048
- **Repository:** https://github.com/gabrielecirulli/2048
- **Copyright:** Copyright (c) 2014 Gabriele Cirulli
- **License:** MIT
- **Pinned reference commit:** `478b6ec346e3787f589e4af751378d06ded4cbbc`
- **Source modules consulted:** original move/grid/tile implementation
- **Files reused verbatim:** none
- **Modifications:** random tile generation replaced by a seeded deterministic event stream and original Skill Arena presentation
- **Asset status:** no upstream visual or audio assets are reused

Skill Arena adapts the original move/traversal/merge semantics. The original
random tile generation is intentionally replaced by a seeded event stream so a
match can be replayed deterministically. The original HTML/CSS presentation is
not used.

MIT License

Copyright (c) 2014 Gabriele Cirulli

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Phaser 3 TypeScript examples

**Used by:** Jet Stream control/physics model.

- **Project:** phaser3-typescript
- **Repository:** https://github.com/digitsensitive/phaser3-typescript
- **Copyright:** Copyright (c) 2018 - 2026 digitsensitive
- **License:** MIT
- **Pinned reference commit:** `05f7c8c7796de8a28a7575d6e0425c1513bbd3a2`
- **Source modules consulted:** `src/games/flappy-bird/src/objects/bird.ts`, `src/games/flappy-bird/src/scenes/game-scene.ts`
- **Files reused verbatim:** none
- **Modifications:** flap/gravity behaviour adapted to deterministic fixed-timestep Skill Arena logic
- **Asset status:** no upstream sprites, backgrounds, pipes, fonts or audio are reused

Skill Arena adapts the permissive Flappy Bird example's discrete flap impulse
and gravity model. It does not use the example's sprites, background, pipe
assets, fonts or branding. Pipe sequences are deterministic in Skill Arena.

MIT License

Copyright (c) 2018 - 2026 digitsensitive

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## sausi-7/games

**Used by:** Stack and Sky Hop; reference mechanics for Bubble Shooter / Orb
Burst and lane-crossing games.

- **Project:** games
- **Repository:** https://github.com/sausi-7/games
- **Copyright:** Copyright (c) 2026 Saurabh Singh
- **License:** MIT
- **Pinned reference commit:** `c97ef8bec4a4ce3154b4345a79aeda3ea2a6a465`
- **Source modules consulted:** `games/arcade/balance-stack/mechanics.js` for Stack; Doodle Jump, Bubble Shooter and lane-crossing examples under `games/` for their respective prototypes
- **Files reused verbatim:** none in the shipped presentation; gameplay logic is selectively adapted
- **Modifications:** Stack keeps only the useful movement/overlap/drop ideas while using frozen deterministic TypeScript cores, server replay, original orbital renderer, mobile input and Skill Arena scoring. V2 recalibrates cadence, progressively tightens the perfect window and rejects ambiguous sliver landings. Other listed prototypes are adapted independently
- **Asset status:** bundled upstream image/audio assets are not reused

Only permissively licensed gameplay structure is adapted. Skill Arena does not
reuse third-party branded names or bundled image/audio assets from the example
games. Rendering and competitive determinism are implemented specifically for
Skill Arena.

MIT License

Copyright (c) 2026 Saurabh Singh

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## wayou/t-rex-runner

**Used by:** Dino Dash endless-runner timing model.

- **Project:** t-rex-runner
- **Repository:** https://github.com/wayou/t-rex-runner
- **Copyright:** Copyright (c) 2022, 牛さん
- **License:** BSD 3-Clause
- **Pinned reference commit:** `5455bfa408ec6b707c7300ff194b7390733a766d`
- **Source modules consulted:** browser runner implementation in the repository
- **Files reused verbatim:** none
- **Modifications:** deterministic obstacle schedule, original geometry/rendering and Skill Arena scoring
- **Asset status:** Chrome/T-Rex sprite assets are not copied

Skill Arena uses original geometric artwork and a seeded obstacle schedule; no
Chrome/Dinosaur sprite assets are copied.

BSD 3-Clause License

Copyright (c) 2022, 牛さん
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its contributors
   may be used to endorse or promote products derived from this software
   without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
POSSIBILITY OF SUCH DAMAGE.

## Sky Hop 1.0 (v44)

Retains the MIT-attributed auto-bounce, downward-crossing support and horizontal
wrap mechanics from the Sky Hop adaptation described above. Original fixed-point
TypeScript implementation replaces UI-owned scoring/physics with the shared
server replay. New versioned generation adds bounded shifts, three sectors,
moving/boost/crumbling platforms, recovery checkpoints and unique pickups.
No upstream assets, sound files or new third-party code are imported.
