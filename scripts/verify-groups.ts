/** v193 · Foundations against local PostgreSQL: identity, groups and competitions on the server, double-entry ledger. */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { Pool } from "pg";
import { accountAuthKey, createAccount, deleteAccount, exchangeFictitious, findAccount } from "../lib/server/accounts";
import { BadRequest, buildSetup, groupAction, groupErrorStatus, groupsOverview } from "../lib/server/groupHttp";
import { rivalSamples } from "../lib/server/rivalSamples";
import { applyMigrations } from "../lib/server/migrations";
import { ledgerBalance } from "../lib/server/ledger";
import {
  GroupError, acceptChallenge, cancelCompetition, closeGroup, createCompetition, createGroup, enterCompetition, groupWinningsRanking, joinGroup,
  leaveGroup, listGroupMembers, listOpenVersus, recordResult, startCompetition,
} from "../lib/server/groups";

const connectionString = process.env.TEST_DATABASE_URL;
assert.ok(connectionString);
const url = new URL(connectionString);
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
assert.equal(url.pathname, "/skill_arena_test");
const schema = `qa_groups_${randomBytes(8).toString("hex")}`,
  admin = new Pool({ connectionString, max: 1 }),
  pool = new Pool({ connectionString, max: 8, options: `-c search_path=${schema}` });
const code = async (p: Promise<unknown>) => { try { await p; return "ok"; } catch (e) { if (e instanceof GroupError) return e.code; throw e; } };
const SECRET = "y".repeat(40);
const GAME = "billiards";
let created = false;
let n = 0;

/** A verified attempt as the server replay leaves it (state, response with the authoritative score). */
async function attempt(accountId: string, gameId: string, score: number, opts: { state?: string; source?: string } = {}) {
  n += 1;
  const matchId = `m${n}-${randomBytes(4).toString("hex")}`, attemptId = `a${n}-${randomBytes(4).toString("hex")}`;
  const manifest = { match_id: matchId, manifest_version: "3", game_id: gameId, game_version: "7.0.0" };
  await pool.query("INSERT INTO arena_matches(match_id, manifest, manifest_hash, player_a) VALUES ($1,$2::jsonb,$3,$4)", [matchId, JSON.stringify(manifest), `sha256:${"0".repeat(64)}`, `device-${accountId}`]);
  await pool.query("INSERT INTO arena_public_matches(match_id, policy_version, scope, expires_at) VALUES ($1,'forfeit-on-disconnect-v1','training', now() + interval '1 day')", [matchId]);
  await pool.query(
    `INSERT INTO arena_public_attempts(attempt_id, match_id, player_id, slot, start_key, request_hash, ticket, state, lease_until, deadline, response, account_id)
     VALUES ($1,$2,$3,'A',$1,'h','{}'::jsonb,$4, now() + interval '1 day', now() + interval '1 day', $5::jsonb, $6)`,
    [attemptId, matchId, `device-${accountId}`, opts.state ?? "verified", JSON.stringify({ ok: true, verified: true, score, time_ms: 1000, authoritative_source: opts.source ?? "SERVER_REPLAY" }), accountId],
  );
  return attemptId;
}
const stateOf = async (id: string) => (await pool.query("SELECT mode, status, state, result FROM arena_competitions WHERE competition_id = $1", [id])).rows[0];
async function playAll(id: string, scores: Record<string, number>) {
  for (let guard = 0; guard < 40; guard++) {
    const k = await stateOf(id);
    if (k.status !== "running") return;
    const c = k.mode === "group" ? k.state : k.state.comp;
    let progressed = false;
    for (const [i, m] of c.matches.entries()) {
      for (const p of m.players as string[]) {
        if (m.scores[p] !== undefined) continue;
        await recordResult(pool, { competitionId: id, matchIndex: i, accountId: p, attemptId: await attempt(p, m.gameId, scores[p]) });
        progressed = true;
      }
    }
    if (!progressed) throw new Error("competition did not advance");
  }
}
const balance = (id: string) => ledgerBalance(pool, { kind: "player", accountId: id }, "CC");

