/**
 * Group competitions (v128) — pure rules: no React, DOM, network, clock or Math.random, so the same module can run
 * on the server once groups have real players. Amounts are integer cents.
 *
 * Formats (chosen when the competition is created):
 *  - single:        one match, everyone plays the same game and seed; the best score wins;
 *  - league-rounds: rounds of individual matches (same game and seed for everyone, played whenever each player
 *                   wants); the best score in a round is a victory;
 *  - league-duels:  1-v-1 duels in a round-robin calendar (same seed for both players); each duel won is a victory;
 *  - tournament:    ("Eliminatorias") every round all remaining players play the same game; the lowest scores are
 *                   eliminated (config.eliminatePerRound, default 1; v171) until one is left.
 * One entry fee per player covers every match. The pot minus the platform commission is paid when the competition
 * ends: after the agreed number of rounds or by majority vote (leagues), after its match (single) or when one player
 * is left (tournament). Ties share the prize of the places they occupy.
 *
 * Tie-breaks (v174, `config.tieBreak: "time-v1"`, set on every new competition): in a match, equal scores are split by
 * the time taken (less is better), then by a reproducible draw seeded with the competition, the round and the player
 * — never by the order of the player list. A match therefore always has one winner, every elimination is decided and
 * players knocked out in the same round get distinct places. Competitions saved without the field keep the earlier
 * rules (ties share the round win and the places), so their results never change.
 *
 * Random slots (v175): a `gameIds` entry may be RANDOM_GAME. Its game is drawn from `config.randomPool` only when that
 * round is scheduled (FNV-1a of competition and round), so nobody knows it beforehand and the draw is reproducible.
 */
export const GROUP_COMMISSION_BPS = 500; // 5 %
/** v175: a game slot drawn at random when its round starts. */
export const RANDOM_GAME = "random";

export type GroupFormat = "single" | "league-rounds" | "league-duels" | "tournament";
/** Prize split: legacy presets, or whole percentages per place (v166; v171: one entry per position, adding up to 100,
 * never rising from one place to the next; lower places may get 0). */
export type GroupSplit = "winner" | "70-30" | readonly number[];
export type GroupEnd = { kind: "rounds"; rounds: number } | { kind: "vote" };
export type GroupPlayer = { id: string; name: string; avatar: string; simulated?: boolean };
export type GroupConfig = {
  format: GroupFormat;
  entryMinor: number;
  split: GroupSplit;
  /** Game of round k is gameIds[(k - 1) % length]; RANDOM_GAME draws one from randomPool when the round starts. */
  gameIds: readonly string[];
  /** v175: games a RANDOM_GAME slot can draw (required when gameIds has one). */
  randomPool?: readonly string[];
  /** Games where the lowest score wins (reaction times). */
  lowerWinsGameIds: readonly string[];
  end: GroupEnd;
  /** Eliminatorias: players knocked out per round (v171; 1 when absent). */
  eliminatePerRound?: number;
  /** v174: tie-break rule; absent on competitions created before it (they keep shared results). */
  tieBreak?: "time-v1";
};
export type GroupMatch = {
  round: number; gameId: string; seed: string; players: readonly string[]; scores: Readonly<Record<string, number>>;
  /** v174: time taken per player (ms), used to break equal scores. */
  times?: Readonly<Record<string, number>>;
};
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

const SPLITS: Record<"winner" | "70-30", readonly number[]> = { winner: [10000], "70-30": [7000, 3000] };
/** v166: default split for each number of paid places (percentages). */
export const DEFAULT_SPLITS: Readonly<Record<number, readonly number[]>> = { 1: [100], 2: [70, 30], 3: [70, 20, 10], 4: [60, 25, 10, 5] };
export const MAX_PAID_PLACES = 4;
/** v171: step of the +/- buttons, in percentage points. */
export const SPLIT_STEP = 5;
export const isValidSplit = (v: readonly number[]) =>
  v.length >= 1 && v[0] > 0 && v.every((x, i) => Number.isInteger(x) && x >= 0 && (i === 0 || x <= v[i - 1])) && v.reduce((a, b) => a + b, 0) === 100;
/** Shares in basis points for a split. */
export function splitShares(split: GroupSplit): readonly number[] {
  if (typeof split === "string") return SPLITS[split];
  return isValidSplit(split) ? split.map((x) => x * 100) : SPLITS.winner;
}
/** v171: one entry per position for `positions` players: 70 / 20 / 10 and 0 for the rest (fewer positions: the
 * places that do not exist give their share to the last one that does). */
