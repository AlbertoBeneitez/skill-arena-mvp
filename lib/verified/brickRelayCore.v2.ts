/** V2 continuous wall + recorded held accelerator. V1 remains immutable. */
import { createRng } from "../deterministic/seeded";
import { clamp, roundDiv } from "../deterministic/integerMath";
import { BRICK_V2_ACTIONS } from "./brickRelayProtocol.v2";
import { relayBrickX, relayBounce, type RelayBrick } from "./brickRelayCore.v1";
export { relayBrickX } from "./brickRelayCore.v1";
import type { CoreState, GameCore } from "./coreRuntime.v1";
export const BRICK_RULES = {
  bricks: 69,
  boostNumerator: 3,
  boostDenominator: 2,
  ballRadius: 8000,
  paddleY: 570000,
  lives: 3,
  aimCooldown: 7,
  initialServeTicks: 240,
  recoveryTicks: 120,

  maxFinalTick: 28800,
  maxInputs: 4500,
} as const;
export type BrickState = CoreState & {
  seed: string;
  boosted: boolean;
  baseSpeed: number;
  height: number;
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
export function makeRelayWall(seed: string): RelayBrick[] {
  const rng = createRng(`${seed}:brick-relay-v2:continuous-wall`);
  return Array.from({ length: 69 }, (_, id) => {
    const row = Math.floor(id / 6),
      col = id % 6;
    // Bottom rows are plain and stationary; depth reveals armor and motion.
    const kind =
      row >= 9
        ? "normal"
        : id % 11 === 3
          ? "blast"
          : row < 6 && rng.nextInt(4) === 0
            ? "armor"
            : "normal";
    const hp = kind === "armor" ? 2 : 1;
    return {
      id,
      x: 25000 + col * 58000,
      y: 110000 + row * 24000,
      w: 50000,
      h: 20000,
      kind,
      hp,
      maxHp: hp,
      drift: row < 6 && row % 2 === 0 ? 5000 : 0,
      period: 600 + rng.nextInt(181),
      phase: rng.nextInt(600),
    };
  });
}
function setSpeed(s: BrickState, speed: number) {
  if (s.speed === speed) return;
  s.vx = roundDiv(s.vx * speed, s.speed);
  s.vy = roundDiv(s.vy * speed, s.speed);
  s.speed = speed;
}
function effectiveSpeed(s: BrickState) {
  return s.boosted ? roundDiv(s.baseSpeed * 3, 2) : s.baseSpeed;
}
export function createBrickRelay(seed: string): BrickState {
  return {
    seed,
    tick: 0,
    status: "running",
    failure: null,
    score: 0,
    boosted: false,
    baseSpeed: 2000,
    height: 0,
    bricks: makeRelayWall(seed),
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
function kill(s: BrickState, b: RelayBrick) {
  s.combo++;
  s.destroyed++;
  s.height = s.destroyed;
  s.score += roundDiv(306 * (100 + Math.min(140, s.combo * 8)), 100);
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
  s.paddleW = Math.max(104000, 140000 - s.destroyed * 520);
  const half = s.paddleW / 2;
  s.targetX = clamp(s.targetX, half, 390000 - half);
  s.paddleX += clamp(s.targetX - s.paddleX, -4500, 4500);
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
      s.baseSpeed = Math.min(
        2800,
        2000 + s.destroyed * 10 + (s.paddleHits + 1) * 8,
      );
      setSpeed(s, effectiveSpeed(s));
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
    s.status = "won";
    s.failure = null;
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
  if (a === "BOOST_DOWN") return !s.boosted;
  if (a === "BOOST_UP") return s.boosted;
  const x = nextTarget(s, a);
  return x !== null && x !== s.targetX && s.tick - s.lastAimTick >= 7;
}
export function applyBrick(s: BrickState, a: string) {
  if (a === "BOOST_DOWN" || a === "BOOST_UP") {
    s.boosted = a === "BOOST_DOWN";
    setSpeed(s, effectiveSpeed(s));
    return;
  }
  s.targetX = nextTarget(s, a)!;
  s.lastAimTick = s.tick;
}
export const BRICK_RELAY_CORE: GameCore<BrickState> = {
  gameId: "brick-relay",
  gameVersion: "2.0.0",
  width: 390,
  height: 620,
  tickRate: 120,
  maxFinalTick: 28800,
  maxInputs: 4500,
  inputVersion: 2,
  actions: BRICK_V2_ACTIONS,
  content: {
    rules: BRICK_RULES,
    generator: "one-wall-69-bricks-plain-opening-armor-blast-upper-drift-v2",
    physics: "integer-circle-box-ordered-face-resolution-2-substeps-v1",
    score:
      "reach=unique-destroyed;armor-hit95;kill306*combo8%-cap240%;clear500+lives50;miss-minus200",
    input:
      "quantized5px;aim-cooldown7ticks;bounded-paddle;held-boost3/2-immediate-release",
    completion:
      "one-wall-clear-or-manifest-target;timeout-is-loss;no-wave-resets",
  },
  create: createBrickRelay,
  step: stepBrickRelay,
  canApply: canApplyBrick,
  apply: applyBrick,
};
