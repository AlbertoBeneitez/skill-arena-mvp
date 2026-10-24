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
import billiardsFixture from "./fixtures/billiards-v2.json" with { type: "json" };
import memoryFixture from "./fixtures/memory-v2.json" with { type: "json" };
import orbFixture from "./fixtures/orb-v2.json" with { type: "json" };

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
    ["galactic-roulette", "1.0.0"],
    ["tower-drop", "2.1.0"],
    ["precision-stack", "1.0.0"],
    ["precision-stack", "2.0.0"],
    ["billiards", "1.0.0"],
    ["darts", "1.0.0"],
    ["reaction-test", "1.0.0"],
    ["darts", "2.0.0"],
    ["orb-burst", "1.0.0"],
    ["memory-match", "1.0.0"],
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

  const aimed = payload("darts", "2.0.0");
  aimed.inputs = [{ seq: 0, tick: 30, action: "AIM_Y_31" }];
  aimed.final_tick = 31;
  receipt(aimed);

  const zero = payload("darts", "3.0.0");
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
  reject({ ...abandon(zero), inputs: [{ seq: 1, tick: 0, action: "AIM_Y_31" }] }, "INVALID_INPUT");
  reject({ ...abandon(zero), inputs: [{ seq: 0, tick: 1, action: "AIM_Y_31" }] }, "INPUT_AFTER_FINAL");
  reject({ ...abandon(zero), final_tick: 2, inputs: [
    { seq: 0, tick: 1, action: "AIM_Y_31" }, { seq: 1, tick: 1, action: "AIM_Y_31" },
  ] }, "INVALID_INPUT_SEQUENCE");
  reject({ ...abandon(zero), final_tick: 2, inputs: [
    { seq: 0, tick: 2, action: "AIM_Y_31" }, { seq: 1, tick: 1, action: "AIM_Y_31" },
  ] }, "INVALID_INPUT_SEQUENCE");
  const adapter = getServerGameAdapter("darts", "3.0.0")!;
  reject({ ...abandon(zero), final_tick: adapter.simulation.maxFinalTick + 1 }, "INVALID_FINAL_TICK");
  reject({ ...abandon(zero), inputs: Array.from({ length: adapter.inputProtocol.maxInputs + 1 },
    (_, seq) => ({ seq, tick: seq, action: "AIM_Y_31" })) }, "PAYLOAD_TOO_LARGE");

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

  const lead = payload("precision-stack", "4.0.0");
  lead.final_tick = 600;
  reject(abandon(lead), "SIMULATION_FASTER_THAN_REAL_TIME", 409);
  now = START_TIME + 10_000;
  receipt(lead);

  const TERMINAL_TICK = 29760; // Darts V3 with no input: every throw times out -> NO_SCORE.
  now += 250_000;
  const terminal = { ...zero, final_tick: TERMINAL_TICK };
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
      inputs: [], finalTick: TERMINAL_TICK,
      result: { score: 0, timeMs: 248000, won: false, height: undefined, failure: "NO_SCORE" },
    }),
    score: 0, time_ms: 248000, height: undefined, failure: "NO_SCORE", won: false,
    authoritative_source: "SERVER_REPLAY", client_score_ignored: true,
  }, "Historical terminal result/hash envelope changed");
  const pool = {
    ...payload("billiards", "2.0.0", billiardsFixture.seed),
    inputs: billiardsFixture.inputs,
    final_tick: billiardsFixture.finalTick,
  };
  now += 40_000;
  const poolInFlight = {
    ...pool,
    inputs: billiardsFixture.inputs.slice(0, 2),
    final_tick: 211,
  };
  receipt(poolInFlight);
  reject(poolInFlight, "CLIENT_ENDED_BEFORE_RESOLUTION");
  const poolResult = processAttemptRecord({ ...pool, client_score: 1e9, won: false, height: 999999 });
  assert.equal(poolResult.status, 200);
  assert.equal(poolResult.body.verified, true);
  if (!poolResult.body.verified) throw new Error("Billar V2 terminal did not verify");
  assert.equal(poolResult.body.height, billiardsFixture.height, "Billar pots must be replayed, never supplied by the browser");
  assert.equal(poolResult.body.score, billiardsFixture.score);
  assert.equal(poolResult.body.time_ms, Math.round(billiardsFixture.finalTick * 1000 / 120));
  assert.equal(poolResult.body.won, true);
  const memoryRun = memoryFixture.runs[0];
  const memory = { ...payload("memory-match", "2.0.0", memoryFixture.seed), inputs: memoryRun.inputs, final_tick: memoryRun.finalTick };
  now += Math.ceil(memoryRun.finalTick * 1000 / 120) + 1000;
  const memoryResult = processAttemptRecord({ ...memory, client_score: 1e9, height: 9999, won: false });
  assert.equal(memoryResult.body.verified, true);
  if (!memoryResult.body.verified) throw new Error("Memory V2 did not verify");
  assert.equal(memoryResult.body.height, 12);
  assert.equal(memoryResult.body.score, 12000);
  assert.equal(memoryResult.body.time_ms, Math.round(memoryRun.finalTick * 1000 / 120));
  assert.equal(memoryResult.body.won, true);
  receipt({ ...memory, inputs: [memoryRun.inputs[0]], final_tick: memoryRun.inputs[0].tick + 1 });
  reject(abandon(memory), "TERMINAL_RECORD_REQUIRES_VERIFICATION");

  const course = orbFixture.runs[0];
  const orbInputs = course.inputs.map(([tick, action], seq) => ({
    seq, tick: Number(tick), action: String(action),
  }));
  const orb = {
    ...payload("orb-burst", "2.0.0", course.seed),
    inputs: orbInputs,
    final_tick: course.finalTick,
  };
  now += Math.ceil(course.finalTick * 1000 / 120) + 1000;
  const orbPrefix = {
    ...orb,
    inputs: orbInputs.filter(input => input.tick <= 300),
    final_tick: 300,
  };
  assert.ok(orbPrefix.inputs.some(input => input.action === "SHOOT"), "Orb abandoned prefix includes the actual in-flight launch");
  receipt(orbPrefix);
  reject(orbPrefix, "CLIENT_ENDED_BEFORE_RESOLUTION");
  const orbResult = processAttemptRecord({ ...orb, client_score: 1e9, won: false, height: 999999 });
  assert.equal(orbResult.status, 200);
  assert.equal(orbResult.body.verified, true);
  if (!orbResult.body.verified) throw new Error("Orb V2 terminal did not verify");
  assert.equal(orbResult.body.height, course.height, "Orb advance comes only from replayed original IDs, never client totals");
  assert.equal(orbResult.body.score, course.score);
  assert.equal(orbResult.body.time_ms, Math.round(course.finalTick * 1000 / 120));
  assert.equal(orbResult.body.won, true);
  reject(abandon(orb), "TERMINAL_RECORD_REQUIRES_VERIFICATION");
  reject(abandon(terminal), "TERMINAL_RECORD_REQUIRES_VERIFICATION");
  reject({ ...abandon(terminal), final_tick: TERMINAL_TICK + 1 }, "FINAL_TICK_AFTER_RESOLUTION");
  reject({ ...abandon(terminal), inputs: [{ seq: 0, tick: TERMINAL_TICK, action: "AIM_Y_31" }] }, "UNCONSUMED_INPUTS");
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
