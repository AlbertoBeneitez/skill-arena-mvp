import { GAMES } from "@/lib/games";
import { recordPlays } from "@/lib/server/accounts";
import { accountContext, json, readJson } from "@/lib/server/accountHttp";
import { getProductionPostgresPool } from "@/lib/server/postgresPool";

/**
 * v219 · Matches started per game of the signed-in account («Tu selección»). GET: the counts. POST { add: gameId } counts
 * one match; POST { atLeast: { gameId: n } } raises counts to what this device already had (never lowers one).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KNOWN: ReadonlySet<string> = new Set(GAMES.map((g) => g.id));
const MAX_SYNC = 1_000_000;

export async function GET(req: Request) {
  const ctx = accountContext(req, false);
  if (ctx instanceof Response) return ctx;
  try {
    const counts = await recordPlays(getProductionPostgresPool(), ctx.authKey, {});
    return counts ? json({ counts }) : json({ error: "NO_ACCOUNT" }, 404);
  } catch { return json({ error: "STORAGE_FAILED" }, 503); }
}

export async function POST(req: Request) {
  const ctx = accountContext(req, true);
  if (ctx instanceof Response) return ctx;
  const body = await readJson(req, 4096);
  const add = typeof body?.add === "string" && KNOWN.has(body.add) ? body.add : undefined;
  let atLeast: Record<string, number> | undefined;
  if (body?.atLeast && typeof body.atLeast === "object" && !Array.isArray(body.atLeast)) {
    atLeast = Object.fromEntries(Object.entries(body.atLeast as Record<string, unknown>)
      .filter(([id, n]) => KNOWN.has(id) && typeof n === "number" && Number.isInteger(n) && n > 0 && n <= MAX_SYNC)) as Record<string, number>;
  }
  if (!add && !(atLeast && Object.keys(atLeast).length)) return json({ error: "NOTHING_TO_RECORD" }, 400);
  try {
    const counts = await recordPlays(getProductionPostgresPool(), ctx.authKey, { add, atLeast });
    return counts ? json({ counts }) : json({ error: "NO_ACCOUNT" }, 404);
  } catch { return json({ error: "STORAGE_FAILED" }, 503); }
}
