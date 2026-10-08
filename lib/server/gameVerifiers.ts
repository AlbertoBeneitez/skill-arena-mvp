import { PIANO_V2_CORE } from "../verified/pianoRushCore.v2";
import { ORBIT_CORE } from "../verified/orbitShiftCore.v1";
import { MAZE_CORE } from "../verified/mazeRushCore.v1";
import { BRICK_RELAY_CORE } from "../verified/brickRelayCore.v1";
import { METRO_CORE } from "../verified/metroShiftCore.v1";
import { SKY_HOP_CORE } from "../verified/skyHopCore.v1";
import { PHALANX_CORE } from "../verified/starPhalanxCore.v1";
import { STACK_SHIFT_CORE } from "../verified/stackShiftCore.v1";
import { JET_STREAM_CORE_V3 } from "../verified/jetStreamCore.v3";
import { ALIEN_DASH_CORE } from "../verified/alienDashCore.v2";
import { SHOT_GALLERY_CORE } from "../verified/shotGalleryCore.v1";
import { DARTS_CORE } from "../verified/dartsCore.v1";
import { BILLIARDS_CORE } from "../verified/billiardsCore.v1";
import { MINE_GRID_CORE } from "../verified/mineGridCore.v1";
import { ORB_BURST_CORE } from "../verified/orbBurstCore.v1";
import { getGameDefinition, type GameId } from "@/lib/games";
import { coreAdapter } from "./coreAdapter";
import { TOWER_DROP_CORE_V3 } from "../verified/towerDropCore.v3";
import { JET_STREAM_CORE_V2 } from "../verified/jetStreamCore.v2";
import { SERPENT_CORE } from "../verified/serpentCore.v1";
import { RIVER_DASH_CORE_V2 } from "../verified/riverDashCore.v2";
import { RIVER_DASH_CORE } from "../verified/riverDashCore.v1";
import { STACK_3D_CORE } from "../verified/precisionStackCore.v3";
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
import {
  PIANO_RUSH_ACTIONS,
  PIANO_RUSH_V1,
  PIANO_RUSH_V1_CONTENT,
  replayPianoRush,
  type PianoRushInput,
} from "@/lib/verified/pianoRushCore.v1";
import {
  JET_STREAM_ACTIONS,
  JET_STREAM_V1,
  JET_STREAM_V1_CONTENT,
  replayJetStream,
  type JetStreamInput,
} from "@/lib/verified/jetStreamCore.v1";

import {
  DINO_DASH_ACTIONS,
  DINO_DASH_V1,
  DINO_DASH_V1_CONTENT,
  replayDinoDash,
  type DinoDashInput,
} from "@/lib/verified/dinoDashCore.v1";

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

const pianoRushAdapter: VerifiedGameAdapter = {
  gameId: "piano-rush",
  gameVersion: "1.0.0",
  engineVersion: "skill-core-1",
  simulation: {
    tickRate: PIANO_RUSH_V1.tickRate,
    coordinateWidth: PIANO_RUSH_V1.coordinateWidth,
    coordinateHeight: PIANO_RUSH_V1.coordinateHeight,
    endCondition: "FIRST_MISTAKE_OR_TARGET",
    maxFinalTick: PIANO_RUSH_V1.maxFinalTick,
  },
  inputProtocol: {
    version: PIANO_RUSH_V1.inputProtocolVersion,
    allowedActions: PIANO_RUSH_ACTIONS,
    maxInputs: PIANO_RUSH_V1.maxInputs,
  },
  rulesDescriptor: {
    endCondition: "FIRST_MISTAKE_OR_TARGET",
    scoringAuthority: "SERVER_REPLAY_ONLY",
    inputClock: "SIMULATION_TICKS",
  },
  gameplayContentDescriptor: PIANO_RUSH_V1_CONTENT,
  replay({ inputs, finalTick, manifest }) {
    const replay = replayPianoRush(
      inputs as PianoRushInput[],
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
      failure: replay.failure,
    };
  },
};

const jetStreamAdapter: VerifiedGameAdapter = {
  gameId: "jet-stream",
  gameVersion: "1.0.0",
  engineVersion: "skill-core-1",
  simulation: {
    tickRate: JET_STREAM_V1.tickRate,
    coordinateWidth: JET_STREAM_V1.coordinateWidth,
    coordinateHeight: JET_STREAM_V1.coordinateHeight,
    endCondition: "FIRST_FAILURE_OR_TARGET",
    maxFinalTick: JET_STREAM_V1.maxFinalTick,
  },
  inputProtocol: {
    version: JET_STREAM_V1.inputProtocolVersion,
    allowedActions: JET_STREAM_ACTIONS,
    maxInputs: JET_STREAM_V1.maxInputs,
  },
  rulesDescriptor: {
    endCondition: "FIRST_FAILURE_OR_TARGET",
    scoringAuthority: "SERVER_REPLAY_ONLY",
    inputClock: "SIMULATION_TICKS",
  },
  gameplayContentDescriptor: JET_STREAM_V1_CONTENT,
  replay({ inputs, finalTick, manifest }) {
    const replay = replayJetStream(
      inputs as JetStreamInput[],
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
      failure: replay.failure,
    };
  },
};

