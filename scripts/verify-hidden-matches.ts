import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { Pool } from "pg";
import { applyMigrations } from "../lib/server/migrations";
import { PostgresPublicAttemptRepository } from "../lib/server/postgresPublicAttemptRepository";
import { PostgresMatchRepository } from "../lib/server/postgresMatchRepository";
import { PostgresCommandAttemptRepository } from "../lib/server/postgresCommandAttemptRepository";
import { HiddenMatchService } from "../lib/server/hiddenMatchService";
import { ABANDONED_LOWER_WINS_SCORE } from "../lib/server/groups";
import { PublicMatchService } from "../lib/server/publicMatchService";
import { PublicAttemptError } from "../lib/server/publicAttemptRepository";
import { solitaireDeckFromSeed } from "../lib/server/solitaireDeals";
import { solveKlondike } from "../lib/solitaireSolver";
import { SOLITAIRE_CORE_V1, createSolitaireV1 } from "../lib/verified/solitaireCore.v1.server";
import { SOLITAIRE_V1_TIME_LIMIT_MS, SOLITAIRE_V1_UNSOLVED_BASE, readSolitaireScoreV1 } from "../lib/verified/solitaireProtocol.v1";
import { createMineV2 } from "../lib/verified/mineGridCore.v2";
import { mineAction } from "../lib/verified/mineGridProtocol.v1";

// Paired hidden-information matches on the real public-match tables: both players get the same private manifest,
// the phone never sees it, the server writes the result with its own clock, and the usual winner decision applies.
const connectionString = process.env.TEST_DATABASE_URL;
assert.ok(connectionString);
const url = new URL(connectionString);
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
assert.equal(url.pathname, "/skill_arena_test");
const schema = `qa_hidden_match_${randomBytes(8).toString("hex")}`,
  admin = new Pool({ connectionString, max: 1 }),
  pool = new Pool({ connectionString, max: 8, options: `-c search_path=${schema}` });
let now = 1_795_400_000_000;
const publicRepo = new PostgresPublicAttemptRepository(pool),
  commands = new PostgresCommandAttemptRepository(pool),
  service = new HiddenMatchService(publicRepo, new PostgresMatchRepository(pool), commands, () => now),
  publicService = new PublicMatchService(publicRepo);
const start = (actor: string, game_id: string, start_key = randomUUID()) =>
  service.start(actor, { game_id, stake_minor: 0, start_key });
type Answer = Awaited<ReturnType<typeof service.start>>;
let n = 0;
const move = (actor: string, a: Answer, action: string) =>
  service.command(actor, { attemptId: a.attempt_id, commandId: `m${n++}`, expectedRevision: a.session!.revision, action });
const storedManifest = async (attemptId: string) =>
  (await pool.query(`SELECT m.manifest FROM arena_public_attempts a JOIN arena_matches m USING(match_id) WHERE a.attempt_id=$1`, [attemptId])).rows[0].manifest;

