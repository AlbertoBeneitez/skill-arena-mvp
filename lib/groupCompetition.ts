/**
 * Group competitions (v128) — pure rules: no React, DOM, network, clock or Math.random, so the same module can run
 * on the server once groups have real players. Amounts are integer cents.
 *
 * Formats (chosen when the competition is created):
 *  - single:        one match, everyone plays the same game and seed; the best score wins;
 *  - league-rounds: rounds of individual matches (same game and seed for everyone, played whenever each player
 *                   wants); the best score in a round is a victory;
 *  - league-duels:  1-v-1 duels in a round-robin calendar (same seed for both players); each duel won is a victory;
 *  - tournament:    every round all remaining players play the same game; the lowest score is eliminated until one
 *                   is left.
 * One entry fee per player covers every match. The pot minus the platform commission is paid when the competition
 * ends: after the agreed number of rounds or by majority vote (leagues), after its match (single) or when one player
 * is left (tournament). Ties share the prize of the places they occupy.
 */
export const GROUP_COMMISSION_BPS = 500; // 5 %

export type GroupFormat = "single" | "league-rounds" | "league-duels" | "tournament";
export type GroupSplit = "winner" | "70-30";
export type GroupEnd = { kind: "rounds"; rounds: number } | { kind: "vote" };
export type GroupPlayer = { id: string; name: string; avatar: string; simulated?: boolean };
export type GroupConfig = {
  format: GroupFormat;
  entryMinor: number;
  split: GroupSplit;
  /** Game of round k is gameIds[(k - 1) % length]. */
  gameIds: readonly string[];
  /** Games where the lowest score wins (reaction times). */
  lowerWinsGameIds: readonly string[];
  end: GroupEnd;
};
export type GroupMatch = { round: number; gameId: string; seed: string; players: readonly string[]; scores: Readonly<Record<string, number>> };
export type GroupCompetition = {
  id: string;
  config: GroupConfig;
  players: readonly GroupPlayer[];
  matches: readonly GroupMatch[];
  votes: readonly string[];
  eliminated: readonly string[];
  finished: boolean;
  /** Prize per player id (cents), set when the competition ends. */
  payouts: Readonly<Record<string, number>> | null;
};
export type GroupStanding = { id: string; wins: number; beaten: number; played: number; out: boolean; place: number };

const SPLITS: Record<GroupSplit, readonly number[]> = { winner: [10000], "70-30": [7000, 3000] };

export function groupMoney(c: Pick<GroupCompetition, "config" | "players">) {
  const pot = c.config.entryMinor * c.players.length;
  const commission = Math.round((pot * GROUP_COMMISSION_BPS) / 10000);
  return { pot, commission, prize: pot - commission };
}

const active = (c: GroupCompetition) => c.players.map((p) => p.id).filter((id) => !c.eliminated.includes(id));
const currentRound = (c: GroupCompetition) => c.matches.reduce((r, m) => Math.max(r, m.round), 0);
const complete = (m: GroupMatch) => m.players.every((id) => m.scores[id] !== undefined);

/** Circle-method round robin: the pairs of round k (1-based) among `ids`; an odd player out rests that round. */
function duelPairs(ids: readonly string[], k: number) {
  const list = ids.length % 2 ? [...ids, ""] : [...ids];
  const n = list.length, r = (k - 1) % (n - 1);
  const rotated = [list[0], ...list.slice(1).map((_, i) => list[1 + ((i + r) % (n - 1))])];
  const pairs: [string, string][] = [];
  for (let i = 0; i < n / 2; i++) {
    const a = rotated[i], b = rotated[n - 1 - i];
    if (a && b) pairs.push([a, b]);
  }
  return pairs;
}

function schedule(c: GroupCompetition, round: number): GroupCompetition {
  const gameId = c.config.gameIds[(round - 1) % c.config.gameIds.length];
  const groups = c.config.format === "league-duels" ? duelPairs(active(c), round) : [active(c)];
  const matches = groups.map((players, i) => ({ round, gameId, seed: `${c.id}:r${round}:m${i}`, players, scores: {} }));
  return { ...c, matches: [...c.matches, ...matches] };
}

export function createGroupCompetition(id: string, config: GroupConfig, players: readonly GroupPlayer[]): GroupCompetition {
  if (players.length < 2) throw new Error("A group competition needs at least two players");
  if (!config.gameIds.length) throw new Error("A group competition needs a game");
  const end: GroupEnd = config.format === "single" || config.format === "tournament" ? { kind: "rounds", rounds: 1 } : config.end;
  return schedule({ id, config: { ...config, end }, players, matches: [], votes: [], eliminated: [], finished: false, payouts: null }, 1);
}

