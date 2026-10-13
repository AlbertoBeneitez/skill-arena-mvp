/** Variable thick tubes, collectible slow clocks and a 270-second progressive run. */
import { hashSeed } from "../deterministic/seeded";
import { clamp, roundDiv } from "../deterministic/integerMath";
import {
  JET_STREAM_V1,
  createJetStreamState,
  flapJetStream,
  type JetStreamState,
  type JetStreamGate,
} from "./jetStreamCore.v1";
import type { GameCore } from "./coreRuntime.v1";
export const JET_STREAM_V5 = {
  tickRate: 120,
  initialLives: 3,
  maximumLives: 3,
  shieldTicks: 90,
  flapCooldownTicks: 12,
  initialGapMilli: 168000,
  minimumGapMilli: 100000,
  gapDecreasePerGateMilli: 1400,
  gapJitterMilli: 22000,
  initialSpacingMilli: 232000,
  minimumSpacingMilli: 190000,
  spacingDecreaseMilli: 1800,
  spacingJitterMilli: 12000,
  centreDeltaMilli: 65000,
  initialSpeedMilli: 132000,
  speedIncreasePerGateMilli: 3500,
  maximumSpeedMilli: 310000,
  doubleEvery: 6,
  doubleOffset: 4,
  alternativeDistanceMilli: 190000,
  alternativeGapMilli: 112000,
  pickupEvery: 4,
  pickupOffset: 3,
  pickupRadiusMilli: 18000,
  pickupBonus: 100,
  basePoints: 280,
  damagedGatePoints: 80,
  precisionMax: 220,
  maxFinalTick: 120 * 270,
  slowTicks: 480,
  slowNumerator: 1,
  slowDenominator: 2,
  maxInputs: 4000,
} as const;
export type JetWindow = { centerYMilli: number; gapMilli: number };
export type JetGateV5 = JetStreamGate & {
  windows: JetWindow[];
  widthMilli: number;
  clock: boolean;
  clockCollected: boolean;
  damaged: boolean;
  pickup: boolean;
  collected: boolean;
};
export type JetStreamV5State = Omit<JetStreamState, "gates"> & {
  seed: string;
  launchedAtTick: number | null;
  physicsRemainder: number;
  slowUntilTick: number;
  clocks: number;
  height: number;
  gates: JetGateV5[];
  lives: number;
  shieldUntilTick: number;
  lastFlapTick: number;
  collected: number;
};
const jitter = (seed: string, range: number) =>
  (hashSeed(seed) % (range * 2 + 1)) - range;
