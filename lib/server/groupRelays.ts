/**
 * v211 · Group relay ("juego grupal") on the server (db/migrations/015-group-relays.sql). The rules and the turn check
 * are the pure code in lib/verified/stackRelay.v1.ts; this module only decides who holds the turn, keeps the committed
 * run and records every accepted or refused turn.
 *
 * One player at a time: starting a turn takes a lock with a wall-clock lease (60 s + 15 s per block). Whoever starts
 * later while it is held is refused at once and told who is playing and since when. A played turn counts only if it
 * comes from the lock holder, for that turn, before the lease ends (+10 s grace), was not played faster than real time
 * (wall time from the lock to the submission vs simulated time) and its replay of the whole run is valid. Refused
 * turns are kept (arena_group_relay_rejections) so the player who arrived later sees why.
 */
import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import {
  STACK_RELAY_RULES_V1, checkRelayTurn, isRelayBlocksPerTurn, relayLeaseMs, relayPlayedInRealTime, type RelayInput,
} from "@/lib/verified/stackRelay.v1";

export type RelayErrorCode =
  | "NOT_MEMBER" | "NO_GROUP" | "NO_RELAY" | "RELAY_EXISTS" | "RELAY_CLOSED" | "RELAY_BUSY" | "TURN_TAKEN" | "LEASE_EXPIRED"
  | "TOO_FAST" | "INVALID_TURN" | "NOT_HOLDER" | "NOT_CREATOR" | "INVALID_BLOCKS";
export class RelayError extends Error {
  constructor(readonly code: RelayErrorCode, readonly detail: Record<string, unknown> = {}) { super(code); }
}
export const relayErrorStatus = (code: RelayErrorCode) =>
  code === "NO_RELAY" || code === "NO_GROUP" ? 404 : code === "NOT_MEMBER" || code === "NOT_CREATOR" || code === "NOT_HOLDER" ? 403 : code === "INVALID_BLOCKS" || code === "INVALID_TURN" ? 422 : 409;

type RelayRow = {
  relay_id: string; group_id: string; seed: string; blocks_per_turn: number; created_by: string; status: string;
  inputs: RelayInput[]; final_tick: number; height: number; score: string; turns: number; failure: string | null;
  lock_account: string | null; lock_turn: number | null; lock_started_at: Date | null; lock_until: Date | null;
  game_version: string; now: Date;
};

async function tx<T>(pool: Pool, work: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const out = await work(c);
    await c.query("COMMIT");
    return out;
  } catch (e) {
    await c.query("ROLLBACK").catch(() => undefined);
    throw e;
  } finally {
    c.release();
  }
}

async function assertMember(c: Pick<PoolClient, "query">, groupId: string, accountId: string) {
  const { rows } = await c.query(
    `SELECT 1 FROM arena_group_members m JOIN arena_groups g USING (group_id)
      WHERE m.group_id = $1 AND m.account_id = $2 AND m.left_at IS NULL AND g.closed_at IS NULL`, [groupId, accountId]);
  if (!rows[0]) throw new RelayError("NOT_MEMBER");
}
async function lockRelay(c: PoolClient, relayId: string): Promise<RelayRow> {
  const { rows } = await c.query(`SELECT r.*, clock_timestamp() AS now FROM arena_group_relays r WHERE relay_id = $1 FOR UPDATE`, [relayId]);
  if (!rows[0]) throw new RelayError("NO_RELAY");
  return rows[0] as RelayRow;
}
async function nameOf(c: Pick<PoolClient, "query">, accountId: string | null) {
  if (!accountId) return null;
  const { rows } = await c.query("SELECT display_name FROM arena_accounts WHERE account_id = $1", [accountId]);
  return (rows[0]?.display_name as string | undefined) ?? null;
}
async function refuse(c: Pick<PoolClient, "query">, relayId: string, accountId: string, reason: string, holder: string | null) {
  await c.query("INSERT INTO arena_group_relay_rejections(relay_id, account_id, reason, holder) VALUES ($1, $2, $3, $4)", [relayId, accountId, reason, holder]);
}
const lockActive = (r: RelayRow) => !!r.lock_account && !!r.lock_until && r.lock_until.getTime() > r.now.getTime();

