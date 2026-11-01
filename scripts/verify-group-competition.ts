import assert from "node:assert/strict";
import {
  createGroupCompetition, groupMoney, groupStandings, isGroupCompetition, nextGroupMatch, recordGroupScore, voteToEndGroup,
  type GroupCompetition, type GroupConfig, type GroupPlayer,
} from "../lib/groupCompetition";
import { playSimulatedMembers, voteWithSimulatedMembers } from "../lib/demo/groupRivals";

const players = (n: number): GroupPlayer[] => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, avatar: "", simulated: i > 0 }));
const cfg = (over: Partial<GroupConfig>): GroupConfig => ({ format: "single", entryMinor: 500, split: "winner", gameIds: ["g"], lowerWinsGameIds: [], end: { kind: "rounds", rounds: 1 }, ...over });
const play = (c: GroupCompetition, scores: Record<string, number>) => {
  for (const [id, s] of Object.entries(scores)) { const i = nextGroupMatch(c, id); if (i >= 0) c = recordGroupScore(c, i, id, s); }
  return c;
};
const total = (c: GroupCompetition) => Object.values(c.payouts ?? {}).reduce((a, b) => a + b, 0);

// One entry fee each; the pot keeps a 5 % commission.
assert.deepEqual(groupMoney({ config: cfg({}), players: players(4) }), { pot: 2000, commission: 100, prize: 1900 });

