/** Original orbital sentries extend the archived V2 course without replacing its physics. */
import { createRng } from "../deterministic/seeded";
import { roundDiv } from "../deterministic/integerMath";
import type { GameCore } from "./coreRuntime.v1";
import { hopPlatformX, SKY_HOP_RULES, type SkyHopState } from "./skyHopCore.v1";
import { SKY_HOP_CORE_V2 } from "./skyHopCore.v2";

export const SKY_HOP_ENEMY_RULES = {
  firstPlatform: 14,
  spacing: 3,
  warningTicks: 120,
  halfWidth: 11000,
  halfHeight: 13000,
  belowSupport: 24000,
  outsetMin: 26000,
  outsetMax: 34000,
  visibleTop: 40000,
  visibleBottom: 580000,
  recoveryGrace: 90,
} as const;

export type HopEnemy = {
  platform: number;
  side: -1 | 1;
  y: number;
  period: number;
  phase: number;
};

export type SkyHopV3State = SkyHopState & {
  enemies: HopEnemy[];
  /** -1 means unannounced; otherwise this is the first active tick. */
  enemyArmedAt: number[];
  /** Defeat is persistent across checkpoint recovery; no repeated farming. */
  enemyDefeatedAt: number[];
  enemyContacts: number;
  stomps: number;
  lastEnemyHitTick: number;
  lastEnemyHitIndex: number;
  lastStompTick: number;
  lastStompX: number;
  lastStompY: number;
};

export function makeHopEnemies(state: SkyHopState): HopEnemy[] {
  const rng = createRng(`${state.seed}:sky-hop-v3-enemies`);
  const enemies: HopEnemy[] = [];
  for (
    let i = SKY_HOP_ENEMY_RULES.firstPlatform;
    i < state.platforms.length - 1;
    i++
  ) {
    const p = state.platforms[i];
    if (
      (p.kind !== "normal" && p.kind !== "moving") ||
      i % 10 < 3 ||
      (enemies.length &&
        i - enemies[enemies.length - 1].platform <
          SKY_HOP_ENEMY_RULES.spacing) ||
      rng.nextInt(4) === 0
    )
      continue;
    const previous = state.platforms[i - 1];
    const displacement = p.x + p.width / 2 - previous.x - previous.width / 2;
    // Stay beyond the far edge of the approach; never choose a random incoming side.
    const side: -1 | 1 =
      displacement === 0
        ? rng.nextInt(2)
          ? 1
          : -1
        : displacement > 0
          ? 1
          : -1;
    // Omit a sentry whose entire patrol cannot fit inside the shared horizontal FOV.
    const edge = side < 0 ? p.x - p.drift : p.x + p.width + p.drift;
    if (
      side < 0
        ? edge - SKY_HOP_ENEMY_RULES.outsetMax < 20000
        : edge + SKY_HOP_ENEMY_RULES.outsetMax > 370000
    )
      continue;
    const period = 360 - Math.min(90, i * 2) + rng.nextInt(61);
    enemies.push({
      platform: i,
      side,
      y: p.y + SKY_HOP_ENEMY_RULES.belowSupport,
      period,
      phase: rng.nextInt(period),
    });
  }
  return enemies;
}

/** Enemy patrol and support drift share a coordinate frame, preserving the central corridor. */
export function hopEnemyX(
  state: SkyHopState,
  enemy: HopEnemy,
  tick = state.tick,
): number {
  const p = state.platforms[enemy.platform];
  const phase = (tick + enemy.phase) % enemy.period;
  const triangle =
    phase * 2 <= enemy.period ? phase * 2 : (enemy.period - phase) * 2;
  const outset =
    SKY_HOP_ENEMY_RULES.outsetMin +
    roundDiv(
      triangle *
        (SKY_HOP_ENEMY_RULES.outsetMax - SKY_HOP_ENEMY_RULES.outsetMin),
      enemy.period,
    );
  const x = hopPlatformX(p, tick);
  return enemy.side < 0 ? x - outset : x + p.width + outset;
}

/** Fixed simulation FOV; presentation may query this without deciding an outcome. */
export function hopEnemyVisible(state: SkyHopState, enemy: HopEnemy): boolean {
  const y = enemy.y - state.camera;
  return (
    y >= SKY_HOP_ENEMY_RULES.visibleTop &&
    y <= SKY_HOP_ENEMY_RULES.visibleBottom
  );
}
export function hopEnemyActive(state: SkyHopV3State, index: number): boolean {
  return (
    state.enemyDefeatedAt[index] < 0 &&
    state.tick >= state.respawnUntil &&
    state.enemyArmedAt[index] >= 0 &&
    state.tick >= state.enemyArmedAt[index] &&
    hopEnemyVisible(state, state.enemies[index])
  );
}

