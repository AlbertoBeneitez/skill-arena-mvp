import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { PostgresMatchRepository } from "../lib/server/postgresMatchRepository";
import {
  PostgresCommandAttemptRepository,
  getProductionCommandAttemptRepository,
} from "../lib/server/postgresCommandAttemptRepository";
import { createPrivateMatchManifest } from "../lib/server/privateMatchIssuer";
import { hashManifest } from "../lib/server/matchIntegrity";
import { HiddenCommandAuthority } from "../lib/server/hiddenCommandAuthority";
import {
  CommandAuthorityError,
  type StoredCommandAttempt,
} from "../lib/server/commandAttemptRepository";
import {
  MINE_GRID_CORE as core,
  projectMineState,
} from "../lib/verified/mineGridCore.v1";
const connectionString = process.env.TEST_DATABASE_URL;
assert.ok(connectionString);
const url = new URL(connectionString);
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
assert.equal(url.pathname, "/skill_arena_test");
const schema = `qa_commands_${randomBytes(8).toString("hex")}`,
  admin = new Pool({ connectionString, max: 1 }),
  pool = new Pool({
    connectionString,
    max: 12,
    options: `-c search_path=${schema}`,
  });
let created = false;
try {
  await admin.query(`CREATE SCHEMA ${schema}`);
  created = true;
  await pool.query(await readFile("db/migrations/001-matches.sql", "utf8"));
  const sql = await readFile("db/migrations/002-command-attempts.sql", "utf8");
  await pool.query(sql);
  await pool.query(sql);
  const matches = new PostgresMatchRepository(pool),
    attempts = new PostgresCommandAttemptRepository(pool),
    manifest = createPrivateMatchManifest("mine-grid", "1.0.0");
  await matches.createMatch(manifest, { A: "qa-demo-a", B: "qa-demo-b" });
  const record: StoredCommandAttempt = {
    attemptId: "attempt-a",
    matchId: manifest.match_id,
    playerId: "qa-demo-a",
    revision: 0,
    inputs: [],
    commands: [],
    terminal: false,
    manifestHash: hashManifest(manifest),
  };
  await attempts.create(record);
  await assert.rejects(
    attempts.create({ ...record, attemptId: "duplicate-player" }),
  );
  await assert.rejects(
    attempts.create({ ...record, attemptId: "outsider", playerId: "other" }),
  );
  assert.equal(
    await attempts.findForPlayer(record.attemptId, "qa-demo-b"),
    null,
  );
  assert.equal(
    await attempts.findForPlayer("' OR TRUE --", record.playerId),
    null,
  );
  const authority = new HiddenCommandAuthority(
    matches,
    attempts,
    { core, project: projectMineState },
    "demo",
  );
  const request = {
    attemptId: record.attemptId,
    commandId: "first",
    expectedRevision: 0,
    action: "OPEN_007",
  };
  const retries = await Promise.all(
    Array.from({ length: 20 }, () =>
      authority.command(request, record.playerId),
    ),
  );
  retries.forEach((view) => assert.equal(view.revision, 1));
  assert.equal(
    (await attempts.findForPlayer(record.attemptId, record.playerId))!.inputs
      .length,
    1,
  );
  const stale = await attempts.findForPlayer(record.attemptId, record.playerId);
  assert.ok(stale);
  assert.equal(await attempts.compareAndSwap(0, stale), false);
  const hidden = stale.inputs.length ? core.create(manifest.seed) : null;
  assert.ok(hidden);
  const view = await authority.read(record.attemptId, record.playerId),
    index = view.view.cells.findIndex((v) => v === null);
  const second = {
    ...request,
    expectedRevision: 1,
    action: `FLAG_${String(index).padStart(3, "0")}`,
  };
  const races = await Promise.allSettled([
    authority.command({ ...second, commandId: "race-a" }, record.playerId),
    authority.command({ ...second, commandId: "race-b" }, record.playerId),
  ]);
  assert.equal(races.filter((r) => r.status === "fulfilled").length, 1);
  assert.ok(
    races.some(
      (r) =>
        r.status === "rejected" &&
        r.reason instanceof CommandAuthorityError &&
        r.reason.code === "REVISION_CONFLICT",
    ),
  );
  assert.equal(
    (await attempts.findForPlayer(record.attemptId, record.playerId))!.revision,
    2,
  );
  // Parent erasure is idempotent and removes command history, no financial schema touched.
  await pool.query("DELETE FROM arena_matches WHERE match_id=$1", [
    manifest.match_id,
  ]);
  await pool.query("DELETE FROM arena_matches WHERE match_id=$1", [
    manifest.match_id,
  ]);
  assert.equal(
    await attempts.findForPlayer(record.attemptId, record.playerId),
    null,
  );
  console.log(
    "PostgreSQL command repository: explicit additive migrations, participant/manifest binding, one attempt, concurrent idempotency/CAS, stale revisions, idempotent cascading deletion",
  );
} finally {
  await pool.end();
  if (created) await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  await admin.end();
}
const previous = process.env.COMMAND_AUTHORITY_READY;
try {
  delete process.env.COMMAND_AUTHORITY_READY;
  assert.throws(
    () => getProductionCommandAttemptRepository(),
    (error) =>
      error instanceof CommandAuthorityError && error.code === "UNAVAILABLE",
  );
} finally {
  if (previous === undefined) delete process.env.COMMAND_AUTHORITY_READY;
  else process.env.COMMAND_AUTHORITY_READY = previous;
}
