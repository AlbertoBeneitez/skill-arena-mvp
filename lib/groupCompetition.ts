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
 * One entry fee per player covers every match. The pot is paid when the competition ends: after the agreed number of rounds or by majority vote (leagues), after its match (single) or when one player
 * is left (tournament). Ties share the prize of the places they occupy.
 * Commission (v186): none — the whole pot is the prize. Competitions created earlier have no `commissionBps` and keep
 * the 5 % they were created with, so their payouts never change.
 *
 * Tie-breaks (v174, `config.tieBreak: "time-v1"`, set on every new competition): in a match, equal scores are split by
 * the time taken (less is better), then by a reproducible draw seeded with the competition, the round and the player
 * — never by the order of the player list. A match therefore always has one winner, every elimination is decided and
 * players knocked out in the same round get distinct places. Competitions saved without the field keep the earlier
 * rules (ties share the round win and the places), so their results never change.
 *
 * Modalities (v217, owner 18-nov; they replace the formats above for new competitions, which keep their own rules):
 *  - all-vs-all ("Todos vs todos"): every matchday each member plays the same game and seed; by position the first
 *                   scores N points (N = players in the match), each place one less, the last 1;
 *  - duel-groups ("1 vs 1"):   every matchday the group finds a rival group of the same size (`assignRival`); each
 *                   member is paired at random with a member of that group; a win is 2 points, a loss 0;
 *  - relay-groups ("Relevos"): every matchday against a rival group of the same size; the members of each group play
 *                   in order (each one after the previous has played), every leg a fresh game, and the group adds its
 *                   legs up; the group with the better total wins 2 points (each of its members), the other 0.
 * A matchday closes only when everyone in it has played. Inter-group matchdays have no matches until their rival is
 * assigned; the rival group's players are kept per matchday in `rivals` (they are not in `players`).
 *
 * Random slots (v175): a `gameIds` entry may be RANDOM_GAME. Its game is drawn from `config.randomPool` only when that
 * round is scheduled (FNV-1a of competition and round), so nobody knows it beforehand and the draw is reproducible.
 */
/** Commission of competitions created before v186 (stored without `commissionBps`). */
export const LEGACY_GROUP_COMMISSION_BPS = 500; // 5 %
/** v186 · Groups keep no commission: the only fee is changing euros to cosmicoins and back (wallet). */
export const GROUP_COMMISSION_BPS = 0;
/** v175: a game slot drawn at random when its round starts. */
export const RANDOM_GAME = "random";

export type GroupFormat = "single" | "league-rounds" | "league-duels" | "tournament" | "all-vs-all" | "duel-groups" | "relay-groups";
/** v217: the three modalities offered when a competition is created. */
export const GROUP_MODALITIES = ["all-vs-all", "duel-groups", "relay-groups"] as const;
export type GroupModality = (typeof GROUP_MODALITIES)[number];
/** Modalities played against another group each matchday. */
export const isInterGroup = (f: GroupFormat) => f === "duel-groups" || f === "relay-groups";
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
  /** v229: an eliminatoria that also stops after `end.rounds` rounds (group against group, owner 21-nov). Absent on
   * older competitions, which play on until one player is left. */
  stopAfterRounds?: boolean;
  /** v174: tie-break rule; absent on competitions created before it (they keep shared results). */
  tieBreak?: "time-v1";
  /** v186: platform commission in basis points, fixed at creation (0). Absent on older competitions: 5 %. */
  commissionBps?: number;
};
export type GroupMatch = {
  round: number; gameId: string; seed: string; players: readonly string[]; scores: Readonly<Record<string, number>>;
  /** v174: time taken per player (ms), used to break equal scores. */
  times?: Readonly<Record<string, number>>;
};
/** v217: the rival group of one matchday (inter-group modalities). */
export type GroupRival = { round: number; id: string; name: string; players: readonly GroupPlayer[] };
export type GroupCompetition = {
  id: string;
  config: GroupConfig;
  players: readonly GroupPlayer[];
  /** v217: rival group per matchday (duel-groups, relay-groups). */
  rivals?: readonly GroupRival[];
  matches: readonly GroupMatch[];
  votes: readonly string[];
  eliminated: readonly string[];
  finished: boolean;
  /** Prize per player id (cents), set when the competition ends. */
  payouts: Readonly<Record<string, number>> | null;
};
export type GroupStanding = { id: string; wins: number; beaten: number; played: number; out: boolean; place: number; points: number };
/** v217: a group's row in the relay table (our group and every rival group met). */
export type GroupTeamStanding = { id: string; name: string; points: number; won: number; lost: number; played: number; place: number };
/** Id of the competition's own group in the relay table. */
export const HOME_TEAM = "home";

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

