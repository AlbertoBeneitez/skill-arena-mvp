/**
 * Simulated members of a local group (v128) — sample data, fictitious balance only. Their scores and votes are
 * deterministic (a hash of the match seed and the member), so a saved competition replays the same way after the app
 * is reopened. Real players will replace this once groups live on the server.
 */
import { recordGroupScore, voteToEndGroup, type GroupCompetition } from "../groupCompetition";

const unit = (text: string) => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
};
type Lookup = { base: (gameId: string) => number; strength: (playerId: string) => number };

/** Records every score the simulated members owe. A round only advances once the human has played too, so this
 * stops at the human's next match (or carries on through a round in which the human rests). */
export function playSimulatedMembers(c: GroupCompetition, human: string, look: Lookup): GroupCompetition {
  for (let guard = 0; guard < 500; guard++) {
    const i = c.matches.findIndex((m) => m.players.some((id) => id !== human && m.scores[id] === undefined));
    if (c.finished || i < 0) return c;
    const m = c.matches[i], id = m.players.find((p) => p !== human && m.scores[p] === undefined)!;
    const lower = c.config.lowerWinsGameIds.includes(m.gameId), f = look.strength(id) * (0.82 + unit(`${m.seed}:${id}`) * 0.36);
    // v174: a deterministic play time (45–120 s) for the tie-break.
    c = recordGroupScore(c, i, id, Math.max(0, Math.round(lower ? look.base(m.gameId) / f : look.base(m.gameId) * f)), Math.round(45000 + unit(`${m.seed}:${id}:t`) * 75000));
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
