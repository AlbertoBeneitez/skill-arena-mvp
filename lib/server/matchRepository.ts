import type { MatchManifest } from "../verified/contracts";

export type MatchParticipants = Readonly<{ A: string; B: string }>;
export type StoredMatch = Readonly<{
  manifest: MatchManifest;
  manifestHash: string;
  participants: MatchParticipants;
  storedAt: string;
}>;

/** Server-only persistence boundary; callers must supply trusted player ids. */
export interface MatchRepository {
  createMatch(manifest: MatchManifest, participants: MatchParticipants): Promise<StoredMatch>;
  findMatchForPlayer(matchId: string, playerId: string): Promise<StoredMatch | null>;
}

export class MatchRepositoryError extends Error {
  constructor(public readonly code:
    | "INVALID_MATCH"
    | "INVALID_PARTICIPANTS"
    | "MATCH_CONFLICT"
    | "CORRUPT_MATCH"
    | "DATABASE_NOT_CONFIGURED"
  ) {
    super(code);
    this.name = "MatchRepositoryError";
  }
}
