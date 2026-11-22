/**
 * v192 · Group against group (owner, 15-nov). Two groups of the same size meet in a league or a tournament. Underneath
 * it is one ordinary group competition with every player of both groups (lib/groupCompetition.ts): the same games,
 * schedule, tie-breaks and rules. What changes is who wins:
 *
 * - League: the league is the players' league. At the end each group adds up the final positions of its members
 *   (1st = 1, 2nd = 2…); the lower sum wins. Equal sums: the group with the best-placed player wins.
 * - Tournament (v192, `rules` absent): every round the two worst players of all knock out (never the last player of
 *   both groups at once: with one player left in each group only the worse one goes). It ends as soon as a group has no
 *   players left; the group that keeps players wins.
 * - Eliminatoria v2 (v229, owner 21-nov; `rules: "v2"`, every new tournament): five matchdays. Each matchday every
 *   player still in plays the same game and seed and scores victory points by place among them (the first N, N =
 *   players in the match, each place one less, the last 1); then the worst one of that matchday is out, so their group
 *   has fewer chances to score. Each group adds up its members' points; the most points wins. It ends after the fifth
 *   matchday, or earlier if a group has no players left. Equal points: the group with more players still in; still
 *   equal: a draw (entries back).
 *
 * Money (proposal until the owner rules otherwise): one entry per player; the winning group's members share the pot
 * equally, cent by cent; nobody pays a commission (groups keep none since v186). Pure TypeScript.
 */
import { createGroupCompetition, groupStandings, matchOrder, recordGroupScore, type GroupCompetition, type GroupConfig, type GroupPlayer } from "./groupCompetition";

export type VersusMode = "league" | "tournament";
export type VersusTeam = { id: string; name: string; players: readonly GroupPlayer[] };
export type GroupVersus = { id: string; mode: VersusMode; teams: readonly [VersusTeam, VersusTeam]; comp: GroupCompetition; rules?: "v2" };
/** v229: matchdays of an eliminatoria (owner, 21-nov). */
export const ELIMINATORIA_ROUNDS = 5;
export type VersusOutcome =
  | { finished: false; alive?: readonly [number, number] }
  | { finished: true; winner: string | null; sums?: readonly [number, number]; alive?: readonly [number, number] };
/** v229: victory points of each group in an eliminatoria v2 (index = team). */
export type VersusPoints = readonly [number, number];

export type VersusSetup = Pick<GroupConfig, "entryMinor" | "gameIds" | "randomPool" | "lowerWinsGameIds"> & { rounds?: number };

export function createGroupVersus(id: string, mode: VersusMode, a: VersusTeam, b: VersusTeam, setup: VersusSetup): GroupVersus {
  if (a.id === b.id) throw new Error("A group cannot play against itself");
  if (!a.players.length || a.players.length !== b.players.length) throw new Error("Both groups need the same number of players");
  const ids = [...a.players, ...b.players].map((p) => p.id);
  if (new Set(ids).size !== ids.length) throw new Error("A player cannot be in both groups");
  const config: GroupConfig = {
    format: mode === "league" ? "league-rounds" : "tournament",
    entryMinor: setup.entryMinor,
    split: "winner",
    commissionBps: 0,
    gameIds: setup.gameIds,
    ...(setup.randomPool ? { randomPool: setup.randomPool } : {}),
    lowerWinsGameIds: setup.lowerWinsGameIds,
    end: { kind: "rounds", rounds: mode === "tournament" ? ELIMINATORIA_ROUNDS : Math.max(1, Math.floor(setup.rounds ?? 5)) },
    ...(mode === "tournament" ? { eliminatePerRound: 1, stopAfterRounds: true } : {}),
  };
  const v: GroupVersus = { id, mode, teams: [a, b], comp: createGroupCompetition(id, config, [...a.players, ...b.players]) };
  return mode === "tournament" ? { ...v, rules: "v2" } : v;
}

const teamOf = (v: GroupVersus, playerId: string) => (v.teams[0].players.some((p) => p.id === playerId) ? 0 : 1);

