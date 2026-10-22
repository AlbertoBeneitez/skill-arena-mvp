import assert from "node:assert/strict";
import {
  MIN_PRODUCTION_SIGNING_SECRET_LENGTH,
  SigningKeyUnavailableError,
  demoSigningKeyAllowed,
  isProductionRuntime,
  legacyStatelessTrainingAllowed,
} from "../lib/server/runtimeMode";
import {
  createMatchManifest,
  issueAttemptTicket,
  processAttemptRecord,
  verifyAttemptTicket,
} from "../lib/server/verifiedMatch";
import {
  publicMatchError,
  requireLegacyStatelessTraining,
} from "../lib/server/publicMatchHttp";
import { PublicAttemptError } from "../lib/server/publicAttemptRepository";

// 1. Pure mode decisions, independent of the real environment.
assert.equal(isProductionRuntime({}), false);
assert.equal(isProductionRuntime({ VERCEL: "1" }), true);
assert.equal(isProductionRuntime({ NODE_ENV: "production" }), true);
assert.equal(isProductionRuntime({ NODE_ENV: "development" }), false);

assert.equal(demoSigningKeyAllowed({}), true, "local/test keeps the demo key");
assert.equal(demoSigningKeyAllowed({ NODE_ENV: "production" }), false);
assert.equal(demoSigningKeyAllowed({ VERCEL: "1" }), false);
assert.equal(
  demoSigningKeyAllowed({ NODE_ENV: "production", ALLOW_DEMO_SIGNING_KEY: "1" }),
  true,
  "a self-hosted production-build QA run may opt in",
);
assert.equal(
  demoSigningKeyAllowed({ VERCEL: "1", ALLOW_DEMO_SIGNING_KEY: "1" }),
  false,
  "Vercel can never opt in to the public key",
);

assert.equal(legacyStatelessTrainingAllowed({}), true);
assert.equal(legacyStatelessTrainingAllowed({ VERCEL: "1" }), false);
assert.equal(
  legacyStatelessTrainingAllowed({ VERCEL: "1", ALLOW_LEGACY_STATELESS_TRAINING: "1" }),
  true,
);
assert.equal(
  legacyStatelessTrainingAllowed({ VERCEL: "1", ALLOW_LEGACY_STATELESS_TRAINING: "true" }),
  false,
  "only the literal 1 opts in",
);

// 2. Real behaviour through the signer, with the process environment restored.
const keys = [
  "VERCEL",
  "NODE_ENV",
  "MATCH_SIGNING_SECRET",
  "ALLOW_DEMO_SIGNING_KEY",
  "ALLOW_LEGACY_STATELESS_TRAINING",
] as const;
const env = process.env as Record<string, string | undefined>;
const saved = Object.fromEntries(keys.map((key) => [key, env[key]]));
const reset = () => {
  for (const key of keys) delete env[key];
};
const manifest = createMatchManifest({ gameId: "tower-drop" });
const issue = () =>
  issueAttemptTicket({ manifest, playerId: "gate-fixture", ttlMinutes: 5 });
const unavailable = (error: unknown) =>
  error instanceof SigningKeyUnavailableError &&
  error.code === "SIGNING_KEY_NOT_CONFIGURED";

try {
  reset();
  const demoTicket = issue();
  assert.equal(demoTicket.security_mode, "demo");
  assert.equal(verifyAttemptTicket(demoTicket, manifest).ok, true);

  // Production without a secret fails closed instead of using the public key.
  env.VERCEL = "1";
  assert.throws(issue, unavailable);
  const refused = processAttemptRecord({});
  assert.equal(refused.status, 503);
  assert.deepEqual(refused.body, {
    ok: false,
    verified: false,
    error: "SIGNING_KEY_NOT_CONFIGURED",
  });
  const mapped = publicMatchError(new SigningKeyUnavailableError());
  assert.equal(mapped.status, 503);
  assert.deepEqual(await mapped.json(), {
    ok: false,
    verified: false,
    error: "SIGNING_KEY_NOT_CONFIGURED",
  });

  // A too-short production secret is rejected too.
  env.MATCH_SIGNING_SECRET = "x".repeat(MIN_PRODUCTION_SIGNING_SECRET_LENGTH - 1);
  assert.throws(issue, unavailable);
  env.MATCH_SIGNING_SECRET = "x".repeat(MIN_PRODUCTION_SIGNING_SECRET_LENGTH);
  const productionTicket = issue();
  assert.equal(productionTicket.security_mode, "production");
  assert.equal(verifyAttemptTicket(productionTicket, manifest).ok, true);

  // A ticket forged with the public training key is useless once a real secret exists.
  assert.deepEqual(verifyAttemptTicket(demoTicket, manifest), {
    ok: false,
    error: "INVALID_TICKET",
  });

  // Self-hosted production build: demo key only by explicit opt-in, never on Vercel.
  reset();
  env.NODE_ENV = "production";
  assert.throws(issue, unavailable);
  env.ALLOW_DEMO_SIGNING_KEY = "1";
  assert.equal(issue().security_mode, "demo");
  env.VERCEL = "1";
  assert.throws(issue, unavailable);

  // The stateless training gate.
  reset();
  assert.doesNotThrow(requireLegacyStatelessTraining);
  env.VERCEL = "1";
  assert.throws(
    requireLegacyStatelessTraining,
    (e) =>
      e instanceof PublicAttemptError &&
      e.code === "LEGACY_TRAINING_DISABLED" &&
      e.status === 503,
  );
  env.ALLOW_LEGACY_STATELESS_TRAINING = "1";
  assert.doesNotThrow(requireLegacyStatelessTraining);
} finally {
  for (const key of keys) {
    if (saved[key] === undefined) delete env[key];
    else env[key] = saved[key];
  }
}
console.log(
  "Production gates: fail-closed signing key, minimum secret length, public-key tickets rejected, Vercel cannot opt in, stateless training closed by default",
);
