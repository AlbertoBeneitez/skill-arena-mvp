import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import { Pool } from "pg";
import { PersistedHiddenTraining } from "../lib/server/persistedHiddenTraining";
import {
  persistedHiddenTrainingConfigured,
  getHiddenTrainingService,
} from "../lib/server/hiddenTrainingService";
import { MINE_GRID_CORE_V2 as core } from "../lib/verified/mineGridCore.v2";
import { nextMineAction } from "./mine-play-fixture";
import {
  applyCoreInput,
  stepCore,
  replayCore,
} from "../lib/verified/coreRuntime.v1";
import { PostgresMatchRepository } from "../lib/server/postgresMatchRepository";
import { PostgresCommandAttemptRepository } from "../lib/server/postgresCommandAttemptRepository";
import { CommandAuthorityError } from "../lib/server/commandAttemptRepository";
const connectionString = process.env.TEST_DATABASE_URL;
assert.ok(connectionString);
const url = new URL(connectionString);
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
assert.equal(url.pathname, "/skill_arena_test");
const schema = `qa_hidden_training_${randomBytes(8).toString("hex")}`;
const admin = new Pool({ connectionString, max: 1 }),
  pool = new Pool({
    connectionString,
    max: 12,
    options: `-c search_path=${schema}`,
  });
const actor = randomBytes(32).toString("hex"),
  outsider = randomBytes(32).toString("hex");
