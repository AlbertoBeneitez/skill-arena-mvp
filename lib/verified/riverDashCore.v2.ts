/** Progressive original scenarios, sharing the frozen V1 movement/collision rules. */
import { createRng } from "../deterministic/seeded";
import {
  RIVER_DASH_CORE,
  createRiverState,
  moveRiver,
  type RiverState,
} from "./riverDashCore.v1";

export const RIVER_DASH_V2 = {
  openingRoadSpeedMilli: 12000,
  openingPlatformSpeedMilli: 6000,
  roadSpeedPerSectorMilli: 5500,
  platformSpeedPerSectorMilli: 3000,
  openingRoadGapMilli: 260000,
  openingPlatformLengthMilli: 290000,
  generation: "PROGRESSIVE_RIVER2_SECTORS",
} as const;

function sectorLanes(seed: string, sector: number) {
  const lanes = createRiverState(`${seed}:river2:sector:${sector}`).lanes;
  const rng = createRng(`${seed}:river2:opening:${sector}`);
  for (const lane of lanes) {
    if (lane.kind === "safe") continue;
    if (lane.kind === "road") {
      lane.speedMilli = Math.min(
        52000,
        RIVER_DASH_V2.openingRoadSpeedMilli + sector * RIVER_DASH_V2.roadSpeedPerSectorMilli + (sector ? rng.nextInt(5000) : 0),
      );
      lane.lengthMilli = Math.min(65000, 40000 + sector * 3000);
      lane.gapMilli = Math.max(110000, RIVER_DASH_V2.openingRoadGapMilli - sector * 22000);
      // Wide central opening teaches one row at a time without an immediate collision.
      lane.phaseMilli =
        sector === 0
          ? rng.nextInt(15001)
          : rng.nextInt(lane.lengthMilli + lane.gapMilli);
    } else {
      lane.speedMilli = Math.min(
        30000,
        RIVER_DASH_V2.openingPlatformSpeedMilli + sector * RIVER_DASH_V2.platformSpeedPerSectorMilli + rng.nextInt(3000),
      );
      lane.lengthMilli = Math.max(150000, RIVER_DASH_V2.openingPlatformLengthMilli - sector * 20000);
      lane.gapMilli = Math.min(65000, 30000 + sector * 6000);
      lane.phaseMilli =
        sector === 0
          ? rng.nextInt(15001)
          : rng.nextInt(lane.lengthMilli + lane.gapMilli);
    }
  }
  return lanes;
}

function create(seed: string): RiverState {
  const state = createRiverState(seed);
  state.lanes = sectorLanes(seed, 0);
  return state;
}

function apply(state: RiverState, action: string) {
  const before = state.crossings;
  moveRiver(state, action);
  // New layouts are introduced only on the safe home dock, never under a player.
  if (state.crossings !== before)
    state.lanes = sectorLanes(state.seed, state.crossings);
}

export const RIVER_DASH_CORE_V2 = {
  ...RIVER_DASH_CORE,
  gameVersion: "2.0.0",
  content: {
    baseVersion: RIVER_DASH_CORE.gameVersion,
    baseRules: RIVER_DASH_CORE.content,
    progression: RIVER_DASH_V2,
  },
  create,
  apply,
};
