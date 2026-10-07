import assert from "node:assert/strict";
import { hashManifest, signAttemptTicket } from "../lib/server/matchIntegrity";
import type {
  AttemptTicket,
  MatchManifestV2,
  MatchManifestV3,
} from "../lib/verified/contracts";

// Captured from the V2 server contract; hashes/signature independently pinned
// before introducing V3. Dates and signing key are fixtures, never credentials.
const manifest: MatchManifestV2 = {
  manifest_version: 2,
  match_id: "v2-contract-fixture",
  game_id: "dino-dash",
  game_version: "1.0.0",
  engine_version: "skill-core-1",
  rules_hash: "sha256:cbe252464656632ab1367577800287cbe2fcb8925769f91690ea2f04661cf625",
  gameplay_content_hash: "sha256:2c6258e5fe6f6ccb087b9c2524a62875d42868a41cc448877d70a8e73afa31a4",
  seed: "contract-seed-v1",
  simulation: {
    tick_rate: 120,
    coordinate_width: 390,
    coordinate_height: 620,
    end_condition: "FIRST_COLLISION_OR_TARGET",
  },
  competition: {
    players: 2,
    attempts_per_player: 1,
    stake_minor: 0,
    currency: "EUR",
    tie_rule: "EXACT_TIE_REFUND",
    target_score: 7200,
  },
  input_protocol: {
    version: 1,
    allowed_actions: ["JUMP", "DUCK_DOWN", "DUCK_UP"],
    max_inputs: 5000,
  },
  created_at: "2026-01-01T00:00:00.000Z",
};

const V2_HASH = "sha256:789b41b6011d80dc441b00e1c90932033e33d88151acd377b578c4926a376b0a";
const V2_SIGNATURE = "LkVs73-af-Eb2I1z1C3OJnfth7V8XZWCxGVENWIY7Kc";
const SECRET = "contract-test-secret-not-for-production";
const ticket: Omit<AttemptTicket, "signature"> = {
  attempt_id: "contract-attempt-v2",
  match_id: manifest.match_id,
  player_id: "demo-contract-player",
  slot: "A",
  manifest_hash: V2_HASH,
  issued_at: "2026-01-01T00:00:00.000Z",
  expires_at: "2026-01-01T00:15:00.000Z",
  nonce: "contract-fixture-nonce",
  security_mode: "demo",
};

assert.equal(hashManifest(manifest), V2_HASH, "historical V2 hash changed");
assert.equal(signAttemptTicket(ticket, SECRET), V2_SIGNATURE, "historical V2 signature changed");
const reordered = Object.fromEntries(Object.entries(manifest).reverse()) as MatchManifestV2;
assert.equal(hashManifest(reordered), V2_HASH, "object order affected V2 hash");
assert.equal(signAttemptTicket(Object.fromEntries(Object.entries(ticket).reverse()) as typeof ticket, SECRET), V2_SIGNATURE);
assert.notEqual(signAttemptTicket(ticket, "another-test-secret"), V2_SIGNATURE);

const v3: MatchManifestV3 = {
  ...manifest,
  manifest_version: 3,
  scenario: {
    scenario_id: "seed-catalog-v1:000007",
    generator_version: "1.0.0",
  },
};
const v3Hash = hashManifest(v3);
assert.equal(v3Hash, "sha256:d8a16a7020052ec7c5c2cd691df2176beb4f947f300444acd4e2bfa20b0f657e");
assert.notEqual(v3Hash, V2_HASH, "V3 must not reuse a V2 signature/hash");
assert.equal(hashManifest(structuredClone(v3)), v3Hash);
const v3Ticket = { ...ticket, manifest_hash: v3Hash };
const v3Signature = signAttemptTicket(v3Ticket, SECRET);
assert.notEqual(v3Signature, V2_SIGNATURE, "V2 ticket must not authorize V3");

for (const changed of [
  { ...v3, game_id: "jet-stream" as const },
  { ...v3, game_version: "2.0.0" },
  { ...v3, seed: "client-selected-seed" },
  { ...v3, scenario: { ...v3.scenario, scenario_id: "seed-catalog-v1:000008" } },
  { ...v3, scenario: { ...v3.scenario, generator_version: "2.0.0" } },
]) {
  const changedHash = hashManifest(changed);
  assert.notEqual(changedHash, v3Hash, "competitive scenario identity was not bound");
  assert.notEqual(signAttemptTicket({ ...v3Ticket, manifest_hash: changedHash }, SECRET), v3Signature);
}

// @ts-expect-error V3 requires a scenario descriptor; this is a compile-time gate.
const missingScenario: MatchManifestV3 = { ...manifest, manifest_version: 3 };
void missingScenario;

console.log("Manifest contract OK · V2 hash/signature frozen · V3 scenario tuple bound · routes remain V2");
