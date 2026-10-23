/**
 * V7: denser assemblies (three or four pigs, 12–20 pieces), explosive TNT
 * crates that chain-react and kill nearby pigs, and a per-level wind that bends
 * every bird. Keeps V6's bird choice from a limited stock and support
 * stability. V1–V6 stay untouched for historical replays.
 */
import { createRng } from "../deterministic/seeded";
import { clamp, roundDiv, integerSqrt } from "../deterministic/integerMath";
import { BIRDS_ACTIONS_V2 } from "./galacticBirdsProtocol.v2";
import {
  BIRDS_RULES,
  BIRDS_PROJECTILES,
  birdsVelocity,
  type BirdKind,
  type BirdsBody as BirdsBodyV4,
  type BirdsEnemy,
  type BirdsEvent as BirdsEventV4,
  type BirdsState as BirdsStateV4,
} from "./galacticBirdsCore.v4";
import type { GameCore } from "./coreRuntime.v1";

export type BirdsBody = Omit<BirdsBodyV4, "material"> & {
  material: BirdsBodyV4["material"] | "tnt";
};
export type BirdsEvent = Omit<BirdsEventV4, "kind"> & {
  kind: BirdsEventV4["kind"] | "tnt";
};
type BirdsState = Omit<BirdsStateV4, "bodies" | "events"> & {
  bodies: BirdsBody[];
  events: BirdsEvent[];
};
/** Horizontal acceleration added to a bird every tick, per level (milli-px). */
export const BIRDS_WIND_V7: readonly number[] = Object.freeze([0, 0, -2, 2, -3, 3]);
export const BIRDS_PIGS_V7: readonly number[] = Object.freeze([3, 3, 3, 3, 3, 4]);
export const BIRDS_TNT_V7 = Object.freeze({ radius: 40000, pigRadius: 28000, damage: 200, push: 400, hp: 14 });
export const BIRDS_STOCK_V7: Readonly<Record<BirdKind, number>> = Object.freeze({
  scout: 10,
  dart: 9,
  meteor: 5,
});
export const BIRDS_KINDS: readonly BirdKind[] = ["scout", "dart", "meteor"];
export const BIRDS_SUPPORT_V7 = Object.freeze({
  contactTolerance: 3000,
  minimumOverlap: 500,
  restingSpeed: 200,
  slideAcceleration: 24,
  slideLimit: 600,
});
export type BirdsV7State = BirdsState & {
  seed: string;
  level: number;
  completedKills: number;
  completedDestroyed: number;
  levelStartTick: number;
  selected: BirdKind;
  stock: Record<BirdKind, number>;
  wind: number;
};
const K = 1000,
  GROUND = BIRDS_RULES.ground;
// Sturdier than V1–V5 (12/26/65) so assemblies need several well-chosen hits.
const HP = { glass: 24, ceramic: 100, alloy: 280, tnt: BIRDS_TNT_V7.hp } as const;
const PIG_CRUSH_SPEED = 1100;