export function defaultSplit(positions: number): number[] {
  const n = Math.max(1, Math.floor(positions));
  const base = [70, 20, 10];
  const out = Array.from({ length: n }, (_, i) => base[i] ?? 0);
  if (n < base.length) out[n - 1] += base.slice(n).reduce((a, b) => a + b, 0);
  return out;
}
/**
 * v171 · The +/- buttons: place `index` goes up or down by SPLIT_STEP and the difference is taken from (or given to)
 * the last paid place — or, when that is the place being changed, the nearest place that keeps the order. Returns
 * null when no valid split exists for that move (the button is then disabled).
 */
export function stepSplit(current: readonly number[], index: number, direction: 1 | -1): number[] | null {
  const n = current.length;
  if (n < 2 || index < 0 || index >= n) return null;
  const lastPaid = current.reduce((last, x, i) => (x > 0 ? i : last), 0);
  const order = [lastPaid, lastPaid + 1, ...Array.from({ length: n }, (_, k) => n - 1 - k)];
  const tried = new Set<number>();
  for (const j of order) {
    if (j === index || j < 0 || j >= n || tried.has(j)) continue;
    tried.add(j);
    const next = [...current];
    next[index] += direction * SPLIT_STEP;
    next[j] -= direction * SPLIT_STEP;
    if (isValidSplit(next)) return next;
  }
  return null;
}

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

function fnv(text: string) {
  let h = 0x811c9dc5;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193);
  return h >>> 0;
}

/** The game of a round: its slot, or — for a RANDOM_GAME slot — a reproducible draw from the pool. */
export function roundGame(c: Pick<GroupCompetition, "id" | "config">, round: number) {
  const slot = c.config.gameIds[(round - 1) % c.config.gameIds.length];
  if (slot !== RANDOM_GAME) return slot;
  const pool = c.config.randomPool ?? [];
  return pool[fnv(`${c.id}|r${round}|game`) % pool.length];
}

function schedule(c: GroupCompetition, round: number): GroupCompetition {
  const gameId = roundGame(c, round);
  const groups = c.config.format === "league-duels" ? duelPairs(active(c), round) : [active(c)];
  const matches = groups.map((players, i) => ({ round, gameId, seed: `${c.id}:r${round}:m${i}`, players, scores: {} }));
  return { ...c, matches: [...c.matches, ...matches] };
}

export function createGroupCompetition(id: string, config: GroupConfig, players: readonly GroupPlayer[]): GroupCompetition {
  if (players.length < 2) throw new Error("A group competition needs at least two players");
  if (!config.gameIds.length) throw new Error("A group competition needs a game");
  if (config.gameIds.includes(RANDOM_GAME) && (!config.randomPool?.length || config.randomPool.includes(RANDOM_GAME))) throw new Error("A random slot needs a pool of games");
  const end: GroupEnd = config.format === "single" || config.format === "tournament" ? { kind: "rounds", rounds: 1 } : config.end;
  return schedule({ id, config: { ...config, end, tieBreak: "time-v1" }, players, matches: [], votes: [], eliminated: [], finished: false, payouts: null }, 1);
}

/** v174: reproducible draw for exact ties (FNV-1a of competition, round, match seed and player). */
function tieDraw(c: GroupCompetition, m: GroupMatch, id: string) {
  return fnv(`${c.id}|${m.round}|${m.seed}|${id}`);
}
const timeOf = (m: GroupMatch, id: string) => { const t = m.times?.[id]; return typeof t === "number" && Number.isFinite(t) ? t : Number.POSITIVE_INFINITY; };
/** Player ids ordered from best to worst result in a match (only those with a score). */
function ranking(c: GroupCompetition, m: GroupMatch) {
  const lower = c.config.lowerWinsGameIds.includes(m.gameId);
  const byScore = (a: string, b: string) => (lower ? m.scores[a] - m.scores[b] : m.scores[b] - m.scores[a]);
  const ids = m.players.filter((id) => m.scores[id] !== undefined);
  if (c.config.tieBreak !== "time-v1") return ids.sort(byScore);
  return ids.sort((a, b) => byScore(a, b) || timeOf(m, a) - timeOf(m, b) || tieDraw(c, m, a) - tieDraw(c, m, b) || (a < b ? -1 : 1));
}

