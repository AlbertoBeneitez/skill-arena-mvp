/**
 * V2: three-lane endless runner (trains, low barriers to jump, overhead beams
 * to slide under, coin trails, life and jet pickups). The course is generated
 * lazily from the seed in chunks and speeds up with time. V1 stays frozen.
 * Pixel depth is presentation only; every rule below runs in the core.
 */
import { createRng } from "../deterministic/seeded";
import { clamp } from "../deterministic/integerMath";
import type { CoreState, GameCore } from "./coreRuntime.v1";
import { METRO_ACTIONS_V2 } from "./metroShiftProtocol.v2";

export const METRO_V2_LANES = [95000, 195000, 295000] as const;
export const METRO_V2 = Object.freeze({
  lives: 3,
  laneSpeed: 12000,
  laneCooldown: 6,
  jumpVelocity: -3800,
  gravity: 95,
  fastFall: 5200,
  lowClearance: 40000,
  slideTicks: 66,
  jetTicks: 720,
  jetHeight: 95000,
  shieldTicks: 150,
  stumbleTicks: 60,
  hitHalfWidth: 68000,
  playerHalfDepth: 10000,
  coinScore: 10,
  meterUnit: 10000,
  lookahead: 3_400_000,
  firstChunkZ: 1_300_000,
  maxFinalTick: 18000,
  maxInputs: 3000,
});

export type MetroKind = "train" | "low" | "high";
export type MetroObstacle = { z: number; len: number; lane: number; kind: MetroKind; hit: boolean };
/** state: 0 pending, 1 collected, 2 missed */
export type MetroCoin = { z: number; lane: number; air: boolean; state: 0 | 1 | 2 };
export type MetroPickup = { z: number; lane: number; kind: "jet" | "life"; state: 0 | 1 | 2 };
export type MetroStateV2 = CoreState & {
  seed: string;
  x: number;
  lane: number;
  lastLaneTick: number;
  jumpY: number;
  jumpVy: number;
  slideUntil: number;
  slideOnLand: boolean;
  jetUntil: number;
  distance: number;
  lives: number;
  shieldUntil: number;
  stumbleUntil: number;
  lastDamageTick: number;
  lastCoinTick: number;
  lastPickupTick: number;
  lastJumpTick: number;
  lastSlideTick: number;
  coinCount: number;
  jumps: number;
  slides: number;
  obstacles: MetroObstacle[];
  coins: MetroCoin[];
  pickups: MetroPickup[];
  chunk: number;
  nextZ: number;
  lastPattern: number;
  obstacleCursor: number;
  coinCursor: number;
  pickupCursor: number;
};

export function metroSpeedV2(s: Pick<MetroStateV2, "tick" | "jetUntil" | "stumbleUntil">) {
  let v = 1500 + Math.min(1500, Math.floor(s.tick / 12));
  if (s.tick < s.jetUntil) v = Math.floor((v * 135) / 100);
  if (s.tick < s.stumbleUntil) v = Math.floor((v * 6) / 10);
  return v;
}

const PATTERN_MIN_TIER = [0, 0, 0, 1, 1, 1, 2, 3, 3] as const;
type Emit = {
  obstacle(z: number, lane: number, kind: MetroKind, len?: number): void;
  coin(z: number, lane: number, air?: boolean): void;
  pickup(z: number, lane: number, kind: "jet" | "life"): void;
};
const OBSTACLE_LEN: Record<MetroKind, number> = { train: 420000, low: 30000, high: 30000 };