export function createSkyHopV3(seed: string): SkyHopV3State {
  const base = SKY_HOP_CORE_V2.create(seed);
  const enemies = makeHopEnemies(base);
  return {
    ...base,
    enemies,
    enemyArmedAt: enemies.map(() => -1),
    enemyDefeatedAt: enemies.map(() => -1),
    enemyContacts: 0,
    stomps: 0,
    lastEnemyHitTick: -999,
    lastEnemyHitIndex: -1,
    lastStompTick: -999,
    lastStompX: 0,
    lastStompY: 0,
  };
}

function rearmLivingEnemies(state: SkyHopV3State) {
  for (let i = 0; i < state.enemies.length; i++) {
    if (state.enemyDefeatedAt[i] < 0) state.enemyArmedAt[i] = -1;
  }
}

/** V1 fall is private: only its checkpoint assignments are repeated, never its integrator. */
function enemyDamage(state: SkyHopV3State, index: number) {
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
  const p = state.platforms[state.checkpoint];
  state.x = p.x + p.width / 2;
  state.y = p.y - SKY_HOP_RULES.halfHeight;
  state.vx = 0;
  state.vy = SKY_HOP_RULES.bounce;
  state.lastLandingIndex = state.checkpoint;
  state.lastLandingTick = state.tick;
  state.camera = Math.min(0, p.y - 430000);
  state.respawnUntil = state.tick + SKY_HOP_ENEMY_RULES.recoveryGrace;
  for (let i = state.checkpoint + 1; i < state.brokenAt.length; i++)
    state.brokenAt[i] = -1;
  rearmLivingEnemies(state);
}

export function stepSkyHopV3(state: SkyHopV3State) {
  const lives = state.lives;
  const previousBottom = state.y + SKY_HOP_RULES.halfHeight;
  // Historical auto-bounce, collision, pickups, camera and crumble recovery run literally once.
  SKY_HOP_CORE_V2.step(state);
  if (state.status !== "running") return;
  if (state.lives < lives) {
    rearmLivingEnemies(state);
    return;
  }
  if (state.tick < state.respawnUntil) return;
  for (let i = 0; i < state.enemies.length; i++) {
    if (state.enemyDefeatedAt[i] >= 0) continue;
    const enemy = state.enemies[i];
    if (!hopEnemyVisible(state, enemy)) continue;
    if (state.enemyArmedAt[i] < 0)
      state.enemyArmedAt[i] = state.tick + SKY_HOP_ENEMY_RULES.warningTicks;
    if (!hopEnemyActive(state, i)) continue;
    const x = hopEnemyX(state, enemy);
    if (
      Math.abs(state.x - x) >=
      SKY_HOP_RULES.halfWidth + SKY_HOP_ENEMY_RULES.halfWidth
    )
      continue;
    const top = enemy.y - SKY_HOP_ENEMY_RULES.halfHeight;
    if (
      state.vy > 0 &&
      previousBottom <= top &&
      state.y + SKY_HOP_RULES.halfHeight >= top
    ) {
      state.y = top - SKY_HOP_RULES.halfHeight;
      state.vy = SKY_HOP_RULES.bounce;
      state.enemyDefeatedAt[i] = state.tick;
      state.stomps++;
      state.lastStompTick = state.tick;
      state.lastStompX = x;
      state.lastStompY = enemy.y;
      break;
    }
    if (
      Math.abs(state.y - enemy.y) <
      SKY_HOP_RULES.halfHeight + SKY_HOP_ENEMY_RULES.halfHeight
    ) {
      enemyDamage(state, i);
      break;
    }
  }
}

export const SKY_HOP_CORE_V3: GameCore<SkyHopV3State> = {
  ...SKY_HOP_CORE_V2,
  gameVersion: "3.0.0",
  create: createSkyHopV3,
  step: stepSkyHopV3,
  content: {
    base: SKY_HOP_CORE_V2.content,
    enemies: SKY_HOP_ENEMY_RULES,
    generator: "original-75-support-course;seeded-edge-sentries-v3",
    collision:
      "visible-warned-sentry-aabb;descending-feet-crossing-stomp;one-contact-per-tick",
    recovery:
      "checkpoint-90-tick-grace;reannounce-living-sentries;preserve-height-pickups-and-defeats;restore-crumbles",
    progress: "original-platform-height;stomp-has-no-score-bonus",
  },
};
