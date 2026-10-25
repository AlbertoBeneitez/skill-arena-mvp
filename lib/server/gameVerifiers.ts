import { ROULETTE_CORE_V5 } from "../verified/galacticRouletteCore.v5";
import { ROULETTE_CORE_V6 } from "../verified/galacticRouletteCore.v6";
import { ROULETTE_CORE_V7 } from "../verified/galacticRouletteCore.v7";
import { ROULETTE_CORE_V8 } from "../verified/galacticRouletteCore.v8";
import { ROULETTE_CORE_V4 } from "../verified/galacticRouletteCore.v4";
import { ROULETTE_CORE_V3 } from "../verified/galacticRouletteCore.v3";
import { SLOT_CORE_V2 } from "../verified/galacticSlotCore.v2";
import { SLOT_CORE_V3 } from "../verified/galacticSlotCore.v3";
import { BILLIARDS_CORE_V3 } from "../verified/billiardsCore.v3";
import { BILLIARDS_CORE_V4 } from "../verified/billiardsCore.v4";
import { ROULETTE_CORE_V2 } from "../verified/galacticRouletteCore.v2";
import { ROULETTE_CORE } from "../verified/galacticRouletteCore.v1";
import { SLOT_CORE } from "../verified/galacticSlotCore.v1";
import { MEMORY_CORE } from "../verified/memoryMatchCore.v1";
import { MEMORY_CORE as MEMORY_CORE_V2 } from "../verified/memoryMatchCore.v2";
import { STACK_SHIFT_CORE } from "../verified/stackShiftCore.v1";
import { STACK_SHIFT_CORE_V2 } from "../verified/stackShiftCore.v2";
import { PINBALL_CORE_V1 } from "../verified/pinballCore.v1";
import { PINBALL_CORE_V2 } from "../verified/pinballCore.v2";
import { PINBALL_CORE_V3 } from "../verified/pinballCore.v3";
import { PINBALL_CORE_V4 } from "../verified/pinballCore.v4";
import { CORNER_SUDOKU_CORE_V1 } from "../verified/cornerSudokuCore.v1";
import { STACK_SHIFT_CORE_V3 } from "../verified/stackShiftCore.v3";
import { SHOT_GALLERY_CORE_V2 } from "../verified/shotGalleryCore.v2";
import { SHOT_GALLERY_CORE } from "../verified/shotGalleryCore.v1";
import { SHOT_GALLERY_CORE_V3 } from "../verified/shotGalleryCore.v3";
import { SHOT_GALLERY_CORE_V4 } from "../verified/shotGalleryCore.v4";
import { SHOT_GALLERY_CORE_V5 } from "../verified/shotGalleryCore.v5";
import { SHOT_GALLERY_CORE_V6 } from "../verified/shotGalleryCore.v6";
import { SHOT_GALLERY_CORE_V7 } from "../verified/shotGalleryCore.v7";
import { DARTS_CORE_V3 } from "../verified/dartsCore.v3";
import { DARTS_CORE_V2 } from "../verified/dartsCore.v2";
import { DARTS_CORE } from "../verified/dartsCore.v1";
import { BILLIARDS_CORE } from "../verified/billiardsCore.v1";
import { BILLIARDS_CORE_V2 } from "../verified/billiardsCore.v2";
import { MINE_GRID_CORE } from "../verified/mineGridCore.v1";
import { MINE_GRID_CORE_V2 } from "../verified/mineGridCore.v2";
import { ORB_BURST_CORE } from "../verified/orbBurstCore.v1";
import { ORB_BURST_CORE_V2 } from "../verified/orbBurstCore.v2";
import { ORB_BURST_CORE_V3 } from "../verified/orbBurstCore.v3";
import { ORB_BURST_CORE_V4 } from "../verified/orbBurstCore.v4";
import { ORB_BURST_CORE_V5 } from "../verified/orbBurstCore.v5";
import { getGameDefinition, type GameId } from "@/lib/games";
import { coreAdapter } from "./coreAdapter";
import { TOWER_DROP_CORE_V3 } from "../verified/towerDropCore.v3";
import { TOWER_DROP_CORE_V4 } from "../verified/towerDropCore.v4";
import { STACK_3D_CORE } from "../verified/precisionStackCore.v4";
import { STACK_3D_CORE as STACK_3D_CORE_V3 } from "../verified/precisionStackCore.v3";
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
  replayPrecisionStack as replayPrecisionStackV1,
  type PrecisionStackInput as PrecisionStackInputV1,
} from "@/lib/verified/precisionStackCore.v1";
import {
  PRECISION_STACK_V2,
  PRECISION_STACK_V2_CONTENT,
  replayPrecisionStack as replayPrecisionStackV2,
  type PrecisionStackInput as PrecisionStackInputV2,
} from "@/lib/verified/precisionStackCore.v2";
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