/** v229: victory points per group in an eliminatoria v2, from every complete matchday so far. */
export function versusPoints(v: GroupVersus): VersusPoints {
  const pts: [number, number] = [0, 0];
  for (const m of v.comp.matches) {
    if (!m.players.every((id) => m.scores[id] !== undefined)) continue;
    const order = matchOrder(v.comp, m);
    order.forEach((id, idx) => { pts[teamOf(v, id)] += order.length - idx; });
  }
  return pts;
}

const aliveCount = (v: GroupVersus) =>
  v.teams.map((t) => t.players.filter((p) => !v.comp.eliminated.includes(p.id)).length) as [number, number];

export function versusOutcome(v: GroupVersus): VersusOutcome {
  if (v.mode === "tournament" && v.rules === "v2") {
    const alive = aliveCount(v), sums = versusPoints(v);
    if (!v.comp.finished && alive[0] > 0 && alive[1] > 0) return { finished: false, alive };
    const order = sums[0] !== sums[1] ? (sums[0] > sums[1] ? 0 : 1) : alive[0] !== alive[1] ? (alive[0] > alive[1] ? 0 : 1) : null;
    return { finished: true, winner: order === null ? null : v.teams[order].id, sums, alive };
  }
  if (v.mode === "tournament") {
    const alive = v.teams.map((t) => t.players.filter((p) => !v.comp.eliminated.includes(p.id)).length) as [number, number];
    if (alive[0] === 0 || alive[1] === 0) return { finished: true, winner: alive[0] > 0 ? v.teams[0].id : v.teams[1].id, alive };
    return { finished: false, alive };
  }
  if (!v.comp.finished) return { finished: false };
  const standings = groupStandings(v.comp);
  const sums: [number, number] = [0, 0];
  const best: [number, number] = [Infinity, Infinity];
  for (const s of standings) {
    const t = teamOf(v, s.id);
    sums[t] += s.place;
    best[t] = Math.min(best[t], s.place);
  }
  const winner = sums[0] !== sums[1] ? (sums[0] < sums[1] ? 0 : 1) : best[0] !== best[1] ? (best[0] < best[1] ? 0 : 1) : null;
  return { finished: true, winner: winner === null ? null : v.teams[winner].id, sums };
}

/** Records a score; in a tournament the meeting stops as soon as one group has no players left. */
export function recordVersusScore(v: GroupVersus, matchIndex: number, playerId: string, score: number, timeMs?: number): GroupVersus {
  let comp = recordGroupScore(v.comp, matchIndex, playerId, score, timeMs);
  const next = { ...v, comp };
  if (v.mode === "tournament" && !comp.finished) {
    // Never knock out the last player of both groups in the same round: give the better of them back.
    const out = comp.eliminated.slice(v.comp.eliminated.length);
    const aliveOf = (t: 0 | 1, elim: readonly string[]) => next.teams[t].players.filter((p) => !elim.includes(p.id)).length;
    if (out.length === 2 && aliveOf(0, comp.eliminated) === 0 && aliveOf(1, comp.eliminated) === 0) {
      comp = { ...comp, eliminated: comp.eliminated.slice(0, -1) }; // the list is worst first, so the last is the better one
    }
    if (aliveOf(0, comp.eliminated) === 0 || aliveOf(1, comp.eliminated) === 0) comp = { ...comp, finished: true, matches: comp.matches.filter((m) => m.round <= Math.max(...comp.matches.filter((x) => Object.keys(x.scores).length).map((x) => x.round))) };
    return { ...next, comp };
  }
  return next;
}

/** Each player's share in minor units: the winning group's members split the pot equally; a draw gives entries back. */
export function versusPayouts(v: GroupVersus): Record<string, number> | null {
  const outcome = versusOutcome(v);
  if (!outcome.finished) return null;
  const all = [...v.teams[0].players, ...v.teams[1].players];
  const entry = v.comp.config.entryMinor;
  if (outcome.winner === null) return Object.fromEntries(all.map((p) => [p.id, entry]));
  const winners = v.teams.find((t) => t.id === outcome.winner)!.players.map((p) => p.id).sort();
  const pot = entry * all.length, base = Math.floor(pot / winners.length);
  let left = pot - base * winners.length;
  return Object.fromEntries(all.map((p) => {
    if (!winners.includes(p.id)) return [p.id, 0];
    const extra = left > 0 ? 1 : 0;
    left -= extra;
    return [p.id, base + extra];
  }));
}