export function groupStandings(c: GroupCompetition): GroupStanding[] {
  const rows = c.players.map((p) => ({ id: p.id, wins: 0, beaten: 0, played: 0, out: c.eliminated.includes(p.id), place: 0 }));
  const row = (id: string) => rows.find((r) => r.id === id)!;
  for (const m of c.matches) {
    if (!complete(m)) continue;
    const order = ranking(c, m), best = m.scores[order[0]], lower = c.config.lowerWinsGameIds.includes(m.gameId);
    const broken = c.config.tieBreak === "time-v1";
    order.forEach((id, idx) => {
      const r = row(id), s = m.scores[id];
      r.played++;
      if (broken) {
        // v174: the tie-broken order decides: you beat everyone below you and only the first wins.
        r.beaten += order.length - 1 - idx;
        if (idx === 0) r.wins++;
        return;
      }
      r.beaten += order.filter((o) => (lower ? s < m.scores[o] : s > m.scores[o])).length;
      if (s === best && order.filter((o) => m.scores[o] === best).length === 1) r.wins++;
    });
  }
  // Tournament: later elimination is better; leagues: victories, then opponents beaten.
  const outAt = (id: string) => (c.eliminated.includes(id) ? c.eliminated.indexOf(id) : c.eliminated.length + 1);
  const key = (r: GroupStanding) => (c.config.format === "tournament" ? [outAt(r.id), r.beaten] : [r.wins, r.beaten]);
  rows.sort((a, b) => key(b)[0] - key(a)[0] || key(b)[1] - key(a)[1]);
  rows.forEach((r, i) => { const prev = rows[i - 1]; r.place = prev && key(prev)[0] === key(r)[0] && key(prev)[1] === key(r)[1] ? prev.place : i + 1; });
  return rows;
}

function settle(c: GroupCompetition): GroupCompetition {
  const standings = groupStandings(c);
  // More paid places than players: the places that exist share the whole prize in the same proportions.
  const raw = splitShares(c.config.split).slice(0, Math.max(1, standings.length)), sum = raw.reduce((a, b) => a + b, 0);
  const shares = raw.map((x) => Math.floor((x * 10000) / sum));
  shares[0] += 10000 - shares.reduce((a, b) => a + b, 0);
  const { prize } = groupMoney(c), payouts: Record<string, number> = {};
  for (const s of standings) payouts[s.id] = 0;
  for (let place = 1; place <= standings.length; place++) {
    const tied = standings.filter((s) => s.place === place);
    if (!tied.length) continue;
    const share = shares.slice(place - 1, place - 1 + tied.length).reduce((a, b) => a + b, 0);
    const total = Math.floor((prize * share) / 10000), each = Math.floor(total / tied.length);
    tied.forEach((s, i) => { payouts[s.id] = each + (i === 0 ? total - each * tied.length : 0); });
  }
  // v166: the cents lost to rounding down go to the winner, so the whole prize is always paid out.
  const paid = Object.values(payouts).reduce((a, b) => a + b, 0);
  if (standings.length && paid < prize) payouts[standings[0].id] += prize - paid;
  return { ...c, finished: true, payouts };
}

/** After a round is complete: eliminate (tournament), finish or schedule the next round. */
function advance(c: GroupCompetition): GroupCompetition {
  const round = currentRound(c);
  if (c.finished || !c.matches.filter((m) => m.round === round).every(complete)) return c;
  let next = c;
  if (c.config.format === "tournament") {
    const order = ranking(c, c.matches.find((m) => m.round === round)!);
    // v171: knock out the last `eliminatePerRound` (always leaving at least one player); worst first, so a player
    // knocked out in the same round with a better score ranks above.
    const k = Math.max(1, Math.min(Math.floor(c.config.eliminatePerRound ?? 1), order.length - 1));
    next = { ...c, eliminated: [...c.eliminated, ...order.slice(-k).reverse()] };
    return active(next).length <= 1 ? settle(next) : schedule(next, round + 1);
  }
  if (c.config.end.kind === "rounds" && round >= c.config.end.rounds) return settle(next);
  return schedule(next, round + 1);
}

export function recordGroupScore(c: GroupCompetition, matchIndex: number, playerId: string, score: number, timeMs?: number): GroupCompetition {
  const m = c.matches[matchIndex];
  if (c.finished || !m || !m.players.includes(playerId) || m.scores[playerId] !== undefined || !Number.isFinite(score)) return c;
  const time = typeof timeMs === "number" && Number.isFinite(timeMs) && timeMs >= 0 ? Math.round(timeMs) : undefined;
  const matches = c.matches.map((x, i) => (i === matchIndex
    ? { ...x, scores: { ...x.scores, [playerId]: score }, ...(time !== undefined ? { times: { ...x.times, [playerId]: time } } : {}) }
    : x));
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
