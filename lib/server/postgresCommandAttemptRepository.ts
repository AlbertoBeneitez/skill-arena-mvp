import type { Pool, QueryResultRow } from "pg";
import {
  CommandAuthorityError,
  type CommandAttemptRepository,
  type StoredCommandAttempt,
} from "./commandAttemptRepository";
import { getProductionPostgresPool } from "./postgresPool";
interface Row extends QueryResultRow {
  attempt_id: string;
  match_id: string;
  player_id: string;
  revision: number;
  manifest_hash: string;
  inputs: StoredCommandAttempt["inputs"];
  commands: StoredCommandAttempt["commands"];
  terminal: boolean;
}
function record(row: Row): StoredCommandAttempt {
  return {
    attemptId: row.attempt_id,
    matchId: row.match_id,
    playerId: row.player_id,
    revision: row.revision,
    manifestHash: row.manifest_hash,
    inputs: row.inputs,
    commands: row.commands,
    terminal: row.terminal,
  };
}
export class PostgresCommandAttemptRepository
  implements CommandAttemptRepository
{
  constructor(private readonly pool: Pool) {}
  async create(next: StoredCommandAttempt) {
    if (
      next.revision !== 0 ||
      next.inputs.length ||
      next.commands.length ||
      next.terminal
    )
      throw new CommandAuthorityError("CORRUPT_ATTEMPT");
    const result = await this.pool.query(
      `INSERT INTO arena_command_attempts(attempt_id,match_id,player_id,manifest_hash)
   SELECT $1,m.match_id,$3,$4 FROM arena_matches m WHERE m.match_id=$2 AND m.manifest_hash=$4 AND (m.player_a=$3 OR m.player_b=$3)
   ON CONFLICT DO NOTHING RETURNING attempt_id`,
      [next.attemptId, next.matchId, next.playerId, next.manifestHash],
    );
    if (result.rowCount !== 1)
      throw new CommandAuthorityError("COMMAND_CONFLICT");
  }
  async findForPlayer(attemptId: string, playerId: string) {
    const result = await this.pool.query<Row>(
      `SELECT a.* FROM arena_command_attempts a JOIN arena_matches m ON a.match_id=m.match_id
   WHERE a.attempt_id=$1 AND a.player_id=$2 AND (m.player_a=$2 OR m.player_b=$2)`,
      [attemptId, playerId],
    );
    return result.rows[0] ? record(result.rows[0]) : null;
  }
  async compareAndSwap(expectedRevision: number, next: StoredCommandAttempt) {
    if (
      next.revision !== expectedRevision + 1 ||
      next.inputs.length !== next.revision ||
      next.commands.length !== next.revision
    )
      throw new CommandAuthorityError("CORRUPT_ATTEMPT");
    const result = await this.pool.query(
      `UPDATE arena_command_attempts SET revision=$1,inputs=$2::jsonb,commands=$3::jsonb,terminal=$4
   WHERE attempt_id=$5 AND player_id=$6 AND match_id=$7 AND manifest_hash=$8 AND revision=$9 AND NOT terminal
   AND inputs=$10::jsonb AND commands=$11::jsonb RETURNING attempt_id`,
      [
        next.revision,
        JSON.stringify(next.inputs),
        JSON.stringify(next.commands),
        next.terminal,
        next.attemptId,
        next.playerId,
        next.matchId,
        next.manifestHash,
        expectedRevision,
        JSON.stringify(next.inputs.slice(0, -1)),
        JSON.stringify(next.commands.slice(0, -1)),
      ],
    );
    return result.rowCount === 1;
  }
}
/** Staged port only; no HTTP production activation and no memory fallback. */
export function getProductionCommandAttemptRepository(): CommandAttemptRepository {
  if (process.env.COMMAND_AUTHORITY_READY !== "1" || !process.env.DATABASE_URL)
    throw new CommandAuthorityError("UNAVAILABLE");
  return new PostgresCommandAttemptRepository(getProductionPostgresPool());
}
