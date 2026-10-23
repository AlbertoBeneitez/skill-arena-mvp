/**
 * V4: endless Sky Hop. There is no finish: the course is generated on demand
 * from the seed (one pure function per platform index) and keeps getting
 * harder — narrower and more mobile supports, longer jumps, more crumbling
 * supports, fewer lives pickups and more frequent sentries. V1–V3 stay
 * untouched for historical replays; the sentry geometry helpers are reused.
 */
import { createRng } from "../deterministic/seeded";
import { clamp, roundDiv } from "../deterministic/integerMath";
import type { GameCore } from "./coreRuntime.v1";
import { createSkyHop, hopPlatformX, SKY_HOP_RULES, type HopPlatform } from "./skyHopCore.v1";
import { SKY_HOP_CORE_V2 } from "./skyHopCore.v2";
import {
  SKY_HOP_ENEMY_RULES,
  hopEnemyActive,
  hopEnemyVisible,
  hopEnemyX,
  type HopEnemy,
  type SkyHopV3State,
} from "./skyHopCore.v3";

export const SKY_HOP_V4 = Object.freeze({
  /** Platforms generated ahead of the highest one reached. */
  ahead: 30,
  rampPlatforms: 70,
  minWidth: 54_000,
  maxGap: 116_000,
});
export type SkyHopV4State = SkyHopV3State;

/** One platform, a pure function of the seed, the index and the previous platform. */
export function makeHopPlatformV4(seed: string, i: number, previous: HopPlatform | null): HopPlatform {
  const rng = createRng(`${seed}:sky-hop-v4-platform:${i}`);
  const checkpoint = i % 10 === 0;
  const ramp = Math.min(1, i / SKY_HOP_V4.rampPlatforms);
  const crumbleEvery = i >= 100 ? 4 : i >= 60 ? 5 : i >= 30 ? 6 : 9;
  const kind: HopPlatform["kind"] = checkpoint
    ? "checkpoint"
    : i < 5
      ? "normal"
      : i % 10 === 7 && (i < 50 || i % 20 === 7)
        ? "boost"
        : i >= 12 && i % crumbleEvery === 4
          ? "crumble"
          : i >= 8 && rng.nextInt(100) < 20 + Math.round(ramp * 35)
            ? "moving"
            : "normal";
  const width = checkpoint
    ? Math.max(104_000, 144_000 - Math.round(ramp * 30_000))
    : i < 5
      ? 138_000
      : Math.max(SKY_HOP_V4.minWidth, 126_000 - Math.round(ramp * 72_000) - rng.nextInt(9) * 1000);
  const drift = kind === "moving" ? (14 + Math.round(ramp * 30) + rng.nextInt(9)) * 1000 : 0;
  const period = Math.max(200, 420 - Math.round(ramp * 200)) + rng.nextInt(121);
  const phase = rng.nextInt(420);
  let y = 566_000,
    center = 195_000;
  if (previous) {
    y = previous.y - (i < 5 ? 72_000 : Math.min(SKY_HOP_V4.maxGap, 80_000 + Math.round(ramp * 30_000) + rng.nextInt(7) * 1000));
    center = previous.x + previous.width / 2;
    if (i >= 4) {
      const spread = 90 + Math.round(ramp * 80);
      center = clamp(
        center + (rng.nextInt(2 * spread + 1) - spread) * 1000,
        26_000 + width / 2 + drift,
        364_000 - width / 2 - drift,
      );
    }
  }
  return {
    x: center - width / 2,
    y,
    width,
    kind,
    drift,
    period,
    phase,
    pickup: i >= 6 && i % (i >= 40 ? 13 : 7) === 6,
  };
}