const precisionStackV1Adapter: VerifiedGameAdapter = {
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
    const replay = replayPrecisionStackV1(
      inputs as PrecisionStackInputV1[],
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

const precisionStackV2Adapter: VerifiedGameAdapter = {
  gameId: "precision-stack",
  gameVersion: "2.0.0",
  engineVersion: "skill-core-2",
  simulation: {
    tickRate: PRECISION_STACK_V2.tickRate,
    coordinateWidth: PRECISION_STACK_V2.widthMilli / 1000,
    coordinateHeight: PRECISION_STACK_V2.coordinateHeight,
    endCondition: "FIRST_FAILURE_OR_TARGET",
    maxFinalTick: PRECISION_STACK_V2.tickRate * 60 * 15,
  },
  inputProtocol: {
    version: PRECISION_STACK_V2.inputProtocolVersion,
    allowedActions: ["DROP"],
    maxInputs: PRECISION_STACK_V2.maxInputs,
  },
  rulesDescriptor: {
    endCondition: "FIRST_FAILURE_OR_TARGET",
    scoringAuthority: "SERVER_REPLAY_ONLY",
    inputClock: "SIMULATION_TICKS",
  },
  gameplayContentDescriptor: PRECISION_STACK_V2_CONTENT,
  replay({ inputs, finalTick, manifest }) {
    const replay = replayPrecisionStackV2(
      inputs as PrecisionStackInputV2[],
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
  [adapterKey(ROULETTE_CORE.gameId, ROULETTE_CORE.gameVersion)]: coreAdapter(ROULETTE_CORE),
  [adapterKey(ROULETTE_CORE_V4.gameId,ROULETTE_CORE_V4.gameVersion)]: coreAdapter(ROULETTE_CORE_V4),
  [adapterKey(ROULETTE_CORE_V5.gameId,ROULETTE_CORE_V5.gameVersion)]: coreAdapter(ROULETTE_CORE_V5),
  [adapterKey(ROULETTE_CORE_V6.gameId,ROULETTE_CORE_V6.gameVersion)]: coreAdapter(ROULETTE_CORE_V6),
  [adapterKey(ROULETTE_CORE_V7.gameId,ROULETTE_CORE_V7.gameVersion)]: coreAdapter(ROULETTE_CORE_V7),
  [adapterKey(ROULETTE_CORE_V8.gameId,ROULETTE_CORE_V8.gameVersion)]: coreAdapter(ROULETTE_CORE_V8),
  [adapterKey(ROULETTE_CORE_V3.gameId,ROULETTE_CORE_V3.gameVersion)]: coreAdapter(ROULETTE_CORE_V3),
  [adapterKey(ROULETTE_CORE_V2.gameId, ROULETTE_CORE_V2.gameVersion)]: coreAdapter(ROULETTE_CORE_V2),
  [adapterKey(SLOT_CORE_V2.gameId,SLOT_CORE_V2.gameVersion)]: coreAdapter(SLOT_CORE_V2),
  [adapterKey(SLOT_CORE_V3.gameId,SLOT_CORE_V3.gameVersion)]: coreAdapter(SLOT_CORE_V3),
  [adapterKey(SLOT_CORE.gameId, SLOT_CORE.gameVersion)]: coreAdapter(SLOT_CORE),
  [adapterKey(MEMORY_CORE.gameId, MEMORY_CORE.gameVersion)]: coreAdapter(MEMORY_CORE),
  [adapterKey(MEMORY_CORE_V2.gameId, MEMORY_CORE_V2.gameVersion)]: coreAdapter(MEMORY_CORE_V2),
  [adapterKey(STACK_SHIFT_CORE.gameId, STACK_SHIFT_CORE.gameVersion)]: coreAdapter(STACK_SHIFT_CORE),
  [adapterKey(STACK_SHIFT_CORE_V2.gameId, STACK_SHIFT_CORE_V2.gameVersion)]: coreAdapter(STACK_SHIFT_CORE_V2),
  [adapterKey(PINBALL_CORE_V1.gameId, PINBALL_CORE_V1.gameVersion)]: coreAdapter(PINBALL_CORE_V1),
  [adapterKey(PINBALL_CORE_V2.gameId, PINBALL_CORE_V2.gameVersion)]: coreAdapter(PINBALL_CORE_V2),
  [adapterKey(PINBALL_CORE_V3.gameId, PINBALL_CORE_V3.gameVersion)]: coreAdapter(PINBALL_CORE_V3),
  [adapterKey(PINBALL_CORE_V4.gameId, PINBALL_CORE_V4.gameVersion)]: coreAdapter(PINBALL_CORE_V4),
  [adapterKey(CORNER_SUDOKU_CORE_V1.gameId, CORNER_SUDOKU_CORE_V1.gameVersion)]: coreAdapter(CORNER_SUDOKU_CORE_V1),
  [adapterKey(STACK_SHIFT_CORE_V3.gameId, STACK_SHIFT_CORE_V3.gameVersion)]: coreAdapter(STACK_SHIFT_CORE_V3),
  [adapterKey(SHOT_GALLERY_CORE.gameId,SHOT_GALLERY_CORE.gameVersion)]: coreAdapter(SHOT_GALLERY_CORE),
  [adapterKey(SHOT_GALLERY_CORE_V2.gameId,SHOT_GALLERY_CORE_V2.gameVersion)]: coreAdapter(SHOT_GALLERY_CORE_V2),
  [adapterKey(SHOT_GALLERY_CORE_V3.gameId,SHOT_GALLERY_CORE_V3.gameVersion)]: coreAdapter(SHOT_GALLERY_CORE_V3),
  [adapterKey(SHOT_GALLERY_CORE_V4.gameId,SHOT_GALLERY_CORE_V4.gameVersion)]: coreAdapter(SHOT_GALLERY_CORE_V4),
  [adapterKey(SHOT_GALLERY_CORE_V5.gameId,SHOT_GALLERY_CORE_V5.gameVersion)]: coreAdapter(SHOT_GALLERY_CORE_V5),
  [adapterKey(SHOT_GALLERY_CORE_V6.gameId,SHOT_GALLERY_CORE_V6.gameVersion)]: coreAdapter(SHOT_GALLERY_CORE_V6),
  [adapterKey(SHOT_GALLERY_CORE_V7.gameId,SHOT_GALLERY_CORE_V7.gameVersion)]: coreAdapter(SHOT_GALLERY_CORE_V7),
  [adapterKey(DARTS_CORE.gameId,DARTS_CORE.gameVersion)]: coreAdapter(DARTS_CORE),
  [adapterKey(DARTS_CORE_V2.gameId,DARTS_CORE_V2.gameVersion)]: coreAdapter(DARTS_CORE_V2),
  [adapterKey(DARTS_CORE_V3.gameId,DARTS_CORE_V3.gameVersion)]: coreAdapter(DARTS_CORE_V3),
  [adapterKey(BILLIARDS_CORE.gameId,BILLIARDS_CORE.gameVersion)]: coreAdapter(BILLIARDS_CORE),
  [adapterKey(BILLIARDS_CORE_V3.gameId,BILLIARDS_CORE_V3.gameVersion)]: coreAdapter(BILLIARDS_CORE_V3),
  [adapterKey(BILLIARDS_CORE_V4.gameId,BILLIARDS_CORE_V4.gameVersion)]: coreAdapter(BILLIARDS_CORE_V4),
  [adapterKey(BILLIARDS_CORE_V2.gameId,BILLIARDS_CORE_V2.gameVersion)]: coreAdapter(BILLIARDS_CORE_V2),
  [adapterKey(MINE_GRID_CORE.gameId,MINE_GRID_CORE.gameVersion)]: coreAdapter(MINE_GRID_CORE),
  [adapterKey(MINE_GRID_CORE_V2.gameId,MINE_GRID_CORE_V2.gameVersion)]: coreAdapter(MINE_GRID_CORE_V2),
  [adapterKey(ORB_BURST_CORE.gameId,ORB_BURST_CORE.gameVersion)]: coreAdapter(ORB_BURST_CORE),
  [adapterKey(ORB_BURST_CORE_V2.gameId,ORB_BURST_CORE_V2.gameVersion)]: coreAdapter(ORB_BURST_CORE_V2),
  [adapterKey(ORB_BURST_CORE_V3.gameId,ORB_BURST_CORE_V3.gameVersion)]: coreAdapter(ORB_BURST_CORE_V3),
  [adapterKey(ORB_BURST_CORE_V4.gameId,ORB_BURST_CORE_V4.gameVersion)]: coreAdapter(ORB_BURST_CORE_V4),
  [adapterKey(ORB_BURST_CORE_V5.gameId,ORB_BURST_CORE_V5.gameVersion)]: coreAdapter(ORB_BURST_CORE_V5),
  [adapterKey(TOWER_DROP_CORE_V3.gameId,TOWER_DROP_CORE_V3.gameVersion)]: coreAdapter(TOWER_DROP_CORE_V3),
  [adapterKey(TOWER_DROP_CORE_V4.gameId,TOWER_DROP_CORE_V4.gameVersion)]: coreAdapter(TOWER_DROP_CORE_V4),
  [adapterKey(STACK_3D_CORE.gameId, STACK_3D_CORE.gameVersion)]: coreAdapter(STACK_3D_CORE),
  [adapterKey(STACK_3D_CORE_V3.gameId, STACK_3D_CORE_V3.gameVersion)]: coreAdapter(STACK_3D_CORE_V3),
  [adapterKey(towerDropAdapter.gameId, towerDropAdapter.gameVersion)]:
    towerDropAdapter,
  [adapterKey(precisionStackV1Adapter.gameId, precisionStackV1Adapter.gameVersion)]:
    precisionStackV1Adapter,
  [adapterKey(precisionStackV2Adapter.gameId, precisionStackV2Adapter.gameVersion)]:
    precisionStackV2Adapter,
};

function assertCurrentAdapterContract(
  adapter: VerifiedGameAdapter
) {
  const definition = getGameDefinition(adapter.gameId);

  // Historical adapters intentionally outlive the current catalogue version.
  if (!definition || definition.version !== adapter.gameVersion) {
    return;
  }

  const competition = definition.competition;
  const sameActions =
    competition.verification === "server-replay" &&
    competition.allowedActions.length ===
      adapter.inputProtocol.allowedActions.length &&
    competition.allowedActions.every(
      (action, index) =>
        action === adapter.inputProtocol.allowedActions[index]
    );

  if (
    competition.verification !== "server-replay" ||
    competition.engineVersion !== adapter.engineVersion ||
    competition.inputProtocolVersion !==
      adapter.inputProtocol.version ||
    !sameActions
  ) {
    throw new Error(
      `Verified adapter contract drift: ${adapter.gameId}@${adapter.gameVersion}`
    );
  }
}

Object.values(SERVER_GAME_ADAPTERS).forEach(
  assertCurrentAdapterContract
);

export function getServerGameAdapter(
  gameId: string,
  gameVersion?: string
): VerifiedGameAdapter | undefined {
  const version =
    gameVersion ?? getGameDefinition(gameId)?.version;
  if (!version) return undefined;

  return SERVER_GAME_ADAPTERS[adapterKey(gameId, version)];
}
