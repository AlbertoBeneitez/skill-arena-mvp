import { NextRequest } from "next/server";
import { getGameDefinition } from "@/lib/games";
import { isPlatform } from "@/lib/platform";
import { actorFromRequest } from "@/lib/server/publicMatchHttp";
import { getProductionPostgresPool } from "@/lib/server/postgresPool";
import { MAX_SAMPLE_GAMES, rivalSamples } from "@/lib/server/rivalSamples";

/**
 * v199 · GET ?games=a,b&platform=mobile → { samples: { gameId: [{ score, timeMs }] } }: scores of other players'
 * verified matches, for the invented rivals of an offline group. Without a database it answers an empty set and the
 * app falls back to simulated rivals.
 * v207: lives under /api/verified-match so the browser sends the player cookie (scoped to that path) and the caller's
 * own matches are really left out; at /api/rival-samples it never arrived and a player could meet their own score.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const games = (url.searchParams.get("games") ?? "").split(",").filter((id) => getGameDefinition(id)).slice(0, MAX_SAMPLE_GAMES);
  const platformParam = url.searchParams.get("platform");
  const platform = isPlatform(platformParam) ? platformParam : "mobile";
  if (!games.length || !process.env.DATABASE_URL) return Response.json({ samples: {} }, { headers });
  let me: string | null = null;
  try { me = actorFromRequest(req); } catch { me = null; }
  try {
    return Response.json({ samples: await rivalSamples(getProductionPostgresPool(), games, platform, me) }, { headers });
  } catch {
    return Response.json({ samples: {} }, { headers });
  }
}
