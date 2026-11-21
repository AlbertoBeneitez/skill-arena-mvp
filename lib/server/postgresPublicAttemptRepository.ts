import { randomInt, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import {
  CONNECTION_LEASE_MS,
  decidePublicMatch,
  PUBLIC_MATCH_POLICY,
  type PublicMatchView,
  type PublicRecord,
} from "../publicMatch";
import type { VerifiedAttemptResult } from "../verified/contracts";
import { hashManifest } from "./matchIntegrity";
import type { Platform } from "../platform";
import {
  PublicAttemptError,
  type PublicAttempt,
  type PublicAttemptRepository,
  type StartPublicAttempt,
} from "./publicAttemptRepository";
const queryAttempt = `SELECT a.*,m.manifest FROM arena_public_attempts a JOIN arena_matches m USING(match_id)`;
const lost = (id: string, reason: string): VerifiedAttemptResult => ({
  ok: true,
  verified: false,
  durable: true,
  forfeited: true,
  error: "ATTEMPT_FORFEITED",
  attempt_id: id,
  failure: reason,
});
/** Atomic persistence adapter; no wallet or external provider effects. */
export class PostgresPublicAttemptRepository
  implements PublicAttemptRepository
{
  constructor(private readonly pool: Pool) {}
  /**
   * v179: whether migration 006 (arena_public_matches.platform) is applied. Until it is, every match stays in the
   * single phone pool and desktop starts are refused, so a deploy before the migration never mixes the pools.
   */
  private platformColumn: Promise<boolean> | null = null;
  private hasPlatformColumn(c: PoolClient) {
    this.platformColumn ??= c
      .query(`SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='arena_public_matches' AND column_name='platform'`)
      .then((r) => r.rows.length > 0)
      .catch(() => { this.platformColumn = null; return false; });
    return this.platformColumn;
  }
  /** v203: whether migration 012 (arena_public_matches.solo) is applied. Until it is, Offline starts are refused. */
  private soloColumn: Promise<boolean> | null = null;
  private hasSoloColumn(c: PoolClient) {
    this.soloColumn ??= c
      .query(`SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='arena_public_matches' AND column_name='solo'`)
      .then((r) => r.rows.length > 0)
      .catch(() => { this.soloColumn = null; return false; });
    return this.soloColumn;
  }
  private async tx<T>(run: (c: PoolClient) => Promise<T>) {
    const c = await this.pool.connect();
    try {
      await c.query("BEGIN");
      const out = await run(c);
      await c.query("COMMIT");
      return out;
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  }
  private async load(c: PoolClient, actor: string, id: string) {
    const r = await c.query<PublicAttempt>(
      `${queryAttempt} WHERE a.attempt_id=$1 AND a.player_id=$2 FOR UPDATE OF a`,
      [id, actor],
    );
    if (!r.rows[0]) throw new PublicAttemptError("ATTEMPT_NOT_FOUND", 404);
    return r.rows[0];
  }
  private async resolve(c: PoolClient, match: string) {
    const m = await c.query(
      `SELECT p.resolution, p.policy_version, m.manifest->>'game_id' AS game_id FROM arena_public_matches p JOIN arena_matches m USING(match_id) WHERE p.match_id=$1 FOR UPDATE OF p`,
      [match],
    );
    if (!m.rows.length || m.rows[0].resolution) return;
    const rows = (
      await c.query<PublicAttempt>(
        `SELECT * FROM arena_public_attempts WHERE match_id=$1 ORDER BY slot`,
        [match],
      )
    ).rows;
    const a = rows.find((r) => r.slot === "A"),
      b = rows.find((r) => r.slot === "B");
    if (!a) return;
    const closed = (r: PublicAttempt) =>
      ["verified", "forfeited", "rejected"].includes(r.state);
    if (!closed(a) || (b && !closed(b))) return;
    if (!b && a.state === "verified") return;
    let winner: "A" | "B" | null = null,
      reason: string = "forfeit";
    if (a.state === "verified" && b?.state === "verified") {
      // v208: each match resolves under the policy it was stored with (V1 archived, V2 for new matches).
      ({ winner, reason } = decidePublicMatch(m.rows[0].policy_version, m.rows[0].game_id, a.response!, b.response!));
    } else if (b) {
      if (a.state === "verified") winner = "A";
      else if (b.state === "verified") winner = "B";
    }
    await c.query(
      `UPDATE arena_public_matches SET resolution=$2::jsonb WHERE match_id=$1 AND resolution IS NULL`,
      [
        match,
        JSON.stringify({
          winnerSlot: winner,
          reason,
          policyVersion: m.rows[0].policy_version,
        }),
      ],
    );
  }
  private async expire(c: PoolClient, row: PublicAttempt) {
    const r = await c.query(
      `UPDATE arena_public_attempts SET state='forfeited',response=$2::jsonb WHERE attempt_id=$1 AND state='playing' AND (lease_until<=clock_timestamp() OR deadline<=clock_timestamp()) RETURNING attempt_id`,
      [row.attempt_id, JSON.stringify(lost(row.attempt_id, "CONNECTION_LOST"))],
    );
    if (r.rowCount) {
      row.state = "forfeited";
      row.response = lost(row.attempt_id, "CONNECTION_LOST");
      await this.resolve(c, row.match_id);
    }
    return row;
  }
  /** Database size, checked at most once a minute per server instance (it is cheap, but not free). */
  private storageCheckedAt = 0;
  private storageWasFull = false;
  private async storageFull(c: PoolClient) {
    if (Date.now() - this.storageCheckedAt < 60_000) return this.storageWasFull;
    const r = await c.query("SELECT pg_database_size(current_database())::bigint AS bytes");
    this.storageCheckedAt = Date.now();
    this.storageWasFull = Number(r.rows[0].bytes) >= trainingLimits().storageGuardBytes;
    return this.storageWasFull;
  }
  async recoverStart(actor: string, key: string, requestHash: string) {
    return this.tx(async (c) => {
      const r = await c.query<PublicAttempt>(
        `${queryAttempt} WHERE a.player_id=$1 AND a.start_key=$2 FOR UPDATE OF a`,
        [actor, key],
      );
      if (!r.rows[0]) return null;
      if (r.rows[0].request_hash !== requestHash)
        throw new PublicAttemptError("START_KEY_CONFLICT");
      return this.expire(c, r.rows[0]);
    });
  }
  async start(args: StartPublicAttempt) {
    return this.tx(async (c) => {
      // Training-only storage quota and ordering; not a substitute for production abuse controls.
      await c.query("SELECT pg_advisory_xact_lock(19462814)");
      const prior = await c.query<PublicAttempt>(
        `${queryAttempt} WHERE a.player_id=$1 AND a.start_key=$2 FOR UPDATE OF a`,
        [args.actor, args.key],
      );
      if (prior.rows[0]) {
        if (prior.rows[0].request_hash !== args.requestHash)
          throw new PublicAttemptError("START_KEY_CONFLICT");
        return this.expire(c, prior.rows[0]);
      }
      const active = (
        await c.query<PublicAttempt>(
          `${queryAttempt} WHERE a.player_id=$1 AND a.state='playing' FOR UPDATE OF a`,
          [args.actor],
        )
      ).rows;
      for (const row of active)
        if ((await this.expire(c, row)).state === "playing")
          throw new PublicAttemptError("ATTEMPT_ALREADY_ACTIVE");
      // v227 (security review C2 + A1). No fixed total any more: 2000 attempts ever blocked everyone, and anyone could
      // reach it in seconds with fresh cookies. Instead: a daily limit per signed-in account (a new cookie does not
      // reset it), a small one per anonymous cookie, and a guard on the database's real size (Neon's free 1 GB).
      // (The account column exists from migration 008 on; older schemas only ever see anonymous starts.)
      const quota = await c.query(
        args.accountId
          ? "SELECT count(*)::int AS n FROM arena_public_attempts WHERE account_id=$1::uuid AND started_at>clock_timestamp()-interval '24 hours'"
          : "SELECT count(*)::int AS n FROM arena_public_attempts WHERE player_id=$1 AND started_at>clock_timestamp()-interval '24 hours'",
        [args.accountId ?? args.actor],
      );
      const limits = trainingLimits();
      if (quota.rows[0].n >= (args.accountId ? limits.perAccountDay : limits.perAnonymousDay))
        throw new PublicAttemptError("TRAINING_QUOTA", 429);
      if (await this.storageFull(c)) throw new PublicAttemptError("STORAGE_FULL", 503);
      const pools = await this.hasPlatformColumn(c);
      if (!pools && args.platform !== "mobile") throw new PublicAttemptError("PLATFORM_POOL_UNAVAILABLE", 503);
      const solos = await this.hasSoloColumn(c);
      if (args.solo && (!solos || !pools)) throw new PublicAttemptError("SOLO_UNAVAILABLE", 503);
      const candidate = args.solo ? { rows: [] as { manifest: PublicAttempt["manifest"] }[] } : await c.query(
        `SELECT m.manifest FROM arena_matches m JOIN arena_public_matches p USING(match_id) JOIN arena_public_attempts a USING(match_id)
   WHERE m.player_b IS NULL AND m.player_a<>$1 AND a.slot='A' AND a.state='verified' AND p.resolution IS NULL AND p.scope='training' AND p.policy_version='${PUBLIC_MATCH_POLICY}' ${solos ? "AND NOT p.solo" : ""}
   AND p.expires_at>clock_timestamp() AND m.manifest->>'game_id'=$2 AND m.manifest->>'game_version'=$3 AND (m.manifest->'competition'->>'stake_minor')::int=$4
   ${pools ? "AND p.platform=$5" : ""}
   ORDER BY m.stored_at,m.match_id LIMIT 1 FOR UPDATE OF m,p`,
        pools ? [args.actor, args.gameId, args.gameVersion, args.stake, args.platform] : [args.actor, args.gameId, args.gameVersion, args.stake],
      );
      let manifest: PublicAttempt["manifest"], slot: "A" | "B";
      if (candidate.rows[0]) {
        manifest = candidate.rows[0].manifest;
        slot = "B";
        await c.query(
          "UPDATE arena_matches SET player_b=$2 WHERE match_id=$1 AND player_b IS NULL",
          [manifest.match_id, args.actor],
        );
      } else {
        const index = await c.query(
          `INSERT INTO arena_scenario_rotation(game_id,game_version,cursor) VALUES($1,$2,$3) ON CONFLICT(game_id,game_version) DO UPDATE SET cursor=arena_scenario_rotation.cursor+1 RETURNING (cursor%1000)::int AS n`,
          [args.gameId, args.gameVersion, randomInt(1000)],
        );
        manifest = args.manifest(index.rows[0].n);
        slot = "A";
        await c.query(
          `INSERT INTO arena_matches(match_id,manifest,manifest_hash,player_a,player_b) VALUES($1,$2::jsonb,$3,$4,NULL)`,
          [
            manifest.match_id,
            JSON.stringify(manifest),
            hashManifest(manifest),
            args.actor,
          ],
        );
        if (args.solo) await c.query(
          `INSERT INTO arena_public_matches(match_id,policy_version,scope,expires_at,platform,solo) VALUES($1,$2,'training',clock_timestamp()+interval '24 hours',$3,true)`,
          [manifest.match_id, PUBLIC_MATCH_POLICY, args.platform],
        );
        else await c.query(
          pools
            ? `INSERT INTO arena_public_matches(match_id,policy_version,scope,expires_at,platform) VALUES($1,$2,'training',clock_timestamp()+interval '24 hours',$3)`
            : `INSERT INTO arena_public_matches(match_id,policy_version,scope,expires_at) VALUES($1,$2,'training',clock_timestamp()+interval '24 hours')`,
          pools ? [manifest.match_id, PUBLIC_MATCH_POLICY, args.platform] : [manifest.match_id, PUBLIC_MATCH_POLICY],
        );
      }
      const ticket = args.ticket(manifest, slot);
      await c.query(
        `INSERT INTO arena_public_attempts(attempt_id,match_id,player_id,slot,start_key,request_hash,ticket,state,lease_until,deadline${args.accountId ? ",account_id" : ""})
   VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,'playing',clock_timestamp()+$8*interval '1 millisecond',clock_timestamp()+$9*interval '1 millisecond'${args.accountId ? ",$10" : ""})`,
        [
          ticket.attempt_id,
          manifest.match_id,
          args.actor,
          slot,
          args.key,
          args.requestHash,
          JSON.stringify(ticket),
          CONNECTION_LEASE_MS,
          args.durationMs,
          ...(args.accountId ? [args.accountId] : []),
        ],
      );
      return this.load(c, args.actor, ticket.attempt_id);
    });
  }
  async inspect(actor: string, id: string) {
    return this.tx(async (c) => this.expire(c, await this.load(c, actor, id)));
  }
  async recent(actor: string) {
    return this.tx(async (c) => {
      const rows = (
        await c.query<PublicAttempt>(
          `${queryAttempt} WHERE a.player_id=$1 ORDER BY a.started_at DESC,a.attempt_id DESC LIMIT 20 FOR UPDATE OF a`,
          [actor],
        )
      ).rows;
      for (const row of rows) await this.expire(c, row);
      return rows;
    });
  }
  async pulse(actor: string, id: string, abandon: boolean) {
    return this.tx(async (c) => {
      const row = await this.expire(c, await this.load(c, actor, id));
      if (row.state === "playing") {
        if (abandon) {
          row.state = "forfeited";
          row.response = lost(id, "ABANDONED");
          await c.query(
            `UPDATE arena_public_attempts SET state='forfeited',response=$2::jsonb WHERE attempt_id=$1`,
            [id, row.response ? JSON.stringify(row.response) : null],
          );
          await this.resolve(c, row.match_id);
        } else
          await c.query(
            `UPDATE arena_public_attempts SET lease_until=LEAST(deadline,clock_timestamp()+$2*interval '1 millisecond') WHERE attempt_id=$1`,
            [id, CONNECTION_LEASE_MS],
          );
      }
      return row;
    });
  }
  async receive(actor: string, id: string, hash: string, record: PublicRecord) {
    return this.tx(async (c) => {
      const row = await this.expire(c, await this.load(c, actor, id));
      if (row.record_hash) {
        if (row.record_hash !== hash)
          throw new PublicAttemptError("RECORD_CONFLICT");
        return row;
      }
      row.record = record;
      row.record_hash = hash;
      if (row.state === "playing") {
        row.state = "received";
      }
      await c.query(
        `UPDATE arena_public_attempts SET record=$2::jsonb,record_hash=$3,record_received_at=clock_timestamp(),state=$4,response=$5::jsonb WHERE attempt_id=$1`,
        [
          id,
          JSON.stringify(record),
          hash,
          row.state,
          row.response ? JSON.stringify(row.response) : null,
        ],
      );
      if (row.state === "forfeited") await this.resolve(c, row.match_id);
      return this.load(c, actor, id);
    });
  }
  async claim(actor: string, id: string) {
    const token = randomUUID();
    const result = await this.pool.query<PublicAttempt>(
      `UPDATE arena_public_attempts SET processing_token=$3,processing_until=clock_timestamp()+interval '30 seconds' WHERE attempt_id=$1 AND player_id=$2 AND state='received' AND (processing_until IS NULL OR processing_until<clock_timestamp()) RETURNING *`,
      [id, actor, token],
    );
    if (!result.rows[0]) return null;
    return this.tx(async (c) => this.load(c, actor, id));
  }
  async complete(
    actor: string,
    id: string,
    token: string,
    response: VerifiedAttemptResult,
  ) {
    return this.tx(async (c) => {
      await c.query(
        `UPDATE arena_public_attempts SET state=$4,response=$5::jsonb,processing_until=NULL WHERE attempt_id=$1 AND player_id=$2 AND state='received' AND processing_token=$3`,
        [
          id,
          actor,
          token,
          response.forfeited
            ? "forfeited"
            : response.verified
              ? "verified"
              : "rejected",
          JSON.stringify(response),
        ],
      );
      const row = await this.load(c, actor, id);
      await this.resolve(c, row.match_id);
      return row;
    });
  }
  async audit(actor: string, id: string, hash: string, audit: unknown) {
    await this.pool.query(
      `UPDATE arena_public_attempts SET replay_audit=$4::jsonb WHERE attempt_id=$1 AND player_id=$2 AND record_hash=$3 AND replay_audit IS NULL`,
      [id, actor, hash, JSON.stringify(audit)],
    );
  }
  async view(actor: string, id: string): Promise<PublicMatchView> {
    return this.tx(async (c) => {
      const row = await this.expire(c, await this.load(c, actor, id));
      const result = await c.query(
        `SELECT resolution, policy_version FROM arena_public_matches WHERE match_id=$1`,
        [row.match_id],
      );
      const resolution = result.rows[0]?.resolution;
      const policy: string = result.rows[0]?.policy_version ?? PUBLIC_MATCH_POLICY;
      // After resolution the opponent's verified score is public to both players (shown on the result screen).
      let opponentScore: number | undefined;
      if (resolution) {
        const other = (
          await c.query<PublicAttempt>(
            `SELECT * FROM arena_public_attempts WHERE match_id=$1 AND slot<>$2`,
            [row.match_id, row.slot],
          )
        ).rows[0];
        const score = other?.state === "verified" ? other.response?.score : undefined;
        if (typeof score === "number" && Number.isFinite(score)) opponentScore = score;
      }
      return {
        matchId: row.match_id,
        attemptId: id,
        slot: row.slot,
        status: resolution ? "resolved" : "waiting",
        winnerSlot: resolution?.winnerSlot ?? null,
        policyVersion: policy,
        reason: resolution?.reason,
        ...(opponentScore !== undefined ? { opponentScore } : {}),
      };
    });
  }
  async availability(actor: string, stake: number, platform: Platform) {
    return this.tx(async (c) => {
      const pools = await this.hasPlatformColumn(c), solos = await this.hasSoloColumn(c);
      if (!pools && platform !== "mobile") return [];
      const due = (
        await c.query<PublicAttempt>(
          `${queryAttempt} WHERE a.state='playing' AND (a.lease_until<=clock_timestamp() OR a.deadline<=clock_timestamp()) LIMIT 100 FOR UPDATE OF a SKIP LOCKED`,
        )
      ).rows;
      for (const row of due) await this.expire(c, row);
      const r = await c.query(
        `SELECT m.manifest->>'game_id' AS game_id,m.manifest->>'game_version' AS game_version,bool_or(m.player_a=$1) AS own,bool_or(m.player_a<>$1) AS other FROM arena_matches m JOIN arena_public_matches p USING(match_id) JOIN arena_public_attempts a USING(match_id)
   WHERE p.scope='training' ${solos ? "AND NOT p.solo" : ""} AND p.resolution IS NULL AND p.expires_at>clock_timestamp() AND m.player_b IS NULL AND a.slot='A' AND a.state='verified' AND (m.manifest->'competition'->>'stake_minor')::int=$2
   ${pools ? "AND p.platform=$3" : ""} GROUP BY m.manifest->>'game_id',m.manifest->>'game_version'`,
        pools ? [actor, stake, platform] : [actor, stake],
      );
      return r.rows.map((row) => ({
        gameId: row.game_id as string,
        gameVersion: row.game_version as string,
        mode: row.other
          ? ("existing" as const)
          : row.own
            ? ("waiting" as const)
            : ("create" as const),
      }));
    });
  }
}

/** v227: training limits (docs/security/REVISION_2026-11.md, C2 and A1). Environment overrides exist for tests. */
export function trainingLimits(env: Record<string, string | undefined> = process.env) {
  const n = (v: string | undefined, d: number) => { const x = Number(v); return Number.isFinite(x) && x > 0 ? x : d; };
  return {
    /** A person plays as much as they like: 200 matches a day is far beyond a human session. */
    perAccountDay: n(env.TRAINING_MATCHES_PER_ACCOUNT_DAY, 200),
    /** Without an account (a bare cookie) only a taste: farms of fresh cookies get little. */
    perAnonymousDay: n(env.TRAINING_MATCHES_PER_COOKIE_DAY, 20),
    /** Stop new matches before the database is full (Neon free plan: 1 GB; it stops writing, it does not bill). */
    storageGuardBytes: n(env.DATABASE_STORAGE_GUARD_MB, 870) * 1024 * 1024,
  };
}