/** Every assembly is built from separate pieces; sizes are in screen px. */
export function birdsFieldV7(seed: string, level: number) {
  const rng = createRng(`${seed}:birds-v7:level:${level}`),
    shift = (rng.nextInt(7) - 3) * 2,
    bodies: BirdsBody[] = [],
    enemies: BirdsEnemy[] = [];
  const vary = (m: "glass" | "ceramic") =>
    rng.nextInt(2) ? m : m === "glass" ? "ceramic" : "glass";
  // Heights are stretched 27/20 so the assemblies fill the fixed screen.
  const tall = (px: number) => roundDiv(px * 27 * K, 20);
  const add = (cx: number, bottom: number, w: number, h: number, material: BirdsBody["material"]) => {
    const base = GROUND / K,
      height = tall(h),
      floor = GROUND - tall(base - bottom);
    bodies.push({
      id: bodies.length,
      x: (cx + shift) * K,
      y: floor - roundDiv(height, 2),
      w: w * K,
      h: height,
      vx: 0,
      vy: 0,
      hp: HP[material],
      maxHp: HP[material],
      material,
      alive: true,
    });
  };
  const pig = (cx: number, cy: number) => {
    const top = (cy + 18) * K;
    enemies.push({
      id: enemies.length,
      x: (cx + shift) * K,
      y: GROUND - tall((GROUND - top) / K) - 18 * K,
      vy: 0,
      alive: true,
      approachGap: 0,
    });
  };
  const G = GROUND / K;
  switch (level) {
    case 0: {
      // Arch with a sheltered pig below and a pig sealed between crates above.
      add(240, G, 16, 56, vary("glass"));
      add(330, G, 16, 56, "ceramic");
      add(285, G - 56, 112, 12, "ceramic");
      add(252, G - 68, 26, 44, vary("glass"));
      add(318, G - 68, 26, 44, vary("ceramic"));
      add(285, G - 112, 100, 8, "glass");
      add(285, G - 120, 30, 30, "ceramic");
      // A TNT stack beside the arch and a crate with a crowned pig on top.
      add(352, G, 24, 24, "tnt");
      add(352, G - 24, 28, 8, "ceramic");
      add(352, G - 32, 24, 24, vary("glass"));
      add(214, G, 28, 28, "ceramic");
      add(214, G - 28, 30, 8, "glass");
      add(214, G - 36, 22, 22, "tnt");
      pig(285, G - 18);
      pig(285, G - 86);
      pig(285, G - 150 - 18);
      break;
    }
    case 1: {
      // Cargo pyramid plus a roofed hut that hides the second pig.
      for (const x of [210, 246, 282]) add(x, G, 36, 34, "glass");
      for (const x of [228, 264]) add(x, G - 34, 36, 34, vary("ceramic"));
      add(246, G - 68, 36, 34, "alloy");
      add(318, G, 14, 56, "alloy");
      add(372, G, 14, 56, vary("glass"));
      add(345, G - 56, 70, 10, "ceramic");
      add(358, G - 66, 24, 26, "tnt");
      add(358, G - 92, 36, 6, "ceramic");
      add(358, G - 98, 20, 20, "glass");
      pig(246, G - 102 - 18);
      pig(345, G - 18);
      pig(326, G - 66 - 18);
      break;
    }
    case 2: {
      // Long bridge: a pig in the cavern, another on a loaded deck.
      add(215, G, 26, 100, "ceramic");
      add(335, G, 26, 100, vary("ceramic"));
      add(275, G - 100, 146, 14, "ceramic");
      add(232, G - 114, 28, 30, vary("glass"));
      add(232, G - 144, 28, 28, "ceramic");
      add(312, G - 114, 30, 34, "alloy");
      add(312, G - 148, 30, 10, "glass");
      add(242, G, 24, 24, "tnt");
      add(364, G, 28, 50, "ceramic");
      add(364, G - 50, 34, 8, "glass");
      add(312, G - 158, 20, 16, "ceramic");
      add(306, G, 24, 24, "ceramic");
      pig(275, G - 18);
      pig(272, G - 114 - 18);
      pig(232, G - 172 - 18);
      break;
    }
    case 3: {
      // Two-storey house with rooms, a chimney and a rooftop pig.
      for (const x of [215, 285, 355]) add(x, G, 14, 60, x === 285 ? "alloy" : vary("glass"));
      add(285, G - 60, 160, 12, "ceramic");
      add(235, G - 72, 14, 56, vary("glass"));
      add(335, G - 72, 14, 56, vary("ceramic"));
      add(285, G - 128, 150, 12, "ceramic");
      add(330, G - 140, 24, 30, "alloy");
      add(240, G - 140, 22, 22, "glass");
      add(250, G, 24, 24, "tnt");
      add(240, G - 162, 34, 6, "ceramic");
      add(250, G - 24, 30, 8, "glass");
      add(330, G - 170, 24, 10, "ceramic");
      pig(320, G - 18);
      pig(283, G - 140 - 18);
      pig(285, G - 72 - 18);
      break;
    }
    case 4: {
      // Tower with a cantilever beam, and a walled-in pig on the ground.
      const kinds: BirdsBody["material"][] = ["alloy", "ceramic", vary("glass"), "ceramic", vary("glass")];
      kinds.forEach((m, i) => add(240, G - i * 36, 36, 36, m));
      add(255, G - 180, 100, 12, "ceramic");
      add(228, G - 192, 24, 26, "glass");
      add(292, G, 14, 50, "alloy");
      add(352, G, 14, 50, vary("glass"));
      add(322, G - 50, 84, 10, "ceramic");
      add(344, G - 60, 26, 26, "tnt");
      add(228, G - 218, 28, 8, "ceramic");
      add(206, G, 28, 40, "alloy");
      pig(285, G - 192 - 18);
      pig(322, G - 18);
      pig(300, G - 60 - 18);
      break;
    }
    default: {
      // Fortress: walled ground rooms, second floor, roof payload and a hidden pig.
      add(212, G, 16, 60, vary("glass"));
      add(290, G, 16, 60, "ceramic");
      add(368, G, 16, 60, "alloy");
      add(290, G - 60, 176, 12, "ceramic");
      add(240, G - 72, 14, 56, vary("glass"));
      add(340, G - 72, 14, 56, "alloy");
      add(290, G - 128, 150, 12, vary("ceramic"));
      add(300, G - 140, 40, 40, "alloy");
      add(338, G - 140, 28, 28, vary("glass"));
      add(338, G - 168, 28, 28, "ceramic");
      add(310, G, 24, 24, "tnt");
      add(338, G - 196, 30, 8, "ceramic");
      add(358, G - 140, 12, 30, "alloy");
      pig(250, G - 18);
      pig(245, G - 140 - 18);
      pig(300, G - 180 - 18);
      pig(342, G - 18);
      break;
    }
  }
  return { bodies, enemies };
}
function event(s: BirdsV7State, x: number, y: number, kind: BirdsEvent["kind"]) {
  s.events.push({ tick: s.tick, x, y, kind });
  if (s.events.length > 40) s.events.shift();
}
function destroy(s: BirdsV7State, b: BirdsBody) {
  if (!b.alive) return;
  b.alive = false;
  s.destroyed++;
  event(s, b.x, b.y, b.material);
  if (b.material === "tnt") explode(s, b);
}
/** Radial blast from a crate: damages and shoves pieces, kills close pigs, chains. */
function explode(s: BirdsV7State, source: BirdsBody) {
  const t = BIRDS_TNT_V7;
  for (const e of s.enemies) {
    if (!e.alive) continue;
    const dx = e.x - source.x,
      dy = e.y - source.y;
    if (dx * dx + dy * dy <= t.pigRadius * t.pigRadius) kill(s, e);
  }
  for (const o of s.bodies) {
    if (!o.alive || o === source) continue;
    const dx = o.x - source.x,
      dy = o.y - source.y,
      d = Math.max(1, integerSqrt(dx * dx + dy * dy));
    if (d >= t.radius) continue;
    o.vx += roundDiv(dx * t.push, d);
    o.vy += roundDiv(dy * t.push, d);
    o.hp -= roundDiv(t.damage * (t.radius - d), t.radius);
    if (o.hp <= 0) destroy(s, o);
  }
}
function kill(s: BirdsV7State, e: BirdsEnemy) {
  if (!e.alive) return;
  e.alive = false;
  s.kills++;
  event(s, e.x, e.y, "enemy");
  if (s.kills === s.enemies.length) {
    s.phase = "clearing";
    s.finishAt = s.tick + BIRDS_RULES.clearanceTicks;
  }
}
function finish(s: BirdsV7State, won: boolean, failure: string | null) {
  s.status = won ? "won" : "failed";
  s.failure = failure;
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
  return { nx: roundDiv(dx * 1000, len), ny: roundDiv(dy * 1000, len), push: r - len };
}
/**
 * -1 / +1 when the body rests on something but its centre of mass is beyond
 * the supported span on that side; 0 when stable, free-falling or on the floor.
 */
