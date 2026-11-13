import { APP_VERSION } from "@/lib/productIdentity";
import { getProductionPostgresPool } from "@/lib/server/postgresPool";

/**
 * v185 · Health check for monitors and for the owner: is the app up, which version, can it reach the database.
 * Says nothing else (no host, no error text, no counts). 503 when the configured database does not answer.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DbState = "ok" | "down" | "not-configured";
/** v186: one database check per minute per server instance, so calling this often cannot keep the free database awake. */
let cached: { at: number; state: DbState } | null = null;
const CACHE_MS = 60_000;

async function database(): Promise<DbState> {
  if (!process.env.DATABASE_URL) return "not-configured";
  const now = Date.now();
  if (cached && now - cached.at < CACHE_MS) return cached.state;
  const state = await probe();
  cached = { at: Date.now(), state };
  return state;
}

async function probe(): Promise<DbState> {
  try {
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 4000));
    await Promise.race([getProductionPostgresPool().query("SELECT 1"), timeout]);
    return "ok";
  } catch {
    return "down";
  }
}

export async function GET() {
  const db = await database();
  return Response.json(
    { ok: db !== "down", version: APP_VERSION, database: db },
    { status: db === "down" ? 503 : 200, headers: { "Cache-Control": "no-store" } },
  );
}
