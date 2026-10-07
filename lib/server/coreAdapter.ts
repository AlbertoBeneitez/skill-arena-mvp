import { CORE_RUNTIME_V1, replayCore, type CoreState, type GameCore } from "../verified/coreRuntime.v1";
import type { VerifiedGameAdapter } from "./gameVerifiers";

/** Extend the existing append-only adapter registry; no second verifier. */
export function coreAdapter<S extends CoreState>(core: GameCore<S>): VerifiedGameAdapter {
  return {
    gameId: core.gameId, gameVersion: core.gameVersion,
    engineVersion: CORE_RUNTIME_V1.engineVersion,
    simulation: {
      tickRate: core.tickRate, coordinateWidth: core.width, coordinateHeight: core.height,
      endCondition: CORE_RUNTIME_V1.endCondition, maxFinalTick: core.maxFinalTick,
    },
    inputProtocol: { version: core.inputVersion, allowedActions: core.actions, maxInputs: core.maxInputs },
    rulesDescriptor: CORE_RUNTIME_V1,
    gameplayContentDescriptor: { runtime: CORE_RUNTIME_V1, game: core.content },
    replay: ({ inputs, finalTick, manifest }) => replayCore(core, inputs, finalTick, manifest.seed, manifest.competition.target_score),
  };
}