const dinoDashAdapter: VerifiedGameAdapter = {
  gameId: "dino-dash",
  gameVersion: "1.0.0",
  engineVersion: "skill-core-1",
  simulation: {
    tickRate: DINO_DASH_V1.tickRate,
    coordinateWidth: DINO_DASH_V1.coordinateWidth,
    coordinateHeight: DINO_DASH_V1.coordinateHeight,
    endCondition: "FIRST_COLLISION_OR_TARGET",
    maxFinalTick: DINO_DASH_V1.maxFinalTick,
  },
  inputProtocol: {
    version: DINO_DASH_V1.inputProtocolVersion,
    allowedActions: DINO_DASH_ACTIONS,
    maxInputs: DINO_DASH_V1.maxInputs,
  },
  rulesDescriptor: {
    endCondition: "FIRST_COLLISION_OR_TARGET",
    scoringAuthority: "SERVER_REPLAY_ONLY",
    inputClock: "SIMULATION_TICKS",
  },
  gameplayContentDescriptor: DINO_DASH_V1_CONTENT,
  replay({ inputs, finalTick, manifest }) {
    const replay = replayDinoDash(
      inputs as DinoDashInput[],
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
  [adapterKey(PIANO_V2_CORE.gameId, PIANO_V2_CORE.gameVersion)]: coreAdapter(PIANO_V2_CORE),
  [adapterKey(ORBIT_CORE.gameId, ORBIT_CORE.gameVersion)]: coreAdapter(ORBIT_CORE),
  [adapterKey(MAZE_CORE.gameId, MAZE_CORE.gameVersion)]: coreAdapter(MAZE_CORE),
  [adapterKey(BRICK_RELAY_CORE.gameId, BRICK_RELAY_CORE.gameVersion)]: coreAdapter(BRICK_RELAY_CORE),
  [adapterKey(METRO_CORE.gameId, METRO_CORE.gameVersion)]: coreAdapter(METRO_CORE),
  [adapterKey(SKY_HOP_CORE.gameId, SKY_HOP_CORE.gameVersion)]: coreAdapter(SKY_HOP_CORE),
  [adapterKey(PHALANX_CORE.gameId, PHALANX_CORE.gameVersion)]: coreAdapter(PHALANX_CORE),
  [adapterKey(STACK_SHIFT_CORE.gameId, STACK_SHIFT_CORE.gameVersion)]: coreAdapter(STACK_SHIFT_CORE),
  [adapterKey(JET_STREAM_CORE_V3.gameId, JET_STREAM_CORE_V3.gameVersion)]: coreAdapter(JET_STREAM_CORE_V3),
  [adapterKey(ALIEN_DASH_CORE.gameId, ALIEN_DASH_CORE.gameVersion)]: coreAdapter(ALIEN_DASH_CORE),
  [adapterKey(SHOT_GALLERY_CORE.gameId,SHOT_GALLERY_CORE.gameVersion)]: coreAdapter(SHOT_GALLERY_CORE),
  [adapterKey(DARTS_CORE.gameId,DARTS_CORE.gameVersion)]: coreAdapter(DARTS_CORE),
  [adapterKey(BILLIARDS_CORE.gameId,BILLIARDS_CORE.gameVersion)]: coreAdapter(BILLIARDS_CORE),
  [adapterKey(MINE_GRID_CORE.gameId,MINE_GRID_CORE.gameVersion)]: coreAdapter(MINE_GRID_CORE),
  [adapterKey(ORB_BURST_CORE.gameId,ORB_BURST_CORE.gameVersion)]: coreAdapter(ORB_BURST_CORE),
  [adapterKey(RIVER_DASH_CORE_V2.gameId,RIVER_DASH_CORE_V2.gameVersion)]: coreAdapter(RIVER_DASH_CORE_V2),
  [adapterKey(TOWER_DROP_CORE_V3.gameId,TOWER_DROP_CORE_V3.gameVersion)]: coreAdapter(TOWER_DROP_CORE_V3),
  [adapterKey(JET_STREAM_CORE_V2.gameId,JET_STREAM_CORE_V2.gameVersion)]: coreAdapter(JET_STREAM_CORE_V2),
  [adapterKey(SERPENT_CORE.gameId,SERPENT_CORE.gameVersion)]: coreAdapter(SERPENT_CORE),
  [adapterKey(RIVER_DASH_CORE.gameId,RIVER_DASH_CORE.gameVersion)]: coreAdapter(RIVER_DASH_CORE),
  [adapterKey(STACK_3D_CORE.gameId, STACK_3D_CORE.gameVersion)]: coreAdapter(STACK_3D_CORE),
  [adapterKey(towerDropAdapter.gameId, towerDropAdapter.gameVersion)]:
    towerDropAdapter,
  [adapterKey(precisionStackV1Adapter.gameId, precisionStackV1Adapter.gameVersion)]:
    precisionStackV1Adapter,
  [adapterKey(precisionStackV2Adapter.gameId, precisionStackV2Adapter.gameVersion)]:
    precisionStackV2Adapter,
  [adapterKey(pianoRushAdapter.gameId, pianoRushAdapter.gameVersion)]:
    pianoRushAdapter,
  [adapterKey(jetStreamAdapter.gameId, jetStreamAdapter.gameVersion)]:
    jetStreamAdapter,
  [adapterKey(dinoDashAdapter.gameId, dinoDashAdapter.gameVersion)]:
    dinoDashAdapter,
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