function makeHopEnemyV4(state: SkyHopV4State, i: number): HopEnemy | null {
  const p = state.platforms[i],
    previous = state.platforms[i - 1];
  if (i < 10 || !previous || (p.kind !== "normal" && p.kind !== "moving") || i % 10 < 3) return null;
  const last = state.enemies[state.enemies.length - 1];
  if (last && i - last.platform < (i >= 30 ? 2 : SKY_HOP_ENEMY_RULES.spacing)) return null;
  const rng = createRng(`${state.seed}:sky-hop-v4-enemy:${i}`);
  if (rng.nextInt(i >= 80 ? 10 : i >= 30 ? 6 : 4) === 0) return null;
  const displacement = p.x + p.width / 2 - previous.x - previous.width / 2;
  const side: -1 | 1 = displacement === 0 ? (rng.nextInt(2) ? 1 : -1) : displacement > 0 ? 1 : -1;
  const edge = side < 0 ? p.x - p.drift : p.x + p.width + p.drift;
  if (side < 0 ? edge - SKY_HOP_ENEMY_RULES.outsetMax < 20_000 : edge + SKY_HOP_ENEMY_RULES.outsetMax > 370_000)
    return null;
  const period = Math.max(180, 360 - Math.min(180, i * 2)) + rng.nextInt(61);
  return { platform: i, side, y: p.y + SKY_HOP_ENEMY_RULES.belowSupport, period, phase: rng.nextInt(period) };
}

/** Extends the course (and its parallel arrays) so it always lies ahead of the player. */
function ensureCourse(state: SkyHopV4State) {
  while (state.platforms.length < state.highest + SKY_HOP_V4.ahead + 1) {
    const i = state.platforms.length;
    state.platforms.push(makeHopPlatformV4(state.seed, i, state.platforms[i - 1] ?? null));
    state.brokenAt.push(-1);
    state.collected.push(false);
    const enemy = makeHopEnemyV4(state, i);
    if (enemy) {
      state.enemies.push(enemy);
      state.enemyArmedAt.push(-1);
      state.enemyDefeatedAt.push(-1);
    }
  }
}

export function createSkyHopV4(seed: string): SkyHopV4State {
  const base = createSkyHop(seed);
  const state: SkyHopV4State = {
    ...base,
    platforms: [],
    brokenAt: [],
    collected: [],
    enemies: [],
    enemyArmedAt: [],
    enemyDefeatedAt: [],
    enemyContacts: 0,
    stomps: 0,
    lastEnemyHitTick: -999,
    lastEnemyHitIndex: -1,
    lastStompTick: -999,
    lastStompX: 0,
    lastStompY: 0,
  };
  ensureCourse(state);
  return state;
}

function respawn(state: SkyHopV4State, grace: number) {
  const p = state.platforms[state.checkpoint];
  state.x = p.x + p.width / 2;
  state.y = p.y - SKY_HOP_RULES.halfHeight;
  state.vx = 0;
  state.vy = SKY_HOP_RULES.bounce;
  state.lastLandingIndex = state.checkpoint;
  state.lastLandingTick = state.tick;
  state.camera = Math.min(0, p.y - 430_000);
  state.respawnUntil = state.tick + grace;
  for (let i = state.checkpoint + 1; i < state.brokenAt.length; i++) state.brokenAt[i] = -1;
  for (let i = 0; i < state.enemies.length; i++) if (state.enemyDefeatedAt[i] < 0) state.enemyArmedAt[i] = -1;
}
function fall(state: SkyHopV4State) {
  state.lives--;
  state.lastDamageTick = state.tick;
  state.score = Math.max(0, state.score - SKY_HOP_RULES.fallPenalty);
  if (!state.lives) {
    state.status = "failed";
    state.failure = "FALLEN";
    return;
  }
  respawn(state, 90);
}
function enemyDamage(state: SkyHopV4State, index: number) {
  state.lives--;
  state.lastDamageTick = state.lastEnemyHitTick = state.tick;
  state.lastEnemyHitIndex = index;
  state.enemyContacts++;
  state.score = Math.max(0, state.score - SKY_HOP_RULES.fallPenalty);
  if (!state.lives) {
    state.status = "failed";
    state.failure = "ALIEN_CONTACT";
    return;
  }
  respawn(state, SKY_HOP_ENEMY_RULES.recoveryGrace);
}

