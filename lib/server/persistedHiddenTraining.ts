import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { HiddenCommandAuthority } from "./hiddenCommandAuthority";
import { PostgresMatchRepository } from "./postgresMatchRepository";
import { PostgresCommandAttemptRepository } from "./postgresCommandAttemptRepository";
import { createPrivateMatchManifest } from "./privateMatchIssuer";
import { hashManifest } from "./matchIntegrity";
import { CommandAuthorityError } from "./commandAttemptRepository";
import { MINE_GRID_CORE_V2, projectMineV2 } from "../verified/mineGridCore.v2";
/** Durable training only. No authenticated competition, ranking, wallet or settlement. */
export class PersistedHiddenTraining {
  readonly authority;
  constructor(private readonly pool: Pool) {
    this.authority = new HiddenCommandAuthority(
      new PostgresMatchRepository(pool),
      new PostgresCommandAttemptRepository(pool),
      { core: MINE_GRID_CORE_V2, project: projectMineV2 },
      "demo",
    );
  }
  async available() {
    const result = await this.pool.query<{ ready: boolean }>(
      "SELECT to_regclass('arena_matches') IS NOT NULL AND to_regclass('arena_command_attempts') IS NOT NULL AS ready",
    );
    return result.rows[0]?.ready === true;
  }
  async start(actorId: string) {
    if (!/^[0-9a-f]{64}$/.test(actorId))
      throw new CommandAuthorityError("NOT_FOUND");
    const client = await this.pool.connect(),
      attemptId = randomUUID();
    try {
      await client.query("BEGIN");
      // Across workers, not a process-local rate counter. Bound training storage
      // until an operator supplies a reviewed retention/rate policy.
      await client.query("SELECT pg_advisory_xact_lock(19462813)");
      const quota = await client.query<{ total: string; own: string }>(
        `SELECT count(*) AS total, count(*) FILTER (WHERE player_a=$1 AND stored_at > now()-interval '24 hours') AS own FROM arena_matches WHERE player_b LIKE 'training-peer-%'`,
        [actorId],
      );
      if (
        Number(quota.rows[0].total) >= 2000 ||
        Number(quota.rows[0].own) >= 20
      )
        throw new CommandAuthorityError("UNAVAILABLE");
      const manifest = createPrivateMatchManifest("mine-grid", "2.0.0");
      await new PostgresMatchRepository(client).createMatch(manifest, {
        A: actorId,
        B: `training-peer-${randomUUID()}`,
      });
      await new PostgresCommandAttemptRepository(client).create({
        attemptId,
        playerId: actorId,
        matchId: manifest.match_id,
        manifestHash: hashManifest(manifest),
        revision: 0,
        inputs: [],
        commands: [],
        terminal: false,
      });
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    return this.authority.read(attemptId, actorId);
  }
}
