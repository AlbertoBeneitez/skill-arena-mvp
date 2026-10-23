import { applyCoreInput, stepCore } from "../lib/verified/coreRuntime.v1";
import type { ReplayInput } from "../lib/verified/inputValidation";
import {
  METRO_CORE_V2 as core,
  METRO_V2,
  METRO_V2_LANES,
  canApplyMetroV2,
  metroSpeedV2,
  type MetroStateV2,
} from "../lib/verified/metroShiftCore.v2";

/** Reaction-limited reference player: looks a fixed time ahead like a human would. */
export function chooseMetroV2Action(s: MetroStateV2): string | null {
  const v = metroSpeedV2(s),
    d = s.distance;
  if (s.tick < s.jetUntil) return null;
  const upcoming = s.obstacles.slice(s.obstacleCursor, s.obstacleCursor + 40);
  const trainThreat = (lane: number, horizon: number) =>
    upcoming.some(
      (o) =>
        o.lane === lane && !o.hit && o.kind === "train" && o.z - d <= horizon && o.z + o.len >= d - 10000,
    );
  const myLaneBlocked = trainThreat(s.lane, v * 45);
  const laneReady = s.tick - s.lastLaneTick >= METRO_V2.laneCooldown;
  if (myLaneBlocked && laneReady) {
    const options = [s.lane - 1, s.lane + 1].filter((l) => l >= 0 && l <= 2 && !trainThreat(l, v * 60));
    // Prefer the lane that does not force a second crossing.
    options.sort((a, b) => Math.abs(a - 1) - Math.abs(b - 1));
    if (options.length) return options[0] < s.lane ? "LEFT" : "RIGHT";
  }
  const own = upcoming.find(
    (o) => o.lane === s.lane && !o.hit && o.kind !== "train" && o.z + o.len >= d - 10000 && o.z - d <= v * 40,
  );
  if (own?.kind === "low" && own.z - 20000 - d <= v * 24 && canApplyMetroV2(s, "JUMP")) return "JUMP";
  if (own?.kind === "high" && own.z - 20000 - d <= v * 10 && canApplyMetroV2(s, "SLIDE")) return "SLIDE";
  if (!own && !myLaneBlocked && s.jumpY === 0) {
    // Chase coins when the neighbouring lane is clear.
    const ahead = s.coins.slice(s.coinCursor, s.coinCursor + 24).filter((c) => c.state === 0 && c.z - d < v * 70 && !c.air);
    const score = (lane: number) => ahead.filter((c) => c.lane === lane).length;
    for (const l of [s.lane - 1, s.lane + 1]) {
      if (l < 0 || l > 2 || trainThreat(l, v * 80)) continue;
      const nearObstacle = upcoming.some((o) => o.lane === l && !o.hit && o.z - d < v * 40 && o.z + o.len >= d);
      if (!nearObstacle && score(l) > score(s.lane) + 1) {
        const a = l < s.lane ? "LEFT" : "RIGHT";
        if (canApplyMetroV2(s, a)) return a;
      }
    }
  }
  return null;
}

export function planMetroV2Run(initial: MetroStateV2, maxTick: number, target = 1e9) {
  const s = structuredClone(initial),
    inputs: ReplayInput[] = [];
  while (s.status === "running" && s.tick < maxTick) {
    const a = chooseMetroV2Action(s);
    if (a && core.canApply(s, a)) {
      inputs.push({ seq: inputs.length, tick: s.tick, action: a });
      applyCoreInput(core, s, a, target);
    }
    stepCore(core, s, target);
  }
  return { state: s, inputs };
}
export { METRO_V2, METRO_V2_LANES };