export function groupMoney(c: { config: Pick<GroupConfig, "entryMinor" | "commissionBps">; players: readonly unknown[] }) {
  const pot = c.config.entryMinor * c.players.length;
  const commission = Math.round((pot * (c.config.commissionBps ?? LEGACY_GROUP_COMMISSION_BPS)) / 10000);
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
  if (isInterGroup(c.config.format)) return c; // v217: scheduled when the matchday's rival group is assigned
  const gameId = roundGame(c, round);
  const groups = c.config.format === "league-duels" ? duelPairs(active(c), round) : [active(c)];
  const matches = groups.map((players, i) => ({ round, gameId, seed: `${c.id}:r${round}:m${i}`, players, scores: {} }));
  return { ...c, matches: [...c.matches, ...matches] };
}

export function createGroupCompetition(id: string, config: GroupConfig, players: readonly GroupPlayer[]): GroupCompetition {
  if (players.length < 2) throw new Error("A group competition needs at least two players");
  if (!config.gameIds.length) throw new Error("A group competition needs a game");
  if (config.gameIds.includes(RANDOM_GAME) && (!config.randomPool?.length || config.randomPool.includes(RANDOM_GAME))) throw new Error("A random slot needs a pool of games");
  const end: GroupEnd = config.format === "single" || (config.format === "tournament" && !config.stopAfterRounds) ? { kind: "rounds", rounds: 1 } : config.end;
  // v217: inter-group modalities move no money (a pot between two groups is not defined yet).
  const entryMinor = isInterGroup(config.format) ? 0 : config.entryMinor;
  return schedule({ id, config: { ...config, entryMinor, end, tieBreak: "time-v1", commissionBps: GROUP_COMMISSION_BPS }, players, ...(isInterGroup(config.format) ? { rivals: [] } : {}), matches: [], votes: [], eliminated: [], finished: false, payouts: null }, 1);
}

/** v217: the matchday waiting for a rival group (inter-group modalities), or 0. */
export function roundAwaitingRival(c: GroupCompetition) {
  if (c.finished || !isInterGroup(c.config.format)) return 0;
  const round = currentRound(c);
  if (round && !c.matches.filter((m) => m.round === round).every(complete)) return 0;
  return round + 1;
}

/** Reproducible shuffle (FNV-1a keys). */
const shuffled = (ids: readonly string[], key: string) => [...ids].sort((a, b) => fnv(`${key}|${a}`) - fnv(`${key}|${b}`) || (a < b ? -1 : 1));

/**
 * v217: assigns the rival group of the matchday waiting for one and schedules it. 1 vs 1: each member against a
 * member of the rival group, paired at random; relays: one match with both groups, each group in its playing order
 * (rotating every matchday). Both groups must have the same size.
 */
export function assignRival(c: GroupCompetition, rival: Omit<GroupRival, "round">): GroupCompetition {
  const round = roundAwaitingRival(c);
  if (!round) return c;
  const ours = c.players.map((p) => p.id), theirs = rival.players.map((p) => p.id);
  if (theirs.length !== ours.length) throw new Error("Both groups need the same number of players");
  if (theirs.some((id) => ours.includes(id)) || rival.id === HOME_TEAM) throw new Error("A group cannot play against itself");
  const gameId = roundGame(c, round), key = `${c.id}|r${round}|${rival.id}`;
  let matches: GroupMatch[];
  if (c.config.format === "duel-groups") {
    const a = shuffled(ours, `${key}|a`), b = shuffled(theirs, `${key}|b`);
    matches = a.map((id, i) => ({ round, gameId, seed: `${c.id}:r${round}:m${i}`, players: [id, b[i]], scores: {} }));
  } else {
    const turn = (list: readonly string[]) => list.map((_, i) => list[(i + round - 1) % list.length]);
    matches = [{ round, gameId, seed: `${c.id}:r${round}:relay`, players: [...turn(ours), ...turn(theirs)], scores: {} }];
  }
  return { ...c, rivals: [...(c.rivals ?? []), { round, ...rival }], matches: [...c.matches, ...matches] };
}

