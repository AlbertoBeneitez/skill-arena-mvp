/**
 * Simulated members of a local group (v128) — sample data, fictitious balance only. Their scores and votes are
 * deterministic (a hash of the match seed and the member), so a saved competition replays the same way after the app
 * is reopened. v199: when other players' verified scores are available, each rival takes one of those instead.
 */
import { recordGroupScore, relayWaitingFor, voteToEndGroup, type GroupCompetition, type GroupPlayer, type GroupRival } from "../groupCompetition";

const unit = (text: string) => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
};
export type RivalSample = { score: number; timeMs: number | null };
type Lookup = {
  base: (gameId: string) => number;
  strength: (playerId: string) => number;
  /** v199: scores of other players' verified matches per game; an invented rival takes one of them. */
  samples?: Readonly<Record<string, readonly RivalSample[]>>;
};

/** Records every score the simulated members owe. A round only advances once the human has played too, so this
 * stops at the human's next match (or carries on through a round in which the human rests). */
export function playSimulatedMembers(c: GroupCompetition, human: string, look: Lookup): GroupCompetition {
  for (let guard = 0; guard < 500; guard++) {
    // v217: in a relay a member plays only once the previous member of their group has played.
    const owes = (m: GroupCompetition["matches"][number], id: string) => id !== human && m.scores[id] === undefined && !relayWaitingFor(c, m, id);
    const i = c.matches.findIndex((m) => m.players.some((id) => owes(m, id)));
    if (c.finished || i < 0) return c;
    const m = c.matches[i], id = m.players.find((p) => owes(m, p))!;
    const time = Math.round(45000 + unit(`${m.seed}:${id}:t`) * 75000); // v174: a deterministic play time (45–120 s)
    // v199: a real verified match of another player, picked the same way every time for this seed and rival.
    const pool = look.samples?.[m.gameId];
    if (pool && pool.length) {
      const pick = pool[Math.floor(unit(`${m.seed}:${id}:sample`) * pool.length)];
      c = recordGroupScore(c, i, id, Math.max(0, pick.score), pick.timeMs ?? time);
      continue;
    }
    const lower = c.config.lowerWinsGameIds.includes(m.gameId), f = look.strength(id) * (0.82 + unit(`${m.seed}:${id}`) * 0.36);
    c = recordGroupScore(c, i, id, Math.max(0, Math.round(lower ? look.base(m.gameId) / f : look.base(m.gameId) * f)), time);
  }
  return c;
}

/** The human proposes to end the league; each simulated member agrees once two rounds are played (70 % do). */
export function voteWithSimulatedMembers(c: GroupCompetition, human: string): GroupCompetition {
  c = voteToEndGroup(c, human);
  const rounds = c.matches.reduce((r, m) => Math.max(r, m.round), 0);
  for (const p of c.players) {
    if (c.finished) break;
    if (p.simulated && rounds > 2 && unit(`${c.id}:${p.id}:vote`) < 0.7) c = voteToEndGroup(c, p.id);
  }
  return c;
}

/**
 * v217 · An invented rival group of `size` players for one matchday of an inter-group modality (offline only). Names
 * and portraits come from the caller's lists, picked the same way every time for the same key; every player is
 * simulated and plays like an invented group member.
 */
export function inventRivalGroup(key: string, size: number, names: readonly string[], groupNames: readonly string[], avatars: readonly string[]): Omit<GroupRival, "round"> {
  const pick = <T,>(list: readonly T[], k: string) => list[Math.floor(unit(`${key}:${k}`) * list.length)];
  const free = [...names].sort((a, b) => unit(`${key}:n:${a}`) - unit(`${key}:n:${b}`));
  const players: GroupPlayer[] = Array.from({ length: size }, (_, i) => ({
    id: `rv-${key}-${i}`, name: free[i % Math.max(1, free.length)] ?? `Rival ${i + 1}`, avatar: avatars.length ? pick(avatars, `a${i}`) : "", simulated: true,
  }));
  return { id: `rg-${key}`, name: groupNames.length ? pick(groupNames, "g") : "Rival", players };
}
