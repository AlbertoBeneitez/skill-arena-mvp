import assert from "node:assert/strict";
import { GAMES, type GameId } from "../lib/games";
import type {
  AbandonedAttemptPayload,
  AttemptTicket,
  VerifiedAttemptPayload,
} from "../lib/verified/contracts";
import {
  createMatchManifest,
  hashManifest,
  hashReplay,
  issueAttemptTicket,
  processAttemptRecord,
} from "../lib/server/verifiedMatch";
import { signAttemptTicket } from "../lib/server/matchIntegrity";
import { getServerGameAdapter } from "../lib/server/gameVerifiers";
import { createPrivateMatchManifest } from "../lib/server/privateMatchIssuer";
import alienFixture from "./fixtures/alien-v3.json" with { type: "json" };

const TEST_SECRET = "attempt-record-test-key-not-for-production";
const START_TIME = Date.parse("2026-10-09T12:00:00.000Z");
const originalNow = Date.now;
const originalSecret = process.env.MATCH_SIGNING_SECRET;
let now = START_TIME;
Date.now = () => now;
process.env.MATCH_SIGNING_SECRET = TEST_SECRET;

function sign(ticket: Omit<AttemptTicket, "signature">): AttemptTicket {
  return { ...ticket, signature: signAttemptTicket(ticket, TEST_SECRET) };
}

function payload(gameId: GameId, gameVersion?: string, seed = "attempt-record-fixture-v1"): VerifiedAttemptPayload {
  const manifest = {
    ...createMatchManifest({ gameId, gameVersion, seed, targetScore: 1e9 }),
    match_id: `record-${gameId}-${gameVersion ?? "current"}`,
    created_at: new Date(START_TIME).toISOString(),
  };
  const { signature: _signature, ...issued } = issueAttemptTicket({
    manifest, playerId: "record-fixture-player", ttlMinutes: 15,
  });
  const ticket = sign({
    ...issued, attempt_id: `attempt-${manifest.match_id}`, nonce: "record-fixture-nonce",
  });
  return { manifest, ticket, inputs: [], final_tick: 0 };
}

function abandon(value: VerifiedAttemptPayload): AbandonedAttemptPayload {
  return { ...value, record_kind: "abandoned" };
}

function receipt(value: VerifiedAttemptPayload) {
  assert.deepEqual(processAttemptRecord(abandon(value)), {
    status: 200,
    body: {
      ok: true, received: true, verified: false, durable: false,
      attempt_id: value.ticket.attempt_id, final_tick: value.final_tick,
    },
  }, `${value.manifest.game_id}@${value.manifest.game_version} unfinished receipt`);
}

function reject(raw: unknown, error: string, status = 400) {
  assert.deepEqual(processAttemptRecord(raw), {
    status,
    body: { ok: false, verified: false, error },
  }, error);
}