/** v217 relays: the member of the same group who has to play before `id` in this match (null when it is their turn). */
export function relayWaitingFor(c: GroupCompetition, m: GroupMatch, id: string): string | null {
  if (c.config.format !== "relay-groups") return null;
  const ours = c.players.some((p) => p.id === id), team = m.players.filter((p) => c.players.some((x) => x.id === p) === ours);
  const k = team.indexOf(id);
  return k > 0 && m.scores[team[k - 1]] === undefined ? team[k - 1] : null;
}

/** v217 relays: each group's total in a match (lower is better in reaction games). */
export function relayTotals(c: GroupCompetition, m: GroupMatch) {
  const ours = new Set(c.players.map((p) => p.id));
  let home = 0, away = 0, homeTime = 0, awayTime = 0;
  for (const id of m.players) {
    const s = m.scores[id] ?? 0, t = m.times?.[id] ?? 0;
    if (ours.has(id)) { home += s; homeTime += t; } else { away += s; awayTime += t; }
  }
  return { home, away, homeTime, awayTime };
}
/** v217 relays: the winning side of a complete match ("home" | "away"); equal totals go to the faster group, then home. */
function relayWinner(c: GroupCompetition, m: GroupMatch): "home" | "away" {
  const t = relayTotals(c, m), lower = c.config.lowerWinsGameIds.includes(m.gameId);
  if (t.home !== t.away) return (lower ? t.home < t.away : t.home > t.away) ? "home" : "away";
  return t.homeTime <= t.awayTime ? "home" : "away";
}

/** v217: the relay table — our group and every rival group met, by points (2 per matchday won). */
export function groupTeamStandings(c: GroupCompetition, homeName: string): GroupTeamStanding[] {
  const rows: GroupTeamStanding[] = [{ id: HOME_TEAM, name: homeName, points: 0, won: 0, lost: 0, played: 0, place: 0 }];
  const row = (id: string, name: string) => rows.find((r) => r.id === id) ?? (rows.push({ id, name, points: 0, won: 0, lost: 0, played: 0, place: 0 }), rows[rows.length - 1]);
  for (const m of c.matches) {
    if (!complete(m)) continue;
    const rival = c.rivals?.find((r) => r.round === m.round);
    if (!rival) continue;
    const home = row(HOME_TEAM, homeName), away = row(rival.id, rival.name), w = relayWinner(c, m);
    home.played++; away.played++;
    if (w === "home") { home.points += 2; home.won++; away.lost++; } else { away.points += 2; away.won++; home.lost++; }
  }
  rows.sort((a, b) => b.points - a.points || b.won - a.won || (a.id === HOME_TEAM ? -1 : b.id === HOME_TEAM ? 1 : 0));
  rows.forEach((r, i) => { const prev = rows[i - 1]; r.place = prev && prev.points === r.points && prev.won === r.won ? prev.place : i + 1; });
  return rows;
}

/** v174: reproducible draw for exact ties (FNV-1a of competition, round, match seed and player). */
function tieDraw(c: GroupCompetition, m: GroupMatch, id: string) {
  return fnv(`${c.id}|${m.round}|${m.seed}|${id}`);
}
const timeOf = (m: GroupMatch, id: string) => { const t = m.times?.[id]; return typeof t === "number" && Number.isFinite(t) ? t : Number.POSITIVE_INFINITY; };
/** Player ids ordered from best to worst result in a match (only those with a score). */
/** v229: the finishing order of a complete match (best first), with the competition's tie-breaks. */
export function matchOrder(c: GroupCompetition, m: GroupMatch): string[] {
  return ranking(c, m);
}
function ranking(c: GroupCompetition, m: GroupMatch) {
  const lower = c.config.lowerWinsGameIds.includes(m.gameId);
  const byScore = (a: string, b: string) => (lower ? m.scores[a] - m.scores[b] : m.scores[b] - m.scores[a]);
  const ids = m.players.filter((id) => m.scores[id] !== undefined);
  if (c.config.tieBreak !== "time-v1") return ids.sort(byScore);
  return ids.sort((a, b) => byScore(a, b) || timeOf(m, a) - timeOf(m, b) || tieDraw(c, m, a) - tieDraw(c, m, b) || (a < b ? -1 : 1));
}