export function stepSkyHopV4(s: SkyHopV4State) {
  ensureCourse(s);
  s.tick++;
  const input = Number(s.right) - Number(s.left);
  s.vx = input
    ? clamp(s.vx + input * 90, -SKY_HOP_RULES.maxSpeed, SKY_HOP_RULES.maxSpeed)
    : roundDiv(s.vx * 84, 100);
  s.x += s.vx;
  if (s.x < -15_000) s.x += 420_000;
  if (s.x > 405_000) s.x -= 420_000;
  const previousBottom = s.y + SKY_HOP_RULES.halfHeight;
  s.vy += SKY_HOP_RULES.gravity;
  s.y += s.vy;
  if (s.vy > 0) {
    const nextBottom = s.y + SKY_HOP_RULES.halfHeight;
    for (let i = 0; i < s.platforms.length; i++) {
      const p = s.platforms[i];
      if (s.brokenAt[i] >= 0 && s.tick >= s.brokenAt[i]) continue;
      if (previousBottom > p.y || nextBottom < p.y) continue;
      const x = hopPlatformX(p, s.tick);
      if (s.x + SKY_HOP_RULES.halfWidth <= x || s.x - SKY_HOP_RULES.halfWidth >= x + p.width) continue;
      s.y = p.y - SKY_HOP_RULES.halfHeight;
      s.vy = p.kind === "boost" ? SKY_HOP_RULES.boostBounce : SKY_HOP_RULES.bounce;
      s.landings++;
      s.lastLandingTick = s.tick;
      s.lastLandingIndex = i;
      if (p.kind === "crumble" && s.brokenAt[i] < 0) s.brokenAt[i] = s.tick + SKY_HOP_RULES.crumbleTicks;
      if (i > s.highest) {
        for (let k = s.highest + 1; k <= i; k++) s.score += 280 + Math.min(480, k * 8);
        s.highest = i;
        s.height = i;
        ensureCourse(s);
      }
      if (p.pickup && !s.collected[i]) {
        s.collected[i] = true;
        s.score += s.lives < SKY_HOP_RULES.maxLives ? 150 : 80;
        s.lives = Math.min(SKY_HOP_RULES.maxLives, s.lives + 1);
      }
      if (p.kind === "checkpoint" && i > s.checkpoint) s.checkpoint = i;
      break;
    }
  }
  s.camera = Math.min(s.camera, 0, s.y - 260_000);
  if (s.status === "running" && s.y - s.camera > 690_000) {
    const lives = s.lives;
    fall(s);
    if (s.lives < lives || s.status !== "running") return;
  }
  if (s.status !== "running" || s.tick < s.respawnUntil) return;
  for (let i = 0; i < s.enemies.length; i++) {
    if (s.enemyDefeatedAt[i] >= 0) continue;
    const enemy = s.enemies[i];
    if (!hopEnemyVisible(s, enemy)) continue;
    if (s.enemyArmedAt[i] < 0) s.enemyArmedAt[i] = s.tick + SKY_HOP_ENEMY_RULES.warningTicks;
    if (!hopEnemyActive(s, i)) continue;
    const x = hopEnemyX(s, enemy);
    if (Math.abs(s.x - x) >= SKY_HOP_RULES.halfWidth + SKY_HOP_ENEMY_RULES.halfWidth) continue;
    const top = enemy.y - SKY_HOP_ENEMY_RULES.halfHeight;
    if (s.vy > 0 && previousBottom <= top && s.y + SKY_HOP_RULES.halfHeight >= top) {
      s.y = top - SKY_HOP_RULES.halfHeight;
      s.vy = SKY_HOP_RULES.bounce;
      s.enemyDefeatedAt[i] = s.tick;
      s.stomps++;
      s.lastStompTick = s.tick;
      s.lastStompX = x;
      s.lastStompY = enemy.y;
      break;
    }
    if (Math.abs(s.y - enemy.y) < SKY_HOP_RULES.halfHeight + SKY_HOP_ENEMY_RULES.halfHeight) {
      enemyDamage(s, i);
      break;
    }
  }
}

export const SKY_HOP_CORE_V4: GameCore<SkyHopV4State> = {
  ...SKY_HOP_CORE_V2,
  gameVersion: "4.0.0",
  create: createSkyHopV4,
  step: stepSkyHopV4,
  content: {
    rules: SKY_HOP_RULES,
    course: SKY_HOP_V4,
    enemies: SKY_HOP_ENEMY_RULES,
    generator: "endless-seeded-per-index-platforms;difficulty-ramp-width-gap-spread-moving-crumble-sentries",
    completion: "none;time-limit-or-three-lives-ends-the-run",
    score: "new-height-only-280+min(480,index*8);pickup150-or80;loss-minus350",
  },
} as unknown as GameCore<SkyHopV4State>;
