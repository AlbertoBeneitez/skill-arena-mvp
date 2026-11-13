import { GAMES, GAME_CREATOR_DEFAULT } from "@/lib/games";
import { getProductionPostgresPool } from "@/lib/server/postgresPool";
import { monthlyPlayCounts, monthRange } from "@/lib/server/playCounts";
import { inboxReachable, isStudioOwner } from "@/lib/server/studioProposals";

/**
 * v186 · Owner only: counted matches per game for one month (?month=2026-11), with who made each game, to pay studios.
 * Anyone else gets 404, so the endpoint's existence is not revealed.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

export async function GET(req: Request) {
  if (!isStudioOwner(req)) return Response.json({ error: "NOT_FOUND" }, { status: 404, headers });
  if (!inboxReachable()) return Response.json({ error: "DATABASE_NOT_CONFIGURED" }, { status: 503, headers });
  const month = new URL(req.url).searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
  if (!monthRange(month)) return Response.json({ error: "INVALID_MONTH" }, { status: 400, headers });
  try {
    const counts = await monthlyPlayCounts(getProductionPostgresPool(), month);
    const creatorOf = (id: string) => GAMES.find((g) => g.id === id)?.creator ?? GAME_CREATOR_DEFAULT;
    return Response.json({ month, games: counts.map((c) => ({ ...c, creator: creatorOf(c.gameId) })) }, { headers });
  } catch {
    return Response.json({ error: "STORAGE_FAILED" }, { status: 503, headers });
  }
}
