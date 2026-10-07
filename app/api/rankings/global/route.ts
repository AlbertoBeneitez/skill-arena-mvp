import {
  parseRankingQuery,
  RankingRepositoryError,
} from "@/lib/server/rankingRepository";
import { getProductionRankingRepository } from "@/lib/server/postgresRankingRepository";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  try {
    const query = parseRankingQuery(new URL(request.url).searchParams);
    const page =
      await getProductionRankingRepository().readGlobalNetProfit(query);
    return Response.json(page, { headers });
  } catch (error) {
    if (
      error instanceof RankingRepositoryError &&
      ["INVALID_RANKING_QUERY", "INVALID_RANKING_CURSOR"].includes(error.code)
    )
      return Response.json(
        { source: "server", error: error.code },
        { status: 400, headers },
      );
    if (error instanceof RankingRepositoryError && error.code === "RANKING_NOT_CONFIGURED")
      return Response.json({ source: "server", status: "not-configured" }, { headers });
    // Do not expose database, financial details or silently substitute demo data.
    return Response.json(
      { source: "server", status: "unavailable", error: "RANKING_UNAVAILABLE" },
      { status: 503, headers },
    );
  }
}
