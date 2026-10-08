import { randomBytes, randomUUID } from "node:crypto";
import { generatePrivateScenario } from "./scenarios";
import { createMatchManifest } from "./verifiedMatch";
import type { GameId } from "../games";
import type { MatchManifestV3 } from "../verified/contracts";
/** Server-owned private scenario, persisted once and reused by both participants. */
export function createPrivateMatchManifest(
  gameId: GameId,
  gameVersion: string,
): MatchManifestV3 {
  const generated = generatePrivateScenario(
    { game_id: gameId, game_version: gameVersion },
    randomBytes(32).toString("hex"),
    `private-seed-v1:${randomUUID()}`,
  );
  const base = createMatchManifest({
    gameId,
    gameVersion,
    seed: generated.seed,
    stakeMinor: 0,
    targetScore: 1e9,
  });
  return { ...base, manifest_version: 3, scenario: generated.scenario };
}
