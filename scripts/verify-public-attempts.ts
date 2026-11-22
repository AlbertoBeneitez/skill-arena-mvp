import assert from "node:assert/strict";
import { getGameDefinition, playableForMoney } from "../lib/games";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { PublicMatchService } from "../lib/server/publicMatchService";
import { PostgresPublicAttemptRepository, trainingLimits } from "../lib/server/postgresPublicAttemptRepository";
import { pruneOldAttempts } from "../lib/server/attemptRetention";
import { PublicAttemptError } from "../lib/server/publicAttemptRepository";
import { getServerGameAdapter } from "../lib/server/gameVerifiers";
import { STACK_3D_CORE as core } from "../lib/verified/precisionStackCore.v4";
import { canonicalJson } from "../lib/verified/canonical";
import { sha256 } from "../lib/server/matchIntegrity";
import {
  getPublicMatchService,
  sameOrigin,
} from "../lib/server/publicMatchHttp";
import { decidePublicMatch, LOWER_SCORE_WINS_GAMES, MAX_ATTEMPT_RECORD_BYTES, PUBLIC_MATCH_POLICY, PUBLIC_MATCH_POLICY_V1 } from "../lib/publicMatch";
import { GAMES, lowerScoreWins } from "../lib/games";
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
  // v208: new matches are stored under policy V2 (migration 014, repeatable).
  for (let i = 0; i < 2; i++) await pool.query(await readFile("db/migrations/014-public-match-policy-v2.sql", "utf8"));
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
  const adapter = getServerGameAdapter("precision-stack", "4.0.0")!;
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
  // v189/v192 · Games of chance (Roulette, hidden) are never played for money; Slot is a game of skill for money.
  assert.equal(playableForMoney(getGameDefinition("galactic-roulette")!), false);
  assert.equal(playableForMoney(getGameDefinition("galactic-slot")!), true);
  // v179 · Platform pools. Before migration 006 every match is a phone match and computers are refused.
  await rejects(
    () => service.start("desk-0", { game_id: "precision-stack", stake_minor: 0, start_key: randomUUID(), platform: "desktop" }),
    "PLATFORM_POOL_UNAVAILABLE",
  );
  await rejects(
    () => service.start("desk-0", { game_id: "precision-stack", stake_minor: 0, start_key: randomUUID(), platform: "tablet" }),
    "INVALID_START",
  );
  for (let i = 0; i < 2; i++) await pool.query(await readFile("db/migrations/006-platform-pools.sql", "utf8"));
  const pooled = new PublicMatchService(new PostgresPublicAttemptRepository(pool));
  const startOn = (actor: string, platform: "mobile" | "desktop") =>
    pooled.start(actor, { game_id: "precision-stack", stake_minor: 0, start_key: randomUUID(), platform });
  const playAndSubmit = async (actor: string, started: Awaited<ReturnType<typeof start>>) => {
    const st = core.create(started.manifest.seed), ins: { seq: number; tick: number; action: string }[] = [];
    while (st.status === "running" && st.tick < 1000) {
      if (core.canApply(st, "DROP")) { ins.push({ seq: ins.length, tick: st.tick, action: "DROP" }); core.apply(st, "DROP"); }
      if (st.status === "running") core.step(st);
    }
    const out = await pooled.submit(actor, { attempt_id: started.ticket.attempt_id, inputs: ins, final_tick: st.tick });
    assert.ok(out.status === 200 || out.status === 202);
  };
  const deskA = await startOn("desk-A", "desktop");
  assert.equal(deskA.ticket.slot, "A");
  await playAndSubmit("desk-A", deskA);
  assert.equal(
    (await pooled.availability("desk-B", 0, "desktop")).find((r) => r.gameId === "precision-stack")?.mode,
    "existing",
    "a computer sees the computer's open match",
  );
  const phone = await startOn("phone-Z", "mobile");
  assert.notEqual(phone.manifest.match_id, deskA.manifest.match_id, "a phone never joins a computer's match");
  const deskB = await startOn("desk-B", "desktop");
  assert.equal(deskB.manifest.match_id, deskA.manifest.match_id, "computers are paired with computers");
  assert.equal(deskB.ticket.slot, "B");
  assert.equal(
    (await pool.query("SELECT platform FROM arena_public_matches WHERE match_id=$1", [deskA.manifest.match_id])).rows[0].platform,
    "desktop",
  );
  assert.equal(
    (await pool.query("SELECT platform FROM arena_public_matches WHERE match_id=$1", [phone.manifest.match_id])).rows[0].platform,
    "mobile",
  );
  // v203 · Solo (Offline) matches: refused before migration 012, then never paired, never offered, never with an entry.
  await rejects(() => pooled.start("solo-0", { game_id: "precision-stack", stake_minor: 0, start_key: randomUUID(), platform: "mobile", solo: true }), "SOLO_UNAVAILABLE");
  for (let i = 0; i < 2; i++) await pool.query(await readFile("db/migrations/012-solo-matches.sql", "utf8"));
  const soloService = new PublicMatchService(new PostgresPublicAttemptRepository(pool));
  await rejects(() => soloService.start("solo-1", { game_id: "precision-stack", stake_minor: 100, start_key: randomUUID(), platform: "mobile", solo: true }), "INVALID_START");
  await rejects(() => soloService.start("solo-1", { game_id: "precision-stack", stake_minor: 0, start_key: randomUUID(), platform: "mobile", solo: "yes" }), "INVALID_START");
  const waitingPhone = await soloService.start("solo-W", { game_id: "precision-stack", stake_minor: 0, start_key: randomUUID(), platform: "mobile" });
  await playAndSubmit("solo-W", waitingPhone);
  const soloA = await soloService.start("solo-1", { game_id: "precision-stack", stake_minor: 0, start_key: randomUUID(), platform: "mobile", solo: true });
  assert.equal(soloA.ticket.slot, "A", "a solo start never joins someone's waiting match");
  assert.notEqual(soloA.manifest.match_id, waitingPhone.manifest.match_id);
  await playAndSubmit("solo-1", soloA);
  assert.equal((await pool.query("SELECT solo FROM arena_public_matches WHERE match_id=$1", [soloA.manifest.match_id])).rows[0].solo, true);
  const nextPhone = await soloService.start("solo-2", { game_id: "precision-stack", stake_minor: 0, start_key: randomUUID(), platform: "mobile" });
  assert.notEqual(nextPhone.manifest.match_id, soloA.manifest.match_id, "nobody is paired into a solo match");
  // v208 · Policy V2: new matches are stored under V2 and decided by each game's score in its own direction; V1
  // matches keep the archived rule (height, then time).
  assert.equal((await pool.query("SELECT policy_version FROM arena_public_matches WHERE match_id=$1", [soloA.manifest.match_id])).rows[0].policy_version, PUBLIC_MATCH_POLICY);
  assert.equal(PUBLIC_MATCH_POLICY, "forfeit-on-disconnect-v2");
  const fast = { score: 2_000, height: 9_000, time_ms: 9_000 }, slow = { score: 3_000, height: 8_000, time_ms: 9_000 };
  assert.deepEqual(decidePublicMatch(PUBLIC_MATCH_POLICY, "reaction-test", fast, slow), { winner: "A", reason: "score" }, "Shot Gallery: fewer ms wins");
  assert.deepEqual(decidePublicMatch(PUBLIC_MATCH_POLICY_V1, "reaction-test", fast, slow), { winner: "A", reason: "reach" }, "V1 archived: reach mirror");
  const tallNarrow = { score: 600_700, height: 6, time_ms: 5_000 }, tallWide = { score: 600_830, height: 6, time_ms: 4_000 }, short = { score: 500_999, height: 5, time_ms: 1_000 };
  assert.deepEqual(decidePublicMatch(PUBLIC_MATCH_POLICY, "precision-stack", tallNarrow, tallWide), { winner: "B", reason: "score" }, "Stack: same height, more surface wins");
  assert.deepEqual(decidePublicMatch(PUBLIC_MATCH_POLICY, "precision-stack", short, tallNarrow), { winner: "B", reason: "score" }, "Stack: more blocks always win");
  assert.deepEqual(decidePublicMatch(PUBLIC_MATCH_POLICY_V1, "precision-stack", tallNarrow, tallWide), { winner: "B", reason: "time" }, "V1 archived: time tie-break");
  assert.deepEqual(decidePublicMatch(PUBLIC_MATCH_POLICY, "darts", { score: 5, time_ms: 9 }, { score: 5, time_ms: 7 }), { winner: "B", reason: "time" });
  assert.deepEqual(decidePublicMatch(PUBLIC_MATCH_POLICY, "darts", { score: 5, time_ms: 7 }, { score: 5, time_ms: 7 }), { winner: null, reason: "exact-tie" });
  for (const g of GAMES) assert.equal(LOWER_SCORE_WINS_GAMES.has(g.id), lowerScoreWins(g), `${g.id}: score direction mirrors the catalogue`);
  await assert.rejects(pool.query("UPDATE arena_public_matches SET policy_version='forfeit-on-disconnect-v9' WHERE match_id=$1", [soloA.manifest.match_id]));
  // v228: 90-day retention of inputs — the result stays, the inputs become a stub; only the job may do it.
  {
    const done = (await pool.query("SELECT attempt_id, response, record_hash FROM arena_public_attempts WHERE state='verified' AND record IS NOT NULL LIMIT 1")).rows[0];
    await assert.rejects(pool.query(`UPDATE arena_public_attempts SET record='{"pruned_at":"x"}'::jsonb WHERE attempt_id=$1`, [done.attempt_id]), "outside the job the record is immutable");
    for (let i = 0; i < 2; i++) await pool.query(await readFile("db/migrations/018-attempt-retention.sql", "utf8")); // repeatable
    assert.equal(await pruneOldAttempts(pool), 0, "nothing is 90 days old yet");
    assert.ok(await pruneOldAttempts(pool, -1) >= 1, "old enough: pruned");
    const after = (await pool.query("SELECT response, record_hash, record FROM arena_public_attempts WHERE attempt_id=$1", [done.attempt_id])).rows[0];
    assert.deepEqual([after.response, after.record_hash], [done.response, done.record_hash], "result and hash kept");
    assert.ok(after.record.pruned_at && !after.record.inputs, "inputs gone");
    assert.equal(await pruneOldAttempts(pool, -1), 0, "idempotent");
    await assert.rejects(pool.query("UPDATE arena_public_attempts SET response='{}'::jsonb WHERE attempt_id=$1", [done.attempt_id]), "the result stays immutable");
  }
  // v227 (security review C2 + A1): no global cap; a bare cookie gets 20 starts a day; storage guard before Neon fills.
  const limits = trainingLimits({});
  assert.deepEqual([limits.perAccountDay, limits.perAnonymousDay, limits.storageGuardBytes], [200, 20, 870 * 1024 * 1024]);
  assert.equal(trainingLimits({ TRAINING_MATCHES_PER_ACCOUNT_DAY: "5", TRAINING_MATCHES_PER_COOKIE_DAY: "-1" }).perAccountDay, 5);
  assert.equal(trainingLimits({ TRAINING_MATCHES_PER_COOKIE_DAY: "-1" }).perAnonymousDay, 20, "nonsense overrides fall back");
  for (let i = 0; i < 20; i++) {
    const id = `quota-${i}-${randomBytes(3).toString("hex")}`;
    await pool.query("INSERT INTO arena_matches(match_id, manifest, manifest_hash, player_a) VALUES ($1,$3::jsonb,$2,'quota-cookie')", [id, `sha256:${"0".repeat(64)}`, JSON.stringify({ match_id: id, manifest_version: "3", game_id: "precision-stack" })]);
    await pool.query("INSERT INTO arena_public_matches(match_id, policy_version, scope, expires_at) VALUES ($1,$2,'training', now() + interval '1 day')", [id, PUBLIC_MATCH_POLICY]);
    await pool.query(
      `INSERT INTO arena_public_attempts(attempt_id, match_id, player_id, slot, start_key, request_hash, ticket, state, lease_until, deadline)
       VALUES ($1,$1,'quota-cookie','A',$1,'h','{}'::jsonb,'forfeited', now(), now())`, [id]);
  }
  await rejects(() => start("quota-cookie"), "TRAINING_QUOTA");
  const other = await start("quota-other-cookie");
  assert.ok(other.ticket, "one cookie at its limit does not block anybody else (no global cap)");
  process.env.DATABASE_STORAGE_GUARD_MB = "1";
  await rejects(() => new PublicMatchService(new PostgresPublicAttemptRepository(pool)).start("quota-third", { game_id: "precision-stack", stake_minor: 0, start_key: randomUUID() }), "STORAGE_FULL");
  delete process.env.DATABASE_STORAGE_GUARD_MB;
  console.log(
    "Public attempts PG: 1000 unique scenarios/cycle, shared manifests, start/record idempotency, race for one seat, replay/result recovery, immutable records, 21 game prefixes, abandon/disconnect/late submission/outsider/forgery rejection, phone/computer pools, solo (Offline) matches, policy V2 by game score direction (V1 archived), daily limits per cookie without a global cap, storage guard, 90-day input retention passed",
  );
} finally {
  Date.now = originalNow;
  await pool.end();
  await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await admin.end();
}
