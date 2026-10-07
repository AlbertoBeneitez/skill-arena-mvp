import type { Pool, QueryResultRow } from "pg";
import {
  isRankingPage,
  validMinorAmount,
  type RankingEntry,
  type RankingPage,
} from "../ranking";
import {
  RankingRepositoryError,
  type RankingQuery,
  type RankingRepository,
} from "./rankingRepository";
import { getProductionPostgresPool } from "./postgresPool";

type Cursor = {
  version: 1;
  snapshotId: string;
  profit: string;
  playerId: string;
};
type Row = QueryResultRow & {
  player_id: string;
  display_name: string;
  net_profit_minor: string;
  position: string;
};
const identifier = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(value);
function decodeCursor(value: string): Cursor {
  try {
    const data = Buffer.from(value, "base64url");
    if (data.toString("base64url") !== value) throw new Error();
    const cursor = JSON.parse(data.toString("utf8")) as Cursor;
    if (
      cursor.version !== 1 ||
      !identifier(cursor.snapshotId) ||
      !identifier(cursor.playerId) ||
      !validMinorAmount(cursor.profit)
    )
      throw new Error();
    return cursor;
  } catch {
    throw new RankingRepositoryError("INVALID_RANKING_CURSOR");
  }
}
function entry(row: Row): RankingEntry {
  const mapped = {
    position: Number(row.position),
    playerId: row.player_id,
    playerName: row.display_name,
    netProfitMinor: row.net_profit_minor,
  };
  if (
    !identifier(mapped.playerId) ||
    !Number.isSafeInteger(mapped.position) ||
    mapped.position < 1 ||
    typeof mapped.playerName !== "string" ||
    !mapped.playerName.trim() ||
    mapped.playerName.length > 80 ||
    !validMinorAmount(mapped.netProfitMinor)
  )
    throw new RankingRepositoryError("CORRUPT_RANKING");
  return mapped;
}
const rankedSql = `SELECT position::text AS position,
 player_id,display_name,net_profit_minor::text AS net_profit_minor
 FROM skill_arena_global_profit_ranking WHERE snapshot_id=$1 AND currency='EUR'`;

/** Read-only adapter. The view must contain immutable snapshots of settled real ledger data. */
export class PostgresRankingRepository implements RankingRepository {
  constructor(private readonly pool: Pool) {}
  private async snapshot(id?: string) {
    const found = await this.pool.query<{ snapshot_id: string; as_of: Date }>(
      `SELECT snapshot_id,as_of FROM skill_arena_global_profit_ranking WHERE currency='EUR' ${id ? "AND snapshot_id=$1" : ""} ORDER BY as_of DESC,snapshot_id COLLATE "C" DESC LIMIT 1`,
      id ? [id] : [],
    );
    if (id && !found.rows.length)
      throw new RankingRepositoryError("INVALID_RANKING_CURSOR");
    const row = found.rows[0];
    if (
      row &&
      (!identifier(row.snapshot_id) ||
        !(row.as_of instanceof Date) ||
        !Number.isFinite(row.as_of.getTime()))
    )
      throw new RankingRepositoryError("CORRUPT_RANKING");
    return row;
  }
  async readGlobalNetProfit(query: RankingQuery): Promise<RankingPage> {
    if (
      !Number.isInteger(query.limit) ||
      query.limit < 1 ||
      query.limit > 100 ||
      (query.cursor !== null &&
        (typeof query.cursor !== "string" ||
          !query.cursor ||
          query.cursor.length > 512))
    )
      throw new RankingRepositoryError("INVALID_RANKING_QUERY");
    const cursor = query.cursor ? decodeCursor(query.cursor) : null;
    const snapshot = await this.snapshot(cursor?.snapshotId);
    if (!snapshot)
      return {
        source: "server",
        metric: "net-profit",
        currency: "EUR",
        snapshotId: null,
        asOf: null,
        entries: [],
        nextCursor: null,
      };
    const found = await this.pool.query<Row>(
      `WITH ranked AS (${rankedSql})
      SELECT * FROM ranked WHERE ($2::bigint IS NULL OR net_profit_minor::bigint<$2 OR(net_profit_minor::bigint=$2 AND player_id COLLATE "C">$3))
      ORDER BY net_profit_minor::bigint DESC,player_id COLLATE "C" ASC LIMIT $4`,
      [
        snapshot.snapshot_id,
        cursor?.profit ?? null,
        cursor?.playerId ?? null,
        query.limit + 1,
      ],
    );
    const rows = found.rows.slice(0, query.limit).map(entry),
      last = rows.at(-1);
    const nextCursor =
      found.rows.length > query.limit && last
        ? Buffer.from(
            JSON.stringify({
              version: 1,
              snapshotId: snapshot.snapshot_id,
              profit: last.netProfitMinor,
              playerId: last.playerId,
            } satisfies Cursor),
          ).toString("base64url")
        : null;
    const page: RankingPage = {
      source: "server",
      metric: "net-profit",
      currency: "EUR",
      snapshotId: snapshot.snapshot_id,
      asOf: snapshot.as_of.toISOString(),
      entries: rows,
      nextCursor,
    };
    if (!isRankingPage(page, "server"))
      throw new RankingRepositoryError("CORRUPT_RANKING");
    return page;
  }
  async findPlayerPosition(
    publicPlayerId: string,
    snapshotId?: string,
  ): Promise<RankingEntry | null> {
    if (
      !identifier(publicPlayerId) ||
      (snapshotId !== undefined && !identifier(snapshotId))
    )
      throw new RankingRepositoryError("INVALID_RANKING_QUERY");
    const snapshot = await this.snapshot(snapshotId);
    if (!snapshot) return null;
    const found = await this.pool.query<Row>(
      `WITH ranked AS (${rankedSql}) SELECT * FROM ranked WHERE player_id=$2`,
      [snapshot.snapshot_id, publicPlayerId],
    );
    return found.rows[0] ? entry(found.rows[0]) : null;
  }
}
let repository: RankingRepository | undefined;
/** Not enabled by a DATABASE_URL alone: real ledger/public-profile integration must be reviewed first. */
export function getProductionRankingRepository(): RankingRepository {
  if (process.env.RANKING_READ_MODEL_READY !== "1" || !process.env.DATABASE_URL)
    throw new RankingRepositoryError("RANKING_NOT_CONFIGURED");
  return (repository ??= new PostgresRankingRepository(
    getProductionPostgresPool(),
  ));
}