/** Emits one chunk and returns its length in world units. */
function emitPattern(pattern: number, e: Emit, z0: number, lane: number, other: number, third: number): number {
  const line = (z: number, l: number, n: number, step = 70000, air = false) => {
    for (let k = 0; k < n; k++) e.coin(z + k * step, l, air);
  };
  switch (pattern) {
    case 0: // coin line
      line(z0, lane, 8);
      return 8 * 70000;
    case 1: // low barrier with an air-coin arc
      line(z0, lane, 3);
      e.obstacle(z0 + 330000, lane, "low");
      for (let k = -1; k <= 1; k++) e.coin(z0 + 330000 + k * 70000, lane, true);
      line(z0 + 520000, lane, 3);
      return 700000;
    case 2: // overhead beam: slide under it
      e.obstacle(z0 + 260000, lane, "high");
      line(z0 + 120000, lane, 2);
      line(z0 + 340000, lane, 3);
      return 600000;
    case 3: // single train, coins beside it
      e.obstacle(z0, lane, "train");
      line(z0 + 40000, other, 5, 80000);
      return 420000;
    case 4: // two trains, one lane open with coins
      e.obstacle(z0, lane, "train");
      e.obstacle(z0 + 60000, other, "train", 360000);
      line(z0 + 20000, third, 6, 70000);
      return 420000;
    case 5: // wave of low barriers
      e.obstacle(z0, lane, "low");
      e.obstacle(z0, other, "low");
      line(z0 - 20000, third, 4);
      for (let k = -1; k <= 1; k++) e.coin(z0 + k * 70000, lane, true);
      return 300000;
    case 6: // train + low barrier + one air-coin lane
      e.obstacle(z0, lane, "train", 300000);
      e.obstacle(z0 + 80000, other, "low");
      line(z0 + 20000, third, 4);
      return 400000;
    case 7: // slalom of short wagons
      e.obstacle(z0, lane, "train", 200000);
      e.obstacle(z0 + 380000, other, "train", 200000);
      e.obstacle(z0 + 760000, third, "train", 200000);
      line(z0 + 200000, other, 2);
      line(z0 + 580000, third, 2);
      return 960000;
    default: // 8: beam, barrier and train side by side
      e.obstacle(z0, lane, "high");
      e.obstacle(z0, other, "low");
      e.obstacle(z0, third, "train", 260000);
      return 260000;
  }
}

function extendCourse(s: MetroStateV2) {
  while (s.nextZ < s.distance + METRO_V2.lookahead) {
    const c = s.chunk++;
    const rng = createRng(`${s.seed}:metro-v2:${c}`);
    const tier = Math.min(4, Math.floor(c / 5));
    const lanes = [0, 1, 2];
    for (let i = 2; i > 0; i--) {
      const j = rng.nextInt(i + 1);
      [lanes[i], lanes[j]] = [lanes[j], lanes[i]];
    }
    const out: { obs: MetroObstacle[]; coins: MetroCoin[]; picks: MetroPickup[] } = { obs: [], coins: [], picks: [] };
    const emit: Emit = {
      obstacle: (z, lane, kind, len) => out.obs.push({ z, len: len ?? OBSTACLE_LEN[kind], lane, kind, hit: false }),
      coin: (z, lane, air = false) => out.coins.push({ z, lane, air, state: 0 }),
      pickup: (z, lane, kind) => out.picks.push({ z, lane, kind, state: 0 }),
    };
    let span: number;
    if (c < 4) {
      // Gentle opening: coins, a jump, a slide, a train to dodge.
      const intro = [0, 1, 2, 3][c];
      span = emitPattern(intro, emit, s.nextZ, 1, 0, 2);
      s.lastPattern = intro;
    } else if (c % 12 === 6) {
      // Jet: fly over the next stretch collecting a zig-zag of coins.
      emit.pickup(s.nextZ, lanes[0], "jet");
      const flight = Math.floor((METRO_V2.jetTicks * 2300) * 0.85);
      for (let k = 1; k * 160000 < flight; k++) emit.coin(s.nextZ + 120000 + k * 160000, (k + lanes[0]) % 3, true);
      span = flight + 300000;
      s.lastPattern = 9;
    } else {
      const eligible = PATTERN_MIN_TIER.map((t, i) => (t <= tier ? i : -1)).filter((i) => i >= 0 && i !== s.lastPattern);
      const pattern = eligible[rng.nextInt(eligible.length)];
      span = emitPattern(pattern, emit, s.nextZ, lanes[0], lanes[1], lanes[2]);
      s.lastPattern = pattern;
      if (c % 9 === 8 && pattern <= 2) emit.pickup(s.nextZ + span, lanes[1], "life");
    }
    out.obs.sort((a, b) => a.z - b.z);
    out.coins.sort((a, b) => a.z - b.z);
    out.picks.sort((a, b) => a.z - b.z);
    s.obstacles.push(...out.obs);
    s.coins.push(...out.coins);
    s.pickups.push(...out.picks);
    s.nextZ += span + Math.max(230000, 380000 - tier * 35000) - rng.nextInt(5) * 10000;
  }
}

