/** Original V3 course generation. V2 physics, inputs and terminal remain frozen. */
import { createRng } from "../deterministic/seeded";
import type { GameCore } from "./coreRuntime.v1";
import {
  ALIEN_DASH_CORE,
  ALIEN_RULES,
  createAlienState,
  stepAlien,
  type AlienActor,
  type AlienLife,
  type AlienState,
} from "./alienDashCore.v2";
export type AlienStateV3 = AlienState & { height: number };
export const ALIEN_V3_RULES = {
  ...ALIEN_RULES,
  course: "alien3-continuous-phrases-v1",
  reach: "PASSED_ACTORS",
  firstContactX: 780000,
  chainGap: [80000, 100000],
  jumpDuckGap: [185000, 215000],
  recoveryEveryPhrases: 4,
} as const;
function course(seed: string) {
  const actors: AlienActor[] = [],
    collectibles: AlienLife[] = [];
  const add = (
    kind: AlienActor["kind"],
    x: number,
    width: number,
    height: number,
    bottom = 508000,
  ) => {
    const actor: AlienActor = {
      id: actors.length,
      kind,
      x,
      width,
      height,
      bottom,
      passed: false,
      collided: false,
      chargeTick: null,
      fired: false,
    };
    actors.push(actor);
    return actor;
  };
  const life = (x: number, y: number) =>
    collectibles.push({ id: collectibles.length, x, y, collected: false });
  const intro = createRng(`${seed}:alien3:intro`);
  let x = 780000;
  add("rock", x, 28000, 32000);
  x += 28000 + 340000 + intro.nextInt(3) * 12000;
  add("rock", x, 36000, 40000);
  x += 36000 + 350000 + intro.nextInt(3) * 12000;
  const openingWidth = 240000 + intro.nextInt(5) * 10000;
  add("platform", x, openingWidth, 24000);
  life(x + Math.floor(openingWidth / 2), 462000);
  x += openingWidth + 370000;
  add("rock", x, 28000, 34000);
  x += 28000 + 380000;
  let previous = -1;
  for (
    let phrase = 0;
    phrase < 64 && actors.length < 126 && x < 32000000;
    phrase++
  ) {
    const rng = createRng(`${seed}:alien3:phrase:${phrase}`);
    // The first new mechanics are isolated before they are combined. Afterwards
    // weighted bounded templates vary both decisions and time between decisions.
    const available = phrase < 8 ? 4 : phrase < 14 ? 6 : 8;
    let pattern =
      phrase === 0
        ? 0
        : phrase === 1
          ? 1
          : phrase === 2
            ? 2
            : phrase === 3
              ? 3
              : phrase === 8
                ? 4
                : phrase === 9
                  ? 5
                  : phrase === 14
                    ? 6
                    : phrase === 15
                      ? 7
                      : rng.nextInt(available);
    if (phrase >= 4 && pattern === previous)
      pattern = (pattern + 1 + rng.nextInt(available - 1)) % available;
    previous = pattern;
    let end = x;
    if (pattern === 0) {
      const w = 42000 + rng.nextInt(3) * 6000;
      add("drone", x, w, 28000, 474000);
      end = x + w;
    } else if (pattern === 1) {
      const w = 260000 + rng.nextInt(5) * 16000,
        h = 24000 + rng.nextInt(3) * 10000;
      add("platform", x, w, h);
      if (phrase === 1 || phrase % 3 === 1)
        life(x + Math.floor(w / 2), 508000 - h - 22000);
      end = x + w;
    } else if (pattern === 2) {
      const h =
          phrase < 8
            ? [34000, 44000][rng.nextInt(2)]
            : [34000, 44000, 58000][rng.nextInt(3)],
        w = h === 58000 ? 32000 : h === 44000 ? 44000 : 28000;
      add("rock", x, w, h);
      const gap = 185000 + rng.nextInt(4) * 10000;
      add("drone", x + w + gap, 48000, 28000, 474000);
      end = x + w + gap + 48000;
    } else if (pattern === 3) {
      // The elevated deck is a readable alternative to jumping the floor-bound
      // shot. The attacker still uses exactly V2's 60-tick charge and trajectory.
      const w = 320000 + rng.nextInt(3) * 20000;
      add("platform", x, w, 44000);
      add("enemy", x + 260000, 38000, 26000, 360000);
      if (phrase % 3 === 0) life(x + 150000, 442000);
      end = x + w;
    } else if (pattern === 4) {
      // Low ceiling relative to this roof: standing collides, grounded duck fits.
      add("platform", x, 340000, 44000);
      add("drone", x + 210000, 48000, 28000, 430000);
      end = x + 340000;
    } else if (pattern === 5) {
      const first = 260000 + rng.nextInt(4) * 16000,
        second = 260000 + rng.nextInt(4) * 16000,
        gap = 80000 + rng.nextInt(3) * 10000;
      add("platform", x, first, 44000);
      add("platform", x + first + gap, second, 44000);
      if (phrase % 3 === 2)
        life(x + first + gap + Math.floor(second / 2), 442000);
      end = x + first + gap + second;
    } else if (pattern === 6) {
      // A separately visible shot followed by an ordinary rock after recovery.
      add("enemy", x, 38000, 26000, 360000);
      const gap = 360000 + rng.nextInt(4) * 20000;
      const h = rng.nextInt(2) ? 34000 : 44000,
        w = h === 34000 ? 28000 : 44000;
      add("rock", x + 38000 + gap, w, h);
      end = x + 38000 + gap + w;
    } else {
      add("rock", x, 28000, 34000);
      const firstGap = 195000 + rng.nextInt(3) * 10000;
      const droneX = x + 28000 + firstGap;
      add("drone", droneX, 48000, 28000, 474000);
      const finalRock = droneX + 48000 + 240000 + rng.nextInt(4) * 12000;
      add("rock", finalRock, 44000, 44000);
      end = finalRock + 44000;
    }
    const recovery = phrase % 4 === 3;
    const spacing = recovery
      ? 460000 + rng.nextInt(5) * 28000
      : (phrase < 14 ? 280000 : 260000) + rng.nextInt(5) * 24000;
    if (recovery) life(end + Math.floor((spacing * 3) / 5), 482000);
    x = end + spacing;
  }
  return { actors, collectibles };
}
export function createAlienStateV3(seed: string): AlienStateV3 {
  return { ...createAlienState(seed), ...course(seed), height: 0 };
}
export function stepAlienV3(state: AlienStateV3) {
  stepAlien(state);
  state.height = state.passed;
}
export const ALIEN_DASH_CORE_V3: GameCore<AlienStateV3> = {
  ...ALIEN_DASH_CORE,
  gameVersion: "3.0.0",
  content: {
    baseVersion: "2.0.0",
    base: ALIEN_DASH_CORE.content,
    generation: ALIEN_V3_RULES,
    physics: "alien-v2-unchanged",
    terminalTicks: 14400,
    reach: "passed-actors-monotonic-v1",
  },
  create: createAlienStateV3,
  step: stepAlienV3,
};