/** Player ids ordered from best to worst result in a match (only those with a score). */
function ranking(c: GroupCompetition, m: GroupMatch) {
  const lower = c.config.lowerWinsGameIds.includes(m.gameId);
  return m.players.filter((id) => m.scores[id] !== undefined).sort((a, b) => (lower ? m.scores[a] - m.scores[b] : m.scores[b] - m.scores[a]));
}

export function groupStandings(c: GroupCompetition): GroupStanding[] {
  const rows = c.players.map((p) => ({ id: p.id, wins: 0, beaten: 0, played: 0, out: c.eliminated.includes(p.id), place: 0 }));
  const row = (id: string) => rows.find((r) => r.id === id)!;
  for (const m of c.matches) {
    if (!complete(m)) continue;
    const order = ranking(c, m), best = m.scores[order[0]], lower = c.config.lowerWinsGameIds.includes(m.gameId);
    for (const id of order) {
      const r = row(id), s = m.scores[id];
      r.played++;
      r.beaten += order.filter((o) => (lower ? s < m.scores[o] : s > m.scores[o])).length;
      if (s === best && order.filter((o) => m.scores[o] === best).length === 1) r.wins++;
    }
  }
  // Tournament: later elimination is better; leagues: victories, then opponents beaten.
  const outAt = (id: string) => (c.eliminated.includes(id) ? c.eliminated.indexOf(id) : c.eliminated.length + 1);
  const key = (r: GroupStanding) => (c.config.format === "tournament" ? [outAt(r.id), r.beaten] : [r.wins, r.beaten]);
  rows.sort((a, b) => key(b)[0] - key(a)[0] || key(b)[1] - key(a)[1]);
  rows.forEach((r, i) => { const prev = rows[i - 1]; r.place = prev && key(prev)[0] === key(r)[0] && key(prev)[1] === key(r)[1] ? prev.place : i + 1; });
  return rows;
}

function settle(c: GroupCompetition): GroupCompetition {
  const { prize } = groupMoney(c), shares = SPLITS[c.config.split], standings = groupStandings(c), payouts: Record<string, number> = {};
  for (const s of standings) payouts[s.id] = 0;
  for (let place = 1; place <= standings.length; place++) {
    const tied = standings.filter((s) => s.place === place);
    if (!tied.length) continue;
    const share = shares.slice(place - 1, place - 1 + tied.length).reduce((a, b) => a + b, 0);
    const total = Math.floor((prize * share) / 10000), each = Math.floor(total / tied.length);
    tied.forEach((s, i) => { payouts[s.id] = each + (i === 0 ? total - each * tied.length : 0); });
  }
  return { ...c, finished: true, payouts };
}

/** After a round is complete: eliminate (tournament), finish or schedule the next round. */
function advance(c: GroupCompetition): GroupCompetition {
  const round = currentRound(c);
  if (c.finished || !c.matches.filter((m) => m.round === round).every(complete)) return c;
  let next = c;
  if (c.config.format === "tournament") {
    const order = ranking(c, c.matches.find((m) => m.round === round)!);
    next = { ...c, eliminated: [...c.eliminated, order[order.length - 1]] };
    return active(next).length <= 1 ? settle(next) : schedule(next, round + 1);
  }
  if (c.config.end.kind === "rounds" && round >= c.config.end.rounds) return settle(next);
  return schedule(next, round + 1);
}

export function recordGroupScore(c: GroupCompetition, matchIndex: number, playerId: string, score: number): GroupCompetition {
  const m = c.matches[matchIndex];
  if (c.finished || !m || !m.players.includes(playerId) || m.scores[playerId] !== undefined || !Number.isFinite(score)) return c;
  const matches = c.matches.map((x, i) => (i === matchIndex ? { ...x, scores: { ...x.scores, [playerId]: score } } : x));
  return advance({ ...c, matches });
}

/** Leagues with the vote rule end as soon as a majority of the players has voted; open matches do not count. */
export function voteToEndGroup(c: GroupCompetition, playerId: string): GroupCompetition {
  if (c.finished || c.config.end.kind !== "vote" || c.votes.includes(playerId) || !c.players.some((p) => p.id === playerId)) return c;
  const next = { ...c, votes: [...c.votes, playerId] };
  return next.votes.length * 2 > c.players.length ? settle({ ...next, matches: next.matches.filter(complete) }) : next;
}

/** Index of the next match this player still has to play, or -1. */
export function nextGroupMatch(c: GroupCompetition, playerId: string) {
  return c.finished ? -1 : c.matches.findIndex((m) => m.players.includes(playerId) && m.scores[playerId] === undefined);
}

export function isGroupCompetition(v: unknown): v is GroupCompetition {
  const c = v as GroupCompetition;
  return !!c && typeof c.id === "string" && Array.isArray(c.players) && Array.isArray(c.matches) && Array.isArray(c.votes)
    && Array.isArray(c.eliminated) && typeof c.finished === "boolean" && !!c.config && Array.isArray(c.config.gameIds);
}