// Single match: the best score takes the prize; 70/30 pays the first two; a tie shares the places it occupies.
{
  let c = createGroupCompetition("s", cfg({}), players(4));
  c = play(c, { p0: 10, p1: 40, p2: 20, p3: 30 });
  assert.ok(c.finished);
  assert.equal(c.payouts!.p1, 1900);
  assert.equal(total(c), 1900);
  let d = createGroupCompetition("s2", cfg({ split: "70-30" }), players(3));
  d = play(d, { p0: 9, p1: 9, p2: 1 });
  assert.equal(d.payouts!.p0 + d.payouts!.p1, groupMoney(d).prize, "two tied winners share 70 % + 30 %");
  assert.ok(Math.abs(d.payouts!.p0 - d.payouts!.p1) <= 1);
  assert.equal(d.payouts!.p2, 0);
}
// Scores are recorded once, only for the players of the match.
{
  const c = createGroupCompetition("r", cfg({}), players(2));
  const once = recordGroupScore(c, 0, "p0", 5);
  assert.equal(recordGroupScore(once, 0, "p0", 99), once);
  assert.equal(recordGroupScore(c, 0, "intruder", 5), c);
}
// League of individual rounds: N rounds, a victory per round, lower-wins games respected.
{
  let c = createGroupCompetition("l", cfg({ format: "league-rounds", gameIds: ["g", "t"], lowerWinsGameIds: ["t"], end: { kind: "rounds", rounds: 3 } }), players(3));
  c = play(c, { p0: 50, p1: 10, p2: 20 });      // round 1, game g: p0 wins
  assert.equal(c.matches.at(-1)!.gameId, "t");
  c = play(c, { p0: 900, p1: 300, p2: 500 });   // round 2, game t (time): p1 wins
  assert.ok(!c.finished);
  c = play(c, { p0: 80, p1: 10, p2: 5 });       // round 3: p0 wins
  assert.ok(c.finished);
  const st = groupStandings(c);
  assert.deepEqual([st[0].id, st[0].wins, st[1].id, st[1].wins], ["p0", 2, "p1", 1]);
  assert.equal(c.payouts!.p0, groupMoney(c).prize);
}
// League of duels: a round-robin calendar, every pair meets once per cycle; with an odd count one player rests.
{
  const c = createGroupCompetition("d", cfg({ format: "league-duels", end: { kind: "rounds", rounds: 3 } }), players(4));
  let x = c;
  const met = new Set<string>();
  for (let r = 1; r <= 3; r++) {
    const round = x.matches.filter((m) => m.round === r);
    assert.equal(round.length, 2);
    for (const m of round) met.add([...m.players].sort().join("-"));
    x = play(x, { p0: 1, p1: 2, p2: 3, p3: 4 });
  }
  assert.equal(met.size, 6, "all six pairs meet");
  assert.ok(x.finished);
  const odd = createGroupCompetition("o", cfg({ format: "league-duels", end: { kind: "rounds", rounds: 5 } }), players(5));
  assert.equal(odd.matches.filter((m) => m.round === 1).length, 2);
}
// Tournament: the lowest score of each round is out until one is left; elimination order is the ranking.
{
  let c = createGroupCompetition("t", cfg({ format: "tournament", split: "70-30" }), players(4));
  c = play(c, { p0: 4, p1: 3, p2: 2, p3: 1 });
  assert.deepEqual(c.eliminated, ["p3"]);
  c = play(c, { p0: 1, p1: 3, p2: 2 });
  assert.deepEqual(c.eliminated, ["p3", "p0"]);
  c = play(c, { p1: 5, p2: 6 });
  assert.ok(c.finished);
  const st = groupStandings(c);
  assert.deepEqual(st.map((s) => s.id), ["p2", "p1", "p0", "p3"]);
  assert.equal(c.payouts!.p2, Math.floor(groupMoney(c).prize * 0.7));
  assert.equal(total(c), groupMoney(c).prize);
}
// Vote rule: the league ends when a majority votes; open matches do not count; nobody votes twice.
{
  let c = createGroupCompetition("v", cfg({ format: "league-rounds", end: { kind: "vote" } }), players(4));
  c = play(c, { p0: 3, p1: 2, p2: 1, p3: 0 });
  c = play(c, { p0: 5 });                       // round 2 open
  c = voteToEndGroup(voteToEndGroup(voteToEndGroup(c, "p1"), "p1"), "p2");
  assert.ok(!c.finished, "2 of 4 is not a majority");
  c = voteToEndGroup(c, "p3");
  assert.ok(c.finished);
  assert.ok(c.matches.every((m) => m.round === 1), "the open round is dropped");
  assert.equal(c.payouts!.p0, groupMoney(c).prize);
}
// Local play with simulated members is deterministic and always reaches a full settlement.
{
  const look = { base: () => 1000, strength: (id: string) => (id === "p0" ? 1 : 0.9 + Number(id.slice(1)) * 0.05) };
  const run = () => {
    let c = playSimulatedMembers(createGroupCompetition("sim", cfg({ format: "league-duels", end: { kind: "rounds", rounds: 4 } }), players(5)), "p0", look);
    for (let k = 0; k < 10 && !c.finished; k++) { const i = nextGroupMatch(c, "p0"); if (i >= 0) c = recordGroupScore(c, i, "p0", 1000 + k); c = playSimulatedMembers(c, "p0", look); }
    return c;
  };
  const a = run(), b = run();
  assert.deepEqual(a, b, "same competition, same result");
  assert.ok(a.finished);
  assert.equal(total(a), groupMoney(a).prize);
  let v = playSimulatedMembers(createGroupCompetition("vote", cfg({ format: "league-rounds", end: { kind: "vote" } }), players(4)), "p0", look);
  for (let k = 0; k < 3; k++) { v = recordGroupScore(v, nextGroupMatch(v, "p0"), "p0", 900); v = playSimulatedMembers(v, "p0", look); }
  v = voteWithSimulatedMembers(v, "p0");
  assert.equal(typeof v.finished, "boolean");
  assert.ok(isGroupCompetition(JSON.parse(JSON.stringify(a))), "survives a save and reload");
  assert.equal(isGroupCompetition({ id: 1 }), false);
}
console.log("Group competitions OK · single / league rounds / league duels / tournament · 5 % commission · ties · vote · simulated members");