function append(state: JetStreamV5State) {
  const cfg = JET_STREAM_V5,
    index = state.nextGateIndex;
  const center = clamp(
    state.lastGeneratedCenterYMilli +
      jitter(`${state.seed}:jet5:centre:${index}`, cfg.centreDeltaMilli),
    145000,
    475000,
  );
  const gap = clamp(
    (index < 4 ? 250000 : 225000) -
      Math.max(0, index - 4) * 650 +
      jitter(`${state.seed}:jet5:width:${index}`, cfg.gapJitterMilli),
    cfg.minimumGapMilli,
    250000,
  );
  const spacing = Math.max(
    cfg.minimumSpacingMilli,
    cfg.initialSpacingMilli -
      index * cfg.spacingDecreaseMilli +
      jitter(`${state.seed}:jet5:spacing:${index}`, cfg.spacingJitterMilli),
  );
  const windows: JetWindow[] = [{ centerYMilli: center, gapMilli: gap }];
  if (index % cfg.doubleEvery === cfg.doubleOffset)
    windows.push({
      centerYMilli:
        center + (center < 310000 ? 1 : -1) * cfg.alternativeDistanceMilli,
      gapMilli: cfg.alternativeGapMilli,
    });
  windows.sort((a, b) => a.centerYMilli - b.centerYMilli);
  const gate: JetGateV5 = {
    index,
    worldXMilli: state.lastGeneratedXMilli + spacing,
    centerYMilli: center,
    passed: false,
    widthMilli: index < 2 ? 30000 : [24000,42000,60000,78000][hashSeed(`${state.seed}:jet5:body:${index}`) % 4] + Math.min(18000, Math.floor(index / 30) * 3000),
    clock: index % 8 === 5,
    clockCollected: false,
    windows,
    damaged: false,
    pickup: index % cfg.pickupEvery === cfg.pickupOffset,
    collected: false,
  };
  state.gates.push(gate);
  state.nextGateIndex++;
  state.lastGeneratedXMilli = gate.worldXMilli;
  state.lastGeneratedCenterYMilli = center;
}
function fill(state: JetStreamV5State) {
  while (
    state.gates.length &&
    state.gates[0].worldXMilli - state.scrollMilli + state.gates[0].widthMilli <=
      -80000
  )
    state.gates.shift();
  while (state.lastGeneratedXMilli - state.scrollMilli < 1900000) append(state);
}
export function createJetStreamV5(seed: string): JetStreamV5State {
  const state: JetStreamV5State = {
    ...createJetStreamState(seed),
    seed,
    launchedAtTick: null,
    physicsRemainder: 0,
    slowUntilTick: 0,
    clocks: 0,
    height: 0,
    yMilli: 305000,
    gates: [],
    nextGateIndex: 0,
    lastGeneratedXMilli: 288000,
    lastGeneratedCenterYMilli: 305000,
    lives: JET_STREAM_V5.initialLives,
    shieldUntilTick: 0,
    lastFlapTick: -JET_STREAM_V5.flapCooldownTicks,
    collected: 0,
  };
  fill(state);
  return state;
}
function damage(
  state: JetStreamV5State,
  failure: "GATE_COLLISION" | "OUT_OF_BOUNDS",
) {
  if (state.tick < state.shieldUntilTick) return;
  state.lives--;
  state.shieldUntilTick = state.tick + JET_STREAM_V5.shieldTicks;
  if (state.lives <= 0) {
    state.status = "failed";
    state.failure = failure;
  }
}
export function stepJetStreamV5(state: JetStreamV5State) {
  state.tick++;
  if (state.launchedAtTick === null) {
    if (state.tick < 480) return;
    state.launchedAtTick = state.tick;
  }
  // Real tick/deadline never slow down. Physics advances at half rate under a clock.
  state.physicsRemainder += state.tick < state.slowUntilTick ? 1 : 2;
  if (state.physicsRemainder < 2) {
    if (state.tick === JET_STREAM_V5.maxFinalTick) {state.status = "won"; state.failure = null;}
    return;
  }
  state.physicsRemainder -= 2;
  const cfg = JET_STREAM_V1,
    rules = JET_STREAM_V5;
  state.velocityRemainder += Math.min(1000000, 680000 + state.passed * 12000);
  state.vyMilliPerSecond = clamp(
    state.vyMilliPerSecond + Math.floor(state.velocityRemainder / cfg.tickRate),
    cfg.minimumRiseVelocityMilliPerSecond,
    cfg.maxFallVelocityMilliPerSecond,
  );
  state.velocityRemainder %= cfg.tickRate;
  state.yRemainder += state.vyMilliPerSecond;
  const dy = Math.trunc(state.yRemainder / cfg.tickRate);
  state.yRemainder -= dy * cfg.tickRate;
  state.yMilli += dy;
  state.scrollRemainder += Math.min(
    rules.maximumSpeedMilli,
    rules.initialSpeedMilli + state.passed * rules.speedIncreasePerGateMilli,
  );
  const dx = Math.floor(state.scrollRemainder / cfg.tickRate);
  state.scrollRemainder %= cfg.tickRate;
  state.scrollMilli += dx;
  const radius = cfg.playerRadius;
  if (state.yMilli - radius <= 0 || state.yMilli + radius >= 620000) {
    damage(state, "OUT_OF_BOUNDS");
    state.yMilli = clamp(state.yMilli, radius + 1000, 620000 - radius - 1000);
    state.vyMilliPerSecond = 0;
    state.yRemainder = 0;
    if (state.status === "failed") return;
  }
  for (const gate of state.gates) {
    const x = gate.worldXMilli - state.scrollMilli;
    if (
      !gate.damaged &&
      x < cfg.playerX + radius &&
      x + gate.widthMilli > cfg.playerX - radius
    ) {
      const inside = gate.windows.some(
        (w) =>
          state.yMilli - radius >=
            w.centerYMilli - Math.floor(w.gapMilli / 2) &&
          state.yMilli + radius <= w.centerYMilli + Math.floor(w.gapMilli / 2),
      );
      if (!inside) {
        gate.damaged = true;
        damage(state, "GATE_COLLISION");
        if (state.status === "failed") return;
      }
    }
    if (gate.clock && !gate.clockCollected) {
      const px = x + gate.widthMilli / 2 - cfg.playerX, py = gate.centerYMilli - state.yMilli;
      if (px * px + py * py <= (radius + 18000) ** 2) {
        gate.clockCollected = true;
        state.clocks++;
        state.slowUntilTick = state.tick + JET_STREAM_V5.slowTicks;
      }
    }
    if (gate.pickup && !gate.collected) {
      const px = x + gate.widthMilli / 2 - cfg.playerX,
        py = gate.centerYMilli - state.yMilli;
      if (px * px + py * py <= (radius + rules.pickupRadiusMilli) ** 2) {
        gate.collected = true;
        state.collected++;
        state.lives = Math.min(rules.maximumLives, state.lives + 1);
        state.score += rules.pickupBonus;
      }
    }
    if (!gate.passed && x + gate.widthMilli < cfg.playerX - radius) {
      gate.passed = true;
      state.passed++;
      const precision = Math.max(
        ...gate.windows.map((w) =>
          roundDiv(
            Math.max(
              0,
              Math.floor(w.gapMilli / 2) -
                Math.abs(state.yMilli - w.centerYMilli),
            ) * rules.precisionMax,
            Math.floor(w.gapMilli / 2),
          ),
        ),
      );
      state.score += gate.damaged
        ? rules.damagedGatePoints
        : rules.basePoints + precision;
    }
  }
  fill(state);
  state.height = state.passed;
  if (state.tick >= JET_STREAM_V5.maxFinalTick && state.status === "running") {state.status = "won"; state.failure = null;}
}
export const JET_STREAM_CORE_V5: GameCore<JetStreamV5State> = {
  gameId: "jet-stream",
  gameVersion: "5.0.0",
  width: 390,
  height: 620,
  tickRate: 120,
  maxFinalTick: JET_STREAM_V5.maxFinalTick,
  maxInputs: JET_STREAM_V5.maxInputs,
  inputVersion: 4,
  actions: ["FLAP"],
  content: {
    rules: JET_STREAM_V5,
    flight: {
      gravity: JET_STREAM_V1.gravityMilliPerSecond2,
      flapVelocity: JET_STREAM_V1.flapVelocityMilliPerSecond,
      maxFallVelocity: JET_STREAM_V1.maxFallVelocityMilliPerSecond,
      minRiseVelocity: JET_STREAM_V1.minimumRiseVelocityMilliPerSecond,
      playerX: JET_STREAM_V1.playerX,
      radius: JET_STREAM_V1.playerRadius,
      gateWidths: [24000,30000,42000,60000,78000,96000],
    },
    generation: "jet5:centre,aperture,body-width,spacing:index",
    windows: "FIXED_WHEN_GENERATED",
    shield: "DAMAGE_ONCE_PER_GATE",
    pickup: "ONE_COLLECTION_PER_GATE",
  },
  create: createJetStreamV5,
  step: stepJetStreamV5,
  canApply: (state) =>
    state.status === "running" &&
    state.tick - state.lastFlapTick >= JET_STREAM_V5.flapCooldownTicks,
  apply: (state) => {
    state.launchedAtTick ??= state.tick;
    flapJetStream(state);
    state.vyMilliPerSecond = -Math.min(350000, 290000 + state.passed * 5000);
    state.lastFlapTick = state.tick;
  },
};
