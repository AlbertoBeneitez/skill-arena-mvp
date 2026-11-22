import { getProductionPostgresPool } from "./postgresPool";
import { PostgresPublicAttemptRepository } from "./postgresPublicAttemptRepository";
import { PostgresMatchRepository } from "./postgresMatchRepository";
import { PostgresCommandAttemptRepository } from "./postgresCommandAttemptRepository";
import { HiddenMatchService } from "./hiddenMatchService";
import { getPublicMatchService, publicMatchError } from "./publicMatchHttp";
import { PublicAttemptError } from "./publicAttemptRepository";
import { CommandAuthorityError } from "./commandAttemptRepository";
import { hiddenError } from "./hiddenHttp";

/**
 * Paired hidden-information matches use the same durable storage as the other public matches, behind one more
 * explicit switch: ALLOW_HIDDEN_MATCHES=1 (set by the owner in Vercel; it costs nothing). Off, the routes refuse.
 */
export const hiddenMatchesRequested = () => process.env.ALLOW_HIDDEN_MATCHES === "1";

export function getHiddenMatchService() {
  if (!hiddenMatchesRequested()) throw new PublicAttemptError("HIDDEN_MATCHES_DISABLED", 503);
  getPublicMatchService(); // same storage gates (persisted matches, PostgreSQL URL, TLS)
  const pool = getProductionPostgresPool();
  return new HiddenMatchService(
    new PostgresPublicAttemptRepository(pool),
    new PostgresMatchRepository(pool),
    new PostgresCommandAttemptRepository(pool),
  );
}

export function hiddenMatchError(error: unknown) {
  return error instanceof CommandAuthorityError ? hiddenError(error) : publicMatchError(error);
}
