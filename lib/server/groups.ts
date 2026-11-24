/**
 * v193 · Groups, leagues, tournaments and group-against-group on the server (db/migrations/009-groups.sql).
 *
 * The rules are the pure code in lib/groupCompetition.ts and lib/groupVersus.ts. This module only keeps who plays, what
 * they paid (double-entry ledger, lib/server/ledger.ts) and the results, and every score comes from a verified attempt
 * (`arena_public_attempts.response`, written by the server replay), never from the browser. Groups and competitions
 * belong to one platform: phones never meet computers. No commission on entries (v186): the pot is paid out in full.
 */
import { randomInt, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { createGroupCompetition, groupStandings, matchOrder, recordGroupScore, roundGame, type GroupCompetition, type GroupConfig, type GroupPlayer } from "@/lib/groupCompetition";
import { createGroupVersus, recordVersusScore, versusOutcome, versusPayouts, type GroupVersus, type VersusSetup } from "@/lib/groupVersus";
import { isChanceGameId } from "@/lib/games";
import { isGroupArtId } from "@/lib/groupArt";
import type { Platform } from "@/lib/platform";
import { ledgerBalance, postTransaction } from "./ledger";
import { addNotices, type NoticeDraft } from "./notifications";
import type { NoticeData } from "@/lib/notices";

export const GROUP_RULES_VERSION = "group-competition-v1";
export const GROUP_MAX_MEMBERS = 20;
export type CompetitionMode = "group" | "versus-league" | "versus-tournament";

export type GroupErrorCode =
  | "INVALID_NAME" | "NO_ACCOUNT" | "NO_GROUP" | "PLATFORM_MISMATCH" | "GROUP_FULL" | "ALREADY_MEMBER" | "NOT_MEMBER" | "NOT_OWNER"
  | "OWNER_CANNOT_LEAVE" | "GROUP_BUSY" | "INVALID_COMPETITION" | "CHANCE_GAME_NOT_FOR_MONEY" | "NO_COMPETITION" | "NOT_OPEN"
  | "NOT_RUNNING" | "INSUFFICIENT_BALANCE" | "INVALID_TEAMS" | "INVALID_ATTEMPT" | "ALREADY_RECORDED" | "FIRST_ATTEMPT_REQUIRED" | "PAYOUT_MISMATCH" | "INVALID_ART";
export class GroupError extends Error {
  constructor(readonly code: GroupErrorCode) { super(code); }
}

export type GroupView = { id: string; name: string; code: string; platform: Platform; ownerId: string; members: number; art?: string | null };
export type CompetitionView = {
  id: string; mode: CompetitionMode; platform: Platform; status: "open" | "running" | "finished" | "cancelled"; entryMinor: number;
  groupIds: string[]; players: number; potMinor: number; result: unknown;
};

async function inTransaction<T>(pool: Pool, work: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const out = await work(client);
    await client.query("COMMIT");
    return out;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newCode = () => Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");

async function activeAccount(c: Pick<PoolClient, "query">, accountId: string, lock = false) {
  const { rows } = await c.query(`SELECT account_id FROM arena_accounts WHERE account_id = $1 AND deleted_at IS NULL${lock ? " FOR UPDATE" : ""}`, [accountId]);
  if (!rows[0]) throw new GroupError("NO_ACCOUNT");
}

// ───────────────────────────── groups ─────────────────────────────

export async function createGroup(pool: Pool, ownerId: string, name: string, platform: Platform): Promise<GroupView> {
  const clean = name.trim().replace(/\s+/g, " ");
  if (clean.length < 2 || clean.length > 30) throw new GroupError("INVALID_NAME");
  return inTransaction(pool, async (c) => {
    await activeAccount(c, ownerId);
    for (let attempt = 0; attempt < 5; attempt++) {
      const id = randomUUID(), code = newCode();
      const done = await c.query(
        "INSERT INTO arena_groups(group_id, name, code, owner_account_id, platform) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING group_id",
        [id, clean, code, ownerId, platform],
      );
      if (!done.rows[0]) continue;
      await c.query("INSERT INTO arena_group_members(group_id, account_id, role) VALUES ($1,$2,'owner')", [id, ownerId]);
      return { id, name: clean, code, platform, ownerId, members: 1 };
    }
    throw new Error("GROUP_CODE_COLLISION");
  });
}

/** Joins with the group's code from a device of the same platform. */
export async function joinGroup(pool: Pool, accountId: string, code: string, platform: Platform): Promise<GroupView> {
  return inTransaction(pool, async (c) => {
    await activeAccount(c, accountId);
    const g = (await c.query("SELECT group_id, name, code, platform, owner_account_id FROM arena_groups WHERE code = $1 AND closed_at IS NULL FOR UPDATE", [code.trim().toUpperCase()])).rows[0];
    if (!g) throw new GroupError("NO_GROUP");
    if (g.platform !== platform) throw new GroupError("PLATFORM_MISMATCH");
    const members = Number((await c.query("SELECT count(*) AS n FROM arena_group_members WHERE group_id = $1 AND left_at IS NULL", [g.group_id])).rows[0].n);
    const mine = (await c.query("SELECT left_at FROM arena_group_members WHERE group_id = $1 AND account_id = $2", [g.group_id, accountId])).rows[0];
    if (mine && mine.left_at === null) throw new GroupError("ALREADY_MEMBER");
    if (members >= GROUP_MAX_MEMBERS) throw new GroupError("GROUP_FULL");
    if (mine) await c.query("UPDATE arena_group_members SET left_at = NULL, joined_at = now() WHERE group_id = $1 AND account_id = $2", [g.group_id, accountId]);
    else await c.query("INSERT INTO arena_group_members(group_id, account_id) VALUES ($1,$2)", [g.group_id, accountId]);
    return { id: g.group_id as string, name: g.name as string, code: g.code as string, platform: g.platform as Platform, ownerId: g.owner_account_id as string, members: members + 1 };
  });
}

/** A member leaves; not while one of their competitions is open or running, and never the owner (who closes it). */
export async function leaveGroup(pool: Pool, accountId: string, groupId: string): Promise<void> {
  await inTransaction(pool, async (c) => {
    const m = (await c.query("SELECT role FROM arena_group_members WHERE group_id = $1 AND account_id = $2 AND left_at IS NULL FOR UPDATE", [groupId, accountId])).rows[0];
    if (!m) throw new GroupError("NOT_MEMBER");
    if (m.role === "owner") throw new GroupError("OWNER_CANNOT_LEAVE");
    const busy = await c.query(
      `SELECT 1 FROM arena_competition_players cp JOIN arena_competitions k USING (competition_id)
        WHERE cp.account_id = $1 AND cp.group_id = $2 AND k.status IN ('open', 'running') LIMIT 1`, [accountId, groupId]);
    if (busy.rows[0]) throw new GroupError("GROUP_BUSY");
    await c.query("UPDATE arena_group_members SET left_at = now() WHERE group_id = $1 AND account_id = $2", [groupId, accountId]);
  });
}

/** The owner closes the group (the "borrar" button). Refused while it is in an open or running competition: cancel that first. */
export async function closeGroup(pool: Pool, ownerId: string, groupId: string): Promise<void> {
  await inTransaction(pool, async (c) => {
    const g = (await c.query("SELECT owner_account_id FROM arena_groups WHERE group_id = $1 AND closed_at IS NULL FOR UPDATE", [groupId])).rows[0];
    if (!g) throw new GroupError("NO_GROUP");
    if (g.owner_account_id !== ownerId) throw new GroupError("NOT_OWNER");
    const busy = await c.query(
      `SELECT 1 FROM arena_competition_groups cg JOIN arena_competitions k USING (competition_id)
        WHERE cg.group_id = $1 AND k.status IN ('open', 'running') LIMIT 1`, [groupId]);
    if (busy.rows[0]) throw new GroupError("GROUP_BUSY");
    await c.query("UPDATE arena_group_members SET left_at = now() WHERE group_id = $1 AND left_at IS NULL", [groupId]);
    await c.query("UPDATE arena_groups SET closed_at = now() WHERE group_id = $1", [groupId]);
  });
}

export async function listGroupMembers(pool: Pool, groupId: string): Promise<{ accountId: string; name: string; avatar: number; role: string }[]> {
  const { rows } = await pool.query(
    `SELECT a.account_id, a.display_name, a.avatar, m.role FROM arena_group_members m JOIN arena_accounts a USING (account_id)
      WHERE m.group_id = $1 AND m.left_at IS NULL ORDER BY m.joined_at, a.account_id`, [groupId]);
  return rows.map((r) => ({ accountId: r.account_id as string, name: r.display_name as string, avatar: Number(r.avatar), role: r.role as string }));
}

// ─────────────────────────── competitions ───────────────────────────

type Setup = GroupConfig | VersusSetup;

/**
 * Opens a competition. Mode "group": one group, `config` is a GroupConfig. Versus modes: the creator's group, or both groups
 * of the same platform; with one, it is an open challenge another group answers (acceptChallenge). `config` is a VersusSetup. With an entry, games of chance are refused (no licence).
 */
export async function createCompetition(
  pool: Pool,
  a: { createdBy: string; mode: CompetitionMode; groupIds: readonly string[]; config: Setup },
): Promise<CompetitionView> {
  const versus = a.mode !== "group";
  if (a.groupIds.length < 1 || a.groupIds.length > (versus ? 2 : 1) || new Set(a.groupIds).size !== a.groupIds.length) throw new GroupError("INVALID_COMPETITION");
  const entry = a.config.entryMinor;
  if (!Number.isSafeInteger(entry) || entry < 0 || !a.config.gameIds.length) throw new GroupError("INVALID_COMPETITION");
  if (entry > 0 && [...a.config.gameIds, ...(a.config.randomPool ?? [])].some(isChanceGameId)) throw new GroupError("CHANCE_GAME_NOT_FOR_MONEY");
  const config = versus ? a.config : { ...(a.config as GroupConfig), commissionBps: 0 };
  return inTransaction(pool, async (c) => {
    await activeAccount(c, a.createdBy);
    const { rows } = await c.query("SELECT group_id, platform, owner_account_id FROM arena_groups WHERE group_id = ANY($1::uuid[]) AND closed_at IS NULL", [a.groupIds]);
    if (rows.length !== a.groupIds.length) throw new GroupError("NO_GROUP");
    const platform = rows[0].platform as Platform;
    if (rows.some((g) => g.platform !== platform)) throw new GroupError("PLATFORM_MISMATCH");
    if (!rows.some((g) => g.owner_account_id === a.createdBy)) throw new GroupError("NOT_OWNER");
    const id = randomUUID();
    await c.query(
      `INSERT INTO arena_competitions(competition_id, mode, rules_version, platform, entry_minor, config, created_by) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)`,
      [id, a.mode, GROUP_RULES_VERSION, platform, entry, JSON.stringify(config), a.createdBy],
    );
    for (const [side, groupId] of a.groupIds.entries()) await c.query("INSERT INTO arena_competition_groups(competition_id, group_id, side) VALUES ($1,$2,$3)", [id, groupId, side]);
    return { id, mode: a.mode, platform, status: "open", entryMinor: entry, groupIds: [...a.groupIds], players: 0, potMinor: 0, result: null };
  });
}

/** A member pays the entry (player → pot) and is in. A retried tap changes nothing. */
export async function enterCompetition(pool: Pool, competitionId: string, accountId: string): Promise<{ entered: boolean }> {
  return inTransaction(pool, async (c) => {
    const k = (await c.query("SELECT status, entry_minor FROM arena_competitions WHERE competition_id = $1 FOR UPDATE", [competitionId])).rows[0];
    if (!k) throw new GroupError("NO_COMPETITION");
    if (k.status !== "open") throw new GroupError("NOT_OPEN");
    await activeAccount(c, accountId, true);
    const mine = (await c.query(
      `SELECT cg.group_id FROM arena_competition_groups cg JOIN arena_group_members m ON m.group_id = cg.group_id AND m.account_id = $2 AND m.left_at IS NULL
        WHERE cg.competition_id = $1 LIMIT 1`, [competitionId, accountId])).rows[0];
    if (!mine) throw new GroupError("NOT_MEMBER");
    const already = await c.query("SELECT 1 FROM arena_competition_players WHERE competition_id = $1 AND account_id = $2", [competitionId, accountId]);
    if (already.rows[0]) return { entered: false };
    const entry = Number(k.entry_minor);
    if (entry > 0) {
      if ((await ledgerBalance(c, { kind: "player", accountId }, "CC")) < entry) throw new GroupError("INSUFFICIENT_BALANCE");
      await postTransaction(c, {
        kind: "entry", accountId, competitionId, requestKey: `entry:${competitionId}`,
        postings: [{ ref: { kind: "player", accountId }, currency: "CC", amountMinor: -entry }, { ref: { kind: "pot", competitionId }, currency: "CC", amountMinor: entry }],
      });
    }
    await c.query("INSERT INTO arena_competition_players(competition_id, account_id, group_id) VALUES ($1,$2,$3)", [competitionId, accountId, mine.group_id]);
    return { entered: true };
  });
}

const GROUP_PLAYERS = `SELECT cp.account_id, cp.group_id, a.display_name, a.avatar FROM arena_competition_players cp JOIN arena_accounts a USING (account_id)
  WHERE cp.competition_id = $1 ORDER BY cp.entered_at, cp.account_id`;

/** The creator starts it with the players who entered. Versus modes need the same number of players on each side. */
export async function startCompetition(pool: Pool, competitionId: string, byAccount: string): Promise<void> {
  await inTransaction(pool, async (c) => {
    const k = (await c.query("SELECT mode, status, config, created_by FROM arena_competitions WHERE competition_id = $1 FOR UPDATE", [competitionId])).rows[0];
    if (!k) throw new GroupError("NO_COMPETITION");
    if (k.created_by !== byAccount) throw new GroupError("NOT_OWNER");
    if (k.status !== "open") throw new GroupError("NOT_OPEN");
    const rows = (await c.query(GROUP_PLAYERS, [competitionId])).rows;
    const player = (r: Record<string, unknown>): GroupPlayer => ({ id: r.account_id as string, name: r.display_name as string, avatar: String(r.avatar) });
    let state: GroupCompetition | GroupVersus;
    try {
      if (k.mode === "group") {
        if (rows.length < 2) throw new GroupError("INVALID_TEAMS");
        state = createGroupCompetition(competitionId, k.config as GroupConfig, rows.map(player));
      } else {
        const groups = (await c.query("SELECT cg.group_id, g.name FROM arena_competition_groups cg JOIN arena_groups g USING (group_id) WHERE cg.competition_id = $1 ORDER BY cg.side", [competitionId])).rows;
        const team = (g: Record<string, unknown>) => ({ id: g.group_id as string, name: g.name as string, players: rows.filter((r) => r.group_id === g.group_id).map(player) });
        state = createGroupVersus(competitionId, k.mode === "versus-league" ? "league" : "tournament", team(groups[0]), team(groups[1]), k.config as VersusSetup);
      }
    } catch (e) {
      if (e instanceof GroupError) throw e;
      throw new GroupError("INVALID_TEAMS");
    }
    await c.query("UPDATE arena_competitions SET status = 'running', state = $2::jsonb, state_version = 1, started_at = now() WHERE competition_id = $1", [competitionId, JSON.stringify(state)]);
    // v230: everyone who entered (but the one who just pressed start) is told it is their turn on matchday 1.
    const base = await noticeBase(c, competitionId, k.mode as string);
    await addNotices(c, turnNotices(base, comp(k.mode as string, state), 0).filter((d) => d.accountId !== byAccount));
  });
}

/** v228: an abandoned attempt in a game where the lower result wins (milliseconds): worse than any real run. */
export const ABANDONED_LOWER_WINS_SCORE = 999_999;
const comp = (mode: string, state: GroupCompetition | GroupVersus): GroupCompetition => (mode === "group" ? (state as GroupCompetition) : (state as GroupVersus).comp);

/**
 * Records one player's result in a match of the running competition. The score is read from the verified attempt
 * (server replay): it must belong to this person, be of the game of that round and have started after the competition.
 * When the competition ends, the pot is paid out in the same database transaction.
 */
export async function recordResult(pool: Pool, a: { competitionId: string; matchIndex: number; accountId: string; attemptId: string }): Promise<{ finished: boolean }> {
  return inTransaction(pool, async (c) => {
    const k = (await c.query("SELECT mode, status, state, started_at FROM arena_competitions WHERE competition_id = $1 FOR UPDATE", [a.competitionId])).rows[0];
    if (!k) throw new GroupError("NO_COMPETITION");
    if (k.status !== "running") throw new GroupError("NOT_RUNNING");
    const att = (await c.query(
      `SELECT t.state, t.account_id, t.response, t.started_at, m.game_id FROM arena_public_attempts t JOIN arena_matches m USING (match_id) WHERE t.attempt_id = $1`,
      [a.attemptId])).rows[0];
    const response = att?.response as { authoritative_source?: string; score?: unknown; time_ms?: unknown } | null | undefined;
    // v228 (owner, 21-nov-2026): an abandoned (or rejected) matchday attempt is a loss with 0 points. It still has to be
    // the player's first attempt (checked below), so abandoning cannot be used to retry.
    const lost = att?.state === "forfeited" || att?.state === "rejected";
    if (!att || att.account_id !== a.accountId || new Date(att.started_at as string) < new Date(k.started_at as string)
      || (!lost && (att.state !== "verified" || response?.authoritative_source !== "SERVER_REPLAY" || typeof response.score !== "number")))
      throw new GroupError("INVALID_ATTEMPT");
    const state = k.state as GroupCompetition | GroupVersus;
    const current = comp(k.mode as string, state), match = current.matches[a.matchIndex];
    if (!match || !match.players.includes(a.accountId) || match.scores[a.accountId] !== undefined || roundGame(current, match.round) !== att.game_id) throw new GroupError("INVALID_ATTEMPT");
    // v227 (security review A2): only the player's FIRST finished attempt of that game since the competition started,
    // not yet used for another match of it, can be the matchday's result — no playing twenty times and keeping the best
    // one. Abandoned or rejected attempts count as that first one too (abandoning a bad run does not buy a retry).
    const first = (await c.query(
      `SELECT t.attempt_id FROM arena_public_attempts t JOIN arena_matches m USING (match_id)
        WHERE t.account_id = $1 AND m.game_id = $2 AND t.started_at >= $3 AND t.state IN ('verified','rejected','forfeited')
          AND NOT EXISTS (SELECT 1 FROM arena_competition_results r WHERE r.competition_id = $4 AND r.attempt_id = t.attempt_id)
        ORDER BY t.started_at, t.attempt_id LIMIT 1`,
      [a.accountId, att.game_id, k.started_at, a.competitionId])).rows[0];
    if (first?.attempt_id !== a.attemptId) throw new GroupError("FIRST_ATTEMPT_REQUIRED");
    // A loss is 0 points; in games where less is better (reaction time) 0 would win, so it is the worst time instead.
    const score = lost ? (current.config.lowerWinsGameIds.includes(att.game_id as string) ? ABANDONED_LOWER_WINS_SCORE : 0) : (response!.score as number);
    const time = !lost && typeof response!.time_ms === "number" ? response!.time_ms : undefined;
    const done = await c.query(
      `INSERT INTO arena_competition_results(competition_id, match_index, account_id, score, time_ms, attempt_id) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING 1`,
      [a.competitionId, a.matchIndex, a.accountId, score, time === undefined ? null : Math.round(time), a.attemptId]);
    if (!done.rows[0]) throw new GroupError("ALREADY_RECORDED");
    const next = k.mode === "group"
      ? recordGroupScore(state as GroupCompetition, a.matchIndex, a.accountId, score, time)
      : recordVersusScore(state as GroupVersus, a.matchIndex, a.accountId, score, time);
    await c.query("UPDATE arena_competitions SET state = $2::jsonb, state_version = state_version + 1 WHERE competition_id = $1", [a.competitionId, JSON.stringify(next)]);
    const finished = k.mode === "group" ? (next as GroupCompetition).finished : versusOutcome(next as GroupVersus).finished;
    // v230 · notices: the winner of a matchday once its last result is in, and everyone in the next matchday.
    const after = comp(k.mode as string, next), played = after.matches[a.matchIndex];
    const base = await noticeBase(c, a.competitionId, k.mode as string);
    const drafts: NoticeDraft[] = [];
    if (played && played.players.length >= 2 && played.players.every((id) => played.scores[id] !== undefined)) {
      const winner = matchOrder(after, played)[0];
      if (winner) drafts.push({ accountId: winner, kind: "matchday-won", key: `day:${a.competitionId}:${a.matchIndex}`,
        data: { ...base, round: played.round, gameId: roundGame(after, played.round) } });
    }
    if (!finished) drafts.push(...turnNotices(base, after, current.matches.length));
    await addNotices(c, drafts);
    if (finished) await settle(c, a.competitionId, k.mode as string, next);
    return { finished };
  });
}

/** Pays the pot out to the winners (or back to everyone on a draw) and closes the competition. */
async function settle(c: PoolClient, competitionId: string, mode: string, state: GroupCompetition | GroupVersus) {
  let payouts: Record<string, number>, result: Record<string, unknown>, kind: "prize" | "refund" = "prize";
  if (mode === "group") {
    payouts = { ...((state as GroupCompetition).payouts ?? {}) };
    result = { payouts };
  } else {
    const outcome = versusOutcome(state as GroupVersus);
    payouts = versusPayouts(state as GroupVersus) ?? {};
    if (outcome.finished && outcome.winner === null) kind = "refund";
    result = { winnerGroupId: outcome.finished ? outcome.winner : null, payouts };
  }
  const total = Object.values(payouts).reduce((s, v) => s + v, 0);
  const pot = await ledgerBalance(c, { kind: "pot", competitionId }, "CC");
  if (total !== pot) throw new GroupError("PAYOUT_MISMATCH");
  if (pot > 0) {
    await postTransaction(c, {
      kind, competitionId, requestKey: null, detail: { rules: GROUP_RULES_VERSION },
      postings: [
        { ref: { kind: "pot", competitionId }, currency: "CC", amountMinor: -pot },
        ...Object.entries(payouts).filter(([, v]) => v > 0).map(([accountId, v]) => ({ ref: { kind: "player", accountId } as const, currency: "CC" as const, amountMinor: v })),
      ],
    });
  }
  await c.query("UPDATE arena_competitions SET status = 'finished', result = $2::jsonb, finished_at = now() WHERE competition_id = $1", [competitionId, JSON.stringify(result)]);
  // v230: the winners are told (first place in a group competition; every player of the winning group in a versus).
  const base = await noticeBase(c, competitionId, mode);
  let winners: { id: string; group?: string }[] = [];
  if (mode === "group") winners = groupStandings(state as GroupCompetition).filter((r) => r.place === 1).map((r) => ({ id: r.id }));
  else {
    const outcome = versusOutcome(state as GroupVersus), team = (state as GroupVersus).teams.find((t) => outcome.finished && t.id === outcome.winner);
    if (team) winners = team.players.map((p) => ({ id: p.id, group: team.name }));
  }
  await addNotices(c, winners.map((w) => ({ accountId: w.id, kind: "competition-won" as const, key: `won:${competitionId}`,
    data: { ...base, ...(w.group ? { group: w.group } : {}) } })));
}

/** v230: what every notice of a competition carries — its id, its mode and (in a group competition) the group's name. */
async function noticeBase(c: PoolClient, competitionId: string, mode: string): Promise<NoticeData> {
  const m = mode === "versus-league" || mode === "versus-tournament" ? mode : "group";
  if (m !== "group") return { competitionId, mode: m };
  const g = (await c.query("SELECT g.name FROM arena_competition_groups cg JOIN arena_groups g USING (group_id) WHERE cg.competition_id = $1 AND cg.side = 0", [competitionId])).rows[0];
  return { competitionId, mode: m, ...(g ? { group: String(g.name) } : {}) };
}

/** v230: «te toca jugar» for every player of the matches scheduled from index `from` on (one notice per matchday). */
function turnNotices(base: NoticeData, c: GroupCompetition, from: number): NoticeDraft[] {
  const out = new Map<string, NoticeDraft>();
  for (const m of c.matches.slice(from))
    for (const id of m.players)
      if (!out.has(`${id}:${m.round}`))
        out.set(`${id}:${m.round}`, { accountId: id, kind: "your-turn", key: `turn:${base.competitionId}:${m.round}`, data: { ...base, round: m.round, gameId: roundGame(c, m.round) } });
  return [...out.values()];
}

/** The creator cancels an open or running competition; every entry goes back to its player. */
export async function cancelCompetition(pool: Pool, competitionId: string, byAccount: string): Promise<void> {
  await inTransaction(pool, async (c) => {
    const k = (await c.query("SELECT status, created_by, entry_minor FROM arena_competitions WHERE competition_id = $1 FOR UPDATE", [competitionId])).rows[0];
    if (!k) throw new GroupError("NO_COMPETITION");
    if (k.created_by !== byAccount) throw new GroupError("NOT_OWNER");
    if (k.status !== "open" && k.status !== "running") throw new GroupError("NOT_OPEN");
    const entry = Number(k.entry_minor);
    const players = (await c.query("SELECT account_id FROM arena_competition_players WHERE competition_id = $1", [competitionId])).rows;
    if (entry > 0 && players.length) {
      await postTransaction(c, {
        kind: "refund", competitionId, requestKey: null, detail: { reason: "cancelled" },
        postings: [
          { ref: { kind: "pot", competitionId }, currency: "CC", amountMinor: -entry * players.length },
          ...players.map((p) => ({ ref: { kind: "player", accountId: p.account_id as string } as const, currency: "CC" as const, amountMinor: entry })),
        ],
      });
    }
    await c.query("UPDATE arena_competitions SET status = 'cancelled', finished_at = now() WHERE competition_id = $1", [competitionId]);
  });
}

/** Open competitions on a platform that a group can challenge (the "buscar rival" list). */
export async function listOpenVersus(pool: Pool, platform: Platform, limit = 30): Promise<CompetitionView[]> {
  const { rows } = await pool.query(
    `SELECT k.competition_id, k.mode, k.platform, k.status, k.entry_minor, k.result,
            (SELECT array_agg(cg.group_id ORDER BY cg.side) FROM arena_competition_groups cg WHERE cg.competition_id = k.competition_id) AS groups,
            (SELECT count(*) FROM arena_competition_players cp WHERE cp.competition_id = k.competition_id) AS players
       FROM arena_competitions k WHERE k.status = 'open' AND k.platform = $1 AND k.mode <> 'group'
        AND (SELECT count(*) FROM arena_competition_groups cg WHERE cg.competition_id = k.competition_id) = 1
      ORDER BY k.created_at DESC LIMIT $2`, [platform, Math.min(Math.max(limit, 1), 100)]);
  return rows.map((r) => ({
    id: r.competition_id as string, mode: r.mode as CompetitionMode, platform: r.platform as Platform, status: r.status, entryMinor: Number(r.entry_minor),
    groupIds: r.groups as string[], players: Number(r.players), potMinor: Number(r.entry_minor) * Number(r.players), result: r.result,
  }));
}

/**
 * A second group answers a challenge: the open versus competition gets its other side. Both groups must be of the
 * competition's platform and the answering owner must own the group.
 */
export async function acceptChallenge(pool: Pool, competitionId: string, groupId: string, ownerId: string): Promise<void> {
  await inTransaction(pool, async (c) => {
    const k = (await c.query("SELECT mode, platform, status FROM arena_competitions WHERE competition_id = $1 FOR UPDATE", [competitionId])).rows[0];
    if (!k || k.mode === "group") throw new GroupError("NO_COMPETITION");
    if (k.status !== "open") throw new GroupError("NOT_OPEN");
    const g = (await c.query("SELECT platform, owner_account_id FROM arena_groups WHERE group_id = $1 AND closed_at IS NULL", [groupId])).rows[0];
    if (!g) throw new GroupError("NO_GROUP");
    if (g.owner_account_id !== ownerId) throw new GroupError("NOT_OWNER");
    if (g.platform !== k.platform) throw new GroupError("PLATFORM_MISMATCH");
    const sides = (await c.query("SELECT group_id FROM arena_competition_groups WHERE competition_id = $1", [competitionId])).rows;
    if (sides.length !== 1 || sides[0].group_id === groupId) throw new GroupError("INVALID_COMPETITION");
    await c.query("INSERT INTO arena_competition_groups(competition_id, group_id, side) VALUES ($1,$2,1)", [competitionId, groupId]);
    // v230: the members of the group that launched the challenge are told who accepted it.
    const name = (await c.query("SELECT name FROM arena_groups WHERE group_id = $1", [groupId])).rows[0]?.name as string | undefined;
    const members = (await c.query("SELECT account_id FROM arena_group_members WHERE group_id = $1 AND left_at IS NULL", [sides[0].group_id])).rows;
    await addNotices(c, members.map((r) => ({ accountId: r.account_id as string, kind: "challenge-accepted" as const, key: `accept:${competitionId}`,
      data: { competitionId, mode: k.mode as NoticeData["mode"], ...(name ? { group: name } : {}) } })));
  });
}

/**
 * Ranking of groups by money won on a platform: what their players received from finished competitions minus what they
 * paid in. Draws and cancellations net to zero.
 */
export async function groupWinningsRanking(pool: Pool, platform: Platform, limit = 50): Promise<{ groupId: string; name: string; netMinor: number; competitions: number }[]> {
  const { rows } = await pool.query(
    `WITH per_player AS (
       SELECT cp.group_id, cp.competition_id, k.entry_minor,
              COALESCE((SELECT sum(p.amount_minor) FROM arena_ledger_transactions t
                          JOIN arena_ledger_accounts la ON la.kind = 'player' AND la.currency = 'CC' AND la.owner_account_id = cp.account_id
                          JOIN arena_ledger_postings p ON p.tx_id = t.tx_id AND p.ledger_account_id = la.ledger_account_id
                         WHERE t.competition_id = cp.competition_id AND t.kind IN ('prize', 'refund')), 0) AS received
         FROM arena_competition_players cp JOIN arena_competitions k USING (competition_id)
        WHERE k.status = 'finished' AND k.platform = $1 AND k.entry_minor > 0
     )
     SELECT g.group_id, g.name, sum(pp.received - pp.entry_minor)::bigint AS net, count(DISTINCT pp.competition_id)::int AS competitions
       FROM per_player pp JOIN arena_groups g USING (group_id)
      GROUP BY g.group_id, g.name ORDER BY net DESC, g.group_id LIMIT $2`, [platform, Math.min(Math.max(limit, 1), 200)]);
  return rows.map((r) => ({ groupId: r.group_id as string, name: r.name as string, netMinor: Number(r.net), competitions: Number(r.competitions) }));
}

/** The groups an account belongs to (the "my groups" list), newest first. */
export async function listMyGroups(pool: Pool, accountId: string): Promise<GroupView[]> {
  const { rows } = await pool.query(
    `SELECT g.group_id, g.name, g.code, g.platform, g.owner_account_id, g.art,
            (SELECT count(*) FROM arena_group_members x WHERE x.group_id = g.group_id AND x.left_at IS NULL) AS members
       FROM arena_groups g JOIN arena_group_members m ON m.group_id = g.group_id
      WHERE m.account_id = $1 AND m.left_at IS NULL AND g.closed_at IS NULL ORDER BY g.created_at DESC LIMIT 20`, [accountId]);
  return rows.map((g) => ({ id: g.group_id as string, name: g.name as string, code: g.code as string, platform: g.platform as Platform, ownerId: g.owner_account_id as string, members: Number(g.members), art: (g.art as string | null) ?? null }));
}

/** Competitions of the groups an account belongs to, with its own entry state (the "my competitions" list). */
export async function listMyCompetitions(pool: Pool, accountId: string, limit = 20): Promise<(CompetitionView & { entered: boolean; state: unknown })[]> {
  const { rows } = await pool.query(
    `SELECT k.competition_id, k.mode, k.platform, k.status, k.entry_minor, k.result, k.state,
            (SELECT array_agg(cg.group_id ORDER BY cg.side) FROM arena_competition_groups cg WHERE cg.competition_id = k.competition_id) AS groups,
            (SELECT count(*) FROM arena_competition_players cp WHERE cp.competition_id = k.competition_id) AS players,
            EXISTS (SELECT 1 FROM arena_competition_players cp WHERE cp.competition_id = k.competition_id AND cp.account_id = $1) AS entered
       FROM arena_competitions k
      WHERE EXISTS (SELECT 1 FROM arena_competition_groups cg JOIN arena_group_members m ON m.group_id = cg.group_id AND m.account_id = $1 AND m.left_at IS NULL
                     WHERE cg.competition_id = k.competition_id)
      ORDER BY k.created_at DESC LIMIT $2`, [accountId, Math.min(Math.max(limit, 1), 50)]);
  return rows.map((r) => ({
    id: r.competition_id as string, mode: r.mode as CompetitionMode, platform: r.platform as Platform, status: r.status, entryMinor: Number(r.entry_minor),
    groupIds: r.groups as string[], players: Number(r.players), potMinor: Number(r.entry_minor) * Number(r.players), result: r.result, entered: Boolean(r.entered),
    state: r.state ?? null,
  }));
}

/** v220: the owner picks the group's picture among the app's group pictures (null: back to the default one). */
export async function setGroupArt(pool: Pool, ownerId: string, groupId: string, art: string | null): Promise<void> {
  if (art !== null && !isGroupArtId(art)) throw new GroupError("INVALID_ART");
  const { rowCount } = await pool.query("UPDATE arena_groups SET art = $3 WHERE group_id = $1 AND owner_account_id = $2 AND closed_at IS NULL", [groupId, ownerId, art]);
  if (!rowCount) throw new GroupError("NOT_OWNER");
}

/** v204: the owner renames the group (2–30 characters). */
export async function renameGroup(pool: Pool, ownerId: string, groupId: string, name: string): Promise<void> {
  const clean = name.trim().replace(/\s+/g, " ");
  if (clean.length < 2 || clean.length > 30) throw new GroupError("INVALID_NAME");
  const { rowCount } = await pool.query("UPDATE arena_groups SET name = $3 WHERE group_id = $1 AND owner_account_id = $2 AND closed_at IS NULL", [groupId, ownerId, clean]);
  if (!rowCount) throw new GroupError("NOT_OWNER");
}
