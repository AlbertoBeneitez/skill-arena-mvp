/** Test-only bowler for Galactic Bowling V3: fixed or seeded-varied throws, optional skips. */
import { applyCoreInput, stepCore } from "../lib/verified/coreRuntime.v1";
import type { ReplayInput } from "../lib/verified/inputValidation";
import { BOWLING_CORE_V3 as core } from "../lib/verified/bowlingCore.v3";
import { bowlingActionV2 as bowlingAction } from "../lib/verified/bowlingProtocol.v2";
import { createRng } from "../lib/deterministic/seeded";

export type Throw = { aim: number; angle: number; spin: number; power: number };
export function playBowlingV3(seed: string, pick: (frame: number, roll: number, n: number) => Throw | null, skip = true, target = 1e9) {
  const s = core.create(seed), inputs: ReplayInput[] = [];
  let queue: string[] = [], n = 0, wait = 0;
  while (s.status === "running") {
    if (s.phase === "celebrate" && skip && s.tick - s.phaseTick > 30 && core.canApply(s, "SKIP")) {
      inputs.push({ seq: inputs.length, tick: s.tick, action: "SKIP" });
      applyCoreInput(core, s, "SKIP", target);
    } else if (s.phase === "aim") {
      if (!queue.length && wait++ > 20) {
        const t = pick(s.frame, s.rollInFrame, n++);
        if (t) queue = [bowlingAction("AIM", t.aim), bowlingAction("ANGLE", t.angle), bowlingAction("SPIN", t.spin), bowlingAction("POWER", t.power), "ROLL"];
        wait = 0;
      }
      const a = queue[0];
      if (a && core.canApply(s, a)) { inputs.push({ seq: inputs.length, tick: s.tick, action: a }); applyCoreInput(core, s, a, target); queue.shift(); }
    }
    if (s.status === "running") stepCore(core, s, target);
  }
  return { s, inputs };
}
export const varied = (seed: string, spread: number) => (frame: number, roll: number, n: number): Throw => {
  const r = createRng(`${seed}:${n}`);
  return { aim: Math.max(0, Math.min(20, 12 + r.nextInt(2 * spread + 1) - spread)), angle: Math.max(0, Math.min(48, 24 + r.nextInt(4 * spread + 1) - 2 * spread)), spin: Math.max(0, Math.min(16, 6 + r.nextInt(5) - 2)), power: 4 + r.nextInt(5) };
};
