import { type Pool, type QueryResultRow } from "pg";
import { getProductionPostgresPool } from "./postgresPool";
import type { MatchManifest } from "../verified/contracts";
import { hashManifest, validateManifest } from "./verifiedMatch";
import {
  MatchRepositoryError,
  type MatchParticipants,
  type MatchRepository,
  type StoredMatch,
} from "./matchRepository";

interface MatchRow extends QueryResultRow {
  manifest: MatchManifest;
  manifest_hash: string;
  player_a: string;
  player_b: string;
  stored_at: Date;
}

function fromRow(row: MatchRow): StoredMatch {
  if (hashManifest(row.manifest) !== row.manifest_hash) {
    throw new MatchRepositoryError("CORRUPT_MATCH");
  }
  return {
    manifest: row.manifest,
    manifestHash: row.manifest_hash,
    participants: { A: row.player_a, B: row.player_b },
    storedAt: row.stored_at.toISOString(),
  };
}

function validPlayerId(id: unknown): id is string {
  return typeof id === "string" && id.length > 0 && id.length <= 128 && id.trim() === id;
}

/** Uses a real PostgreSQL pool. No memory/SQLite fallback or automatic migration. */
export class PostgresMatchRepository implements MatchRepository {
  constructor(private readonly pool: Pool) {}

  async createMatch(manifest: MatchManifest, participants: MatchParticipants): Promise<StoredMatch> {
    if (
      !manifest || typeof manifest.match_id !== "string" ||
      manifest.match_id.length < 1 || manifest.match_id.length > 128 ||
      !validateManifest(manifest, { allowV3: true }).ok
    ) throw new MatchRepositoryError("INVALID_MATCH");
    if (!participants || !validPlayerId(participants.A) ||
      !validPlayerId(participants.B) || participants.A === participants.B) {
      throw new MatchRepositoryError("INVALID_PARTICIPANTS");
    }

    const serialized = JSON.stringify(manifest);
    const manifestHash = hashManifest(manifest);
    if (hashManifest(JSON.parse(serialized) as MatchManifest) !== manifestHash) {
      throw new MatchRepositoryError("INVALID_MATCH");
    }

    // The unique key arbitrates concurrent creation. A retry may recover the
    // exact same match, but must never replace its seed, rules or participants.
    await this.pool.query(
      `INSERT INTO arena_matches (match_id, manifest, manifest_hash, player_a, player_b)
       VALUES ($1, $2::jsonb, $3, $4, $5)
       ON CONFLICT (match_id) DO NOTHING`,
      [manifest.match_id, serialized, manifestHash, participants.A, participants.B]
    );
    const found = await this.pool.query<MatchRow>(
      `SELECT manifest, manifest_hash, player_a, player_b, stored_at
       FROM arena_matches WHERE match_id = $1`, [manifest.match_id]
    );
    const row = found.rows[0];
    if (!row || row.manifest_hash !== manifestHash ||
      row.player_a !== participants.A || row.player_b !== participants.B) {
      throw new MatchRepositoryError("MATCH_CONFLICT");
    }
    return fromRow(row);
  }

  async findMatchForPlayer(matchId: string, playerId: string): Promise<StoredMatch | null> {
    if (typeof matchId !== "string" || matchId.length < 1 || matchId.length > 128 ||
      !validPlayerId(playerId)) return null;
    const found = await this.pool.query<MatchRow>(
      `SELECT manifest, manifest_hash, player_a, player_b, stored_at
       FROM arena_matches
       WHERE match_id = $1 AND (player_a = $2 OR player_b = $2)`,
      [matchId, playerId]
    );
    return found.rows[0] ? fromRow(found.rows[0]) : null;
  }
}

let productionRepository: MatchRepository | undefined;

/** Explicit production configuration; pool created lazily and reused per worker. */
export function getProductionMatchRepository(): MatchRepository {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new MatchRepositoryError("DATABASE_NOT_CONFIGURED");
  productionRepository ??= new PostgresMatchRepository(getProductionPostgresPool());
  return productionRepository;
}
