/** Original deterministic corridor extension; the archived V1 core is unchanged. */
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
export const JET_STREAM_V2 = {
  tickRate: 120,
  initialLives: 2,
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
  maximumSpeedMilli: 280000,
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
  maxFinalTick: 120 * 60 * 6,
  maxInputs: 4000,
} as const;
export type JetWindow = { centerYMilli: number; gapMilli: number };
export type JetGateV2 = JetStreamGate & {
  windows: JetWindow[];
  damaged: boolean;
  pickup: boolean;
  collected: boolean;
};
export type JetStreamV2State = Omit<JetStreamState, "gates"> & {
  seed: string;
  gates: JetGateV2[];
  lives: number;
  shieldUntilTick: number;
  lastFlapTick: number;
  collected: number;
};
const jitter = (seed: string, range: number) =>
  (hashSeed(seed) % (range * 2 + 1)) - range;
function append(state: JetStreamV2State) {
  const cfg = JET_STREAM_V2,
    index = state.nextGateIndex;
  const center = clamp(
    state.lastGeneratedCenterYMilli +
      jitter(`${state.seed}:jet2:centre:${index}`, cfg.centreDeltaMilli),
    145000,
    475000,
  );
  const gap = clamp(
    cfg.initialGapMilli -
      index * cfg.gapDecreasePerGateMilli +
      jitter(`${state.seed}:jet2:width:${index}`, cfg.gapJitterMilli),
    cfg.minimumGapMilli,
    190000,
  );
  const spacing = Math.max(
    cfg.minimumSpacingMilli,
    cfg.initialSpacingMilli -
      index * cfg.spacingDecreaseMilli +
      jitter(`${state.seed}:jet2:spacing:${index}`, cfg.spacingJitterMilli),
  );
  const windows: JetWindow[] = [{ centerYMilli: center, gapMilli: gap }];
  if (index % cfg.doubleEvery === cfg.doubleOffset)
    windows.push({
      centerYMilli:
        center + (center < 310000 ? 1 : -1) * cfg.alternativeDistanceMilli,
      gapMilli: cfg.alternativeGapMilli,
    });
  windows.sort((a, b) => a.centerYMilli - b.centerYMilli);
  const gate: JetGateV2 = {
    index,
    worldXMilli: state.lastGeneratedXMilli + spacing,
    centerYMilli: center,
    passed: false,
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
function fill(state: JetStreamV2State) {
  while (
    state.gates.length &&
    state.gates[0].worldXMilli - state.scrollMilli + JET_STREAM_V1.gateWidth <=
      -80000
  )
    state.gates.shift();
  while (state.lastGeneratedXMilli - state.scrollMilli < 1900000) append(state);
}
export function createJetStreamV2(seed: string): JetStreamV2State {
  const state: JetStreamV2State = {
    ...createJetStreamState(seed),
    seed,
    gates: [],
    nextGateIndex: 0,
    lastGeneratedXMilli: 288000,
    lastGeneratedCenterYMilli: 305000,
    lives: JET_STREAM_V2.initialLives,
    shieldUntilTick: 0,
    lastFlapTick: -JET_STREAM_V2.flapCooldownTicks,
    collected: 0,
  };
  fill(state);
  return state;
}
function damage(
  state: JetStreamV2State,
  failure: "GATE_COLLISION" | "OUT_OF_BOUNDS",
) {
  if (state.tick < state.shieldUntilTick) return;
  state.lives--;
  state.shieldUntilTick = state.tick + JET_STREAM_V2.shieldTicks;
  if (state.lives <= 0) {
    state.status = "failed";
    state.failure = failure;
  }
}
export function stepJetStreamV2(state: JetStreamV2State) {
  state.tick++;
  const cfg = JET_STREAM_V1,
    rules = JET_STREAM_V2;
  state.velocityRemainder += cfg.gravityMilliPerSecond2;
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
      x + cfg.gateWidth > cfg.playerX - radius
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
    if (gate.pickup && !gate.collected) {
      const px = x + cfg.gateWidth / 2 - cfg.playerX,
        py = gate.centerYMilli - state.yMilli;
      if (px * px + py * py <= (radius + rules.pickupRadiusMilli) ** 2) {
        gate.collected = true;
        state.collected++;
        state.lives = Math.min(rules.maximumLives, state.lives + 1);
        state.score += rules.pickupBonus;
      }
    }
    if (!gate.passed && x + cfg.gateWidth < cfg.playerX - radius) {
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
}
export const JET_STREAM_CORE_V2: GameCore<JetStreamV2State> = {
  gameId: "jet-stream",
  gameVersion: "2.0.0",
  width: 390,
  height: 620,
  tickRate: 120,
  maxFinalTick: JET_STREAM_V2.maxFinalTick,
  maxInputs: JET_STREAM_V2.maxInputs,
  inputVersion: 2,
  actions: ["FLAP"],
  content: {
    rules: JET_STREAM_V2,
    flight: {
      gravity: JET_STREAM_V1.gravityMilliPerSecond2,
      flapVelocity: JET_STREAM_V1.flapVelocityMilliPerSecond,
      maxFallVelocity: JET_STREAM_V1.maxFallVelocityMilliPerSecond,
      minRiseVelocity: JET_STREAM_V1.minimumRiseVelocityMilliPerSecond,
      playerX: JET_STREAM_V1.playerX,
      radius: JET_STREAM_V1.playerRadius,
      gateWidth: JET_STREAM_V1.gateWidth,
    },
    generation: "jet2:centre,width,spacing:index",
    windows: "FIXED_WHEN_GENERATED",
    shield: "DAMAGE_ONCE_PER_GATE",
    pickup: "ONE_COLLECTION_PER_GATE",
  },
  create: createJetStreamV2,
  step: stepJetStreamV2,
  canApply: (state) =>
    state.status === "running" &&
    state.tick - state.lastFlapTick >= JET_STREAM_V2.flapCooldownTicks,
  apply: (state) => {
    flapJetStream(state);
    state.lastFlapTick = state.tick;
  },
};
