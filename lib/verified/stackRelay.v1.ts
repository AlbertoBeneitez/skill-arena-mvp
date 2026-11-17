/**
 * Group relay ("juego grupal") on Stack — rules v1 (owner request, 17-nov-2026). The members of a group build ONE
 * tower together, one turn at a time: each turn continues the very same run (same seed, every earlier drop replayed)
 * and places up to `blocksPerTurn` blocks. The relay ends when a drop misses (or the run idles out). The group result
 * is the tower; each member's points are the blocks they placed (a competitive mode will come later).
 *
 * Pure TypeScript: no clock, no randomness, no DOM. The server replays the whole log for every turn; the browser uses
 * the same functions to rebuild the tower before a turn.
 *
 * A turn is valid when its drops come after the previous turn's last tick and its final tick is either
 *  - the tick the next block appears after the turn's last placement (exactly `blocksPerTurn` placed), or
 *  - the tick the run ended (a missed drop or idling out), with fewer blocks placed.
 */
import { STACK_3D_CORE, type Stack3DState } from "./precisionStackCore.v4";
import { applyCoreInput, stepCore, type GameCore } from "./coreRuntime.v1";
import { validateInputSequence, type ReplayInput } from "./inputValidation";

export const STACK_RELAY_RULES_V1 = Object.freeze({
  version: "stack-relay-v1",
  gameId: "precision-stack",
  gameVersion: STACK_3D_CORE.gameVersion,
  /** Blocks per turn the creator can choose. */
  blocksPerTurnOptions: [3, 5, 10] as const,
  defaultBlocksPerTurn: 5,
  /** Simulation time one whole relay may use (one hour of play) and drops it may hold. */
  maxFinalTick: 120 * 60 * 60,
  maxInputs: 3000,
  /** Wall time a turn stays reserved for the player who started it: 60 s + 15 s per block. */
  leaseBaseMs: 60_000,
  leasePerBlockMs: 15_000,
  /** Grace after the lease for a turn already played to arrive. */
  submitGraceMs: 10_000,
  /** A turn cannot have been played faster than real time: wall time ≥ simulated time × 0.9 − 1 s. */
  realTimeRatio: 0.9,
  realTimeSlackMs: 1_000,
});
export type StackRelayRules = typeof STACK_RELAY_RULES_V1;
export const relayLeaseMs = (blocksPerTurn: number) => STACK_RELAY_RULES_V1.leaseBaseMs + STACK_RELAY_RULES_V1.leasePerBlockMs * blocksPerTurn;
export const isRelayBlocksPerTurn = (n: unknown): n is 3 | 5 | 10 => STACK_RELAY_RULES_V1.blocksPerTurnOptions.includes(n as 3);

/** The Stack core with the relay's time and input budget (same physics, same scoring). */
export const STACK_RELAY_CORE: GameCore<Stack3DState> = Object.freeze({
  ...STACK_3D_CORE,
  maxFinalTick: STACK_RELAY_RULES_V1.maxFinalTick,
  maxInputs: STACK_RELAY_RULES_V1.maxInputs,
});

export type RelayInput = { tick: number; action: "DROP" };
export type RelayRebuild = { ok: true; state: Stack3DState } | { ok: false; error: string };

/** Rebuilds the tower: every committed drop replayed from the seed up to `finalTick`. */
export function rebuildRelay(seed: string, inputs: readonly RelayInput[], finalTick: number): RelayRebuild {
  const seq: ReplayInput[] = inputs.map((x, i) => ({ seq: i, tick: x.tick, action: x.action }));
  const error = validateInputSequence(seq, finalTick, {
    version: STACK_RELAY_CORE.inputVersion, allowedActions: STACK_RELAY_CORE.actions,
    maxInputs: STACK_RELAY_CORE.maxInputs, maxFinalTick: STACK_RELAY_CORE.maxFinalTick,
  });
  if (error) return { ok: false, error };
  const state = STACK_RELAY_CORE.create(seed);
  let index = 0;
  while (true) {
    if (index < seq.length && seq[index].tick === state.tick) {
      if (!applyCoreInput(STACK_RELAY_CORE, state, seq[index].action, Number.MAX_SAFE_INTEGER)) return { ok: false, error: "ACTION_NOT_AVAILABLE" };
      index += 1;
    }
    if (state.status !== "running" || state.tick >= finalTick) break;
    stepCore(STACK_RELAY_CORE, state, Number.MAX_SAFE_INTEGER);
  }
  if (index !== seq.length) return { ok: false, error: "UNCONSUMED_INPUTS" };
  if (state.tick !== finalTick) return { ok: false, error: "FINAL_TICK_AFTER_RESOLUTION" };
  return { ok: true, state };
}

export type RelayTurnCheck =
  | { ok: true; state: Stack3DState; placed: number; ended: boolean; inputs: RelayInput[] }
  | { ok: false; error: string };

/**
 * Checks one turn against the committed log. `turnInputs` are the turn's drops (absolute ticks). Returns the full new
 * log and the state at the end of the turn.
 */
export function checkRelayTurn(args: {
  seed: string; committed: readonly RelayInput[]; committedFinalTick: number; blocksPerTurn: number;
  turnInputs: readonly RelayInput[]; finalTick: number;
}): RelayTurnCheck {
  const { seed, committed, committedFinalTick, blocksPerTurn, turnInputs, finalTick } = args;
  if (!isRelayBlocksPerTurn(blocksPerTurn)) return { ok: false, error: "INVALID_BLOCKS_PER_TURN" };
  if (!Array.isArray(turnInputs) || turnInputs.some((x) => !x || x.action !== "DROP" || !Number.isInteger(x.tick))) return { ok: false, error: "INVALID_INPUT" };
  if (!turnInputs.length) return { ok: false, error: "EMPTY_TURN" };
  if (turnInputs[0].tick < committedFinalTick) return { ok: false, error: "INPUT_BEFORE_TURN" };
  if (turnInputs.length > blocksPerTurn) return { ok: false, error: "TOO_MANY_DROPS" };
  const before = rebuildRelay(seed, committed, committedFinalTick);
  if (!before.ok) return { ok: false, error: `COMMITTED_${before.error}` };
  if (before.state.status !== "running") return { ok: false, error: "RELAY_ENDED" };
  const inputs = [...committed, ...turnInputs.map((x) => ({ tick: x.tick, action: "DROP" as const }))];
  const after = rebuildRelay(seed, inputs, finalTick);
  if (!after.ok) return { ok: false, error: after.error };
  const s = after.state, placed = s.height - before.state.height;
  if (s.status !== "running") return { ok: true, state: s, placed, ended: true, inputs };
  // Still running: exactly blocksPerTurn placed and the turn closes as the next block appears.
  if (placed !== blocksPerTurn) return { ok: false, error: "TURN_NOT_FINISHED" };
  if (s.phase !== "moving" || s.movingAgeTicks !== 0) return { ok: false, error: "TURN_END_NOT_AT_HANDOVER" };
  return { ok: true, state: s, placed, ended: false, inputs };
}

/** Wall-time check for a submitted turn: it cannot have been played faster than real time. */
export function relayPlayedInRealTime(simTicks: number, wallMs: number) {
  const simMs = (simTicks * 1000) / STACK_RELAY_CORE.tickRate;
  return wallMs >= simMs * STACK_RELAY_RULES_V1.realTimeRatio - STACK_RELAY_RULES_V1.realTimeSlackMs;
}

/** Group score shown for a relay tower (the Stack score: height first, then stacked surface). */
export const relayScore = (s: Pick<Stack3DState, "score">) => s.score;
