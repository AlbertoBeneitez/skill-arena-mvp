/** Test-only bowler for Galactic Bowling V1: fixed or seeded-varied throws, optional skips. */
import { applyCoreInput, stepCore } from "../lib/verified/coreRuntime.v1";
import type { ReplayInput } from "../lib/verified/inputValidation";
import { BOWLING_CORE_V2 as core } from "../lib/verified/bowlingCore.v2";
import { bowlingAction } from "../lib/verified/bowlingProtocol.v1";
import { createRng } from "../lib/deterministic/seeded";

export type Throw = { aim: number; angle: number; spin: number; power: number };
export function playBowlingV2(seed: string, pick: (frame: number, roll: number, n: number) => Throw | null, skip = true, target = 1e9) {
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
  return { aim: Math.max(0, Math.min(20, 12 + r.nextInt(2 * spread + 1) - spread)), angle: Math.max(0, Math.min(24, 12 + r.nextInt(2 * spread + 1) - spread)), spin: Math.max(0, Math.min(8, 3 + r.nextInt(3) - 1)), power: 4 + r.nextInt(5) };
};