export function createMetroV2(seed: string): MetroStateV2 {
  const s: MetroStateV2 = {
    seed,
    tick: 0,
    status: "running",
    failure: null,
    score: 0,
    x: METRO_V2_LANES[1],
    lane: 1,
    lastLaneTick: -99,
    jumpY: 0,
    jumpVy: 0,
    slideUntil: 0,
    slideOnLand: false,
    jetUntil: 0,
    distance: 0,
    lives: METRO_V2.lives,
    shieldUntil: 0,
    stumbleUntil: 0,
    lastDamageTick: -999,
    lastCoinTick: -999,
    lastPickupTick: -999,
    lastJumpTick: -999,
    lastSlideTick: -999,
    coinCount: 0,
    jumps: 0,
    slides: 0,
    obstacles: [],
    coins: [],
    pickups: [],
    chunk: 0,
    nextZ: METRO_V2.firstChunkZ,
    lastPattern: -1,
    obstacleCursor: 0,
    coinCursor: 0,
    pickupCursor: 0,
  };
  extendCourse(s);
  return s;
}

export function metroMeters(s: Pick<MetroStateV2, "distance">) {
  return Math.floor(s.distance / METRO_V2.meterUnit);
}

export function stepMetroV2(s: MetroStateV2) {
  s.tick++;
  const jet = s.tick < s.jetUntil;
  s.x += clamp(METRO_V2_LANES[s.lane] - s.x, -METRO_V2.laneSpeed, METRO_V2.laneSpeed);
  if (jet) {
    s.jumpVy = 0;
    s.slideUntil = 0;
    s.slideOnLand = false;
    s.jumpY += clamp(-METRO_V2.jetHeight - s.jumpY, -4000, 4000);
  } else if (s.jumpY < 0 || s.jumpVy < 0) {
    s.jumpVy += METRO_V2.gravity;
    s.jumpY += s.jumpVy;
    if (s.jumpY >= 0) {
      s.jumpY = 0;
      s.jumpVy = 0;
      if (s.slideOnLand) {
        s.slideOnLand = false;
        s.slideUntil = s.tick + METRO_V2.slideTicks;
        s.lastSlideTick = s.tick;
      }
    }
  }
  s.distance += metroSpeedV2(s);
  extendCourse(s);
  const d = s.distance,
    sliding = s.tick < s.slideUntil,
    protectedNow = s.tick < s.shieldUntil || jet;

  // Obstacles overlapping the runner's depth window.
  while (s.obstacleCursor < s.obstacles.length) {
    const o = s.obstacles[s.obstacleCursor];
    if (o.z + o.len >= d - METRO_V2.playerHalfDepth) break;
    s.obstacleCursor++;
  }
  for (let i = s.obstacleCursor; i < s.obstacles.length; i++) {
    const o = s.obstacles[i];
    if (o.z > d + METRO_V2.playerHalfDepth) break;
    if (o.hit || o.z + o.len < d - METRO_V2.playerHalfDepth) continue;
    if (Math.abs(s.x - METRO_V2_LANES[o.lane]) >= METRO_V2.hitHalfWidth) continue;
    const cleared =
      o.kind === "low" ? s.jumpY <= -METRO_V2.lowClearance : o.kind === "high" ? sliding : false;
    if (cleared) continue;
    o.hit = true;
    if (protectedNow) continue;
    s.lives--;
    s.lastDamageTick = s.tick;
    s.shieldUntil = s.tick + METRO_V2.shieldTicks;
    s.stumbleUntil = s.tick + METRO_V2.stumbleTicks;
    if (s.lives <= 0) {
      s.status = "failed";
      s.failure = "CRASH";
      s.score = metroMeters(s) + s.coinCount * METRO_V2.coinScore;
      return;
    }
  }
  // Coins and pickups are judged once, when the runner crosses them.
  while (s.coinCursor < s.coins.length && s.coins[s.coinCursor].z <= d) {
    const c = s.coins[s.coinCursor++];
    const near = Math.abs(s.x - METRO_V2_LANES[c.lane]) < 56000;
    const level = jet || (c.air ? s.jumpY <= -30000 : s.jumpY > -30000);
    if (near && level) {
      c.state = 1;
      s.coinCount++;
      s.lastCoinTick = s.tick;
    } else c.state = 2;
  }
  while (s.pickupCursor < s.pickups.length && s.pickups[s.pickupCursor].z <= d) {
    const p = s.pickups[s.pickupCursor++];
    if (Math.abs(s.x - METRO_V2_LANES[p.lane]) < 62000) {
      p.state = 1;
      s.lastPickupTick = s.tick;
      if (p.kind === "jet") {
        s.jetUntil = s.tick + METRO_V2.jetTicks;
        // The descent after the flight is also protected.
        s.shieldUntil = Math.max(s.shieldUntil, s.jetUntil + 90);
      } else s.lives = Math.min(METRO_V2.lives, s.lives + 1);
    } else p.state = 2;
  }
  s.score = metroMeters(s) + s.coinCount * METRO_V2.coinScore;
}

