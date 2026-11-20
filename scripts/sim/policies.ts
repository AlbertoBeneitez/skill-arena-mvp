/**
 * Bot simulator · how a bot plays one match on the real, frozen core (the same code the server replays).
 *
 * Inputs are built tick by tick exactly as a phone records them: one action per tick at most, in order, each one
 * accepted by the core at that moment. Three styles:
 *  - novice: slow, random "moves" (set a value, then commit: aim + throw, angle + roll…);
 *  - medium: human-like pace, picks the best of a few tried moves looking a little ahead;
 *  - expert: the cheat any client can do today. It knows the seed from the manifest, so it tries many moves on a
 *    copy of the game and keeps the best one, with human-looking delays. Nothing in the replay can tell.
 * Presentation-free and deterministic for a given bot seed.
 */
import { applyCoreInput, stepCore, type CoreState } from "@/lib/verified/coreRuntime.v1";
import { createRng } from "@/lib/deterministic/seeded";
import type { ReplayInput } from "@/lib/verified/inputValidation";
import type { AnyCore } from "./cores";

export type Style = "novice" | "medium" | "expert";
export type PlayResult = { inputs: ReplayInput[]; finalTick: number; score: number; status: CoreState["status"]; failure: string | null; decisions: number; cpuMs: number };

type Rng = { next(): number };
const rngOf = (seed: string): Rng => { const r = createRng(seed); return { next: () => r.nextFloat() }; };
const pick = <T,>(rng: Rng, list: readonly T[]) => list[Math.floor(rng.next() * list.length)];

/** Families of actions: AIM_X_05 → AIM_X_#, TOSS_D03_P04 → TOSS_D#_P#. A family with one action is a "commit". */
function families(actions: readonly string[]) {
  const map = new Map<string, string[]>();
  for (const a of actions) {
    const key = a.replace(/\d+/g, "#");
    map.set(key, [...(map.get(key) ?? []), a]);
  }
  const setters = [...map.values()].filter((list) => list.length > 1);
  const commits = [...map.values()].filter((list) => list.length === 1).map((list) => list[0]);
  return { setters, commits };
}

/** A move: optional values for some setter families, then (usually) one commit. */
function randomMove(rng: Rng, fam: ReturnType<typeof families>): string[] {
  const move: string[] = [];
  for (const list of fam.setters) if (rng.next() < (fam.commits.length ? 0.85 : 0.5)) move.push(pick(rng, list));
  if (fam.commits.length && rng.next() < 0.9) move.push(pick(rng, fam.commits));
  if (!move.length) move.push(pick(rng, fam.setters.flat().length ? fam.setters.flat() : fam.commits));
  return move;
}

const SETTINGS: Record<Style, { candidates: number; horizonS: number; delayS: [number, number]; mistake: number }> = {
  novice: { candidates: 1, horizonS: 0, delayS: [0.9, 2.2], mistake: 0.35 },
  medium: { candidates: 6, horizonS: 2.5, delayS: [0.45, 1.1], mistake: 0.12 },
  expert: { candidates: 28, horizonS: 5, delayS: [0.25, 0.6], mistake: 0 },
};

/** Value of a state for the bot: its score, or the opposite where a lower score wins; a failure is penalised. */
const value = (s: CoreState, lowerWins: boolean) => (lowerWins ? -s.score : s.score) - (s.status === "failed" ? 1e6 : 0) + (s.status === "won" ? 1e5 : 0);

/** Applies a move on consecutive ticks (one input per tick, like the phone), then waits `horizon` ticks. */
function tryMove<S extends CoreState>(core: AnyCore, state: S, move: string[], horizon: number, target: number) {
  const s = structuredClone(state);
  for (const action of move) {
    if (s.status !== "running") break;
    applyCoreInput(core, s, action, target);
    stepCore(core, s, target);
  }
  for (let i = 0; i < horizon && s.status === "running"; i++) stepCore(core, s, target);
  return s;
}

export function playMatch(core: AnyCore, seed: string, style: Style, botSeed: string, lowerWins: boolean, target = Number.MAX_SAFE_INTEGER, budgetMs = 60_000): PlayResult {
  const t0 = performance.now();
  const rng = rngOf(`bot:${botSeed}:${style}`);
  const cfg = SETTINGS[style];
  const fam = families(core.actions);
  const state = core.create(seed);
  const inputs: ReplayInput[] = [];
  let decisions = 0;
  let nextDecision = Math.round(core.tickRate * (0.6 + rng.next()));
  let queue: string[] = [];
  const horizon = Math.round(cfg.horizonS * core.tickRate);
  while (state.status === "running" && state.tick < core.maxFinalTick) {
    if (!queue.length && state.tick >= nextDecision) {
      decisions++;
      const overBudget = performance.now() - t0 > budgetMs;
      let best = randomMove(rng, fam);
      if (cfg.candidates > 1 && !overBudget && rng.next() >= cfg.mistake) {
        let bestValue = value(tryMove(core, state, best, horizon, target), lowerWins);
        const waitValue = value(tryMove(core, state, [], horizon, target), lowerWins);
        for (let i = 1; i < cfg.candidates; i++) {
          const move = randomMove(rng, fam);
          const v = value(tryMove(core, state, move, horizon, target), lowerWins);
          if (v > bestValue) { best = move; bestValue = v; }
        }
        if (waitValue >= bestValue && rng.next() < 0.5) best = [];
      }
      queue = [...best];
      const [lo, hi] = cfg.delayS;
      nextDecision = state.tick + Math.max(1, Math.round(core.tickRate * (lo + (hi - lo) * rng.next())));
    }
    if (queue.length) {
      const action = queue.shift()!;
      if (applyCoreInput(core, state, action, target)) inputs.push({ seq: inputs.length, tick: state.tick, action });
      if (inputs.length >= core.maxInputs) queue = [];
    }
    stepCore(core, state, target);
  }
  return { inputs, finalTick: state.tick, score: state.score, status: state.status, failure: state.failure, decisions, cpuMs: Math.round(performance.now() - t0) };
}
