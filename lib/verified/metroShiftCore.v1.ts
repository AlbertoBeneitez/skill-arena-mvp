/** Original deterministic orbital seven-lane runner. Pixel depth is presentation only. */
import { createRng, seededShuffle } from "../deterministic/seeded";
import { clamp } from "../deterministic/integerMath";
import type { CoreState, GameCore } from "./coreRuntime.v1";
import { METRO_ACTIONS } from "./metroShiftProtocol.v1";
export const METRO_LANES = [
  32000, 86000, 140000, 195000, 250000, 304000, 358000,
] as const;
export const METRO_RULES = {
  groups: 60,
  lives: 3,
  maxLives: 3,
  laneCooldown: 16,
  lateralSpeed: 4500,
  jumpVelocity: -3800,
  gravity: 95,
  barrierClearance: 45000,
  collisionDistance: 25000,
  shieldTicks: 180,
  maxFinalTick: 18000,
  maxInputs: 3000,
} as const;
export type MetroHazard = { lane: number; kind: "wall" | "barrier" };
export type MetroGroup = {
  index: number;
  z: number;
  hazards: MetroHazard[];
  pickupLane: number | null;
  collected: boolean;
  passed: boolean;
  hit: boolean;
  jumped: boolean;
};
export type MetroState = CoreState & {
  seed: string;
  x: number;
  lane: number;
  lastLaneTick: number;
  jumpY: number;
  jumpVy: number;
  distance: number;
  groups: MetroGroup[];
  passed: number;
  lives: number;
  shieldUntil: number;
  lastDamageTick: number;
  lastPassTick: number;
  lastPickupTick: number;
  jumps: number;
};
export function makeMetroCourse(seed: string): MetroGroup[] {
  const rng = createRng(`${seed}:metro-course-v1`);
  let z = 900000;
  return Array.from({ length: 60 }, (_, i) => {
    const sector = Math.floor(i / 20),
      lanes = seededShuffle(
        [0, 1, 2, 3, 4, 5, 6],
        `${seed}:metro-course-v1:${i}`,
      );
    let hazards: MetroHazard[];
    if (i < 4)
      hazards = [{ lane: [0, 6, 3, 3][i], kind: i === 2 ? "barrier" : "wall" }];
    else
      hazards = lanes
        .slice(0, Math.min(4, 1 + Math.floor(i / 8)))
        .map((lane, j) => ({
          lane,
          kind:
            (i + j) % 3 === 0 || (sector >= 1 && rng.nextInt(4) === 0)
              ? "barrier"
              : "wall",
        }));
    const safe = lanes.filter((l) => !hazards.some((h) => h.lane === l));
    const group = {
      index: i,
      z,
      hazards,
      pickupLane: i >= 6 && i % 8 === 6 ? safe[0] : null,
      collected: false,
      passed: false,
      hit: false,
      jumped: false,
    };
    z += (420 - sector * 40 - rng.nextInt(21)) * 1000;
    return group;
  });
}
export function metroSpeed(s: MetroState) {
  return 1700 + Math.min(2, Math.floor(s.passed / 20)) * 450;
}
export function createMetro(seed: string): MetroState {
  return {
    seed,
    tick: 0,
    status: "running",
    failure: null,
    score: 0,
    x: 195000,
    lane: 3,
    lastLaneTick: -16,
    jumpY: 0,
    jumpVy: 0,
    distance: 0,
    groups: makeMetroCourse(seed),
    passed: 0,
    lives: 3,
    shieldUntil: 0,
    lastDamageTick: -999,
    lastPassTick: -999,
    lastPickupTick: -999,
    jumps: 0,
  };
}
export function stepMetro(s: MetroState) {
  s.tick++;
  s.x += clamp(METRO_LANES[s.lane] - s.x, -4500, 4500);
  if (s.jumpY < 0 || s.jumpVy < 0) {
    s.jumpVy += 95;
    s.jumpY += s.jumpVy;
    if (s.jumpY >= 0) {
      s.jumpY = 0;
      s.jumpVy = 0;
    }
  }
  s.distance += metroSpeed(s);
  for (const g of s.groups) {
    if (g.passed) continue;
    const dz = g.z - s.distance;
    if (dz > 25000) break;
    if (dz >= -25000) {
      if (
        g.pickupLane !== null &&
        !g.collected &&
        Math.abs(s.x - METRO_LANES[g.pickupLane]) <= 24000
      ) {
        g.collected = true;
        s.lastPickupTick = s.tick;
        s.score += s.lives < 3 ? 150 : 80;
        s.lives = Math.min(3, s.lives + 1);
      }
      for (const h of g.hazards)
        if (Math.abs(s.x - METRO_LANES[h.lane]) < 29000) {
          if (h.kind === "barrier" && s.jumpY <= -45000) {
            g.jumped = true;
            continue;
          }
          if (!g.hit) {
            g.hit = true;
            if (s.tick >= s.shieldUntil) {
              s.lives--;
              s.score = Math.max(0, s.score - 300);
              s.lastDamageTick = s.tick;
              s.shieldUntil = s.tick + 180;
              if (!s.lives) {
                s.status = "failed";
                s.failure = "HULL_EXHAUSTED";
                return;
              }
            }
          }
        }
    } else {
      g.passed = true;
      s.passed++;
      s.lastPassTick = s.tick;
      s.score += g.hit
        ? 60
        : 300 + Math.min(540, s.passed * 12) + (g.jumped ? 200 : 0);
    }
  }
  if (s.passed === 60) {
    s.status = "won";
    s.failure = null;
  }
}
export function canApplyMetro(s: MetroState, a: string) {
  return a === "JUMP"
    ? s.jumpY === 0 && s.jumpVy === 0
    : (a === "LEFT" ? s.lane > 0 : a === "RIGHT" ? s.lane < 6 : false) &&
        s.tick - s.lastLaneTick >= 16;
}
export function applyMetro(s: MetroState, a: string) {
  if (a === "JUMP") {
    s.jumpVy = -3800;
    s.jumps++;
  } else {
    s.lane += a === "LEFT" ? -1 : 1;
    s.lastLaneTick = s.tick;
  }
}
export const METRO_CORE: GameCore<MetroState> = {
  gameId: "metro-shift",
  gameVersion: "1.0.0",
  width: 390,
  height: 620,
  tickRate: 120,
  maxFinalTick: 18000,
  maxInputs: 3000,
  inputVersion: 1,
  actions: METRO_ACTIONS,
  content: {
    rules: METRO_RULES,
    generator: "versioned-seven-lane-3-sectors-60-groups-v1",
    collision:
      "world-distance-window-and-continuous-x;walls-block-air;barriers-clear-at45px",
    scoring: {
      pass: 300,
      perGroup: 12,
      cap: 540,
      barrier: 200,
      hitPass: 60,
      hitPenalty: 300,
      pickup: 150,
      fullPickup: 80,
    },
    completion: "60-groups-or-manifest-target;time-limit-loss",
  },
  create: createMetro,
  step: stepMetro,
  canApply: canApplyMetro,
  apply: applyMetro,
};
