import {
  JET_STREAM_CORE_V4 as core,
  type JetStreamV4State,
} from "../lib/verified/jetStreamCore.v4";
import { JET_STREAM_V1 } from "../lib/verified/jetStreamCore.v1";
import { stepCore } from "../lib/verified/coreRuntime.v1";

const decisionTicks = new WeakMap<JetStreamV4State, number>();
type Plan = { state: JetStreamV4State; cost: number; firstFlap: boolean };

function snapshot(state: JetStreamV4State): JetStreamV4State {
  // Flight fields are scalars. Gates own their mutable pass/damage/pickup flags;
  // already-prepared windows are immutable and safe to share between test plans.
  return { ...state, gates: state.gates.map((gate) => ({ ...gate })) };
}

function routeCost(state: JetStreamV4State) {
  const gate = state.gates.find(
    (g) =>
      g.worldXMilli - state.scrollMilli + JET_STREAM_V1.gateWidth >=
      JET_STREAM_V1.playerX - JET_STREAM_V1.playerRadius,
  );
  if (!gate) return 0;
  const distance = Math.min(
    ...gate.windows.map((w) => Math.abs(state.yMilli - w.centerYMilli)),
  );
  return (distance * distance) / 1000000;
}

/** Test-only public-course steering; competitive rules never depend on this player. */
export function shouldFlapJetV4(state: JetStreamV4State) {
  if (!core.canApply(state, "FLAP")) return false;
  if (state.launchedAtTick === null) return state.tick >= 240;
  if (state.tick < (decisionTicks.get(state) ?? 0)) return false;
  decisionTicks.set(state, state.tick + 6);
  // Anticipate a rising/falling next corridor through the actual shared core.
  // This is a bounded test player, not another integrator or game engine.
  let plans: Plan[] = [{ state, cost: 0, firstFlap: false }];
  for (let depth = 0; depth < 14; depth++) {
    const next: Plan[] = [];
    for (const plan of plans) {
      for (const flap of [false, true]) {
        if (flap && !core.canApply(plan.state, "FLAP")) continue;
        const candidate = snapshot(plan.state);
        if (flap) core.apply(candidate, "FLAP");
        for (let tick = 0; tick < 12 && candidate.status === "running"; tick++)
          stepCore(core, candidate, 1e6);
        const cost =
          plan.cost +
          routeCost(candidate) +
          (flap ? 4 : 0) +
          (candidate.lives < plan.state.lives ? 1e8 : 0) +
          (candidate.status === "failed" ? 1e12 : 0);
        next.push({
          state: candidate,
          cost,
          firstFlap: depth === 0 ? flap : plan.firstFlap,
        });
      }
    }
    next.sort((a, b) => a.cost - b.cost);
    plans = next.slice(0, 12);
  }
  return plans[0]?.firstFlap ?? false;
}
