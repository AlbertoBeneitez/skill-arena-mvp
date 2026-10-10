/** V2 uninterrupted 16-layer formation. V1 remains immutable and replayable. */
import { hashSeed } from "../deterministic/seeded";
import { clamp } from "../deterministic/integerMath";
import { PHALANX_ACTIONS } from "./starPhalanxProtocol.v1";
import type { GameCore, CoreState } from "./coreRuntime.v1";
export const PHALANX_RULES = {
  totalLayers: 16,
  lives: 3,
  maximumLives: 3,
  shieldTicks: 150,
  playerY: 552000,
  playerSpeed: 2500,
  aimCooldown: 6,
  shotCooldown: 24,
  playerShotSpeed: 4000,
  chargeTicks: 60,
  firstEnemyFireTick: 960,
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
  enemy: boolean;
  spent: boolean;
};
export type PhalanxState = CoreState & {
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
  return wave === 1 ? 3 + layer : Math.min(8, 3 + wave);
}
function spawnLayer(s: PhalanxState) {
  // Rebase defeated coordinates; a fresh arrival starts above the play field.
  // Projectile positions, formation velocity, remainder and direction are unchanged.
  for (const e of s.enemies) e.y += s.descent;
  s.descent = 0;
  const columns = phalanxColumns(s.wave, s.layer),
    spacing =
      s.wave === 1
        ? 72000
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
    nextVolleyTick: 960,
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
  s.score = Math.max(0, s.score - 250);
  if (s.lives <= 0) {
    s.status = "failed";
    s.failure = "HULL_EXHAUSTED";
  }
}
export function stepPhalanx(s: PhalanxState) {
  s.tick++;
  s.shipX += clamp(s.targetX - s.shipX, -2500, 2500);
  let living = s.enemies.filter((e) => e.hp > 0);
  if (!living.length) {
    s.clearedLayers++;
    s.score += 300 + s.wave * 70;
    s.layer++;
    if (s.layer >= s.layers) {
      // Internal generator bands retain geometry only, never pauses/resets.
      s.wave++;
      s.layer = 0;
      s.layers = phalanxLayerCount(s.wave);
      s.lives = Math.min(3, s.lives + 1);
      s.score += 400;
    }
    if (s.clearedLayers === 16) {
      s.status = "won";
      s.failure = null;
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
      enemy: false,
      spent: false,
    });
  }
  if (s.chargeId === null && s.tick >= s.nextVolleyTick && s.tick >= 960) {
    const shooter =
      living[
        hashSeed(`${s.seed}:phalanx1:shot:${s.wave}:${s.layer}:${s.volley}`) %
          living.length
      ];
    s.chargeId = shooter.id;
    s.chargeStarted = s.tick;
  }
  if (s.chargeId !== null && s.tick - s.chargeStarted >= 60) {
    const shooter = living.find((e) => e.id === s.chargeId);
    if (shooter)
      for (const lane of s.wave >= 4 || (s.wave >= 3 && shooter.maxHp > 1)
        ? [-22000, 22000]
        : [0]) {
        s.shots.push({
          id: s.shotIndex++,
          x: shooter.x + s.offset + lane,
          y: shooter.y + s.descent + 16000,
          vy: 1500 + s.wave * 200,
          enemy: true,
          spent: false,
        });
      }
    s.volley++;
    s.chargeId = null;
    s.nextVolleyTick = s.tick + Math.max(120, 240 - (s.wave - 1) * 30);
  }
  for (const shot of s.shots) {
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
            if (s.chargeId === e.id) s.score += 100;
            s.score += 180 + s.layer * 35 + s.wave * 20 + (e.maxHp - 1) * 80;
            s.lastKillTick = s.tick;
            s.lastKillX = e.x + s.offset;
            s.lastKillY = e.y + s.descent;
          }
          break;
        }
      }
    if (shot.y < 0 || shot.y > 620000) shot.spent = true;
  }
  s.shots = s.shots.filter((b) => !b.spent);
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
  gameVersion: "2.0.0",
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
      "continuous16-layer-count-columns-spacing-v-stagger-stair-append-v2",
    layers: [2, 3, 3, 4, 4],
    columns: [3, 5, 6, 7, 8],
    collision: "ordered-integer-hitboxes-v1",
    lateVolley: "paired-lanes-minus22-plus22px-from-wave4-or-armored-wave3",
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
    },
    completion:
      "sixteen-continuous-layers-or-manifest-target-time-limit-is-loss;no-pauses/no-shot-clearing/no-flight-reset",
  },
  create: createPhalanx,
  step: stepPhalanx,
  canApply: canApplyPhalanx,
  apply: applyPhalanx,
};
