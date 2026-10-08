/** V3 teaches flight before introducing narrower/dual corridors.
 * Composes frozen V2 physics, collision, pickups and scoring; V1/V2 stay append-only.
 */
import { hashSeed } from "../deterministic/seeded";
import { clamp } from "../deterministic/integerMath";
import {
  JET_STREAM_CORE_V2,
  JET_STREAM_V2,
  createJetStreamV2,
  stepJetStreamV2,
  type JetStreamV2State,
} from "./jetStreamCore.v2";
import { JET_STREAM_V1, flapJetStream } from "./jetStreamCore.v1";
import type { GameCore } from "./coreRuntime.v1";
export const JET_STREAM_V3 = {
  launchAssistTicks: 480,
  initialLives: 3,
  teachingGates: 4,
  initialGravity: 680000,
  initialImpulse: -290000,
  initialCooldownTicks: 16,
  initialGap: 250000,
  minimumGap: 110000,
  gapDecrease: 1700,
  dualFirstIndex: 8,
  maxFinalTick: 120 * 180,
} as const;
export type JetStreamV3State = JetStreamV2State & {
  launchedAtTick: number | null;
  preparedThrough: number;
  preparedCenter: number;
};
const noise = (seed: string, range: number) =>
  (hashSeed(seed) % (range * 2 + 1)) - range;
function prepareNewGates(s: JetStreamV3State) {
  for (const g of s.gates) {
    if (g.index <= s.preparedThrough) continue;
    const i = g.index;
    const delta = Math.min(65000, 28000 + Math.max(0, i - 4) * 2400);
    const center =
      i < 4
        ? 305000
        : clamp(
            s.preparedCenter + noise(`${s.seed}:jet3:centre:${i}`, delta),
            145000,
            475000,
          );
    const gap =
      i < 2
        ? JET_STREAM_V3.initialGap
        : i < 4
          ? 230000
          : clamp(
              220000 -
                (i - 4) * 1700 +
                noise(`${s.seed}:jet3:width:${i}`, 18000),
              JET_STREAM_V3.minimumGap,
              238000,
            );
    const windows = [{ centerYMilli: center, gapMilli: gap }];
    if (i >= JET_STREAM_V3.dualFirstIndex && i % 6 === 2)
      windows.push({
        centerYMilli: center + (center < 310000 ? 190000 : -190000),
        gapMilli: 126000,
      });
    windows.sort((a, b) => a.centerYMilli - b.centerYMilli);
    g.centerYMilli = center;
    g.windows = windows;
    s.preparedCenter = center;
    s.preparedThrough = i;
  }
}
export function createJetStreamV3(seed: string): JetStreamV3State {
  const s: JetStreamV3State = {
    ...createJetStreamV2(seed),
    lives: 3,
    yMilli: 305000,
    launchedAtTick: null,
    preparedThrough: -1,
    preparedCenter: 305000,
  };
  prepareNewGates(s);
  return s;
}
export function stepJetStreamV3(s: JetStreamV3State) {
  if (s.launchedAtTick === null) {
    if (s.tick < JET_STREAM_V3.launchAssistTicks) {
      s.tick++;
      return;
    }
    s.launchedAtTick = s.tick;
  }
  // V2's remainder-based integrator remains the single source of flight physics.
  // Subtract only the difference before its fixed gravity addition.
  const gravity = Math.min(
    JET_STREAM_V1.gravityMilliPerSecond2,
    JET_STREAM_V3.initialGravity + s.passed * 80000,
  );
  s.velocityRemainder -= JET_STREAM_V1.gravityMilliPerSecond2 - gravity;
  stepJetStreamV2(s);
  prepareNewGates(s); // only newly created, distant gates; visible windows never move.
  if (s.status === "running" && s.tick >= JET_STREAM_V3.maxFinalTick) {
    s.status = "won";
    s.failure = null;
  }
}
export const JET_STREAM_CORE_V3: GameCore<JetStreamV3State> = {
  ...JET_STREAM_CORE_V2,
  gameVersion: "3.0.0",
  inputVersion: 3,
  maxFinalTick: JET_STREAM_V3.maxFinalTick,
  content: {
    base: JET_STREAM_CORE_V2.content,
    progression: JET_STREAM_V3,
    scenario: "jet3:centre,width:index",
    launch: "first-flap-or-480-ticks-no-score-hover",
    flight: "frozen-v2-integrator-with-explicit-gravity-ramp",
    completion: "target-or-survive-180s",
  },
  create: createJetStreamV3,
  step: stepJetStreamV3,
  canApply: (s, action) =>
    action === "FLAP" &&
    s.status === "running" &&
    s.tick - s.lastFlapTick >=
      (s.passed < JET_STREAM_V3.teachingGates
        ? JET_STREAM_V3.initialCooldownTicks
        : JET_STREAM_V2.flapCooldownTicks),
  apply: (s) => {
    s.launchedAtTick ??= s.tick;
    flapJetStream(s);
    s.vyMilliPerSecond = -Math.min(
      350000,
      -JET_STREAM_V3.initialImpulse + s.passed * 15000,
    );
    s.lastFlapTick = s.tick;
  },
};
