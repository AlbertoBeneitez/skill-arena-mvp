/** Original continuous orbital demolition field; fixed-point, ordered contacts. */
import { createRng, seededShuffle } from "../deterministic/seeded";
import {
  clamp,
  roundDiv,
  integerSqrt,
  sinPhaseMilli,
} from "../deterministic/integerMath";
import { BIRDS_ACTIONS } from "./galacticBirdsProtocol.v1";
import type { CoreState, GameCore } from "./coreRuntime.v1";
export const BIRDS_RULES = {
  ground: 560000,
  worldWidth: 1600000,
  gravity: 16,
  radius: 12000,
  enemyRadius: 18000,
  ammunition: 30,
  maxFinalTick: 28800,
  maxFlightTicks: 720,
  substeps: 2,
  settlingTicks: 240,
  clearanceTicks: 90,
} as const;
export type BirdKind = "scout" | "dart" | "meteor";
export const BIRDS_PROJECTILES = Object.freeze({
  scout: Object.freeze({ radius: 12000, speedMilli: 1000, massMilli: 1000 }),
  dart: Object.freeze({ radius: 9000, speedMilli: 1200, massMilli: 750 }),
  meteor: Object.freeze({ radius: 18000, speedMilli: 850, massMilli: 2000 }),
});
export type BirdsBody = {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  material: "glass" | "ceramic" | "alloy";
  alive: boolean;
};
export type BirdsEnemy = {
  id: number;
  x: number;
  y: number;
  vy: number;
  alive: boolean;
  approachGap: number;
};
export type BirdsEvent = {
  tick: number;
  x: number;
  y: number;
  kind: "glass" | "ceramic" | "alloy" | "enemy";
};
export type BirdsProjectile = {
  kind: BirdKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  hitIds: number[];
};
export type BirdsState = CoreState & {
  queue: readonly BirdKind[];
  launcherX: number;
  aim: number;
  power: number;
  ammo: number;
  phase: "aim" | "flight" | "clearing" | "settling";
  bodies: BirdsBody[];
  enemies: BirdsEnemy[];
  bird: BirdsProjectile | null;
  events: BirdsEvent[];
  destroyed: number;
  kills: number;
  lastInputTick: number;
  finishAt: number;
  shots: number;
};
function event(s: BirdsState, x: number, y: number, kind: BirdsEvent["kind"]) {
  s.events.push({ tick: s.tick, x, y, kind });
  if (s.events.length > 40) s.events.shift();
}
function destroy(s: BirdsState, b: BirdsBody) {
  if (!b.alive) return;
  b.alive = false;
  s.destroyed++;
  event(s, b.x, b.y, b.material);
}
function kill(s: BirdsState, e: BirdsEnemy) {
  if (!e.alive) return;
  e.alive = false;
  s.kills++;
  s.height = s.kills;
  event(s, e.x, e.y, "enemy");
  if (s.kills === s.enemies.length) {
    s.phase = "clearing";
    s.finishAt = s.tick + BIRDS_RULES.clearanceTicks;
  }
}
function finish(s: BirdsState, won: boolean, failure: string | null) {
  s.score = s.kills * 500 + s.destroyed * 30 + (won ? s.ammo * 20 : 0);
  s.height = s.kills;
  s.status = won ? "won" : "failed";
  s.failure = failure;
}
export function birdsVelocity(
  aim: number,
  power: number,
  kind: BirdKind = "scout",
) {
  const phase = roundDiv((10 + aim) * 4096, 360),
    v = roundDiv(
      (1000 + power * 180) * BIRDS_PROJECTILES[kind].speedMilli,
      1000,
    );
  return {
    vx: roundDiv(v * sinPhaseMilli(phase + 1024), 1000),
    vy: -roundDiv(v * sinPhaseMilli(phase), 1000),
  };
}
function create(seed: string): BirdsState {
  const rng = createRng(`${seed}:birds-field-v2`),
    bodies: BirdsBody[] = [],
    enemies: BirdsEnemy[] = [];
  for (let g = 0; g < 6; g++) {
    const x = 300000 + g * 210000 + (rng.nextInt(16001) - 8000),
      h = 80000 + g * 12000 + rng.nextInt(3) * 6000,
      w = 108000 + g * 4000;
    const add = (
      px: number,
      py: number,
      bw: number,
      bh: number,
      material: BirdsBody["material"],
    ) => {
      const hp = material === "glass" ? 12 : material === "ceramic" ? 26 : 65;
      bodies.push({
        id: bodies.length,
        x: px,
        y: py,
        w: bw,
        h: bh,
        vx: 0,
        vy: 0,
        hp,
        maxHp: hp,
        material,
        alive: true,
      });
    };
    add(
      x - w / 2 + 10000,
      560000 - h / 2,
      20000,
      h,
      g < 2 ? "glass" : "ceramic",
    );
    add(
      x + w / 2 - 10000,
      560000 - h / 2,
      20000,
      h,
      g < 3 ? "ceramic" : "alloy",
    );
    add(x, 560000 - h - 10000, w, 20000, g < 3 ? "glass" : "ceramic");
    if (g >= 2)
      add(x + w / 2 + 22000, 540000, 20000, 40000, g % 2 ? "alloy" : "glass");
    enemies.push({
      id: enemies.length,
      x: x + rng.nextInt(10001) - 5000,
      y: 542000,
      vy: 0,
      alive: true,
      approachGap: 170000 + rng.nextInt(g === 0 ? 20001 : 80001),
    });
    enemies.push({
      id: enemies.length,
      x: x + rng.nextInt(10001) - 5000,
      y: 560000 - h - 38000,
      vy: 0,
      alive: true,
      approachGap: 180000 + rng.nextInt(70001),
    });
  }
  return {
    tick: 0,
    status: "running",
    score: 0,
    failure: null,
    height: 0,
    queue: Object.freeze([
      "scout",
      "dart",
      "meteor",
      ...Array.from({ length: 9 }, (_, i) =>
        seededShuffle<BirdKind>(
          ["scout", "dart", "meteor"],
          `${seed}:birds2:bag:${i}`,
        ),
      ).flat(),
    ] as BirdKind[]),
    launcherX: enemies[0].x - enemies[0].approachGap,
    aim: 30,
    power: 6,
    ammo: 30,
    phase: "aim",
    bodies,
    enemies,
    bird: null,
    events: [],
    destroyed: 0,
    kills: 0,
    lastInputTick: -1,
    finishAt: -1,
    shots: 0,
  };
}
function circleContact(x: number, y: number, r: number, b: BirdsBody) {
  const dx = x - clamp(x, b.x - b.w / 2, b.x + b.w / 2),
    dy = y - clamp(y, b.y - b.h / 2, b.y + b.h / 2),
    sq = dx * dx + dy * dy;
  if (sq >= r * r) return null;
  if (sq === 0) {
    const px = b.w / 2 + r - Math.abs(x - b.x),
      py = b.h / 2 + r - Math.abs(y - b.y);
    return px < py
      ? { nx: x < b.x ? -1000 : 1000, ny: 0, push: px }
      : { nx: 0, ny: y < b.y ? -1000 : 1000, push: py };
  }
  const len = integerSqrt(sq);
  return {
    nx: roundDiv(dx * 1000, len),
    ny: roundDiv(dy * 1000, len),
    push: r - len,
  };
}
function moveBodies(s: BirdsState) {
  for (const b of s.bodies) {
    if (!b.alive) continue;
    b.vy += 16;
    b.x += b.vx;
    b.y += b.vy;
    b.vx = Math.sign(b.vx) * Math.floor((Math.abs(b.vx) * 997) / 1000);
    if (b.y + b.h / 2 >= 560000) {
      const impact = b.vy;
      b.y = 560000 - b.h / 2;
      b.vy = 0;
      b.vx = roundDiv(b.vx * 94, 100);
      if (impact > 1200) {
        b.hp -= Math.floor((impact * impact) / 200000);
        if (b.hp <= 0) destroy(s, b);
      }
    }
    b.x = clamp(b.x, b.w / 2, 1600000 - b.w / 2);
  }
  // Bounded ordered AABB contacts: original arcade translation, not a full OBB solver.
  for (let pass = 0; pass < 2; pass++)
    for (let i = 0; i < s.bodies.length; i++) {
      const a = s.bodies[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < s.bodies.length; j++) {
        const b = s.bodies[j];
        if (!b.alive) continue;
        const px = (a.w + b.w) / 2 - Math.abs(a.x - b.x),
          py = (a.h + b.h) / 2 - Math.abs(a.y - b.y);
        if (px <= 0 || py <= 0) continue;
        if (py <= px) {
          const sign = a.y < b.y ? -1 : 1,
            ag = a.y + a.h / 2 >= 560000,
            bg = b.y + b.h / 2 >= 560000,
            split = roundDiv(py, 2);
          if (sign < 0 && bg) a.y -= py;
          else if (sign > 0 && ag) b.y -= py;
          else {
            a.y += sign * split;
            b.y -= sign * (py - split);
          }
          const v = roundDiv(a.vy + b.vy, 2);
          a.vy = Math.abs(v) < 32 ? 0 : v;
          b.vy = Math.abs(v) < 32 ? 0 : v;
        } else {
          const sign = a.x < b.x ? -1 : 1,
            split = roundDiv(px, 2);
          a.x += sign * split;
          b.x -= sign * (px - split);
          const v = roundDiv(a.vx + b.vx, 2);
          a.vx = v;
          b.vx = v;
        }
      }
    }
}
function moveEnemies(s: BirdsState) {
  for (const e of s.enemies) {
    if (!e.alive) continue;
    const before = e.y;
    e.vy += 16;
    e.y += e.vy;
    for (const b of s.bodies) {
      if (!b.alive) continue;
      const contact = circleContact(e.x, e.y, 18000, b);
      if (!contact) continue;
      if (Math.abs(b.vx) + Math.abs(b.vy) > 750) {
        kill(s, e);
        break;
      }
      const top = b.y - b.h / 2;
      if (before + 18000 <= top + 32 && e.y + 18000 >= top) {
        if (e.vy > 900) {
          kill(s, e);
          break;
        }
        e.y = top - 18000;
        e.vy = 0;
      }
    }
    if (e.alive && e.y + 18000 >= 560000) {
      if (e.vy > 900) kill(s, e);
      else {
        e.y = 542000;
        e.vy = 0;
      }
    }
  }
}
function endShot(s: BirdsState) {
  s.bird = null;
  if (s.phase === "clearing") return;
  if (s.ammo === 0) {
    s.phase = "settling";
    s.finishAt = s.tick + BIRDS_RULES.settlingTicks;
    return;
  }
  s.phase = "aim";
  const next = s.enemies.find((e) => e.alive);
  if (next) s.launcherX = clamp(next.x - next.approachGap, 70000, 1380000);
}
function moveBird(s: BirdsState) {
  const bird = s.bird;
  if (!bird) return;
  const traits = BIRDS_PROJECTILES[bird.kind];
  bird.age++;
  bird.vy += 16;

  for (let sub = 0; sub < 2; sub++) {
    bird.x += roundDiv(bird.vx, 2);
    bird.y += roundDiv(bird.vy, 2);
    for (const e of s.enemies) {
      if (
        e.alive &&
        (e.x - bird.x) ** 2 + (e.y - bird.y) ** 2 <
          (traits.radius + BIRDS_RULES.enemyRadius) ** 2 &&
        Math.abs(bird.vx) + Math.abs(bird.vy) > 350
      ) {
        kill(s, e);
        bird.vx = roundDiv(bird.vx * 8, 10);
        bird.vy = roundDiv(bird.vy * 8, 10);
      }
    }
    for (const b of s.bodies) {
      if (!b.alive) continue;
      const contact = circleContact(bird.x, bird.y, traits.radius, b);
      if (!contact) continue;
      const vn = roundDiv(bird.vx * contact.nx + bird.vy * contact.ny, 1000);
      if (vn >= 0) continue;
      if (!bird.hitIds.includes(b.id)) {
        bird.hitIds.push(b.id);
        b.hp -= Math.floor(
          ((bird.vx * bird.vx + bird.vy * bird.vy) * traits.massMilli) /
            160000000,
        );
        event(s, bird.x, bird.y, b.material);
        if (b.hp <= 0) {
          destroy(s, b);
          bird.vx = roundDiv(bird.vx * 8, 10);
          bird.vy = roundDiv(bird.vy * 8, 10);
          continue;
        }
      }
      bird.x += roundDiv(contact.nx * (contact.push + 1), 1000);
      bird.y += roundDiv(contact.ny * (contact.push + 1), 1000);
      b.vx += roundDiv(vn * contact.nx * traits.massMilli, 4000000);
      b.vy += roundDiv(vn * contact.ny * traits.massMilli, 4000000);
      bird.vx -= roundDiv(vn * contact.nx * 14, 10000);
      bird.vy -= roundDiv(vn * contact.ny * 14, 10000);
    }
    if (bird.y + traits.radius >= 560000) {
      bird.y = 560000 - traits.radius;
      bird.vy =
        Math.abs(bird.vy) < 100 ? 0 : -roundDiv(Math.abs(bird.vy) * 3, 10);
      bird.vx = roundDiv(bird.vx * 94, 100);
    }
  }
  if (
    bird.age >= 720 ||
    bird.x < 0 ||
    bird.x > 1600000 ||
    bird.y > 620000 ||
    (bird.age > 90 && Math.abs(bird.vx) + Math.abs(bird.vy) < 160)
  )
    endShot(s);
}
export const BIRDS_CORE: GameCore<BirdsState> = {
  gameId: "galactic-birds",
  gameVersion: "2.0.0",
  width: 390,
  height: 620,
  tickRate: 120,
  maxFinalTick: 28800,
  maxInputs: 1800,
  inputVersion: 1,
  actions: BIRDS_ACTIONS,
  content: {
    rules: BIRDS_RULES,
    projectiles: BIRDS_PROJECTILES,
    queue: "SCOUT_DART_METEOR_THEN_SEEDED_THREE_TYPE_BAGS",
    scope: "ORIGINAL_ARCADE",
    field: "SIX_PERSISTENT_STRUCTURES_TWELVE_DRONES",
    physics: "INTEGER_TRANSLATIONAL_AABB_TWO_SUBSTEPS",
    score: "500_PER_DRONE_30_PER_BODY_20_PER_REMAINING_SHOT_ON_CLEAR",
    target: "TERMINAL_SCORE_ONLY",
  },
  create,
  canApply(s, a) {
    return (
      s.status === "running" &&
      s.phase === "aim" &&
      BIRDS_ACTIONS.includes(a) &&
      (a !== "SHOOT" || s.ammo > 0)
    );
  },
  apply(s, a) {
    s.lastInputTick = s.tick;
    if (a.startsWith("AIM_")) s.aim = Number(a.slice(4));
    else if (/^POWER_\d{2}$/.test(a)) s.power = Number(a.slice(6));
    else if (a === "ANGLE_UP") s.aim = Math.min(60, s.aim + 1);
    else if (a === "ANGLE_DOWN") s.aim = Math.max(0, s.aim - 1);
    else if (a === "POWER_UP") s.power = Math.min(12, s.power + 1);
    else if (a === "POWER_DOWN") s.power = Math.max(0, s.power - 1);
    else {
      const kind = s.queue[s.shots],
        velocity = birdsVelocity(s.aim, s.power, kind);
      s.ammo--;
      s.shots++;
      s.bird = {
        kind,
        x: s.launcherX,
        y: 520000,
        ...velocity,
        age: 0,
        hitIds: [],
      };
      s.phase = "flight";
    }
  },
  step(s) {
    s.tick++;
    moveBodies(s);
    moveEnemies(s);
    moveBird(s);
    if (s.phase === "clearing" && s.tick >= s.finishAt) finish(s, true, null);
    if (s.phase === "settling" && s.tick >= s.finishAt)
      finish(s, false, "OUT_OF_SHOTS");
    if (s.tick === 28800 && s.status === "running") {
      const cleared = s.kills === s.enemies.length;
      finish(s, cleared, cleared ? null : "TIME_LIMIT");
    }
  },
};