/** Opens the group's relay (one in play per group). The server chooses the seed. */
export async function createRelay(pool: Pool, accountId: string, groupId: string, blocksPerTurn: unknown) {
  if (!isRelayBlocksPerTurn(blocksPerTurn)) throw new RelayError("INVALID_BLOCKS");
  return tx(pool, async (c) => {
    await assertMember(c, groupId, accountId);
    const open = await c.query("SELECT relay_id FROM arena_group_relays WHERE group_id = $1 AND status = 'open' FOR UPDATE", [groupId]);
    if (open.rows[0]) throw new RelayError("RELAY_EXISTS", { relayId: open.rows[0].relay_id });
    const relayId = randomUUID();
    await c.query(
      `INSERT INTO arena_group_relays(relay_id, group_id, rules_version, game_id, game_version, seed, blocks_per_turn, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [relayId, groupId, STACK_RELAY_RULES_V1.version, STACK_RELAY_RULES_V1.gameId, STACK_RELAY_RULES_V1.gameVersion, `relay:${randomUUID()}`, blocksPerTurn, accountId]);
    return { relayId };
  });
}

/** Takes the turn, or says who has it. Returns everything the browser needs to rebuild the tower and play on. */
export async function startRelayTurn(pool: Pool, accountId: string, relayId: string) {
  const out = await tx(pool, async (c) => {
    const r = await lockRelay(c, relayId);
    await assertMember(c, r.group_id, accountId);
    if (r.status !== "open") throw new RelayError("RELAY_CLOSED");
    if (lockActive(r) && r.lock_account !== accountId) {
      // Committed with the transaction (the record of who came later), then reported.
      await refuse(c, relayId, accountId, "RELAY_BUSY", r.lock_account);
      return { refused: new RelayError("RELAY_BUSY", { holder: await nameOf(c, r.lock_account), since: r.lock_started_at!.toISOString(), until: r.lock_until!.toISOString() }) };
    }
    let turn = r.lock_turn, started = r.lock_started_at, until = r.lock_until;
    if (!lockActive(r)) {
      turn = r.turns + 1;
      const taken = await c.query(
        `UPDATE arena_group_relays SET lock_account = $2, lock_turn = $3, lock_started_at = clock_timestamp(),
                lock_until = clock_timestamp() + make_interval(secs => $4::double precision / 1000)
          WHERE relay_id = $1 RETURNING lock_started_at, lock_until`, [relayId, accountId, turn, relayLeaseMs(r.blocks_per_turn)]);
      started = taken.rows[0].lock_started_at; until = taken.rows[0].lock_until;
    }
    return {
      turn: {
        relayId, turnNo: turn!, seed: r.seed, gameVersion: r.game_version, rulesVersion: STACK_RELAY_RULES_V1.version,
        blocksPerTurn: r.blocks_per_turn, inputs: r.inputs, finalTick: r.final_tick, height: r.height,
        startedAt: started!.toISOString(), leaseUntil: until!.toISOString(),
      },
    };
  });
  if ("refused" in out && out.refused) throw out.refused;
  return out.turn!;
}

/** The holder gives the turn back without playing it (nothing changes in the tower). */
export async function releaseRelayTurn(pool: Pool, accountId: string, relayId: string) {
  return tx(pool, async (c) => {
    const r = await lockRelay(c, relayId);
    if (r.lock_account !== accountId) throw new RelayError("NOT_HOLDER");
    await c.query("UPDATE arena_group_relays SET lock_account = NULL, lock_turn = NULL, lock_started_at = NULL, lock_until = NULL WHERE relay_id = $1", [relayId]);
    return {};
  });
}

/** A played turn. Only the drops travel; the tower, height and score are recomputed by replaying the whole run. */
export async function submitRelayTurn(pool: Pool, accountId: string, relayId: string, turnNo: unknown, rawInputs: unknown, finalTick: unknown) {
  const result = await tx(pool, async (c) => {
    const r = await lockRelay(c, relayId);
    await assertMember(c, r.group_id, accountId);
    if (r.status !== "open") throw new RelayError("RELAY_CLOSED");
    const release = () => c.query("UPDATE arena_group_relays SET lock_account = NULL, lock_turn = NULL, lock_started_at = NULL, lock_until = NULL WHERE relay_id = $1", [relayId]);
    if (r.lock_account !== accountId || r.lock_turn !== turnNo) {
      // Someone else took the turn (or it already moved on): this play arrived later and does not count.
      const holder = lockActive(r) ? r.lock_account : null;
      await refuse(c, relayId, accountId, "TURN_TAKEN", holder);
      return { refused: new RelayError("TURN_TAKEN", { holder: await nameOf(c, holder), since: holder ? r.lock_started_at!.toISOString() : null, turns: r.turns }) };
    }
    const late = r.now.getTime() - r.lock_until!.getTime();
    if (late > STACK_RELAY_RULES_V1.submitGraceMs) {
      await release(); await refuse(c, relayId, accountId, "LEASE_EXPIRED", null);
      return { refused: new RelayError("LEASE_EXPIRED") };
    }
    const turnInputs = Array.isArray(rawInputs) ? rawInputs.map((x) => ({ tick: (x as RelayInput)?.tick, action: (x as RelayInput)?.action })) as RelayInput[] : (null as unknown as RelayInput[]);
    const check = checkRelayTurn({ seed: r.seed, committed: r.inputs, committedFinalTick: r.final_tick, blocksPerTurn: r.blocks_per_turn, turnInputs, finalTick: finalTick as number });
    if (!check.ok) {
      await release(); await refuse(c, relayId, accountId, `INVALID_TURN:${check.error}`, null);
      return { refused: new RelayError("INVALID_TURN", { reason: check.error }) };
    }
    const wallMs = r.now.getTime() - r.lock_started_at!.getTime();
    if (!relayPlayedInRealTime((finalTick as number) - r.final_tick, wallMs)) {
      await release(); await refuse(c, relayId, accountId, "TOO_FAST", null);
      return { refused: new RelayError("TOO_FAST") };
    }
    const s = check.state;
    await c.query(
      `INSERT INTO arena_group_relay_turns(relay_id, turn_no, account_id, started_at, inputs, from_tick, final_tick, placed, ended)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9)`,
      [relayId, turnNo, accountId, r.lock_started_at, JSON.stringify(turnInputs), r.final_tick, finalTick, check.placed, check.ended]);
    await c.query(
      `UPDATE arena_group_relays SET inputs = $2::jsonb, final_tick = $3, height = $4, score = $5, turns = turns + 1, failure = $6,
              status = CASE WHEN $7 THEN 'finished' ELSE status END, finished_at = CASE WHEN $7 THEN clock_timestamp() ELSE NULL END,
              lock_account = NULL, lock_turn = NULL, lock_started_at = NULL, lock_until = NULL
        WHERE relay_id = $1`,
      [relayId, JSON.stringify(check.inputs), finalTick, s.height, s.score, s.failure, check.ended]);
    return { accepted: { turnNo: turnNo as number, placed: check.placed, ended: check.ended, height: s.height, score: s.score, failure: s.failure } };
  });
  // Refusals are committed (the record of who arrived later) before they are reported.
  if ("refused" in result && result.refused) throw result.refused;
  return result.accepted!;
}

/** The group's creator (of the relay) can stop a relay in play, e.g. to start one with another turn size. */
export async function cancelRelay(pool: Pool, accountId: string, relayId: string) {
  return tx(pool, async (c) => {
    const r = await lockRelay(c, relayId);
    if (r.created_by !== accountId) throw new RelayError("NOT_CREATOR");
    if (r.status !== "open") throw new RelayError("RELAY_CLOSED");
    await c.query(`UPDATE arena_group_relays SET status = 'cancelled', finished_at = clock_timestamp(), lock_account = NULL, lock_turn = NULL, lock_started_at = NULL, lock_until = NULL WHERE relay_id = $1`, [relayId]);
    return {};
  });
}

export type RelayView = {
  relayId: string; status: "open" | "finished" | "cancelled"; blocksPerTurn: number; height: number; score: number; turns: number;
  failure: string | null; createdByMe: boolean; createdAt: string;
  lock: { name: string | null; mine: boolean; since: string; until: string } | null;
  players: { accountId: string; name: string; blocks: number; turns: number }[];
  recent: { turnNo: number; accountId: string; name: string; placed: number; ended: boolean; at: string }[];
  /** The player's latest refused turn in the last 30 minutes (to tell the one who arrived later). */
  myRefusal: { reason: string; holder: string | null; at: string } | null;
};

/** The group's relay in play, or its latest one. */
export async function relayOverview(pool: Pool, accountId: string, groupId: string): Promise<RelayView | null> {
  const { rows } = await pool.query(
    `SELECT r.*, clock_timestamp() AS now, a.display_name AS holder_name FROM arena_group_relays r LEFT JOIN arena_accounts a ON a.account_id = r.lock_account
      WHERE r.group_id = $1 ORDER BY (r.status = 'open') DESC, r.created_at DESC LIMIT 1`, [groupId]);
  const r = rows[0] as (RelayRow & { holder_name: string | null; created_at: Date }) | undefined;
  if (!r) return null;
  const [players, recent, refusal] = await Promise.all([
    pool.query(
      `SELECT t.account_id, a.display_name, sum(t.placed)::int AS blocks, count(*)::int AS turns
         FROM arena_group_relay_turns t JOIN arena_accounts a USING (account_id) WHERE t.relay_id = $1
        GROUP BY t.account_id, a.display_name ORDER BY blocks DESC, turns, a.display_name`, [r.relay_id]),
    pool.query(
      `SELECT t.turn_no, t.account_id, a.display_name, t.placed, t.ended, t.submitted_at FROM arena_group_relay_turns t JOIN arena_accounts a USING (account_id)
        WHERE t.relay_id = $1 ORDER BY t.turn_no DESC LIMIT 8`, [r.relay_id]),
    pool.query(
      `SELECT x.reason, a.display_name AS holder, x.at FROM arena_group_relay_rejections x LEFT JOIN arena_accounts a ON a.account_id = x.holder
        WHERE x.relay_id = $1 AND x.account_id = $2 AND x.at > clock_timestamp() - interval '30 minutes' ORDER BY x.at DESC LIMIT 1`, [r.relay_id, accountId]),
  ]);
  const active = lockActive(r);
  return {
    relayId: r.relay_id, status: r.status as RelayView["status"], blocksPerTurn: r.blocks_per_turn, height: r.height, score: Number(r.score), turns: r.turns,
    failure: r.failure, createdByMe: r.created_by === accountId, createdAt: r.created_at.toISOString(),
    lock: active ? { name: r.holder_name, mine: r.lock_account === accountId, since: r.lock_started_at!.toISOString(), until: r.lock_until!.toISOString() } : null,
    players: players.rows.map((p) => ({ accountId: p.account_id, name: p.display_name, blocks: p.blocks, turns: p.turns })),
    recent: recent.rows.map((t) => ({ turnNo: t.turn_no, accountId: t.account_id, name: t.display_name, placed: t.placed, ended: t.ended, at: (t.submitted_at as Date).toISOString() })),
    myRefusal: refusal.rows[0] ? { reason: refusal.rows[0].reason, holder: refusal.rows[0].holder, at: (refusal.rows[0].at as Date).toISOString() } : null,
  };
}