try {
  await admin.query(`CREATE SCHEMA ${schema}`);
  await applyMigrations(pool);
  assert.ok(SOLITAIRE_V1_UNSOLVED_BASE + 52 < ABANDONED_LOWER_WINS_SCORE, "unsolved stays ahead of an abandoned match");
  assert.ok(SOLITAIRE_V1_UNSOLVED_BASE > SOLITAIRE_V1_TIME_LIMIT_MS, "every solve beats every unsolved deal");

  // 1 · First player: a running session with the public view only. Never the manifest, seed or ticket.
  const keyA = randomUUID();
  let a = await start("player-a", "solitaire-sprint", keyA);
  assert.equal(a.state, "playing");
  assert.equal(a.session!.status, "running");
  assert.equal(a.session!.timeLimitMs, SOLITAIRE_V1_TIME_LIMIT_MS);
  const manifestA = await storedManifest(a.attempt_id);
  assert.equal(manifestA.game_version, "1.0.0");
  const wire = JSON.stringify(a);
  assert.ok(!wire.includes(manifestA.seed) && !wire.includes('"manifest"') && !wire.includes('"ticket"'));
  const openingA = a.session!.view;
  // Retrying the same start returns the same attempt; the deal is never re-issued.
  assert.equal((await start("player-a", "solitaire-sprint", keyA)).attempt_id, a.attempt_id);
  // The normal submit path refuses hidden matches: their record is written by the server.
  await assert.rejects(
    publicService.submit("player-a", { attempt_id: a.attempt_id, final_tick: 0, inputs: [] }),
    (e) => e instanceof PublicAttemptError && e.code === "HIDDEN_MATCH_USES_COMMANDS",
  );

  // 2 · The first player solves the deal (a solver solution, one command every 0.5 s of server time).
  const solution = solveKlondike(solitaireDeckFromSeed(manifestA.seed), 250_000);
  assert.ok(solution.solved, "the issuer only hands out winnable deals");
  const local = createSolitaireV1(manifestA.seed);
  const actions: string[] = [];
  const push = (action: string) => {
    SOLITAIRE_CORE_V1.apply(local, action);
    actions.push(action);
  };
  for (const m of solution.moves) {
    if (local.status !== "running") break;
    if (m.from === "talon") {
      while (local.waste.at(-1) !== m.card) push("DRAW");
      push(m.kind === "foundation" ? "W>F" : `W>T${m.to}`);
    } else push(m.kind === "foundation" ? `T${m.from}>F` : `T${m.from}>T${m.to}`);
  }
  const startedA = now;
  for (const action of actions) {
    now += 500;
    a = await move("player-a", a, action);
  }
  assert.equal(a.session!.status, "won");
  assert.equal(a.state, "verified");
  assert.equal(a.result!.score, now - startedA, "score = server-measured solve time");
  assert.equal(a.result!.time_ms, now - startedA);
  assert.equal(a.result!.won, true);

  // 3 · Second player joins the same stored match: the same private manifest, the same opening.
  let b = await start("player-b", "solitaire-sprint");
  const manifestB = await storedManifest(b.attempt_id);
  assert.equal(manifestB.match_id, manifestA.match_id);
  assert.equal(manifestB.seed, manifestA.seed);
  assert.deepEqual(b.session!.view, openingA);
  // B gives up (TIME_UP is also the resign move) with all 21 face-down cards still to turn: A's solve wins.
  b = await move("player-b", b, "TIME_UP");
  assert.equal(b.state, "verified");
  assert.equal(b.result!.score, SOLITAIRE_V1_UNSOLVED_BASE + 21);
  assert.deepEqual(readSolitaireScoreV1(b.result!.score!), { solved: false, cardsLeft: 21 });
  assert.deepEqual(readSolitaireScoreV1(a.result!.score!), { solved: true, ms: a.result!.time_ms });
  assert.equal(b.result!.won, false);
  assert.equal(b.result!.match!.winnerSlot, "A");
  assert.equal(b.result!.match!.reason, "score");
  // Moves after the end change nothing; the answer is the final result.
  assert.equal((await move("player-b", b, "DRAW")).state, "verified");

  // 4 · Five minutes without solving: the server closes the attempt and records a loss.
  let c = await start("player-c", "solitaire-sprint");
  c = await move("player-c", c, "DRAW");
  now += SOLITAIRE_V1_TIME_LIMIT_MS;
  c = await service.read("player-c", c.attempt_id);
  assert.equal(c.session!.status, "failed");
  assert.equal(c.session!.failure, "TIME_UP");
  assert.equal(c.state, "verified");
  assert.equal(c.result!.score, SOLITAIRE_V1_UNSOLVED_BASE + 21);
  assert.equal(c.result!.time_ms, SOLITAIRE_V1_TIME_LIMIT_MS);

  // 5 · Mine Grid: the second player gets the first player's field. A plays to the end (opens the start cell, then
  // mines, read from the private board only here in the test), so the run is verified and offered for pairing.
  let mineA = await start("mine-a", "mine-grid");
  const mineManifest = await storedManifest(mineA.attempt_id);
  assert.ok(!JSON.stringify(mineA).includes(mineManifest.seed));
  const fieldA = mineA.session!.view;
  const board = createMineV2(mineManifest.seed).board;
  mineA = await move("mine-a", mineA, mineAction("OPEN", board.startIndex));
  for (let i = 0; i < board.values.length && mineA.session!.status === "running"; i++)
    if (board.values[i] === -1) mineA = await move("mine-a", mineA, mineAction("OPEN", i));
  assert.equal(mineA.session!.status, "failed");
  assert.equal(mineA.state, "verified");
  const mineB = await start("mine-b", "mine-grid");
  assert.equal((await storedManifest(mineB.attempt_id)).match_id, mineManifest.match_id, "joins the same match");
  assert.deepEqual(mineB.session!.view, fieldA, "the same field");
  // An abandoned first run is never offered to a new player.
  const mineC = await start("mine-c", "mine-grid");
  await publicRepo.pulse("mine-c", mineC.attempt_id, true);
  const mineD = await start("mine-d", "mine-grid");
  assert.notEqual((await storedManifest(mineD.attempt_id)).match_id, (await storedManifest(mineC.attempt_id)).match_id);
  console.log("Hidden matches PG OK · same private deal and field for both players, no manifest/seed/ticket on the wire, solve time scored by the server clock, unsolved loses, 5-min close, hidden submit refused");
} finally {
  await pool.end();
  await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await admin.end();
}