try {
  const historical: [GameId, string][] = [
    ["tower-drop", "2.1.0"],
    ["precision-stack", "1.0.0"],
    ["precision-stack", "2.0.0"],
    ["piano-rush", "1.0.0"],
    ["piano-rush", "2.0.0"],
    ["jet-stream", "1.0.0"],
    ["dino-dash", "1.0.0"],
    ["dino-dash", "2.0.0"],
    ["jet-stream", "2.0.0"],
    ["jet-stream", "3.0.0"],
    ["darts", "1.0.0"],
    ["river-dash", "1.0.0"],
    ["river-dash", "2.0.0"],
    ["sky-hop", "1.0.0"],
    ["maze-rush", "1.0.0"],
    ["maze-rush", "2.0.0"],
  ];
  const current: [GameId, string][] = GAMES
    .filter(game => game.competition.verification === "server-replay")
    .map(game => [game.id, game.version]);
  const versions = new Map([...historical, ...current].map(([id, version]) => [`${id}@${version}`, [id, version] as const]));
  for (const [gameId, version] of versions.values()) {
    const zero = payload(gameId, version);
    receipt(zero);
    reject(zero, "CLIENT_ENDED_BEFORE_RESOLUTION");
  }

  for (const version of ["1.0.0", "2.0.0", "3.0.0", "4.0.0"]) {
    const jet = payload("jet-stream", version);
    jet.inputs = [{ seq: 0, tick: 60, action: "FLAP" }];
    jet.final_tick = 61;
    receipt(jet);
    reject(jet, "CLIENT_ENDED_BEFORE_RESOLUTION");
  }
  const aimed = payload("darts", "2.0.0");
  aimed.inputs = [{ seq: 0, tick: 30, action: "AIM_Y_31" }];
  aimed.final_tick = 31;
  receipt(aimed);

  const zero = payload("jet-stream", "3.0.0");
  receipt(zero);
  reject({ ...zero, record_kind: null }, "INVALID_PAYLOAD");
  reject({ ...zero, record_kind: "terminal" }, "INVALID_PAYLOAD");
  reject({ ...zero, record_kind: "anything" }, "INVALID_PAYLOAD");
  for (const malformed of [null, false, "payload", [], {}, { ...abandon(zero), inputs: {} },
    { ...abandon(zero), final_tick: 0.5 }, { ...abandon(zero), ticket: null }]) {
    reject(malformed, "INVALID_PAYLOAD");
  }
  reject({ ...abandon(zero), final_tick: -1 }, "INVALID_FINAL_TICK");
  reject({ ...abandon(zero), inputs: [{ seq: 0, tick: 0, action: "FORBIDDEN" }] }, "INVALID_INPUT");
  reject({ ...abandon(zero), inputs: [{ seq: 1, tick: 0, action: "FLAP" }] }, "INVALID_INPUT");
  reject({ ...abandon(zero), inputs: [{ seq: 0, tick: 1, action: "FLAP" }] }, "INPUT_AFTER_FINAL");
  reject({ ...abandon(zero), final_tick: 2, inputs: [
    { seq: 0, tick: 1, action: "FLAP" }, { seq: 1, tick: 1, action: "FLAP" },
  ] }, "INVALID_INPUT_SEQUENCE");
  reject({ ...abandon(zero), final_tick: 2, inputs: [
    { seq: 0, tick: 2, action: "FLAP" }, { seq: 1, tick: 1, action: "FLAP" },
  ] }, "INVALID_INPUT_SEQUENCE");
  const adapter = getServerGameAdapter("jet-stream", "3.0.0")!;
  reject({ ...abandon(zero), final_tick: adapter.simulation.maxFinalTick + 1 }, "INVALID_FINAL_TICK");
  reject({ ...abandon(zero), inputs: Array.from({ length: adapter.inputProtocol.maxInputs + 1 },
    (_, seq) => ({ seq, tick: seq, action: "FLAP" })) }, "PAYLOAD_TOO_LARGE");

  const billiards = payload("billiards", "1.0.0");
  reject({ ...abandon(billiards), final_tick: 1, inputs: [
    { seq: 0, tick: 0, action: "SHOOT" }, { seq: 1, tick: 1, action: "SHOOT" },
  ] }, "ACTION_NOT_AVAILABLE");
  reject({ ...abandon(zero), ticket: { ...zero.ticket, signature: "forged" } }, "INVALID_TICKET", 401);
  reject({ ...abandon(zero), manifest: { ...zero.manifest, seed: "changed-by-client" } }, "INVALID_TICKET", 401);
  reject({ ...abandon(zero), manifest: { ...zero.manifest, rules_hash: "sha256:forged" } }, "INVALID_MANIFEST");
  reject({ ...abandon(zero), manifest: { ...zero.manifest, game_version: "99.0.0" } }, "UNSUPPORTED_GAME_VERSION");
  const { signature: _oldSignature, ...unsigned } = zero.ticket;
  const expired = sign({ ...unsigned, expires_at: new Date(START_TIME - 1).toISOString() });
  reject({ ...abandon(zero), ticket: expired }, "ATTEMPT_EXPIRED", 401);

  // Private projection routing remains separate; neither a private V3 manifest
  // nor the legacy games gain a public verified submission path in this unit.
  const privateManifest = createPrivateMatchManifest("mine-grid", "1.0.0");
  reject({ ...abandon(zero), manifest: privateManifest }, "INVALID_MANIFEST");
  reject({ ...abandon(zero), manifest: { ...zero.manifest, manifest_version: 3,
    scenario: { scenario_id: "seed-catalog-v1:000000", generator_version: "1.0.0" } } }, "INVALID_MANIFEST");

  const lead = payload("precision-stack", "3.0.0");
  lead.final_tick = 600;
  reject(abandon(lead), "SIMULATION_FASTER_THAN_REAL_TIME", 409);
  now = START_TIME + 10_000;
  receipt(lead);

  const terminal = { ...zero, final_tick: 790 };
  const result = processAttemptRecord({ ...terminal, client_score: 1e9, won: true, height: 999999 });
  assert.equal(result.status, 200);
  assert.equal(result.body.verified, true);
  assert.ok("verification_id" in result.body);
  if (!result.body.verified) throw new Error("Terminal did not verify");
  assert.match(result.body.verification_id!, /^[a-f0-9-]{36}$/);
  assert.deepEqual({ ...result.body, verification_id: undefined }, {
    ok: true, verified: true, verification_id: undefined,
    replay_hash: hashReplay({
      manifestHash: hashManifest(terminal.manifest), attemptId: terminal.ticket.attempt_id,
      inputs: [], finalTick: 790,
      result: { score: 0, timeMs: 6583, won: false, height: undefined, failure: "OUT_OF_BOUNDS" },
    }),
    score: 0, time_ms: 6583, height: undefined, failure: "OUT_OF_BOUNDS", won: false,
    authoritative_source: "SERVER_REPLAY", client_score_ignored: true,
  }, "Historical terminal result/hash envelope changed");
  const reached = { ...payload("jet-stream", "4.0.0"), final_tick: 790 };
  now += 10_000; // This newly-issued ticket must have real elapsed time too.
  const reachedResult = processAttemptRecord({ ...reached, client_score: 1e9, won: true, height: 999999 });
  assert.equal(reachedResult.status, 200);
  assert.equal(reachedResult.body.verified, true);
  if (!reachedResult.body.verified) throw new Error("Current terminal did not verify");
  assert.equal(reachedResult.body.height, 0, "Jet V4 reach must come from replay, never client");
  assert.equal(reachedResult.body.score, 0);
  assert.equal(reachedResult.body.won, false);
  const alien = {
    ...payload("dino-dash", "3.0.0", alienFixture.seed),
    inputs: alienFixture.inputs,
    final_tick: alienFixture.finalTick,
  };
  now += 130_000;
  const alienResult = processAttemptRecord({ ...alien, client_score: 1e9, won: false, height: 999999 });
  assert.equal(alienResult.status, 200);
  assert.equal(alienResult.body.verified, true);
  if (!alienResult.body.verified) throw new Error("Alien V3 terminal did not verify");
  assert.equal(alienResult.body.height, alienFixture.height, "Alien reach must be replayed, never supplied by the browser");
  assert.equal(alienResult.body.score, alienFixture.score);
  assert.equal(alienResult.body.time_ms, 120_000);
  assert.equal(alienResult.body.won, true);
  reject(abandon(terminal), "TERMINAL_RECORD_REQUIRES_VERIFICATION");
  reject({ ...abandon(terminal), final_tick: 791 }, "FINAL_TICK_AFTER_RESOLUTION");
  reject({ ...abandon(terminal), inputs: [{ seq: 0, tick: 790, action: "FLAP" }] }, "UNCONSUMED_INPUTS");
  receipt({ ...zero, final_tick: 1 });
  const clientFields = { ...abandon(zero), client_score: 1e9, won: true, height: 999999 };
  assert.deepEqual(processAttemptRecord(clientFields), processAttemptRecord(abandon(zero)),
    "Client result fields must never enter a receipt");

  console.log(`Attempt records OK · ${versions.size} archived/current zero-input prefixes · input prefixes · exact receipts · default terminal/hash · malformed/semantic/bounds/signature/private/clock rejection`);
} finally {
  Date.now = originalNow;
  if (originalSecret === undefined) delete process.env.MATCH_SIGNING_SECRET;
  else process.env.MATCH_SIGNING_SECRET = originalSecret;
}
