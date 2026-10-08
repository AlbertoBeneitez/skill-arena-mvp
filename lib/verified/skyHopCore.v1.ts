/** Auto-bounce mechanics retain the MIT-attributed Sky Hop lineage; original integer rules. */
import { createRng } from "../deterministic/seeded";
import { clamp, roundDiv } from "../deterministic/integerMath";
import type { CoreState, GameCore } from "./coreRuntime.v1";
import { SKY_HOP_ACTIONS } from "./skyHopProtocol.v1";
export const SKY_HOP_RULES = {
  goal: 75,
  lives: 3,
  maxLives: 3,
  gravity: 73,
  bounce: -4300,
  boostBounce: -5200,
  acceleration: 90,
  maxSpeed: 2000,
  halfWidth: 15000,
  halfHeight: 19000,
  crumbleTicks: 72,
  maxFinalTick: 21600,
  maxInputs: 4000,
  fallPenalty: 350,
} as const;
export type HopPlatform = {
  x: number;
  y: number;
  width: number;
  kind: "normal" | "moving" | "boost" | "crumble" | "checkpoint";
  drift: number;
  period: number;
  phase: number;
  pickup: boolean;
};
export type SkyHopState = CoreState & {
  seed: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  camera: number;
  left: boolean;
  right: boolean;
  highest: number;
  checkpoint: number;
  platforms: HopPlatform[];
  brokenAt: number[];
  collected: boolean[];
  lives: number;
  landings: number;
  lastLandingTick: number;
  lastLandingIndex: number;
  lastDamageTick: number;
  respawnUntil: number;
};
export function makeHopPlatforms(seed: string): HopPlatform[] {
  const rng = createRng(`${seed}:sky-hop-v1-platforms`);
  let y = 566000,
    center = 195000;
  return Array.from({ length: 76 }, (_, i) => {
    const checkpoint = i % 10 === 0;
    const sector = Math.min(2, Math.floor(i / 25));
    const kind: HopPlatform["kind"] = checkpoint
      ? "checkpoint"
      : i < 5
        ? "normal"
        : i % 10 === 7
          ? "boost"
          : i >= 12 && i % 9 === 4
            ? "crumble"
            : i >= 8 && rng.nextInt(5) === 0
              ? "moving"
              : "normal";
    const width = checkpoint
      ? 144000
      : i < 5
        ? 138000
        : (126 - sector * 12 - rng.nextInt(9)) * 1000;
    const drift = kind === "moving" ? (14 + rng.nextInt(9)) * 1000 : 0;
    if (i) {
      y -= i < 5 ? 72000 : (78 + sector * 5 + rng.nextInt(10)) * 1000;
      if (i >= 4)
        center = clamp(
          center + (rng.nextInt(181 + sector * 20) - 90 - sector * 10) * 1000,
          26000 + width / 2 + drift,
          364000 - width / 2 - drift,
        );
    }
    return {
      x: center - width / 2,
      y,
      width,
      kind,
      drift,
      period: 420 + rng.nextInt(241),
      phase: rng.nextInt(420),
      pickup: i >= 6 && i % 7 === 6,
    };
  });
}
export function hopPlatformX(p: HopPlatform, tick: number) {
  if (!p.drift) return p.x;
  const phase = (tick + p.phase) % p.period;
  const t =
    phase * 2 < p.period ? phase * 4 - p.period : p.period * 3 - phase * 4;
  return p.x + roundDiv(t * p.drift, p.period);
}
export function createSkyHop(seed: string): SkyHopState {
  const platforms = makeHopPlatforms(seed);
  return {
    seed,
    tick: 0,
    status: "running",
    failure: null,
    score: 0,
    x: 195000,
    y: 528000,
    vx: 0,
    vy: -4300,
    camera: 0,
    left: false,
    right: false,
    highest: 0,
    checkpoint: 0,
    platforms,
    brokenAt: platforms.map(() => -1),
    collected: platforms.map(() => false),
    lives: 3,
    landings: 0,
    lastLandingTick: -999,
    lastLandingIndex: 0,
    lastDamageTick: -999,
    respawnUntil: 0,
    height: 0,
  };
}
function fall(s: SkyHopState) {
  s.lives--;
  s.lastDamageTick = s.tick;
  s.score = Math.max(0, s.score - 350);
  if (!s.lives) {
    s.status = "failed";
    s.failure = "FALLEN";
    return;
  }
  const p = s.platforms[s.checkpoint];
  s.x = p.x + p.width / 2;
  s.y = p.y - 19000;
  s.vx = 0;
  s.vy = -4300;
  s.lastLandingIndex = s.checkpoint;
  s.lastLandingTick = s.tick;
  s.camera = Math.min(0, p.y - 430000);
  s.respawnUntil = s.tick + 90;
  // Resume with current held directions: no hidden input reset or replay discrepancy.
}
export function stepSkyHop(s: SkyHopState) {
  s.tick++;
  const input = Number(s.right) - Number(s.left);
  s.vx = input
    ? clamp(s.vx + input * 90, -2000, 2000)
    : roundDiv(s.vx * 84, 100);
  s.x += s.vx;
  if (s.x < -15000) s.x += 420000;
  if (s.x > 405000) s.x -= 420000;
  const previousBottom = s.y + 19000;
  s.vy += 73;
  s.y += s.vy;
  if (s.vy > 0) {
    const nextBottom = s.y + 19000;
    for (let i = 0; i < s.platforms.length; i++) {
      const p = s.platforms[i];
      if (s.brokenAt[i] >= 0 && s.tick >= s.brokenAt[i]) continue;
      if (previousBottom > p.y || nextBottom < p.y) continue;
      const x = hopPlatformX(p, s.tick);
      if (s.x + 15000 <= x || s.x - 15000 >= x + p.width) continue;
      s.y = p.y - 19000;
      s.vy = p.kind === "boost" ? -5200 : -4300;
      s.landings++;
      s.lastLandingTick = s.tick;
      s.lastLandingIndex = i;
      if (p.kind === "crumble" && s.brokenAt[i] < 0)
        s.brokenAt[i] = s.tick + 72;
      if (i > s.highest) {
        for (let k = s.highest + 1; k <= i; k++)
          s.score += 280 + Math.min(480, k * 8);
        s.highest = i;
        s.height = i;
      }
      if (p.pickup && !s.collected[i]) {
        s.collected[i] = true;
        s.score += s.lives < 3 ? 150 : 80;
        s.lives = Math.min(3, s.lives + 1);
      }
      if (p.kind === "checkpoint" && i > s.checkpoint) {
        s.checkpoint = i;
      }
      if (i >= 75) {
        s.status = "won";
        s.failure = null;
      }
      break;
    }
  }
  // Camera is deterministic and ascends monotonically until an explicit checkpoint respawn.
  s.camera = Math.min(s.camera, 0, s.y - 260000);
  if (s.status === "running" && s.y - s.camera > 690000) fall(s);
}
export function canApplySkyHop(s: SkyHopState, a: string) {
  return a === "LEFT_DOWN"
    ? !s.left
    : a === "LEFT_UP"
      ? s.left
      : a === "RIGHT_DOWN"
        ? !s.right
        : a === "RIGHT_UP"
          ? s.right
          : false;
}
export function applySkyHop(s: SkyHopState, a: string) {
  if (a.startsWith("LEFT_")) s.left = a.endsWith("DOWN");
  else s.right = a.endsWith("DOWN");
}
export const SKY_HOP_CORE: GameCore<SkyHopState> = {
  gameId: "sky-hop",
  gameVersion: "1.0.0",
  width: 390,
  height: 620,
  tickRate: 120,
  maxFinalTick: 21600,
  maxInputs: 4000,
  inputVersion: 1,
  actions: SKY_HOP_ACTIONS,
  content: {
    rules: SKY_HOP_RULES,
    generator:
      "bounded-shifts-3-sectors-checkpoint-boost-moving-crumble-pickup-v1",
    coordinateUnit: "milli-pixel-integer-per-tick",
    score: "new-height-only-280+min(480,index*8);pickup150-or80;fall-minus350",
    landing: "downward-feet-crossing-overlap-no-side-snap",
    completion: "platform75-or-manifest-target;time-limit-loss",
  },
  create: createSkyHop,
  step: stepSkyHop,
  canApply: canApplySkyHop,
  apply: applySkyHop,
};
