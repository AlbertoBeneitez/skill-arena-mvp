/** Test-only player: aims at the nearest target with a seed-independent power sweep. */
import { BILLIARDS_CORE_V4 as core } from "../lib/verified/billiardsCore.v4";
import { billiardsAimAction } from "../lib/verified/billiardsProtocol.v1";
import { applyCoreInput, stepCore } from "../lib/verified/coreRuntime.v1";
import type { ReplayInput } from "../lib/verified/inputValidation";
export function playBilliardsV4(seed: string) {
  const s = core.create(seed), inputs: ReplayInput[] = [];
  let shot = 0;
  const send = (action: string) => {
    if (!core.canApply(s, action)) return;
    inputs.push({ seq: inputs.length, tick: s.tick, action });
    applyCoreInput(core, s, action, 1e9);
    stepCore(core, s, 1e9);
  };
  while (s.status === "running") {
    if (s.phase === "aim") {
      const cue = s.balls[0], t = s.balls.slice(1).filter((b) => !b.potted).sort((p, q) => Math.hypot(p.x - cue.x, p.y - cue.y) - Math.hypot(q.x - cue.x, q.y - cue.y))[0];
      const angle = (Math.atan2(t.y - cue.y, t.x - cue.x) + Math.PI * 2) % (Math.PI * 2);
      send(billiardsAimAction(Math.round((angle * 180) / (Math.PI * 2)) % 180));
      send(`POWER_${String(4 + (shot % 6)).padStart(2, "0")}`);
      send("SHOOT");
      shot++;
    } else stepCore(core, s, 1e9);
  }
  return { state: s, inputs };
}
