/** Original fixed-point evolution of Orbit Shift's five rings and radial steering. */
import { createRng, seededShuffle } from "../deterministic/seeded";
import { roundDiv } from "../deterministic/integerMath";
import { ORBIT_ACTIONS } from "./orbitShiftProtocol.v1";
import type { CoreState, GameCore } from "./coreRuntime.v1";
export const ORBIT_RADII = [62000, 91000, 120000, 149000, 178000] as const;
export const ORBIT_RULES = {
  gates: 60,
  sectors: 3,
  lives: 3,
  inputCooldown: 12,
  protectionTicks: 180,
  collisionRadius: 18000,
  pickupRadius: 12000,
  radialNumerator: 28,
  radialDenominator: 100,
  turnUnits: 65536,
  maxFinalTick: 14400,
  maxInputs: 1400,
} as const;
export type OrbitGate = {
  index: number;
  angle: number;
  lanes: number[];
  pickup: number | null;
  collected: boolean;
  passed: boolean;
  hit: boolean;
};
export type OrbitState = CoreState & {
  seed: string;
  progress: number;
  lane: number;
  radius: number;
  gates: OrbitGate[];
  passed: number;
  combo: number;
  lives: number;
  lastInputTick: number;
  protectedUntil: number;
  lastImpactTick: number;
  lastPickupTick: number;
  lastGateTick: number;
  pickups: number;
  cleanPasses: number;
};
export function buildOrbitCourse(seed: string): OrbitGate[] {
  const rng = createRng(`${seed}:orbit-shift-v1`);
  let angle = 50000;
  return Array.from({ length: 60 }, (_, index) => {
    const sector = Math.floor(index / 20),
      choices = seededShuffle(
        [0, 1, 2, 3, 4],
        `${seed}:orbit-lanes-v1:${index}`,
      ),
      lanes = (index < 8 ? choices.filter((l) => l !== 2) : choices).slice(
        0,
        1 + sector,
      ),
      safe = choices.filter((l) => !lanes.includes(l));
    const gate = {
      index,
      angle,
      lanes,
      pickup:
        index % 7 === 4
          ? index < 8
            ? 2
            : safe[rng.nextInt(safe.length)]
          : null,
      collected: false,
      passed: false,
      hit: false,
    };
    angle += 18000 - sector * 2000 + rng.nextInt(2501) - 1250;
    return gate;
  });
}
export function orbitSpeed(s: Pick<OrbitState, "passed">) {
  return 128 + Math.min(2, Math.floor(s.passed / 20)) * 24;
}
export function createOrbitShift(seed: string): OrbitState {
  return {
    seed,
    tick: 0,
    status: "running",
    score: 0,
    failure: null,
    progress: 0,
    lane: 2,
    radius: 120000,
    gates: buildOrbitCourse(seed),
    passed: 0,
    combo: 0,
    lives: 3,
    lastInputTick: -12,
    protectedUntil: 0,
    lastImpactTick: -999,
    lastPickupTick: -999,
    lastGateTick: -999,
    pickups: 0,
    cleanPasses: 0,
  };
}
export function stepOrbitShift(s: OrbitState) {
  s.tick++;
  s.progress += orbitSpeed(s);
  s.radius += roundDiv((ORBIT_RADII[s.lane] - s.radius) * 28, 100);
  const gate = s.gates[s.passed];
  if (!gate || s.progress < gate.angle) return;
  gate.passed = true;
  s.lastGateTick = s.tick;
  const collision = gate.lanes.some(
    (l) => Math.abs(s.radius - ORBIT_RADII[l]) < 18000,
  );
  if (collision) {
    gate.hit = true;
    s.combo = 0;
    if (s.tick >= s.protectedUntil) {
      s.lives--;
      s.score = Math.max(0, s.score - 350);
      s.lastImpactTick = s.tick;
      s.protectedUntil = s.tick + 180;
      if (!s.lives) {
        s.status = "failed";
        s.failure = "ORBIT_COLLISION";
        return;
      }
    } else s.score += 80;
  } else {
    s.cleanPasses++;
    s.combo++;
    s.score += 420 + Math.min(240, s.combo * 8);
  }
  if (
    gate.pickup !== null &&
    Math.abs(s.radius - ORBIT_RADII[gate.pickup]) <= 12000
  ) {
    gate.collected = true;
    s.pickups++;
    s.lastPickupTick = s.tick;
    s.score += s.lives < 3 ? 160 : 80;
    s.lives = Math.min(3, s.lives + 1);
  }
  s.passed++;
  if (s.passed === 60) {
    s.score += 1000 + s.lives * 150;
    s.status = "won";
    s.failure = null;
  }
}
export const ORBIT_CORE: GameCore<OrbitState> = {
  gameId: "orbit-shift",
  gameVersion: "1.0.0",
  width: 390,
  height: 620,
  tickRate: 120,
  maxFinalTick: 14400,
  maxInputs: 1400,
  inputVersion: 1,
  actions: ORBIT_ACTIONS,
  content: {
    rules: ORBIT_RULES,
    radii: ORBIT_RADII,
    generator:
      "60-angular-gates-8-center-safe-intro-1-2-3-hazard-rings-always2safe-lifepickup-every7-v1",
    motion: "65536units-per-turn;speed128-152-176;radial28percent-roundDiv",
    score:
      "clean420+combo8-cap240;hit-minus350;protected-hit80;pickup160heal-or80full;clear1000+lives150",
    completion: "60-gates-or-target;time-limit-loss",
  },
  create: createOrbitShift,
  step: stepOrbitShift,
  canApply: (s, a) =>
    s.tick - s.lastInputTick >= 12 &&
    (a === "IN" ? s.lane > 0 : a === "OUT" ? s.lane < 4 : false),
  apply: (s, a) => {
    s.lane += a === "IN" ? -1 : 1;
    s.lastInputTick = s.tick;
  },
};
