/**
 * v192 · Runs once when each server instance starts: applies pending database migrations automatically
 * (lib/server/migrations.ts). Never blocks or crashes the app; a failure is logged.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || !process.env.DATABASE_URL) return;
  try {
    const [{ applyMigrations }, { getProductionPostgresPool }] = await Promise.all([
      import("./lib/server/migrations"),
      import("./lib/server/postgresPool"),
    ]);
    const applied = await applyMigrations(getProductionPostgresPool());
    if (applied.length) console.log(`database migrations applied: ${applied.join(", ")}`);
  } catch (error) {
    console.error("database migrations failed:", error instanceof Error ? error.message : error);
  }
}
