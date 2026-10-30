/** Test-only player for Billiards V7 (gymkhana): ghost-ball shots at the targets (the 8 last), first scoring shot wins. */
import { applyCoreInput, stepCore } from "../lib/verified/coreRuntime.v1";
import type { ReplayInput } from "../lib/verified/inputValidation";
import { BILLIARDS_POCKETS } from "../lib/verified/billiardsCore.v1";
import { BILLIARDS_CORE_V7 as core, isTarget, type BilliardsV7State } from "../lib/verified/billiardsCore.v7";
import { billiardsAimAction } from "../lib/verified/billiardsProtocol.v1";
import { billiardsPowerActionV3 } from "../lib/verified/billiardsCore.v3";

const clone = (s: BilliardsV7State): BilliardsV7State => JSON.parse(JSON.stringify(s));
export const aimTowardsV7 = (from: { x: number; y: number }, to: { x: number; y: number }) =>
  ((Math.round((Math.atan2(to.y - from.y, to.x - from.x) * 180) / (Math.PI * 2)) % 180) + 180) % 180;
function simulate(s: BilliardsV7State, aim: number, power: number) {
  const c = clone(s);
  c.aim = aim; c.power = power;
  applyCoreInput(core, c, "SHOOT", 1e9);
  while (c.status === "running" && c.phase === "moving") stepCore(core, c, 1e9);
  return c;
}
function choose(s: BilliardsV7State) {
  const cue = s.balls[0];
  const targetsLeft = s.balls.some((b) => !b.potted && isTarget(b.id));
  const targets = s.balls.filter((b) => !b.potted && (targetsLeft ? isTarget(b.id) : b.id === 8));
  let fallback = { aim: s.aim, power: 9, gain: -1e9 };
  for (const t of targets) for (const pk of BILLIARDS_POCKETS) {
    const d = Math.hypot(pk.x - t.x, pk.y - t.y) || 1;
    const ghost = { x: t.x - ((pk.x - t.x) / d) * 20000, y: t.y - ((pk.y - t.y) / d) * 20000 };
    const aim = aimTowardsV7(cue, ghost);
    for (const power of [4, 8]) {
      const c = simulate(s, aim, power);
      const gain = c.score - s.score + (c.level > s.level || c.status === "won" ? 1e5 : 0);
      if (gain > 0) return { aim, power };
      if (gain > fallback.gain) fallback = { aim, power, gain };
    }
  }
  return fallback;
}
export function playBilliardsV7(seed: string, target = 1e9, maxShots = 40) {
  const s = core.create(seed), inputs: ReplayInput[] = [];
  const send = (a: string) => { if (core.canApply(s, a)) { inputs.push({ seq: inputs.length, tick: s.tick, action: a }); applyCoreInput(core, s, a, target); } };
  let shots = 0, queue: string[] = [];
  while (s.status === "running") {
    if (s.phase === "aim" && !queue.length && shots < maxShots) {
      const shot = choose(s);
      queue = [billiardsAimAction(shot.aim), billiardsPowerActionV3(shot.power), "SHOOT"].filter((a) => core.canApply(s, a) || a === "SHOOT");
      shots++;
    }
    if (s.phase === "aim" && queue.length) send(queue.shift()!);
    if (s.status === "running") stepCore(core, s, target);
  }
  return { s, inputs };
}