export function groupStandings(c: GroupCompetition): GroupStanding[] {
  const rows = c.players.map((p) => ({ id: p.id, wins: 0, beaten: 0, played: 0, out: c.eliminated.includes(p.id), place: 0, points: 0 }));
  const row = (id: string) => rows.find((r) => r.id === id);
  const modality = c.config.format === "all-vs-all" || isInterGroup(c.config.format);
  // v217: 1 vs 1 between groups counts a matchday once every duel of it has been played (the table moves matchday
  // by matchday, as in the other modalities, where a matchday is one match).
  const closed = (round: number) => c.matches.every((x) => x.round !== round || complete(x));
  for (const m of c.matches) {
    if (!complete(m) || (c.config.format === "duel-groups" && !closed(m.round))) continue;
    if (c.config.format === "relay-groups") {
      // v217: every member of the group that wins the relay scores 2 points.
      const w = relayWinner(c, m);
      for (const id of m.players) { const r = row(id); if (!r) continue; r.played++; if (w === "home") { r.points += 2; r.wins++; } }
      continue;
    }
    const order = ranking(c, m), best = m.scores[order[0]], lower = c.config.lowerWinsGameIds.includes(m.gameId);
    const broken = c.config.tieBreak === "time-v1";
    order.forEach((id, idx) => {
      const r = row(id), s = m.scores[id];
      if (!r) return; // a rival group's player
      r.played++;
      if (c.config.format === "all-vs-all") r.points += order.length - idx; // v217: N for the first … 1 for the last
      if (c.config.format === "duel-groups" && idx === 0) r.points += 2; // v217: a duel won is 2 points
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
  // Tournament: later elimination is better; modalities: points, then wins; leagues: victories, then opponents beaten.
  const outAt = (id: string) => (c.eliminated.includes(id) ? c.eliminated.indexOf(id) : c.eliminated.length + 1);
  const key = (r: GroupStanding) => (c.config.format === "tournament" ? [outAt(r.id), r.beaten] : modality ? [r.points, r.wins * 1000 + r.beaten] : [r.wins, r.beaten]);
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
    const lastRound = c.config.stopAfterRounds && c.config.end.kind === "rounds" && round >= c.config.end.rounds;
    return active(next).length <= 1 || lastRound ? settle(next) : schedule(next, round + 1);
  }
  if (c.config.end.kind === "rounds" && round >= c.config.end.rounds) return settle(next);
  return schedule(next, round + 1);
}

export function recordGroupScore(c: GroupCompetition, matchIndex: number, playerId: string, score: number, timeMs?: number): GroupCompetition {
  const m = c.matches[matchIndex];
  if (c.finished || !m || !m.players.includes(playerId) || m.scores[playerId] !== undefined || !Number.isFinite(score)) return c;
  if (relayWaitingFor(c, m, playerId)) return c; // v217: relays are played in order
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
  return c.finished ? -1 : c.matches.findIndex((m) => m.players.includes(playerId) && m.scores[playerId] === undefined && !relayWaitingFor(c, m, playerId));
}
/** v217: the match where this player still has to play but waits for a group mate (relays), or -1. */
export function waitingGroupMatch(c: GroupCompetition, playerId: string) {
  return c.finished ? -1 : c.matches.findIndex((m) => m.players.includes(playerId) && m.scores[playerId] === undefined && !!relayWaitingFor(c, m, playerId));
}

export function isGroupCompetition(v: unknown): v is GroupCompetition {
  const c = v as GroupCompetition;
  return !!c && typeof c.id === "string" && Array.isArray(c.players) && Array.isArray(c.matches) && Array.isArray(c.votes)
    && Array.isArray(c.eliminated) && typeof c.finished === "boolean" && !!c.config && Array.isArray(c.config.gameIds)
    && (c.rivals === undefined || Array.isArray(c.rivals))
    && (c.config.commissionBps === undefined || (Number.isInteger(c.config.commissionBps) && c.config.commissionBps >= 0 && c.config.commissionBps <= 10000));
}
