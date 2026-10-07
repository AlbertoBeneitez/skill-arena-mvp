import {
  RANKING_MAX_LIMIT,
  RANKING_PAGE_LIMIT,
  type RankingEntry,
  type RankingPage,
} from "../ranking";
export type RankingQuery = Readonly<{ limit: number; cursor: string | null }>;
export interface RankingRepository {
  readGlobalNetProfit(query: RankingQuery): Promise<RankingPage>;
  findPlayerPosition(
    publicPlayerId: string,
    snapshotId?: string,
  ): Promise<RankingEntry | null>;
}
export class RankingRepositoryError extends Error {
  constructor(
    public readonly code:
      | "RANKING_NOT_CONFIGURED"
      | "INVALID_RANKING_QUERY"
      | "INVALID_RANKING_CURSOR"
      | "CORRUPT_RANKING",
  ) {
    super(code);
    this.name = "RankingRepositoryError";
  }
}
export function parseRankingQuery(params: URLSearchParams): RankingQuery {
  const raw = params.get("limit") ?? String(RANKING_PAGE_LIMIT),
    cursor = params.get("cursor");
  if (
    !/^[0-9]{1,3}$/.test(raw) ||
    Number(raw) < 1 ||
    Number(raw) > RANKING_MAX_LIMIT ||
    (cursor !== null &&
      (!cursor || cursor.length > 512 || !/^[A-Za-z0-9_-]+$/.test(cursor)))
  )
    throw new RankingRepositoryError("INVALID_RANKING_QUERY");
  return { limit: Number(raw), cursor };
}
