/**
 * Deployment-mode gates shared by the HTTP layer and the ticket signer.
 *
 * "Production" is any Vercel runtime or any process started with
 * NODE_ENV=production (`next start`). Local development and the Node test
 * runner leave both unset, so existing tests keep their demo signing key.
 */
type Env = Record<string, string | undefined>;

/** A real signing secret needs enough entropy to resist offline guessing. */
export const MIN_PRODUCTION_SIGNING_SECRET_LENGTH = 32;

export function isProductionRuntime(env: Env = process.env) {
  return env.VERCEL === "1" || env.NODE_ENV === "production";
}

/**
 * The public training key is committed to the repository, so anyone can forge
 * tickets with it. It is only usable outside production, or on a non-Vercel
 * host whose operator opts in explicitly (e.g. a production-build QA run).
 */
export function demoSigningKeyAllowed(env: Env = process.env) {
  return (
    !isProductionRuntime(env) ||
    (env.VERCEL !== "1" && env.ALLOW_DEMO_SIGNING_KEY === "1")
  );
}

/**
 * The stateless training endpoints store nothing and accept the same terminal
 * record repeatedly. In production they stay closed unless an operator opts in.
 */
export function legacyStatelessTrainingAllowed(env: Env = process.env) {
  return !isProductionRuntime(env) || env.ALLOW_LEGACY_STATELESS_TRAINING === "1";
}

export class SigningKeyUnavailableError extends Error {
  readonly code = "SIGNING_KEY_NOT_CONFIGURED";
  constructor() {
    super("SIGNING_KEY_NOT_CONFIGURED");
  }
}
