import { hashManifest, validateManifest } from "../verifiedMatch";
import {
  MatchRepositoryError,
  type MatchRepository,
  type MatchParticipants,
  type StoredMatch,
} from "../matchRepository";
import type { MatchManifest } from "../../verified/contracts";
/** Local demo/test only. Never selected by production repository factories. */
export class MemoryMatchRepository implements MatchRepository {
  private readonly records = new Map<string, StoredMatch>();
  async createMatch(manifest: MatchManifest, participants: MatchParticipants) {
    if (
      !validateManifest(manifest, { allowV3: true, allowPrivateScenario: true })
        .ok
    )
      throw new MatchRepositoryError("INVALID_MATCH");
    if (!participants.A || !participants.B || participants.A === participants.B)
      throw new MatchRepositoryError("INVALID_PARTICIPANTS");
    const hash = hashManifest(manifest),
      before = this.records.get(manifest.match_id);
    if (
      before &&
      (before.manifestHash !== hash ||
        before.participants.A !== participants.A ||
        before.participants.B !== participants.B)
    )
      throw new MatchRepositoryError("MATCH_CONFLICT");
    if (!before)
      this.records.set(manifest.match_id, {
        manifest: structuredClone(manifest),
        manifestHash: hash,
        participants: { ...participants },
        storedAt: manifest.created_at,
      });
    return structuredClone(this.records.get(manifest.match_id)!);
  }
  async findMatchForPlayer(matchId: string, playerId: string) {
    const found = this.records.get(matchId);
    return found &&
      (found.participants.A === playerId || found.participants.B === playerId)
      ? structuredClone(found)
      : null;
  }
}