export function canApplyMetroV2(s: MetroStateV2, a: string) {
  if (a === "LEFT" || a === "RIGHT")
    return (a === "LEFT" ? s.lane > 0 : s.lane < 2) && s.tick - s.lastLaneTick >= METRO_V2.laneCooldown;
  if (s.tick < s.jetUntil) return false;
  if (a === "JUMP") return s.jumpY === 0 && s.jumpVy === 0;
  if (a === "SLIDE")
    return s.jumpY < 0 || s.jumpVy < 0 ? !s.slideOnLand : s.slideUntil - s.tick < 15;
  return false;
}

export function applyMetroV2(s: MetroStateV2, a: string) {
  if (a === "JUMP") {
    s.jumpVy = METRO_V2.jumpVelocity;
    s.slideUntil = 0;
    s.lastJumpTick = s.tick;
    s.jumps++;
  } else if (a === "SLIDE") {
    s.slides++;
    if (s.jumpY < 0 || s.jumpVy < 0) {
      s.jumpVy = Math.max(s.jumpVy, METRO_V2.fastFall);
      s.slideOnLand = true;
    } else {
      s.slideUntil = s.tick + METRO_V2.slideTicks;
      s.lastSlideTick = s.tick;
    }
  } else {
    s.lane += a === "LEFT" ? -1 : 1;
    s.lastLaneTick = s.tick;
  }
}

export const METRO_CORE_V2: GameCore<MetroStateV2> = {
  gameId: "metro-shift",
  gameVersion: "2.0.0",
  width: 390,
  height: 620,
  tickRate: 120,
  maxFinalTick: METRO_V2.maxFinalTick,
  maxInputs: METRO_V2.maxInputs,
  inputVersion: 2,
  actions: METRO_ACTIONS_V2,
  content: {
    rules: METRO_V2,
    generator: "metro-v2-three-lane-lazy-chunks-9-patterns-4-tiers",
    collision: "lane-x-window;train-blocks;low-clears-at-40px;high-needs-slide;jet-and-shield-protect",
    scoring: "meters + 10*coins",
    completion: "manifest-target-score-or-three-crashes;time-limit-loss",
  },
  create: createMetroV2,
  step: stepMetroV2,
  canApply: canApplyMetroV2,
  apply: applyMetroV2,
};
