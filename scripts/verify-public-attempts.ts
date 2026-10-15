import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { PublicMatchService } from "../lib/server/publicMatchService";
import { PostgresPublicAttemptRepository } from "../lib/server/postgresPublicAttemptRepository";
import { PublicAttemptError } from "../lib/server/publicAttemptRepository";
import { getServerGameAdapter } from "../lib/server/gameVerifiers";
import { STACK_3D_CORE as core } from "../lib/verified/precisionStackCore.v3";
import { canonicalJson } from "../lib/verified/canonical";
import { sha256 } from "../lib/server/matchIntegrity";
import {
  getPublicMatchService,
  sameOrigin,
} from "../lib/server/publicMatchHttp";
import { MAX_ATTEMPT_RECORD_BYTES } from "../lib/publicMatch";
import { GAMES } from "../lib/games";
const connectionString = process.env.TEST_DATABASE_URL;
assert.ok(connectionString, "TEST_DATABASE_URL required; no skip");
const url = new URL(connectionString);
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
assert.equal(url.pathname, "/skill_arena_test");
const schema = "qa_public_" + randomBytes(8).toString("hex"),
  admin = new Pool({ connectionString, max: 1 }),
  pool = new Pool({
    connectionString,
    max: 12,
    options: `-c search_path=${schema}`,
  });
const originalNow = Date.now;
let offset = 0;
Date.now = () => originalNow() + offset;
const repo = new PostgresPublicAttemptRepository(pool),
  service = new PublicMatchService(repo);
const start = (
  actor: string,
  game_id = "precision-stack",
  start_key = randomUUID(),
) => service.start(actor, { game_id, stake_minor: 0, start_key });
const rejects = async (work: () => Promise<unknown>, code: string) =>
  assert.rejects(
    work,
    (e) => e instanceof PublicAttemptError && e.code === code,
  );
