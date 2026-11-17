/** v211 · Group relay ("juego grupal") on PostgreSQL: one turn at a time, continuation, refusals, audit, overview. */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { accountAuthKey, createAccount, deleteAccount } from "../lib/server/accounts";
import { createGroup, joinGroup, leaveGroup } from "../lib/server/groups";
import { RelayError, cancelRelay, createRelay, relayOverview, releaseRelayTurn, startRelayTurn, submitRelayTurn } from "../lib/server/groupRelays";
import { groupsOverview } from "../lib/server/groupHttp";
import { applyMigrations } from "../lib/server/migrations";
import { playRelayTurn } from "./stack-relay-player";

const connectionString = process.env.TEST_DATABASE_URL;
assert.ok(connectionString);
const url = new URL(connectionString);
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
assert.equal(url.pathname, "/skill_arena_test");
const schema = `qa_relay_${randomBytes(8).toString("hex")}`,
  admin = new Pool({ connectionString, max: 1 }),
  pool = new Pool({ connectionString, max: 4, options: `-c search_path=${schema}` });
const SECRET = "r".repeat(40);
const code = async (work: Promise<unknown>, expected: string) => {
  try { await work; } catch (e) { assert.ok(e instanceof RelayError, String(e)); assert.equal(e.code, expected); return e; }
  assert.fail(`expected ${expected}`);
};
/** Moves the turn's start back so the real-time check sees the play as taking that long (the test plays instantly). */
const backdate = (relayId: string, seconds: number) => pool.query("UPDATE arena_group_relays SET lock_started_at = lock_started_at - make_interval(secs => $2) WHERE relay_id = $1", [relayId, seconds]);
let created = false;
try {
  await admin.query(`CREATE SCHEMA ${schema}`);
  created = true;
  await applyMigrations(pool);
  for (let i = 0; i < 2; i++) await applyMigrations(pool);
  const acc = async (n: string, platform: "mobile" | "desktop" = "mobile") => createAccount(pool, accountAuthKey("google", `rel-${n}`, SECRET), `Relevo ${n}`, 1, platform);
  const ana = await acc("Ana"), bea = await acc("Bea"), out = await acc("Fuera");
  const group = await createGroup(pool, ana.id, "Torre común", "mobile");
  await joinGroup(pool, bea.id, group.code, "mobile");

  // Opening: members only, a valid turn size, one relay in play per group.
  await code(createRelay(pool, out.id, group.id, 5), "NOT_MEMBER");
  await code(createRelay(pool, ana.id, group.id, 4), "INVALID_BLOCKS");
  const { relayId } = await createRelay(pool, ana.id, group.id, 5);
  await code(createRelay(pool, bea.id, group.id, 3), "RELAY_EXISTS");
  const seed = (await pool.query("SELECT seed FROM arena_group_relays WHERE relay_id = $1", [relayId])).rows[0].seed as string;
  assert.match(seed, /^relay:[0-9a-f-]{36}$/, "the server chooses the seed");

  // Ana takes the first turn; Bea, starting later, is refused at once and told who is playing and since when.
  const t1 = await startRelayTurn(pool, ana.id, relayId);
  assert.equal(t1.turnNo, 1);
  assert.deepEqual(t1.inputs, []);
  assert.equal(t1.finalTick, 0);
  const busy = await code(startRelayTurn(pool, bea.id, relayId), "RELAY_BUSY") as RelayError;
  assert.equal(busy.detail.holder, "Relevo Ana");
  assert.equal(busy.detail.since, t1.startedAt);
  await code(startRelayTurn(pool, out.id, relayId), "NOT_MEMBER");
  assert.equal((await startRelayTurn(pool, ana.id, relayId)).turnNo, 1, "the holder can pick the same turn up again");
  const p1 = playRelayTurn(seed, [], 0, 5);
  // Too fast: the play took longer than the clock between taking the turn and sending it.
  await code(submitRelayTurn(pool, ana.id, relayId, 1, p1.inputs, p1.finalTick), "TOO_FAST");
  assert.equal((await relayOverview(pool, ana.id, group.id))!.lock, null, "a refused turn frees the turn");
  await startRelayTurn(pool, ana.id, relayId);
  await backdate(relayId, 120);
  await code(submitRelayTurn(pool, ana.id, relayId, 2, p1.inputs, p1.finalTick), "TURN_TAKEN");
  await startRelayTurn(pool, ana.id, relayId);
  await backdate(relayId, 120);
  await code(submitRelayTurn(pool, ana.id, relayId, 1, p1.inputs.slice(0, 3), p1.finalTick), "INVALID_TURN");
  await startRelayTurn(pool, ana.id, relayId);
  await backdate(relayId, 120);
  const ok1 = await submitRelayTurn(pool, ana.id, relayId, 1, p1.inputs, p1.finalTick);
  assert.deepEqual({ placed: ok1.placed, ended: ok1.ended, height: ok1.height }, { placed: 5, ended: false, height: 5 });

  // Bea continues the same tower: she receives every earlier drop and the tick it stopped at.
  const t2 = await startRelayTurn(pool, bea.id, relayId);
  assert.equal(t2.turnNo, 2);
  assert.deepEqual(t2.inputs, p1.inputs);
  assert.equal(t2.finalTick, p1.finalTick);
  assert.equal(t2.height, 5);
  const p2 = playRelayTurn(seed, t2.inputs, t2.finalTick, 5, { wait: 30 });
  // Lease over: Ana takes the turn back; Bea's late play does not count and she is told who took it.
  await pool.query("UPDATE arena_group_relays SET lock_until = clock_timestamp() - interval '1 second' WHERE relay_id = $1", [relayId]);
  const t2b = await startRelayTurn(pool, ana.id, relayId);
  assert.equal(t2b.turnNo, 2);
  const taken = await code(submitRelayTurn(pool, bea.id, relayId, 2, p2.inputs, p2.finalTick), "TURN_TAKEN") as RelayError;
  assert.equal(taken.detail.holder, "Relevo Ana");
  const seen = await relayOverview(pool, bea.id, group.id);
  assert.equal(seen!.myRefusal?.reason, "TURN_TAKEN", "the one who came later sees why");
  assert.equal(seen!.myRefusal?.holder, "Relevo Ana");
  assert.equal(seen!.lock?.name, "Relevo Ana");
  assert.equal(seen!.lock?.mine, false);
  await releaseRelayTurn(pool, ana.id, relayId);
  await code(releaseRelayTurn(pool, ana.id, relayId), "NOT_HOLDER");
  // Lease over and late: refused.
  await startRelayTurn(pool, bea.id, relayId);
  await backdate(relayId, 600);
  await pool.query("UPDATE arena_group_relays SET lock_until = clock_timestamp() - interval '11 seconds' WHERE relay_id = $1", [relayId]);
  await code(submitRelayTurn(pool, bea.id, relayId, 2, p2.inputs, p2.finalTick), "LEASE_EXPIRED");
  // Bea plays her turn properly.
  await startRelayTurn(pool, bea.id, relayId);
  await backdate(relayId, 120);
  const ok2 = await submitRelayTurn(pool, bea.id, relayId, 2, p2.inputs, p2.finalTick);
  assert.equal(ok2.height, 10);

  // Ana places one block and lets the run idle out: the relay ends; the group result stays.
  const t3 = await startRelayTurn(pool, ana.id, relayId);
  const p3 = playRelayTurn(seed, t3.inputs, t3.finalTick, 5, { idleAfter: 1 });
  await backdate(relayId, 120);
  await pool.query("UPDATE arena_group_relays SET lock_until = clock_timestamp() + interval '1 minute' WHERE relay_id = $1", [relayId]);
  const ok3 = await submitRelayTurn(pool, ana.id, relayId, 3, p3.inputs, p3.finalTick);
  assert.deepEqual({ placed: ok3.placed, ended: ok3.ended, height: ok3.height, failure: ok3.failure }, { placed: 1, ended: true, height: 11, failure: "TIMEOUT_IDLE" });
  await code(startRelayTurn(pool, bea.id, relayId), "RELAY_CLOSED");
  const view = (await relayOverview(pool, bea.id, group.id))!;
  assert.equal(view.status, "finished");
  assert.equal(view.height, 11);
  assert.equal(view.turns, 3);
  assert.deepEqual(view.players.map((p) => [p.name, p.blocks, p.turns]), [["Relevo Ana", 6, 2], ["Relevo Bea", 5, 1]], "each member's points: the blocks they placed");
  assert.deepEqual(view.recent.map((t) => t.turnNo), [3, 2, 1]);
  const audit = (await pool.query("SELECT reason FROM arena_group_relay_rejections WHERE relay_id = $1 ORDER BY at", [relayId])).rows.map((r) => r.reason);
  assert.deepEqual(audit, ["RELAY_BUSY", "TOO_FAST", "TURN_TAKEN", "INVALID_TURN:TURN_NOT_FINISHED", "TURN_TAKEN", "LEASE_EXPIRED"], "every refused turn is kept");
  // The overview of the groups screen carries the relay.
  const ov = await groupsOverview(pool, { accountId: bea.id, platform: "mobile" });
  assert.equal((ov.current as { relay: { relayId: string } | null }).relay?.relayId, relayId);

  // A new relay after the finished one; its creator can cancel it.
  const second = await createRelay(pool, bea.id, group.id, 3);
  await code(cancelRelay(pool, ana.id, second.relayId), "NOT_CREATOR");
  await cancelRelay(pool, bea.id, second.relayId);
  assert.equal((await relayOverview(pool, ana.id, group.id))!.relayId, second.relayId, "the latest relay is shown");
  // Database guards: valid turn sizes and one relay in play per group.
  await assert.rejects(pool.query("UPDATE arena_group_relays SET blocks_per_turn = 4 WHERE relay_id = $1", [relayId]));
  await createRelay(pool, ana.id, group.id, 10);
  await assert.rejects(pool.query("UPDATE arena_group_relays SET status = 'open' WHERE relay_id = $1", [relayId]), /unique|duplicate/i);
  // Leaving the group or erasing the account: no more turns; history stays (anonymised name).
  await leaveGroup(pool, bea.id, group.id);
  const third = (await relayOverview(pool, ana.id, group.id))!.relayId;
  await code(startRelayTurn(pool, bea.id, third), "NOT_MEMBER");
  await deleteAccount(pool, accountAuthKey("google", "rel-Bea", SECRET));
  assert.ok((await relayOverview(pool, ana.id, group.id)) !== null);
  console.log("Group relay PG: one turn at a time (later starter told who and since when), continuation of the same tower, refusals (too fast, wrong turn, invalid, lease over, taken), end by idling, points per member, audit of refusals, overview");
} finally {
  await pool.end();
  if (created) await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await admin.end();
}
