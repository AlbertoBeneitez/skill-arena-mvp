import { getGameDefinition, type GameId } from "@/lib/games";
import type { MatchManifest } from "@/lib/verified/contracts";
import type { ReplayInput } from "@/lib/verified/inputValidation";
import {
  replayTowerDrop,
  TOWER_DROP_V2,
  TOWER_DROP_V2_CONTENT,
  type TowerDropInput,
} from "@/lib/verified/towerDropCore.v2";

export type ServerReplayResult = {
  valid: boolean;
  error?: string;
  score: number;
  timeMs: number;
  won: boolean;
  height?: number;
  failure?: string | null;
};

export type VerifiedGameAdapter = {
  gameId: GameId;
  gameVersion: string;
  engineVersion: string;
  simulation: {
    tickRate: number;
    coordinateWidth: number;
    coordinateHeight: number;
    endCondition: string;
    maxFinalTick: number;
  };
  inputProtocol: {
    version: number;
    allowedActions: readonly string[];
    maxInputs: number;
  };
  rulesDescriptor: unknown;
  gameplayContentDescriptor: unknown;
  replay(args: {
    inputs: ReplayInput[];
    finalTick: number;
    manifest: MatchManifest;
  }): ServerReplayResult;
};

function registeredServerReplayGame(gameId: GameId) {
  const definition = getGameDefinition(gameId);
  if (
    !definition ||
    definition.competition.verification !== "server-replay"
  ) {
    throw new Error(`Game ${gameId} is not registered for server replay`);
  }
  return definition;
}

const towerDropDefinition = registeredServerReplayGame("tower-drop");

const towerDropAdapter: VerifiedGameAdapter = {
  gameId: "tower-drop",
  gameVersion: towerDropDefinition.version,
  engineVersion: towerDropDefinition.competition.engineVersion,
  simulation: {
    tickRate: TOWER_DROP_V2.tickRate,
    coordinateWidth: TOWER_DROP_V2.widthMilli / 1000,
    coordinateHeight: 620,
    endCondition: "FIRST_FAILURE_OR_TARGET",
    maxFinalTick: TOWER_DROP_V2.tickRate * 60 * 15,
  },
  inputProtocol: {
    version: towerDropDefinition.competition.inputProtocolVersion,
    allowedActions: towerDropDefinition.competition.allowedActions,
    maxInputs: 500,
  },
  rulesDescriptor: {
    endCondition: "FIRST_FAILURE_OR_TARGET",
    scoringAuthority: "SERVER_REPLAY_ONLY",
    inputClock: "SIMULATION_TICKS",
  },
  gameplayContentDescriptor: TOWER_DROP_V2_CONTENT,
  replay({ inputs, finalTick, manifest }) {
    const replay = replayTowerDrop(
      inputs as TowerDropInput[],
      finalTick,
      manifest.competition.target_score
    );

    return {
      valid: replay.valid,
      error: replay.error,
      score: replay.score,
      timeMs: replay.timeMs,
      won: replay.state.status === "won",
      height: replay.height,
      failure: replay.failure,
    };
  },
};

const SERVER_GAME_ADAPTERS: Partial<Record<GameId, VerifiedGameAdapter>> = {
  "tower-drop": towerDropAdapter,
};

export function getServerGameAdapter(gameId: string) {
  return SERVER_GAME_ADAPTERS[gameId as GameId];
}
