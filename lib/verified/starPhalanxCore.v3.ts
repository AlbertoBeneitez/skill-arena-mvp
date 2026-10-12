/** V3 directed volleys, collectible rewards and continuous24-layer formation. V1/V2 frozen. */
import { hashSeed } from "../deterministic/seeded";
import { clamp, roundDiv } from "../deterministic/integerMath";
import { PHALANX_ACTIONS } from "./starPhalanxProtocol.v1";
import type { GameCore, CoreState } from "./coreRuntime.v1";
export const PHALANX_RULES = {
  totalLayers: 24,
  lives: 3,
  maximumLives: 3,
  shieldTicks: 150,
  playerY: 552000,
  playerSpeed: 2500,
  aimCooldown: 6,
  shotCooldown: 24,
  playerShotSpeed: 4000,
  chargeTicks: 84,
  firstEnemyFireTick: 300,
  maxFinalTick: 21600,
  maxInputs: 4500,
} as const;
export type PhalanxEnemy = {
  id: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
};
export type PhalanxShot = {
  id: number;
  x: number;
  y: number;
  vy: number;
  vx: number;
  enemy: boolean;
  spent: boolean;
};
export type PhalanxReward = {
  id: number;
  x: number;
  y: number;
  kind: "points" | "shield";
};
export type PhalanxState = CoreState & {
  total: number;
  rewards: PhalanxReward[];
  rewardIndex: number;
  rewardPoints: number;
  collected: number;
  lastRewardTick: number;
  lastRewardValue: number;
  chargeAimX: number;
  seed: string;
  shipX: number;
  targetX: number;
  firing: boolean;
  lastAimTick: number;
  lastPlayerShot: number;
  shotIndex: number;
  shots: PhalanxShot[];
  enemies: PhalanxEnemy[];
  wave: number;
  layer: number;
  layers: number;
  offset: number;
  direction: number;
  moveRemainder: number;
  descent: number;
  nextLayerTick: number | null;
  volley: number;
  nextVolleyTick: number;
  chargeId: number | null;
  chargeStarted: number;
  lives: number;
  shieldUntil: number;
  lastDamageTick: number;
  lastKillTick: number;
  lastKillX: number;
  lastKillY: number;
  kills: number;
  clearedLayers: number;
  height: number;
};
export function phalanxLayerCount(wave: number) {
  return wave === 1 ? 2 : wave < 4 ? 3 : 4;
}
export function phalanxColumns(wave: number, layer: number) {
  return wave === 1 ? 5 + layer : Math.min(8, 3 + wave);
}
function spawnLayer(s: PhalanxState) {
  // Rebase defeated coordinates; a fresh arrival starts above the play field.
  // Projectile positions, formation velocity, remainder and direction are unchanged.
  for (const e of s.enemies) e.y += s.descent;
  s.descent = 0;
  const columns = phalanxColumns(s.wave, s.layer),
    spacing =
      s.wave === 1
        ? 52000 + (hashSeed(`${s.seed}:phalanx3:spacing:${s.layer}`) % 11001)
        : 39000 +
          (hashSeed(`${s.seed}:phalanx1:spacing:${s.wave}:${s.layer}`) % 5) *
            1000;
  s.enemies.push(
    ...Array.from({ length: columns }, (_, i) => {
      const hp = s.wave >= 3 && (i + s.layer) % 3 === 0 ? 2 : 1;
      return {
        id: s.wave * 100 + s.layer * 10 + i,
        x: 195000 + Math.floor((i - (columns - 1) / 2) * spacing) - s.offset,
        y:
          112000 -
          s.descent +
          s.layer * 14000 +
          (s.wave === 1
            ? 0
            : s.layer % 3 === 0
              ? Math.floor(Math.abs(i - (columns - 1) / 2)) * 9000
              : s.layer % 3 === 1
                ? (i % 2) * 14000
                : i * 4000),
        hp,
        maxHp: hp,
      };
    }),
  );
  s.nextLayerTick = null;
  // Preserve flight, formation velocity and the volley clock across arrivals.
  // A killed charged enemy cannot emit another projectile.
  if (!s.enemies.some((e) => e.id === s.chargeId && e.hp > 0))
    s.chargeId = null;
}
export function createPhalanx(seed: string): PhalanxState {
  const s: PhalanxState = {
    seed,
    tick: 0,
    status: "running",
    score: 0,
    total: 0,
    rewards: [],
    rewardIndex: 0,
    rewardPoints: 0,
    collected: 0,
    lastRewardTick: -999,
    lastRewardValue: 0,
    chargeAimX: 195000,
    failure: null,
    shipX: 195000,
    targetX: 195000,
    firing: false,
    lastAimTick: -6,
    lastPlayerShot: -24,
    shotIndex: 0,
    shots: [],
    enemies: [],
    wave: 1,
    layer: 0,
    layers: 2,
    offset: 0,
    direction: hashSeed(`${seed}:phalanx2:initial-direction`) % 2 ? 1 : -1,
    moveRemainder: 0,
    descent: 0,
    nextLayerTick: null,
    volley: 0,
    nextVolleyTick: 300 + (hashSeed(`${seed}:phalanx3:first-fire`) % 81),
    chargeId: null,
    chargeStarted: 0,
    lives: 3,
    shieldUntil: 0,
    lastDamageTick: -999,
    lastKillTick: -999,
    lastKillX: 0,
    lastKillY: 0,
    kills: 0,
    clearedLayers: 0,
    height: 0,
  };
  spawnLayer(s);
  return s;
}
function damage(s: PhalanxState) {
  if (s.tick < s.shieldUntil) return;
  s.lives--;
  s.shieldUntil = s.tick + 150;
  s.lastDamageTick = s.tick;
  s.total = Math.max(0, s.total - 250);
  if (s.lives <= 0) {
    s.status = "failed";
    s.failure = "HULL_EXHAUSTED";
    s.score = s.total;
  }
}
export function phalanxVolleySpread(volley: number): readonly number[] {
  return volley % 3 === 0
    ? [0]
    : volley % 3 === 1
      ? [-450, 450]
      : [-450, 0, 450];
}
export function phalanxVolley(s: PhalanxState, shooter: PhalanxEnemy) {
  const x = shooter.x + s.offset,
    y = shooter.y + s.descent + 16000,
    vy = 1900 + Math.min(8, s.wave) * 140;
  const aim = clamp(
    roundDiv((s.chargeAimX - x) * vy, Math.max(1, 552000 - y)),
    -1300,
    1300,
  );
  return phalanxVolleySpread(s.volley).map((spread) => ({
    x,
    y,
    vy,
    vx: aim + spread,
  }));
}
export function stepPhalanx(s: PhalanxState) {
  s.tick++;
  s.shipX += clamp(s.targetX - s.shipX, -2500, 2500);
  let living = s.enemies.filter((e) => e.hp > 0);
  if (!living.length) {
    s.clearedLayers++;
    s.total += 300 + s.wave * 70;
    s.layer++;
    if (s.layer >= s.layers) {
      // Internal generator bands retain geometry only, never pauses/resets.
      s.wave++;
      s.layer = 0;
      s.layers = phalanxLayerCount(s.wave);
      s.total += 400;
    }
    if (s.clearedLayers === PHALANX_RULES.totalLayers) {
      s.status = "won";
      s.failure = null;
      s.score = s.total;
      return;
    }
    spawnLayer(s);
    living = s.enemies.filter((e) => e.hp > 0);
  }
  s.moveRemainder += 16000 + s.wave * 6500;
  const dx = Math.floor(s.moveRemainder / 120);
  s.moveRemainder %= 120;
  s.offset += s.direction * dx;
  const left = Math.min(...living.map((e) => e.x + s.offset)),
    right = Math.max(...living.map((e) => e.x + s.offset));
  if (left < 30000 || right > 360000) {
    s.direction *= -1;
    s.offset += s.direction * dx * 2;
    s.descent += 5000 + s.wave * 1000;
  }
  if (living.some((e) => e.y + s.descent >= 490000)) {
    damage(s);
    if (s.status !== "running") return;
    s.descent = 0;
  }
  if (s.firing && s.tick - s.lastPlayerShot >= 24) {
    s.lastPlayerShot = s.tick;
    s.shots.push({
      id: s.shotIndex++,
      x: s.shipX,
      y: 532000,
      vy: -4000,
      vx: 0,
      enemy: false,
      spent: false,
    });
  }
  if (
    s.chargeId === null &&
    s.tick >= s.nextVolleyTick &&
    s.tick >= PHALANX_RULES.firstEnemyFireTick
  ) {
    const shooter =
      living[
        hashSeed(`${s.seed}:phalanx1:shot:${s.wave}:${s.layer}:${s.volley}`) %
          living.length
      ];
    s.chargeId = shooter.id;
    s.chargeStarted = s.tick;
    s.chargeAimX = s.shipX;
  }
  if (
    s.chargeId !== null &&
    s.tick - s.chargeStarted >= PHALANX_RULES.chargeTicks
  ) {
    const shooter = living.find((e) => e.id === s.chargeId);
    if (shooter) {
      for (const trajectory of phalanxVolley(s, shooter))
        s.shots.push({
          id: s.shotIndex++,
          ...trajectory,
          enemy: true,
          spent: false,
        });
    }
    s.volley++;
    s.chargeId = null;
    s.nextVolleyTick = s.tick + Math.max(120, 240 - (s.wave - 1) * 30);
  }
  for (const shot of s.shots) {
    shot.x += shot.vx;
    shot.y += shot.vy;
    if (shot.enemy) {
      if (
        Math.abs(shot.x - s.shipX) < 18000 &&
        Math.abs(shot.y - 552000) < 16000
      ) {
        shot.spent = true;
        damage(s);
        if (s.status !== "running") return;
      }
    } else
      for (const e of living) {
        if (
          e.hp > 0 &&
          Math.abs(shot.x - e.x - s.offset) <= 17000 &&
          Math.abs(shot.y - e.y - s.descent) <= 15000
        ) {
          e.hp--;
          shot.spent = true;
          if (e.hp === 0) {
            s.kills++;
            s.height = s.kills;
            if (s.chargeId === e.id) s.total += 100;
            s.total += 180 + s.layer * 35 + s.wave * 20 + (e.maxHp - 1) * 80;
            if (s.kills % 4 === 0)
              s.rewards.push({
                id: s.rewardIndex++,
                x: e.x + s.offset,
                y: e.y + s.descent,
                kind: s.kills % 12 === 0 ? "shield" : "points",
              });
            s.lastKillTick = s.tick;
            s.lastKillX = e.x + s.offset;
            s.lastKillY = e.y + s.descent;
          }
          break;
        }
      }
    if (shot.x < -20000 || shot.x > 410000 || shot.y < 0 || shot.y > 620000)
      shot.spent = true;
  }
  s.shots = s.shots.filter((b) => !b.spent);
  const remaining: PhalanxReward[] = [];
  for (const reward of s.rewards) {
    reward.y += 1100;
    if (
      Math.abs(reward.x - s.shipX) <= 22000 &&
      Math.abs(reward.y - 552000) <= 22000
    ) {
      const value = reward.kind === "points" ? 500 : 300;
      s.total += value;
      s.rewardPoints += value;
      s.collected++;
      s.lastRewardTick = s.tick;
      s.lastRewardValue = value;
      if (reward.kind === "shield")
        s.lives = Math.min(PHALANX_RULES.maximumLives, s.lives + 1);
    } else if (reward.y <= 620000) remaining.push(reward);
  }
  s.rewards = remaining;
  if (s.tick >= PHALANX_RULES.maxFinalTick && s.status === "running") {
    s.status = "failed";
    s.failure = "TIME_LIMIT";
    s.score = s.total;
  }
}
export function canApplyPhalanx(s: PhalanxState, a: string) {
  if (s.status !== "running") return false;
  if (a === "FIRE_DOWN") return !s.firing;
  if (a === "FIRE_UP") return s.firing;
  if (!/^AIM_\d{3}$/.test(a)) return false;
  const n = Number(a.slice(4));
  return (
    n >= 0 &&
    n < 36 &&
    s.tick - s.lastAimTick >= 6 &&
    s.targetX !== 20000 + n * 10000
  );
}
export function applyPhalanx(s: PhalanxState, a: string) {
  if (a === "FIRE_DOWN" || a === "FIRE_UP") s.firing = a === "FIRE_DOWN";
  else {
    s.targetX = 20000 + Number(a.slice(4)) * 10000;
    s.lastAimTick = s.tick;
  }
}
export const PHALANX_CORE: GameCore<PhalanxState> = {
  gameId: "star-phalanx",
  gameVersion: "3.0.0",
  width: 390,
  height: 620,
  tickRate: 120,
  maxFinalTick: 21600,
  maxInputs: 4500,
  inputVersion: 1,
  actions: PHALANX_ACTIONS,
  content: {
    rules: PHALANX_RULES,
    generator:
      "continuous24-layer-count-columns-spacing-v-stagger-stair-append-v3",
    layers: [2, 3, 3, 4, 4, 4, 4],
    columns: [5, 5, 6, 7, 8],
    collision: "ordered-integer-hitboxes-v1",
    lateVolley: "LOCKED_ANNOUNCED_TARGET_SINGLE_DOUBLE_TRIPLE_FANS",
    input: "aim-10px-20Hz-and-held-fire",
    score: {
      kill: 180,
      layerStep: 35,
      waveStep: 20,
      armor: 80,
      clearLayerBase: 300,
      clearLayerWave: 70,
      clearWave: 400,
      hitPenalty: 250,
      interruptCharged: 100,
      pointsPickup: 500,
      shieldPickup: 300,
      dropEveryKills: 4,
      shieldEveryKills: 12,
      automaticBandHeal: false,
    },
    completion:
      "24_CONTINUOUS_LAYERS_OR_HULL_OR_TIME;SCORE_PUBLISHED_AT_TERMINAL;NO_TARGET_FINISH",
  },
  create: createPhalanx,
  step: stepPhalanx,
  canApply: canApplyPhalanx,
  apply: applyPhalanx,
};