export function unsupportedDirection(bodies: readonly BirdsBody[], a: BirdsBody) {
  const rules = BIRDS_SUPPORT_V7;
  if (Math.abs(a.vy) > rules.restingSpeed) return 0;
  const bottom = a.y + a.h / 2;
  if (bottom >= GROUND - rules.contactTolerance) return 0;
  const left = a.x - a.w / 2,
    right = a.x + a.w / 2;
  let lo = Infinity,
    hi = -Infinity;
  for (const b of bodies) {
    if (b === a || !b.alive) continue;
    if (Math.abs(b.y - b.h / 2 - bottom) > rules.contactTolerance) continue;
    const l = Math.max(left, b.x - b.w / 2),
      r = Math.min(right, b.x + b.w / 2);
    if (r - l < rules.minimumOverlap) continue;
    lo = Math.min(lo, l);
    hi = Math.max(hi, r);
  }
  if (lo === Infinity) return 0;
  return a.x < lo ? -1 : a.x > hi ? 1 : 0;
}
function moveBodies(s: BirdsV7State) {
  for (const b of s.bodies) {
    if (!b.alive) continue;
    const slide = unsupportedDirection(s.bodies, b);
    if (slide)
      b.vx = clamp(
        b.vx + slide * BIRDS_SUPPORT_V7.slideAcceleration,
        -BIRDS_SUPPORT_V7.slideLimit,
        BIRDS_SUPPORT_V7.slideLimit,
      );
    b.vy += 16;
    b.x += b.vx;
    b.y += b.vy;
    b.vx = Math.sign(b.vx) * Math.floor((Math.abs(b.vx) * 997) / 1000);
    if (b.y + b.h / 2 >= GROUND) {
      const impact = b.vy;
      b.y = GROUND - b.h / 2;
      b.vy = 0;
      b.vx = roundDiv(b.vx * 94, 100);
      if (impact > 1200) {
        b.hp -= Math.floor((impact * impact) / 200000);
        if (b.hp <= 0) destroy(s, b);
      }
    }
    b.x = clamp(b.x, b.w / 2, 1600000 - b.w / 2);
  }
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
        const collisionSpeed = py <= px ? Math.abs(a.vy - b.vy) : Math.abs(a.vx - b.vx);
        if (collisionSpeed > 1100) {
          const damage = Math.floor((collisionSpeed * collisionSpeed) / 250000);
          for (const body of [a, b]) {
            body.hp -= damage;
            if (body.hp <= 0) destroy(s, body);
          }
          if (!a.alive || !b.alive) continue;
        }
        if (py <= px) {
          const sign = a.y < b.y ? -1 : 1,
            ag = a.y + a.h / 2 >= GROUND,
            bg = b.y + b.h / 2 >= GROUND,
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
function moveEnemies(s: BirdsV7State) {
  for (const e of s.enemies) {
    if (!e.alive) continue;
    const before = e.y;
    e.vy += 16;
    e.y += e.vy;
    for (const b of s.bodies) {
      if (!b.alive) continue;
      const contact = circleContact(e.x, e.y, 18000, b);
      if (!contact) continue;
      if (Math.abs(b.vx) + Math.abs(b.vy) > PIG_CRUSH_SPEED) {
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
    if (e.alive && e.y + 18000 >= GROUND) {
      if (e.vy > 900) kill(s, e);
      else {
        e.y = GROUND - 18000;
        e.vy = 0;
      }
    }
  }
}
/** Keep a valid bird selected: the first type that still has stock. */
function ensureSelection(s: BirdsV7State) {
  if (s.stock[s.selected] > 0) return;
  const next = BIRDS_KINDS.find((kind) => s.stock[kind] > 0);
  if (next) s.selected = next;
}
function endShot(s: BirdsV7State) {
  s.bird = null;
  if (s.phase === "clearing") return;
  if (s.ammo === 0) {
    s.phase = "settling";
    s.finishAt = s.tick + BIRDS_RULES.settlingTicks;
    return;
  }
  s.phase = "aim";
  ensureSelection(s);
}
function moveBird(s: BirdsV7State) {
  const bird = s.bird;
  if (!bird) return;
  const traits = BIRDS_PROJECTILES[bird.kind];
  bird.age++;
  bird.vy += 16;
  bird.vx += s.wind;
  for (let sub = 0; sub < 2; sub++) {
    bird.x += roundDiv(bird.vx, 2);
    bird.y += roundDiv(bird.vy, 2);
    for (const e of s.enemies) {
      if (
        e.alive &&
        (e.x - bird.x) ** 2 + (e.y - bird.y) ** 2 < (traits.radius + BIRDS_RULES.enemyRadius) ** 2 &&
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
        b.hp -= Math.floor(((bird.vx * bird.vx + bird.vy * bird.vy) * traits.massMilli) / 160000000);
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
    if (bird.y + traits.radius >= GROUND) {
      bird.y = GROUND - traits.radius;
      bird.vy = Math.abs(bird.vy) < 100 ? 0 : -roundDiv(Math.abs(bird.vy) * 3, 10);
      bird.vx = roundDiv(bird.vx * 94, 100);
    }
  }
  if (
    bird.age >= 720 ||
    bird.x < 0 ||
    bird.x > 405000 ||
    bird.y > 620000 ||
    (bird.age > 90 && Math.abs(bird.vx) + Math.abs(bird.vy) < 160)
  )
    endShot(s);
}
const kindOf = (action: string): BirdKind =>
  action === "BIRD_DART" ? "dart" : action === "BIRD_METEOR" ? "meteor" : "scout";
const stockTotal = (stock: Record<BirdKind, number>) => stock.scout + stock.dart + stock.meteor;
export const BIRDS_CORE_V7: GameCore<BirdsV7State> = {
  gameId: "galactic-birds",
  gameVersion: "7.0.0",
  width: 390,
  height: 620,
  tickRate: 120,
  maxFinalTick: 28800,
  maxInputs: 1800,
  inputVersion: 2,
  actions: BIRDS_ACTIONS_V2,
  content: {
    rules: BIRDS_RULES,
    projectiles: BIRDS_PROJECTILES,
    stock: BIRDS_STOCK_V7,
    support: BIRDS_SUPPORT_V7,
    wind: BIRDS_WIND_V7,
    pigs: BIRDS_PIGS_V7,
    tnt: BIRDS_TNT_V7,
    levels: 6,
    camera: "FIXED_390PX_ONE_ASSEMBLY",
    field: "SIX_DENSE_ASSEMBLIES_WITH_TNT_CRATES_AND_THREE_OR_FOUR_PIGS",
    physics: "INTEGER_TRANSLATIONAL_AABB_SUPPORT_STABILITY_SLIDE_OFF_TNT_CHAIN_BLASTS_LEVEL_WIND",
    choice: "PLAYER_SELECTS_BIRD_TYPE_FROM_LIMITED_STOCK",
    score: "500_PER_DRONE_30_PER_BODY_20_PER_REMAINING_SHOT_ON_CLEAR",
    transitionTicks: 90,
    target: "TERMINAL_SCORE_ONLY",
  },
  create(seed) {
    const field = birdsFieldV7(seed, 0);
    return {
      tick: 0,
      status: "running",
      score: 0,
      failure: null,
      height: 0,
      queue: Object.freeze([]) as readonly BirdKind[],
      launcherX: 110000,
      aim: 30,
      power: 6,
      ammo: stockTotal(BIRDS_STOCK_V7),
      phase: "aim",
      bodies: field.bodies,
      enemies: field.enemies,
      bird: null,
      events: [],
      destroyed: 0,
      kills: 0,
      lastInputTick: -1,
      finishAt: -1,
      shots: 0,
      seed,
      level: 0,
      completedKills: 0,
      completedDestroyed: 0,
      levelStartTick: 0,
      selected: "scout",
      stock: { ...BIRDS_STOCK_V7 },
      wind: BIRDS_WIND_V7[0],
    };
  },
  canApply(s, a) {
    if (s.status !== "running" || s.phase !== "aim" || !BIRDS_ACTIONS_V2.includes(a)) return false;
    if (a === "SHOOT") return s.ammo > 0 && s.stock[s.selected] > 0;
    if (a.startsWith("BIRD_")) return s.stock[kindOf(a)] > 0;
    return true;
  },
  apply(s, a) {
    s.lastInputTick = s.tick;
    if (a.startsWith("BIRD_")) s.selected = kindOf(a);
    else if (a.startsWith("AIM_")) s.aim = Number(a.slice(4));
    else if (/^POWER_\d{2}$/.test(a)) s.power = Number(a.slice(6));
    else if (a === "ANGLE_UP") s.aim = Math.min(60, s.aim + 1);
    else if (a === "ANGLE_DOWN") s.aim = Math.max(0, s.aim - 1);
    else if (a === "POWER_UP") s.power = Math.min(12, s.power + 1);
    else if (a === "POWER_DOWN") s.power = Math.max(0, s.power - 1);
    else {
      const kind = s.selected,
        velocity = birdsVelocity(s.aim, s.power, kind);
      s.stock[kind]--;
      s.ammo--;
      s.shots++;
      s.bird = { kind, x: s.launcherX, y: 520000, ...velocity, age: 0, hitIds: [] };
      s.phase = "flight";
    }
  },
  step(s) {
    s.tick++;
    moveBodies(s);
    moveEnemies(s);
    moveBird(s);
    if (s.phase === "clearing" && s.tick >= s.finishAt) finish(s, true, null);
    if (s.phase === "settling" && s.tick >= s.finishAt) finish(s, false, "OUT_OF_SHOTS");
    if (s.tick === 28800 && s.status === "running") {
      const cleared = s.kills === s.enemies.length;
      finish(s, cleared, cleared ? null : "TIME_LIMIT");
    }
    s.launcherX = 110000;
    if (s.status === "won" && s.level < 5) {
      s.completedKills += s.kills;
      s.completedDestroyed += s.destroyed;
      s.level++;
      s.wind = BIRDS_WIND_V7[s.level];
      Object.assign(s, birdsFieldV7(s.seed, s.level));
      s.levelStartTick = s.tick;
      s.kills = 0;
      s.destroyed = 0;
      s.bird = null;
      s.events = [];
      s.phase = "aim";
      s.status = "running";
      s.failure = null;
      s.finishAt = -1;
      ensureSelection(s);
      if (!s.ammo) {
        s.status = "failed";
        s.failure = "OUT_OF_SHOTS";
      }
    }
    s.height = s.completedKills + s.kills;
    s.score =
      s.status === "running"
        ? 0
        : (s.completedKills + s.kills) * 500 +
          (s.completedDestroyed + s.destroyed) * 30 +
          (s.status === "won" ? s.ammo * 20 : 0);
  },
};
