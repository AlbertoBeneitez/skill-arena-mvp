import { getLocalHiddenGames } from "./demo/localHiddenGames";
import { PersistedHiddenTraining } from "./persistedHiddenTraining";
import { getProductionPostgresPool } from "./postgresPool";
import { CommandAuthorityError } from "./commandAttemptRepository";
/** Explicit opt-in; never create memory persistence on Vercel. */
export function persistedHiddenTrainingConfigured() {
  if (
    process.env.ALLOW_PERSISTED_HIDDEN_TRAINING !== "1" ||
    !process.env.DATABASE_URL
  )
    return false;
  try {
    const url = new URL(process.env.DATABASE_URL);
    if (!["postgres:", "postgresql:"].includes(url.protocol)) return false;
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    return local
      ? process.env.VERCEL !== "1"
      : url.searchParams.get("sslmode") === "verify-full";
  } catch {
    return false;
  }
}
export function getHiddenTrainingService() {
  if (process.env.ALLOW_PERSISTED_HIDDEN_TRAINING === "1") {
    if (!persistedHiddenTrainingConfigured())
      throw new CommandAuthorityError("UNAVAILABLE");
    return new PersistedHiddenTraining(getProductionPostgresPool());
  }
  return getLocalHiddenGames();
}
