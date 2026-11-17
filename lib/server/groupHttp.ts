/**
 * v197 · The HTTP face of groups: validates what the browser sends and calls lib/server/groups.ts. The platform always
 * comes from the signed-in account, never from the request; the entry fee, scores and prizes are never taken from it.
 * A competition's setup is rebuilt here from a few choices (format, games, entry, rounds, split) so the browser cannot
 * smuggle in rules (commission, tie-break, lower-wins games).
 */
import type { Pool } from "pg";
import type { Platform } from "@/lib/platform";
import { defaultSplit, GROUP_COMMISSION_BPS, isValidSplit, RANDOM_GAME, type GroupConfig, type GroupFormat } from "@/lib/groupCompetition";
import { GAMES, lowerScoreWins } from "@/lib/games";
import type { VersusSetup } from "@/lib/groupVersus";
import { recordEvent } from "./events";
import { relayOverview } from "./groupRelays";
import {
  GroupError, acceptChallenge, cancelCompetition, closeGroup, createCompetition, createGroup, enterCompetition, groupWinningsRanking, joinGroup,
  leaveGroup, listGroupMembers, listMyCompetitions, listMyGroups, listOpenVersus, recordResult, renameGroup, startCompetition, type CompetitionMode,
} from "./groups";

export const MAX_ENTRY_MINOR = 10_000;
const FORMATS: readonly GroupFormat[] = ["single", "league-rounds", "league-duels", "tournament"];
const MODES: readonly CompetitionMode[] = ["group", "versus-league", "versus-tournament"];
const enabledIds = () => GAMES.filter((g) => g.enabled).map((g) => g.id as string);
const isUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);
const int = (v: unknown, min: number, max: number) => (typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : null);

export class BadRequest extends Error {}
const bad = (why: string): never => { throw new BadRequest(why); };

/** Games of a setup: known and enabled ids, or the random slot (then the pool is every enabled game). */
function gamesOf(raw: unknown) {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 20) return bad("gameIds");
  const known = enabledIds();
  for (const id of raw) if (id !== RANDOM_GAME && !known.includes(id as string)) bad("gameIds");
  const gameIds = raw as string[];
  return { gameIds, randomPool: gameIds.includes(RANDOM_GAME) ? known : undefined, lowerWins: GAMES.filter((g) => lowerScoreWins(g)).map((g) => g.id as string) };
}

export function buildSetup(mode: CompetitionMode, raw: unknown): GroupConfig | VersusSetup {
  const body = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : bad("config");
  const entryMinor = int(body.entryMinor, 0, MAX_ENTRY_MINOR) ?? bad("entryMinor");
  const { gameIds, randomPool, lowerWins } = gamesOf(body.gameIds);
  if (mode !== "group") {
    const rounds = body.rounds === undefined ? undefined : (int(body.rounds, 1, 20) ?? bad("rounds"));
    return { entryMinor, gameIds, ...(randomPool ? { randomPool } : {}), lowerWinsGameIds: lowerWins, ...(rounds ? { rounds } : {}) };
  }
  const format = FORMATS.includes(body.format as GroupFormat) ? (body.format as GroupFormat) : bad("format");
  const rounds = format === "single" ? 1 : (int(body.rounds, 1, 20) ?? bad("rounds"));
  const split = Array.isArray(body.split) && isValidSplit(body.split as number[]) ? (body.split as number[]) : defaultSplit(3);
  const eliminate = body.eliminatePerRound === undefined ? undefined : (int(body.eliminatePerRound, 1, 10) ?? bad("eliminatePerRound"));
  return {
    format, entryMinor, split, gameIds, ...(randomPool ? { randomPool } : {}), lowerWinsGameIds: lowerWins,
    ...(format === "tournament" && eliminate ? { eliminatePerRound: eliminate } : {}),
    end: { kind: "rounds", rounds }, tieBreak: "time-v1", commissionBps: GROUP_COMMISSION_BPS,
  } as GroupConfig;
}

export type Actor = { accountId: string; platform: Platform };