let second: Pool | undefined;
try {
  await admin.query(`CREATE SCHEMA ${schema}`);
  const service = new PersistedHiddenTraining(pool);
  assert.equal(
    await service.available(),
    false,
    "missing migrations are not readiness",
  );
  await pool.query(await readFile("db/migrations/001-matches.sql", "utf8"));
  await pool.query(
    await readFile("db/migrations/002-command-attempts.sql", "utf8"),
  );
  assert.equal(await service.available(), true);
  const boards = new Set<string>();
  let first: Awaited<ReturnType<typeof service.start>> | undefined;
  for (let i = 0; i < 8; i++) {
    const session = await service.start(actor);
    first ??= session;
    assert.equal(session.gameVersion, "2.0.0");
    assert.ok(!("seed" in session) && !("manifest" in session));
    assert.ok(session.view.cells.every((v) => v === null));
    const match = await new PostgresMatchRepository(pool).findMatchForPlayer(
      session.matchId,
      actor,
    );
    assert.ok(match);
    boards.add(JSON.stringify(core.create(match.manifest.seed).board));
  }
  assert.equal(
    boards.size,
    8,
    "successive persisted attempts have different setups",
  );
  assert.ok(first);
  second = new Pool({
    connectionString,
    max: 4,
    options: `-c search_path=${schema}`,
  });
  const restarted = new PersistedHiddenTraining(second);
  assert.deepEqual(
    await restarted.authority.read(first.attemptId, actor),
    first,
    "another worker recovers persisted state",
  );
  await assert.rejects(
    () => restarted.authority.read(first.attemptId, outsider),
    (e) => e instanceof CommandAuthorityError && e.code === "NOT_FOUND",
  );
  const action = `OPEN_${String(first.view.startIndex).padStart(3, "0")}`;
  const command = {
    attemptId: first.attemptId,
    commandId: randomUUID(),
    expectedRevision: 0,
    action,
  };
  const retries = await Promise.all(
    Array.from({ length: 20 }, (_, i) =>
      (i % 2 ? restarted : service).authority.command(command, actor),
    ),
  );
  assert.ok(retries.every((s) => s.revision === 1));
  assert.deepEqual(retries[0], retries.at(-1));
  const storedMatch = await new PostgresMatchRepository(
    pool,
  ).findMatchForPlayer(first.matchId, actor);
  assert.ok(storedMatch);
  const state = core.create(storedMatch.manifest.seed);
  applyCoreInput(core, state, action, 1e9);
  while (state.status === "running") {
    stepCore(core, state, 1e9);
    const next = nextMineAction(state);
    const current = await restarted.authority.read(first.attemptId, actor);
    await service.authority.command(
      {
        attemptId: first.attemptId,
        commandId: randomUUID(),
        expectedRevision: current.revision,
        action: next,
      },
      actor,
    );
    applyCoreInput(core, state, next, 1e9);
  }
  const terminal = await restarted.authority.read(first.attemptId, actor);
  assert.equal(terminal.verified, true);
  assert.equal(terminal.view.reach, 66);
  const record = await new PostgresCommandAttemptRepository(pool).findForPlayer(
    first.attemptId,
    actor,
  );
  assert.ok(record?.terminal);
  assert.equal(record.commands.length, record.inputs.length);
  assert.equal(
    replayCore(
      core,
      [...record.inputs],
      record.inputs.at(-1)!.tick,
      storedMatch.manifest.seed,
      1e9,
    ).valid,
    true,
  );
  await assert.rejects(() =>
    service.authority.command(
      {
        ...command,
        commandId: randomUUID(),
        expectedRevision: terminal.revision,
      },
      actor,
    ),
  );
  // Atomic match+attempt creation rolls back on failure; no orphan manifest.
  const countBefore = await pool.query(
    "SELECT count(*)::int AS n FROM arena_matches",
  );
  await pool.query(
    "ALTER TABLE arena_command_attempts ADD CONSTRAINT qa_reject_new CHECK(false) NOT VALID",
  );
  await assert.rejects(() => service.start(outsider));
  await pool.query(
    "ALTER TABLE arena_command_attempts DROP CONSTRAINT qa_reject_new",
  );
  assert.equal(
    (await pool.query("SELECT count(*)::int AS n FROM arena_matches")).rows[0]
      .n,
    countBefore.rows[0].n,
  );
  const concurrent = await Promise.allSettled(
    Array.from({ length: 25 }, () =>
      new PersistedHiddenTraining(pool).start(actor),
    ),
  );
  assert.equal(
    concurrent.filter((r) => r.status === "fulfilled").length,
    12,
    "20/day bound is shared by workers",
  );
  assert.equal(concurrent.filter((r) => r.status === "rejected").length, 13);
  const total = await pool.query(
    "SELECT count(*)::int AS n FROM arena_matches",
  );
  assert.equal(total.rows[0].n, 20);
  const env = {
    flag: process.env.ALLOW_PERSISTED_HIDDEN_TRAINING,
    url: process.env.DATABASE_URL,
    vercel: process.env.VERCEL,
  };
  try {
    process.env.ALLOW_PERSISTED_HIDDEN_TRAINING = "1";
    delete process.env.DATABASE_URL;
    assert.equal(persistedHiddenTrainingConfigured(), false);
    assert.throws(getHiddenTrainingService, /UNAVAILABLE/);
    process.env.DATABASE_URL = connectionString;
    delete process.env.VERCEL;
    assert.equal(persistedHiddenTrainingConfigured(), true);
    process.env.VERCEL = "1";
    assert.equal(
      persistedHiddenTrainingConfigured(),
      false,
      "Vercel cannot use localhost",
    );
    process.env.DATABASE_URL = "postgres://host.invalid/database";
    assert.equal(
      persistedHiddenTrainingConfigured(),
      false,
      "remote TLS must validate host/certificate",
    );
    process.env.DATABASE_URL =
      "postgres://host.invalid/database?sslmode=verify-full";
    assert.equal(persistedHiddenTrainingConfigured(), true);
  } finally {
    for (const [name, value] of [
      ["ALLOW_PERSISTED_HIDDEN_TRAINING", env.flag],
      ["DATABASE_URL", env.url],
      ["VERCEL", env.vercel],
    ]) {
      if (value === undefined) delete process.env[name!];
      else process.env[name!] = value;
    }
  }
  console.log(
    "Persisted hidden training: distinct setups, worker recovery, authoritative complete replay, idempotent concurrent commands, membership, transactional rollback, cross-worker quotas and TLS/config gates",
  );
} finally {
  await second?.end();
  await pool.end();
  await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await admin.end();
}
