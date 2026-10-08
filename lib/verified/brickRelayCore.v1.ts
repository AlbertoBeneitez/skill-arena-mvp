/** Original fixed-point adaptation of the existing Brick Relay mechanics. */
import { createRng } from "../deterministic/seeded";
import { clamp, roundDiv, integerSqrt } from "../deterministic/integerMath";
import { BRICK_ACTIONS } from "./brickRelayProtocol.v1";
import type { CoreState, GameCore } from "./coreRuntime.v1";
export const BRICK_RULES = {
  waves: 4,
  ballRadius: 8000,
  paddleY: 570000,
  lives: 3,
  aimCooldown: 7,
  initialServeTicks: 240,
  recoveryTicks: 120,
  wavePause: 240,
  maxFinalTick: 28800,
  maxInputs: 4500,
} as const;
export type RelayBrick = {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  kind: "normal" | "armor" | "blast";
  drift: number;
  period: number;
  phase: number;
};
export type BrickState = CoreState & {
  seed: string;
  wave: number;
  bricks: RelayBrick[];
  paddleX: number;
  paddleW: number;
  targetX: number;
  lastAimTick: number;
  ballX: number;
  ballY: number;
  vx: number;
  vy: number;
  speed: number;
  lives: number;
  serveUntil: number;
  waveUntil: number | null;
  combo: number;
  destroyed: number;
  paddleHits: number;
  lastHitTick: number;
  lastHitX: number;
  lastHitY: number;
  lastBlastTick: number;
  lastMissTick: number;
  hits: number;
};
export function relayBrickX(b: RelayBrick, tick: number) {
  const p = (tick + b.phase) % b.period,
    t = p * 2 < b.period ? p * 4 - b.period : b.period * 3 - p * 4;
  return b.x + roundDiv(t * b.drift, b.period);
}
export function makeRelayWave(seed: string, wave: number): RelayBrick[] {
  const rng = createRng(`${seed}:brick-relay-v1:${wave}`),
    cols = wave === 4 ? 6 : 5,
    rows = wave === 1 ? 2 : wave === 2 ? 3 : 4,
    w = cols === 6 ? 50000 : 62000;
  return Array.from({ length: cols * rows }, (_, i) => {
    const row = Math.floor(i / cols),
      col = i % cols,
      kind =
        wave >= 2 && i % 7 === 3
          ? "blast"
          : wave >= 2 && rng.nextInt(4) === 0
            ? "armor"
            : "normal";
    return {
      id: wave * 100 + i,
      x: 24000 + col * (w + 8000),
      y: 130000 + row * 30000,
      w,
      h: 20000,
      hp: kind === "armor" ? 2 : 1,
      maxHp: kind === "armor" ? 2 : 1,
      kind,
      drift: wave >= 2 && row % 2 === 0 ? (4 + wave) * 1000 : 0,
      period: 480 + rng.nextInt(181),
      phase: rng.nextInt(480),
    };
  });
}
export function createBrickRelay(seed: string): BrickState {
  return {
    seed,
    tick: 0,
    status: "running",
    failure: null,
    score: 0,
    wave: 1,
    bricks: makeRelayWave(seed, 1),
    paddleX: 195000,
    paddleW: 140000,
    targetX: 195000,
    lastAimTick: -7,
    ballX: 195000,
    ballY: 550000,
    vx: 0,
    vy: -2000,
    speed: 2000,
    lives: 3,
    serveUntil: 240,
    waveUntil: null,
    combo: 0,
    destroyed: 0,
    paddleHits: 0,
    lastHitTick: -999,
    lastHitX: 195000,
    lastHitY: 160000,
    lastBlastTick: -999,
    lastMissTick: -999,
    hits: 0,
  };
}
export function relayBounce(
  landingX: number,
  paddleX: number,
  width: number,
  speed: number,
) {
  const relative = clamp(
      roundDiv((landingX - paddleX) * 1000, width / 2),
      -850,
      850,
    ),
    vx = roundDiv(speed * relative, 1000);
  return { vx, vy: -integerSqrt(speed * speed - vx * vx) };
}
function kill(s: BrickState, b: RelayBrick) {
  s.combo++;
  s.destroyed++;
  s.score += roundDiv(
    (280 + s.wave * 26) * (100 + Math.min(140, s.combo * 8)),
    100,
  );
  s.lastHitTick = s.tick;
  s.lastHitX = relayBrickX(b, s.tick) + b.w / 2;
  s.lastHitY = b.y + b.h / 2;
}
function hit(s: BrickState, b: RelayBrick) {
  b.hp--;
  s.hits++;
  s.lastHitTick = s.tick;
  s.lastHitX = relayBrickX(b, s.tick) + b.w / 2;
  s.lastHitY = b.y + b.h / 2;
  if (b.hp) {
    s.score += 95;
    return;
  }
  kill(s, b);
  if (b.kind === "blast") {
    s.lastBlastTick = s.tick;
    const x = s.lastHitX,
      y = s.lastHitY;
    for (const n of s.bricks)
      if (n.hp > 0) {
        const dx = relayBrickX(n, s.tick) + n.w / 2 - x,
          dy = n.y + n.h / 2 - y;
        if (dx * dx + dy * dy <= 76000 * 76000) {
          n.hp = 0;
          kill(s, n);
        }
      }
  }
}
export function stepBrickRelay(s: BrickState) {
  s.tick++;
  const half = s.paddleW / 2;
  s.targetX = clamp(s.targetX, half, 390000 - half);
  s.paddleX += clamp(s.targetX - s.paddleX, -4500, 4500);
  if (s.waveUntil !== null) {
    if (s.tick < s.waveUntil) return;
    s.waveUntil = null;
    s.bricks = makeRelayWave(s.seed, s.wave);
    s.paddleW = 140000 - (s.wave - 1) * 12000;
    s.speed = 2000 + (s.wave - 1) * 300;
    s.serveUntil = s.tick + 120;
    s.vx = 0;
    s.vy = -s.speed;
    s.combo = 0;
  }
  if (s.tick < s.serveUntil) {
    s.ballX = s.paddleX;
    s.ballY = 550000;
    return;
  }
  for (let sub = 0; sub < 2; sub++) {
    s.ballX += roundDiv(s.vx, 2);
    s.ballY += roundDiv(s.vy, 2);
    if (s.ballX < 8000) {
      s.ballX = 8000;
      s.vx = Math.abs(s.vx);
    }
    if (s.ballX > 382000) {
      s.ballX = 382000;
      s.vx = -Math.abs(s.vx);
    }
    if (s.ballY < 8000) {
      s.ballY = 8000;
      s.vy = Math.abs(s.vy);
    }
    if (
      s.vy > 0 &&
      s.ballY + 8000 >= 570000 &&
      s.ballY - 8000 <= 584000 &&
      Math.abs(s.ballX - s.paddleX) <= half + 6000
    ) {
      s.ballY = 561999;
      s.speed = Math.min(2300 + (s.wave - 1) * 300, s.speed + 8);
      const v = relayBounce(s.ballX, s.paddleX, s.paddleW, s.speed);
      s.vx = v.vx;
      s.vy = v.vy;
      s.paddleHits++;
      s.combo = 0;
    }
    for (const b of s.bricks) {
      if (!b.hp) continue;
      const x = relayBrickX(b, s.tick),
        dx = s.ballX - clamp(s.ballX, x, x + b.w),
        dy = s.ballY - clamp(s.ballY, b.y, b.y + b.h);
      if (dx * dx + dy * dy > 64000000) continue;
      const faces = [
          s.ballX + 8000 - x,
          x + b.w + 8000 - s.ballX,
          s.ballY + 8000 - b.y,
          b.y + b.h + 8000 - s.ballY,
        ],
        face = faces.indexOf(Math.min(...faces));
      if (face === 0) {
        s.ballX = x - 8001;
        s.vx = -Math.abs(s.vx);
      } else if (face === 1) {
        s.ballX = x + b.w + 8001;
        s.vx = Math.abs(s.vx);
      } else if (face === 2) {
        s.ballY = b.y - 8001;
        s.vy = -Math.abs(s.vy);
      } else {
        s.ballY = b.y + b.h + 8001;
        s.vy = Math.abs(s.vy);
      }
      hit(s, b);
      break;
    }
  }
  if (s.bricks.every((b) => b.hp === 0)) {
    s.score += 500 + s.lives * 50;
    if (s.wave === 4) {
      s.status = "won";
      s.failure = null;
      return;
    }
    s.wave++;
    s.waveUntil = s.tick + 240;
    s.lives = Math.min(3, s.lives + 1);
    return;
  }
  if (s.ballY > 636000) {
    s.lives--;
    s.score = Math.max(0, s.score - 200);
    s.lastMissTick = s.tick;
    s.combo = 0;
    if (!s.lives) {
      s.status = "failed";
      s.failure = "BALL_LOST";
    } else {
      s.serveUntil = s.tick + 120;
      s.vx = 0;
      s.vy = -s.speed;
    }
  }
}
function nextTarget(s: BrickState, a: string) {
  if (a === "LEFT" || a === "RIGHT")
    return clamp(
      s.targetX + (a === "LEFT" ? -25000 : 25000),
      s.paddleW / 2,
      390000 - s.paddleW / 2,
    );
  if (!/^AIM_\d{3}$/.test(a)) return null;
  const n = Number(a.slice(4));
  return n >= 0 && n < 79
    ? clamp(n * 5000, s.paddleW / 2, 390000 - s.paddleW / 2)
    : null;
}
export function canApplyBrick(s: BrickState, a: string) {
  const x = nextTarget(s, a);
  return x !== null && x !== s.targetX && s.tick - s.lastAimTick >= 7;
}
export function applyBrick(s: BrickState, a: string) {
  s.targetX = nextTarget(s, a)!;
  s.lastAimTick = s.tick;
}
export const BRICK_RELAY_CORE: GameCore<BrickState> = {
  gameId: "brick-relay",
  gameVersion: "1.0.0",
  width: 390,
  height: 620,
  tickRate: 120,
  maxFinalTick: 28800,
  maxInputs: 4500,
  inputVersion: 1,
  actions: BRICK_ACTIONS,
  content: {
    rules: BRICK_RULES,
    generator: "4-waves-10-15-20-24-bricks-armor-blast-row-motion-v1",
    physics: "integer-circle-box-ordered-face-resolution-2-substeps-v1",
    score:
      "armor-hit95;kill(280+wave26)*combo8%-cap240%;clear500+lives50;miss-minus200",
    input: "quantized5px;cooldown7ticks;bounded-linear-paddle",
    completion: "four-clears-or-manifest-target;timeout-is-loss",
  },
  create: createBrickRelay,
  step: stepBrickRelay,
  canApply: canApplyBrick,
  apply: applyBrick,
};
