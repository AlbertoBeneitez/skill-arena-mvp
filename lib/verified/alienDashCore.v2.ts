/** Original Alien Dash V2. Flat-ground Dino V1 and its verifier remain immutable. */
import { createRng } from "../deterministic/seeded";
import type { CoreState, GameCore } from "./coreRuntime.v1";
import { ALIEN_ACTIONS } from "./alienDashProtocol.v2";
export { ALIEN_ACTIONS } from "./alienDashProtocol.v2";
export const ALIEN_RULES = {
  ground: 508000,
  playerX: 72000,
  standingHeight: 46000,
  duckHeight: 29000,
  jumpVelocity: -4100,
  gravity: 85,
  coyoteTicks: 6,
  initialSpeed: 160000,
  maximumSpeed: 240000,
  durationTicks: 120 * 120,
  initialLives: 3,
  maximumLives: 3,
  shieldTicks: 120,
  enemyChargeTicks: 60,
  boltVX: -2600,
  scheduleLength: 128,
} as const;
export type AlienActor = {
  id: number;
  kind: "rock" | "platform" | "drone" | "enemy";
  x: number;
  width: number;
  height: number;
  bottom: number;
  passed: boolean;
  collided: boolean;
  chargeTick: number | null;
  fired: boolean;
};
export type AlienLife = {
  id: number;
  x: number;
  y: number;
  collected: boolean;
};
export type AlienBolt = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  spent: boolean;
};
export type AlienState = CoreState & {
  seed: string;
  scroll: number;
  scrollRemainder: number;
  speed: number;
  feet: number;
  vy: number;
  grounded: boolean;
  lastGroundTick: number;
  ducking: boolean;
  actors: AlienActor[];
  collectibles: AlienLife[];
  bolts: AlienBolt[];
  lives: number;
  shieldUntil: number;
  lastDamageTick: number;
  lastPickupTick: number;
  supportId: number | null;
  passed: number;
  distancePoints: number;
};
function scenario(seed: string) {
  const actors: AlienActor[] = [],
    collectibles: AlienLife[] = [];
  let x = 780000;
  for (let i = 0; i < 128; i++) {
    const rng = createRng(`${seed}:alien2:actor:${i}`),
      roll = rng.nextInt(10);
    const kind: AlienActor["kind"] =
      i < 2
        ? "rock"
        : i === 2 || i === 4
          ? "platform"
          : i < 6
            ? "rock"
            : i >= 14 && i % 6 === 2
              ? "enemy"
              : roll < 3
                ? "platform"
                : roll < 6
                  ? "drone"
                  : "rock";
    const height =
      kind === "platform"
        ? i < 6
          ? 24000
          : 24000 + rng.nextInt(3) * 10000
        : kind === "rock"
          ? i < 2
            ? 32000 + i * 8000
            : [34000, 44000, 58000][rng.nextInt(3)]
          : kind === "drone"
            ? 28000
            : 26000;
    const width =
      kind === "platform"
        ? 148000 + rng.nextInt(3) * 12000
        : kind === "rock"
          ? height === 58000
            ? 32000
            : height === 44000
              ? 44000
              : 28000
          : kind === "drone"
            ? 42000
            : 38000;
    const bottom =
      kind === "drone"
        ? i % 4 === 0
          ? 430000
          : 474000
        : kind === "enemy"
          ? 360000
          : 508000;
    actors.push({
      id: i,
      kind,
      x,
      width,
      height,
      bottom,
      passed: false,
      collided: false,
      chargeTick: null,
      fired: false,
    });
    if (kind === "platform" && (i === 2 || i % 4 === 0))
      collectibles.push({
        id: i,
        x: x + 75000,
        y: bottom - height - 22000,
        collected: false,
      });
    else if (i > 6 && i % 10 === 7)
      collectibles.push({
        id: i,
        x: x + width + 130000,
        y: 482000,
        collected: false,
      });
    x += width + (i < 6 ? 340000 : 340000 + rng.nextInt(5) * 26000);
  }
  return { actors, collectibles };
}
export function createAlienState(seed: string): AlienState {
  return {
    tick: 0,
    status: "running",
    score: 0,
    failure: null,
    seed,
    scroll: 0,
    scrollRemainder: 0,
    speed: 160000,
    feet: 508000,
    vy: 0,
    grounded: true,
    lastGroundTick: 0,
    ducking: false,
    ...scenario(seed),
    bolts: [],
    lives: 3,
    shieldUntil: 0,
    lastDamageTick: -200,
    lastPickupTick: -200,
    supportId: null,
    passed: 0,
    distancePoints: 0,
  };
}
export function alienPlayerRect(s: AlienState) {
  const h = s.ducking && s.grounded ? 29000 : 46000;
  return {
    left: 78000,
    right: 108000,
    top: s.feet - h + 4000,
    bottom: s.feet - 2000,
  };
}
function intersects(
  p: ReturnType<typeof alienPlayerRect>,
  x: number,
  top: number,
  width: number,
  height: number,
) {
  return (
    p.right > x && p.left < x + width && p.bottom > top && p.top < top + height
  );
}
function damage(s: AlienState) {
  if (s.tick < s.shieldUntil) return;
  s.lives--;
  s.shieldUntil = s.tick + 120;
  s.lastDamageTick = s.tick;
  s.score = Math.max(0, s.score - 200);
  if (s.lives === 0) {
    s.status = "failed";
    s.failure = "HULL_EXHAUSTED";
  }
}
export function stepAlien(s: AlienState) {
  s.tick++;
  s.speed = Math.min(240000, 160000 + Math.floor((s.tick * 80000) / 14400));
  const numerator = s.speed + s.scrollRemainder,
    dx = Math.floor(numerator / 120);
  s.scrollRemainder = numerator % 120;
  s.scroll += dx;
  const points = Math.floor((s.scroll * 42) / 100000);
  s.score += points - s.distancePoints;
  s.distancePoints = points;
  const previousFeet = s.feet;
  s.vy += 85;
  s.feet += s.vy;
  s.grounded = false;
  s.supportId = null;
  // Only downward top crossing can land; touching a platform side is never a teleport.
  if (s.vy >= 0)
    for (const a of s.actors) {
      if (a.kind !== "platform") continue;
      const x = a.x - s.scroll,
        top = a.bottom - a.height;
      if (x > 108000 || x + a.width < 78000) continue;
      if (previousFeet <= top && s.feet >= top) {
        s.feet = top;
        s.vy = 0;
        s.grounded = true;
        s.supportId = a.id;
      }
    }
  if (s.feet >= 508000) {
    s.feet = 508000;
    s.vy = 0;
    s.grounded = true;
    s.supportId = null;
  }
  if (s.grounded) s.lastGroundTick = s.tick;
  const player = alienPlayerRect(s);
  for (const life of s.collectibles) {
    if (life.collected) continue;
    const x = life.x - s.scroll;
    if (intersects(player, x - 9000, life.y - 9000, 18000, 18000)) {
      life.collected = true;
      s.score += s.lives < 3 ? 100 : 50;
      s.lives = Math.min(3, s.lives + 1);
      s.lastPickupTick = s.tick;
    }
  }

  for (const a of s.actors) {
    const x = a.x - s.scroll;
    if (x > 800000 || x + a.width < -50000) continue;
    if (a.kind === "enemy") {
      if (!a.fired && a.chargeTick === null && x <= 370000)
        a.chargeTick = s.tick;
      if (!a.fired && a.chargeTick !== null && s.tick - a.chargeTick >= 60) {
        a.fired = true;
        const shotX = a.x + 8000,
          shotY = a.bottom - 8000,
          flight = Math.max(
            1,
            Math.floor((shotX - s.scroll - 90000) / (dx + 2600)),
          );
        s.bolts.push({
          id: a.id,
          x: shotX,
          y: shotY,
          vx: -2600,
          vy: Math.floor((483000 - shotY) / flight),
          spent: false,
        });
      }
    } else if (
      !a.collided &&
      s.supportId !== a.id &&
      intersects(player, x, a.bottom - a.height, a.width, a.height)
    ) {
      a.collided = true;
      damage(s);
      if (s.status === "failed") return;
    }
    if (!a.passed && x + a.width < 78000) {
      a.passed = true;
      s.passed++;
      s.score += a.collided
        ? 60
        : a.kind === "drone" || a.kind === "enemy"
          ? 320
          : a.kind === "platform"
            ? 220
            : 250;
    }
  }
  for (const bolt of s.bolts) {
    if (bolt.spent) continue;
    bolt.x += bolt.vx;
    bolt.y += bolt.vy;
    const x = bolt.x - s.scroll;
    if (intersects(player, x - 6000, bolt.y - 4000, 12000, 8000)) {
      bolt.spent = true;
      damage(s);
      if (s.status === "failed") return;
    } else if (x + 6000 < 78000) {
      bolt.spent = true;
      s.score += 180;
    } else if (bolt.y > 530000) bolt.spent = true;
  }
  s.bolts = s.bolts.filter((b) => !b.spent);
  if (s.status === "running" && s.tick >= 14400) {
    s.status = "won";
    s.failure = null;
  }
}
export function canApplyAlien(s: AlienState, action: string) {
  if (s.status !== "running" || !ALIEN_ACTIONS.some((a) => a === action))
    return false;
  if (action === "JUMP")
    return s.grounded || (s.tick - s.lastGroundTick <= 6 && s.vy >= 0);
  return action === "DUCK_DOWN" ? !s.ducking : s.ducking;
}
export function applyAlien(s: AlienState, action: string) {
  if (action === "JUMP") {
    s.vy = -4100;
    s.feet--;
    s.grounded = false;
    s.lastGroundTick = -100;
    s.ducking = false;
    s.supportId = null;
  } else s.ducking = action === "DUCK_DOWN";
}
export const ALIEN_DASH_CORE: GameCore<AlienState> = {
  gameId: "dino-dash",
  gameVersion: "2.0.0",
  width: 390,
  height: 620,
  tickRate: 120,
  maxFinalTick: 14400,
  maxInputs: 3000,
  inputVersion: 2,
  actions: ALIEN_ACTIONS,
  content: {
    rules: ALIEN_RULES,
    scenario: "alien2-platforms-attackers-lives-v1",
    collision: "integer-feet-downward-support-v1",
    scoring: {
      distancePer1000px: 420,
      rock: 250,
      platform: 220,
      droneOrEnemy: 320,
      damagedPass: 60,
      boltEvade: 180,
      damagePenalty: 200,
      life: 100,
      fullLife: 50,
    },
  },
  create: createAlienState,
  step: stepAlien,
  canApply: canApplyAlien,
  apply: applyAlien,
};
