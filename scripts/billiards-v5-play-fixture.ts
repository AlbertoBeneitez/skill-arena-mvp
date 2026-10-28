/** Test-only player for Billiards V5: tries ghost-ball shots at its own balls (or the 8) and keeps the first legal pot. */
import { applyCoreInput, stepCore } from "../lib/verified/coreRuntime.v1";
import type { ReplayInput } from "../lib/verified/inputValidation";
import { BILLIARDS_POCKETS } from "../lib/verified/billiardsCore.v1";
import { BILLIARDS_CORE_V5 as core, isSolid, isStripe, type BilliardsV5State } from "../lib/verified/billiardsCore.v5";
import { billiardsAimAction } from "../lib/verified/billiardsProtocol.v1";
import { billiardsPowerActionV3 } from "../lib/verified/billiardsCore.v3";

const clone = (s: BilliardsV5State): BilliardsV5State => JSON.parse(JSON.stringify(s));
export const aimTowards = (from: { x: number; y: number }, to: { x: number; y: number }) =>
  ((Math.round((Math.atan2(to.y - from.y, to.x - from.x) * 180) / (Math.PI * 2)) % 180) + 180) % 180;
function simulate(s: BilliardsV5State, aim: number, power: number) {
  const c = clone(s);
  c.aim = aim; c.power = power;
  applyCoreInput(core, c, "SHOOT", 1e9);
  while (c.status === "running" && c.phase === "moving") stepCore(core, c, 1e9);
  return c;
}
function choose(s: BilliardsV5State) {
  const cue = s.balls[0];
  const own = s.group === "solids" ? isSolid : s.group === "stripes" ? isStripe : (id: number) => id !== 8;
  const targets = s.balls.filter((b) => !b.potted && b.id !== 0 && (s.ownDown === 7 ? b.id === 8 : own(b.id)));
  let fallback = { aim: s.aim, power: 9, gain: -1e9 };
  for (const t of targets) for (let p = 0; p < BILLIARDS_POCKETS.length; p++) {
    const pk = BILLIARDS_POCKETS[s.ownDown === 7 ? s.eightPocket : p];
    const d = Math.hypot(pk.x - t.x, pk.y - t.y) || 1;
    const ghost = { x: t.x - ((pk.x - t.x) / d) * 20000, y: t.y - ((pk.y - t.y) / d) * 20000 };
    const aim = aimTowards(cue, ghost);
    for (const power of [5, 9]) {
      const c = simulate(s, aim, power);
      const gain = c.status === "failed" && c.failure !== "SHOTS_EXHAUSTED" ? -1e6 : c.score - s.score + (c.status === "won" ? 1e5 : 0);
      if (gain > 0) return { aim, power };
      if (gain > fallback.gain) fallback = { aim, power, gain };
    }
    if (s.ownDown === 7) break;
  }
  return fallback;
}
export function playBilliardsV5(seed: string, target = 1e9, maxShots = 24) {
  const s = core.create(seed), inputs: ReplayInput[] = [];
  const send = (a: string) => { if (core.canApply(s, a)) { inputs.push({ seq: inputs.length, tick: s.tick, action: a }); applyCoreInput(core, s, a, target); } };
  let shots = 0, queue: string[] = [];
  while (s.status === "running") {
    // One input per tick (the replay contract): aim, then power, then the shot.
    if (s.phase === "aim" && !queue.length && shots < maxShots) {
      const shot = shots === 0 ? { aim: 135, power: 12 } : choose(s);
      queue = [billiardsAimAction(shot.aim), billiardsPowerActionV3(shot.power), "SHOOT"].filter((a) => core.canApply(s, a) || a === "SHOOT");
      shots++;
    }
    if (s.phase === "aim" && queue.length) send(queue.shift()!);
    if (s.status === "running") stepCore(core, s, target);
  }
  return { s, inputs };
}
