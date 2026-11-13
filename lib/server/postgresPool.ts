import { Pool } from "pg";
let pool: Pool | undefined;
/** Shared target PostgreSQL pool, independent of hosting/auth/payment providers. */
export function getProductionPostgresPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_NOT_CONFIGURED");
  if (pool) return pool;
  pool = new Pool({
    connectionString,
    max: 2,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
    // v186: a query that does not answer in 10 s fails instead of holding the connection. Client-side on purpose:
    // Neon's pooled endpoint (PgBouncer) may refuse server settings sent as startup parameters.
    query_timeout: 10000,
  });
  // v186: an idle connection dropped by the server (Neon scales to zero) must not crash the instance.
  pool.on("error", (error) => console.error("postgres pool:", error.message));
  return pool;
}