/** Lists for the screens: my groups and competitions, open challenges on my platform, group money ranking. */
export async function groupsOverview(pool: Pool, actor: Actor) {
  const [groups, competitions, open, ranking] = await Promise.all([
    listMyGroups(pool, actor.accountId), listMyCompetitions(pool, actor.accountId), listOpenVersus(pool, actor.platform), groupWinningsRanking(pool, actor.platform, 20),
  ]);
  // v204: the group the screen shows (the newest one) with its members, as the offline screen shows its own group.
  // v211: plus the group's relay ("juego grupal") in play or its latest one (null when there is none or the table is
  // not there yet).
  const current = groups[0] ? { group: groups[0], members: await listGroupMembers(pool, groups[0].id), relay: await relayOverview(pool, actor.accountId, groups[0].id).catch(() => null) } : null;
  return { platform: actor.platform, groups, competitions, open, ranking, current };
}

/** One action. Returns the body to send; throws GroupError or BadRequest. */
export async function groupAction(pool: Pool, actor: Actor, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { accountId, platform } = actor;
  const note = (kind: "group_created" | "group_joined" | "competition_entered", mode?: string) =>
    recordEvent(pool, accountId, { kind, ...(mode ? { data: { mode } } : {}) } as never, "server").catch(() => false);
  switch (body.action) {
    case "create": {
      const group = await createGroup(pool, accountId, typeof body.name === "string" ? body.name : "", platform);
      await note("group_created");
      return { group };
    }
    case "join": {
      const group = await joinGroup(pool, accountId, typeof body.code === "string" ? body.code : "", platform);
      await note("group_joined");
      return { group };
    }
    case "rename":
      await renameGroup(pool, accountId, isUuid(body.groupId) ? body.groupId : bad("groupId"), typeof body.name === "string" ? body.name : "");
      return {};
    case "leave": await leaveGroup(pool, accountId, isUuid(body.groupId) ? body.groupId : bad("groupId")); return {};
    case "close": await closeGroup(pool, accountId, isUuid(body.groupId) ? body.groupId : bad("groupId")); return {};
    case "competition": {
      const mode = MODES.includes(body.mode as CompetitionMode) ? (body.mode as CompetitionMode) : bad("mode");
      const groupIds = Array.isArray(body.groupIds) && body.groupIds.every(isUuid) ? (body.groupIds as string[]) : bad("groupIds");
      const config = buildSetup(mode, body.config);
      const competition = await createCompetition(pool, { createdBy: accountId, mode, groupIds, config });
      await recordEvent(pool, accountId, { kind: "competition_created", data: { mode, games: config.gameIds.length } }, "server").catch(() => false);
      return { competition };
    }
    case "enter": {
      const id = isUuid(body.competitionId) ? body.competitionId : bad("competitionId");
      const out = await enterCompetition(pool, id, accountId);
      if (out.entered) await note("competition_entered", "group");
      return out;
    }
    case "start": await startCompetition(pool, isUuid(body.competitionId) ? body.competitionId : bad("competitionId"), accountId); return {};
    case "cancel": await cancelCompetition(pool, isUuid(body.competitionId) ? body.competitionId : bad("competitionId"), accountId); return {};
    case "accept":
      await acceptChallenge(pool, isUuid(body.competitionId) ? body.competitionId : bad("competitionId"), isUuid(body.groupId) ? body.groupId : bad("groupId"), accountId);
      return {};
    case "result": {
      // Only the attempt id travels: the score is read from the verified attempt on the server.
      const matchIndex = int(body.matchIndex, 0, 400) ?? bad("matchIndex");
      return recordResult(pool, { competitionId: isUuid(body.competitionId) ? body.competitionId : bad("competitionId"), matchIndex, accountId, attemptId: typeof body.attemptId === "string" && body.attemptId.length <= 80 ? body.attemptId : bad("attemptId") });
    }
    default: return bad("action");
  }
}

export const groupErrorStatus = (code: string) =>
  code === "NO_ACCOUNT" || code === "NO_GROUP" || code === "NO_COMPETITION" ? 404 : code === "NOT_OWNER" || code === "NOT_MEMBER" || code === "PLATFORM_MISMATCH" ? 403 : code === "INSUFFICIENT_BALANCE" ? 402 : 409;
export { GroupError };