try {
  await admin.query(`CREATE SCHEMA ${schema}`);
  for (const file of ["001-matches.sql", "003-public-attempts.sql"])
    await pool.query(await readFile("db/migrations/" + file, "utf8"));
  // Explicit migration is repeatable and assigned participant/manifest immutability survives.
  await pool.query(
    await readFile("db/migrations/003-public-attempts.sql", "utf8"),
  );
  const proxyHeaders = {
    host: "preview.example.invalid",
    origin: "https://preview.example.invalid",
    "x-forwarded-proto": "https",
  };
  assert.doesNotThrow(() =>
    sameOrigin(
      new Request("http://internal:3105/api", { headers: proxyHeaders }),
    ),
  );
  assert.throws(
    () =>
      sameOrigin(
        new Request("http://internal:3105/api", {
          headers: { ...proxyHeaders, origin: "https://attacker.invalid" },
        }),
      ),
    (e) => e instanceof PublicAttemptError && e.status === 403,
  );
  const configuration = {
    allow: process.env.ALLOW_PERSISTED_MATCH_TRAINING,
    db: process.env.DATABASE_URL,
    vercel: process.env.VERCEL,
  };
  try {
    process.env.ALLOW_PERSISTED_MATCH_TRAINING = "1";
    delete process.env.DATABASE_URL;
    assert.throws(
      () => getPublicMatchService(),
      (e) =>
        e instanceof PublicAttemptError &&
        e.code === "MATCH_STORAGE_UNAVAILABLE",
    );
    process.env.DATABASE_URL =
      "postgres://fixture@db.invalid/fixture?sslmode=require";
    assert.throws(
      () => getPublicMatchService(),
      (e) =>
        e instanceof PublicAttemptError &&
        e.code === "MATCH_STORAGE_UNAVAILABLE",
    );
    process.env.DATABASE_URL = connectionString;
    process.env.VERCEL = "1";
    assert.throws(
      () => getPublicMatchService(),
      (e) =>
        e instanceof PublicAttemptError &&
        e.code === "MATCH_STORAGE_UNAVAILABLE",
    );
  } finally {
    for (const [key, value] of [
      ["ALLOW_PERSISTED_MATCH_TRAINING", configuration.allow],
      ["DATABASE_URL", configuration.db],
      ["VERCEL", configuration.vercel],
    ]) {
      if (value === undefined) delete process.env[key!];
      else process.env[key!] = value;
    }
  }
  for (const game of GAMES) {
    const adapter = getServerGameAdapter(game.id);
    if (!adapter) continue;
    const n = adapter.inputProtocol.maxInputs,
      action = adapter.inputProtocol.allowedActions.reduce(
        (a, b) => (a.length > b.length ? a : b),
        "",
      );
    const estimate =
      n *
        (JSON.stringify({
          seq: n,
          tick: adapter.simulation.maxFinalTick,
          action,
        }).length +
          1) +
      4096;
    assert.ok(
      estimate <= MAX_ATTEMPT_RECORD_BYTES,
      `${game.id} valid protocol exceeds shared HTTP byte limit`,
    );
  }
  const actor = "actor-A",
    key = randomUUID();
  const repeated = await Promise.all(
    Array.from({ length: 8 }, () => start(actor, "precision-stack", key)),
  );
  const a = repeated[0];
  assert.ok(repeated.every((r) => r.ticket.attempt_id === a.ticket.attempt_id));
  assert.equal(a.manifest.manifest_version, 3);
  assert.equal(a.manifest.competition.target_score, 1e9);
  const metadata = GAMES.find(
    (g) => g.id === "precision-stack",
  )! as unknown as { version: string; enabled: boolean };
  const savedMetadata = { ...metadata };
  try {
    metadata.version = "999.0.0";
    metadata.enabled = false;
    assert.equal(
      (await start(actor, "precision-stack", key)).manifest.game_version,
      a.manifest.game_version,
      "retry must recover its pinned match across catalogue upgrades/retirement",
    );
  } finally {
    metadata.version = savedMetadata.version;
    metadata.enabled = savedMetadata.enabled;
  }
  await rejects(() => start(actor, "billiards", key), "START_KEY_CONFLICT");
  await rejects(() => start(actor), "ATTEMPT_ALREADY_ACTIVE");
  await rejects(
    () =>
      service.start(actor, {
        game_id: "precision-stack",
        stake_minor: 0,
        start_key: randomUUID(),
        seed: "chosen",
      }),
    "INVALID_START",
  );
  await rejects(
    () => service.read("outsider", a.ticket.attempt_id),
    "ATTEMPT_NOT_FOUND",
  );
  const state = core.create(a.manifest.seed),
    inputs: { seq: number; tick: number; action: string }[] = [];
  while (state.status === "running" && state.tick < 1000) {
    if (core.canApply(state, "DROP")) {
      inputs.push({ seq: inputs.length, tick: state.tick, action: "DROP" });
      core.apply(state, "DROP");
    }
    if (state.status === "running") core.step(state);
  }
  const fixture = { inputs, finalTick: state.tick };
  const adapter = getServerGameAdapter("precision-stack", "3.0.0")!;
  const replay = adapter.replay({
    manifest: a.manifest,
    inputs: fixture.inputs,
    finalTick: fixture.finalTick,
  });
  assert.equal(replay.valid, true);
  const payload = {
    attempt_id: a.ticket.attempt_id,
    inputs: fixture.inputs,
    final_tick: fixture.finalTick,
  };
  const replies = await Promise.all(
    Array.from({ length: 8 }, () => service.submit(actor, payload)),
  );
  const stored = await service.read(actor, a.ticket.attempt_id);
  assert.equal(stored.body.verified, true);
  assert.equal(stored.body.score, replay.score);
  assert.ok(
    replies.every(
      (r) =>
        r.status === 202 ||
        r.body.verification_id === stored.body.verification_id,
    ),
  );
  assert.equal(
    (await service.submit(actor, payload)).body.verification_id,
    stored.body.verification_id,
  );
  await rejects(
    () =>
      service.submit(actor, { ...payload, final_tick: fixture.finalTick + 1 }),
    "RECORD_CONFLICT",
  );
  assert.equal(
    (await service.availability(actor, 0)).find(
      (r) => r.gameId === "precision-stack",
    )?.mode,
    "waiting",
  );
  const candidates = await Promise.all([start("actor-B"), start("actor-C")]);
  const joined = candidates.find(
    (r) => r.manifest.match_id === a.manifest.match_id,
  )!;
  assert.ok(joined);
  assert.equal(
    candidates.filter((r) => r.manifest.match_id === a.manifest.match_id)
      .length,
    1,
  );
  assert.deepEqual(joined.manifest, a.manifest);
  assert.equal(joined.ticket.slot, "B");
  await assert.rejects(() =>
    pool.query("UPDATE arena_matches SET player_b=$2 WHERE match_id=$1", [
      a.manifest.match_id,
      "outsider",
    ]),
  );
  await assert.rejects(() =>
    pool.query(
      `UPDATE arena_matches SET manifest=jsonb_set(manifest,'{seed}','"tampered"') WHERE match_id=$1`,
      [a.manifest.match_id],
    ),
  );
  const bActor = joined.ticket.player_id;
  const abandoned = await service.submit(bActor, {
    attempt_id: joined.ticket.attempt_id,
    inputs: [],
    final_tick: 0,
    record_kind: "abandoned",
  });
  assert.equal(abandoned.body.forfeited, true);
  assert.equal(abandoned.body.verified, false);
  assert.equal(abandoned.body.match?.winnerSlot, "A");
  assert.equal(
    (await service.read(actor, a.ticket.attempt_id)).body.match?.winnerSlot,
    "A",
  );
  const audit = await pool.query(
    "SELECT replay_audit FROM arena_public_attempts WHERE attempt_id=$1",
    [joined.ticket.attempt_id],
  );
  assert.ok(audit.rows[0].replay_audit);
  // A new worker can recover results; pulse/abandon cannot change a committed terminal.
  const restarted = new PublicMatchService(
    new PostgresPublicAttemptRepository(pool),
  );
  assert.equal(
    (await restarted.read(actor, a.ticket.attempt_id)).body.verification_id,
    stored.body.verification_id,
  );
  assert.equal(
    (await restarted.pulse(actor, a.ticket.attempt_id, true)).verified,
    true,
  );
  const x = await start("disconnect");
  await pool.query(
    "UPDATE arena_public_attempts SET lease_until=clock_timestamp()-interval '1 second' WHERE attempt_id=$1",
    [x.ticket.attempt_id],
  );
  assert.equal(
    (await service.pulse("disconnect", x.ticket.attempt_id)).forfeited,
    true,
  );
  assert.equal(
    (
      await service.submit("disconnect", {
        attempt_id: x.ticket.attempt_id,
        inputs: [],
        final_tick: 0,
        record_kind: "abandoned",
      })
    ).body.forfeited,
    true,
  );
  assert.equal(
    (await service.pulse("disconnect", x.ticket.attempt_id)).state,
    "forfeited",
  );
  const tooFast = await start("too-fast");
  const beforeRead = (
    await pool.query(
      "SELECT lease_until FROM arena_public_attempts WHERE attempt_id=$1",
      [tooFast.ticket.attempt_id],
    )
  ).rows[0].lease_until;
  await service.read("too-fast", tooFast.ticket.attempt_id);
  await service.recent("too-fast");
  const afterRead = (
    await pool.query(
      "SELECT lease_until FROM arena_public_attempts WHERE attempt_id=$1",
      [tooFast.ticket.attempt_id],
    )
  ).rows[0].lease_until;
  assert.equal(
    afterRead.getTime(),
    beforeRead.getTime(),
    "reading history must not extend a playing lease",
  );
  const rejected = await service.submit("too-fast", {
    attempt_id: tooFast.ticket.attempt_id,
    inputs: [],
    final_tick: 2000,
  });
  assert.equal(rejected.body.error, "SIMULATION_FASTER_THAN_REAL_TIME");
  assert.equal(rejected.body.verified, false);
  const q = await start("incomplete");
  const incomplete = await service.submit("incomplete", {
    attempt_id: q.ticket.attempt_id,
    inputs: [],
    final_tick: 0,
  });
  assert.equal(incomplete.body.verified, false);
  assert.equal(incomplete.body.error, "CLIENT_ENDED_BEFORE_RESOLUTION");
  for (const game of GAMES.filter(
    (g) => g.competition.verification === "server-replay",
  )) {
    const actor = "version-" + game.id,
      r = await start(actor, game.id);
    const response = await service.submit(actor, {
      attempt_id: r.ticket.attempt_id,
      inputs: [],
      final_tick: 0,
      record_kind: "abandoned",
    });
    assert.equal(response.body.forfeited, true, game.id);
    assert.equal(response.body.durable, true);
    assert.equal(response.body.verified, false);
  }
  const recovery = await start("worker-recovery");
  const recoveryState = core.create(recovery.manifest.seed),
    recoveryInputs: { seq: number; tick: number; action: string }[] = [];
  while (recoveryState.status === "running" && recoveryState.tick < 1000) {
    if (core.canApply(recoveryState, "DROP")) {
      recoveryInputs.push({
        seq: recoveryInputs.length,
        tick: recoveryState.tick,
        action: "DROP",
      });
      core.apply(recoveryState, "DROP");
    }
    if (recoveryState.status === "running") core.step(recoveryState);
  }
  const recoveryRecord = {
    inputs: recoveryInputs,
    final_tick: recoveryState.tick,
  };
  await repo.receive(
    "worker-recovery",
    recovery.ticket.attempt_id,
    sha256(canonicalJson(recoveryRecord)),
    recoveryRecord,
  );
  offset = 40 * 60 * 1000;
  const recoveredHistory = await restarted.recent("worker-recovery");
  assert.equal(
    recoveredHistory.find((r) => r.attemptId === recovery.ticket.attempt_id)
      ?.state,
    "verified",
    "returning to Avatar must recover a queued record",
  );
  const recovered = await restarted.read(
    "worker-recovery",
    recovery.ticket.attempt_id,
  );
  assert.equal(
    recovered.body.verified,
    true,
    "accepted record survives ticket expiry while processing was interrupted",
  );
  offset = 0;
  await rejects(() => service.submit("outsider", payload), "ATTEMPT_NOT_FOUND");
  await rejects(
    () => service.submit(actor, { ...payload, seed: "changed" }),
    "INVALID_RECORD",
  );
  await assert.rejects(() =>
    pool.query(
      `UPDATE arena_public_attempts SET record='{}'::jsonb WHERE attempt_id=$1`,
      [a.ticket.attempt_id],
    ),
  );
  await assert.rejects(() =>
    pool.query(
      `UPDATE arena_public_matches SET resolution='{}'::jsonb WHERE match_id=$1`,
      [a.manifest.match_id],
    ),
  );
  const seeds = new Set<string>();
  for (let i = 0; i < 1000; i++) {
    const s = await start("rotation-" + i);
    assert.ok(!seeds.has(s.manifest.seed), "scenario repeated in cycle");
    seeds.add(s.manifest.seed);
  }
  assert.equal(seeds.size, 1000);
  const next = await start("rotation-next");
  assert.ok(
    seeds.has(next.manifest.seed),
    "next cycle should reuse its pinned catalogue",
  );
  // All timing-out records are unrecoverably lost even if the browser never sends exit.
  await pool.query(
    "UPDATE arena_public_attempts SET lease_until=clock_timestamp()-interval '1 second' WHERE state='playing'",
  );
  for (let i = 0; i < 12; i++) await service.availability("observer", 0);
  assert.equal(
    Number(
      (
        await pool.query(
          "SELECT count(*) FROM arena_public_attempts WHERE state='playing'",
        )
      ).rows[0].count,
    ),
    0,
  );
  console.log(
    "Public attempts PG: 1000 unique scenarios/cycle, shared manifests, start/record idempotency, race for one seat, replay/result recovery, immutable records, 21 game prefixes, abandon/disconnect/late submission/outsider/forgery rejection passed",
  );
} finally {
  Date.now = originalNow;
  await pool.end();
  await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await admin.end();
}