try {
  await admin.query(`CREATE SCHEMA ${schema}`);
  created = true;
  await applyMigrations(pool);

  const ids: Record<string, string> = {};
  const keys: Record<string, string> = {};
  for (const [name, platform] of [["A1", "mobile"], ["A2", "mobile"], ["A3", "mobile"], ["A4", "mobile"], ["D1", "desktop"]] as const) {
    keys[name] = accountAuthKey("google", `sub-${name}`, SECRET);
    ids[name] = (await createAccount(pool, keys[name], `Jugador ${name}`, 1, platform)).id;
    if (name !== "D1") await exchangeFictitious(pool, keys[name], "deposit", 10_000, `fund-${name}`);
  }
  const START = 2500 + 9500;
  assert.equal(await balance(ids.A1), START);

  // Foundation 1 · a verified attempt belongs to the person, not only to the device.
  const a0 = await attempt(ids.A1, GAME, 10);
  assert.equal((await pool.query("SELECT account_id FROM arena_public_attempts WHERE attempt_id = $1", [a0])).rows[0].account_id, ids.A1);
  assert.equal((await pool.query("SELECT game_id, game_version FROM arena_matches WHERE match_id = (SELECT match_id FROM arena_public_attempts WHERE attempt_id = $1)", [a0])).rows[0].game_id, GAME, "game_id comes from the manifest");

  // Groups: codes, platform pools, membership.
  const g1 = await createGroup(pool, ids.A1, "  Los   Rápidos ", "mobile");
  const g2 = await createGroup(pool, ids.A3, "Cometas", "mobile");
  assert.equal(g1.name, "Los Rápidos");
  assert.match(g1.code, /^[A-Z2-9]{8}$/);
  assert.equal(await code(createGroup(pool, ids.A1, "x", "mobile")), "INVALID_NAME");
  assert.equal(await code(joinGroup(pool, ids.D1, g1.code, "desktop")), "PLATFORM_MISMATCH", "computers never join a phone group");
  assert.equal(await code(joinGroup(pool, ids.A2, "ZZZZZZZZ", "mobile")), "NO_GROUP");
  assert.equal((await joinGroup(pool, ids.A2, g1.code.toLowerCase(), "mobile")).members, 2);
  assert.equal(await code(joinGroup(pool, ids.A2, g1.code, "mobile")), "ALREADY_MEMBER");
  await joinGroup(pool, ids.A4, g2.code, "mobile");
  assert.deepEqual((await listGroupMembers(pool, g1.id)).map((m) => m.role), ["owner", "member"]);
  assert.equal(await code(leaveGroup(pool, ids.A1, g1.id)), "OWNER_CANNOT_LEAVE");

  // Competitions: chance games never for money; a challenge any rival group can answer.
  const setup = { entryMinor: 500, gameIds: [GAME], lowerWinsGameIds: [] as string[], rounds: 2 };
  assert.equal(await code(createCompetition(pool, { createdBy: ids.A1, mode: "versus-league", groupIds: [g1.id], config: { ...setup, gameIds: ["galactic-roulette"] } })), "CHANCE_GAME_NOT_FOR_MONEY");
  assert.equal(await code(createCompetition(pool, { createdBy: ids.A2, mode: "versus-league", groupIds: [g1.id], config: setup })), "NOT_OWNER");
  const league = await createCompetition(pool, { createdBy: ids.A1, mode: "versus-league", groupIds: [g1.id], config: setup });
  assert.deepEqual((await listOpenVersus(pool, "mobile")).map((c) => c.id), [league.id], "the challenge is listed");
  assert.deepEqual(await listOpenVersus(pool, "desktop"), [], "and only on its platform");
  assert.equal(await code(acceptChallenge(pool, league.id, g1.id, ids.A1)), "INVALID_COMPETITION", "a group cannot answer its own challenge");
  assert.equal(await code(acceptChallenge(pool, league.id, g2.id, ids.A4)), "NOT_OWNER");
  await acceptChallenge(pool, league.id, g2.id, ids.A3);
  assert.deepEqual(await listOpenVersus(pool, "mobile"), [], "answered: no longer open");

  // Entries move money player → pot, once; no overdraft; only members.
  assert.equal(await code(enterCompetition(pool, league.id, ids.D1)), "NOT_MEMBER");
  for (const who of ["A1", "A2", "A3", "A4"]) assert.equal((await enterCompetition(pool, league.id, ids[who])).entered, true);
  assert.equal((await enterCompetition(pool, league.id, ids.A1)).entered, false, "a retried entry does not charge twice");
  assert.equal(await balance(ids.A1), START - 500);
  assert.equal(await ledgerBalance(pool, { kind: "pot", competitionId: league.id }, "CC"), 2000);
  const big = await createCompetition(pool, { createdBy: ids.A1, mode: "group", groupIds: [g1.id], config: { format: "single", entryMinor: 999_999, split: "winner", gameIds: [GAME], lowerWinsGameIds: [], end: { kind: "rounds", rounds: 1 } } });
  assert.equal(await code(enterCompetition(pool, big.id, ids.A1)), "INSUFFICIENT_BALANCE");
  await cancelCompetition(pool, big.id, ids.A1);
  assert.equal(await code(enterCompetition(pool, big.id, ids.A1)), "NOT_OPEN");

  // Results come from verified attempts only.
  assert.equal(await code(recordResult(pool, { competitionId: league.id, matchIndex: 0, accountId: ids.A1, attemptId: a0 })), "NOT_RUNNING");
  await startCompetition(pool, league.id, ids.A1);
  const first = (await stateOf(league.id)).state.comp.matches[0];
  const rec = (accountId: string, attemptId: string) => code(recordResult(pool, { competitionId: league.id, matchIndex: 0, accountId, attemptId }));
  assert.equal(await rec(ids.A1, await attempt(ids.A2, first.gameId, 99)), "INVALID_ATTEMPT", "somebody else's attempt");
  assert.equal(await rec(ids.A1, await attempt(ids.A1, first.gameId, 99, { state: "playing" })), "INVALID_ATTEMPT", "not verified yet");
  assert.equal(await rec(ids.A1, await attempt(ids.A1, first.gameId, 99, { source: "CLIENT" })), "INVALID_ATTEMPT", "not the server replay");
  assert.equal(await rec(ids.A1, await attempt(ids.A1, "darts", 99)), "INVALID_ATTEMPT", "another game");
  assert.equal(await rec(ids.A1, "nope"), "INVALID_ATTEMPT");
  assert.equal(await rec(ids.D1, await attempt(ids.D1, first.gameId, 99)), "INVALID_ATTEMPT", "not playing in it");
  const dup = await attempt(ids.A1, first.gameId, 90);
  assert.equal(await rec(ids.A1, dup), "ok");
  assert.equal(await rec(ids.A1, dup), "INVALID_ATTEMPT", "the same attempt twice");

  // League: positions add up per group; the lower sum takes the pot. A1 1st, A3 2nd, A2 3rd, A4 4th → g1 4, g2 6.
  const scores = { [ids.A1]: 90, [ids.A2]: 70, [ids.A3]: 80, [ids.A4]: 50 };
  await playAll(league.id, scores);
  const done = await stateOf(league.id);
  assert.equal(done.status, "finished");
  assert.equal(done.result.winnerGroupId, g1.id);
  assert.equal(await balance(ids.A1), START + 500, "winners split the pot: +1 000 for a 500 entry");
  assert.equal(await balance(ids.A2), START + 500);
  assert.equal(await balance(ids.A3), START - 500);
  assert.equal((await findAccount(pool, keys.A1))!.balanceMinor, START + 500, "the account balance reads the ledger");
  assert.equal(await ledgerBalance(pool, { kind: "pot", competitionId: league.id }, "CC"), 0, "nothing left in the pot");
  assert.equal(await code(recordResult(pool, { competitionId: league.id, matchIndex: 0, accountId: ids.A2, attemptId: await attempt(ids.A2, GAME, 1) })), "NOT_RUNNING");
  assert.deepEqual(await groupWinningsRanking(pool, "mobile"), [
    { groupId: g1.id, name: "Los Rápidos", netMinor: 1000, competitions: 1 },
    { groupId: g2.id, name: "Cometas", netMinor: -1000, competitions: 1 },
  ]);
  assert.deepEqual(await groupWinningsRanking(pool, "desktop"), []);

  // Tournament: the two worst of everyone go each round; the group that keeps players wins. Free entry: no money moves.
  const tour = await createCompetition(pool, { createdBy: ids.A1, mode: "versus-tournament", groupIds: [g1.id, g2.id], config: { ...setup, entryMinor: 0 } });
  for (const who of ["A1", "A2", "A3", "A4"]) await enterCompetition(pool, tour.id, ids[who]);
  await startCompetition(pool, tour.id, ids.A1);
  await playAll(tour.id, { [ids.A1]: 90, [ids.A2]: 80, [ids.A3]: 20, [ids.A4]: 10 });
  const t = await stateOf(tour.id);
  assert.equal(t.status, "finished");
  assert.equal(t.result.winnerGroupId, g1.id);
  const uneven = await createCompetition(pool, { createdBy: ids.A1, mode: "versus-league", groupIds: [g1.id, g2.id], config: { ...setup, entryMinor: 0 } });
  await enterCompetition(pool, uneven.id, ids.A1);
  assert.equal(await code(startCompetition(pool, uneven.id, ids.A1)), "INVALID_TEAMS", "both groups need players, the same number each");
  await cancelCompetition(pool, uneven.id, ids.A1);

  // Cancelling gives every entry back; a group in an open competition cannot be closed.
  const free = await createCompetition(pool, { createdBy: ids.A1, mode: "group", groupIds: [g1.id], config: { format: "single", entryMinor: 300, split: "winner", gameIds: [GAME], lowerWinsGameIds: [], end: { kind: "rounds", rounds: 1 } } });
  const before = [await balance(ids.A1), await balance(ids.A2)];
  await enterCompetition(pool, free.id, ids.A1);
  await enterCompetition(pool, free.id, ids.A2);
  assert.equal(await code(closeGroup(pool, ids.A1, g1.id)), "GROUP_BUSY");
  assert.equal(await code(leaveGroup(pool, ids.A2, g1.id)), "GROUP_BUSY");
  assert.equal(await code(cancelCompetition(pool, free.id, ids.A2)), "NOT_OWNER");
  await cancelCompetition(pool, free.id, ids.A1);
  assert.deepEqual([await balance(ids.A1), await balance(ids.A2)], before, "entries refunded");
  assert.equal(await code(closeGroup(pool, ids.A2, g1.id)), "NOT_OWNER");

  // Foundation 2 · the ledger adds up to zero in every currency and refuses what does not balance.
  for (const currency of ["EUR", "CC"]) {
    assert.equal((await pool.query("SELECT COALESCE(sum(amount_minor),0)::int AS t FROM arena_ledger_postings WHERE currency = $1", [currency])).rows[0].t, 0, `${currency} adds up to zero`);
  }
  const client = await pool.connect();
  try {
    const acc = (await pool.query("SELECT ledger_account_id FROM arena_ledger_accounts WHERE kind = 'house' AND currency = 'CC'")).rows[0].ledger_account_id;
    const player = (await pool.query("SELECT ledger_account_id FROM arena_ledger_accounts WHERE kind = 'player' AND owner_account_id = $1", [ids.A1])).rows[0].ledger_account_id;
    const post = async (rows: [number, number][]) => {
      await client.query("BEGIN");
      try {
        const id = (await client.query("INSERT INTO arena_ledger_transactions(tx_id, kind) VALUES (gen_random_uuid(), 'adjustment') RETURNING tx_id")).rows[0].tx_id;
        for (const [account, amount] of rows) await client.query("INSERT INTO arena_ledger_postings(tx_id, ledger_account_id, currency, amount_minor) VALUES ($1,$2,'CC',$3)", [id, account, amount]);
        await client.query("COMMIT");
        return "ok";
      } catch (e) {
        await client.query("ROLLBACK");
        return (e as Error).message;
      }
    };
    assert.match(await post([[acc, -10]]), /does not add up to zero/, "one-sided money is refused");
    assert.match(await post([[acc, 10_000_000], [player, -10_000_000]]), /below zero/, "a player cannot be overdrawn");
    assert.equal(await post([[acc, -10], [player, 10]]), "ok");
  } finally {
    client.release();
  }
  await assert.rejects(pool.query("UPDATE arena_ledger_postings SET amount_minor = 1"), /never edited or deleted/);
  await assert.rejects(pool.query("DELETE FROM arena_ledger_transactions"), /never edited or deleted/);

  // Foundation 3 · erasing an account anonymises it: it leaves its groups, the money records stay.
  const afterBalance = await balance(ids.A2);
  assert.equal(await deleteAccount(pool, keys.A2), true);
  assert.equal((await listGroupMembers(pool, g1.id)).length, 1);
  assert.equal(await balance(ids.A2), afterBalance, "the ledger is kept");
  assert.equal(await code(createGroup(pool, ids.A2, "Fantasmas", "mobile")), "NO_ACCOUNT");
  assert.equal(await code(joinGroup(pool, ids.A2, g1.code, "mobile")), "NO_ACCOUNT");
  await closeGroup(pool, ids.A1, g1.id);
  assert.equal(await code(joinGroup(pool, ids.D1, g1.code, "mobile")), "NO_GROUP", "a closed group takes nobody");

  // v197: the HTTP face. Platform comes from the account; the setup is rebuilt on the server; scores come from attempts.
  for (const [name, platform] of [["H1", "mobile"], ["H2", "mobile"], ["HD", "desktop"]] as const) {
    ids[name] = (await createAccount(pool, accountAuthKey("google", `sub-${name}`, SECRET), `Jugador ${name}`, 1, platform)).id;
  }
  const act = (who: string, plat: "mobile" | "desktop", body: Record<string, unknown>) => groupAction(pool, { accountId: ids[who], platform: plat }, body);
  const refused = async (p: Promise<unknown>) => { try { await p; return "ok"; } catch (e) { if (e instanceof BadRequest) return `bad:${e.message}`; if (e instanceof GroupError) return e.code; throw e; } };
  const hg = (await act("H1", "mobile", { action: "create", name: "Via HTTP" })).group as { id: string; code: string };
  assert.equal((await act("H2", "mobile", { action: "join", code: hg.code })).group !== undefined, true);
  assert.equal(await refused(act("HD", "desktop", { action: "join", code: hg.code })), "PLATFORM_MISMATCH", "a computer cannot join a phone group");
  assert.equal(await refused(act("H1", "mobile", { action: "nope" })), "bad:action");
  assert.equal(await refused(act("H1", "mobile", { action: "competition", mode: "group", groupIds: [hg.id], config: { format: "single", entryMinor: 5, gameIds: ["no-such-game"] } })), "bad:gameIds");
  assert.equal(await refused(act("H1", "mobile", { action: "competition", mode: "group", groupIds: [hg.id], config: { format: "single", entryMinor: -1, gameIds: [GAME] } })), "bad:entryMinor");
  assert.equal(await refused(act("H1", "mobile", { action: "competition", mode: "group", groupIds: [hg.id], config: { format: "single", entryMinor: 99_999, gameIds: [GAME] } })), "bad:entryMinor");
  const smuggled = buildSetup("group", { format: "league-rounds", entryMinor: 10, gameIds: [GAME], rounds: 2, commissionBps: 9000, lowerWinsGameIds: [GAME], tieBreak: "x" }) as unknown as { commissionBps: number; tieBreak: string; lowerWinsGameIds: string[] };
  assert.equal(smuggled.commissionBps, 0, "commission is fixed on the server");
  assert.equal(smuggled.tieBreak, "time-v1");
  assert.ok(!smuggled.lowerWinsGameIds.includes(GAME), "lower-wins games come from the registry");
  const hc = (await act("H1", "mobile", { action: "competition", mode: "group", groupIds: [hg.id], config: { format: "single", entryMinor: 5, gameIds: [GAME] } })).competition as { id: string };
  assert.equal((await act("H1", "mobile", { action: "enter", competitionId: hc.id })).entered, true);
  assert.equal((await act("H1", "mobile", { action: "enter", competitionId: hc.id })).entered, false, "a retried tap changes nothing");
  assert.equal(await refused(act("H2", "mobile", { action: "result", competitionId: hc.id, matchIndex: 0, attemptId: "x" })), "NOT_RUNNING");
  const ov = await groupsOverview(pool, { accountId: ids.H1, platform: "mobile" });
  assert.ok(ov.groups.some((g) => g.id === hg.id) && ov.competitions.some((k) => k.id === hc.id && k.entered), "the overview lists my group and competition");
  assert.equal(groupErrorStatus("NOT_OWNER"), 403);
  assert.equal(groupErrorStatus("INSUFFICIENT_BALANCE"), 402);
  await act("H1", "mobile", { action: "cancel", competitionId: hc.id });
  await act("H1", "mobile", { action: "close", groupId: hg.id });

  // v199: samples of other players' verified scores for invented rivals: same platform, no own matches, verified only.
  const samples = await rivalSamples(pool, [GAME, "no-such"], "mobile", `device-${ids.A1}`);
  assert.ok((samples[GAME] ?? []).length > 0, "verified scores of others are offered");
  assert.ok(Object.keys(samples[GAME][0]).every((k) => k === "score" || k === "timeMs"), "only score and time travel");
  const allMine = await rivalSamples(pool, [GAME], "mobile", null, 30);
  const others = await rivalSamples(pool, [GAME], "mobile", `device-${ids.A1}`, 30);
  assert.ok(others[GAME].length <= allMine[GAME].length);
  assert.deepEqual(await rivalSamples(pool, [GAME], "desktop", null), {}, "no phone scores for computers");
  await attempt(ids.A3, "darts", 77_777, { state: "rejected" });
  assert.ok(!((await rivalSamples(pool, ["darts"], "mobile", null, 30)).darts ?? []).some((x) => x.score === 77_777), "rejected matches are never offered");

  // v207 · Regression: the player cookie only travels to /api/verified-match/*, so the samples route must live there or
  // the caller is never identified and can be offered their own score.
  const cookiePath = /path:\s*"([^"]+)"/.exec(readFileSync("app/api/verified-match/session/route.ts", "utf8"))?.[1];
  assert.equal(cookiePath, "/api/verified-match");
  assert.ok(existsSync(`app${cookiePath}/rival-samples/route.ts`), "rival samples are served under the player cookie path");
  assert.ok(readFileSync("components/DemoApp.tsx", "utf8").includes(`${cookiePath}/rival-samples?`), "the app asks that route");

  // v207 · Regression: with every migration applied (008 adds generated columns), a rival can still join a public
  // match (player_b), and nothing else of a stored match can be rewritten.
  await pool.query("INSERT INTO arena_matches(match_id, manifest, manifest_hash, player_a) VALUES ('join-1', $1::jsonb, $2, 'dev-a')", [JSON.stringify({ match_id: "join-1", manifest_version: "3", game_id: "billiards", game_version: "7.0.0" }), `sha256:${"1".repeat(64)}`]);
  await pool.query("UPDATE arena_matches SET player_b = 'dev-b' WHERE match_id = 'join-1' AND player_b IS NULL");
  assert.equal((await pool.query("SELECT player_b FROM arena_matches WHERE match_id = 'join-1'")).rows[0].player_b, "dev-b", "a rival joins");
  for (const sql of ["UPDATE arena_matches SET player_b = 'dev-c' WHERE match_id = 'join-1'", "UPDATE arena_matches SET player_a = 'x' WHERE match_id = 'join-1'", "UPDATE arena_matches SET manifest = manifest || '{\"seed\":1}' WHERE match_id = 'join-1'"]) {
    await assert.rejects(pool.query(sql), /IMMUTABLE_MATCH/, sql);
  }
  console.log("Groups: identity on attempts, groups and competitions on the server (league, tournament, challenge), double-entry ledger, erasure anonymises, HTTP layer (platform from the account, setup rebuilt on the server)");
} finally {
  await pool.end();
  if (created) await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  await admin.end();
}
