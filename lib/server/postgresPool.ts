import { Pool } from "pg";
let pool: Pool | undefined;
/** Shared target PostgreSQL pool, independent of hosting/auth/payment providers. */
export function getProductionPostgresPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_NOT_CONFIGURED");
  return (pool ??= new Pool({
    connectionString,
    max: 2,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
  }));
}
