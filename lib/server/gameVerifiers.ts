import { getGameDefinition, type GameId } from "@/lib/games";
import type { MatchManifest } from "@/lib/verified/contracts";
import type { ReplayInput } from "@/lib/verified/inputValidation";
import {
  replayTowerDrop,
  TOWER_DROP_V2,
  TOWER_DROP_V2_CONTENT,
  type TowerDropInput,
} from "@/lib/verified/towerDropCore.v2";
import {
  PRECISION_STACK_V1,
  PRECISION_STACK_V1_CONTENT,
  replayPrecisionStack,
  type PrecisionStackInput,
} from "@/lib/verified/precisionStackCore.v1";

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

const towerDropAdapter: VerifiedGameAdapter = {
  gameId: "tower-drop",
  gameVersion: "2.1.0",
  engineVersion: "skill-core-2",
  simulation: {
    tickRate: TOWER_DROP_V2.tickRate,
    coordinateWidth: TOWER_DROP_V2.widthMilli / 1000,
    coordinateHeight: 620,
    endCondition: "FIRST_FAILURE_OR_TARGET",
    maxFinalTick: TOWER_DROP_V2.tickRate * 60 * 15,
  },
  inputProtocol: {
    version: 2,
    allowedActions: ["DROP"],
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

const precisionStackAdapter: VerifiedGameAdapter = {
  gameId: "precision-stack",
  gameVersion: "1.0.0",
  engineVersion: "skill-core-1",
  simulation: {
    tickRate: PRECISION_STACK_V1.tickRate,
    coordinateWidth: PRECISION_STACK_V1.widthMilli / 1000,
    coordinateHeight: PRECISION_STACK_V1.coordinateHeight,
    endCondition: "FIRST_FAILURE_OR_TARGET",
    maxFinalTick: PRECISION_STACK_V1.tickRate * 60 * 15,
  },
  inputProtocol: {
    version: 1,
    allowedActions: ["DROP"],
    maxInputs: PRECISION_STACK_V1.maxInputs,
  },
  rulesDescriptor: {
    endCondition: "FIRST_FAILURE_OR_TARGET",
    scoringAuthority: "SERVER_REPLAY_ONLY",
    inputClock: "SIMULATION_TICKS",
  },
  gameplayContentDescriptor: PRECISION_STACK_V1_CONTENT,
  replay({ inputs, finalTick, manifest }) {
    const replay = replayPrecisionStack(
      inputs as PrecisionStackInput[],
      finalTick,
      manifest.seed,
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

function adapterKey(gameId: string, gameVersion: string) {
  return `${gameId}@${gameVersion}`;
}

/**
 * Historical competitive adapters are append-only.
 *
 * The public registry exposes the current version of a game. This server-only
 * archive keeps every frozen competitive version required to reproduce old
 * manifests after the current version advances.
 */
const SERVER_GAME_ADAPTERS: Record<string, VerifiedGameAdapter> = {
  [adapterKey(towerDropAdapter.gameId, towerDropAdapter.gameVersion)]:
    towerDropAdapter,
  [adapterKey(precisionStackAdapter.gameId, precisionStackAdapter.gameVersion)]:
    precisionStackAdapter,
};

export function getServerGameAdapter(
  gameId: string,
  gameVersion?: string
): VerifiedGameAdapter | undefined {
  const version =
    gameVersion ?? getGameDefinition(gameId)?.version;
  if (!version) return undefined;

  return SERVER_GAME_ADAPTERS[adapterKey(gameId, version)];
}
